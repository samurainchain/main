import { useEffect, useState } from 'react'
import { fetchPrices, fetchSubscription, hasPro, openPortal, startCheckout, takeCheckoutResult, type BillingPrices, type Plan, type Subscription } from '../../app/billing'
import { useCloud } from '../../app/cloud'
import { Button, Card, SectionHeader } from '../../design/components'
import { formatDate, formatPrice } from '../../i18n/format'
import { useI18n } from '../../i18n/i18n'

/** How long to wait for Stripe's webhook after a payment before giving up on showing Pro. */
const CONFIRM_TRIES = 10
const CONFIRM_INTERVAL_MS = 2000

/**
 * Tiltless Pro in Profile (SPEC section 8, web): plans with prices from Stripe, checkout, and
 * the subscription's status with a link to manage it. The amount billed is the most prominent
 * price; the trial belongs to the annual plan and states what is charged after it.
 */
export function ProSection() {
  const { t, locale } = useI18n()
  const { cloud, state } = useCloud()
  const signedIn = Boolean(state.email)
  const [prices, setPrices] = useState<BillingPrices>()
  const [pricesFailed, setPricesFailed] = useState(false)
  const [subscription, setSubscription] = useState<Subscription>()
  const [plan, setPlan] = useState<Plan>('annual')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string>()

  useEffect(() => {
    fetchPrices().then(setPrices, () => setPricesFailed(true))
  }, [])

  useEffect(() => {
    const client = cloud.supabase
    if (!signedIn || !client) {
      setSubscription(undefined)
      return
    }
    let cancelled = false
    const justPaid = takeCheckoutResult()
    if (justPaid) setMessage(t('pro.success'))
    // After a payment the webhook may land a few seconds later: check again until Pro shows.
    const load = async (tries: number) => {
      const current = await fetchSubscription(client).catch(() => undefined)
      if (cancelled) return
      setSubscription(current)
      if (justPaid && !hasPro(current) && tries > 1) setTimeout(() => void load(tries - 1), CONFIRM_INTERVAL_MS)
    }
    void load(justPaid ? CONFIRM_TRIES : 1)
    return () => {
      cancelled = true
    }
  }, [cloud, signedIn, t])

  if (state.status === 'unavailable') return null

  const go = async (action: () => Promise<void>) => {
    setBusy(true)
    setMessage(undefined)
    try {
      await action()
    } catch {
      setMessage(t('pro.failed'))
      setBusy(false)
    }
  }

  const client = cloud.supabase
  const active = hasPro(subscription)
  const annual = prices?.annual
  const monthly = prices?.monthly
  const price = (item: typeof annual) => (item?.amount != null ? formatPrice(item.amount, item.currency, locale) : '')

  return (
    <>
      <SectionHeader title={t('pro.section')} />
      <Card className="form-stack">
        {prices && !prices.livemode && <p className="pro-test-mode caption">{t('pro.testMode')}</p>}

        {active && subscription ? (
          <>
            <p className="pro-status">
              <strong>{t('pro.active')}</strong>
              {subscription.plan && <span className="secondary-text"> · {t(`pro.plan.${subscription.plan}`)}</span>}
            </p>
            <p className="secondary-text">
              {subscription.status === 'past_due'
                ? t('pro.pastDue')
                : subscription.status === 'trialing' && subscription.trialEnd
                  ? t('pro.trialUntil', { date: formatDate(subscription.trialEnd, locale) })
                  : subscription.currentPeriodEnd
                    ? t(subscription.cancelAtPeriodEnd ? 'pro.endsOn' : 'pro.renews', { date: formatDate(subscription.currentPeriodEnd, locale) })
                    : ''}
            </p>
            {client && (
              <Button disabled={busy} onClick={() => void go(() => openPortal(client))}>
                {busy ? t('pro.opening') : t('pro.manage')}
              </Button>
            )}
          </>
        ) : (
          <>
            <p className="secondary-text">{t('pro.freeNow')}</p>
            {pricesFailed && <p className="caption">{t('pro.unavailable')}</p>}
            {annual && monthly && (
              <>
                <div className="plan-list" role="radiogroup" aria-label={t('pro.choosePlan')}>
                  <button type="button" role="radio" aria-checked={plan === 'annual'} className="plan-card" onClick={() => setPlan('annual')}>
                    <span className="plan-card__name">{t('pro.plan.annual')}</span>
                    <span className="plan-card__price">{t('pro.perYear', { price: price(annual) })}</span>
                    {annual.trialDays > 0 && annual.amount != null && (
                      <span className="caption">
                        {t('pro.trialLine', {
                          days: String(annual.trialDays),
                          price: price(annual),
                          weekly: formatPrice(Math.round(annual.amount / 52), annual.currency, locale),
                        })}
                      </span>
                    )}
                  </button>
                  <button type="button" role="radio" aria-checked={plan === 'monthly'} className="plan-card" onClick={() => setPlan('monthly')}>
                    <span className="plan-card__name">{t('pro.plan.monthly')}</span>
                    <span className="plan-card__price">{t('pro.perMonth', { price: price(monthly) })}</span>
                  </button>
                </div>
                <Button variant="primary" disabled={!signedIn || !client || busy} onClick={() => client && void go(() => startCheckout(client, plan))}>
                  {busy
                    ? t('pro.opening')
                    : plan === 'annual' && annual.trialDays > 0
                      ? t('pro.startTrial', { days: String(annual.trialDays) })
                      : t('pro.continue')}
                </Button>
                {!signedIn && <p className="caption">{t('pro.signInFirst')}</p>}
                <p className="caption">{t('pro.autoRenew')}</p>
              </>
            )}
          </>
        )}
        {message && (
          <p className="caption" role="status">
            {message}
          </p>
        )}
      </Card>
    </>
  )
}
