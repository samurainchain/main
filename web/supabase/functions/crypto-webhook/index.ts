// NOWPayments calls this (IPN) whenever a payment's status changes. The body is only a hint: the
// payment is read back from NOWPayments' API with our key, and Pro is granted from that answer.
// The signature check only flags calls that didn't come from NOWPayments.

import { paymentDecision, verifyNowPaymentsSignature, type CryptoOrder, type NowPayment } from '../_shared/cryptoPayments.ts'
import { nowPayments, rest } from '../_shared/server.ts'

const ok = (text = 'ok') => new Response(text, { status: 200 })

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('method_not_allowed', { status: 405 })
  try {
    const body = (await request.json().catch(() => undefined)) as { payment_id?: unknown } | undefined
    const paymentId = body?.payment_id
    if (typeof paymentId !== 'number' && !(typeof paymentId === 'string' && /^\d+$/.test(paymentId))) return new Response('bad_request', { status: 400 })
    const signed = await verifyNowPaymentsSignature(body, request.headers.get('x-nowpayments-sig'), Deno.env.get('NOWPAYMENTS_IPN_SECRET') ?? '')
    if (!signed) console.warn(`Unsigned or mis-signed IPN for payment ${paymentId}; checking it with the API`)

    const payment = await nowPayments<NowPayment>(`/payment/${paymentId}`)
    if (!payment.order_id || !/^[0-9a-f-]{36}$/i.test(payment.order_id)) return ok('no_order')
    const [order] = await rest<CryptoOrder[]>(`crypto_orders?id=eq.${payment.order_id}&select=id,plan,price_amount,price_currency,applied_at`)
    if (!order) return ok('unknown_order')

    const decision = paymentDecision(order, payment)
    if (decision.action === 'grant') {
      // Atomic and idempotent: a repeated notification finds the order already applied.
      const until = await rest<string | null>('rpc/apply_crypto_order', { method: 'POST', body: { p_order: order.id, p_payment: String(payment.payment_id) } })
      console.log(`Order ${order.id}: Pro until ${until ?? '(already applied)'}`)
    } else if (decision.action === 'record') {
      await rest(`crypto_orders?id=eq.${order.id}&applied_at=is.null`, {
        method: 'PATCH',
        body: { status: decision.status, payment_id: String(payment.payment_id), updated_at: new Date().toISOString() },
      })
    } else {
      console.warn(`Order ${order.id}: payment ${payment.payment_id} ignored (${decision.reason})`)
    }
    return ok()
  } catch (error) {
    console.error(error)
    // 500 makes NOWPayments retry later.
    return new Response('error', { status: 500 })
  }
})
