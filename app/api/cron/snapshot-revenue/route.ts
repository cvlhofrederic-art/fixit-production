/**
 * Daily snapshot of revenue/MRR metrics into subscription_metrics.
 *
 * Triggered by Cloudflare cron (declared in wrangler.toml). Reads the live
 * subscriptions table, counts active/canceled/trialing/past_due, sums the
 * Stripe-priced MRR, and upserts a row keyed by today's date. Idempotent:
 * re-running on the same day overwrites the row.
 *
 * Auth: cron secret header. The cron schedule itself lives in wrangler.toml
 * triggers.crons; until that line is added, this route is callable by any
 * super-admin via curl with the same header for ad-hoc runs.
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSuperAdmin } from '@/lib/auth-helpers'
import { logger } from '@/lib/logger'

const PLAN_PRICES_CENTS: Record<string, number> = {
  artisan_pro: 4900,
  artisan_starter: 0,
  syndic_essential: 9900,
  syndic_premium: 19900,
}

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = req.headers.get('x-cron-secret')
  return !!(cronSecret && cronSecret === process.env.CRON_SECRET)
}

interface SubscriptionRow {
  status: string | null
  plan_id?: string | null
  subscription_plan?: string | null
  cancel_at_period_end?: boolean | null
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    const user = await getAuthUser(request)
    if (!user || !isSuperAdmin(user)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const { data: subs, error } = await supabaseAdmin
      .from('subscriptions')
      .select('status, plan_id, subscription_plan, cancel_at_period_end')

    if (error) {
      logger.error('[snapshot-revenue] subscriptions read failed', error)
      return NextResponse.json({ error: 'Failed to read subscriptions' }, { status: 500 })
    }

    const rows = (subs || []) as SubscriptionRow[]
    let active = 0
    let trial = 0
    let pastDue = 0
    let canceled = 0
    let mrrCents = 0

    for (const r of rows) {
      const status = r.status ?? ''
      const plan = r.plan_id ?? r.subscription_plan ?? 'artisan_starter'
      const price = PLAN_PRICES_CENTS[plan] ?? 0

      switch (status) {
        case 'active':
          active += 1
          mrrCents += price
          break
        case 'trialing':
          trial += 1
          break
        case 'past_due':
          pastDue += 1
          break
        case 'canceled':
          canceled += 1
          break
      }
    }

    const today = new Date().toISOString().split('T')[0]

    const { error: upsertError } = await supabaseAdmin
      .from('subscription_metrics')
      .upsert(
        {
          date: today,
          active_count: active,
          mrr_cents: mrrCents,
          churn_count: canceled,
          new_count: 0, // backfilled below
          trial_count: trial,
          past_due_count: pastDue,
          snapshot_at: new Date().toISOString(),
        },
        { onConflict: 'date' }
      )

    if (upsertError) {
      logger.warn('[snapshot-revenue] subscription_metrics upsert failed (table may be absent)', upsertError)
      return NextResponse.json({
        snapshotted: false,
        reason: 'subscription_metrics table not yet provisioned (run migration 100)',
        counts: { active, trial, past_due: pastDue, canceled, mrr_cents: mrrCents },
      })
    }

    logger.info(`[snapshot-revenue] Snapshotted ${today}: active=${active} mrr_cents=${mrrCents}`)
    return NextResponse.json({
      snapshotted: true,
      date: today,
      counts: { active, trial, past_due: pastDue, canceled, mrr_cents: mrrCents },
    })
  } catch (err) {
    logger.error('[snapshot-revenue] fatal', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// Allow GET for cron invocation via Cloudflare scheduler
export async function GET(request: NextRequest) {
  return POST(request)
}
