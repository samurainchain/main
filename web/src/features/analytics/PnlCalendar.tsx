import type Big from 'big.js'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useWeekStart } from '../../app/settings'
import type { Currency, Trade } from '../../core/models'
import { dailyPnl, localDayKey, type ClosedTrade } from '../../core/stats'
import { formatDay, formatMoney, formatMoneyCompact, formatMonth, weekdayNames } from '../../i18n/format'
import { useI18n } from '../../i18n/i18n'
import { TradeRow } from '../trades/TradeRow'

// The legend ramp: strongest loss to strongest profit, with the empty-day color in the middle.
const LEGEND_STEPS = [-45, -28, -12, 0, 12, 28, 45]

function legendFill(step: number): string {
  const tone = step < 0 ? 'var(--color-chart-loss)' : 'var(--color-chart-profit)'
  return `color-mix(in srgb, ${tone} ${Math.abs(step)}%, var(--color-surface-elevated))`
}

/**
 * A month as a grid of days colored by that day's PnL (SPEC section 4.7, block 3).
 * Tapping a day lists its trades below the grid.
 */
export function PnlCalendar({ trades, currency }: { trades: readonly ClosedTrade[]; currency: Currency }) {
  const { t, locale } = useI18n()
  const weekStart = useWeekStart()
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [selected, setSelected] = useState<string>()

  const days = useMemo(() => dailyPnl(trades), [trades])
  const monthDays = useMemo(() => {
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
    return Array.from({ length: count }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1))
  }, [month])
  const leadingBlanks = (month.getDay() - weekStart + 7) % 7
  const names = weekdayNames(locale, 'short')
  const orderedNames = [...names.slice(weekStart), ...names.slice(0, weekStart)]

  // Color strength scales with the month's largest absolute day, capped at 45% so the date
  // and amount on the strongest fill keep AA contrast in both themes.
  const maxAbs = monthDays.reduce((top, date) => {
    const pnl = days.get(localDayKey(date))?.pnl
    return pnl && Number(pnl.abs().toFixed(2)) > top ? Number(pnl.abs().toFixed(2)) : top
  }, 0)
  const intensity = (pnl: Big) => (maxAbs ? 12 + Math.round((Number(pnl.abs().toFixed(2)) / maxAbs) * 33) : 0)

  const shiftMonth = (offset: number) => {
    setMonth(new Date(month.getFullYear(), month.getMonth() + offset, 1))
    setSelected(undefined)
  }

  const selectedTrades: Trade[] = selected
    ? trades.filter((item) => localDayKey(item.closedAt) === selected).map((item) => item.trade).reverse()
    : []
  const today = localDayKey(new Date())

  return (
    <div className="calendar">
      <div className="calendar__header">
        <button type="button" className="icon-button" aria-label={t('analytics.previousMonth')} onClick={() => shiftMonth(-1)}>
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <h3 className="calendar__title">{formatMonth(month, locale)}</h3>
        <button type="button" className="icon-button" aria-label={t('analytics.nextMonth')} onClick={() => shiftMonth(1)}>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="calendar__grid">
        {orderedNames.map((name) => (
          <span key={name} className="calendar__weekday caption" aria-hidden="true">
            {name}
          </span>
        ))}
        {Array.from({ length: leadingBlanks }, (_, index) => (
          <span key={`blank-${index}`} aria-hidden="true" />
        ))}
        {monthDays.map((date) => {
          const key = localDayKey(date)
          const day = days.get(key)
          const toneClass = day ? (day.pnl.gt(0) ? 'profit' : day.pnl.lt(0) ? 'loss' : 'flat') : 'empty'
          const style = day && !day.pnl.eq(0) ? ({ '--day-strength': `${intensity(day.pnl)}%` } as React.CSSProperties) : undefined
          const description = day ? `${formatDay(date, locale)}: ${formatMoney(day.pnl, currency, locale)}` : formatDay(date, locale)
          return (
            <button
              key={key}
              type="button"
              className={`calendar__day calendar__day--${toneClass}${key === today ? ' calendar__day--today' : ''}`}
              style={style}
              aria-label={description}
              aria-pressed={selected === key}
              disabled={!day}
              onClick={() => setSelected(selected === key ? undefined : key)}
            >
              <span className="calendar__date">{date.getDate()}</span>
              {day && <span className="calendar__pnl numeric">{formatMoneyCompact(day.pnl, currency, locale)}</span>}
            </button>
          )
        })}
      </div>

      {maxAbs > 0 && (
        <div className="calendar__legend caption" aria-hidden="true">
          <span>{t('analytics.legendLoss')}</span>
          <span className="calendar__ramp">
            {LEGEND_STEPS.map((step) => (
              <span key={step} style={{ background: legendFill(step) }} />
            ))}
          </span>
          <span>{t('analytics.legendProfit')}</span>
        </div>
      )}

      {selected && selectedTrades.length > 0 && (
        <div className="calendar__trades">
          <p className="caption">{formatDay(new Date(`${selected}T12:00`), locale)}</p>
          <div className="list-card">
            {selectedTrades.map((trade) => (
              <TradeRow key={trade.id} trade={trade} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
