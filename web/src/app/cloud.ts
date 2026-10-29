import type { SupabaseClient } from '@supabase/supabase-js'
import { createContext, useContext, useSyncExternalStore } from 'react'
import type { JournalStore } from '../core/storage/journalStore'
import { CloudSync, type SyncingBackend } from '../core/sync/cloudSync'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './cloudConfig'

export type CloudStatus = 'unavailable' | 'signedOut' | 'syncing' | 'synced' | 'offline' | 'error'

/** Why the last sign-in link didn't sign the user in. */
export type SignInProblem = 'expired' | 'otherBrowser' | 'failed'

export interface CloudState {
  status: CloudStatus
  email?: string
  lastSyncedAt?: Date
  signInProblem?: SignInProblem
}

/** Sync after local edits settle, and regularly while the site is open. */
const EDIT_DEBOUNCE_MS = 1_500
const INTERVAL_MS = 60_000
/** Supabase Storage bucket for trade screenshots; files live under `<user id>/<image id>.jpg`. */
const IMAGE_BUCKET = 'trade-images'

/**
 * Sign-in and sync with Supabase. Sign-in is a link sent by email (no password). While signed
 * in, the journal syncs after edits, when the tab comes back into view, when the connection
 * returns and every minute. Without a configured project the cloud stays unavailable and the
 * journal works locally as before.
 */
export class CloudController {
  private state: CloudState = { status: SUPABASE_ANON_KEY ? 'signedOut' : 'unavailable' }
  private readonly listeners = new Set<() => void>()
  private client?: SupabaseClient
  private engine?: CloudSync
  private userId?: string
  private debounce?: ReturnType<typeof setTimeout>
  /** Read when the page loads, before the router replaces an unknown "#error=…" hash. */
  private readonly link = readAuthParams()
  private interval?: ReturnType<typeof setInterval>

  constructor(
    private readonly backend: SyncingBackend,
    private readonly store: JournalStore,
  ) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getState = (): CloudState => this.state

  /** The Supabase client once started, for features beyond sync (billing). */
  get supabase(): SupabaseClient | undefined {
    return this.client
  }

  async start(): Promise<void> {
    if (!SUPABASE_ANON_KEY) return
    const { createClient } = await import('@supabase/supabase-js')
    // PKCE: the email link comes back with ?code=…, which doesn't clash with the #/ routes. The
    // code is exchanged here rather than by the library, so a failure can be shown.
    const link = this.link
    this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { flowType: 'pkce', detectSessionInUrl: false, persistSession: true } })
    if (link.code) {
      const { error } = await this.client.auth.exchangeCodeForSession(link.code)
      if (error) this.set({ signInProblem: signInProblem(error) })
    } else if (link.error) {
      this.set({ signInProblem: /expired|invalid/i.test(link.error) ? 'expired' : 'failed' })
    }
    const { SupabaseRemote } = await import('../core/sync/supabaseRemote')
    this.engine = new CloudSync(this.backend, new SupabaseRemote(this.client), () => this.store.load())

    this.backend.onLocalChange = () => this.scheduleSync()
    this.store.onImagesRemoved = (ids) => void this.removeRemoteImages(ids)
    this.client.auth.onAuthStateChange((_event, session) => {
      // Run outside the auth callback: Supabase holds a lock while it executes.
      setTimeout(() => {
        void this.onSession(session?.user ? { id: session.user.id, email: session.user.email ?? '' } : undefined)
        if (session?.user) this.rememberLocale(session.user.user_metadata)
      }, 0)
    })
    const { data } = await this.client.auth.getSession()
    removeAuthParams()
    await this.onSession(data.session?.user ? { id: data.session.user.id, email: data.session.user.email ?? '' } : undefined)
    if (data.session?.user) this.rememberLocale(data.session.user.user_metadata)

    window.addEventListener('online', () => this.scheduleSync(0))
    window.addEventListener('offline', () => this.userId && this.set({ status: 'offline' }))
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && this.scheduleSync(0))
  }

  /** Sends a sign-in link to the email; it brings the user back to this page. */
  async signIn(email: string): Promise<void> {
    if (!this.client) throw new Error('Cloud sync is not configured')
    const redirect = `${window.location.origin}${window.location.pathname}`
    this.set({ signInProblem: undefined })
    const locale = appLocale()
    const { error } = await this.client.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirect, ...(locale ? { data: { locale } } : {}) } })
    if (error) throw error
  }

  /**
   * Keeps the app's language with the account, so sign-in emails come in it: the Supabase email
   * templates (supabase/templates) read it as `.Data.locale`. A new account gets it on sign-up;
   * an existing one once signed in, here.
   */
  private rememberLocale(metadata: Record<string, unknown> | undefined): void {
    const locale = appLocale()
    if (!this.client || !locale || metadata?.locale === locale) return
    void this.client.auth.updateUser({ data: { locale } }).catch(() => undefined)
  }

  /** Signs out on this device; the journal stays here, sync stops. */
  async signOut(): Promise<void> {
    await this.client?.auth.signOut()
  }

  syncNow(): void {
    this.scheduleSync(0)
  }

  /** A screenshot this device doesn't have yet, from cloud storage. */
  async downloadImage(id: string): Promise<Blob | undefined> {
    if (!this.client || !this.userId) return undefined
    const { data, error } = await this.client.storage.from(IMAGE_BUCKET).download(imagePath(this.userId, id))
    if (error) return undefined
    return data
  }

  /** Uploads screenshots added on this device that the cloud doesn't have yet. */
  private async uploadPendingImages(): Promise<void> {
    const blobs = this.store.blobs
    if (!this.client || !this.userId || !blobs) return
    for (const id of await blobs.pendingUploads()) {
      const blob = await blobs.getBlob(id)
      if (!blob) {
        await blobs.markUploaded([id])
        continue
      }
      const { error } = await this.client.storage.from(IMAGE_BUCKET).upload(imagePath(this.userId, id), blob, { contentType: 'image/jpeg', upsert: true })
      if (error) throw error
      await blobs.markUploaded([id])
    }
  }

  private async removeRemoteImages(ids: string[]): Promise<void> {
    if (!this.client || !this.userId) return
    await this.client.storage.from(IMAGE_BUCKET).remove(ids.map((id) => imagePath(this.userId!, id)))
  }

  private async onSession(user: { id: string; email: string } | undefined): Promise<void> {
    if (user?.id === this.userId) return
    this.userId = user?.id
    if (!user) {
      this.engine?.disconnect()
      clearInterval(this.interval)
      this.set({ status: 'signedOut', email: undefined, lastSyncedAt: undefined })
      return
    }
    this.set({ status: 'syncing', email: user.email, signInProblem: undefined })
    await this.engine!.connect(user.id)
    clearInterval(this.interval)
    this.interval = setInterval(() => this.scheduleSync(0), INTERVAL_MS)
    this.scheduleSync(0)
  }

  private scheduleSync(delay = EDIT_DEBOUNCE_MS): void {
    if (!this.userId || !this.engine) return
    clearTimeout(this.debounce)
    this.debounce = setTimeout(() => void this.runSync(), delay)
  }

  private async runSync(): Promise<void> {
    if (!this.engine || !this.userId) return
    if (!navigator.onLine) return this.set({ status: 'offline' })
    this.set({ status: 'syncing' })
    try {
      await this.engine.sync()
      await this.uploadPendingImages()
      this.set({ status: 'synced', lastSyncedAt: new Date() })
    } catch (error) {
      console.error('Sync failed', error)
      this.set({ status: navigator.onLine ? 'error' : 'offline' })
    }
  }

  private set(patch: Partial<CloudState>): void {
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) listener()
  }
}

/** The language the app is shown in (set on <html lang> by the i18n provider). */
function appLocale(): 'en' | 'ru' | 'es' | undefined {
  const lang = document.documentElement.lang
  return lang === 'en' || lang === 'ru' || lang === 'es' ? lang : undefined
}

function imagePath(userId: string, imageId: string): string {
  return `${userId}/${imageId}.jpg`
}

const AUTH_PARAMS = ['code', 'error', 'error_code', 'error_description']

/**
 * What the email link brought back: ?code=… on success, or an error, which Supabase puts in the
 * query or in the hash (#error=…&error_description=…).
 */
function readAuthParams(): { code?: string; error?: string } {
  const url = new URL(window.location.href)
  const hash = new URLSearchParams(url.hash.startsWith('#error') ? url.hash.slice(1) : '')
  const error = url.searchParams.get('error_description') ?? url.searchParams.get('error') ?? hash.get('error_description') ?? hash.get('error') ?? undefined
  return { code: url.searchParams.get('code') ?? undefined, error }
}

/** Sorts a failed code exchange into what the user can do about it. */
function signInProblem(error: { name?: string; message?: string }): SignInProblem {
  const text = `${error.name ?? ''} ${error.message ?? ''}`
  // The link was opened in another browser than the one that asked for it.
  if (/verifier/i.test(text)) return 'otherBrowser'
  if (/expired|invalid|already/i.test(text)) return 'expired'
  return 'failed'
}

/** Drops ?code=… (or an error) from the address once it has been read. */
function removeAuthParams(): void {
  const url = new URL(window.location.href)
  const errorHash = url.hash.startsWith('#error')
  if (!AUTH_PARAMS.some((name) => url.searchParams.has(name)) && !errorHash) return
  for (const name of AUTH_PARAMS) url.searchParams.delete(name)
  if (errorHash) url.hash = '#/profile'
  window.history.replaceState(null, '', url.toString())
  // replaceState doesn't announce the new hash: tell the router, so Profile shows the problem.
  if (errorHash) window.dispatchEvent(new HashChangeEvent('hashchange'))
}

const CloudContext = createContext<CloudController | null>(null)
export const CloudProvider = CloudContext.Provider

export function useCloud(): { cloud: CloudController; state: CloudState } {
  const cloud = useContext(CloudContext)
  if (!cloud) throw new Error('useCloud must be used inside CloudProvider')
  return { cloud, state: useSyncExternalStore(cloud.subscribe, cloud.getState) }
}
