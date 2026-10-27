import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { PROFILE_ID, type Account, type JournalData, type JournalProfile, type MistakeTag, type Rule, type SetupTag, type Trade, type WeeklyReview } from '../models'
import { changeKey, type Change, type SyncMeta, type SyncStateStore } from '../sync/types'
import { COLLECTIONS, normalizeJournal, type Collection, type JournalBackend, type RecordOf } from './backend'

interface StoredChange extends Change {
  key: string
}

interface MirrorDB extends DBSchema {
  accounts: { key: string; value: Account }
  trades: { key: string; value: Trade }
  mistakes: { key: string; value: MistakeTag }
  setups: { key: string; value: SetupTag }
  rules: { key: string; value: Rule }
  reviews: { key: string; value: WeeklyReview }
  profile: { key: string; value: JournalProfile }
  syncVersions: { key: string; value: { key: string; updatedAt: string } }
  syncOutbox: { key: string; value: StoredChange }
  syncMeta: { key: string; value: SyncMeta & { id: 'meta' } }
}

type StoreName = Collection | 'profile'
const STORES: readonly StoreName[] = [...COLLECTIONS, 'profile']
const SYNC_STORES = ['syncVersions', 'syncOutbox', 'syncMeta'] as const

/** Schema version. 1: accounts, trades, mistakes, setups. 2: rules, reviews, profile. 3: sync state. */
const VERSION = 3

export class IndexedDbBackend implements JournalBackend {
  private readonly db: Promise<IDBPDatabase<MirrorDB>>

  constructor(name = 'mirror') {
    this.db = openDB<MirrorDB>(name, VERSION, {
      upgrade(db) {
        for (const store of STORES) {
          if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('syncVersions')) db.createObjectStore('syncVersions', { keyPath: 'key' })
        if (!db.objectStoreNames.contains('syncOutbox')) db.createObjectStore('syncOutbox', { keyPath: 'key' })
        if (!db.objectStoreNames.contains('syncMeta')) db.createObjectStore('syncMeta', { keyPath: 'id' })
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

  /** Sync bookkeeping, kept in the same database as the journal. */
  syncState(): SyncStateStore {
    const db = this.db
    return {
      async versions() {
        const rows = await (await db).getAll('syncVersions')
        return new Map(rows.map((row) => [row.key, row.updatedAt]))
      },
      async setVersions(changes) {
        const tx = (await db).transaction('syncVersions', 'readwrite')
        await Promise.all([...changes.map((change) => tx.store.put({ key: changeKey(change.collection, change.id), updatedAt: change.updatedAt })), tx.done])
      },
      async outbox() {
        return (await (await db).getAll('syncOutbox')).map(({ key: _key, ...change }) => change)
      },
      async enqueue(changes) {
        const tx = (await db).transaction('syncOutbox', 'readwrite')
        await Promise.all([...changes.map((change) => tx.store.put({ ...change, key: changeKey(change.collection, change.id) })), tx.done])
      },
      async dequeue(changes) {
        const tx = (await db).transaction('syncOutbox', 'readwrite')
        for (const change of changes) {
          const key = changeKey(change.collection, change.id)
          const current = await tx.store.get(key)
          if (current && current.updatedAt === change.updatedAt) await tx.store.delete(key)
        }
        await tx.done
      },
      async getMeta() {
        const { id: _id, ...meta } = (await (await db).get('syncMeta', 'meta')) ?? { id: 'meta' as const }
        return meta
      },
      async setMeta(meta) {
        await (await db).put('syncMeta', { ...meta, id: 'meta' })
      },
      async clear() {
        const tx = (await db).transaction(SYNC_STORES, 'readwrite')
        await Promise.all([...SYNC_STORES.map((store) => tx.objectStore(store).clear()), tx.done])
      },
    }
  }
}
