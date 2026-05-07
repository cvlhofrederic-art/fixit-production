/**
 * GET/POST /api/cron/stripe-webhook-stale-check
 *
 * Daily cron that scans `stripe_webhook_events` for rows whose handler
 * took suspiciously long (gap processed_at - received_at > 30 min).
 * When the count is non-zero, emits a `logger.warn` tagged for the
 * `stripe_webhook_stale_events` Sentry alert (manifest entry in
 * monitoring/sentry-alerts.json).
 *
 * Defensive: if migration 104 has not yet been applied, the
 * received_at column is missing — we detect via the SQL error and
 * log a hint instead of failing.
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import { runCron } from '@/lib/cron-heartbeat'

export const maxDuration = 60

const STALE_GAP_MINUTES = 30

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = req.headers.get('x-cron-secret')
  return !!(cronSecret && cronSecret === process.env.CRON_SECRET)
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return runCron('cron/stripe-webhook-stale-check', () => stripeWebhookStaleCheckHandler())
}

export async function GET(req: NextRequest) {
  return POST(req)
}

async function stripeWebhookStaleCheckHandler(): Promise<Response> {
  // We use a server-side filter expressed as `processed_at - received_at`
  // computed client-side — supabase-js doesn't expose interval arithmetic
  // directly. The 30-min cap means we only need recent rows; the index on
  // received_at keeps the query fast.
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() // 7d window
    const { data, error } = await supabaseAdmin
      .from('stripe_webhook_events')
      .select('event_id, event_type, received_at, processed_at')
      .gte('received_at', since)
      .order('received_at', { ascending: false })
      .limit(1000)

    if (error) {
      // Most likely "column does not exist" if migration 104 hasn't shipped.
      logger.warn('[stripe-webhook-stale-check] query failed (migration 104 may be pending)', {
        error: error.message,
      })
      return NextResponse.json({
        scanned: false,
        reason: 'migration 104 not applied',
        error: error.message,
      })
    }

    const rows = data ?? []
    const stale = rows.filter((row) => {
      if (!row.received_at || !row.processed_at) return false
      const gapMs = new Date(row.processed_at).getTime() - new Date(row.received_at).getTime()
      return gapMs > STALE_GAP_MINUTES * 60 * 1000
    })

    if (stale.length > 0) {
      logger.warn('[stripe-webhook-stale-check] gap > 30 min detected', {
        event: 'stripe_webhook_stale',
        count: stale.length,
        sample: stale.slice(0, 5).map((r) => ({
          event_id: r.event_id,
          event_type: r.event_type,
          gap_seconds: Math.floor(
            (new Date(r.processed_at).getTime() - new Date(r.received_at).getTime()) / 1000
          ),
        })),
      })
    }

    return NextResponse.json({
      scanned: true,
      window_days: 7,
      total: rows.length,
      stale_count: stale.length,
      threshold_minutes: STALE_GAP_MINUTES,
    })
  } catch (err) {
    logger.error('[stripe-webhook-stale-check] unexpected error', { err: (err as Error).message })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
