import type { SupabaseClient } from '@supabase/supabase-js'
import type { Change, RemoteJournal, RemoteRecord, SyncCollection } from './types'

const TABLE = 'journal_records'
const PAGE = 1000

interface Row {
  collection: SyncCollection
  id: string
  data: unknown
  deleted: boolean
  updated_at: string
  server_updated_at: string
}

/** Postgres returns "+00:00" offsets; versions are compared as `toISOString()` strings. */
const iso = (value: string) => new Date(value).toISOString()

/** The journal table in Supabase (schema: supabase/schema.sql). Row-level security scopes it to the user. */
export class SupabaseRemote implements RemoteJournal {
  constructor(private readonly client: SupabaseClient) {}

  async pull(since: string | undefined): Promise<RemoteRecord[]> {
    const records: RemoteRecord[] = []
    for (let from = 0; ; from += PAGE) {
      let query = this.client
        .from(TABLE)
        .select('collection, id, data, deleted, updated_at, server_updated_at')
        .order('server_updated_at', { ascending: true })
        .range(from, from + PAGE - 1)
      if (since) query = query.gt('server_updated_at', since)
      const { data, error } = await query
      if (error) throw error
      const rows = (data ?? []) as Row[]
      for (const row of rows) {
        records.push({
          collection: row.collection,
          id: row.id,
          data: row.data,
          deleted: row.deleted,
          updatedAt: iso(row.updated_at),
          serverUpdatedAt: iso(row.server_updated_at),
        })
      }
      if (rows.length < PAGE) return records
    }
  }

  async push(changes: Change[]): Promise<void> {
    const records = changes.map((change) => ({
      collection: change.collection,
      id: change.id,
      data: change.deleted ? null : change.data,
      deleted: change.deleted,
      updated_at: change.updatedAt,
    }))
    const { error } = await this.client.rpc('push_journal_records', { records })
    if (error) throw error
  }
}
