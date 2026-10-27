// Stripe → POST subscription events. Verifies the signature, then writes the subscriber's
// status into billing_subscriptions, which the site reads to show Pro.
// Stripe Dashboard → Developers → Webhooks: this function's URL, events
// customer.subscription.created, customer.subscription.updated, customer.subscription.deleted.

import { env, findSubscription, prices, saveSubscription } from '../_shared/server.ts'
import { subscriptionRow, verifyStripeSignature, type StripeSubscription } from '../_shared/stripeWebhook.ts'

const EVENTS = ['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted']

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const payload = await request.text()
  const valid = await verifyStripeSignature(payload, request.headers.get('Stripe-Signature'), env('STRIPE_WEBHOOK_SECRET'), Math.floor(Date.now() / 1000))
  if (!valid) return new Response('Bad signature', { status: 400 })

  const event = JSON.parse(payload) as { type: string; created: number; data: { object: StripeSubscription } }
  if (!EVENTS.includes(event.type)) return new Response('Ignored', { status: 200 })
  try {
    const subscription = event.data.object
    const existing = subscription.metadata?.user_id
      ? await findSubscription(`user_id=eq.${subscription.metadata.user_id}`)
      : await findSubscription(`stripe_customer_id=eq.${subscription.customer}`)
    const userId = subscription.metadata?.user_id ?? existing?.user_id
    if (!userId) return new Response('Unknown customer', { status: 200 })
    // Stripe may deliver events out of order: keep the newest.
    if (existing?.event_at && Date.parse(existing.event_at) > event.created * 1000) return new Response('Stale', { status: 200 })
    await saveSubscription(subscriptionRow(userId, subscription, prices(), event.created))
    return new Response('OK', { status: 200 })
  } catch (error) {
    console.error(error)
    // A 500 makes Stripe retry later.
    return new Response('Failed', { status: 500 })
  }
})
