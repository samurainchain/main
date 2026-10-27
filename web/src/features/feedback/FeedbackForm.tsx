import { Send } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { useCloud } from '../../app/cloud'
import { FEEDBACK_KINDS, FEEDBACK_MAX_LENGTH, feedbackRow, sendFeedback, type FeedbackKind } from '../../app/feedback'
import { useRoute } from '../../app/router'
import { Button, Field, Segmented } from '../../design/components'
import { useI18n } from '../../i18n/i18n'

/** A short form for ideas and problems, sent to the feedback table. Hidden without a cloud setup. */
export function FeedbackForm() {
  const { t, locale } = useI18n()
  const { cloud, state } = useCloud()
  const route = useRoute()
  const ids = { message: useId(), email: useId() }
  const [kind, setKind] = useState<FeedbackKind>('idea')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')

  const client = cloud.supabase
  if (state.status === 'unavailable' || !client) return null

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const row = feedbackRow({ kind, message, email: state.email ?? email, locale, page: route.name })
    if (!row) return
    setStatus('sending')
    try {
      await sendFeedback(client, row)
      setMessage('')
      setStatus('sent')
    } catch {
      setStatus('failed')
    }
  }

  return (
    <form className="form-stack feedback-form" onSubmit={(event) => void submit(event)}>
      <p className="secondary-text">{t('feedback.intro')}</p>
      <Segmented label={t('feedback.kind')} value={kind} options={FEEDBACK_KINDS.map((value) => ({ value, label: t(`feedback.kind.${value}`) }))} onChange={setKind} />
      <Field label={t('feedback.message')} htmlFor={ids.message}>
        <textarea
          id={ids.message}
          className="input"
          rows={3}
          maxLength={FEEDBACK_MAX_LENGTH}
          value={message}
          placeholder={t(`feedback.placeholder.${kind}`)}
          onChange={(event) => {
            setMessage(event.target.value)
            if (status !== 'sending') setStatus('idle')
          }}
        />
      </Field>
      {!state.email && (
        <Field label={t('feedback.email')} htmlFor={ids.email}>
          <input id={ids.email} className="input" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </Field>
      )}
      <Button type="submit" variant="primary" disabled={!message.trim() || status === 'sending'} icon={<Send size={16} aria-hidden="true" />}>
        {status === 'sending' ? t('feedback.sending') : t('feedback.send')}
      </Button>
      {(status === 'sent' || status === 'failed') && (
        <p className={`caption${status === 'failed' ? ' cloud-status--error' : ''}`} role="status">
          {t(status === 'sent' ? 'feedback.thanks' : 'feedback.failed')}
        </p>
      )}
    </form>
  )
}
