import { ChartColumn } from 'lucide-react'
import { EmptyState } from '../../design/components'
import { useI18n } from '../../i18n/i18n'
import { PageHeader } from '../shell/PageHeader'

/** Cost of mistakes, metrics and the PnL calendar arrive in the analytics stage. */
export function AnalyticsPage() {
  const { t } = useI18n()
  return (
    <>
      <PageHeader title={t('tab.analytics')} showAccountSwitcher />
      <EmptyState icon={<ChartColumn size={28} />} title={t('analytics.comingTitle')} message={t('analytics.comingMessage')} />
    </>
  )
}
