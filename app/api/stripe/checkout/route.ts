import { NextResponse, type NextRequest } from 'next/server'
import { stripe, PLANS, type PlanId } from '@/lib/stripe'
import { getAuthUser } from '@/lib/auth-helpers'
import { getUserSubscription } from '@/lib/subscription'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { validateBody, stripeCheckoutSchema } from '@/lib/validation'

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  // Rate limit par user : max 5 checkouts/min pour éviter le spam de sessions
  if (!(await checkRateLimit(`checkout_${user.id}`, 5, 60_000))) return rateLimitResponse()

  try {
    const body = await request.json()
    const v = validateBody(stripeCheckoutSchema, body)
    if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })
    const { planId } = v.data as { planId: PlanId }
    const plan = PLANS[planId]
    if (!plan || !('stripePriceId' in plan) || !plan.stripePriceId) {
      return NextResponse.json({ error: 'Plan invalide' }, { status: 400 })
    }

    const existingSub = await getUserSubscription(user.id)
    const customerOptions: Record<string, string> = {}
    if (existingSub?.stripe_customer_id) {
      customerOptions.customer = existingSub.stripe_customer_id
    } else {
      customerOptions.customer_email = user.email || ''
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      ...customerOptions,
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/pro/dashboard?subscription=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/tarifs?subscription=canceled`,
      metadata: { userId: user.id, planId },
      subscription_data: { metadata: { userId: user.id, planId } },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    logger.error('[stripe/checkout] Error:', error)
    return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
  }
}
