import type { JournalData } from '../models'
import { rMultiple, tradePnl } from '../pnl'

// CSV export of all trades (SPEC section 4.10). Column names are English and numbers use a
// dot, so the file opens the same in any spreadsheet and any locale; amounts keep full precision.

const COLUMNS = [
  'opened_at',
  'closed_at',
  'account',
  'market',
  'symbol',
  'side',
  'entry_price',
  'exit_price',
  'quantity',
  'contract_multiplier',
  'leverage',
  'initial_stop_loss',
  'stop_loss',
  'fees',
  'pnl',
  'r_multiple',
  'emotion',
  'mistakes',
  'setups',
  'broken_rules',
  'note',
  'source',
] as const

/** Quotes a field when it holds a comma, quote or line break (RFC 4180). */
function field(value: string | undefined): string {
  const text = value ?? ''
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * All trades as CSV, oldest first. `mistakeName` turns a tag into its display name (system
 * tags are translated). Multiple tags in one cell are separated by "; ".
 */
export function tradesToCsv(data: Pick<JournalData, 'trades' | 'accounts' | 'mistakes' | 'setups' | 'rules'>, mistakeName: (id: string) => string | undefined): string {
  const account = new Map(data.accounts.map((item) => [item.id, item.name]))
  const setup = new Map(data.setups.map((item) => [item.id, item.name]))
  const rule = new Map(data.rules.map((item) => [item.id, item.text]))
  const names = (ids: readonly string[], lookup: (id: string) => string | undefined) =>
    ids.flatMap((id) => {
      const name = lookup(id)
      return name ? [name] : []
    }).join('; ')

  const rows = [...data.trades]
    .sort((a, b) => (a.closedAt ?? a.openedAt).localeCompare(b.closedAt ?? b.openedAt))
    .map((trade) =>
      [
        trade.openedAt,
        trade.closedAt,
        account.get(trade.accountId),
        trade.market,
        trade.symbol,
        trade.side,
        trade.entryPrice,
        trade.exitPrice,
        trade.quantity,
        trade.contractMultiplier,
        trade.leverage,
        trade.initialStopLoss,
        trade.stopLoss,
        trade.fees,
        tradePnl(trade)?.toString(),
        rMultiple(trade)?.toFixed(4),
        trade.emotion,
        names(trade.mistakeIds, mistakeName),
        names(trade.setupIds, (id) => setup.get(id)),
        names(trade.brokenRuleIds, (id) => rule.get(id)),
        trade.note,
        trade.source,
      ]
        .map(field)
        .join(','),
    )
  return [COLUMNS.join(','), ...rows].join('\r\n') + '\r\n'
}

/** Saves the CSV with a byte-order mark, so Excel reads non-Latin text as UTF-8. */
export function downloadCsv(csv: string, now = new Date()): void {
  const url = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `tiltless-trades-${now.toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
