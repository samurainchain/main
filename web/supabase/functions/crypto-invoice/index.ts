// GET → the Pro passes' prices in USD. POST { plan: 'monthly' | 'annual', returnUrl } with the
// user's access token → { url } of a NOWPayments invoice page, where the user picks a coin.

import { parsePrice, type CryptoPlan } from '../_shared/cryptoPayments.ts'
import { allowedOrigin, cors, currentUser, env, json, nowPayments, rest } from '../_shared/server.ts'

function prices(): Record<CryptoPlan, string> {
  return {
    monthly: parsePrice(Deno.env.get('CRYPTO_PRICE_MONTHLY'), '12.99'),
    annual: parsePrice(Deno.env.get('CRYPTO_PRICE_ANNUAL'), '44.99'),
  }
}

const DESCRIPTION: Record<CryptoPlan, string> = { monthly: 'Tiltless Pro, 1 month', annual: 'Tiltless Pro, 1 year' }

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors(request) })
  if (request.method === 'GET') {
    const { monthly, annual } = prices()
    return json(request, { currency: 'usd', monthly, annual, sandbox: Deno.env.get('NOWPAYMENTS_SANDBOX') === 'true' }, 200, { 'Cache-Control': 'public, max-age=300' })
  }
  if (request.method !== 'POST') return json(request, { error: 'method_not_allowed' }, 405)
  try {
    const user = await currentUser(request)
    if (!user) return json(request, { error: 'signed_out' }, 401)
    const { plan, returnUrl } = (await request.json().catch(() => ({}))) as { plan?: unknown; returnUrl?: unknown }
    if (plan !== 'monthly' && plan !== 'annual') return json(request, { error: 'bad_plan' }, 400)
    let back: URL
    try {
      back = new URL(String(returnUrl))
    } catch {
      return json(request, { error: 'bad_return_url' }, 400)
    }
    if (!allowedOrigin(back.origin)) return json(request, { error: 'bad_return_url' }, 400)

    const price = prices()[plan]
    const [order] = await rest<{ id: string }[]>('crypto_orders', {
      method: 'POST',
      body: { user_id: user.id, plan, price_amount: price, price_currency: 'usd' },
      prefer: 'return=representation',
    })
    const success = new URL(back)
    success.searchParams.set('billing', 'crypto')
    success.hash = '#/profile'
    const cancel = new URL(back)
    cancel.hash = '#/profile'
    const invoice = await nowPayments<{ id: string | number; invoice_url: string }>('/invoice', {
      price_amount: Number(price),
      price_currency: 'usd',
      order_id: order!.id,
      order_description: DESCRIPTION[plan],
      ipn_callback_url: `${env('SUPABASE_URL')}/functions/v1/crypto-webhook`,
      success_url: success.toString(),
      cancel_url: cancel.toString(),
      is_fixed_rate: true,
      is_fee_paid_by_user: false,
    })
    await rest(`crypto_orders?id=eq.${order!.id}`, { method: 'PATCH', body: { invoice_id: String(invoice.id), status: 'invoiced', updated_at: new Date().toISOString() } })
    return json(request, { url: invoice.invoice_url })
  } catch (error) {
    console.error(error)
    return json(request, { error: 'invoice_failed' }, 500)
  }
})
