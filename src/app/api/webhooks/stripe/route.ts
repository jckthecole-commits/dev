import type Stripe from 'stripe'
import { markOrderPaid, markOrderPaymentFailed } from '@/server/orders'
import { stripeClient } from '@/server/payments'

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret || !process.env.STRIPE_SECRET_KEY) return new Response('Stripe not configured', { status: 503 })
  const raw = await req.text()
  let event: Stripe.Event
  try {
    event = stripeClient().webhooks.constructEvent(raw, req.headers.get('stripe-signature') ?? '', secret)
  } catch {
    return new Response('Invalid signature', { status: 400 })
  }
  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const s = event.data.object as Stripe.Checkout.Session
    if (s.payment_status === 'paid' && s.metadata?.orderNumber) await markOrderPaid(s.metadata.orderNumber, s.id, 'stripe')
  } else if (event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed') {
    const s = event.data.object as Stripe.Checkout.Session
    if (s.metadata?.orderNumber) await markOrderPaymentFailed(s.metadata.orderNumber, event.type)
  }
  return Response.json({ received: true })
}
