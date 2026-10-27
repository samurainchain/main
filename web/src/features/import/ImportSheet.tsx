import { AlertTriangle, FileUp } from 'lucide-react'
import { useId, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { activeAccounts, useJournal, useSelectedAccount, useStore } from '../../app/journal'
import { useSheets } from '../../app/sheets'
import { IMPORT_FIELDS, importCsv, type ColumnMap, type ImportField, type ImportShape } from '../../core/import/importTrades'
import { tradePnl } from '../../core/pnl'
import { Button, Field, PnLText, Sheet } from '../../design/components'
import { formatDateTime, formatDecimal } from '../../i18n/format'
import { useI18n } from '../../i18n/i18n'

/** Columns worth showing for each kind of file; an unrecognized file shows them all. */
const FIELDS: Record<ImportShape | 'unknown', readonly ImportField[]> = {
  positions: ['symbol', 'side', 'closingSide', 'entryPrice', 'exitPrice', 'quantity', 'pnl', 'fee', 'leverage', 'openTime', 'closeTime'],
  fills: ['symbol', 'side', 'positionSide', 'price', 'quantity', 'fee', 'pnl', 'time'],
  unknown: IMPORT_FIELDS,
}

const PREVIEW_ROWS = 8

/**
 * Imports trades from an exchange CSV export (SPEC section 2, version 1.1): pick a file, check
 * the account, the guessed columns and a preview, then import. Runs entirely in the browser.
 */
export function ImportSheet({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (message: string) => void }) {
  const { t, tp, locale } = useI18n()
  const store = useStore()
  const { accounts, trades } = useJournal()
  const selected = useSelectedAccount()
  const { newAccount } = useSheets()
  const ids = { account: useId(), columns: useId() }
  const fileInput = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<{ name: string; text: string }>()
  const [override, setOverride] = useState<ColumnMap>({})
  const [error, setError] = useState<string>()
  const [accountId, setAccountId] = useState<string>()
  // Open for a file whose columns weren't recognized; closes only when the trader closes it.
  const [columnsOpen, setColumnsOpen] = useState(false)

  const cryptoAccounts = activeAccounts(accounts).filter((item) => item.assetClass === 'cryptoSpot' || item.assetClass === 'cryptoPerp')
  const account =
    cryptoAccounts.find((item) => item.id === accountId) ?? (selected && cryptoAccounts.includes(selected) ? selected : cryptoAccounts[0])
  const result = useMemo(() => (file ? importCsv(file.text, override) : undefined), [file, override])
  const known = useMemo(() => new Set(trades.flatMap((trade) => (trade.importKey ? [trade.importKey] : []))), [trades])
  const fresh = result?.trades.filter((trade) => !known.has(trade.key)) ?? []
  const duplicates = (result?.trades.length ?? 0) - fresh.length

  const reset = () => {
    setFile(undefined)
    setOverride({})
    setError(undefined)
  }
  const close = () => {
    reset()
    onClose()
  }

  const pick = async (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0]
    event.target.value = ''
    if (!picked) return
    const text = await picked.text().catch(() => '')
    // Excel files are zip archives ("PK"); binary files hold NUL characters.
    if (!text.trim() || text.startsWith('PK') || text.includes('\u0000')) {
      setError(t('import.unreadable'))
      return
    }
    setError(undefined)
    setOverride({})
    setColumnsOpen(!importCsv(text).shape)
    setFile({ name: picked.name, text })
  }

  const submit = async () => {
    if (!account) return
    const count = await store.importTrades(account, fresh)
    onDone(count > 0 ? tp('import.done', count) : t('import.nothingNew'))
    close()
  }

  const fields = FIELDS[result?.shape ?? 'unknown']
  const preview = fresh.slice(0, PREVIEW_ROWS)

  return (
    <Sheet
      open={open}
      title={t('import.title')}
      onClose={close}
      footer={
        result && (
          <div className="action-row action-row--wrap">
            <Button onClick={() => fileInput.current?.click()}>{t('import.another')}</Button>
            <Button variant="primary" disabled={!account || fresh.length === 0} onClick={() => void submit()}>
              {fresh.length > 0 ? tp('import.submit', fresh.length) : t('import.nothingNew')}
            </Button>
          </div>
        )
      }
    >
      <input ref={fileInput} type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" hidden onChange={(event) => void pick(event)} />
      <div className="form-stack">
        {!result && (
          <>
            <p className="secondary-text">{t('import.intro')}</p>
            <p className="caption">{t('import.where')}</p>
            <Button icon={<FileUp size={18} aria-hidden="true" />} onClick={() => fileInput.current?.click()}>
              {t('import.pick')}
            </Button>
          </>
        )}
        {error && (
          <p className="import-warning" role="alert">
            <AlertTriangle size={16} aria-hidden="true" />
            {error}
          </p>
        )}

        {result && file && (
          <>
            <p className="caption">{file.name}</p>
            {cryptoAccounts.length === 0 ? (
              <div className="form-stack">
                <p className="secondary-text">{t('import.noCryptoAccount')}</p>
                <Button
                  onClick={() => {
                    close()
                    newAccount()
                  }}
                >
                  {t('import.addAccount')}
                </Button>
              </div>
            ) : (
              <Field label={t('import.account')} htmlFor={ids.account}>
                <select id={ids.account} className="input" value={account?.id} onChange={(event) => setAccountId(event.target.value)}>
                  {cryptoAccounts.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            {result.shape ? (
              <div className="import-summary" role="status">
                <p>
                  <strong>{tp('import.found', result.trades.length)}</strong> · {t(`import.shape.${result.shape}`)}
                </p>
                {duplicates > 0 && <p className="caption">{tp('import.duplicates', duplicates)}</p>}
                {result.skipped.length > 0 && <p className="caption">{tp('import.skipped', result.skipped.length)}</p>}
                {result.openPositions > 0 && <p className="caption">{tp('import.open', result.openPositions)}</p>}
              </div>
            ) : (
              <p className="import-warning" role="status">
                <AlertTriangle size={16} aria-hidden="true" />
                {t('import.unknown')}
              </p>
            )}
            {result.pnlMismatch && (
              <p className="import-warning" role="status">
                <AlertTriangle size={16} aria-hidden="true" />
                {t('import.mismatch')}
              </p>
            )}

            {preview.length > 0 && (
              <section className="form-stack" aria-label={t('import.preview')}>
                <h3 className="label">{t('import.preview')}</h3>
                <div className="table-card">
                  <table className="breakdown-table import-preview">
                    <thead>
                      <tr>
                        <th scope="col">{t('import.field.symbol')}</th>
                        <th scope="col">{t('import.field.entryPrice')}</th>
                        <th scope="col">{t('import.field.exitPrice')}</th>
                        <th scope="col">{t('import.field.quantity')}</th>
                        <th scope="col">PnL</th>
                        <th scope="col">{t('import.field.closeTime')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((trade) => {
                        const pnl = tradePnl({ ...trade, contractMultiplier: '1' })
                        return (
                          <tr key={trade.key}>
                            <th scope="row">
                              {trade.symbol} <span className={`side-badge side-badge--${trade.side}`}>{t(`side.${trade.side}`)}</span>
                            </th>
                            <td className="numeric">{formatDecimal(trade.entryPrice, locale)}</td>
                            <td className="numeric">{formatDecimal(trade.exitPrice, locale)}</td>
                            <td className="numeric">{formatDecimal(trade.quantity, locale)}</td>
                            <td>{pnl && <PnLText amount={pnl} currency={account?.currency ?? 'USDT'} />}</td>
                            <td>{formatDateTime(trade.closedAt, locale)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {fresh.length > PREVIEW_ROWS && <p className="caption">{tp('import.more', fresh.length - PREVIEW_ROWS)}</p>}
              </section>
            )}

            <details className="import-columns" open={columnsOpen} onToggle={(event) => setColumnsOpen(event.currentTarget.open)}>
              <summary>{t('import.columns')}</summary>
              <p className="caption">{t('import.columnsHint')}</p>
              <div className="form-grid">
                {fields.map((field) => {
                  const id = `${ids.columns}-${field}`
                  return (
                    <Field key={field} label={t(`import.field.${field}`)} htmlFor={id}>
                      <select
                        id={id}
                        className="input"
                        value={result.columns[field] ?? ''}
                        onChange={(event) => setOverride({ ...override, [field]: event.target.value === '' ? undefined : Number(event.target.value) })}
                      >
                        <option value="">{t('import.noColumn')}</option>
                        {result.headers.map((header, index) => (
                          <option key={index} value={index}>
                            {header || `#${index + 1}`}
                          </option>
                        ))}
                      </select>
                    </Field>
                  )
                })}
              </div>
            </details>
          </>
        )}
      </div>
    </Sheet>
  )
}
