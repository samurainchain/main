import 'fake-indexeddb/auto'
import { openDB } from 'idb'
import { describe, expect, it } from 'vitest'
import { newId, SYSTEM_MISTAKES, type Account, type Trade } from '../models'
import { IndexedDbBackend } from './indexedDbBackend'
import { JournalStore } from './journalStore'

function account(overrides: Partial<Account> = {}): Account {
  return {
    id: newId(),
    name: 'Binance futures',
    assetClass: 'cryptoPerp',
    venue: 'Binance',
    currency: 'USDT',
    colorHex: '#7C6CFF',
    sortOrder: 0,
    isArchived: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

function trade(accountId: string): Trade {
  const now = new Date().toISOString()
  return {
    id: newId(),
    accountId,
    symbol: 'BTCUSDT',
    side: 'long',
    market: 'cryptoPerp',
    entryPrice: '60000',
    exitPrice: '61000',
    quantity: '0.1',
    contractMultiplier: '1',
    fees: '0',
    openedAt: now,
    closedAt: now,
    mistakeIds: [],
    setupIds: [],
    brokenRuleIds: [],
    note: '',
    source: 'manual',
    createdAt: now,
    updatedAt: now,
  }
}

async function openStore(dbName: string): Promise<JournalStore> {
  const store = new JournalStore(new IndexedDbBackend(dbName))
  await store.load()
  return store
}

describe('JournalStore', () => {
  it('keeps data after the page reloads', async () => {
    const db = newId()
    const first = await openStore(db)
    const acc = account()
    await first.saveAccount(acc)
    await first.saveTrade(trade(acc.id))
    await first.addSetup('Breakout')

    const reopened = await openStore(db)
    const data = reopened.getSnapshot()
    expect(data.status).toBe('ready')
    expect(data.accounts).toHaveLength(1)
    expect(data.trades).toHaveLength(1)
    expect(data.trades[0]?.symbol).toBe('BTCUSDT')
    expect(data.setups.map((tag) => tag.name)).toEqual(['Breakout'])
  })

  it('seeds the system mistakes exactly once', async () => {
    const db = newId()
    await openStore(db)
    const reopened = await openStore(db)
    const keys = reopened.getSnapshot().mistakes.map((tag) => tag.systemKey)
    expect(keys).toEqual([...SYSTEM_MISTAKES])
  })

  it('deletes an account together with its trades only', async () => {
    const store = await openStore(newId())
    const kept = account({ name: 'Stocks', assetClass: 'stock', sortOrder: 1 })
    const removed = account()
    await store.saveAccount(kept)
    await store.saveAccount(removed)
    await store.saveTrade(trade(kept.id))
    await store.saveTrade(trade(removed.id))

    await store.deleteAccount(removed.id)

    const data = store.getSnapshot()
    expect(data.accounts.map((a) => a.id)).toEqual([kept.id])
    expect(data.trades.map((t) => t.accountId)).toEqual([kept.id])
  })

  it('updates an edited trade in place and duplicates with a new id', async () => {
    const store = await openStore(newId())
    const acc = account()
    await store.saveAccount(acc)
    const original = trade(acc.id)
    await store.saveTrade(original)
    await store.saveTrade({ ...original, exitPrice: '62000' })

    const copy = await store.duplicateTrade(original.id)

    const trades = store.getSnapshot().trades
    expect(trades).toHaveLength(2)
    expect(trades.find((t) => t.id === original.id)?.exitPrice).toBe('62000')
    expect(copy?.id).not.toBe(original.id)
    expect(copy?.exitPrice).toBe('62000')
  })

  it('erases everything but restores the system mistakes', async () => {
    const store = await openStore(newId())
    const acc = account()
    await store.saveAccount(acc)
    await store.saveTrade(trade(acc.id))

    await store.deleteAll()

    const data = store.getSnapshot()
    expect(data.accounts).toEqual([])
    expect(data.trades).toEqual([])
    expect(data.mistakes).toHaveLength(SYSTEM_MISTAKES.length)
  })

  it('upgrades a version 1 database without losing trades', async () => {
    const db = newId()
    const acc = account()
    const { brokenRuleIds: _omitted, ...oldTrade } = trade(acc.id)
    const v1 = await openDB(db, 1, {
      upgrade(database) {
        for (const store of ['accounts', 'trades', 'mistakes', 'setups']) database.createObjectStore(store, { keyPath: 'id' })
      },
    })
    await v1.put('accounts', acc)
    await v1.put('trades', oldTrade)
    v1.close()

    const store = await openStore(db)
    const data = store.getSnapshot()
    expect(data.trades).toHaveLength(1)
    expect(data.trades[0]?.brokenRuleIds).toEqual([])
    expect(data.rules).toEqual([])
    expect(data.profile.limitAlerts).toBe(true)
  })

  it('keeps rules, limits and reviews after a reload', async () => {
    const db = newId()
    const store = await openStore(db)
    const first = await store.addRule('No trades in the first 30 minutes after news')
    await store.addRule('Max 3 trades before lunch')
    await store.reorderRules([store.getSnapshot().rules[1]!.id, first.id])
    await store.updateProfile({ dailyLossLimit: '300', dailyTradeLimit: 6 })
    await store.saveReview({
      id: newId(),
      weekStart: '2026-10-26',
      whatWorked: 'Waiting for the retest',
      whatRepeated: 'FOMO entries',
      nextRule: 'No entries without a stop',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    const reopened = (await openStore(db)).getSnapshot()
    expect(reopened.rules.map((rule) => rule.text)).toEqual(['Max 3 trades before lunch', 'No trades in the first 30 minutes after news'])
    expect(reopened.profile).toMatchObject({ dailyLossLimit: '300', dailyTradeLimit: 6 })
    expect(reopened.reviews[0]?.nextRule).toBe('No entries without a stop')
  })
})
