import { PROFILE_ID, type JournalData, type JournalProfile } from '../models'
import { COLLECTIONS, type Collection, type JournalBackend, type RecordOf } from '../storage/backend'
import type { IndexedDbBackend } from '../storage/indexedDbBackend'
import { changeKey, type Change, type RemoteJournal, type SyncStateStore } from './types'

/** Changes are sent in batches of this many records. */
const PUSH_BATCH = 500
/** Pull from a little before the last pull, in case a write committed late on the server. */
const PULL_OVERLAP_MS = 5_000
/** Records written before sync existed have no change time; any server version beats them. */
const UNKNOWN_TIME = new Date(0).toISOString()

function recordTime(record: unknown): string {
  const { updatedAt, createdAt } = record as { updatedAt?: string; createdAt?: string }
  return updatedAt ?? createdAt ?? UNKNOWN_TIME
}

/** Every record of a journal as changes, for the first upload from a device. */
function allChanges(data: JournalData, versions: Map<string, string>): Change[] {
  const changes: Change[] = COLLECTIONS.flatMap((collection) =>
    (data[collection] as { id: string }[]).map((record) => ({
      collection,
      id: record.id,
      data: record,
      deleted: false,
      updatedAt: versions.get(changeKey(collection, record.id)) ?? recordTime(record),
    })),
  )
  changes.push({
    collection: 'profile',
    id: PROFILE_ID,
    data: data.profile,
    deleted: false,
    updatedAt: versions.get(changeKey('profile', PROFILE_ID)) ?? UNKNOWN_TIME,
  })
  return changes
}

/**
 * The journal's backend while sync is available: writes go to the browser's database as
 * before, and each one is recorded so it can be sent to the server once signed in.
 */
export class SyncingBackend implements JournalBackend {
  /** Queue changes for upload. On only while signed in. */
  tracking = false
  /** Called after every local write, to schedule a sync. */
  onLocalChange?: () => void

  constructor(
    readonly local: IndexedDbBackend,
    readonly state: SyncStateStore,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  load(): Promise<JournalData> {
    return this.local.load()
  }

  async put<C extends Collection>(collection: C, records: RecordOf<C>[], options?: { asDefault?: boolean }): Promise<void> {
    await this.local.put(collection, records)
    const updatedAt = options?.asDefault ? UNKNOWN_TIME : this.now()
    await this.record(records.map((record) => ({ collection, id: record.id, data: record, deleted: false, updatedAt })))
  }

  async delete(collection: Collection, ids: string[]): Promise<void> {
    await this.local.delete(collection, ids)
    await this.record(ids.map((id) => ({ collection, id, data: null, deleted: true, updatedAt: this.now() })))
  }

  async saveProfile(profile: JournalProfile): Promise<void> {
    await this.local.saveProfile(profile)
    await this.record([{ collection: 'profile', id: PROFILE_ID, data: profile, deleted: false, updatedAt: this.now() }])
  }

  /** Replaces everything: records that disappear are deleted on other devices too. */
  async replaceAll(data: JournalData): Promise<void> {
    const before = await this.local.load()
    await this.local.replaceAll(data)
    const now = this.now()
    const kept = new Set(COLLECTIONS.flatMap((collection) => (data[collection] as { id: string }[]).map((record) => changeKey(collection, record.id))))
    const removed: Change[] = COLLECTIONS.flatMap((collection) =>
      (before[collection] as { id: string }[])
        .filter((record) => !kept.has(changeKey(collection, record.id)))
        .map((record) => ({ collection, id: record.id, data: null, deleted: true, updatedAt: now })),
    )
    const written = allChanges(data, new Map()).map((change) => ({ ...change, updatedAt: now }))
    await this.record([...removed, ...written])
  }

  private async record(changes: Change[]): Promise<void> {
    if (changes.length === 0) return
    await this.state.setVersions(changes)
    if (this.tracking) await this.state.enqueue(changes)
    this.onLocalChange?.()
  }
}

export interface SyncResult {
  pushed: number
  pulled: number
}

/**
 * Two-way sync with the server: send queued changes, then fetch what other devices changed
 * and apply each record whose version is newer than the local one.
 */
export class CloudSync {
  private running?: Promise<SyncResult>
  private again = false

  constructor(
    private readonly backend: SyncingBackend,
    private readonly remote: RemoteJournal,
    /** Re-reads the journal after remote changes were applied. */
    private readonly onApplied: () => Promise<void>,
  ) {}

  /**
   * Starts syncing for a user. The first time this device syncs for that user, everything
   * stored locally is queued, so a journal kept offline merges into the account.
   */
  async connect(userId: string): Promise<void> {
    const { state, local } = this.backend
    const meta = await state.getMeta()
    if (meta.userId !== userId) {
      // Keep the change times this device already knows, so newer local edits still win.
      const changes = allChanges(await local.load(), await state.versions())
      await state.clear()
      await state.setVersions(changes)
      await state.setMeta({ userId })
      await state.enqueue(changes)
    }
    this.backend.tracking = true
  }

  /** Stops queueing changes; the local journal stays as it is. */
  disconnect(): void {
    this.backend.tracking = false
  }

  /** Runs a sync, or joins the one in progress and runs once more after it. */
  sync(): Promise<SyncResult> {
    if (this.running) {
      this.again = true
      return this.running
    }
    this.running = this.run().finally(() => {
      this.running = undefined
      if (this.again) {
        this.again = false
        void this.sync()
      }
    })
    return this.running
  }

  private async run(): Promise<SyncResult> {
    const { state, local } = this.backend

    const outbox = await state.outbox()
    for (let start = 0; start < outbox.length; start += PUSH_BATCH) {
      const batch = outbox.slice(start, start + PUSH_BATCH)
      await this.remote.push(batch)
      await state.dequeue(batch)
    }

    const meta = await state.getMeta()
    const since = meta.lastPulledAt ? new Date(Date.parse(meta.lastPulledAt) - PULL_OVERLAP_MS).toISOString() : undefined
    const records = await this.remote.pull(since)
    const versions = await state.versions()
    const pending = new Map((await state.outbox()).map((change) => [changeKey(change.collection, change.id), change.updatedAt]))

    const applied: Change[] = []
    for (const record of records) {
      const key = changeKey(record.collection, record.id)
      const localVersion = pending.get(key) ?? versions.get(key)
      if (localVersion !== undefined && localVersion >= record.updatedAt) continue
      if (record.collection === 'profile') {
        if (!record.deleted) await local.saveProfile(record.data as JournalProfile)
      } else if (record.deleted) {
        await local.delete(record.collection, [record.id])
      } else {
        await local.put(record.collection, [record.data as never])
      }
      applied.push(record)
    }
    await state.setVersions(applied)

    const lastPulledAt = records.reduce<string | undefined>((latest, record) => (!latest || record.serverUpdatedAt > latest ? record.serverUpdatedAt : latest), meta.lastPulledAt)
    await state.setMeta({ ...meta, lastPulledAt })
    if (applied.length > 0) await this.onApplied()
    return { pushed: outbox.length, pulled: applied.length }
  }
}
