import Big from 'big.js'
import { describe, expect, it } from 'vitest'
import type { ClosedTrade } from './stats'
import { streak, streaks, tradesPerDay, tradeTotals } from './tradeStats'

const b = (values: number[]) => values.map((value) => new Big(value))
const closed = (day: number, hour: number, pnl: string, minutes = 30, fees = '1'): ClosedTrade => {
  const opened = new Date(2026, 9, day, hour)
  const closedAt = new Date(opened.getTime() + minutes * 60_000)
  return { trade: { openedAt: opened.toISOString(), closedAt: closedAt.toISOString(), fees }, pnl: new Big(pnl), closedAt } as unknown as ClosedTrade
}

describe('streak', () => {
  it('counts the current run and the longest of each kind', () => {
    expect(streak(b([10, 5, -3, -2, -1, 8, 9]))).toEqual({ current: 2, bestWin: 2, worstLoss: 3 })
    expect(streak(b([10, -3, -2]))).toEqual({ current: -2, bestWin: 1, worstLoss: 2 })
  })

  it('lets a break-even result end a run', () => {
    expect(streak(b([10, 10, 0]))).toEqual({ current: 0, bestWin: 2, worstLoss: 0 })
    expect(streak([])).toEqual({ current: 0, bestWin: 0, worstLoss: 0 })
  })
})

const trades = [closed(26, 10, '120', 10), closed(26, 20, '-300', 50), closed(27, 11, '80', 120), closed(28, 9, '50', 20, '2.5')]

describe('streaks', () => {
  it('runs by day total and by trade', () => {
    expect(streaks(trades)).toEqual({ days: { current: 2, bestWin: 2, worstLoss: 1 }, trades: { current: 2, bestWin: 2, worstLoss: 1 } })
  })
})

describe('tradeTotals', () => {
  it('averages wins, losses and holding time, adds up fees', () => {
    const totals = tradeTotals(trades)
    expect(totals.averageWin?.toString()).toBe('83.33333333333333333333')
    expect(totals.averageLoss?.toString()).toBe('300')
    expect(totals.averageHoldMs).toBe(50 * 60_000)
    expect(totals.fees.toString()).toBe('5.5')
  })

  it('measures the drawdown from the peak to now and the break-even win rate', () => {
    const totals = tradeTotals(trades)
    // Equity: 120, -180, -100, -50; the peak is 120.
    expect(totals.currentDrawdown.toString()).toBe('170')
    expect(Number(totals.breakevenWinRate!.toFixed(4))).toBe(0.7826)
  })

  it('leaves out what it can\'t know', () => {
    expect(tradeTotals([closed(1, 9, '10')])).toMatchObject({ averageLoss: undefined, breakevenWinRate: undefined })
  })
})

describe('tradesPerDay', () => {
  it('counts closed trades per day in order', () => {
    expect(tradesPerDay(trades)).toEqual([
      { day: '2026-10-26', count: 2 },
      { day: '2026-10-27', count: 1 },
      { day: '2026-10-28', count: 1 },
    ])
  })
})
