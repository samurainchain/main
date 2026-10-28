import { useState } from 'react'
import { resultsBySession } from '../../core/sessions'
import type { Currency } from '../../core/models'
import type { ClosedTrade } from '../../core/stats'
import { Segmented } from '../../design/components'
import { formatMoney, formatShare } from '../../i18n/format'
import { useI18n } from '../../i18n/i18n'
import { SignedBarList } from '../analytics/charts'

/** Dashboard block: PnL by the trading session a trade was opened or closed in. */
export function SessionResults({ trades, currency }: { trades: readonly ClosedTrade[]; currency: Currency }) {
  const { t, tp, locale } = useI18n()
  const [by, setBy] = useState<'entry' | 'exit'>('entry')
  const groups = resultsBySession(trades, by)

  return (
    <div className="form-stack">
      <Segmented
        label={t('analytics.bySession')}
        value={by}
        options={[
          { value: 'entry', label: t('analytics.session.entry') },
          { value: 'exit', label: t('analytics.session.exit') },
        ]}
        onChange={setBy}
      />
      <SignedBarList
        currency={currency}
        items={groups.map(({ key, metrics }) => ({
          key,
          label: key === 'off' ? t('analytics.session.off') : t(`sessions.name.${key}`),
          value: metrics.pnl,
          caption: [
            tp('analytics.tradeCount', metrics.count),
            metrics.winRate && t('analytics.session.winRate', { rate: formatShare(metrics.winRate, locale) }),
            metrics.expectancy && t('analytics.session.expectancy', { value: formatMoney(metrics.expectancy, currency, locale) }),
          ]
            .filter(Boolean)
            .join(' · '),
        }))}
      />
      <p className="caption">{t('analytics.session.note')}</p>
    </div>
  )
}
