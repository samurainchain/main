// POST { returnUrl } with the user's access token → { url } of Stripe's customer portal, where
// the subscriber changes the card, switches plans or cancels.

import { allowedOrigin, cors, currentUser, findSubscription, json, stripe } from '../_shared/server.ts'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors(request) })
  if (request.method !== 'POST') return json(request, { error: 'method_not_allowed' }, 405)
  try {
    const user = await currentUser(request)
    if (!user) return json(request, { error: 'signed_out' }, 401)
    const { returnUrl } = (await request.json().catch(() => ({}))) as { returnUrl?: unknown }
    let back: URL
    try {
      back = new URL(String(returnUrl))
    } catch {
      return json(request, { error: 'bad_return_url' }, 400)
    }
    if (!allowedOrigin(back.origin)) return json(request, { error: 'bad_return_url' }, 400)
    const existing = await findSubscription(`user_id=eq.${user.id}`)
    if (!existing) return json(request, { error: 'no_customer' }, 404)
    back.hash = '#/profile'
    const session = await stripe<{ url: string }>('/billing_portal/sessions', { customer: existing.stripe_customer_id, return_url: back.toString() })
    return json(request, { url: session.url })
  } catch (error) {
    console.error(error)
    return json(request, { error: 'portal_failed' }, 500)
  }
})
