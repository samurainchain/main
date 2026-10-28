import type { SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './cloudConfig'

// Pro subscription through Stripe (SPEC section 8, web). Prices and checkout go through the
// billing functions in web/supabase/functions; the subscription status is a row the Stripe
// webhook writes and the signed-in user can read. Nothing here limits features yet: the web app
// is free for now.

/**
 * Whether Profile shows Tiltless Pro (plans, checkout, the subscription). Off while the web app
 * is free; the checkout, portal and webhook were tested end to end in Stripe test mode. Turn on
 * together with Stripe live keys and the Terms, Privacy and Refund pages.
 */
export const PRO_ON_SALE = false

/**
 * Shows Pro before it is on sale, for the owner to test payments on the live site: open the site
 * with ?pro=preview once, and this browser tab keeps showing it.
 */
export function proPreview(): boolean {
  try {
    // Works before or after the hash route: ?pro=preview#/profile or #/profile?pro=preview.
    if (/[?&]pro=preview\b/.test(window.location.search + window.location.hash)) sessionStorage.setItem('mirror.proPreview', '1')
    return sessionStorage.getItem('mirror.proPreview') === '1'
  } catch {
    return false
  }
}

/**
 * How Pro is sold when it is on sale: Stripe subscriptions, or one-time crypto payments through
 * NOWPayments (a month or a year of Pro; crypto can't renew on its own). Stripe waits for a seller
 * status it supports (CLAUDE.md, "Monetization").
 */
export type PaymentProvider = 'stripe' | 'crypto'
export const PAYMENT_PROVIDER: PaymentProvider = 'crypto'

export type Plan = 'monthly' | 'annual'

export interface PlanPrice {
  id: string
  /** In the smallest unit, e.g. cents. */
  amount: number | null
  currency: string
  interval: string | null
  trialDays: number
}

export interface BillingPrices {
  /** False while Stripe is in test mode. */
  livemode: boolean
  monthly: PlanPrice
  annual: PlanPrice
}

export interface Subscription {
  status: string
  plan: Plan | null
  currentPeriodEnd?: Date
  trialEnd?: Date
  cancelAtPeriodEnd: boolean
}

/** Paid, in the trial, or a renewal payment being retried. */
export function hasPro(subscription: Subscription | undefined): boolean {
  return subscription !== undefined && ['active', 'trialing', 'past_due'].includes(subscription.status)
}

const FUNCTIONS = `${SUPABASE_URL}/functions/v1`

export async function fetchPrices(): Promise<BillingPrices> {
  const response = await fetch(`${FUNCTIONS}/billing-prices`, { headers: { apikey: SUPABASE_ANON_KEY } })
  if (!response.ok) throw new Error(`Prices unavailable: ${response.status}`)
  return (await response.json()) as BillingPrices
}

interface SubscriptionRecord {
  status: string
  plan: Plan | null
  current_period_end: string | null
  trial_end: string | null
  cancel_at_period_end: boolean
}

/** The signed-in user's subscription, or undefined when they never subscribed. */
export async function fetchSubscription(client: SupabaseClient): Promise<Subscription | undefined> {
  const { data, error } = await client.from('billing_subscriptions').select('status, plan, current_period_end, trial_end, cancel_at_period_end').maybeSingle<SubscriptionRecord>()
  if (error) throw error
  if (!data || data.status === 'none') return undefined
  return {
    status: data.status,
    plan: data.plan,
    currentPeriodEnd: data.current_period_end ? new Date(data.current_period_end) : undefined,
    trialEnd: data.trial_end ? new Date(data.trial_end) : undefined,
    cancelAtPeriodEnd: data.cancel_at_period_end,
  }
}

/** The page to come back to after Stripe: this site, without the hash route. */
function returnUrl(): string {
  const url = new URL(window.location.href)
  url.hash = ''
  url.search = ''
  return url.toString()
}

/** Asks a billing function for a Stripe page (checkout or customer portal) and goes there. */
async function redirect(client: SupabaseClient, name: 'billing-checkout' | 'billing-portal' | 'crypto-invoice', body: Record<string, unknown>): Promise<void> {
  const { data, error } = await client.functions.invoke<{ url?: string }>(name, { body: { ...body, returnUrl: returnUrl() } })
  if (error || !data?.url) throw error ?? new Error('No payment page returned')
  window.location.assign(data.url)
}

export function startCheckout(client: SupabaseClient, plan: Plan): Promise<void> {
  return redirect(client, 'billing-checkout', { plan })
}

export function openPortal(client: SupabaseClient): Promise<void> {
  return redirect(client, 'billing-portal', {})
}

/** Whether the page was opened by the payment page after a payment ('success' for Stripe, 'crypto' for NOWPayments); removes the marker. */
export function takeCheckoutResult(marker: 'success' | 'crypto' = 'success'): boolean {
  const url = new URL(window.location.href)
  if (url.searchParams.get('billing') !== marker) return false
  url.searchParams.delete('billing')
  window.history.replaceState(null, '', url.toString())
  return true
}

/** The prices crypto-invoice charges when no secret overrides them; for copy shown before prices load. */
export const DEFAULT_CRYPTO_PRICES = { monthly: '12.99', annual: '44.99' } as const

export interface CryptoPrices {
  currency: string
  /** USD amounts as decimal strings, e.g. "12.99". */
  monthly: string
  annual: string
  /** NOWPayments' sandbox: no real coins. */
  sandbox: boolean
}

export async function fetchCryptoPrices(): Promise<CryptoPrices> {
  const response = await fetch(`${FUNCTIONS}/crypto-invoice`, { headers: { apikey: SUPABASE_ANON_KEY } })
  if (!response.ok) throw new Error(`Prices unavailable: ${response.status}`)
  return (await response.json()) as CryptoPrices
}

/** Until when the signed-in user's Pro pass lasts, or undefined when they never bought one. */
export async function fetchProUntil(client: SupabaseClient): Promise<Date | undefined> {
  const { data, error } = await client.from('pro_access').select('pro_until').maybeSingle<{ pro_until: string }>()
  if (error) throw error
  return data ? new Date(data.pro_until) : undefined
}

/** Opens a NOWPayments invoice for a month or a year of Pro. */
export function startCryptoCheckout(client: SupabaseClient, plan: Plan): Promise<void> {
  return redirect(client, 'crypto-invoice', { plan })
}
