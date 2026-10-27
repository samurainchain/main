import { ListChecks, Plus, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import { useWeekStart } from '../../app/settings'
import { useSheets } from '../../app/sheets'
import { Button, EmptyState, PnLText } from '../../design/components'
import { formatDay } from '../../i18n/format'
import { useI18n } from '../../i18n/i18n'
import { PageHeader } from '../shell/PageHeader'
import { ActiveFilters, FilterSheet } from './FilterSheet'
import { activeFilterCount, filterTrades, type TradeFilter } from './tradeFilters'
import { groupByDay, useVisibleTrades } from './tradeQueries'
import { TradeRow } from './TradeRow'

/** All trades grouped by day, with the day's PnL above each group (SPEC section 4.5). */
export function TradesPage() {
  const { t, locale } = useI18n()
  const { trades, currency } = useVisibleTrades()
  const { newTrade } = useSheets()
  const weekStart = useWeekStart()
  const [filter, setFilter] = useState<TradeFilter>({})
  const [filtersOpen, setFiltersOpen] = useState(false)
  const count = activeFilterCount(filter)
  const days = groupByDay(filterTrades(trades, filter, new Date(), weekStart))

  return (
    <>
      <PageHeader
        title={t('tab.trades')}
        showAccountSwitcher
        trailing={
          trades.length > 0 && (
            <Button icon={<SlidersHorizontal size={18} aria-hidden="true" />} aria-label={count ? t('filters.buttonActive', { count }) : undefined} onClick={() => setFiltersOpen(true)}>
              {t('filters.button')}
              {count > 0 && <span className="badge">{count}</span>}
            </Button>
          )
        }
      />
      <ActiveFilters filter={filter} onChange={setFilter} />
      <FilterSheet open={filtersOpen} filter={filter} trades={trades} onChange={setFilter} onClose={() => setFiltersOpen(false)} />
      {days.length === 0 && count > 0 ? (
        <EmptyState
          icon={<SlidersHorizontal size={28} />}
          title={t('filters.emptyTitle')}
          message={t('filters.emptyMessage')}
          action={
            <Button block onClick={() => setFilter({})}>
              {t('filters.reset')}
            </Button>
          }
        />
      ) : days.length === 0 ? (
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
