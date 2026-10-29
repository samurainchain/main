import Big from 'big.js'
import type { MistakeTag } from './models'
import { metrics, mistakeCosts, startOfDay, startOfWeek, type ClosedTrade, type Metrics, type MistakeCost, type WeekStart } from './stats'

// A day's, week's or month's results for the recap picture the trader can post (SPEC section
// 4.6). Pure: the card's text and drawing live in features/share.

export type RecapSpan = 'day' | 'week' | 'month'
export const RECAP_SPANS: readonly RecapSpan[] = ['day', 'week', 'month']

export interface RecapRange {
  start: Date
  /** Exclusive. */
  end: Date
}

/** The calendar day, week or month that holds `anchor`. */
export function recapRange(span: RecapSpan, anchor: Date, weekStart: WeekStart): RecapRange {
  if (span === 'day') {
    const start = startOfDay(anchor)
    return { start, end: new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1) }
  }
  if (span === 'week') {
    const start = startOfWeek(anchor, weekStart)
    return { start, end: new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7) }
  }
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  return { start, end: new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1) }
}

/** The same span `steps` periods earlier (negative) or later. */
export function shiftAnchor(span: RecapSpan, anchor: Date, steps: number): Date {
  if (span === 'day') return new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + steps)
  if (span === 'week') return new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + steps * 7)
  return new Date(anchor.getFullYear(), anchor.getMonth() + steps, 1)
}

export interface Recap {
  span: RecapSpan
  range: RecapRange
  trades: ClosedTrade[]
  metrics: Metrics
  /** Bars of the chart: each trade of a day, each day of a week or month, in order. */
  bars: Big[]
  /** Sum of R over the trades that have a stop, and how many of them do. */
  totalR?: Big
  rCount: number
  best?: ClosedTrade
  worst?: ClosedTrade
  /** The most expensive mistake, when one cost money. */
  topMistake?: MistakeCost
}

export function buildRecap(all: readonly ClosedTrade[], tags: readonly MistakeTag[], span: RecapSpan, anchor: Date, weekStart: WeekStart): Recap {
  const range = recapRange(span, anchor, weekStart)
  const trades = all.filter((item) => item.closedAt >= range.start && item.closedAt < range.end)
  let bars: Big[]
  if (span === 'day') {
    bars = trades.map((item) => item.pnl)
  } else {
    const days = Math.round((range.end.getTime() - range.start.getTime()) / 86_400_000)
    bars = Array.from({ length: days }, () => new Big(0))
    for (const item of trades) {
      const index = Math.round((startOfDay(item.closedAt).getTime() - range.start.getTime()) / 86_400_000)
      if (index >= 0 && index < bars.length) bars[index] = bars[index]!.plus(item.pnl)
    }
  }
  const rs = trades.flatMap((item) => (item.r ? [item.r] : []))
  const byPnl = [...trades].sort((a, b) => b.pnl.cmp(a.pnl))
  const top = mistakeCosts(trades, tags)[0]
  return {
    span,
    range,
    trades,
    metrics: metrics(trades),
    bars,
    totalR: rs.length ? rs.reduce((total, r) => total.plus(r), new Big(0)) : undefined,
    rCount: rs.length,
    best: byPnl[0]?.pnl.gt(0) ? byPnl[0] : undefined,
    worst: byPnl.at(-1)?.pnl.lt(0) ? byPnl.at(-1) : undefined,
    topMistake: top?.cost.gt(0) ? top : undefined,
  }
}
