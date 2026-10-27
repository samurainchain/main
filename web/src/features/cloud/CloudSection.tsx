import { Cloud, CloudOff, RefreshCw } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { useCloud } from '../../app/cloud'
import { Button, Card, Field } from '../../design/components'
import { formatTime } from '../../i18n/format'
import { useI18n } from '../../i18n/i18n'

/** Email sign-in: sends a link that brings the user back signed in. */
export function SignInForm({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n()
  const { cloud, state } = useCloud()
  const id = useId()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState<string>()
  const [error, setError] = useState<string>()
  const [sending, setSending] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError(t('cloud.error.email'))
    setSending(true)
    setError(undefined)
    try {
      await cloud.signIn(email)
      setSent(email.trim())
    } catch (failure) {
      const text = failure instanceof Error ? failure.message : ''
      setError(t(/rate limit|too many/i.test(text) ? 'cloud.error.rateLimit' : 'cloud.error.send'))
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <p className="secondary-text" role="status">
        {t('cloud.linkSent', { email: sent })}
      </p>
    )
  }

  return (
    <form className={compact ? 'sign-in sign-in--compact' : 'sign-in'} onSubmit={submit} noValidate>
      {state.signInProblem && (
        <p className="import-warning" role="alert">
          {t(`cloud.signInProblem.${state.signInProblem}`)}
        </p>
      )}
      <Field label={t('cloud.email')} htmlFor={id} error={error}>
        <input id={id} className="input" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
      </Field>
      <Button type="submit" variant="primary" disabled={sending}>
        {t('cloud.sendLink')}
      </Button>
    </form>
  )
}

/** Profile section: sign in to sync, or the sync status with "Sync now" and "Sign out". */
export function CloudSection() {
  const { t, locale } = useI18n()
  const { cloud, state } = useCloud()
  if (state.status === 'unavailable') return null

  if (state.status === 'signedOut') {
    return (
      <Card className="form-stack">
        <p className="cloud-line">
          <CloudOff size={18} aria-hidden="true" />
          {t('cloud.signedOutNote')}
        </p>
        <SignInForm />
      </Card>
    )
  }

  const statusText = {
    syncing: t('cloud.status.syncing'),
    synced: state.lastSyncedAt ? t('cloud.status.synced', { time: formatTime(state.lastSyncedAt.toISOString(), locale) }) : t('cloud.status.syncing'),
    offline: t('cloud.status.offline'),
    error: t('cloud.status.error'),
  }[state.status]

  return (
    <Card className="form-stack">
      <p className="cloud-line">
        <Cloud size={18} aria-hidden="true" />
        <span>
          {t('cloud.signedInAs', { email: state.email ?? '' })}
          <span className={`caption cloud-status cloud-status--${state.status}`} role="status">
            {statusText}
          </span>
        </span>
      </p>
      <div className="action-row action-row--wrap">
        <Button icon={<RefreshCw size={18} aria-hidden="true" />} disabled={state.status === 'syncing'} onClick={() => cloud.syncNow()}>
          {t('cloud.syncNow')}
        </Button>
        <Button variant="plain" onClick={() => window.confirm(t('cloud.signOutConfirm')) && void cloud.signOut()}>
          {t('cloud.signOut')}
        </Button>
      </div>
    </Card>
  )
}
