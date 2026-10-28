import { describe, expect, it } from 'vitest'
import { parsePrice, paymentDecision, sortedJson, verifyNowPaymentsSignature, type CryptoOrder, type NowPayment } from '../../../supabase/functions/_shared/cryptoPayments'

// The crypto webhook's pure parts, shared with the Supabase function (web/supabase/functions).

const order: CryptoOrder = { id: 'order-1', plan: 'monthly', price_amount: '8.99', price_currency: 'usd', applied_at: null }
const payment = (overrides: Partial<NowPayment> = {}): NowPayment => ({
  payment_id: 5077125051,
  payment_status: 'finished',
  order_id: 'order-1',
  price_amount: 8.99,
  price_currency: 'usd',
  ...overrides,
})

describe('paymentDecision', () => {
  it.each(['confirmed', 'sending', 'finished', 'FINISHED'])('grants Pro once the payment is %s', (status) => {
    expect(paymentDecision(order, payment({ payment_status: status }))).toEqual({ action: 'grant' })
  })

  it.each(['waiting', 'confirming', 'partially_paid', 'expired', 'failed', 'refunded'])('only records a %s payment', (status) => {
    expect(paymentDecision(order, payment({ payment_status: status }))).toEqual({ action: 'record', status })
  })

  it('never applies an order twice', () => {
    expect(paymentDecision({ ...order, applied_at: '2026-10-28T10:00:00Z' }, payment())).toEqual({ action: 'ignore', reason: 'already_applied' })
  })

  it('ignores a payment for another order', () => {
    expect(paymentDecision(order, payment({ order_id: 'order-2' }))).toEqual({ action: 'ignore', reason: 'wrong_order' })
    expect(paymentDecision(order, payment({ order_id: null }))).toEqual({ action: 'ignore', reason: 'wrong_order' })
  })

  it('ignores a cheaper price or another currency', () => {
    expect(paymentDecision(order, payment({ price_amount: 1 }))).toEqual({ action: 'ignore', reason: 'wrong_price' })
    expect(paymentDecision(order, payment({ price_currency: 'eur' }))).toEqual({ action: 'ignore', reason: 'wrong_price' })
  })

  it('compares prices in cents, whatever the number format', () => {
    expect(paymentDecision(order, payment({ price_amount: '8.990' }))).toEqual({ action: 'grant' })
    expect(paymentDecision({ ...order, price_amount: '44.99' }, payment({ price_amount: 44.99 }))).toEqual({ action: 'grant' })
  })
})

describe('parsePrice', () => {
  it('keeps a valid price and falls back otherwise', () => {
    expect(parsePrice(' 44.99 ', '1')).toBe('44.99')
    expect(parsePrice('9', '1')).toBe('9')
    expect(parsePrice(undefined, '8.99')).toBe('8.99')
    expect(parsePrice('-5', '8.99')).toBe('8.99')
    expect(parsePrice('0', '8.99')).toBe('8.99')
    expect(parsePrice('8.999', '8.99')).toBe('8.99')
  })
})

describe('NOWPayments signature', () => {
  const body = { payment_status: 'finished', payment_id: 1, fee: { depositFee: 0, currency: 'usdttrc20' }, order_id: 'order-1' }

  it('sorts keys at every level', () => {
    expect(sortedJson(body)).toBe('{"fee":{"currency":"usdttrc20","depositFee":0},"order_id":"order-1","payment_id":1,"payment_status":"finished"}')
  })

  async function sign(text: string, secret: string): Promise<string> {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign'])
    return [...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text)))].map((b) => b.toString(16).padStart(2, '0')).join('')
  }

  it('accepts the HMAC-SHA512 of the sorted body and nothing else', async () => {
    const good = await sign(sortedJson(body), 'ipn-secret')
    expect(await verifyNowPaymentsSignature(body, good, 'ipn-secret')).toBe(true)
    expect(await verifyNowPaymentsSignature(body, good.toUpperCase(), 'ipn-secret')).toBe(true)
    expect(await verifyNowPaymentsSignature({ ...body, payment_status: 'waiting' }, good, 'ipn-secret')).toBe(false)
    expect(await verifyNowPaymentsSignature(body, good, 'other-secret')).toBe(false)
    expect(await verifyNowPaymentsSignature(body, null, 'ipn-secret')).toBe(false)
    expect(await verifyNowPaymentsSignature(body, good, '')).toBe(false)
  })
})
