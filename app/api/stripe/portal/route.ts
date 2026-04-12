import { NextResponse, type NextRequest } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getAuthUser } from '@/lib/auth-helpers'
import { getUserSubscription } from '@/lib/subscription'
import { logger } from '@/lib/logger'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  if (!(await checkRateLimit(`stripe_portal_${user.id}`, 5, 60_000))) return rateLimitResponse()

  const sub = await getUserSubscription(user.id)
  if (!sub?.stripe_customer_id) {
    return NextResponse.json({ error: 'Aucun abonnement actif' }, { status: 400 })
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/pro/dashboard`,
    })
    return NextResponse.json({ url: session.url })
  } catch (error) {
    logger.error('[stripe/portal] Error:', error)
    return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
  }
}
