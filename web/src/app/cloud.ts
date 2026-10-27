import type { SupabaseClient } from '@supabase/supabase-js'
import { createContext, useContext, useSyncExternalStore } from 'react'
import type { JournalStore } from '../core/storage/journalStore'
import { CloudSync, type SyncingBackend } from '../core/sync/cloudSync'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './cloudConfig'

export type CloudStatus = 'unavailable' | 'signedOut' | 'syncing' | 'synced' | 'offline' | 'error'

export interface CloudState {
  status: CloudStatus
  email?: string
  lastSyncedAt?: Date
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

  async start(): Promise<void> {
    if (!SUPABASE_ANON_KEY) return
    const { createClient } = await import('@supabase/supabase-js')
    // PKCE: the email link comes back with ?code=…, which doesn't clash with the #/ routes.
    this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true } })
    const { SupabaseRemote } = await import('../core/sync/supabaseRemote')
    this.engine = new CloudSync(this.backend, new SupabaseRemote(this.client), () => this.store.load())

    this.backend.onLocalChange = () => this.scheduleSync()
    this.store.onImagesRemoved = (ids) => void this.removeRemoteImages(ids)
    this.client.auth.onAuthStateChange((_event, session) => {
      // Run outside the auth callback: Supabase holds a lock while it executes.
      setTimeout(() => void this.onSession(session?.user ? { id: session.user.id, email: session.user.email ?? '' } : undefined), 0)
    })
    const { data } = await this.client.auth.getSession()
    removeAuthParams()
    await this.onSession(data.session?.user ? { id: data.session.user.id, email: data.session.user.email ?? '' } : undefined)

    window.addEventListener('online', () => this.scheduleSync(0))
    window.addEventListener('offline', () => this.userId && this.set({ status: 'offline' }))
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && this.scheduleSync(0))
  }

  /** Sends a sign-in link to the email; it brings the user back to this page. */
  async signIn(email: string): Promise<void> {
    if (!this.client) throw new Error('Cloud sync is not configured')
    const redirect = `${window.location.origin}${window.location.pathname}`
    const { error } = await this.client.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirect } })
    if (error) throw error
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
    this.set({ status: 'syncing', email: user.email })
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

function imagePath(userId: string, imageId: string): string {
  return `${userId}/${imageId}.jpg`
}

/** Drops ?code=… (or an error) from the address once Supabase has read it. */
function removeAuthParams(): void {
  const url = new URL(window.location.href)
  if (!['code', 'error', 'error_code', 'error_description'].some((name) => url.searchParams.has(name))) return
  for (const name of ['code', 'error', 'error_code', 'error_description']) url.searchParams.delete(name)
  window.history.replaceState(null, '', url.toString())
}

const CloudContext = createContext<CloudController | null>(null)
export const CloudProvider = CloudContext.Provider

export function useCloud(): { cloud: CloudController; state: CloudState } {
  const cloud = useContext(CloudContext)
  if (!cloud) throw new Error('useCloud must be used inside CloudProvider')
  return { cloud, state: useSyncExternalStore(cloud.subscribe, cloud.getState) }
}
