import { ChevronLeft, ChevronRight, ExternalLink, X } from 'lucide-react'
import { useEffect, useId, useRef, type KeyboardEvent } from 'react'
import { useJournal } from '../../app/journal'
import { routeHref } from '../../app/router'
import type { Trade } from '../../core/models'
import { useI18n } from '../../i18n/i18n'
import { TradeDetail } from './TradeDetailPage'

/** Typing in a field (a note, a number) keeps its arrow keys. */
function isTextEntry(target: EventTarget): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
}

/**
 * A trade's details in a panel over the right side of the trade table. ← and → (or the arrow
 * buttons) step through the trades in the table's order; Escape or × closes it.
 */
export function TradePanel({ trades, openId, onOpen, onClose }: { trades: readonly Trade[]; openId: string | undefined; onOpen: (id: string) => void; onClose: () => void }) {
  const { t } = useI18n()
  const { accounts } = useJournal()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const index = trades.findIndex((trade) => trade.id === openId)
  const trade = index >= 0 ? trades[index] : undefined
  const previous = index > 0 ? trades[index - 1] : undefined
  const next = index >= 0 ? trades[index + 1] : undefined
  const accountName = trade && accounts.find((item) => item.id === trade.accountId)?.name

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (trade && !element.open) element.showModal()
    if (!trade && element.open) element.close()
  }, [trade])

  // A deleted trade (or one filtered away) closes the panel.
  useEffect(() => {
    if (openId && !trade) onClose()
  }, [openId, trade, onClose])

  const onKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || isTextEntry(event.target)) return
    const target = event.key === 'ArrowLeft' ? previous : event.key === 'ArrowRight' ? next : undefined
    if (!target) return
    event.preventDefault()
    onOpen(target.id)
  }

  return (
    <dialog
      ref={dialog}
      className="trade-panel"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === dialog.current) onClose()
      }}
      onKeyDown={onKeyDown}
    >
      {trade && (
        <div className="trade-panel__inner">
          <header className="trade-panel__header">
            <button type="button" className="icon-button" aria-label={t('trade.panel.previous')} disabled={!previous} onClick={() => previous && onOpen(previous.id)}>
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
            <div className="trade-panel__title">
              <h2 id={titleId}>
                {trade.symbol} <span className={`side-badge side-badge--${trade.side}`}>{t(`side.${trade.side}`)}</span>
              </h2>
              <p className="caption">
                {accountName && `${accountName} · `}
                <span className="numeric">{t('trade.panel.position', { position: String(index + 1), count: String(trades.length) })}</span>
              </p>
            </div>
            <button type="button" className="icon-button" aria-label={t('trade.panel.next')} disabled={!next} onClick={() => next && onOpen(next.id)}>
              <ChevronRight size={20} aria-hidden="true" />
            </button>
            <a className="icon-button" href={routeHref({ name: 'trade', id: trade.id })} aria-label={t('trade.panel.openPage')} title={t('trade.panel.openPage')}>
              <ExternalLink size={18} aria-hidden="true" />
            </a>
            <button type="button" className="icon-button" aria-label={t('common.close')} onClick={onClose}>
              <X size={20} aria-hidden="true" />
            </button>
          </header>
          <div className="trade-panel__body">
            <TradeDetail trade={trade} onDeleted={onClose} onDuplicated={onOpen} />
            <p className="trade-panel__hint caption">{t('trade.panel.keysHint')}</p>
          </div>
        </div>
      )}
    </dialog>
  )
}
