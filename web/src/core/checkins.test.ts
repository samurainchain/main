import Big from 'big.js'
import { describe, expect, it } from 'vitest'
import { byPlanKept, bySleep, checkInFor, resultsByCheckIn } from './checkins'
import { EMOTIONS, PLAN_KEPT, SLEEP_LEVELS, type DayCheckIn } from './models'
import type { ClosedTrade } from './stats'

const closed = (day: number, hour: number, pnl: string): ClosedTrade =>
  ({ trade: { id: `t${day}-${hour}` }, pnl: new Big(pnl), closedAt: new Date(2026, 9, day, hour) }) as unknown as ClosedTrade

const checkIn = (date: string, patch: Partial<DayCheckIn>): DayCheckIn => ({
  id: date,
  date,
  plan: '',
  review: '',
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
  ...patch,
})

const trades = [closed(26, 10, '120'), closed(26, 20, '-300'), closed(27, 11, '80'), closed(28, 9, '50'), closed(29, 9, '-40')]
const checkins = [
  checkIn('2026-10-26', { sleep: 'poor', planKept: 'no' }),
  checkIn('2026-10-27', { sleep: 'good', planKept: 'yes' }),
  checkIn('2026-10-28', { sleep: 'good' }),
  checkIn('2026-10-30', { sleep: 'poor', planKept: 'yes' }),
]

describe('day check-ins against results', () => {
  it('groups closed trades by the answer of their day, in the given order', () => {
    expect(bySleep(trades, checkins, SLEEP_LEVELS)).toEqual([
      { key: 'poor', days: 1, trades: 2, pnl: new Big(-180), perDay: new Big(-180) },
      { key: 'good', days: 2, trades: 2, pnl: new Big(130), perDay: new Big(65) },
    ])
  })

  it('leaves out days without that answer, and answers without trades', () => {
    expect(byPlanKept(trades, checkins, PLAN_KEPT)).toEqual([
      { key: 'yes', days: 1, trades: 1, pnl: new Big(80), perDay: new Big(80) },
      { key: 'no', days: 1, trades: 2, pnl: new Big(-180), perDay: new Big(-180) },
    ])
  })

  it('says nothing without check-ins', () => {
    expect(resultsByCheckIn(trades, [], (c) => c.mood, EMOTIONS)).toEqual([])
  })

  it('finds the check-in of a day', () => {
    expect(checkInFor(checkins, '2026-10-27')?.sleep).toBe('good')
    expect(checkInFor(checkins, '2026-10-29')).toBeUndefined()
  })
})
