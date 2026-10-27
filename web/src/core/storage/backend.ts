import { defaultProfile, type JournalData, type Trade } from '../models'

/** Collections stored as lists of records; the profile is a single record. */
export type Collection = 'accounts' | 'trades' | 'mistakes' | 'setups' | 'rules' | 'reviews'
export type RecordOf<C extends Collection> = JournalData[C][number]
export const COLLECTIONS: readonly Collection[] = ['accounts', 'trades', 'mistakes', 'setups', 'rules', 'reviews']

/**
 * Where the journal is persisted. The browser (IndexedDB) is the only backend today;
 * a cloud backend can implement the same interface later.
 */
export interface JournalBackend {
  load(): Promise<JournalData>
  /** `asDefault`: records the app created on its own (seeded tags), which any real edit beats when syncing. */
  put<C extends Collection>(collection: C, records: RecordOf<C>[], options?: { asDefault?: boolean }): Promise<void>
  delete(collection: Collection, ids: string[]): Promise<void>
  saveProfile(profile: JournalData['profile']): Promise<void>
  /** Replaces everything, e.g. when importing a backup. */
  replaceAll(data: JournalData): Promise<void>
}

export function emptyJournal(): JournalData {
  return { accounts: [], trades: [], mistakes: [], setups: [], rules: [], reviews: [], profile: defaultProfile() }
}

type StoredTrade = Omit<Trade, 'brokenRuleIds'> & Partial<Pick<Trade, 'brokenRuleIds'>>

/**
 * Fills fields added after data was first written (older browsers' stores and backups),
 * so the rest of the app can rely on the current shape.
 */
export function normalizeJournal(data: Partial<Omit<JournalData, 'trades'>> & { trades?: StoredTrade[] }): JournalData {
  return {
    accounts: data.accounts ?? [],
    trades: (data.trades ?? []).map((trade) => ({ ...trade, brokenRuleIds: trade.brokenRuleIds ?? [] })),
    mistakes: data.mistakes ?? [],
    setups: data.setups ?? [],
    rules: data.rules ?? [],
    reviews: data.reviews ?? [],
    profile: { ...defaultProfile(), ...data.profile },
  }
}
