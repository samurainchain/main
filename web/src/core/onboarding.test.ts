import { describe, expect, it } from 'vitest'
import { accountsFromAnswers, canFinish, type AccountNames, type OnboardingAnswers } from './onboarding'

const names: AccountNames = {
  market: { cryptoSpot: 'spot', cryptoPerp: 'futures', stock: 'stocks', futures: 'CME futures' },
  cryptoExchange: 'Crypto exchange',
  broker: 'Broker',
}

const answers = (patch: Partial<OnboardingAnswers>): OnboardingAnswers => ({ markets: [], venues: [], weaknesses: [], currency: 'USDT', ...patch })
const summary = (patch: Partial<OnboardingAnswers>) =>
  accountsFromAnswers(answers(patch), names).map((account) => `${account.name} | ${account.assetClass} | ${account.currency}`)

describe('accountsFromAnswers', () => {
  it('creates one account per crypto venue and market', () => {
    expect(summary({ markets: ['cryptoPerp', 'cryptoSpot'], venues: ['binance', 'bybit'] })).toEqual([
      'Binance — futures | cryptoPerp | USDT',
      'Bybit — futures | cryptoPerp | USDT',
      'Binance — spot | cryptoSpot | USDT',
      'Bybit — spot | cryptoSpot | USDT',
    ])
  })

  it('puts stocks and futures at the broker, in USD', () => {
    expect(summary({ markets: ['stock', 'futures'], venues: ['ibkr', 'binance'], currency: 'USDT' })).toEqual([
      'Interactive Brokers — stocks | stock | USD',
      'Interactive Brokers — CME futures | futures | USD',
    ])
  })

  it('falls back to generic venues when none match the market', () => {
    expect(summary({ markets: ['cryptoPerp', 'stock'], venues: ['other'], currency: 'USD' })).toEqual([
      'Crypto exchange — futures | cryptoPerp | USD',
      'Broker — stocks | stock | USD',
    ])
  })

  it('numbers the accounts in order and gives each a color', () => {
    const accounts = accountsFromAnswers(answers({ markets: ['cryptoPerp', 'stock'], venues: ['okx'] }), names)
    expect(accounts.map((account) => account.sortOrder)).toEqual([0, 1])
    expect(new Set(accounts.map((account) => account.colorHex)).size).toBe(2)
    expect(new Set(accounts.map((account) => account.id)).size).toBe(2)
  })

  it('creates nothing without markets', () => {
    expect(summary({ venues: ['binance'] })).toEqual([])
  })
})

describe('canFinish', () => {
  it('needs a goal, at least one market and a trading frequency', () => {
    expect(canFinish(answers({ goal: 'consistency', markets: ['stock'], tradesPerWeek: '6-20' }))).toBe(true)
    expect(canFinish(answers({ goal: 'consistency', tradesPerWeek: '6-20' }))).toBe(false)
    expect(canFinish(answers({ markets: ['stock'], tradesPerWeek: '1-5' }))).toBe(false)
  })
})
