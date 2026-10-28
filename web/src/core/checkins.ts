import Big from 'big.js'
import type { DayCheckIn, Emotion, PlanKept, SleepLevel } from './models'
import { localDayKey, type ClosedTrade } from './stats'

// Day check-ins against results: how the days the trader started tired, anxious or calm, or
// kept the plan, actually went. A day counts when it has a check-in answer and closed trades.

export interface CheckInDays<K extends string> {
  key: K
  /** Days with this answer and at least one closed trade. */
  days: number
  trades: number
  pnl: Big
  /** PnL per such day. */
  perDay: Big
}

export function checkInFor(checkins: readonly DayCheckIn[], date: string): DayCheckIn | undefined {
  return checkins.find((checkIn) => checkIn.date === date)
}

/** Closed trades' PnL grouped by an answer of the day's check-in, in the order of `order`. */
export function resultsByCheckIn<K extends string>(
  trades: readonly ClosedTrade[],
  checkins: readonly DayCheckIn[],
  answer: (checkIn: DayCheckIn) => K | undefined,
  order: readonly K[],
): CheckInDays<K>[] {
  const answers = new Map<string, K>()
  for (const checkIn of checkins) {
    const value = answer(checkIn)
    if (value !== undefined) answers.set(checkIn.date, value)
  }
  const groups = new Map<K, { days: Set<string>; trades: number; pnl: Big }>()
  for (const item of trades) {
    const day = localDayKey(item.closedAt)
    const key = answers.get(day)
    if (key === undefined) continue
    const group = groups.get(key) ?? { days: new Set<string>(), trades: 0, pnl: new Big(0) }
    group.days.add(day)
    group.trades += 1
    group.pnl = group.pnl.plus(item.pnl)
    groups.set(key, group)
  }
  return order.flatMap((key) => {
    const group = groups.get(key)
    if (!group) return []
    return [{ key, days: group.days.size, trades: group.trades, pnl: group.pnl, perDay: group.pnl.div(group.days.size) }]
  })
}

export const bySleep = (trades: readonly ClosedTrade[], checkins: readonly DayCheckIn[], order: readonly SleepLevel[]) =>
  resultsByCheckIn(trades, checkins, (checkIn) => checkIn.sleep, order)
export const byMood = (trades: readonly ClosedTrade[], checkins: readonly DayCheckIn[], order: readonly Emotion[]) =>
  resultsByCheckIn(trades, checkins, (checkIn) => checkIn.mood, order)
export const byPlanKept = (trades: readonly ClosedTrade[], checkins: readonly DayCheckIn[], order: readonly PlanKept[]) =>
  resultsByCheckIn(trades, checkins, (checkIn) => checkIn.planKept, order)
