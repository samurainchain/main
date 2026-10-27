import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { newId, SYSTEM_MISTAKES, type Account, type Trade } from '../models'
import { IndexedDbBackend } from '../storage/indexedDbBackend'
import { JournalStore } from '../storage/journalStore'
import { CloudSync, SyncingBackend } from './cloudSync'
import { changeKey, type Change, type RemoteJournal, type RemoteRecord } from './types'

/** An in-memory server with the same last-write-wins rule as the real one. */
class MemoryRemote implements RemoteJournal {
  rows = new Map<string, RemoteRecord>()
  offline = false
  private tick = 0

  async push(changes: Change[]): Promise<void> {
    if (this.offline) throw new Error('offline')
    for (const change of changes) {
      const key = changeKey(change.collection, change.id)
      const existing = this.rows.get(key)
      if (existing && existing.updatedAt >= change.updatedAt) continue
      this.tick += 1
      this.rows.set(key, { ...structuredClone(change), serverUpdatedAt: new Date(Date.UTC(2026, 0, 1) + this.tick * 60_000).toISOString() })
    }
  }

  async pull(since: string | undefined): Promise<RemoteRecord[]> {
    if (this.offline) throw new Error('offline')
    return [...this.rows.values()].filter((row) => !since || row.serverUpdatedAt > since).map((row) => structuredClone(row))
  }
}

/** A device: its own browser database, journal and sync engine, with a controllable clock. */
async function device(remote: RemoteJournal, clock: { now: number }) {
  const local = new IndexedDbBackend(newId())
  const backend = new SyncingBackend(local, local.syncState(), () => new Date(clock.now++).toISOString())
  const store = new JournalStore(backend)
  const sync = new CloudSync(backend, remote, () => store.load())
  await store.load()
  return { store, sync, backend }
}

function account(name: string): Account {
  return { id: newId(), name, assetClass: 'cryptoPerp', venue: '', currency: 'USDT', colorHex: '#7C6CFF', sortOrder: 0, isArchived: false, createdAt: new Date().toISOString() }
}

function trade(accountId: string, exitPrice = '61000'): Trade {
  const now = new Date().toISOString()
  return {
    id: newId(), accountId, symbol: 'BTCUSDT', side: 'long', market: 'cryptoPerp', entryPrice: '60000', exitPrice, quantity: '0.1',
    contractMultiplier: '1', fees: '0', openedAt: now, closedAt: now, mistakeIds: [], setupIds: [], brokenRuleIds: [], note: '',
    source: 'manual', createdAt: now, updatedAt: now,
  }
}

describe('cloud sync', () => {
  it('brings a journal kept offline into the account and onto a second device', async () => {
    const remote = new MemoryRemote()
    const clock = { now: Date.UTC(2026, 9, 27) }
    const phone = await device(remote, clock)
    const acc = account('Binance')
    await phone.store.saveAccount(acc)
    await phone.store.saveTrade(trade(acc.id))
    await phone.store.addRule('Never move the stop')

    await phone.sync.connect('user-1')
    await phone.sync.sync()

    const laptop = await device(remote, clock)
    await laptop.sync.connect('user-1')
    await laptop.sync.sync()
    const data = laptop.store.getSnapshot()
    expect(data.accounts.map((a) => a.name)).toEqual(['Binance'])
    expect(data.trades).toHaveLength(1)
    expect(data.rules.map((rule) => rule.text)).toEqual(['Never move the stop'])
    // Both devices seeded system mistakes; fixed ids keep exactly one of each.
    expect(data.mistakes.filter((tag) => tag.isSystem)).toHaveLength(SYSTEM_MISTAKES.length)
  })

  it('keeps a renamed system mistake when a fresh device joins', async () => {
    const remote = new MemoryRemote()
    const clock = { now: Date.UTC(2026, 9, 27) }
    const phone = await device(remote, clock)
    const fomo = phone.store.getSnapshot().mistakes.find((tag) => tag.systemKey === 'fomo')!
    await phone.store.saveMistake({ ...fomo, name: 'Chasing' })
    await phone.sync.connect('u')
    await phone.sync.sync()

    const laptop = await device(remote, clock)
    await laptop.sync.connect('u')
    await laptop.sync.sync()
    await phone.sync.sync()

    const name = (store: JournalStore) => store.getSnapshot().mistakes.find((tag) => tag.systemKey === 'fomo')?.name
    expect(name(laptop.store)).toBe('Chasing')
    expect(name(phone.store)).toBe('Chasing')
  })

  it('sends edits and deletions both ways', async () => {
    const remote = new MemoryRemote()
    const clock = { now: Date.UTC(2026, 9, 27) }
    const phone = await device(remote, clock)
    const laptop = await device(remote, clock)
    await phone.sync.connect('u')
    await laptop.sync.connect('u')
    const acc = account('Bybit')
    const original = trade(acc.id)
    await phone.store.saveAccount(acc)
    await phone.store.saveTrade(original)
    await phone.sync.sync()
    await laptop.sync.sync()

    await laptop.store.saveTrade({ ...original, exitPrice: '62000' })
    await laptop.sync.sync()
    await phone.sync.sync()
    expect(phone.store.getSnapshot().trades[0]?.exitPrice).toBe('62000')

    await phone.store.deleteTrade(original.id)
    await phone.sync.sync()
    await laptop.sync.sync()
    expect(laptop.store.getSnapshot().trades).toEqual([])
  })

  it('keeps the later edit when two devices change the same record', async () => {
    const remote = new MemoryRemote()
    const clock = { now: Date.UTC(2026, 9, 27) }
    const phone = await device(remote, clock)
    const laptop = await device(remote, clock)
    await phone.sync.connect('u')
    await laptop.sync.connect('u')
    const acc = account('OKX')
    await phone.store.saveAccount(acc)
    await phone.sync.sync()
    await laptop.sync.sync()

    await phone.store.saveAccount({ ...acc, name: 'OKX old' })
    await laptop.store.saveAccount({ ...acc, name: 'OKX new' }) // later on the shared clock
    await laptop.sync.sync()
    await phone.sync.sync()
    await laptop.sync.sync()

    expect(phone.store.getSnapshot().accounts[0]?.name).toBe('OKX new')
    expect(laptop.store.getSnapshot().accounts[0]?.name).toBe('OKX new')
  })

  it('keeps changes made offline and sends them when back online', async () => {
    const remote = new MemoryRemote()
    const clock = { now: Date.UTC(2026, 9, 27) }
    const phone = await device(remote, clock)
    await phone.sync.connect('u')
    remote.offline = true
    await phone.store.saveAccount(account('Offline'))
    await expect(phone.sync.sync()).rejects.toThrow('offline')
    remote.offline = false

    const result = await phone.sync.sync()
    expect(result.pushed).toBeGreaterThan(0)
    expect([...remote.rows.values()].some((row) => (row.data as Account | null)?.name === 'Offline')).toBe(true)
  })

  it('does not queue anything while signed out', async () => {
    const remote = new MemoryRemote()
    const phone = await device(remote, { now: Date.UTC(2026, 9, 27) })
    await phone.store.saveAccount(account('Local only'))
    expect(await phone.backend.state.outbox()).toEqual([])
  })

  it('syncs the profile: limits and onboarding answers', async () => {
    const remote = new MemoryRemote()
    const clock = { now: Date.UTC(2026, 9, 27) }
    const phone = await device(remote, clock)
    await phone.sync.connect('u')
    await phone.store.updateProfile({ dailyLossLimit: '300' })
    await phone.sync.sync()

    const laptop = await device(remote, clock)
    await laptop.sync.connect('u')
    await laptop.sync.sync()
    expect(laptop.store.getSnapshot().profile.dailyLossLimit).toBe('300')
  })
})
