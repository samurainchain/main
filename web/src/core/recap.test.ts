import Big from 'big.js'
import { describe, expect, it } from 'vitest'
import type { MistakeTag, Side, Trade } from './models'
import { buildRecap, recapRange, shiftAnchor } from './recap'
import { closedTrades } from './stats'

let sequence = 0

/** A trade whose PnL is exactly `pnl` (entry 100, size 1), closed at `closedAt` local time. */
function trade(pnl: string, closedAt: Date, overrides: Partial<Trade> = {}): Trade {
  sequence += 1
  const side: Side = 'long'
  const iso = closedAt.toISOString()
  return {
    id: `t${sequence}`, accountId: 'a', symbol: 'BTCUSDT', side, market: 'cryptoSpot', entryPrice: '100', exitPrice: new Big(100).plus(pnl).toString(),
    quantity: '1', contractMultiplier: '1', fees: '0', openedAt: iso, closedAt: iso, mistakeIds: [], setupIds: [], brokenRuleIds: [], note: '',
    source: 'manual', createdAt: iso, updatedAt: iso, ...overrides,
  }
}

const tag = (id: string): MistakeTag => ({ id, name: id, colorHex: '#000000', isSystem: false, sortOrder: 0, isArchived: false })
// Thursday, October 29, 2026.
const day = (d: number, h = 12) => new Date(2026, 9, d, h)

describe('recapRange', () => {
  it('covers the calendar day, week and month around the date', () => {
    expect(recapRange('day', day(29, 15), 1)).toEqual({ start: new Date(2026, 9, 29), end: new Date(2026, 9, 30) })
    expect(recapRange('week', day(29), 1)).toEqual({ start: new Date(2026, 9, 26), end: new Date(2026, 10, 2) })
    expect(recapRange('week', day(29), 0).start).toEqual(new Date(2026, 9, 25))
    expect(recapRange('month', day(29), 1)).toEqual({ start: new Date(2026, 9, 1), end: new Date(2026, 10, 1) })
  })

  it('steps to the previous and next period', () => {
    expect(shiftAnchor('day', day(1), -1)).toEqual(new Date(2026, 8, 30))
    expect(shiftAnchor('week', day(29), -1)).toEqual(new Date(2026, 9, 22))
    expect(shiftAnchor('month', day(31), 1)).toEqual(new Date(2026, 10, 1))
    expect(shiftAnchor('month', day(31), -10)).toEqual(new Date(2025, 11, 1))
  })
})

describe('buildRecap', () => {
  const revenge = tag('revenge')
  const fomo = tag('fomo')
  const trades = closedTrades([
    trade('120', day(26, 10), { initialStopLoss: '60' }),
    trade('-80', day(29, 9), { initialStopLoss: '60', mistakeIds: ['revenge'] }),
    trade('-30', day(29, 11), { mistakeIds: ['fomo'] }),
    trade('50', day(29, 14), { initialStopLoss: '75' }),
    trade('400', day(20)),
  ])

  it("sums a day: its trades as bars, best and worst, the mistake that cost most", () => {
    const recap = buildRecap(trades, [revenge, fomo], 'day', day(29), 1)
    expect(recap.trades).toHaveLength(3)
    expect(recap.metrics.pnl.toString()).toBe('-60')
    expect(recap.bars.map(String)).toEqual(['-80', '-30', '50'])
    expect(recap.best?.pnl.toString()).toBe('50')
    expect(recap.worst?.pnl.toString()).toBe('-80')
    expect(recap.topMistake?.tag.id).toBe('revenge')
    // R: -80 / 40 = -2, +50 / 25 = +2; the trade without a stop is left out.
    expect(recap.totalR?.toString()).toBe('0')
    expect(recap.rCount).toBe(2)
  })

  it('gives a week one bar per day and a month one per date', () => {
    const week = buildRecap(trades, [], 'week', day(29), 1)
    expect(week.bars.map(String)).toEqual(['120', '0', '0', '-60', '0', '0', '0'])
    expect(week.metrics.count).toBe(4)
    const month = buildRecap(trades, [], 'month', day(29), 1)
    expect(month.bars).toHaveLength(31)
    expect(month.bars[19]!.toString()).toBe('400')
    expect(month.metrics.pnl.toString()).toBe('460')
  })

  it('has no best, worst or mistake when nothing qualifies', () => {
    const empty = buildRecap(trades, [revenge], 'day', day(28), 1)
    expect(empty.trades).toEqual([])
    expect([empty.best, empty.worst, empty.topMistake, empty.totalR]).toEqual([undefined, undefined, undefined, undefined])
    const winsOnly = buildRecap(trades, [revenge], 'day', day(26), 1)
    expect(winsOnly.worst).toBeUndefined()
    expect(winsOnly.topMistake).toBeUndefined()
  })
})
