import { metrics, type ClosedTrade, type Metrics } from './stats'

// Trading sessions (Sydney, Tokyo, London, New York) in each market's own local time, so
// daylight saving moves them on its own. Used for the session clock and for results by session.

export const SESSION_KEYS = ['sydney', 'tokyo', 'london', 'newYork'] as const
export type SessionKey = (typeof SESSION_KEYS)[number]

export interface SessionDefinition {
  key: SessionKey
  timeZone: string
  /** Local opening and closing hour, same day. */
  open: number
  close: number
}

export const SESSIONS: readonly SessionDefinition[] = [
  { key: 'sydney', timeZone: 'Australia/Sydney', open: 8, close: 17 },
  { key: 'tokyo', timeZone: 'Asia/Tokyo', open: 9, close: 18 },
  { key: 'london', timeZone: 'Europe/London', open: 8, close: 17 },
  { key: 'newYork', timeZone: 'America/New_York', open: 8, close: 17 },
]

const MINUTE = 60_000

interface LocalTime {
  year: number
  month: number
  day: number
  /** 0 = Sunday. */
  weekday: number
  minutes: number
}

const formatters = new Map<string, Intl.DateTimeFormat>()
function formatter(timeZone: string): Intl.DateTimeFormat {
  let format = formatters.get(timeZone)
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' })
    formatters.set(timeZone, format)
  }
  return format
}

/** The wall-clock date and time in a time zone at an instant. */
export function localTime(date: Date, timeZone: string): LocalTime {
  const parts = Object.fromEntries(formatter(timeZone).formatToParts(date).map((part) => [part.type, part.value]))
  const year = Number(parts.year)
  const month = Number(parts.month)
  const day = Number(parts.day)
  return { year, month, day, weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(), minutes: Number(parts.hour) * 60 + Number(parts.minute) }
}

/** Offset of a time zone from UTC at an instant, in minutes. */
function offsetMinutes(date: Date, timeZone: string): number {
  const local = localTime(date, timeZone)
  const asUtc = Date.UTC(local.year, local.month - 1, local.day, 0, local.minutes)
  return Math.round((asUtc - Math.floor(date.getTime() / MINUTE) * MINUTE) / MINUTE)
}

/** The instant a wall-clock time happens in a time zone. */
export function zonedInstant(year: number, month: number, day: number, hour: number, timeZone: string): Date {
  const guess = Date.UTC(year, month - 1, day, hour)
  const first = new Date(guess - offsetMinutes(new Date(guess), timeZone) * MINUTE)
  return new Date(guess - offsetMinutes(first, timeZone) * MINUTE)
}

export interface SessionState {
  session: SessionDefinition
  live: boolean
  /** When it closes if live, otherwise when it next opens. */
  next: Date
  /** This trading day's opening and closing instants (the next one's when closed). */
  opensAt: Date
  closesAt: Date
}

/** Where each session stands at `now`: live until when, or closed until when. Weekends are closed. */
export function sessionStates(now: Date): SessionState[] {
  return SESSIONS.map((session) => {
    const local = localTime(now, session.timeZone)
    for (let offset = 0; offset < 8; offset++) {
      const day = new Date(Date.UTC(local.year, local.month - 1, local.day + offset))
      const weekday = day.getUTCDay()
      if (weekday === 0 || weekday === 6) continue
      const opensAt = zonedInstant(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), session.open, session.timeZone)
      const closesAt = zonedInstant(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), session.close, session.timeZone)
      if (now < opensAt) return { session, live: false, next: opensAt, opensAt, closesAt }
      if (now < closesAt) return { session, live: true, next: closesAt, opensAt, closesAt }
    }
    throw new Error(`No upcoming ${session.key} session`)
  })
}

/**
 * The session a moment belongs to: of the sessions open by the clock (weekends included, for
 * crypto), the one that opened last, so the London–New York overlap counts as New York.
 * Undefined between sessions.
 */
export function sessionAt(date: Date): SessionKey | undefined {
  let best: { key: SessionKey; since: number } | undefined
  for (const session of SESSIONS) {
    const { minutes } = localTime(date, session.timeZone)
    if (minutes < session.open * 60 || minutes >= session.close * 60) continue
    const since = minutes - session.open * 60
    if (!best || since < best.since) best = { key: session.key, since }
  }
  return best?.key
}

export interface SessionResult {
  key: SessionKey | 'off'
  metrics: Metrics
}

/** Results by the session a trade was opened (`entry`) or closed (`exit`) in; `off` for between sessions. */
export function resultsBySession(trades: readonly ClosedTrade[], by: 'entry' | 'exit'): SessionResult[] {
  const groups = new Map<SessionKey | 'off', ClosedTrade[]>()
  for (const item of trades) {
    const at = by === 'entry' ? new Date(item.trade.openedAt) : item.closedAt
    const key = sessionAt(at) ?? 'off'
    groups.set(key, [...(groups.get(key) ?? []), item])
  }
  return [...SESSION_KEYS, 'off' as const].flatMap((key) => {
    const items = groups.get(key)
    return items ? [{ key, metrics: metrics(items) }] : []
  })
}
