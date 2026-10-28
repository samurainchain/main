// Shared plumbing for the billing functions (Supabase Edge Functions, Deno). Talks to Stripe
// and to the database over plain HTTPS, so the functions need no libraries.
//
// Secrets (Supabase Dashboard → Edge Functions → Secrets): STRIPE_SECRET_KEY,
// STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_MONTHLY, STRIPE_PRICE_ANNUAL; optional STRIPE_TRIAL_DAYS
// (7) and SITE_ORIGINS (comma-separated). SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are
// provided by Supabase.

import type { SubscriptionRow } from './stripeWebhook.ts'

export function env(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing secret ${name}`)
  return value
}

const ORIGINS = (Deno.env.get('SITE_ORIGINS') ?? 'https://tiltless.xyz,https://www.tiltless.xyz,https://samurainchain.github.io,http://localhost:4173,http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())

export function allowedOrigin(origin: string | null): boolean {
  return origin !== null && ORIGINS.includes(origin)
}

/** CORS headers for the site's own origins. */
export function cors(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin')
  return {
    'Access-Control-Allow-Origin': allowedOrigin(origin) ? origin! : ORIGINS[0]!,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    Vary: 'Origin',
  }
}

export function json(request: Request, body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(request), 'Content-Type': 'application/json', ...extra } })
}

/** Calls the Stripe API; parameters are form-encoded, with nested keys written "a[b]". */
export async function stripe<T = Record<string, unknown>>(path: string, params?: Record<string, string>, method: 'GET' | 'POST' = 'POST'): Promise<T> {
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${env('STRIPE_SECRET_KEY')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: method === 'POST' && params ? new URLSearchParams(params) : undefined,
  })
  const body = await response.json()
  if (!response.ok) throw new Error(`Stripe ${path}: ${body?.error?.message ?? response.status}`)
  return body as T
}

const serviceHeaders = () => ({ apikey: env('SUPABASE_SERVICE_ROLE_KEY'), Authorization: `Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}` })

/** The signed-in user who sent the request, from their access token. */
export async function currentUser(request: Request): Promise<{ id: string; email: string } | undefined> {
  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return undefined
  const response = await fetch(`${env('SUPABASE_URL')}/auth/v1/user`, { headers: { apikey: env('SUPABASE_SERVICE_ROLE_KEY'), Authorization: authorization } })
  if (!response.ok) return undefined
  const user = await response.json()
  return user?.id ? { id: user.id, email: user.email ?? '' } : undefined
}

/** The subscription row matching a filter such as `user_id=eq.…`. */
export async function findSubscription(filter: string): Promise<SubscriptionRow | undefined> {
  const response = await fetch(`${env('SUPABASE_URL')}/rest/v1/billing_subscriptions?${filter}&select=*`, { headers: serviceHeaders() })
  if (!response.ok) throw new Error(`Reading subscription: ${response.status}`)
  const rows = (await response.json()) as SubscriptionRow[]
  return rows[0]
}

/** Writes a subscription row (insert, or update the user's row). */
export async function saveSubscription(row: Partial<SubscriptionRow> & { user_id: string }): Promise<void> {
  const response = await fetch(`${env('SUPABASE_URL')}/rest/v1/billing_subscriptions?on_conflict=user_id`, {
    method: 'POST',
    headers: { ...serviceHeaders(), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ ...row, updated_at: new Date().toISOString() }),
  })
  if (!response.ok) throw new Error(`Saving subscription: ${response.status} ${await response.text()}`)
}

export function prices(): { monthly: string; annual: string } {
  return { monthly: env('STRIPE_PRICE_MONTHLY'), annual: env('STRIPE_PRICE_ANNUAL') }
}

export function trialDays(): number {
  return Number(Deno.env.get('STRIPE_TRIAL_DAYS') ?? 7)
}

/** Statuses that give Pro: paid, in the trial, or a renewal payment being retried. */
export const PRO_STATUSES = ['active', 'trialing', 'past_due']

// Crypto payments through NOWPayments. Secrets: NOWPAYMENTS_API_KEY, NOWPAYMENTS_IPN_SECRET;
// optional CRYPTO_PRICE_MONTHLY (15.00; NOWPayments refused $8.99 and $12.99 as below its minimum), CRYPTO_PRICE_ANNUAL (44.99) in USD and
// NOWPAYMENTS_SANDBOX=true to use NOWPayments' sandbox.

/** Calls the NOWPayments API with our key. */
export async function nowPayments<T = Record<string, unknown>>(path: string, body?: Record<string, unknown>): Promise<T> {
  const base = Deno.env.get('NOWPAYMENTS_SANDBOX') === 'true' ? 'https://api-sandbox.nowpayments.io/v1' : 'https://api.nowpayments.io/v1'
  const response = await fetch(`${base}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'x-api-key': env('NOWPAYMENTS_API_KEY'), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const answer = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`NOWPayments ${path}: ${answer?.message ?? response.status}`)
  return answer as T
}

/** A request to the database's REST API with the service role. */
export async function rest<T = unknown>(path: string, init: { method?: string; body?: unknown; prefer?: string } = {}): Promise<T> {
  const response = await fetch(`${env('SUPABASE_URL')}/rest/v1/${path}`, {
    method: init.method ?? 'GET',
    headers: { ...serviceHeaders(), 'Content-Type': 'application/json', ...(init.prefer ? { Prefer: init.prefer } : {}) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
  if (!response.ok) throw new Error(`Database ${path}: ${response.status} ${await response.text()}`)
  const text = await response.text()
  return (text ? JSON.parse(text) : undefined) as T
}
