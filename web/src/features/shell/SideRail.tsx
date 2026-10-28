import Big from 'big.js'
import { AlertTriangle, CheckCircle2, ChevronRight, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { useMemo, useRef, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { activeAccounts, useJournal } from '../../app/journal'
import { routeHref } from '../../app/router'
import { clampRailWidth, RAIL_DEFAULT_WIDTH, RAIL_MAX_WIDTH, RAIL_MIN_WIDTH, updateSettings, useSettings, useWeekStart } from '../../app/settings'
import { weekInsights } from '../../core/insights'
import { weekSummary } from '../../core/review'
import { dailyPnl, localDayKey, startOfWeek } from '../../core/stats'
import { Card, PnLText, SectionHeader } from '../../design/components'
import { formatMoney, formatShare, weekdayNames } from '../../i18n/format'
import { useI18n } from '../../i18n/i18n'
import { useInsightText } from '../review/WeekBreakdown'
import { SessionClock } from '../sessions/SessionClock'
import { dayFromKey, useVisibleTrades } from '../trades/tradeQueries'

/** Released this far below the minimum width, a drag hides the column instead. */
const COLLAPSE_SLACK = 80
/** Arrow keys on the resize handle change the width by this much. */
const KEY_STEP = 16

/**
 * The right column on wide screens: trading sessions and this week at a glance (PnL, day bars,
 * the costliest pattern); feedback lives in the top bar. Hidden below 1400 px by CSS; the person can
 * collapse it to a thin strip or drag its left edge to resize it, and the browser remembers.
 */
export function SideRail() {
  const { t } = useI18n()
  const { accounts } = useJournal()
  const { railHidden } = useSettings()

  if (railHidden) {
    return (
      <aside className="side-rail side-rail--collapsed" aria-label={t('rail.label')}>
        <button type="button" className="icon-button" aria-label={t('rail.show')} title={t('rail.show')} aria-expanded={false} onClick={() => updateSettings({ railHidden: false })}>
          <PanelRightOpen size={20} aria-hidden="true" />
        </button>
      </aside>
    )
  }

  return (
    <aside className="side-rail" aria-label={t('rail.label')}>
      <RailResizer />
      <div className="side-rail__scroll">
        <div className="side-rail__bar">
          <button type="button" className="icon-button" aria-label={t('rail.hide')} title={t('rail.hide')} aria-expanded onClick={() => updateSettings({ railHidden: true })}>
            <PanelRightClose size={20} aria-hidden="true" />
          </button>
        </div>
        <SessionClock />
        {activeAccounts(accounts).length > 0 && <WeekGlance />}
      </div>
    </aside>
  )
}

/** The column's left edge: drag it (or use the arrow keys) to resize; a double click resets it. */
function RailResizer() {
  const { t } = useI18n()
  const { railWidth } = useSettings()
  const ref = useRef<HTMLDivElement>(null)
  // While dragging, the width goes straight to the CSS variable so pages don't re-render on
  // every mouse move; the setting is saved once, on release.
  const preview = (width: number) => ref.current?.closest<HTMLElement>('.shell')?.style.setProperty('--rail-width', `${width}px`)

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    const handle = event.currentTarget
    handle.setPointerCapture(event.pointerId)
    document.documentElement.classList.add('is-resizing')
    let wanted = railWidth
    const move = (moveEvent: PointerEvent) => {
      wanted = window.innerWidth - moveEvent.clientX
      preview(clampRailWidth(wanted))
    }
    const end = () => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', end)
      handle.removeEventListener('pointercancel', end)
      document.documentElement.classList.remove('is-resizing')
      if (wanted < RAIL_MIN_WIDTH - COLLAPSE_SLACK) {
        preview(railWidth)
        updateSettings({ railHidden: true })
      } else {
        updateSettings({ railWidth: clampRailWidth(wanted) })
      }
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', end)
    handle.addEventListener('pointercancel', end)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = { ArrowLeft: railWidth + KEY_STEP, ArrowRight: railWidth - KEY_STEP, Home: RAIL_MIN_WIDTH, End: RAIL_MAX_WIDTH }[event.key]
    if (next === undefined) return
    event.preventDefault()
    updateSettings({ railWidth: clampRailWidth(next) })
  }

  return (
    <div
      ref={ref}
      className="side-rail__resize"
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-label={t('rail.resize')}
      aria-valuemin={RAIL_MIN_WIDTH}
      aria-valuemax={RAIL_MAX_WIDTH}
      aria-valuenow={railWidth}
      title={t('rail.resizeHint')}
      onPointerDown={startDrag}
      onKeyDown={onKeyDown}
      onDoubleClick={() => updateSettings({ railWidth: RAIL_DEFAULT_WIDTH })}
    />
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
