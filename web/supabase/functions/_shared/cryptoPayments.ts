// Pure helpers for crypto payments through NOWPayments: no Deno or network, so the web app's
// tests cover them. Pro is a pass (a month or a year) bought with a one-time payment; crypto
// can't renew on its own.

export type CryptoPlan = 'monthly' | 'annual'

/** Our side of a purchase: one row in crypto_orders. */
export interface CryptoOrder {
  id: string
  plan: CryptoPlan
  /** Price in USD as a decimal string, e.g. "8.99". */
  price_amount: string
  price_currency: string
  applied_at: string | null
}

/** The parts of NOWPayments' GET /v1/payment/{id} answer the decision needs. */
export interface NowPayment {
  payment_id: number | string
  payment_status: string
  order_id: string | null
  price_amount: number | string
  price_currency: string
}

/** Statuses after which the payer's coins are confirmed on the chain. */
export const PAID_STATUSES = ['confirmed', 'sending', 'finished']
/** Statuses that end a payment without Pro. */
export const FAILED_STATUSES = ['failed', 'expired', 'refunded']

export type PaymentDecision =
  | { action: 'grant' }
  | { action: 'record'; status: string }
  | { action: 'ignore'; reason: 'already_applied' | 'wrong_order' | 'wrong_price' }

const cents = (amount: number | string) => Math.round(Number(amount) * 100)

/**
 * What to do with a payment NOWPayments reports for an order. Only the payment as read back from
 * NOWPayments' API with our key is passed in, never the webhook body, so a forged notification
 * can at most make us look a payment up.
 */
export function paymentDecision(order: CryptoOrder, payment: NowPayment): PaymentDecision {
  if (payment.order_id !== order.id) return { action: 'ignore', reason: 'wrong_order' }
  if (order.applied_at) return { action: 'ignore', reason: 'already_applied' }
  const status = payment.payment_status.toLowerCase()
  if (!PAID_STATUSES.includes(status)) return { action: 'record', status }
  const samePrice =
    payment.price_currency.toLowerCase() === order.price_currency.toLowerCase() && cents(payment.price_amount) >= cents(order.price_amount)
  return samePrice ? { action: 'grant' } : { action: 'ignore', reason: 'wrong_price' }
}

/** A price setting such as "8.99": a positive amount with at most two decimals. */
export function parsePrice(value: string | undefined, fallback: string): string {
  const text = (value ?? '').trim()
  return /^\d+(\.\d{1,2})?$/.test(text) && Number(text) > 0 ? text : fallback
}

/** JSON with every object's keys sorted, recursively, as NOWPayments signs it. */
export function sortedJson(value: unknown): string {
  const sort = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(sort)
    if (item && typeof item === 'object') {
      return Object.fromEntries(
        Object.keys(item as Record<string, unknown>)
          .sort()
          .map((key) => [key, sort((item as Record<string, unknown>)[key])]),
      )
    }
    return item
  }
  return JSON.stringify(sort(value))
}

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Checks the `x-nowpayments-sig` header: an HMAC-SHA512 of the sorted JSON body with the IPN
 * secret. The webhook only uses it to log suspicious calls; the decision comes from the API.
 */
export async function verifyNowPaymentsSignature(body: unknown, header: string | null, secret: string): Promise<boolean> {
  if (!header || !secret) return false
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign'])
  const expected = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(sortedJson(body))))
  const given = header.trim().toLowerCase()
  if (given.length !== expected.length) return false
  let difference = 0
  for (let index = 0; index < given.length; index++) difference |= given.charCodeAt(index) ^ expected.charCodeAt(index)
  return difference === 0
}
