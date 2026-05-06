/**
 * GET /api/admin/revenue
 *
 * Returns the most recent subscription_metrics rows plus a "latest" snapshot
 * suitable for the admin dashboard MRR card. Super-admin only.
 *
 * Defensive on schema absence: if the subscription_metrics table is not yet
 * provisioned (migration 100 not run), the route returns an empty payload
 * with `available: false` rather than 500-ing — that lets the UI render a
 * "data not yet available" state until the migration ships.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, isSuperAdmin, unauthorizedResponse } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

interface MetricsRow {
  date: string
  active_count: number
  mrr_cents: number
  churn_count: number
  new_count: number
  trial_count: number
  past_due_count: number
  snapshot_at: string
}

export async function GET(request: NextRequest) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`admin_revenue_${ip}`, 30, 60_000))) return rateLimitResponse()

  const user = await getAuthUser(request)
  if (!user || !isSuperAdmin(user)) return unauthorizedResponse()

  const { searchParams } = new URL(request.url)
  const days = Math.min(Math.max(parseInt(searchParams.get('days') || '30') || 30, 1), 365)

  try {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]

    const { data, error } = await supabaseAdmin
      .from('subscription_metrics')
      .select('*')
      .gte('date', since)
      .order('date', { ascending: false })

    if (error) {
      // Likely the table is absent — surface that to the UI without 500ing.
      logger.warn('[admin/revenue] subscription_metrics query failed', error)
      return NextResponse.json({
        available: false,
        reason: 'subscription_metrics table not yet provisioned (run migration 100)',
        latest: null,
        series: [],
      })
    }

    const series = (data || []) as MetricsRow[]
    const latest = series[0] || null
    return NextResponse.json({
      available: true,
      latest,
      series,
      window_days: days,
    })
  } catch (err) {
    logger.error('[admin/revenue] unexpected failure', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
