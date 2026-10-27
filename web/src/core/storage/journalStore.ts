import {
  newId,
  SYSTEM_MISTAKES,
  TAG_COLORS,
  type Account,
  type JournalData,
  type JournalProfile,
  type MistakeTag,
  type Rule,
  type SetupTag,
  type SystemMistakeKey,
  type Trade,
  type TradeImage,
  type WeeklyReview,
  MAX_IMAGES_PER_TRADE,
} from '../models'
import type { OnboardingAnswers } from '../onboarding'
import { emptyJournal, normalizeJournal, type Collection, type ImageBlobStore, type JournalBackend } from './backend'

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
  badHour: '#7C6CFF',
}

/**
 * The journal held in memory, written through to a backend. Every change produces a new
 * snapshot object, so React can subscribe with `useSyncExternalStore`.
 */
export class JournalStore {
  private snapshot: JournalSnapshot = { ...emptyJournal(), status: 'loading' }
  private readonly listeners = new Set<() => void>()

  /** Called with the ids of screenshots removed here, so the cloud copies can go too. */
  onImagesRemoved?: (ids: string[]) => void

  constructor(
    private readonly backend: JournalBackend,
    /** Screenshot files; without it, trades can't hold screenshots (tests, old callers). */
    readonly blobs?: ImageBlobStore,
  ) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): JournalSnapshot => this.snapshot

  async load(): Promise<void> {
    try {
      const loaded = await this.backend.load()
      const { data, writes } = canonicalSystemMistakes(loaded)
      if (writes.seeded.length > 0) await this.backend.put('mistakes', writes.seeded, { asDefault: true })
      if (writes.mistakes.length > 0) await this.backend.put('mistakes', writes.mistakes)
      if (writes.trades.length > 0) await this.backend.put('trades', writes.trades)
      if (writes.removedMistakeIds.length > 0) await this.backend.delete('mistakes', writes.removedMistakeIds)
      this.set({ ...sorted(data), status: 'ready' })
      await this.dropOrphanBlobs(data.images)
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

  /** Deletes the account together with all of its trades and their screenshots. */
  async deleteAccount(id: string): Promise<void> {
    const tradeIds = this.snapshot.trades.filter((trade) => trade.accountId === id).map((trade) => trade.id)
    await this.removeImages(this.snapshot.images.filter((image) => tradeIds.includes(image.tradeId)).map((image) => image.id))
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

  /** Removes an automatic mistake flag from a trade for good: the trader said it was wrong. */
  async dismissFlag(tradeId: string, key: SystemMistakeKey): Promise<void> {
    const trade = this.snapshot.trades.find((item) => item.id === tradeId)
    if (!trade || trade.dismissedFlags?.includes(key)) return
    await this.saveTrade({ ...trade, dismissedFlags: [...(trade.dismissedFlags ?? []), key], updatedAt: new Date().toISOString() })
  }

  async deleteTrade(id: string): Promise<void> {
    await this.removeImages(this.imagesOf(id).map((image) => image.id))
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

  // Screenshots

  imagesOf(tradeId: string): TradeImage[] {
    return this.snapshot.images.filter((image) => image.tradeId === tradeId).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  /** Attaches compressed screenshots to a trade, up to the limit; extra ones are ignored. */
  async addImages(tradeId: string, files: { blob: Blob; width: number; height: number }[]): Promise<TradeImage[]> {
    if (!this.blobs) return []
    const room = MAX_IMAGES_PER_TRADE - this.imagesOf(tradeId).length
    const images = files.slice(0, Math.max(0, room)).map((file, index) => ({
      record: { id: newId(), tradeId, width: file.width, height: file.height, createdAt: new Date(Date.now() + index).toISOString() } satisfies TradeImage,
      blob: file.blob,
    }))
    for (const { record, blob } of images) await this.blobs.putBlob(record.id, blob)
    await this.blobs.markForUpload(images.map(({ record }) => record.id))
    const records = images.map(({ record }) => record)
    this.set({ ...this.snapshot, images: [...this.snapshot.images, ...records] })
    await this.backend.put('images', records)
    return records
  }

  async removeImages(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    this.set({ ...this.snapshot, images: this.snapshot.images.filter((image) => !ids.includes(image.id)) })
    await this.backend.delete('images', ids)
    await this.blobs?.deleteBlobs(ids)
    this.onImagesRemoved?.(ids)
  }

  /** Removes files whose screenshot record is gone, e.g. deleted on another device. */
  private async dropOrphanBlobs(images: readonly TradeImage[]): Promise<void> {
    if (!this.blobs) return
    const known = new Set(images.map((image) => image.id))
    const orphans = (await this.blobs.ids()).filter((id) => !known.has(id))
    if (orphans.length > 0) await this.blobs.deleteBlobs(orphans)
  }

  // Tags

  /** Saves an edited mistake tag: a rename, color or archiving. */
  async saveMistake(tag: MistakeTag): Promise<void> {
    this.set(withRecord(this.snapshot, 'mistakes', tag))
    await this.backend.put('mistakes', [tag])
  }

  async saveSetup(tag: SetupTag): Promise<void> {
    this.set(withRecord(this.snapshot, 'setups', tag))
    await this.backend.put('setups', [tag])
  }

  /**
   * Deletes a tag the user created. Trades keep the id, and screens skip tags that no longer
   * exist, so past trades are unaffected apart from the missing chip. System mistakes are only
   * hidden, never deleted.
   */
  async deleteTag(kind: 'mistakes' | 'setups', id: string): Promise<void> {
    if (kind === 'mistakes' && this.snapshot.mistakes.find((tag) => tag.id === id)?.isSystem) return
    this.set({ ...this.snapshot, [kind]: (this.snapshot[kind] as { id: string }[]).filter((tag) => tag.id !== id) })
    await this.backend.delete(kind, [id])
  }

  /** Stores the given order of tag ids as their sort order. */
  async reorderTags(kind: 'mistakes' | 'setups', ids: string[]): Promise<void> {
    const order = new Map(ids.map((id, index) => [id, index]))
    const tags = (this.snapshot[kind] as (MistakeTag | SetupTag)[]).map((tag) => ({ ...tag, sortOrder: order.get(tag.id) ?? tag.sortOrder }))
    this.set(sorted({ ...this.snapshot, [kind]: tags }))
    await this.backend.put(kind, tags as never[])
  }

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

  // Rules, limits and reviews

  async saveRule(rule: Rule): Promise<void> {
    this.set(withRecord(this.snapshot, 'rules', rule))
    await this.backend.put('rules', [rule])
  }

  async addRule(text: string): Promise<Rule> {
    const rule: Rule = { id: newId(), text: text.trim(), isActive: true, sortOrder: this.snapshot.rules.length }
    await this.saveRule(rule)
    return rule
  }

  /** Deletes a rule. Trades keep the id; screens skip rules that no longer exist. */
  async deleteRule(id: string): Promise<void> {
    this.set({ ...this.snapshot, rules: this.snapshot.rules.filter((rule) => rule.id !== id) })
    await this.backend.delete('rules', [id])
  }

  async reorderRules(ids: string[]): Promise<void> {
    const order = new Map(ids.map((id, index) => [id, index]))
    const rules = this.snapshot.rules.map((rule) => ({ ...rule, sortOrder: order.get(rule.id) ?? rule.sortOrder }))
    this.set(sorted({ ...this.snapshot, rules }))
    await this.backend.put('rules', rules)
  }

  async updateProfile(patch: Partial<Omit<JournalProfile, 'id'>>): Promise<void> {
    const profile = { ...this.snapshot.profile, ...patch }
    this.set({ ...this.snapshot, profile })
    await this.backend.saveProfile(profile)
  }

  async saveReview(review: WeeklyReview): Promise<void> {
    const saved = { ...review, updatedAt: new Date().toISOString() }
    this.set(withRecord(this.snapshot, 'reviews', saved))
    await this.backend.put('reviews', [saved])
  }

  // Onboarding

  /**
   * Saves the answers, creates the first accounts and moves the weaknesses the trader picked
   * to the front of the mistake tags, so they're the first chips in the entry sheet.
   */
  async completeOnboarding(answers: OnboardingAnswers, accounts: Account[]): Promise<void> {
    const picked = new Set<string>(answers.weaknesses)
    const ranked = [...this.snapshot.mistakes].sort((a, b) => {
      const pa = a.systemKey && picked.has(a.systemKey) ? 0 : 1
      const pb = b.systemKey && picked.has(b.systemKey) ? 0 : 1
      return pa - pb || a.sortOrder - b.sortOrder
    })
    const mistakes = ranked.map((tag, index) => ({ ...tag, sortOrder: index }))
    const profile = { ...this.snapshot.profile, onboarding: { ...answers, completedAt: new Date().toISOString() } }
    this.set(sorted({ ...this.snapshot, accounts: [...this.snapshot.accounts, ...accounts], mistakes, profile }))
    await this.backend.put('accounts', accounts)
    await this.backend.put('mistakes', mistakes)
    await this.backend.saveProfile(profile)
  }

  async skipOnboarding(): Promise<void> {
    await this.updateProfile({
      onboarding: { markets: [], venues: [], weaknesses: [], currency: 'USDT', completedAt: new Date().toISOString(), skipped: true },
    })
  }

  // Whole journal

  exportData(): JournalData {
    const { status: _status, ...data } = this.snapshot
    return data
  }

  async importData(imported: JournalData): Promise<void> {
    const data = normalizeJournal(imported)
    const { data: complete } = canonicalSystemMistakes(data)
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

/** System mistake tags have the same id on every device, so synced copies merge. */
export function systemMistakeId(key: SystemMistakeKey): string {
  return `system-${key}`
}

/**
 * Gives every system mistake its fixed id and exactly one tag per key: seeds missing ones,
 * renames tags created with random ids by older versions, and merges duplicates (two devices
 * that seeded before syncing), moving trades onto the surviving tag. A user's rename, color or
 * archiving is kept.
 */
export function canonicalSystemMistakes(data: JournalData): {
  data: JournalData
  /** `seeded`: new default tags; `mistakes`: existing tags moved to their fixed id. */
  writes: { seeded: MistakeTag[]; mistakes: MistakeTag[]; trades: Trade[]; removedMistakeIds: string[] }
} {
  const remap = new Map<string, string>()
  const removed: string[] = []
  const written: MistakeTag[] = []
  const seeded: MistakeTag[] = []
  const others = data.mistakes.filter((tag) => !tag.isSystem || !tag.systemKey)
  const system: MistakeTag[] = SYSTEM_MISTAKES.map((key, index) => {
    const id = systemMistakeId(key)
    const copies = data.mistakes.filter((tag) => tag.isSystem && tag.systemKey === key)
    // Prefer the canonical copy, then one the user customized.
    const keep = copies.find((tag) => tag.id === id) ?? copies.find((tag) => tag.name) ?? copies[0]
    for (const copy of copies) {
      if (copy.id === id) continue
      remap.set(copy.id, id)
      removed.push(copy.id)
    }
    const tag: MistakeTag = keep
      ? { ...keep, id }
      : { id, name: '', colorHex: SYSTEM_MISTAKE_COLORS[key], isSystem: true, systemKey: key, sortOrder: index, isArchived: false }
    if (!keep) seeded.push(tag)
    else if (keep.id !== id) written.push(tag)
    return tag
  })

  const trades = data.trades.map((trade) => {
    if (!trade.mistakeIds.some((id) => remap.has(id))) return trade
    return { ...trade, mistakeIds: [...new Set(trade.mistakeIds.map((id) => remap.get(id) ?? id))] }
  })
  const changedTrades = trades.filter((trade, index) => trade !== data.trades[index])

  return {
    data: { ...data, mistakes: [...system, ...others], trades },
    writes: { seeded, mistakes: written, trades: changedTrades, removedMistakeIds: removed },
  }
}

function withRecord<C extends Collection>(
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
    rules: [...data.rules].sort((a, b) => a.sortOrder - b.sortOrder),
  }
}
