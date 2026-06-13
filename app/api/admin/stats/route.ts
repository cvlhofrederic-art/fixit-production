import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, isSuperAdmin, unauthorizedResponse } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

// No query params to validate — this route returns aggregate stats with no user input

export async function GET(request: NextRequest) {
  const ip = getClientIP(request)
  const allowed = await checkRateLimit(`admin_stats_${ip}`, 10, 60_000)
  if (!allowed) return rateLimitResponse()

  const user = await getAuthUser(request)
  if (!user || !isSuperAdmin(user)) return unauthorizedResponse()

  try {
    // Fetch all stats in parallel
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
    const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const [
      usersResult,
      artisansResult,
      clientsResult,
      bookingsThisMonth,
      bookingsPrevMonth,
      bookingsByStatus,
      activeArtisans,
      subscriptionsResult,
      recentSignups,
    ] = await Promise.all([
      // Total users from auth
      supabaseAdmin.auth.admin.listUsers({ perPage: 1, page: 1 }),
      // Total artisans
      supabaseAdmin.from('profiles_artisan').select('id', { count: 'exact', head: true }),
      // Total clients
      supabaseAdmin.from('profiles_client').select('id', { count: 'exact', head: true }),
      // Bookings this month
      supabaseAdmin.from('bookings').select('id', { count: 'exact', head: true }).gte('created_at', startOfMonth),
      // Bookings previous month
      supabaseAdmin.from('bookings').select('id', { count: 'exact', head: true }).gte('created_at', startOfPrevMonth).lte('created_at', endOfPrevMonth),
      // Bookings by status (this month)
      supabaseAdmin.from('bookings').select('status').gte('created_at', startOfMonth),
      // Active artisans (at least 1 booking in 30 days)
      supabaseAdmin.from('bookings').select('artisan_id').gte('created_at', thirtyDaysAgo),
      // Subscriptions by plan — colonnes réelles : plan_id / status (cf. lib/database-types.ts)
      supabaseAdmin.from('subscriptions').select('plan_id, status'),
      // New signups this week
      supabaseAdmin.auth.admin.listUsers({ perPage: 1000, page: 1 }),
    ])

    // Toute erreur d'une sous-requête rendrait les stats silencieusement fausses (zéros) :
    // on échoue franchement plutôt que d'afficher des chiffres erronés à l'admin.
    const queryResults: Array<[string, { message: string } | null]> = [
      ['users', usersResult.error],
      ['artisans', artisansResult.error],
      ['clients', clientsResult.error],
      ['bookingsThisMonth', bookingsThisMonth.error],
      ['bookingsPrevMonth', bookingsPrevMonth.error],
      ['bookingsByStatus', bookingsByStatus.error],
      ['activeArtisans', activeArtisans.error],
      ['subscriptions', subscriptionsResult.error],
      ['recentSignups', recentSignups.error],
    ]
    const failed = queryResults.filter(([, err]) => err !== null)
    if (failed.length > 0) {
      logger.error('[admin/stats] Query errors', {
        errors: failed.map(([name, err]) => `${name}: ${err?.message}`),
      })
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
    }

    // Count users by role from auth result
    const allUsers = recentSignups.data?.users || []
    const totalUsers = usersResult.data?.users ? (allUsers.length || 0) : 0
    const recentCount = allUsers.filter(u => u.created_at && new Date(u.created_at) >= new Date(sevenDaysAgo)).length

    // Count roles
    const roleCounts: Record<string, number> = {}
    for (const u of allUsers) {
      const role = u.app_metadata?.role || 'unknown'
      roleCounts[role] = (roleCounts[role] || 0) + 1
    }

    // Booking status breakdown
    const statusCounts: Record<string, number> = { pending: 0, confirmed: 0, completed: 0, cancelled: 0 }
    if (bookingsByStatus.data) {
      for (const b of bookingsByStatus.data) {
        const s = (b.status || 'unknown').toLowerCase()
        if (s in statusCounts) statusCounts[s]++
      }
    }

    // Active artisans (unique artisan_ids with bookings in 30 days)
    // bookings.artisan_id est nullable — on écarte les réservations sans artisan
    const uniqueArtisans = new Set(
      (activeArtisans.data ?? [])
        .map(b => b.artisan_id)
        .filter((id): id is string => id !== null)
    )

    // Subscriptions breakdown
    // Valeurs réelles de plan_id (lib/stripe.ts PLANS) : artisan_starter / artisan_pro /
    // syndic_essential / syndic_premium. Le front (KPI « Abonnés Pro », liste par plan)
    // consomme les buckets starter / pro / business → normalisation plan_id → bucket.
    // Les plans syndic_* sont volontairement IGNORÉS : le KPI « Abonnés Pro » compte les
    // artisans, et le scope syndic est dormant — les compter dans `pro` gonflerait le chiffre.
    const PLAN_BUCKETS: Record<string, 'starter' | 'pro' | 'business'> = {
      artisan_starter: 'starter',
      artisan_pro: 'pro',
      // valeurs legacy brutes éventuelles
      starter: 'starter',
      pro: 'pro',
      business: 'business',
    }
    const subsByPlan: Record<string, number> = { starter: 0, pro: 0, business: 0 }
    const subsByStatus: Record<string, number> = { active: 0, canceled: 0, past_due: 0, trialing: 0 }
    if (subscriptionsResult.data) {
      for (const s of subscriptionsResult.data) {
        const plan = (s.plan_id || 'artisan_starter').toLowerCase()
        const status = (s.status || 'unknown').toLowerCase()
        const bucket = PLAN_BUCKETS[plan]
        if (bucket) subsByPlan[bucket]++
        if (status in subsByStatus) subsByStatus[status]++
      }
    }

    // Bookings evolution %
    const thisMonthCount = bookingsThisMonth.count || 0
    const prevMonthCount = bookingsPrevMonth.count || 0
    const evolution = prevMonthCount > 0
      ? Math.round(((thisMonthCount - prevMonthCount) / prevMonthCount) * 100)
      : thisMonthCount > 0 ? 100 : 0

    return NextResponse.json({
      users: {
        total: totalUsers,
        byRole: roleCounts,
        newThisWeek: recentCount,
      },
      artisans: {
        total: artisansResult.count || 0,
        active: uniqueArtisans.size,
      },
      clients: {
        total: clientsResult.count || 0,
      },
      bookings: {
        thisMonth: thisMonthCount,
        prevMonth: prevMonthCount,
        evolution,
        byStatus: statusCounts,
      },
      subscriptions: {
        byPlan: subsByPlan,
        byStatus: subsByStatus,
      },
    })
  } catch (error) {
    logger.error('[admin/stats] Error', { error: error instanceof Error ? error.message : error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
