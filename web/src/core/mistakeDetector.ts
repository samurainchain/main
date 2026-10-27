import Big from 'big.js'
import type { SystemMistakeKey, Trade } from './models'
import { rMultiple, tradePnl } from './pnl'
import { localDayKey } from './stats'
import { systemMistakeId } from './storage/journalStore'

// MistakeDetector (SPEC section 13, version 1.1): flags mistakes from the trades themselves,
// with plain rules, so the same journal always gets the same flags. Flags join the trader's own
// tags in the cost of mistakes; a wrong one is dismissed on the trade and stays dismissed.

/** System mistakes the detector can flag, in the order they are shown. */
export const AUTO_MISTAKES = ['noStop', 'heldPastStop', 'revengeTrading', 'overtrading', 'highLeverage', 'earlyExit', 'badHour'] as const
export type AutoMistakeKey = (typeof AUTO_MISTAKES)[number] & SystemMistakeKey

/** A flag with the numbers behind it, so the trade card can say why it was raised. */
export type AutoFlag =
  | { key: 'noStop' }
  | { key: 'heldPastStop'; r: string }
  | { key: 'heldPastStop'; movedFrom: string; movedTo: string }
  | { key: 'revengeTrading'; minutes: number }
  | { key: 'overtrading'; position: number; limit: number }
  | { key: 'highLeverage'; leverage: string; median: string }
  | { key: 'earlyExit'; percent: number }
  | { key: 'badHour'; hour: number }

export interface DetectorSettings {
  /** A trade opened this soon after a losing trade closed is a revenge trade. */
  revengeMinutes: number
  /** Closed trades per day; later ones that day are overtrading. Off when missing. */
  dailyTradeLimit?: number
}

export const DEFAULT_REVENGE_MINUTES = 15
/** A loss worse than this many R means the stop was not honored. */
const HELD_PAST_STOP_R = new Big(-1.1)
/** Leverage at least this many times the trader's median is unusual. */
const HIGH_LEVERAGE_FACTOR = 2
const MIN_LEVERAGE_TRADES = 5
/** Profit taken before this share of the way to the take profit is an early exit. */
const EARLY_EXIT_SHARE = 0.5
/** Hours are judged only with this much history, and an hour only with this many trades in it. */
const MIN_HISTORY_TRADES = 20
const MIN_HOUR_TRADES = 3

const MINUTE = 60_000

function noStop(trade: Trade): AutoFlag | undefined {
  return trade.stopLoss || trade.initialStopLoss ? undefined : { key: 'noStop' }
}

/** The stop moved away from the entry, or the loss ran past the planned risk. */
function heldPastStop(trade: Trade): AutoFlag | undefined {
  const { initialStopLoss, stopLoss } = trade
  if (initialStopLoss && stopLoss) {
    const widened = trade.side === 'long' ? new Big(stopLoss).lt(initialStopLoss) : new Big(stopLoss).gt(initialStopLoss)
    if (widened) return { key: 'heldPastStop', movedFrom: initialStopLoss, movedTo: stopLoss }
  }
  const r = rMultiple(trade)
  return r && r.lt(HELD_PAST_STOP_R) ? { key: 'heldPastStop', r: r.toFixed(1) } : undefined
}

function earlyExit(trade: Trade, pnl: Big | undefined): AutoFlag | undefined {
  if (!pnl || !pnl.gt(0) || !trade.takeProfit || !trade.exitPrice) return undefined
  const planned = new Big(trade.takeProfit).minus(trade.entryPrice)
  if (planned.eq(0)) return undefined
  const share = Number(new Big(trade.exitPrice).minus(trade.entryPrice).div(planned).toFixed(4))
  return share > 0 && share < EARLY_EXIT_SHARE ? { key: 'earlyExit', percent: Math.round(share * 100) } : undefined
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2
}

/** Flags for every trade that has any, keyed by trade id. */
export function detectMistakes(trades: readonly Trade[], settings: DetectorSettings): Map<string, AutoFlag[]> {
  const pnls = new Map(trades.map((trade) => [trade.id, tradePnl(trade)]))
  const closed = trades.filter((trade) => trade.closedAt && pnls.get(trade.id))
  const flags = new Map<string, AutoFlag[]>()
  const add = (trade: Trade, flag: AutoFlag | undefined) => {
    if (flag) flags.set(trade.id, [...(flags.get(trade.id) ?? []), flag])
  }

  // Losing exits, newest first, for the revenge check.
  const losses = closed
    .filter((trade) => pnls.get(trade.id)!.lt(0))
    .map((trade) => ({ id: trade.id, closedAt: Date.parse(trade.closedAt!) }))
    .sort((a, b) => b.closedAt - a.closedAt)

  // Each trade's place among the day's closed trades, as the daily limit counts them.
  const positions = new Map<string, number>()
  if (settings.dailyTradeLimit && settings.dailyTradeLimit > 0) {
    const days = new Map<string, Trade[]>()
    for (const trade of closed) {
      const key = localDayKey(new Date(trade.closedAt!))
      days.set(key, [...(days.get(key) ?? []), trade])
    }
    for (const dayTrades of days.values()) {
      dayTrades.sort((a, b) => Date.parse(a.closedAt!) - Date.parse(b.closedAt!) || a.createdAt.localeCompare(b.createdAt))
      dayTrades.forEach((trade, index) => positions.set(trade.id, index + 1))
    }
  }

  const leverages = trades.map((trade) => Number(trade.leverage)).filter((value) => value > 0)
  const usualLeverage = leverages.length >= MIN_LEVERAGE_TRADES ? median(leverages) : undefined

  // Hours of the day (by entry) where the trader's closed trades lose money on average.
  const badHours = new Set<number>()
  if (closed.length >= MIN_HISTORY_TRADES) {
    const byHour = new Map<number, { total: Big; count: number }>()
    for (const trade of closed) {
      const hour = new Date(trade.openedAt).getHours()
      const bucket = byHour.get(hour) ?? { total: new Big(0), count: 0 }
      byHour.set(hour, { total: bucket.total.plus(pnls.get(trade.id)!), count: bucket.count + 1 })
    }
    for (const [hour, { total, count }] of byHour) if (count >= MIN_HOUR_TRADES && total.lt(0)) badHours.add(hour)
  }

  for (const trade of trades) {
    const pnl = pnls.get(trade.id)
    add(trade, noStop(trade))
    add(trade, heldPastStop(trade))

    const opened = Date.parse(trade.openedAt)
    const previousLoss = losses.find((loss) => loss.id !== trade.id && loss.closedAt <= opened)
    if (previousLoss && opened - previousLoss.closedAt <= settings.revengeMinutes * MINUTE) {
      add(trade, { key: 'revengeTrading', minutes: Math.round((opened - previousLoss.closedAt) / MINUTE) })
    }

    const position = positions.get(trade.id)
    if (position && settings.dailyTradeLimit && position > settings.dailyTradeLimit) {
      add(trade, { key: 'overtrading', position, limit: settings.dailyTradeLimit })
    }

    const leverage = Number(trade.leverage)
    if (usualLeverage && leverage > usualLeverage && leverage >= usualLeverage * HIGH_LEVERAGE_FACTOR) {
      add(trade, { key: 'highLeverage', leverage: String(leverage), median: String(usualLeverage) })
    }

    add(trade, earlyExit(trade, pnl))

    const hour = new Date(trade.openedAt).getHours()
    if (badHours.has(hour)) add(trade, { key: 'badHour', hour })
  }
  return flags
}

/** Flags the trader has not dismissed on this trade. */
export function activeFlags(trade: Trade, flags: readonly AutoFlag[] | undefined): AutoFlag[] {
  return (flags ?? []).filter((flag) => !trade.dismissedFlags?.includes(flag.key))
}

/** The trader's own mistakes plus the active flags, each mistake once. */
export function effectiveMistakeIds(trade: Trade, flags: readonly AutoFlag[] | undefined): string[] {
  const auto = activeFlags(trade, flags).map((flag) => systemMistakeId(flag.key))
  return [...new Set([...trade.mistakeIds, ...auto])]
}
