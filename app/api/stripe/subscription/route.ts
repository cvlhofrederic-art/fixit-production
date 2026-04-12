import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth-helpers'
import { getUserSubscription } from '@/lib/subscription'
import { logger } from '@/lib/logger'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

const subscriptionBodySchema = z.object({
  plan: z.string().min(1),
  priceId: z.string().min(1),
})

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    if (!(await checkRateLimit(`stripe_sub_${user.id}`, 10, 60_000))) return rateLimitResponse()

    const sub = await getUserSubscription(user.id)
    return NextResponse.json({
      subscription: sub || { plan_id: 'artisan_starter', status: 'active', cancel_at_period_end: false },
    })
  } catch (err) {
    logger.error('[stripe/subscription/GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    if (!(await checkRateLimit(`stripe_sub_${user.id}`, 10, 60_000))) return rateLimitResponse()

    const body = await request.json()
    const parsed = subscriptionBodySchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten().fieldErrors }, { status: 400 })

    const { plan, priceId } = parsed.data
    return NextResponse.json({ received: true, plan, priceId })
  } catch (err) {
    logger.error('[stripe/subscription/POST] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
