import Big from 'big.js'
import { describe, expect, it } from 'vitest'
import type { MistakeTag, Trade } from '../../core/models'
import { buildRecap } from '../../core/recap'
import { closedTrades } from '../../core/stats'
import { buildRecapCard } from './recapCard'

const t = (key: string) => key
const tp = (key: string, count: number) => `${count} ${key}`
const day = (d: number, h = 12) => new Date(2026, 9, d, h)
const revenge: MistakeTag = { id: 'revenge', name: 'Revenge', colorHex: '#000000', isSystem: false, sortOrder: 0, isArchived: false }

function trade(pnl: string, closedAt: Date, overrides: Partial<Trade> = {}): Trade {
  const iso = closedAt.toISOString()
  return {
    id: `${pnl}-${iso}`, accountId: 'a', symbol: 'BTCUSDT', side: 'long', market: 'cryptoSpot', entryPrice: '100', exitPrice: new Big(100).plus(pnl).toString(),
    quantity: '1', contractMultiplier: '1', fees: '0', openedAt: iso, closedAt: iso, mistakeIds: [], setupIds: [], brokenRuleIds: [], note: '',
    source: 'manual', createdAt: iso, updatedAt: iso, ...overrides,
  }
}

const trades = closedTrades([
  trade('120', day(26), { initialStopLoss: '60' }),
  trade('-80', day(29, 9), { initialStopLoss: '60', mistakeIds: ['revenge'] }),
  trade('50', day(29, 14), { initialStopLoss: '75' }),
])
const card = (span: 'day' | 'week' | 'month', hide: boolean, anchor = day(29)) =>
  buildRecapCard(buildRecap(trades, [revenge], span, anchor, 1), 'USD', hide, t as never, tp as never, 'en', (tag) => tag.name)

describe('buildRecapCard', () => {
  it('leads with the period PnL and names the mistake that cost most', () => {
    const day = card('day', false)
    expect(day.label).toBe('recap.label.day')
    expect(day.period).toBe('Thursday, October 29')
    expect(day.hero).toEqual({ text: '-$30.00', tone: 'loss' })
    expect(day.bars).toEqual([-1, 0.625])
    expect(day.stats.map((stat) => stat.value)).toEqual(['2', '50%', '+$50.00', '-$80.00'])
    expect(day.leak).toEqual({ label: 'recap.leak', name: 'Revenge', detail: '-$80.00 · 1 recap.leakTrades' })
  })

  it('labels a week’s bars with weekdays from the week start', () => {
    const week = card('week', false)
    expect(week.period.replace(/\s/g, ' ')).toBe('Oct 26 – Nov 1')
    expect(week.barLabels).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S'])
    expect(week.hero.text).toBe('+$90.00')
  })

  it('shows no money at all when the amount is hidden', () => {
    const hidden = card('week', true)
    // R: +3 (120 on a 40 risk), -2, +2 → +3R in total.
    expect(hidden.hero).toEqual({ text: '+3.0R', tone: 'profit', caption: 'recap.totalR' })
    expect(JSON.stringify(hidden)).not.toContain('$')
  })

  it('says so when the period has no trades', () => {
    const empty = card('day', false, day(28))
    expect(empty.empty).toBe('recap.empty')
    expect(empty.bars).toEqual([])
    expect(empty.leak).toBeUndefined()
  })
})
