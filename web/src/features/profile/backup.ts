import type { JournalData } from '../../core/models'
import { normalizeJournal } from '../../core/storage/backend'

const FORMAT = 'mirror-backup'
/** 1: accounts, trades, mistakes, setups. 2: adds rules, reviews and the profile. */
const VERSION = 2

interface BackupFile {
  format: typeof FORMAT
  version: number
  exportedAt: string
  data: JournalData
}

/** Backups are JSON text, so trade screenshots stay out of them; cloud sync carries those. */
export function serializeBackup(data: JournalData, now = new Date()): string {
  const file: BackupFile = { format: FORMAT, version: VERSION, exportedAt: now.toISOString(), data: { ...data, images: [] } }
  return JSON.stringify(file, null, 2)
}

/** Reads a backup file, or throws when it isn't a Mirror backup this version understands. */
export function parseBackup(text: string): JournalData {
  const file = JSON.parse(text) as Partial<BackupFile>
  if (file.format !== FORMAT || typeof file.version !== 'number' || file.version > VERSION || !file.data) {
    throw new Error('Not a Mirror backup')
  }
  const { accounts, trades, mistakes, setups } = file.data
  if (![accounts, trades, mistakes, setups].every(Array.isArray)) throw new Error('Backup is incomplete')
  const accountIds = new Set(accounts.map((account) => account.id))
  if (!trades.every((trade) => accountIds.has(trade.accountId))) throw new Error('Backup has trades without an account')
  return normalizeJournal(file.data)
}

export function downloadBackup(json: string, now = new Date()): void {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `mirror-backup-${now.toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
}
