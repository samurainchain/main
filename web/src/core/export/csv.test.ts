import { describe, expect, it } from 'vitest'
import type { Account, Trade } from '../models'
import { tradesToCsv } from './csv'

const account: Account = { id: 'a', name: 'Binance, futures', assetClass: 'cryptoPerp', venue: 'Binance', currency: 'USDT', colorHex: '#000', sortOrder: 0, isArchived: false, createdAt: '2026-10-01T00:00:00.000Z' }
const base: Trade = {
  id: 't1', accountId: 'a', symbol: 'BTCUSDT', side: 'long', market: 'cryptoPerp', leverage: '20', entryPrice: '60000.5', exitPrice: '61000',
  quantity: '0.1', contractMultiplier: '1', initialStopLoss: '59500.5', stopLoss: '59500.5', fees: '1.2', openedAt: '2026-10-27T10:00:00.000Z',
  closedAt: '2026-10-27T11:00:00.000Z', emotion: 'fomo', mistakeIds: ['system-fomo', 'gone'], setupIds: ['s1'], brokenRuleIds: ['r1'],
  note: 'Entered "late", then\nheld', source: 'ocr', createdAt: '2026-10-27T11:00:00.000Z', updatedAt: '2026-10-27T11:00:00.000Z',
}

const csv = tradesToCsv(
  {
    trades: [{ ...base, id: 't2', openedAt: '2026-10-28T09:00:00.000Z', closedAt: undefined, exitPrice: undefined, note: '', mistakeIds: [], setupIds: [], brokenRuleIds: [], emotion: undefined }, base],
    accounts: [account],
    mistakes: [],
    setups: [{ id: 's1', name: 'Breakout', colorHex: '#000', sortOrder: 0, isArchived: false }],
    rules: [{ id: 'r1', text: 'Never move the stop', isActive: true, sortOrder: 0 }],
  },
  (id) => (id === 'system-fomo' ? 'FOMO' : undefined),
)
const lines = csv.split('\r\n')

describe('tradesToCsv', () => {
  it('starts with the header and lists trades oldest first', () => {
    expect(lines[0]).toBe(
      'opened_at,closed_at,account,market,symbol,side,entry_price,exit_price,quantity,contract_multiplier,leverage,initial_stop_loss,stop_loss,fees,pnl,r_multiple,emotion,mistakes,setups,broken_rules,note,source',
    )
    expect(lines[1]!.startsWith('2026-10-27T10:00:00.000Z,')).toBe(true)
    expect(lines[2]!.startsWith('2026-10-28T09:00:00.000Z,,')).toBe(true)
  })

  it('writes exact amounts, PnL and R', () => {
    // (61000 − 60000.5) × 0.1 − 1.2 = 98.75; risk 500 × 0.1 = 50 → R 1.975
    expect(lines[1]).toContain(',60000.5,61000,0.1,1,20,59500.5,59500.5,1.2,98.75,1.9750,fomo,')
  })

  it('names tags and rules, skipping deleted ones, and quotes text that needs it', () => {
    expect(lines[1]).toContain('"Binance, futures"')
    expect(lines[1]).toContain(',FOMO,Breakout,Never move the stop,')
    expect(csv).toContain('"Entered ""late"", then\nheld",ocr')
  })

  it('leaves the values of an open trade empty', () => {
    expect(lines[2]).toContain(',BTCUSDT,long,60000.5,,0.1,')
    expect(lines[2]!.endsWith(',,,,,ocr')).toBe(true)
  })
})
