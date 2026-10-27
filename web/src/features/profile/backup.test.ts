import { describe, expect, it } from 'vitest'
import { defaultProfile, type JournalData } from '../../core/models'
import { parseBackup, serializeBackup } from './backup'

const data: JournalData = {
  accounts: [
    { id: 'a1', name: 'Binance', assetClass: 'cryptoPerp', venue: 'Binance', currency: 'USDT', colorHex: '#7C6CFF', sortOrder: 0, isArchived: false, createdAt: '2026-10-27T10:00:00.000Z' },
  ],
  trades: [
    {
      id: 't1',
      accountId: 'a1',
      symbol: 'BTCUSDT',
      side: 'long',
      market: 'cryptoPerp',
      entryPrice: '60000.5',
      exitPrice: '61000',
      quantity: '0.1',
      contractMultiplier: '1',
      fees: '0',
      openedAt: '2026-10-27T10:00:00.000Z',
      closedAt: '2026-10-27T11:00:00.000Z',
      mistakeIds: [],
      setupIds: [],
      brokenRuleIds: [],
      note: '',
      source: 'manual',
      createdAt: '2026-10-27T11:00:00.000Z',
      updatedAt: '2026-10-27T11:00:00.000Z',
    },
  ],
  mistakes: [],
  setups: [],
  rules: [{ id: 'r1', text: 'No trades in the first 30 minutes after news', isActive: true, sortOrder: 0 }],
  reviews: [],
  images: [],
  profile: { ...defaultProfile(), dailyLossLimit: '300', dailyTradeLimit: 6 },
}

describe('backup', () => {
  it('round-trips the journal without losing decimal precision', () => {
    expect(parseBackup(serializeBackup(data))).toEqual(data)
  })

  it('leaves screenshots out of the file', () => {
    const withImages = { ...data, images: [{ id: 'i1', tradeId: 't1', width: 10, height: 10, createdAt: '2026-10-27T11:00:00.000Z' }] }
    expect(parseBackup(serializeBackup(withImages)).images).toEqual([])
  })

  it('rejects files that are not Tiltless backups', () => {
    expect(() => parseBackup('{"hello":1}')).toThrow()
    expect(() => parseBackup('not json')).toThrow()
    const future = JSON.parse(serializeBackup(data))
    future.version = 99
    expect(() => parseBackup(JSON.stringify(future))).toThrow()
  })

  it('opens version 1 backups, filling the fields added since', () => {
    const v1 = JSON.parse(serializeBackup(data))
    v1.version = 1
    delete v1.data.rules
    delete v1.data.reviews
    delete v1.data.profile
    delete v1.data.trades[0].brokenRuleIds
    const parsed = parseBackup(JSON.stringify(v1))
    expect(parsed.rules).toEqual([])
    expect(parsed.profile).toEqual(defaultProfile())
    expect(parsed.trades[0]?.brokenRuleIds).toEqual([])
  })

  it('rejects trades that point at a missing account', () => {
    const broken = JSON.parse(serializeBackup(data))
    broken.data.accounts = []
    expect(() => parseBackup(JSON.stringify(broken))).toThrow()
  })
})
