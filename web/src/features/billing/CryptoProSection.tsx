import Big from 'big.js'
import { useEffect, useState } from 'react'
import { fetchCryptoPrices, fetchProUntil, startCryptoCheckout, takeCheckoutResult, type CryptoPrices, type Plan } from '../../app/billing'
import { useCloud } from '../../app/cloud'
import { Button, Card, SectionHeader } from '../../design/components'
import { formatDate, formatPrice } from '../../i18n/format'
import { useI18n } from '../../i18n/i18n'

/** How long to keep checking for Pro after a crypto payment: the chain needs confirmations. */
const CONFIRM_TRIES = 60
const CONFIRM_INTERVAL_MS = 10_000

/**
 * Tiltless Pro paid in crypto (SPEC section 8, web): a month or a year of Pro for a one-time
 * payment on a NOWPayments invoice, where the user picks the coin. Paying again while Pro runs
 * adds the time on top. The amount charged is the most prominent price.
 */
export function CryptoProSection() {
  const { t, locale } = useI18n()
  const { cloud, state } = useCloud()
  const signedIn = Boolean(state.email)
  const [prices, setPrices] = useState<CryptoPrices>()
  const [pricesFailed, setPricesFailed] = useState(false)
  const [proUntil, setProUntil] = useState<Date>()
  const [plan, setPlan] = useState<Plan>('annual')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string>()

  useEffect(() => {
    fetchCryptoPrices().then(setPrices, () => setPricesFailed(true))
  }, [])

  useEffect(() => {
    const client = cloud.supabase
    if (!signedIn || !client) {
      setProUntil(undefined)
      return
    }
    let cancelled = false
    const justPaid = takeCheckoutResult('crypto')
    if (justPaid) setMessage(t('pro.crypto.pending'))
    const before = Date.now()
    // After paying, the webhook extends Pro once the network confirms: keep checking until it moves.
    const load = async (tries: number) => {
      const until = await fetchProUntil(client).catch(() => undefined)
      if (cancelled) return
      setProUntil(until)
      const extended = until !== undefined && until.getTime() > before
      if (justPaid && extended) setMessage(t('pro.success'))
      else if (justPaid && tries > 1) setTimeout(() => void load(tries - 1), CONFIRM_INTERVAL_MS)
    }
    void load(justPaid ? CONFIRM_TRIES : 1)
    return () => {
      cancelled = true
    }
  }, [cloud, signedIn, t])

  if (state.status === 'unavailable') return null

  const client = cloud.supabase
  const active = proUntil !== undefined && proUntil.getTime() > Date.now()
  const price = (amount: string) => formatPrice(new Big(amount).times(100).toNumber(), prices?.currency ?? 'usd', locale)

  const pay = async () => {
    if (!client) return
    setBusy(true)
    setMessage(undefined)
    try {
      await startCryptoCheckout(client, plan)
    } catch {
      setMessage(t('pro.failed'))
      setBusy(false)
    }
  }

  return (
    <>
      <SectionHeader title={t('pro.section')} />
      <Card className="form-stack">
        {prices?.sandbox && <p className="pro-test-mode caption">{t('pro.crypto.sandbox')}</p>}
        {active && proUntil ? (
          <p className="pro-status">
            <strong>{t('pro.active')}</strong>
            <span className="secondary-text"> · {t('pro.crypto.until', { date: formatDate(proUntil, locale) })}</span>
          </p>
        ) : (
          <p className="secondary-text">{t('pro.freeNow')}</p>
        )}
        {pricesFailed && <p className="caption">{t('pro.unavailable')}</p>}
        {prices && (
          <>
            <div className="plan-list" role="radiogroup" aria-label={t('pro.choosePlan')}>
              <button type="button" role="radio" aria-checked={plan === 'annual'} className="plan-card" onClick={() => setPlan('annual')}>
                <span className="plan-card__name">{t('pro.plan.annual')}</span>
                <span className="plan-card__price">{t('pro.crypto.forYear', { price: price(prices.annual) })}</span>
              </button>
              <button type="button" role="radio" aria-checked={plan === 'monthly'} className="plan-card" onClick={() => setPlan('monthly')}>
                <span className="plan-card__name">{t('pro.plan.monthly')}</span>
                <span className="plan-card__price">{t('pro.crypto.forMonth', { price: price(prices.monthly) })}</span>
              </button>
            </div>
            <Button variant="primary" disabled={!signedIn || !client || busy} onClick={() => void pay()}>
              {busy ? t('pro.opening') : t(active ? 'pro.crypto.extend' : 'pro.crypto.pay')}
            </Button>
            {!signedIn && <p className="caption">{t('pro.signInFirst')}</p>}
            <p className="caption">{t('pro.crypto.note')}</p>
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
