import type Big from 'big.js'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useJournal, useMistakeName } from '../../app/journal'
import { weekInsights, type Insight } from '../../core/insights'
import type { Currency } from '../../core/models'
import type { ClosedTrade } from '../../core/stats'
import { Card, SectionHeader } from '../../design/components'
import { formatDecimal, formatMoney, formatShare, weekdayNames } from '../../i18n/format'
import { useI18n } from '../../i18n/i18n'

const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1)

/**
 * "Week breakdown" in the weekly review: what cost money this week and one thing that worked,
 * as plain sentences from the rules in core/insights.ts (no AI).
 */
export function WeekBreakdown({ trades, currency }: { trades: readonly ClosedTrade[]; currency: Currency }) {
  const { t, tp, locale } = useI18n()
  const { mistakes, setups } = useJournal()
  const mistakeName = useMistakeName()
  const insights = weekInsights(trades, mistakes)
  if (insights.length === 0) return null

  const money = (amount: Big) => formatMoney(amount, currency, locale)
  const text = (insight: Insight): string => {
    switch (insight.kind) {
      case 'revenge':
        return tp('insights.revenge', insight.count, { losses: String(insight.losses), pnl: money(insight.pnl) })
      case 'badSlot':
        return t('insights.badSlot', {
          day: capitalize(weekdayNames(locale, 'long')[insight.weekday]!),
          part: t(`insights.part.${insight.part}`),
          losses: String(insight.losses),
          count: String(insight.count),
          pnl: money(insight.pnl),
        })
      case 'costliestMistake': {
        const tag = mistakes.find((item) => item.id === insight.tagId)
        // "Cost you $30" reads without a sign; a mistake behind every loss of the week says so.
        const all = insight.share.gte(0.995)
        return t(all ? 'insights.costliestMistakeAll' : 'insights.costliestMistake', {
          name: tag ? mistakeName(tag) : '',
          cost: formatMoney(insight.cost, currency, locale, false),
          share: formatShare(insight.share, locale),
        })
      }
      case 'emotionGap':
        return t('insights.emotionGap', {
          good: t(`emotion.${insight.good}`),
          goodPnl: money(insight.goodPnl),
          bad: t(`emotion.${insight.bad}`),
          badPnl: money(insight.badPnl),
        })
      case 'noStop':
        return tp('insights.noStop', insight.count, { pnl: money(insight.pnl) })
      case 'overtrading':
        return tp('insights.overtrading', insight.count, { pnl: money(insight.pnl) })
      case 'earlyExit':
        return tp('insights.earlyExit', insight.count, { missed: formatMoney(insight.missed, currency, locale, false) })
      case 'heldLosers':
        return t('insights.heldLosers', { ratio: formatDecimal(insight.ratio.toString(), locale) })
      case 'bestSetup':
        return tp('insights.bestSetup', insight.count, { name: setups.find((item) => item.id === insight.setupId)?.name ?? '', pnl: money(insight.pnl) })
      case 'clean':
        return t('insights.clean')
    }
  }

  return (
    <>
      <SectionHeader title={t('review.patterns')} />
      <Card className="form-stack">
        <ul className="insights">
          {insights.map(({ insight, tone }, index) => (
            <li key={`${insight.kind}-${index}`} className={`insight insight--${tone}`}>
              {tone === 'warning' ? <AlertTriangle size={18} aria-hidden="true" /> : <CheckCircle2 size={18} aria-hidden="true" />}
              <span>{text(insight)}</span>
            </li>
          ))}
        </ul>
        <p className="caption">{t('insights.note')}</p>
      </Card>
    </>
  )
}
