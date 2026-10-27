import Big from 'big.js'
import { AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import { activeAccounts, useJournal } from '../../app/journal'
import { routeHref } from '../../app/router'
import { useWeekStart } from '../../app/settings'
import { weekInsights } from '../../core/insights'
import { weekSummary } from '../../core/review'
import { dailyPnl, localDayKey, startOfWeek } from '../../core/stats'
import { Card, PnLText, SectionHeader } from '../../design/components'
import { formatMoney, formatShare, weekdayNames } from '../../i18n/format'
import { useI18n } from '../../i18n/i18n'
import { FeedbackSection } from '../feedback/FeedbackSection'
import { useInsightText } from '../review/WeekBreakdown'
import { dayFromKey, useVisibleTrades } from '../trades/tradeQueries'

/**
 * The right column on wide screens: this week at a glance (PnL, day bars, the costliest
 * pattern) and the feedback form at the bottom. Hidden below 1400 px by CSS.
 */
export function SideRail() {
  const { accounts } = useJournal()
  return (
    <aside className="side-rail">
      {activeAccounts(accounts).length > 0 && <WeekGlance />}
      <FeedbackSection className="side-rail__feedback" />
    </aside>
  )
}

function WeekGlance() {
  const { t, tp, locale } = useI18n()
  const { mistakes } = useJournal()
  const { trades, currency } = useVisibleTrades()
  const weekStart = useWeekStart()
  const startKey = localDayKey(startOfWeek(new Date(), weekStart))
  const summary = useMemo(() => weekSummary(trades, mistakes, dayFromKey(startKey)), [trades, mistakes, startKey])
  const insightText = useInsightText(currency)
  const [top] = weekInsights(summary.trades, mistakes)

  const byDay = dailyPnl(summary.trades)
  const names = weekdayNames(locale, 'narrow')
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(summary.start.getFullYear(), summary.start.getMonth(), summary.start.getDate() + index)
    return { date, name: names[date.getDay()]!, longName: weekdayNames(locale, 'long')[date.getDay()]!, pnl: byDay.get(localDayKey(date))?.pnl }
  })
  const largest = days.reduce((max, day) => (day.pnl && day.pnl.abs().gt(max) ? day.pnl.abs() : max), new Big(0))
  const height = (pnl: Big) => (largest.gt(0) ? Math.max(4, Number(pnl.abs().div(largest).times(100).toFixed(0))) : 0)

  return (
    <div>
      <SectionHeader title={t('rail.week')} />
      <Card className="form-stack week-glance">
        <PnLText amount={summary.metrics.pnl} currency={currency} size="hero" />
        <p className="secondary-text">
          {tp('rail.trades', summary.metrics.count)}
          {summary.metrics.winRate && ` · ${t('rail.winRate', { share: formatShare(summary.metrics.winRate, locale) })}`}
        </p>
        <div className="week-bars" aria-hidden="true">
          {days.map((day) => (
            <div key={day.name + day.date.getDate()} className="week-bars__day" title={day.pnl ? `${day.longName}: ${formatMoney(day.pnl, currency, locale)}` : day.longName}>
              <span className="week-bars__half week-bars__half--up">{day.pnl?.gt(0) && <span className="week-bars__bar week-bars__bar--profit" style={{ height: `${height(day.pnl)}%` }} />}</span>
              <span className="week-bars__half week-bars__half--down">{day.pnl?.lt(0) && <span className="week-bars__bar week-bars__bar--loss" style={{ height: `${height(day.pnl)}%` }} />}</span>
              <span className="week-bars__label">{day.name}</span>
            </div>
          ))}
        </div>
        <ul className="visually-hidden">
          {days
            .filter((day) => day.pnl)
            .map((day) => (
              <li key={day.longName}>{`${day.longName}: ${formatMoney(day.pnl!, currency, locale)}`}</li>
            ))}
        </ul>
        {top && (
          <p className={`insight insight--${top.tone}`}>
            {top.tone === 'warning' ? <AlertTriangle size={18} aria-hidden="true" /> : <CheckCircle2 size={18} aria-hidden="true" />}
            <span>{insightText(top.insight)}</span>
          </p>
        )}
        <a className="inline-icon" href={routeHref({ name: 'review' })}>
          {t('rail.openReview')}
          <ChevronRight size={16} aria-hidden="true" />
        </a>
      </Card>
    </div>
  )
}
