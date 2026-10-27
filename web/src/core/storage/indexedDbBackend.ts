import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { PROFILE_ID, type Account, type JournalData, type JournalProfile, type MistakeTag, type Rule, type SetupTag, type Trade, type WeeklyReview } from '../models'
import { COLLECTIONS, normalizeJournal, type Collection, type JournalBackend, type RecordOf } from './backend'

interface MirrorDB extends DBSchema {
  accounts: { key: string; value: Account }
  trades: { key: string; value: Trade }
  mistakes: { key: string; value: MistakeTag }
  setups: { key: string; value: SetupTag }
  rules: { key: string; value: Rule }
  reviews: { key: string; value: WeeklyReview }
  profile: { key: string; value: JournalProfile }
}

type StoreName = Collection | 'profile'
const STORES: readonly StoreName[] = [...COLLECTIONS, 'profile']

/** Schema version. 1: accounts, trades, mistakes, setups. 2: rules, reviews, profile. */
const VERSION = 2

export class IndexedDbBackend implements JournalBackend {
  private readonly db: Promise<IDBPDatabase<MirrorDB>>

  constructor(name = 'mirror') {
    this.db = openDB<MirrorDB>(name, VERSION, {
      upgrade(db) {
        for (const store of STORES) {
          if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: 'id' })
        }
      },
    })
  }

  async load(): Promise<JournalData> {
    const db = await this.db
    const [accounts, trades, mistakes, setups, rules, reviews, profile] = await Promise.all([
      db.getAll('accounts'),
      db.getAll('trades'),
      db.getAll('mistakes'),
      db.getAll('setups'),
      db.getAll('rules'),
      db.getAll('reviews'),
      db.get('profile', PROFILE_ID),
    ])
    return normalizeJournal({ accounts, trades, mistakes, setups, rules, reviews, profile })
  }

  async put<C extends Collection>(collection: C, records: RecordOf<C>[]): Promise<void> {
    const db = await this.db
    const tx = db.transaction(collection, 'readwrite')
    await Promise.all([...records.map((record) => tx.store.put(record as never)), tx.done])
  }

  async delete(collection: Collection, ids: string[]): Promise<void> {
    const db = await this.db
    const tx = db.transaction(collection, 'readwrite')
    await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done])
  }

  async saveProfile(profile: JournalProfile): Promise<void> {
    const db = await this.db
    await db.put('profile', profile)
  }

  async replaceAll(data: JournalData): Promise<void> {
    const db = await this.db
    const tx = db.transaction(STORES, 'readwrite')
    const writes = COLLECTIONS.flatMap((collection) => {
      const store = tx.objectStore(collection)
      return [store.clear(), ...data[collection].map((record) => store.put(record as never))]
    })
    const profile = tx.objectStore('profile')
    await Promise.all([...writes, profile.clear(), profile.put(data.profile), tx.done])
  }
}
