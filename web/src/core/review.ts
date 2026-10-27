import Big from 'big.js'
import type { Emotion, MistakeTag, Trade } from './models'
import { byEmotion, closedTrades, localDayKey, metrics, mistakeCosts, startOfWeek, type Breakdown, type ClosedTrade, type Metrics, type MistakeCost, type WeekStart } from './stats'

// Weekly review (SPEC section 4.9): the week's results and the questions' context.

export interface WeekSummary {
  start: Date
  /** First moment after the week. */
  end: Date
  trades: ClosedTrade[]
  metrics: Metrics
  /** Sum of R over trades with a stop. */
  totalR?: Big
  best?: ClosedTrade
  worst?: ClosedTrade
  topMistake?: MistakeCost
  /** The emotion with the lowest total PnL, when it lost money. */
  worstEmotion?: Breakdown<Emotion>
}

export function weekRange(weekStart: Date): { start: Date; end: Date } {
  const start = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate())
  return { start, end: new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7) }
}

export function weekSummary(trades: readonly Trade[], tags: readonly MistakeTag[], weekStart: Date): WeekSummary {
  const { start, end } = weekRange(weekStart)
  const week = closedTrades(trades).filter((item) => item.closedAt >= start && item.closedAt < end)
  const byPnl = [...week].sort((a, b) => b.pnl.cmp(a.pnl))
  const rs = week.flatMap((item) => (item.r ? [item.r] : []))
  const [topMistake] = mistakeCosts(week, tags)
  const [worstEmotion] = byEmotion(week).sort((a, b) => a.pnl.cmp(b.pnl))
  return {
    start,
    end,
    trades: week,
    metrics: metrics(week),
    totalR: rs.length ? rs.reduce((total, r) => total.plus(r), new Big(0)) : undefined,
    best: byPnl[0],
    worst: byPnl.length > 1 ? byPnl.at(-1) : undefined,
    topMistake: topMistake?.cost.gt(0) ? topMistake : undefined,
    worstEmotion: worstEmotion?.pnl.lt(0) ? worstEmotion : undefined,
  }
}

/**
 * The week a review is written for by default: the current week, except on its first day,
 * when the week that just ended is the one to look back on.
 */
export function defaultReviewWeek(now: Date, weekStart: WeekStart): Date {
  const current = startOfWeek(now, weekStart)
  if (localDayKey(current) !== localDayKey(now)) return current
  return new Date(current.getFullYear(), current.getMonth(), current.getDate() - 7)
}
