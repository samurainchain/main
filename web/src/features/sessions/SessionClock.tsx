import { useEffect, useState } from 'react'
import { SESSION_KEYS, sessionStates, type SessionState } from '../../core/sessions'
import { Card } from '../../design/components'
import { formatDuration } from '../../i18n/format'
import { useI18n } from '../../i18n/i18n'

const HOUR = 3_600_000
const DAY = 24 * HOUR

/** The current time, ticking every `ms`. */
function useNow(ms: number): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), ms)
    return () => window.clearInterval(timer)
  }, [ms])
  return now
}

const clock = (date: Date, timeZone: string, seconds = false) =>
  new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', ...(seconds ? { second: '2-digit' } : {}), hourCycle: 'h23' }).format(date)

/** A session's window on today's UTC day, as left/width percentages (two pieces when it wraps midnight). */
function segments(state: SessionState, now: Date): { left: number; width: number }[] {
  const dayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const start = (((state.opensAt.getTime() - dayStart) % DAY) + DAY) % DAY
  const length = state.closesAt.getTime() - state.opensAt.getTime()
  const pieces = start + length <= DAY ? [[start, length]] : [[start, DAY - start], [0, start + length - DAY]]
  return pieces.map(([from, span]) => ({ left: (from! / DAY) * 100, width: (span! / DAY) * 100 }))
}

/**
 * Trading sessions now: UTC and local time, each market's local time, live or when it opens,
 * and a 24-hour UTC track with the session's hours and a "now" line.
 */
export function SessionClock({ className }: { className?: string }) {
  const { t, locale } = useI18n()
  const now = useNow(1000)
  const states = sessionStates(now)
  const byKey = new Map(states.map((state) => [state.session.key, state]))
  const nowShare = ((now.getTime() % DAY) / DAY) * 100
  const upcoming = states.filter((state) => !state.live).sort((a, b) => a.next.getTime() - b.next.getTime())[0]
  const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone

  return (
    <Card className={['session-clock', className ?? ''].filter(Boolean).join(' ')}>
      <p className="caption">{t('sessions.title')}</p>
      <p className="session-clock__utc numeric">{clock(now, 'UTC', true)} UTC</p>
      <p className="caption">{t('sessions.local', { time: clock(now, localZone), zone: localZone.replace(/_/g, ' ') })}</p>
      <ul className="session-clock__list">
        {SESSION_KEYS.map((key) => {
          const state = byKey.get(key)!
          return (
            <li key={key} className={`session-row${state.live ? ' session-row--live' : ''}`}>
              <div className="session-row__head">
                <span className="session-row__name">{t(`sessions.name.${key}`)}</span>
                <span className="session-row__time numeric">{clock(now, state.session.timeZone)}</span>
                {state.live ? (
                  <span className="session-row__status">
                    <span className="session-live">{t('sessions.live')}</span>
                    <span className="caption"> {t('sessions.closesIn', { time: formatDuration(state.next.getTime() - now.getTime(), locale) })}</span>
                  </span>
                ) : (
                  <span className="session-row__status caption">{t('sessions.opensIn', { time: formatDuration(state.next.getTime() - now.getTime(), locale) })}</span>
                )}
              </div>
              <div className="session-row__track" aria-hidden="true">
                {segments(state, now).map((piece, index) => (
                  <span key={index} className="session-row__window" style={{ left: `${piece.left}%`, width: `${piece.width}%` }} />
                ))}
                <span className="session-row__now" style={{ left: `${nowShare}%` }} />
              </div>
            </li>
          )
        })}
      </ul>
      {upcoming && (
        <p className="caption">
          {t('sessions.next', { name: t(`sessions.name.${upcoming.session.key}`), time: formatDuration(upcoming.next.getTime() - now.getTime(), locale) })}
        </p>
      )}
    </Card>
  )
}
