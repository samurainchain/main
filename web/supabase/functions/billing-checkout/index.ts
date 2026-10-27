// POST { plan: 'monthly' | 'annual', returnUrl } with the user's access token → { url } of a
// Stripe Checkout page. The annual plan starts with the free trial.

import { allowedOrigin, cors, currentUser, findSubscription, json, PRO_STATUSES, prices, saveSubscription, stripe, trialDays } from '../_shared/server.ts'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors(request) })
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

    const existing = await findSubscription(`user_id=eq.${user.id}`)
    if (existing && PRO_STATUSES.includes(existing.status)) return json(request, { error: 'already_subscribed' }, 409)

    let customer = existing?.stripe_customer_id
    if (!customer) {
      const created = await stripe<{ id: string }>('/customers', { email: user.email, 'metadata[user_id]': user.id })
      customer = created.id
      await saveSubscription({ user_id: user.id, stripe_customer_id: customer, status: 'none' })
    }

    const success = new URL(back)
    success.searchParams.set('billing', 'success')
    success.hash = '#/profile'
    const cancel = new URL(back)
    cancel.hash = '#/profile'
    const params: Record<string, string> = {
      mode: 'subscription',
      customer,
      client_reference_id: user.id,
      'line_items[0][price]': prices()[plan],
      'line_items[0][quantity]': '1',
      'subscription_data[metadata][user_id]': user.id,
      allow_promotion_codes: 'true',
      success_url: success.toString(),
      cancel_url: cancel.toString(),
    }
    if (plan === 'annual' && trialDays() > 0) params['subscription_data[trial_period_days]'] = String(trialDays())
    const session = await stripe<{ url: string }>('/checkout/sessions', params)
    return json(request, { url: session.url })
  } catch (error) {
    console.error(error)
    return json(request, { error: 'checkout_failed' }, 500)
  }
})
