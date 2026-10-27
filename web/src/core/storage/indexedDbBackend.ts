import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Account, JournalData, MistakeTag, SetupTag, Trade } from '../models'
import type { Collection, JournalBackend, RecordOf } from './backend'

interface MirrorDB extends DBSchema {
  accounts: { key: string; value: Account }
  trades: { key: string; value: Trade }
  mistakes: { key: string; value: MistakeTag }
  setups: { key: string; value: SetupTag }
}

const COLLECTIONS: readonly Collection[] = ['accounts', 'trades', 'mistakes', 'setups']

export class IndexedDbBackend implements JournalBackend {
  private readonly db: Promise<IDBPDatabase<MirrorDB>>

  constructor(name = 'mirror') {
    this.db = openDB<MirrorDB>(name, 1, {
      upgrade(db) {
        for (const collection of COLLECTIONS) {
          db.createObjectStore(collection, { keyPath: 'id' })
        }
      },
    })
  }

  async load(): Promise<JournalData> {
    const db = await this.db
    const [accounts, trades, mistakes, setups] = await Promise.all([
      db.getAll('accounts'),
      db.getAll('trades'),
      db.getAll('mistakes'),
      db.getAll('setups'),
    ])
    return { accounts, trades, mistakes, setups }
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

  async replaceAll(data: JournalData): Promise<void> {
    const db = await this.db
    const tx = db.transaction(COLLECTIONS, 'readwrite')
    const writes = COLLECTIONS.flatMap((collection) => {
      const store = tx.objectStore(collection)
      return [store.clear(), ...data[collection].map((record) => store.put(record as never))]
    })
    await Promise.all([...writes, tx.done])
  }
}
