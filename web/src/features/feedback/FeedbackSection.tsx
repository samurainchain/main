import { useCloud } from '../../app/cloud'
import { Card, SectionHeader } from '../../design/components'
import { useI18n } from '../../i18n/i18n'
import { FeedbackForm } from './FeedbackForm'

/** "Feedback" with its form; nothing when the app runs without a cloud setup. */
export function FeedbackSection({ className }: { className?: string }) {
  const { t } = useI18n()
  const { state } = useCloud()
  if (state.status === 'unavailable') return null
  return (
    <div className={className}>
      <SectionHeader title={t('feedback.section')} />
      <Card>
        <FeedbackForm />
      </Card>
    </div>
  )
}
