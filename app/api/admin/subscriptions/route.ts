import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, isSuperAdmin, unauthorizedResponse } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/supabase-server'
import { adminSubscriptionsQuerySchema } from '@/lib/validation'

export async function GET(request: NextRequest) {
  const ip = getClientIP(request)
  const allowed = await checkRateLimit(`admin_subs_${ip}`, 20, 60_000)
  if (!allowed) return rateLimitResponse()

  const user = await getAuthUser(request)
  if (!user || !isSuperAdmin(user)) return unauthorizedResponse()

  try {
    const { searchParams } = new URL(request.url)
    const parsed = adminSubscriptionsQuerySchema.safeParse(Object.fromEntries(searchParams))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues.map(i => i.message).join('; ') }, { status: 400 })
    }
    const { plan: planFilter, status: statusFilter, page, limit } = parsed.data

    // Build query
    let query = supabaseAdmin
      .from('subscriptions')
      .select('*', { count: 'exact' })

    if (planFilter) {
      query = query.eq('subscription_plan', planFilter)
    }
    if (statusFilter) {
      query = query.eq('subscription_status', statusFilter)
    }

    query = query
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)

    const { data: subs, count, error } = await query

    if (error) {
      console.error('[admin/subscriptions] Query error:', error.message)
      return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 })
    }

    // Fetch user emails for these subscriptions
    const userIds = subs?.map(s => s.user_id).filter(Boolean) || []
    let emailMap = new Map<string, string>()

    if (userIds.length > 0) {
      const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000, page: 1 })
      if (authData?.users) {
        for (const u of authData.users) {
          if (userIds.includes(u.id)) {
            emailMap.set(u.id, u.email || '')
          }
        }
      }
    }

    const formatted = (subs || []).map(s => ({
      id: s.id,
      user_id: s.user_id,
      user_email: emailMap.get(s.user_id) || '',
      plan: s.subscription_plan || 'starter',
      status: s.subscription_status || 'unknown',
      stripe_customer_id: s.stripe_customer_id ? `***${s.stripe_customer_id.slice(-6)}` : null,
      current_period_end: s.current_period_end || null,
      cancel_at_period_end: s.cancel_at_period_end || false,
      created_at: s.created_at,
    }))

    const total = count || 0
    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      subscriptions: formatted,
      pagination: { page, limit, total, totalPages },
    })
  } catch (error) {
    console.error('[admin/subscriptions] Error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
