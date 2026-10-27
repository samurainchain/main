import { describe, expect, it } from 'vitest'
import { subscriptionRow, verifyStripeSignature, type StripeSubscription } from '../../../supabase/functions/_shared/stripeWebhook'

// The webhook's pure parts, shared with the Supabase function (web/supabase/functions).

const SECRET = 'whsec_test_secret'
const NOW = 1_800_000_000

/** The v1 signature Stripe would send. */
async function signature(payload: string, timestamp: number, secret = SECRET): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`))
  return [...new Uint8Array(mac)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

describe('verifyStripeSignature', () => {
  const payload = '{"type":"customer.subscription.updated"}'

  it('accepts a fresh, correctly signed payload', async () => {
    const header = `t=${NOW},v1=${await signature(payload, NOW)}`
    expect(await verifyStripeSignature(payload, header, SECRET, NOW + 10)).toBe(true)
  })

  it('accepts any matching v1 signature when Stripe sends several', async () => {
    const header = `t=${NOW},v1=deadbeef,v1=${await signature(payload, NOW)}`
    expect(await verifyStripeSignature(payload, header, SECRET, NOW)).toBe(true)
  })

  it.each([
    ['a changed payload', async () => verifyStripeSignature(`${payload} `, `t=${NOW},v1=${await signature(payload, NOW)}`, SECRET, NOW)],
    ['another secret', async () => verifyStripeSignature(payload, `t=${NOW},v1=${await signature(payload, NOW, 'whsec_other')}`, SECRET, NOW)],
    ['an old timestamp (replay)', async () => verifyStripeSignature(payload, `t=${NOW - 600},v1=${await signature(payload, NOW - 600)}`, SECRET, NOW)],
    ['a missing header', async () => verifyStripeSignature(payload, null, SECRET, NOW)],
    ['a header without a timestamp', async () => verifyStripeSignature(payload, `v1=${await signature(payload, NOW)}`, SECRET, NOW)],
  ])('refuses %s', async (_case, check) => {
    expect(await check()).toBe(false)
  })
})

describe('subscriptionRow', () => {
  const subscription: StripeSubscription = {
    id: 'sub_1',
    customer: 'cus_1',
    status: 'trialing',
    cancel_at_period_end: false,
    trial_end: NOW + 7 * 86400,
    metadata: { user_id: 'user-1' },
    items: { data: [{ price: { id: 'price_year' }, current_period_end: NOW + 7 * 86400 }] },
  }
  const PRICES = { monthly: 'price_month', annual: 'price_year' }

  it('maps a subscription to the row the site reads', () => {
    expect(subscriptionRow('user-1', subscription, PRICES, NOW)).toEqual({
      user_id: 'user-1',
      stripe_customer_id: 'cus_1',
      stripe_subscription_id: 'sub_1',
      status: 'trialing',
      plan: 'annual',
      price_id: 'price_year',
      current_period_end: new Date((NOW + 7 * 86400) * 1000).toISOString(),
      trial_end: new Date((NOW + 7 * 86400) * 1000).toISOString(),
      cancel_at_period_end: false,
      event_at: new Date(NOW * 1000).toISOString(),
    })
  })

  it('reads the period from the subscription in older API versions', () => {
    const older = { ...subscription, current_period_end: NOW + 100, items: { data: [{ price: { id: 'price_month' } }] } }
    const row = subscriptionRow('user-1', older, PRICES, NOW)
    expect(row.plan).toBe('monthly')
    expect(row.current_period_end).toBe(new Date((NOW + 100) * 1000).toISOString())
  })
})
