/**
 * POST /api/cron/cron-heartbeat
 *
 * Called by every cron at the end of its run to drop a row in
 * `cron_heartbeats`. The Sentry alert `cron_missing_heartbeat` watches
 * for absence rather than presence, so the cron name list lives in
 * monitoring/sentry-alerts.json (or its companion query) and not here.
 *
 * Defensive on schema absence: if migration 102 hasn't been applied yet,
 * we log a warn and return success so the cron itself doesn't surface
 * an error in its own monitoring.
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

const heartbeatSchema = (body: unknown): { ok: true; data: { cron_name: string; duration_ms?: number; status?: 'completed' | 'failed'; details?: Record<string, unknown> } } | { ok: false; error: string } => {
  if (!body || typeof body !== 'object') return { ok: false, error: 'body must be an object' }
  const b = body as Record<string, unknown>
  const cron_name = b.cron_name
  if (typeof cron_name !== 'string' || cron_name.length === 0 || cron_name.length > 80) {
    return { ok: false, error: 'cron_name must be a non-empty string ≤ 80 chars' }
  }
  const duration_ms = typeof b.duration_ms === 'number' && b.duration_ms >= 0 ? b.duration_ms : undefined
  const status = b.status === 'failed' ? 'failed' : 'completed'
  const details = b.details && typeof b.details === 'object' ? (b.details as Record<string, unknown>) : undefined
  return { ok: true, data: { cron_name, duration_ms, status, details } }
}

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = req.headers.get('x-cron-secret')
  return !!(cronSecret && cronSecret === process.env.CRON_SECRET)
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const parsed = heartbeatSchema(body)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  try {
    const { error } = await supabaseAdmin.from('cron_heartbeats').insert({
      cron_name: parsed.data.cron_name,
      ran_at: new Date().toISOString(),
      duration_ms: parsed.data.duration_ms,
      status: parsed.data.status,
      details: parsed.data.details,
    })
    if (error) {
      logger.warn('[cron-heartbeat] insert failed (table may be absent)', { error: error.message })
      // Return 200 anyway — the cron itself shouldn't fail because of this.
      return NextResponse.json({ recorded: false, reason: 'cron_heartbeats table not yet provisioned (run migration 102)' })
    }
    return NextResponse.json({ recorded: true })
  } catch (err) {
    logger.warn('[cron-heartbeat] unexpected error', { err: (err as Error).message })
    return NextResponse.json({ recorded: false, reason: 'unexpected error' })
  }
}
