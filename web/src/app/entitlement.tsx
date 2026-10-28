import type { SupabaseClient } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { proActive, type Access } from '../core/entitlements'
import { PRO_ON_SALE, proPreview } from './billing'
import { useCloud } from './cloud'

// Whether this person has Pro (SPEC section 8). Pro belongs to the account, so it's read from
// the database after sign-in (pro_access: a purchase, the 7-day trial or a gift) and cached in
// the browser, so an offline session keeps it until it ends. Nothing is locked until Pro goes
// on sale (PRO_ON_SALE), or in a tab opened with ?pro=preview.

const CACHE_KEY = 'mirror.proAccess'

export type ProSource = 'crypto' | 'trial' | 'gift' | string

interface Cached {
  /** The account it belongs to, so another sign-in on this browser doesn't inherit it. */
  email: string
  until: string
  source: ProSource
}

export interface AccessState extends Access {
  signedIn: boolean
  until?: Date
  source?: ProSource
  refresh(): Promise<void>
}

function readCache(): Cached | undefined {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as Cached) : undefined
  } catch {
    return undefined
  }
}

function writeCache(value: Cached | undefined): void {
  try {
    if (value) localStorage.setItem(CACHE_KEY, JSON.stringify(value))
    else localStorage.removeItem(CACHE_KEY)
  } catch {
    // Not cached: Pro is read again on the next visit.
  }
}

export async function fetchProAccess(client: SupabaseClient): Promise<{ until: string; source: ProSource } | undefined> {
  const { data, error } = await client.from('pro_access').select('pro_until, source').maybeSingle<{ pro_until: string; source: string }>()
  if (error) throw error
  return data ? { until: data.pro_until, source: data.source } : undefined
}

const AccessContext = createContext<AccessState | null>(null)

export function AccessProvider({ children }: { children: ReactNode }) {
  const { cloud, state } = useCloud()
  const email = state.email
  const signedIn = Boolean(email)
  const [cached, setCached] = useState<Cached | undefined>(readCache)
  const gated = PRO_ON_SALE || proPreview()

  const refresh = useCallback(async () => {
    const client = cloud.supabase
    if (!client || !email) return
    try {
      const fresh = await fetchProAccess(client)
      const next = fresh ? { email, ...fresh } : undefined
      writeCache(next)
      setCached(next)
    } catch {
      // Offline or a server error: keep what the cache says.
    }
  }, [cloud, email])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const value = useMemo<AccessState>(() => {
    const mine = cached && cached.email === email ? cached : undefined
    const until = mine ? new Date(mine.until) : undefined
    return { gated, pro: proActive(until, new Date()), signedIn, until, source: mine?.source, refresh }
  }, [cached, email, gated, signedIn, refresh])

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>
}

export function useAccess(): AccessState {
  const access = useContext(AccessContext)
  if (!access) throw new Error('useAccess must be used inside AccessProvider')
  return access
}
