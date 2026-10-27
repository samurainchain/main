import {
  newId,
  SYSTEM_MISTAKES,
  TAG_COLORS,
  type Account,
  type JournalData,
  type MistakeTag,
  type SetupTag,
  type Trade,
} from '../models'
import { emptyJournal, type JournalBackend } from './backend'

export type StoreStatus = 'loading' | 'ready' | 'error'

export interface JournalSnapshot extends JournalData {
  status: StoreStatus
}

const SYSTEM_MISTAKE_COLORS: Record<(typeof SYSTEM_MISTAKES)[number], string> = {
  fomo: '#FF5C6C',
  revengeTrading: '#FF5C6C',
  highLeverage: '#FF5C6C',
  heldPastStop: '#FFB547',
  noStop: '#FFB547',
  overtrading: '#7C6CFF',
  earlyExit: '#7C6CFF',
  offPlan: '#7C6CFF',
}

/**
 * The journal held in memory, written through to a backend. Every change produces a new
 * snapshot object, so React can subscribe with `useSyncExternalStore`.
 */
export class JournalStore {
  private snapshot: JournalSnapshot = { ...emptyJournal(), status: 'loading' }
  private readonly listeners = new Set<() => void>()

  constructor(private readonly backend: JournalBackend) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): JournalSnapshot => this.snapshot

  async load(): Promise<void> {
    try {
      const data = await this.backend.load()
      const missing = missingSystemMistakes(data.mistakes)
      if (missing.length > 0) {
        await this.backend.put('mistakes', missing)
        data.mistakes = [...data.mistakes, ...missing]
      }
      this.set({ ...sorted(data), status: 'ready' })
    } catch (error) {
      console.error('Could not load the journal', error)
      this.set({ ...this.snapshot, status: 'error' })
    }
  }

  // Accounts

  async saveAccount(account: Account): Promise<void> {
    this.set(withRecord(this.snapshot, 'accounts', account))
    await this.backend.put('accounts', [account])
  }

  /** Deletes the account together with all of its trades. */
  async deleteAccount(id: string): Promise<void> {
    const tradeIds = this.snapshot.trades.filter((trade) => trade.accountId === id).map((trade) => trade.id)
    this.set({
      ...this.snapshot,
      accounts: this.snapshot.accounts.filter((account) => account.id !== id),
      trades: this.snapshot.trades.filter((trade) => trade.accountId !== id),
    })
    await this.backend.delete('trades', tradeIds)
    await this.backend.delete('accounts', [id])
  }

  /** Stores the given order of account ids as their sort order. */
  async reorderAccounts(ids: string[]): Promise<void> {
    const order = new Map(ids.map((id, index) => [id, index]))
    const accounts = this.snapshot.accounts.map((account) => ({ ...account, sortOrder: order.get(account.id) ?? account.sortOrder }))
    this.set(sorted({ ...this.snapshot, accounts }))
    await this.backend.put('accounts', accounts)
  }

  // Trades

  async saveTrade(trade: Trade): Promise<void> {
    const saved = { ...trade, updatedAt: new Date().toISOString() }
    this.set(withRecord(this.snapshot, 'trades', saved))
    await this.backend.put('trades', [saved])
  }

  async deleteTrade(id: string): Promise<void> {
    this.set({ ...this.snapshot, trades: this.snapshot.trades.filter((trade) => trade.id !== id) })
    await this.backend.delete('trades', [id])
  }

  /** Copies a trade with new timestamps and returns the copy. */
  async duplicateTrade(id: string): Promise<Trade | undefined> {
    const original = this.snapshot.trades.find((trade) => trade.id === id)
    if (!original) return undefined
    const now = new Date().toISOString()
    const copy: Trade = { ...original, id: newId(), source: 'manual', createdAt: now, updatedAt: now }
    await this.saveTrade(copy)
    return copy
  }

  // Tags

  async addMistake(name: string): Promise<MistakeTag> {
    const tag: MistakeTag = {
      id: newId(),
      name: name.trim(),
      colorHex: TAG_COLORS[this.snapshot.mistakes.length % TAG_COLORS.length]!,
      isSystem: false,
      sortOrder: this.snapshot.mistakes.length,
      isArchived: false,
    }
    this.set(withRecord(this.snapshot, 'mistakes', tag))
    await this.backend.put('mistakes', [tag])
    return tag
  }

  async addSetup(name: string): Promise<SetupTag> {
    const tag: SetupTag = {
      id: newId(),
      name: name.trim(),
      colorHex: TAG_COLORS[this.snapshot.setups.length % TAG_COLORS.length]!,
      sortOrder: this.snapshot.setups.length,
      isArchived: false,
    }
    this.set(withRecord(this.snapshot, 'setups', tag))
    await this.backend.put('setups', [tag])
    return tag
  }

  // Whole journal

  exportData(): JournalData {
    const { accounts, trades, mistakes, setups } = this.snapshot
    return { accounts, trades, mistakes, setups }
  }

  async importData(data: JournalData): Promise<void> {
    const complete = { ...data, mistakes: [...data.mistakes, ...missingSystemMistakes(data.mistakes)] }
    await this.backend.replaceAll(complete)
    this.set({ ...sorted(complete), status: 'ready' })
  }

  /** Erases everything and re-seeds the system mistake tags. */
  async deleteAll(): Promise<void> {
    await this.importData(emptyJournal())
  }

  private set(snapshot: JournalSnapshot): void {
    this.snapshot = snapshot
    for (const listener of this.listeners) listener()
  }
}

function missingSystemMistakes(existing: MistakeTag[]): MistakeTag[] {
  const keys = new Set(existing.map((tag) => tag.systemKey))
  return SYSTEM_MISTAKES.flatMap((key, index) =>
    keys.has(key)
      ? []
      : [{ id: newId(), name: '', colorHex: SYSTEM_MISTAKE_COLORS[key], isSystem: true, systemKey: key, sortOrder: index, isArchived: false }],
  )
}

function withRecord<C extends 'accounts' | 'trades' | 'mistakes' | 'setups'>(
  snapshot: JournalSnapshot,
  collection: C,
  record: JournalData[C][number],
): JournalSnapshot {
  const list = snapshot[collection] as { id: string }[]
  const exists = list.some((item) => item.id === record.id)
  const next = exists ? list.map((item) => (item.id === record.id ? record : item)) : [...list, record]
  return sorted({ ...snapshot, [collection]: next })
}

function sorted<T extends JournalData>(data: T): T {
  return {
    ...data,
    accounts: [...data.accounts].sort((a, b) => a.sortOrder - b.sortOrder),
    mistakes: [...data.mistakes].sort((a, b) => a.sortOrder - b.sortOrder),
    setups: [...data.setups].sort((a, b) => a.sortOrder - b.sortOrder),
  }
}
