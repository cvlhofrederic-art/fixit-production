import { NextResponse, type NextRequest } from 'next/server'
import { getAuthUser } from '@/lib/auth-helpers'
import { getUserSubscription } from '@/lib/subscription'

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const sub = await getUserSubscription(user.id)
  return NextResponse.json({
    subscription: sub || { plan_id: 'artisan_starter', status: 'active', cancel_at_period_end: false },
  })
}
