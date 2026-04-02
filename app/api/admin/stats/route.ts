import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, isSuperAdmin, unauthorizedResponse } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/supabase-server'

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
      // Subscriptions by plan
      supabaseAdmin.from('subscriptions').select('subscription_plan, subscription_status'),
      // New signups this week
      supabaseAdmin.auth.admin.listUsers({ perPage: 1000, page: 1 }),
    ])

    // Count users by role from auth result
    const allUsers = recentSignups.data?.users || []
    const totalUsers = usersResult.data?.users ? (allUsers.length || 0) : 0
    const recentCount = allUsers.filter(u => u.created_at && new Date(u.created_at) >= new Date(sevenDaysAgo)).length

    // Count roles
    const roleCounts: Record<string, number> = {}
    for (const u of allUsers) {
      const role = u.app_metadata?.role || u.user_metadata?.role || 'unknown'
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
    const uniqueArtisans = new Set(activeArtisans.data?.map((b: { artisan_id: string }) => b.artisan_id) || [])

    // Subscriptions breakdown
    const subsByPlan: Record<string, number> = { starter: 0, pro: 0, business: 0 }
    const subsByStatus: Record<string, number> = { active: 0, canceled: 0, past_due: 0, trialing: 0 }
    if (subscriptionsResult.data) {
      for (const s of subscriptionsResult.data) {
        const plan = (s.subscription_plan || 'starter').toLowerCase()
        const status = (s.subscription_status || 'unknown').toLowerCase()
        if (plan in subsByPlan) subsByPlan[plan]++
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
    console.error('[admin/stats] Error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
