import Big from 'big.js'
import { tradeDuration } from './pnl'
import { dailyPnl, equityCurve, type ClosedTrade } from './stats'

// Numbers for the dashboard's trade blocks: streaks, averages and trades per day.

const ZERO = new Big(0)
const sum = (values: readonly Big[]) => values.reduce((total, value) => total.plus(value), ZERO)

export interface Streak {
  /** Positive for a run of wins, negative for losses, 0 when the last one broke even. */
  current: number
  bestWin: number
  worstLoss: number
}

/** Runs of winning and losing results, in order; a break-even result ends a run. */
export function streak(results: readonly Big[]): Streak {
  let current = 0
  let bestWin = 0
  let worstLoss = 0
  for (const result of results) {
    if (result.gt(0)) current = current > 0 ? current + 1 : 1
    else if (result.lt(0)) current = current < 0 ? current - 1 : -1
    else current = 0
    bestWin = Math.max(bestWin, current)
    worstLoss = Math.max(worstLoss, -current)
  }
  return { current, bestWin, worstLoss }
}

/** Streaks by trading day (a day's total PnL) and by trade. */
export function streaks(trades: readonly ClosedTrade[]): { days: Streak; trades: Streak } {
  const days = [...dailyPnl(trades).entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, day]) => day.pnl)
  return { days: streak(days), trades: streak(trades.map((item) => item.pnl)) }
}

export interface TradeTotals {
  averageWin?: Big
  /** As a positive amount. */
  averageLoss?: Big
  /** Mean time from entry to exit. */
  averageHoldMs?: number
  fees: Big
  /** Fall from the highest cumulative PnL to now, as a positive amount. */
  currentDrawdown: Big
  /** Win rate at which these average wins and losses break even, 0–1. */
  breakevenWinRate?: Big
}

export function tradeTotals(trades: readonly ClosedTrade[]): TradeTotals {
  const wins = trades.filter((item) => item.pnl.gt(0)).map((item) => item.pnl)
  const losses = trades.filter((item) => item.pnl.lt(0)).map((item) => item.pnl.abs())
  const averageWin = wins.length ? sum(wins).div(wins.length) : undefined
  const averageLoss = losses.length ? sum(losses).div(losses.length) : undefined
  const holds = trades.flatMap((item) => {
    const duration = tradeDuration(item.trade)
    return duration === undefined ? [] : [duration]
  })
  const curve = equityCurve(trades)
  const peak = curve.reduce((top, point) => (point.equity.gt(top) ? point.equity : top), ZERO)
  const last = curve.at(-1)?.equity ?? ZERO
  return {
    averageWin,
    averageLoss,
    averageHoldMs: holds.length ? holds.reduce((total, value) => total + value, 0) / holds.length : undefined,
    fees: sum(trades.map((item) => new Big(item.trade.fees || 0))),
    currentDrawdown: peak.minus(last),
    breakevenWinRate: averageWin && averageLoss ? averageLoss.div(averageWin.plus(averageLoss)) : undefined,
  }
}

/** Closed trades per trading day, oldest day first. */
export function tradesPerDay(trades: readonly ClosedTrade[]): { day: string; count: number }[] {
  return [...dailyPnl(trades).entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, { count }]) => ({ day, count }))
}
