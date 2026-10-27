// GET → the Pro plans' prices, read from Stripe so the site never hardcodes them.

import { cors, json, prices, stripe, trialDays } from '../_shared/server.ts'

interface StripePrice {
  id: string
  unit_amount: number | null
  currency: string
  livemode: boolean
  recurring: { interval: string; interval_count: number } | null
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors(request) })
  try {
    const ids = prices()
    const [monthly, annual] = await Promise.all([ids.monthly, ids.annual].map((id) => stripe<StripePrice>(`/prices/${id}`, undefined, 'GET')))
    const plan = (price: StripePrice, trial: number) => ({
      id: price.id,
      amount: price.unit_amount,
      currency: price.currency,
      interval: price.recurring?.interval ?? null,
      trialDays: trial,
    })
    return json(
      request,
      { livemode: annual!.livemode, monthly: plan(monthly!, 0), annual: plan(annual!, trialDays()) },
      200,
      { 'Cache-Control': 'public, max-age=300' },
    )
  } catch (error) {
    console.error(error)
    return json(request, { error: 'prices_unavailable' }, 503)
  }
})
