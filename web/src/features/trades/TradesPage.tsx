import { ListChecks, Plus } from 'lucide-react'
import { useSheets } from '../../app/sheets'
import { Button, EmptyState, PnLText } from '../../design/components'
import { formatDay } from '../../i18n/format'
import { useI18n } from '../../i18n/i18n'
import { PageHeader } from '../shell/PageHeader'
import { groupByDay, useVisibleTrades } from './tradeQueries'
import { TradeRow } from './TradeRow'

/** All trades grouped by day, with the day's PnL above each group (SPEC section 4.5). */
export function TradesPage() {
  const { t, locale } = useI18n()
  const { trades, currency } = useVisibleTrades()
  const { newTrade } = useSheets()
  const days = groupByDay(trades)

  return (
    <>
      <PageHeader title={t('tab.trades')} showAccountSwitcher />
      {days.length === 0 ? (
        <EmptyState
          icon={<ListChecks size={28} />}
          title={t('trades.emptyTitle')}
          message={t('trades.emptyMessage')}
          action={
            <Button variant="primary" block icon={<Plus size={20} aria-hidden="true" />} onClick={newTrade}>
              {t('action.newTrade')}
            </Button>
          }
        />
      ) : (
        days.map((day) => (
          <section key={day.key} className="day-group" aria-label={formatDay(day.date, locale)}>
            <header className="day-group__header">
              <h2>{formatDay(day.date, locale)}</h2>
              <PnLText amount={day.pnl} currency={currency} />
            </header>
            <div className="list-card">
              {day.trades.map((trade) => (
                <TradeRow key={trade.id} trade={trade} />
              ))}
            </div>
          </section>
        ))
      )}
    </>
  )
}
