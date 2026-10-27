import Big from 'big.js'
import type { Emotion, MistakeTag, SystemMistakeKey } from './models'
import { tradeDuration } from './pnl'
import { systemMistakeId } from './storage/journalStore'
import { byEmotion, bySetup, mistakeCosts, type ClosedTrade } from './stats'

// Week breakdown without AI (SPEC section 13, version 1.2 fallback): plain rules over the week's
// closed trades and their mistakes, the automatic flags included, each turned into one sentence
// with its numbers. Costly patterns come first, by the money involved; then one thing that
// worked. The same trades always give the same breakdown.

export type DayPart = 'night' | 'morning' | 'afternoon' | 'evening'

export type Insight =
  | { kind: 'revenge'; count: number; losses: number; pnl: Big }
  | { kind: 'badSlot'; weekday: number; part: DayPart; count: number; losses: number; pnl: Big }
  | { kind: 'costliestMistake'; tagId: string; cost: Big; share: Big }
  | { kind: 'emotionGap'; good: Emotion; goodPnl: Big; bad: Emotion; badPnl: Big }
  | { kind: 'noStop'; count: number; pnl: Big }
  | { kind: 'overtrading'; count: number; pnl: Big }
  | { kind: 'earlyExit'; count: number; missed: Big }
  | { kind: 'heldLosers'; ratio: Big }
  | { kind: 'bestSetup'; setupId: string; count: number; pnl: Big }
  | { kind: 'clean' }

export interface RankedInsight {
  insight: Insight
  tone: 'warning' | 'good'
  /** Money behind it, for ranking. */
  impact: Big
}

/** Costly patterns shown at most; the good news comes after them. */
export const MAX_WARNINGS = 4
const MIN_SLOT_TRADES = 3
const SLOT_LOSS_SHARE = 0.6
/** Losers held this many times longer than winners is worth saying. */
const HELD_RATIO = 1.5
/** The duration pattern counts for a quarter of the losses it touches: real, but indirect. */
const HELD_WEIGHT = 0.25

const ZERO = new Big(0)
const sum = (values: readonly Big[]) => values.reduce((total, value) => total.plus(value), ZERO)

export function dayPart(hour: number): DayPart {
  if (hour < 6) return 'night'
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'evening'
}

function flagged(trades: readonly ClosedTrade[], key: SystemMistakeKey): ClosedTrade[] {
  return trades.filter((item) => item.trade.mistakeIds.includes(systemMistakeId(key)))
}

/** The breakdown of one week's closed trades, most costly first. */
export function weekInsights(trades: readonly ClosedTrade[], tags: readonly MistakeTag[]): RankedInsight[] {
  if (trades.length === 0) return []
  const warnings: RankedInsight[] = []
  const warn = (insight: Insight, impact: Big) => warnings.push({ insight, tone: 'warning', impact })
  // System mistakes that get their own sentence, so the costliest-mistake line names another.
  const covered = new Set<string>()

  const revenge = flagged(trades, 'revengeTrading')
  const revengePnl = sum(revenge.map((item) => item.pnl))
  if (revenge.length > 0 && revengePnl.lt(0)) {
    warn({ kind: 'revenge', count: revenge.length, losses: revenge.filter((item) => item.pnl.lt(0)).length, pnl: revengePnl }, revengePnl.abs())
    covered.add(systemMistakeId('revengeTrading'))
  }

  const noStop = flagged(trades, 'noStop')
  const noStopPnl = sum(noStop.map((item) => item.pnl))
  if (noStop.length > 0 && noStopPnl.lt(0)) {
    warn({ kind: 'noStop', count: noStop.length, pnl: noStopPnl }, noStopPnl.abs())
    covered.add(systemMistakeId('noStop'))
  }

  const overtrading = flagged(trades, 'overtrading')
  const overtradingPnl = sum(overtrading.map((item) => item.pnl))
  if (overtrading.length > 0 && overtradingPnl.lt(0)) {
    warn({ kind: 'overtrading', count: overtrading.length, pnl: overtradingPnl }, overtradingPnl.abs())
    covered.add(systemMistakeId('overtrading'))
  }

  // Early exits: what the take profits would have added on the same size.
  const early = flagged(trades, 'earlyExit')
  const missed = sum(
    early.map(({ trade }) => {
      if (!trade.takeProfit || !trade.exitPrice) return ZERO
      const move = new Big(trade.takeProfit).minus(trade.exitPrice).times(trade.side === 'long' ? 1 : -1)
      return move.gt(0) ? move.times(trade.quantity).times(trade.contractMultiplier) : ZERO
    }),
  )
  if (missed.gt(0)) {
    warn({ kind: 'earlyExit', count: early.length, missed }, missed)
    covered.add(systemMistakeId('earlyExit'))
  }

  // The worst weekday and part of the day, when it mostly loses.
  const slots = new Map<string, { weekday: number; part: DayPart; trades: ClosedTrade[] }>()
  for (const item of trades) {
    const opened = new Date(item.trade.openedAt)
    const key = `${opened.getDay()}|${dayPart(opened.getHours())}`
    const slot = slots.get(key) ?? { weekday: opened.getDay(), part: dayPart(opened.getHours()), trades: [] }
    slot.trades.push(item)
    slots.set(key, slot)
  }
  const worstSlot = [...slots.values()]
    .map((slot) => ({ ...slot, pnl: sum(slot.trades.map((item) => item.pnl)), losses: slot.trades.filter((item) => item.pnl.lt(0)).length }))
    .filter((slot) => slot.trades.length >= MIN_SLOT_TRADES && slot.losses / slot.trades.length >= SLOT_LOSS_SHARE && slot.pnl.lt(0))
    .sort((a, b) => a.pnl.cmp(b.pnl))[0]
  if (worstSlot) {
    warn({ kind: 'badSlot', weekday: worstSlot.weekday, part: worstSlot.part, count: worstSlot.trades.length, losses: worstSlot.losses, pnl: worstSlot.pnl }, worstSlot.pnl.abs())
  }

  const grossLoss = sum(trades.filter((item) => item.pnl.lt(0)).map((item) => item.pnl.abs()))
  const costliest = mistakeCosts(trades, tags).find((cost) => cost.cost.gt(0) && !covered.has(cost.tag.id))
  if (costliest && grossLoss.gt(0)) {
    warn({ kind: 'costliestMistake', tagId: costliest.tag.id, cost: costliest.cost, share: costliest.cost.div(grossLoss) }, costliest.cost)
  }

  const emotions = byEmotion(trades).sort((a, b) => b.pnl.cmp(a.pnl))
  const good = emotions[0]
  const bad = emotions.at(-1)
  if (good && bad && good.key !== bad.key && good.pnl.gt(0) && bad.pnl.lt(0)) {
    warn({ kind: 'emotionGap', good: good.key, goodPnl: good.pnl, bad: bad.key, badPnl: bad.pnl }, bad.pnl.abs())
  }

  const durations = (items: readonly ClosedTrade[]) => items.flatMap((item) => (tradeDuration(item.trade) ? [tradeDuration(item.trade)!] : []))
  const winners = durations(trades.filter((item) => item.pnl.gt(0)))
  const losers = durations(trades.filter((item) => item.pnl.lt(0)))
  if (winners.length >= 2 && losers.length >= 2) {
    const average = (values: number[]) => values.reduce((total, value) => total + value, 0) / values.length
    const ratio = average(losers) / average(winners)
    if (ratio >= HELD_RATIO) {
      warn({ kind: 'heldLosers', ratio: new Big(ratio.toFixed(1)) }, grossLoss.times(HELD_WEIGHT))
    }
  }

  const ranked = warnings.sort((a, b) => b.impact.cmp(a.impact)).slice(0, MAX_WARNINGS)

  const [bestSetup] = bySetup(trades)
    .filter((item) => item.count >= 2 && item.pnl.gt(0))
    .sort((a, b) => b.pnl.cmp(a.pnl))
  if (bestSetup) ranked.push({ insight: { kind: 'bestSetup', setupId: bestSetup.key, count: bestSetup.count, pnl: bestSetup.pnl }, tone: 'good', impact: bestSetup.pnl })
  if (warnings.length === 0) ranked.push({ insight: { kind: 'clean' }, tone: 'good', impact: ZERO })
  return ranked
}
