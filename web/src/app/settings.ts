import { useSyncExternalStore } from 'react'

export type LanguageSetting = 'system' | 'en' | 'ru' | 'es'
export type ThemeSetting = 'system' | 'dark' | 'light'
/** `all` or an account id. */
export type AccountSelection = string

export interface Settings {
  language: LanguageSetting
  theme: ThemeSetting
  selectedAccount: AccountSelection
}

const STORAGE_KEY = 'mirror.settings'
const DEFAULTS: Settings = { language: 'system', theme: 'system', selectedAccount: 'all' }

// Per-browser preferences. They live in localStorage, apart from the journal data, and are
// read defensively: storage can be unavailable (private mode) or hold stale shapes.

let current: Settings = read()
const listeners = new Set<() => void>()

function read(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) } : DEFAULTS
  } catch {
    return DEFAULTS
  }
}

export function updateSettings(patch: Partial<Settings>): void {
  current = { ...current, ...patch }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  } catch {
    // Not persisted; the change still applies for this session.
  }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, () => current)
}
