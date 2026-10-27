import { useSyncExternalStore } from 'react'
import type { WeekStart } from '../core/stats'

export type LanguageSetting = 'system' | 'en' | 'ru' | 'es'
export type ThemeSetting = 'system' | 'dark' | 'light'
export type WeekStartSetting = 'auto' | 'monday' | 'sunday'
/** `all` or an account id. */
export type AccountSelection = string

export interface Settings {
  language: LanguageSetting
  theme: ThemeSetting
  selectedAccount: AccountSelection
  weekStart: WeekStartSetting
}

// Storage keys keep the app's first name, so saved settings survive the rename.
const STORAGE_KEY = 'mirror.settings'
const DEFAULTS: Settings = { language: 'system', theme: 'system', selectedAccount: 'all', weekStart: 'auto' }

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

/** First day of the week as `Date.getDay()`: the setting, or the browser locale's convention. */
export function useWeekStart(): WeekStart {
  const { weekStart } = useSettings()
  if (weekStart === 'monday') return 1
  if (weekStart === 'sunday') return 0
  return localeWeekStart()
}

function localeWeekStart(): WeekStart {
  try {
    const locale = new Intl.Locale(navigator.language) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number }
      weekInfo?: { firstDay: number }
    }
    const firstDay = locale.getWeekInfo?.().firstDay ?? locale.weekInfo?.firstDay
    // Intl numbers days 1 (Monday) to 7 (Sunday).
    if (firstDay !== undefined) return firstDay === 7 ? 0 : 1
  } catch {
    // Fall through to Monday.
  }
  return 1
}
