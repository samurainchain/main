import Big from 'big.js'
import { ChevronLeft, Copy, Pencil, SearchX, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useJournal, useMistakeName, useStore } from '../../app/journal'
import { navigate, routeHref } from '../../app/router'
import { useSheets } from '../../app/sheets'
import { percentOfDeposit, rMultiple, tradeDuration, tradePnl } from '../../core/pnl'
import { Button, Card, Chip, EmptyState, PnLText, SectionHeader } from '../../design/components'
import { formatDateTime, formatDecimal, formatDuration, formatMoney, formatPercent, formatR } from '../../i18n/format'
import { useI18n } from '../../i18n/i18n'
import { PageHeader } from '../shell/PageHeader'
import { TradeGallery } from '../images/TradeImages'
import { EMOTION_ICONS } from './TradeRow'

/** Every field of a trade with its computed values (SPEC section 4.6). */
export function TradeDetailPage({ id }: { id: string }) {
  const { t, locale } = useI18n()
  const { trades, accounts, mistakes, setups, rules } = useJournal()
  const store = useStore()
  const { editTrade } = useSheets()
  const mistakeName = useMistakeName()
  const trade = trades.find((item) => item.id === id)

  const back = (
    <a className="back-link" href={routeHref({ name: 'trades' })}>
      <ChevronLeft size={20} aria-hidden="true" />
      {t('tab.trades')}
    </a>
  )

  if (!trade) {
    return (
      <>
        <PageHeader title={t('trade.notFoundTitle')} leading={back} />
        <EmptyState icon={<SearchX size={28} />} title={t('trade.notFoundTitle')} message={t('trade.notFoundMessage')} />
      </>
    )
  }

  const account = accounts.find((item) => item.id === trade.accountId)
  const currency = account?.currency ?? 'USD'
  const pnl = tradePnl(trade)
  const r = rMultiple(trade)
  const duration = tradeDuration(trade)
  const percent = pnl ? percentOfDeposit(pnl, account?.depositAmount) : undefined
  const tradeMistakes = mistakes.filter((tag) => trade.mistakeIds.includes(tag.id))
  const tradeSetups = setups.filter((tag) => trade.setupIds.includes(tag.id))
  const brokenRules = rules.filter((rule) => trade.brokenRuleIds.includes(rule.id))
  const images = store.imagesOf(trade.id)
  const EmotionIcon = trade.emotion ? EMOTION_ICONS[trade.emotion] : undefined
  const price = (value: string | undefined) => (value === undefined ? undefined : formatDecimal(value, locale))

  const remove = async () => {
    if (!window.confirm(t('trade.deleteConfirm'))) return
    await store.deleteTrade(trade.id)
    navigate({ name: 'trades' })
  }

  const duplicate = async () => {
    const copy = await store.duplicateTrade(trade.id)
    if (copy) navigate({ name: 'trade', id: copy.id })
  }

  return (
    <>
      <PageHeader
        title={trade.symbol}
        subtitle={account?.name}
        leading={back}
        trailing={<span className={`side-badge side-badge--${trade.side}`}>{t(`side.${trade.side}`)}</span>}
      />

      <Card className="trade-summary">
        {pnl ? <PnLText amount={pnl} currency={currency} size="hero" /> : <p className="pnl--hero secondary-text">{t('trade.open')}</p>}
        <dl className="stat-row">
          <Stat label={t('trade.r')} value={r ? formatR(r, locale) : '—'} />
          <Stat label={t('trade.duration')} value={duration !== undefined ? formatDuration(duration, locale) : '—'} />
          {percent && <Stat label={t('trade.percentOfDeposit')} value={formatPercent(percent, locale)} />}
        </dl>
      </Card>

      {images.length > 0 && <TradeGallery images={images} />}

      <SectionHeader title={t('trade.detailsSection')} />
      <Card>
        <dl className="detail-list">
          <Detail label={t('entry.account')} value={account?.name} />
          <Detail label={t('entry.market')} value={t(`market.${trade.market}`)} />
          <Detail label={t('entry.entryPrice')} value={price(trade.entryPrice)} />
          <Detail label={t('entry.exitPrice')} value={price(trade.exitPrice)} />
          <Detail label={t(trade.market === 'futures' ? 'entry.contracts' : trade.market === 'stock' ? 'entry.shares' : 'entry.quantity')} value={price(trade.quantity)} />
          {trade.market === 'futures' && <Detail label={t('entry.multiplier')} value={price(trade.contractMultiplier)} />}
          {trade.leverage && <Detail label={t('entry.leverage')} value={`${formatDecimal(trade.leverage, locale)}×`} />}
          <Detail label={t('entry.stopLoss')} value={price(trade.stopLoss)} />
          {trade.initialStopLoss && trade.initialStopLoss !== trade.stopLoss && (
            <Detail label={t('trade.initialStop')} value={price(trade.initialStopLoss)} />
          )}
          <Detail label={t('entry.fees')} value={formatMoney(new Big(trade.fees), currency, locale, false)} />
          <Detail label={t('entry.openedAt')} value={formatDateTime(trade.openedAt, locale)} />
          <Detail label={t('entry.closedAt')} value={trade.closedAt ? formatDateTime(trade.closedAt, locale) : undefined} />
          <Detail
            label={t('entry.emotion')}
            value={
              EmotionIcon ? (
                <span className="inline-icon">
                  <EmotionIcon size={16} aria-hidden="true" />
                  {t(`emotion.${trade.emotion!}`)}
                </span>
              ) : undefined
            }
          />
        </dl>
      </Card>

      {(tradeMistakes.length > 0 || tradeSetups.length > 0) && (
        <>
          <SectionHeader title={t('trade.tagsSection')} />
          <Card className="form-stack">
            {tradeMistakes.length > 0 && (
              <div className="chip-row" aria-label={t('entry.mistakes')}>
                {tradeMistakes.map((tag) => (
                  <Chip key={tag.id} label={mistakeName(tag)} colorHex={tag.colorHex} selected={false} />
                ))}
              </div>
            )}
            {tradeSetups.length > 0 && (
              <div className="chip-row" aria-label={t('entry.setups')}>
                {tradeSetups.map((tag) => (
                  <Chip key={tag.id} label={tag.name} colorHex={tag.colorHex} selected={false} />
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      {brokenRules.length > 0 && (
        <>
          <SectionHeader title={t('entry.brokenRules')} />
          <Card>
            <ul className="broken-rules">
              {brokenRules.map((rule) => (
                <li key={rule.id}>{rule.text}</li>
              ))}
            </ul>
          </Card>
        </>
      )}

      {trade.note && (
        <>
          <SectionHeader title={t('entry.note')} />
          <Card>
            <p className="note-text">{trade.note}</p>
          </Card>
        </>
      )}

      <div className="action-row">
        <Button variant="primary" icon={<Pencil size={18} aria-hidden="true" />} onClick={() => editTrade(trade.id)}>
          {t('action.edit')}
        </Button>
        <Button icon={<Copy size={18} aria-hidden="true" />} onClick={duplicate}>
          {t('action.duplicate')}
        </Button>
        <Button variant="danger" icon={<Trash2 size={18} aria-hidden="true" />} onClick={remove}>
          {t('action.delete')}
        </Button>
      </div>
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <dt className="caption">{label}</dt>
      <dd className="numeric">{value}</dd>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: ReactNode | undefined }) {
  return (
    <div className="detail-list__row">
      <dt className="secondary-text">{label}</dt>
      <dd className="numeric">{value ?? '—'}</dd>
    </div>
  )
}
