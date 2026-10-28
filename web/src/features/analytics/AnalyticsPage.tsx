import Big from 'big.js'
import { ChartColumn, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useJournal, useMistakeName } from '../../app/journal'
import { useWeekStart } from '../../app/settings'
import { useSheets } from '../../app/sheets'
import type { Currency } from '../../core/models'
import {
  byEmotion,
  byHour,
  bySetup,
  bySymbol,
  byWeekday,
  closedTrades,
  equityCurve,
  inPeriod,
  metrics,
  mistakeCosts,
  PERIODS,
  pnlWithoutMistakes,
  type Breakdown,
  type Period,
} from '../../core/stats'
import { Button, Card, EmptyState, PnLText, SectionHeader, Segmented } from '../../design/components'
import { formatMoney, formatR, formatRatio, formatShare, weekdayNames } from '../../i18n/format'
import { useI18n } from '../../i18n/i18n'
import { CheckInResults } from '../checkin/CheckInResults'
import { SessionResults } from '../sessions/SessionResults'
import { PageHeader } from '../shell/PageHeader'
import { useVisibleTrades } from '../trades/tradeQueries'
import { EMOTION_ICONS } from '../trades/TradeRow'
import { ColumnChart, CostBarList, EquityCurve, SignedBarList } from './charts'
import { PnlCalendar } from './PnlCalendar'

/** Cost of mistakes, key metrics, PnL calendar and breakdowns (SPEC section 4.7). */
export function AnalyticsPage() {
  const { t, tp, locale } = useI18n()
  const { mistakes, setups } = useJournal()
  const { trades, currency } = useVisibleTrades()
  const { newTrade } = useSheets()
  const weekStart = useWeekStart()
  const mistakeName = useMistakeName()
  const [period, setPeriod] = useState<Period>('month')

  const closed = useMemo(() => closedTrades(trades), [trades])
  const inRange = useMemo(() => inPeriod(closed, period, new Date(), weekStart), [closed, period, weekStart])
  const summary = useMemo(() => metrics(inRange), [inRange])
  const costs = useMemo(() => mistakeCosts(inRange, mistakes), [inRange, mistakes])

  const header = <PageHeader title={t('tab.analytics')} showAccountSwitcher />

  if (closed.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={<ChartColumn size={28} />}
          title={t('analytics.emptyTitle')}
          message={t('analytics.emptyMessage')}
          action={
            <Button variant="primary" block icon={<Plus size={20} aria-hidden="true" />} onClick={newTrade}>
              {t('action.newTrade')}
            </Button>
          }
        />
      </>
    )
  }

  const weekdays = weekdayNames(locale)
  const weekdayOrder = Array.from({ length: 7 }, (_, index) => (weekStart + index) % 7)
  const weekdayPnl = byWeekday(inRange)
  const setupName = (id: string) => setups.find((tag) => tag.id === id)?.name
  const hasTrades = inRange.length > 0

  return (
    <>
      {header}
      <Segmented label={t('analytics.period')} value={period} onChange={setPeriod} options={PERIODS.map((value) => ({ value, label: t(`analytics.period.${value}`) }))} />

      {!hasTrades ? (
        <p className="analytics-empty-period secondary-text">{t('analytics.emptyPeriod')}</p>
      ) : (
        <>
          <SectionHeader title={t('analytics.mistakeCost')} />
          <Card className="form-stack">
            {costs.some((item) => item.cost.gt(0)) ? (
              <>
                <CostBarList
                  currency={currency}
                  items={costs
                    .filter((item) => item.cost.gt(0))
                    .map((item) => ({
                      key: item.tag.id,
                      label: mistakeName(item.tag),
                      value: item.cost,
                      caption: `${tp('analytics.tradeCount', item.tradeCount)} · ${t('analytics.winRateShort', { value: formatShare(item.winRate ?? new Big(0), locale) })}`,
                    }))}
                />
                <p className="mistake-total">
                  {t('analytics.withoutMistakes')} <PnLText amount={pnlWithoutMistakes(inRange, costs)} currency={currency} />
                  <span className="caption"> · {t('analytics.estimate')}</span>
                </p>
              </>
            ) : (
              <p className="secondary-text">{t('analytics.noMistakeCost')}</p>
            )}
          </Card>

          <SectionHeader title={t('analytics.keyMetrics')} trailing={<span className="caption">{tp('analytics.tradeCount', summary.count)}</span>} />
          <div className="metric-grid">
            <Metric label={t('analytics.metric.pnl')}>
              <PnLText amount={summary.pnl} currency={currency} />
            </Metric>
            <Metric label={t('analytics.metric.winRate')}>{summary.winRate ? formatShare(summary.winRate, locale) : '—'}</Metric>
            <Metric label={t('analytics.metric.averageR')}>{summary.averageR ? formatR(summary.averageR, locale) : '—'}</Metric>
            <Metric label={t('analytics.metric.expectancy')}>
              {summary.expectancy ? <PnLText amount={summary.expectancy} currency={currency} /> : '—'}
            </Metric>
            <Metric label={t('analytics.metric.profitFactor')}>
              {summary.profitFactor ? formatRatio(summary.profitFactor, locale) : summary.grossProfit.gt(0) ? '∞' : '—'}
            </Metric>
            <Metric label={t('analytics.metric.maxDrawdown')}>
              <span className={summary.maxDrawdown.gt(0) ? 'loss' : ''}>{formatMoney(summary.maxDrawdown.times(-1), currency, locale)}</span>
            </Metric>
          </div>
        </>
      )}

      <SectionHeader title={t('analytics.calendar')} />
      <Card>
        <PnlCalendar trades={closed} currency={currency} />
      </Card>

      {hasTrades && (
        <>
          <SectionHeader title={t('analytics.byEmotion')} />
          <Card>
            {byEmotion(inRange).length > 0 ? (
              <SignedBarList
                currency={currency}
                items={byEmotion(inRange)
                  .sort((a, b) => a.pnl.cmp(b.pnl))
                  .map((item) => {
                    const Icon = EMOTION_ICONS[item.key]
                    return {
                      key: item.key,
                      label: (
                        <span className="inline-icon">
                          <Icon size={16} aria-hidden="true" />
                          {t(`emotion.${item.key}`)}
                        </span>
                      ),
                      value: item.pnl,
                      caption: tp('analytics.tradeCount', item.count),
                    }
                  })}
              />
            ) : (
              <p className="secondary-text">{t('analytics.noEmotions')}</p>
            )}
          </Card>

          <CheckInResults trades={inRange} currency={currency} />

          <SessionResults trades={inRange} currency={currency} />

          <SectionHeader title={t('analytics.byWeekday')} />
          <Card>
            <SignedBarList
              currency={currency}
              items={weekdayOrder.map((day) => ({ key: String(day), label: weekdays[day], value: weekdayPnl[day]! }))}
            />
          </Card>

          <SectionHeader title={t('analytics.byHour')} />
          <Card>
            <ColumnChart
              label={t('analytics.byHour')}
              currency={currency}
              values={byHour(inRange)}
              labels={Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'))}
              tickEvery={3}
              formatLabel={(hour) => `${hour}:00`}
            />
          </Card>

          <SectionHeader title={t('analytics.bySetup')} />
          <BreakdownTable
            rows={bySetup(inRange).flatMap((row) => {
              const name = setupName(row.key)
              return name ? [{ ...row, key: name }] : []
            })}
            nameLabel={t('entry.setups')}
            emptyText={t('analytics.noSetups')}
            currency={currency}
          />

          <SectionHeader title={t('analytics.bySymbol')} />
          <BreakdownTable rows={bySymbol(inRange)} nameLabel={t('entry.symbol')} emptyText="" currency={currency} />

          <SectionHeader title={t('analytics.equity')} />
          <Card>
            <EquityCurve points={equityCurve(inRange)} currency={currency} label={t('analytics.equity')} />
          </Card>
        </>
      )}
    </>
  )
}

function Metric({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="metric card">
      <span className="caption">{label}</span>
      <span className="metric__value numeric">{children}</span>
    </div>
  )
}

function BreakdownTable({
  rows,
  nameLabel,
  emptyText,
  currency,
}: {
  rows: Breakdown<string>[]
  nameLabel: string
  emptyText: string
  currency: Currency
}) {
  const { t, locale } = useI18n()
  if (rows.length === 0) {
    return (
      <Card>
        <p className="secondary-text">{emptyText}</p>
      </Card>
    )
  }
  return (
    <div className="table-card">
      <table className="breakdown-table">
        <thead>
          <tr>
            <th scope="col">{nameLabel}</th>
            <th scope="col">PnL</th>
            <th scope="col">{t('analytics.column.trades')}</th>
            <th scope="col">{t('analytics.metric.winRate')}</th>
            <th scope="col">{t('analytics.metric.averageR')}</th>
          </tr>
        </thead>
        <tbody>
          {[...rows]
            .sort((a, b) => b.pnl.cmp(a.pnl))
            .map((row) => (
              <tr key={row.key}>
                <th scope="row">{row.key}</th>
                <td>
                  <PnLText amount={row.pnl} currency={currency} />
                </td>
                <td className="numeric">{row.count}</td>
                <td className="numeric">{formatShare(row.winRate, locale)}</td>
                <td className="numeric">{row.averageR ? formatR(row.averageR, locale) : '—'}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  )
}
