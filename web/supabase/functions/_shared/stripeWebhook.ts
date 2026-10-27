// Pure helpers for the Stripe webhook: no Deno or network, so the web app's tests cover them.

const encoder = new TextEncoder()

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** Compares two strings in time that doesn't depend on where they differ. */
function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let difference = 0
  for (let index = 0; index < a.length; index++) difference |= a.charCodeAt(index) ^ b.charCodeAt(index)
  return difference === 0
}

/**
 * Checks Stripe's `Stripe-Signature` header ("t=…,v1=…"): an HMAC-SHA256 of "t.payload" with the
 * endpoint's signing secret, made within `toleranceSeconds` of now (replays are refused).
 */
export async function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
  nowSeconds: number,
  toleranceSeconds = 300,
): Promise<boolean> {
  if (!header || !secret) return false
  const pairs = header.split(',').map((part) => part.split('=') as [string, string | undefined])
  const timestamp = pairs.find(([key]) => key === 't')?.[1]
  const signatures = pairs.filter(([key, value]) => key === 'v1' && value).map(([, value]) => value!)
  if (!timestamp || !/^\d+$/.test(timestamp) || signatures.length === 0) return false
  if (Math.abs(nowSeconds - Number(timestamp)) > toleranceSeconds) return false
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const expected = hex(await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${payload}`)))
  return signatures.some((signature) => sameText(signature, expected))
}

/** The parts of a Stripe subscription object the journal keeps. */
export interface StripeSubscription {
  id: string
  customer: string
  status: string
  cancel_at_period_end: boolean
  trial_end: number | null
  /** Older API versions keep the period on the subscription, newer ones on each item. */
  current_period_end?: number
  metadata?: Record<string, string>
  items: { data: { price: { id: string }; current_period_end?: number }[] }
}

export type Plan = 'monthly' | 'annual'

/** One row of `billing_subscriptions` (see supabase/schema.sql). */
export interface SubscriptionRow {
  user_id: string
  stripe_customer_id: string
  stripe_subscription_id: string | null
  status: string
  plan: Plan | null
  price_id: string | null
  current_period_end: string | null
  trial_end: string | null
  cancel_at_period_end: boolean
  /** When Stripe created the event that wrote this row; older events don't overwrite newer ones. */
  event_at: string | null
}

const iso = (seconds: number | null | undefined) => (seconds ? new Date(seconds * 1000).toISOString() : null)

/** The row a subscription event writes for `userId`. */
export function subscriptionRow(
  userId: string,
  subscription: StripeSubscription,
  prices: { monthly?: string; annual?: string },
  eventSeconds: number,
): SubscriptionRow {
  const item = subscription.items.data[0]
  const priceId = item?.price.id ?? null
  return {
    user_id: userId,
    stripe_customer_id: subscription.customer,
    stripe_subscription_id: subscription.id,
    status: subscription.status,
    plan: priceId === prices.annual ? 'annual' : priceId === prices.monthly ? 'monthly' : null,
    price_id: priceId,
    current_period_end: iso(item?.current_period_end ?? subscription.current_period_end),
    trial_end: iso(subscription.trial_end),
    cancel_at_period_end: subscription.cancel_at_period_end,
    event_at: iso(eventSeconds),
  }
}
