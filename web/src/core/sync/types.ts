import type { Collection } from '../storage/backend'

// Cloud sync: every record is copied to the server as a row keyed by collection and id.
// Conflicts resolve last-write-wins on `updatedAt`, the time the record was changed on a
// device; deletions travel as tombstones.

export type SyncCollection = Collection | 'profile'

export interface Change {
  collection: SyncCollection
  id: string
  /** The record itself, or null for a deletion. */
  data: unknown
  deleted: boolean
  /** ISO time of the change on the device that made it. */
  updatedAt: string
}

export interface RemoteRecord extends Change {
  /** ISO time the server stored this version; used to pull only what's new. */
  serverUpdatedAt: string
}

/** The server side. Pushing keeps whichever version of a record is newer. */
export interface RemoteJournal {
  pull(since: string | undefined): Promise<RemoteRecord[]>
  push(changes: Change[]): Promise<void>
}

export interface SyncMeta {
  /** The signed-in user these sync records belong to. */
  userId?: string
  /** Latest `serverUpdatedAt` already pulled. */
  lastPulledAt?: string
}

/** What this device knows about sync: versions of local records and changes not yet sent. */
export interface SyncStateStore {
  /** `changeKey` → `updatedAt` of the version stored locally. */
  versions(): Promise<Map<string, string>>
  setVersions(changes: readonly Change[]): Promise<void>
  outbox(): Promise<Change[]>
  /** Adds changes to send; a newer change to the same record replaces the older one. */
  enqueue(changes: readonly Change[]): Promise<void>
  /** Removes sent changes, unless the record changed again while they were being sent. */
  dequeue(changes: readonly Change[]): Promise<void>
  getMeta(): Promise<SyncMeta>
  setMeta(meta: SyncMeta): Promise<void>
  /** Forgets everything about sync on this device (signing out). */
  clear(): Promise<void>
}

export function changeKey(collection: SyncCollection, id: string): string {
  return `${collection}:${id}`
}
