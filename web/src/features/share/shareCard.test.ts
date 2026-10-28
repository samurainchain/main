import { describe, expect, it } from 'vitest'
import type { Account, Trade } from '../../core/models'
import { buildShareCard } from './shareCard'

const t = (key: string) => key
const account = { id: 'a', currency: 'USD' } as Account
const trade = {
  id: 't', accountId: 'a', symbol: 'BTCUSDT', side: 'long', market: 'cryptoPerp', entryPrice: '67000', exitPrice: '68000', quantity: '0.1',
  contractMultiplier: '1', initialStopLoss: '66500', stopLoss: '66500', fees: '0', openedAt: '2026-10-27T10:00:00Z', closedAt: '2026-10-27T11:30:00Z',
  mistakeIds: [], setupIds: [], brokenRuleIds: [], note: '', source: 'manual', createdAt: '', updatedAt: '', rating: 4,
} as Trade

describe('buildShareCard', () => {
  it('leads with the money result and lists R, price move and hold time', () => {
    const card = buildShareCard(trade, account, false, t as never, 'en')
    expect(card.hero).toEqual({ text: '+$100.00', tone: 'profit' })
    expect(card.stats.map((stat) => stat.value)).toEqual(['+2.0R', '+1.49%', '1 hr 30 min'])
    expect([card.entry, card.exit, card.rating]).toEqual(['67,000', '68,000', 4])
  })

  it('shows R instead of the amount when the amount is hidden', () => {
    const card = buildShareCard(trade, account, true, t as never, 'en')
    expect(card.hero).toEqual({ text: '+2.0R', tone: 'profit', caption: 'trade.r' })
    expect(card.stats.map((stat) => stat.label)).toEqual(['trade.priceMove', 'trade.duration'])
    expect(JSON.stringify(card)).not.toContain('$')
  })

  it('falls back to the price move without a stop, and reads a loss', () => {
    const card = buildShareCard({ ...trade, exitPrice: '66000', initialStopLoss: undefined, stopLoss: undefined }, account, true, t as never, 'en')
    expect(card.hero).toEqual({ text: '-1.49%', tone: 'loss', caption: 'trade.priceMove' })
  })
})
