import { describe, expect, it } from 'vitest'
import type { JournalData } from '../../core/models'
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
      note: '',
      source: 'manual',
      createdAt: '2026-10-27T11:00:00.000Z',
      updatedAt: '2026-10-27T11:00:00.000Z',
    },
  ],
  mistakes: [],
  setups: [],
}

describe('backup', () => {
  it('round-trips the journal without losing decimal precision', () => {
    expect(parseBackup(serializeBackup(data))).toEqual(data)
  })

  it('rejects files that are not Mirror backups', () => {
    expect(() => parseBackup('{"hello":1}')).toThrow()
    expect(() => parseBackup('not json')).toThrow()
    const future = JSON.parse(serializeBackup(data))
    future.version = 99
    expect(() => parseBackup(JSON.stringify(future))).toThrow()
  })

  it('rejects trades that point at a missing account', () => {
    const broken = JSON.parse(serializeBackup(data))
    broken.data.accounts = []
    expect(() => parseBackup(JSON.stringify(broken))).toThrow()
  })
})
