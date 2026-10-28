import { useJournal } from '../../app/journal'
import { byMood, byPlanKept, bySleep, type CheckInDays } from '../../core/checkins'
import { EMOTIONS, PLAN_KEPT, SLEEP_LEVELS, type Currency } from '../../core/models'
import type { ClosedTrade } from '../../core/stats'
import { Card, SectionHeader } from '../../design/components'
import { useI18n } from '../../i18n/i18n'
import { SignedBarList } from '../analytics/charts'

/**
 * Analytics: PnL per trading day by the day's check-in answers (sleep, mood, plan kept).
 * Hidden until some check-in day has closed trades in the period.
 */
export function CheckInResults({ trades, currency }: { trades: readonly ClosedTrade[]; currency: Currency }) {
  const { t, tp } = useI18n()
  const { checkins } = useJournal()
  const sleep = bySleep(trades, checkins, SLEEP_LEVELS)
  const mood = byMood(trades, checkins, EMOTIONS)
  const plan = byPlanKept(trades, checkins, PLAN_KEPT)
  if (sleep.length + mood.length + plan.length === 0) return null

  const items = <K extends string>(groups: CheckInDays<K>[], label: (key: K) => string) =>
    groups.map((group) => ({
      key: group.key,
      label: label(group.key),
      value: group.perDay,
      caption: `${tp('analytics.checkins.days', group.days)} · ${tp('analytics.tradeCount', group.trades)}`,
    }))

  return (
    <>
      <SectionHeader title={t('analytics.checkins')} />
      <Card className="form-stack">
        {plan.length > 0 && (
          <div className="checkin-results__group">
            <h3 className="caption">{t('analytics.checkins.planKept')}</h3>
            <SignedBarList currency={currency} items={items(plan, (key) => t(`checkin.planKept.${key}`))} />
          </div>
        )}
        {sleep.length > 0 && (
          <div className="checkin-results__group">
            <h3 className="caption">{t('analytics.checkins.sleep')}</h3>
            <SignedBarList currency={currency} items={items(sleep, (key) => t(`checkin.sleep.${key}`))} />
          </div>
        )}
        {mood.length > 0 && (
          <div className="checkin-results__group">
            <h3 className="caption">{t('analytics.checkins.mood')}</h3>
            <SignedBarList currency={currency} items={items(mood, (key) => t(`emotion.${key}`))} />
          </div>
        )}
        <p className="caption">{t('analytics.checkins.note')}</p>
      </Card>
    </>
  )
}
