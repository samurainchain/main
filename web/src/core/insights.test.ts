import Big from 'big.js'
import { describe, expect, it } from 'vitest'
import { dayPart, weekInsights, type Insight } from './insights'
import type { MistakeTag, Trade } from './models'
import { closedTrades } from './stats'
import { systemMistakeId } from './storage/journalStore'

let sequence = 0

/** Monday 26 Oct 2026 at `hour`, plus `day` days. */
function at(day: number, hour: number, minute = 0): string {
  return new Date(2026, 9, 26 + day, hour, minute).toISOString()
}

/** A long trade with entry 100, size 1 and the given PnL; open for `minutes`. */
function trade(pnl: string, overrides: Partial<Trade> = {}, minutes = 30): Trade {
  sequence += 1
  const openedAt = overrides.openedAt ?? at(0, 10)
  return {
    id: `t${sequence}`,
    accountId: 'a',
    symbol: 'BTCUSDT',
    side: 'long',
    market: 'cryptoPerp',
    entryPrice: '100',
    exitPrice: new Big(100).plus(pnl).toString(),
    quantity: '1',
    contractMultiplier: '1',
    stopLoss: '90',
    initialStopLoss: '90',
    fees: '0',
    openedAt,
    closedAt: new Date(Date.parse(openedAt) + minutes * 60_000).toISOString(),
    mistakeIds: [],
    setupIds: [],
    brokenRuleIds: [],
    note: '',
    source: 'manual',
    createdAt: openedAt,
    updatedAt: openedAt,
    ...overrides,
  }
}

const TAGS: MistakeTag[] = (['revengeTrading', 'noStop', 'overtrading', 'earlyExit', 'fomo'] as const).map((key, index) => ({
  id: systemMistakeId(key),
  name: '',
  colorHex: '#fff',
  isSystem: true,
  systemKey: key,
  sortOrder: index,
  isArchived: false,
}))

const kinds = (trades: Trade[]) => weekInsights(closedTrades(trades), TAGS).map((item) => item.insight.kind)
const find = <K extends Insight['kind']>(trades: Trade[], kind: K) =>
  weekInsights(closedTrades(trades), TAGS).find((item) => item.insight.kind === kind)?.insight as Extract<Insight, { kind: K }> | undefined

describe('weekInsights', () => {
  it('says nothing for a week without trades', () => {
    expect(weekInsights([], TAGS)).toEqual([])
  })

  it('reports revenge trades with how many lost and the total', () => {
    const revenge = [trade('-30', { mistakeIds: [systemMistakeId('revengeTrading')] }), trade('-20', { mistakeIds: [systemMistakeId('revengeTrading')] }), trade('10', { mistakeIds: [systemMistakeId('revengeTrading')] })]
    expect(find(revenge, 'revenge')).toEqual({ kind: 'revenge', count: 3, losses: 2, pnl: new Big(-40) })
  })

  it('skips a pattern that made money', () => {
    expect(kinds([trade('15', { mistakeIds: [systemMistakeId('noStop')] })])).not.toContain('noStop')
  })

  it('finds the weekday and part of the day that mostly loses', () => {
    const monday = [-10, -12, 5, -8].map((pnl, index) => trade(String(pnl), { openedAt: at(0, 21, index * 10) }))
    expect(find(monday, 'badSlot')).toEqual({ kind: 'badSlot', weekday: 1, part: 'evening', count: 4, losses: 3, pnl: new Big(-25) })
  })

  it('needs three trades in a slot', () => {
    expect(kinds([trade('-10', { openedAt: at(0, 21) }), trade('-10', { openedAt: at(0, 22) })])).not.toContain('badSlot')
  })

  it('names the costliest mistake with its share of the losses, not one already said', () => {
    const trades = [
      trade('-40', { mistakeIds: [systemMistakeId('revengeTrading')] }),
      trade('-30', { mistakeIds: [systemMistakeId('fomo')] }),
      trade('-30'),
    ]
    expect(find(trades, 'costliestMistake')).toEqual({ kind: 'costliestMistake', tagId: systemMistakeId('fomo'), cost: new Big(30), share: new Big(0.3) })
  })

  it('compares the best and worst emotion when one made and one lost money', () => {
    const trades = [trade('25', { emotion: 'calm' }), trade('-15', { emotion: 'anger' }), trade('-5', { emotion: 'anger' })]
    expect(find(trades, 'emotionGap')).toEqual({ kind: 'emotionGap', good: 'calm', goodPnl: new Big(25), bad: 'anger', badPnl: new Big(-20) })
  })

  it('works out what early exits left before the take profits', () => {
    const early = [trade('4', { takeProfit: '120', mistakeIds: [systemMistakeId('earlyExit')] }), trade('2', { side: 'short', exitPrice: '98', takeProfit: '80', mistakeIds: [systemMistakeId('earlyExit')] })]
    expect(find(early, 'earlyExit')).toEqual({ kind: 'earlyExit', count: 2, missed: new Big(34) })
  })

  it('notices losers held much longer than winners', () => {
    const trades = [trade('5', {}, 10), trade('5', {}, 20), trade('-5', {}, 60), trade('-5', {}, 30)]
    expect(find(trades, 'heldLosers')).toEqual({ kind: 'heldLosers', ratio: new Big(3) })
  })

  it('puts the most expensive pattern first and keeps at most four', () => {
    const trades = [
      trade('-5', { mistakeIds: [systemMistakeId('noStop')], stopLoss: undefined, initialStopLoss: undefined, emotion: 'anger' }),
      trade('-50', { mistakeIds: [systemMistakeId('revengeTrading')] }),
      trade('-20', { mistakeIds: [systemMistakeId('overtrading')] }),
      trade('30', { emotion: 'calm', takeProfit: '200', mistakeIds: [systemMistakeId('earlyExit')] }),
      trade('-10', { mistakeIds: [systemMistakeId('fomo')] }),
    ]
    const result = weekInsights(closedTrades(trades), TAGS)
    const warnings = result.filter((item) => item.tone === 'warning')
    expect(warnings).toHaveLength(4)
    expect(warnings[0]!.insight.kind).toBe('earlyExit')
    expect(warnings.map((item) => Number(item.impact))).toEqual([...warnings.map((item) => Number(item.impact))].sort((a, b) => b - a))
  })

  it('ends with the best setup, or says the week was clean', () => {
    const setup = [trade('10', { setupIds: ['breakout'] }), trade('6', { setupIds: ['breakout'] })]
    expect(find(setup, 'bestSetup')).toEqual({ kind: 'bestSetup', setupId: 'breakout', count: 2, pnl: new Big(16) })
    expect(kinds(setup)).toContain('clean')
  })
})

describe('dayPart', () => {
  it.each([
    [0, 'night'],
    [5, 'night'],
    [6, 'morning'],
    [12, 'afternoon'],
    [18, 'evening'],
    [23, 'evening'],
  ])('%i:00 is %s', (hour, part) => {
    expect(dayPart(hour)).toBe(part)
  })
})
