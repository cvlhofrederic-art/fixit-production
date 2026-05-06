import { NextResponse, type NextRequest } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getStripe } from '@/lib/stripe'
import { upsertSubscription, getUserSubscription } from '@/lib/subscription'
import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import { computeRiskScore, RISK_THRESHOLD_BLOCK, RISK_THRESHOLD_REVIEW } from '@/lib/referral'
import { captureServer } from '@/lib/posthog/server'
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

interface SubscriptionEventInput {
  eventId: string
  eventType: string
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  payload: Record<string, unknown>
}

/**
 * Persist a Stripe lifecycle event for revenue analytics. Defensive: if the
 * subscription_events table is not yet provisioned (migration 100 not run),
 * log a warning and continue — we never want to fail a webhook because the
 * analytics surface is absent.
 */
async function recordSubscriptionEvent(input: SubscriptionEventInput): Promise<void> {
  try {
    await supabaseAdmin.from('subscription_events').insert({
      stripe_event_id: input.eventId,
      event_type: input.eventType,
      stripe_customer_id: input.stripeCustomerId,
      stripe_subscription_id: input.stripeSubscriptionId,
      payload: input.payload,
      occurred_at: new Date().toISOString(),
    })
  } catch (err) {
    log.warn('Failed to record subscription event (table may be absent)', {
      eventId: input.eventId,
      eventType: input.eventType,
      error: (err as Error).message,
    })
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

          void captureServer({
            event: 'checkout_completed',
            distinctId: userId,
            properties: {
              plan_id: planId,
              stripe_subscription_id: session.subscription as string,
              amount_total: session.amount_total,
              currency: session.currency,
            },
          })
          void captureServer({
            event: 'subscription_started',
            distinctId: userId,
            properties: { plan_id: planId },
          })

          // ── Parrainage : vérification premier paiement filleul ──
          await handleReferralPaymentVerification(userId, session.customer as string)
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
          void captureServer({
            event: 'subscription_canceled',
            distinctId: userId,
            properties: {
              previous_plan_id: sub.metadata?.planId ?? 'unknown',
              stripe_subscription_id: sub.id,
            },
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
      case 'invoice.payment_action_required': {
        // Strong Customer Authentication needed (3DS, etc.)
        const invoice = event.data.object as Stripe.Invoice
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? null
        const subscriptionId = (invoice as Stripe.Invoice & { subscription?: string | null }).subscription ?? null
        await recordSubscriptionEvent({
          eventId: event.id,
          eventType: event.type,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          payload: { invoice_id: invoice.id, amount_due: invoice.amount_due, currency: invoice.currency },
        })
        log.info('Payment action required', { invoiceId: invoice.id, customerId })
        break
      }
      case 'customer.subscription.trial_will_end': {
        const sub = event.data.object as Stripe.Subscription
        await recordSubscriptionEvent({
          eventId: event.id,
          eventType: event.type,
          stripeCustomerId: sub.customer as string,
          stripeSubscriptionId: sub.id,
          payload: { trial_end: sub.trial_end, status: sub.status },
        })
        log.info('Trial will end soon', { subscriptionId: sub.id, trialEnd: sub.trial_end })
        break
      }
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        await recordSubscriptionEvent({
          eventId: event.id,
          eventType: event.type,
          stripeCustomerId: charge.customer as string | null,
          stripeSubscriptionId: null,
          payload: {
            charge_id: charge.id,
            amount_refunded: charge.amount_refunded,
            currency: charge.currency,
            reason: charge.refunds?.data?.[0]?.reason,
          },
        })
        log.info('Charge refunded', { chargeId: charge.id, amountRefunded: charge.amount_refunded })
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

// ══════════════════════════════════════════════════════════════════════════════
// Parrainage : vérification au premier paiement
// ══════════════════════════════════════════════════════════════════════════════

async function handleReferralPaymentVerification(userId: string, stripeCustomerId: string) {
  try {
    // 1. Trouver le profil artisan
    const { data: artisan } = await supabaseAdmin
      .from('profiles_artisan')
      .select('id, referral_parrain_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (!artisan?.referral_parrain_id) return // Pas de parrain → rien à faire

    // 2. Trouver le referral en statut 'inscrit' pour ce filleul
    const { data: referral } = await supabaseAdmin
      .from('referrals')
      .select('id, parrain_id, risk_score, statut')
      .eq('filleul_id', artisan.id)
      .in('statut', ['inscrit', 'en_attente'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!referral) return

    // 3. Comparer les moyens de paiement (fingerprint Stripe)
    let memePaymentMethod = false
    const stripeClient = getStripe()

    const { data: parrain } = await supabaseAdmin
      .from('profiles_artisan')
      .select('user_id')
      .eq('id', referral.parrain_id)
      .single()

    if (parrain?.user_id) {
      const parrainSub = await getUserSubscription(parrain.user_id)
      if (parrainSub?.stripe_customer_id) {
        try {
          const [filleulPMs, parrainPMs] = await Promise.all([
            stripeClient.paymentMethods.list({ customer: stripeCustomerId, type: 'card', limit: 5 }),
            stripeClient.paymentMethods.list({ customer: parrainSub.stripe_customer_id, type: 'card', limit: 5 }),
          ])

          const parrainFingerprints = new Set(
            parrainPMs.data.map(pm => pm.card?.fingerprint).filter(Boolean)
          )

          for (const pm of filleulPMs.data) {
            if (pm.card?.fingerprint && parrainFingerprints.has(pm.card.fingerprint)) {
              memePaymentMethod = true
              break
            }
          }
        } catch (err) {
          log.warn('Stripe PM comparison failed', { error: (err as Error).message })
        }
      }
    }

    // 4. Mettre à jour le referral
    const now = new Date()
    const verificationEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // J+7

    await supabaseAdmin.from('referrals').update({
      statut: 'paiement_valide',
      date_premier_paiement: now.toISOString(),
      date_fin_periode_verification: verificationEnd.toISOString(),
      stripe_customer_id_filleul: stripeCustomerId,
      meme_moyen_paiement_que_parrain: memePaymentMethod,
      updated_at: now.toISOString(),
    }).eq('id', referral.id)

    // 5. Recalculer le score de risque avec les nouveaux facteurs
    const finalScore = await computeRiskScore(referral.id)

    // 6. Actions selon le score
    if (finalScore >= RISK_THRESHOLD_BLOCK) {
      await supabaseAdmin.from('referrals').update({
        statut: 'bloque',
        updated_at: new Date().toISOString(),
      }).eq('id', referral.id)

      await supabaseAdmin.from('referral_risk_log').insert({
        referral_id: referral.id,
        artisan_id: artisan.id,
        type_evenement: 'fraude_bloquee_paiement',
        detail: JSON.stringify({ score: finalScore, memePaymentMethod }),
      })

      log.warn('Referral blocked at payment', { referralId: referral.id, score: finalScore })
    } else if (finalScore >= RISK_THRESHOLD_REVIEW) {
      await supabaseAdmin.from('referrals').update({
        en_revue_manuelle: true,
        updated_at: new Date().toISOString(),
      }).eq('id', referral.id)

      log.info('Referral flagged for review', { referralId: referral.id, score: finalScore })
    } else {
      log.info('Referral payment verified', { referralId: referral.id, score: finalScore, j7: verificationEnd.toISOString() })
    }
  } catch (err) {
    // Non-bloquant : le paiement est déjà validé, on ne veut pas casser le webhook
    log.error('Referral payment verification failed', {}, err as Error)
  }
}
