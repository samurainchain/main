import type { JournalData } from '../models'

export type Collection = keyof JournalData
export type RecordOf<C extends Collection> = JournalData[C][number]

/**
 * Where the journal is persisted. The browser (IndexedDB) is the only backend today;
 * a cloud backend can implement the same interface later.
 */
export interface JournalBackend {
  load(): Promise<JournalData>
  put<C extends Collection>(collection: C, records: RecordOf<C>[]): Promise<void>
  delete(collection: Collection, ids: string[]): Promise<void>
  /** Replaces everything, e.g. when importing a backup. */
  replaceAll(data: JournalData): Promise<void>
}

export function emptyJournal(): JournalData {
  return { accounts: [], trades: [], mistakes: [], setups: [] }
}
