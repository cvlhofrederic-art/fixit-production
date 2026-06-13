import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, isSuperAdmin, unauthorizedResponse } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/supabase-server'
import { adminSubscriptionsQuerySchema } from '@/lib/validation'
import { logger } from '@/lib/logger'

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

    // Colonnes réelles de `subscriptions` : plan_id / status (cf. lib/database-types.ts).
    // Le filtre front envoie starter / pro / business, mais les valeurs réelles de
    // plan_id sont artisan_starter / artisan_pro (lib/stripe.ts PLANS) → on matche les
    // deux formes (valeur préfixée + éventuel legacy brut). `business` n'a aucun plan
    // documenté : le filtre brut est conservé tel quel (résultat vide, comme avant).
    const PLAN_FILTER_MAP: Record<string, string[]> = {
      starter: ['artisan_starter', 'starter'],
      pro: ['artisan_pro', 'pro'],
    }
    if (planFilter) {
      query = query.in('plan_id', PLAN_FILTER_MAP[planFilter] ?? [planFilter])
    }
    if (statusFilter) {
      query = query.eq('status', statusFilter)
    }

    query = query
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)

    const { data: subs, count, error } = await query

    if (error) {
      logger.error('[admin/subscriptions] Query error:', error.message)
      return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 })
    }

    // Fetch user emails for these subscriptions
    const userIds = subs?.map(s => s.user_id).filter(Boolean) || []
    const emailMap = new Map<string, string>()

    if (userIds.length > 0) {
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000, page: 1 })
      if (authError) {
        // Mode dégradé : la liste des abonnements reste exploitable sans les emails
        logger.warn('[admin/subscriptions] Auth list failed — emails non résolus', { error: authError.message })
      }
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
      plan: s.plan_id || 'starter',
      status: s.status || 'unknown',
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
    logger.error('[admin/subscriptions] Error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
