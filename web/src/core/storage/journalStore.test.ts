import 'fake-indexeddb/auto'
import { openDB } from 'idb'
import { describe, expect, it } from 'vitest'
import { importCsv } from '../import/importTrades'
import { newId, SYSTEM_MISTAKES, type Account, type Trade } from '../models'
import { IndexedDbBackend } from './indexedDbBackend'
import { canonicalSystemMistakes, JournalStore, systemMistakeId } from './journalStore'
import { emptyJournal } from './backend'

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
  const local = new IndexedDbBackend(dbName)
  const store = new JournalStore(local, local.imageBlobs())
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

  it('imports exchange trades once, keeping them after a reload', async () => {
    const db = newId()
    const store = await openStore(db)
    const acc = account()
    await store.saveAccount(acc)
    const { trades } = importCsv(`Contracts,Closing Direction,Qty,Entry Price,Exit Price,Closed P&L,Trade Time(UTC+0)
BTCUSDT,Sell,0.010,60000.0,61234.0,12.27,2026-10-27 12:40:11
ETHUSDT,Buy,1.5,3100.25,3130.33,-45.38,2026-10-27 13:02:45`)

    expect(await store.importTrades(acc, trades)).toBe(2)
    // The same file again adds nothing.
    expect(await store.importTrades(acc, trades)).toBe(0)

    const saved = (await openStore(db)).getSnapshot().trades
    expect(saved).toHaveLength(2)
    // Records come back in id order, which is random: find the trade by symbol.
    const btc = saved.find((trade) => trade.symbol === 'BTCUSDT')
    expect(btc).toMatchObject({ accountId: acc.id, market: 'cryptoPerp', source: 'csvImport', side: 'long', fees: '0.07' })
    expect(btc!.importKey).toBe(trades.find((trade) => trade.symbol === 'BTCUSDT')!.key)
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

  it('finishes onboarding: accounts, answers and the picked weaknesses first', async () => {
    const db = newId()
    const store = await openStore(db)
    const acc = account({ name: 'Binance — futures' })
    await store.completeOnboarding(
      { goal: 'consistency', markets: ['cryptoPerp'], venues: ['binance'], weaknesses: ['overtrading', 'earlyExit'], tradesPerWeek: '6-20', currency: 'USDT' },
      [acc],
    )

    const reopened = (await openStore(db)).getSnapshot()
    expect(reopened.accounts.map((a) => a.name)).toEqual(['Binance — futures'])
    expect(reopened.profile.onboarding).toMatchObject({ goal: 'consistency', tradesPerWeek: '6-20' })
    expect(reopened.mistakes.slice(0, 3).map((tag) => tag.systemKey)).toEqual(['overtrading', 'earlyExit', 'fomo'])
  })

  it('moves system mistakes to fixed ids and merges copies from two devices', () => {
    const tag = (id: string, name = '') => ({ id, name, colorHex: '#000000', isSystem: true, systemKey: 'fomo' as const, sortOrder: 0, isArchived: false })
    const acc = account()
    const data = {
      ...emptyJournal(),
      accounts: [acc],
      mistakes: [tag('random-a'), tag('random-b', 'Chasing')],
      trades: [{ ...trade(acc.id), mistakeIds: ['random-a', 'random-b'] }, trade(acc.id)],
    }

    const { data: result, writes } = canonicalSystemMistakes(data)

    const fomo = result.mistakes.filter((item) => item.systemKey === 'fomo')
    expect(fomo).toEqual([expect.objectContaining({ id: systemMistakeId('fomo'), name: 'Chasing' })])
    expect(result.mistakes.filter((item) => item.isSystem)).toHaveLength(SYSTEM_MISTAKES.length)
    expect(result.trades[0]?.mistakeIds).toEqual([systemMistakeId('fomo')])
    expect(writes.trades).toHaveLength(1)
    expect(writes.removedMistakeIds.sort()).toEqual(['random-a', 'random-b'])
  })

  it('leaves canonical data untouched', () => {
    const once = canonicalSystemMistakes(emptyJournal()).data
    const { writes } = canonicalSystemMistakes(once)
    expect(writes).toEqual({ seeded: [], mistakes: [], trades: [], removedMistakeIds: [] })
  })

  it('edits, reorders and deletes tags; system mistakes are only hidden', async () => {
    const db = newId()
    const store = await openStore(db)
    const setup = await store.addSetup('Breakout')
    const retest = await store.addSetup('Retest')
    await store.saveSetup({ ...setup, name: 'Range breakout', colorHex: '#3DDC97' })
    await store.reorderTags('setups', [retest.id, setup.id])
    const custom = await store.addMistake('Chased the news')
    await store.deleteTag('mistakes', custom.id)
    const fomo = store.getSnapshot().mistakes.find((tag) => tag.systemKey === 'fomo')!
    await store.deleteTag('mistakes', fomo.id)
    await store.saveMistake({ ...fomo, isArchived: true })

    const reopened = (await openStore(db)).getSnapshot()
    expect(reopened.setups.map((tag) => tag.name)).toEqual(['Retest', 'Range breakout'])
    expect(reopened.setups[1]?.colorHex).toBe('#3DDC97')
    expect(reopened.mistakes.some((tag) => tag.id === custom.id)).toBe(false)
    expect(reopened.mistakes.find((tag) => tag.systemKey === 'fomo')?.isArchived).toBe(true)
  })

  it('attaches up to three screenshots and removes them with the trade', async () => {
    const db = newId()
    const store = await openStore(db)
    const acc = account()
    await store.saveAccount(acc)
    const kept = trade(acc.id)
    const removed = trade(acc.id)
    await store.saveTrade(kept)
    await store.saveTrade(removed)
    const file = () => ({ blob: new Blob(['jpeg'], { type: 'image/jpeg' }), width: 1600, height: 900 })
    const added = await store.addImages(kept.id, [file(), file(), file(), file()])
    await store.addImages(removed.id, [file()])
    expect(added).toHaveLength(3)
    expect(await store.addImages(kept.id, [file()])).toEqual([])

    await store.deleteTrade(removed.id)
    await store.removeImages([added[0]!.id])

    const reopened = await openStore(db)
    expect(reopened.imagesOf(kept.id).map((image) => image.id)).toEqual([added[1]!.id, added[2]!.id])
    expect(reopened.getSnapshot().images).toHaveLength(2)
    expect((await reopened.blobs!.ids()).sort()).toEqual([added[1]!.id, added[2]!.id].sort())
    expect(await reopened.blobs!.getBlob(added[1]!.id)).toBeDefined()
  })
})
