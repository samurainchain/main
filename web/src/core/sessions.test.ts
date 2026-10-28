import Big from 'big.js'
import { describe, expect, it } from 'vitest'
import { localTime, resultsBySession, sessionAt, sessionStates, zonedInstant } from './sessions'
import type { ClosedTrade } from './stats'

// 28 Oct 2026: London is back on GMT (since 25 Oct), New York still on EDT (until 1 Nov),
// Sydney on AEDT (UTC+11), Tokyo always UTC+9.
const utc = (text: string) => new Date(`${text}Z`)

describe('time zones', () => {
  it('reads the wall clock in a zone', () => {
    expect(localTime(utc('2026-10-28T15:20:00'), 'America/New_York')).toMatchObject({ day: 28, minutes: 11 * 60 + 20, weekday: 3 })
    expect(localTime(utc('2026-10-28T15:20:00'), 'Australia/Sydney')).toMatchObject({ day: 29, minutes: 2 * 60 + 20 })
  })

  it('finds the instant of a local time, across daylight saving', () => {
    expect(zonedInstant(2026, 10, 28, 8, 'Europe/London').toISOString()).toBe('2026-10-28T08:00:00.000Z')
    expect(zonedInstant(2026, 10, 23, 8, 'Europe/London').toISOString()).toBe('2026-10-23T07:00:00.000Z')
    expect(zonedInstant(2026, 10, 28, 8, 'America/New_York').toISOString()).toBe('2026-10-28T12:00:00.000Z')
    expect(zonedInstant(2026, 11, 2, 8, 'America/New_York').toISOString()).toBe('2026-11-02T13:00:00.000Z')
  })
})

describe('sessionStates', () => {
  it('shows London and New York live on a Wednesday afternoon in Europe', () => {
    const states = Object.fromEntries(sessionStates(utc('2026-10-28T15:20:00')).map((state) => [state.session.key, state]))
    expect(states.london).toMatchObject({ live: true, next: utc('2026-10-28T17:00:00') })
    expect(states.newYork).toMatchObject({ live: true, next: utc('2026-10-28T21:00:00') })
    expect(states.tokyo).toMatchObject({ live: false, next: utc('2026-10-29T00:00:00') })
    expect(states.sydney).toMatchObject({ live: false, next: utc('2026-10-28T21:00:00') })
  })

  it('skips the weekend', () => {
    const states = Object.fromEntries(sessionStates(utc('2026-10-31T12:00:00')).map((state) => [state.session.key, state]))
    expect(states.london).toMatchObject({ live: false, next: utc('2026-11-02T08:00:00') })
    expect(states.newYork).toMatchObject({ live: false, next: utc('2026-11-02T13:00:00') })
  })
})

describe('sessionAt', () => {
  it.each([
    ['2026-10-28T09:00:00', 'london'],
    ['2026-10-28T14:00:00', 'newYork'],
    ['2026-10-28T02:00:00', 'tokyo'],
    ['2026-10-28T22:00:00', 'sydney'],
  ])('%s is %s', (time, key) => {
    expect(sessionAt(utc(time))).toBe(key)
  })

  it('is undefined between sessions', () => {
    // July: New York (EDT) closes at 21:00 UTC, Sydney (AEST, UTC+10) opens at 22:00 UTC.
    expect(sessionAt(utc('2026-07-01T21:30:00'))).toBeUndefined()
    expect(sessionAt(utc('2026-07-01T22:30:00'))).toBe('sydney')
  })
})

describe('resultsBySession', () => {
  const trade = (openedAt: string, closedAt: string, pnl: string) =>
    ({ trade: { openedAt: `${openedAt}Z` }, pnl: new Big(pnl), closedAt: utc(closedAt) }) as unknown as ClosedTrade

  it('groups trades by the session they were opened or closed in', () => {
    const trades = [trade('2026-10-28T14:00:00', '2026-10-28T14:30:00', '100'), trade('2026-10-28T16:50:00', '2026-10-28T23:00:00', '-40'), trade('2026-10-28T09:00:00', '2026-10-28T09:10:00', '25')]
    const entry = resultsBySession(trades, 'entry').map((group) => [group.key, group.metrics.count, group.metrics.pnl.toString()])
    expect(entry).toEqual([
      ['london', 1, '25'],
      ['newYork', 2, '60'],
    ])
    const exit = resultsBySession(trades, 'exit').map((group) => [group.key, group.metrics.count])
    expect(exit).toEqual([
      ['sydney', 1],
      ['london', 1],
      ['newYork', 1],
    ])
  })
})
