import { NextResponse, type NextRequest } from 'next/server'
import { stripe } from '@/lib/stripe'
import { upsertSubscription } from '@/lib/subscription'
import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import type Stripe from 'stripe'

const log = logger.withTenant('api/stripe/webhook')

// ── Stripe event deduplication ──────────────────────────────────────────────
// Prevents duplicate processing when Stripe retries webhook delivery
async function isEventProcessed(eventId: string): Promise<boolean> {
  try {
    const { data } = await supabaseAdmin
      .from('stripe_webhook_events')
      .select('event_id')
      .eq('event_id', eventId)
      .maybeSingle()
    return !!data
  } catch {
    // Table may not exist yet — treat as not processed
    return false
  }
}

async function markEventProcessed(eventId: string, eventType: string): Promise<void> {
  try {
    await supabaseAdmin.from('stripe_webhook_events').upsert({
      event_id: eventId,
      event_type: eventType,
      processed_at: new Date().toISOString(),
    })
  } catch {
    // Non-critical — log but don't fail
    log.warn('Failed to mark event as processed', { eventId })
  }
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    log.error('Signature verification failed', { sig: sig?.substring(0, 20) }, err as Error)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // ── Idempotence : skip already-processed events ──
  if (await isEventProcessed(event.id)) {
    log.info('Duplicate event skipped', { eventId: event.id, eventType: event.type })
    return NextResponse.json({ received: true, deduplicated: true })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.userId
        const planId = session.metadata?.planId
        if (userId && planId && session.subscription) {
          await upsertSubscription(userId, {
            plan_id: planId,
            status: 'active',
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: session.subscription as string,
            cancel_at_period_end: false,
          })
          log.info('Checkout completed', { userId: userId.substring(0, 8), planId })
        }
        break
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription & { current_period_end: number }
        const userId = sub.metadata?.userId
        if (userId) {
          await upsertSubscription(userId, {
            plan_id: sub.metadata?.planId || 'artisan_pro',
            status: sub.status === 'active' ? 'active' : sub.status === 'past_due' ? 'past_due' : 'canceled',
            stripe_subscription_id: sub.id,
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            cancel_at_period_end: sub.cancel_at_period_end,
          })
        }
        break
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const userId = sub.metadata?.userId
        if (userId) {
          await upsertSubscription(userId, {
            plan_id: 'artisan_starter',
            status: 'canceled',
            stripe_subscription_id: sub.id,
            cancel_at_period_end: false,
          })
        }
        break
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice & { subscription: string | null }
        const subId = invoice.subscription as string
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId)
          const userId = sub.metadata?.userId
          if (userId) {
            await upsertSubscription(userId, {
              plan_id: sub.metadata?.planId || 'artisan_pro',
              status: 'past_due',
            })
          }
        }
        break
      }
    }

    // Mark event as processed for deduplication
    await markEventProcessed(event.id, event.type)

    return NextResponse.json({ received: true })
  } catch (error) {
    log.error('Webhook processing failed', { eventType: event.type, eventId: event.id }, error as Error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
