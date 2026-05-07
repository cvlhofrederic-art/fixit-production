/**
 * Cron heartbeat helper — drops a row in `cron_heartbeats` (migration 102)
 * after every cron run so the SLO alert `cron_missing_heartbeat` (manifest
 * `monitoring/sentry-alerts.json`) can detect crons that didn't fire.
 *
 * Two surfaces:
 *   - recordHeartbeat({ cron_name, duration_ms, status, details })
 *     direct INSERT via supabaseAdmin. Tolerates a missing table (envs
 *     where migration 102 hasn't shipped yet) and never throws.
 *   - runCron(name, fn) — wraps a cron handler, measures wall-clock
 *     duration, records `completed` on success or `failed` (with the
 *     error message) on throw, then re-throws the original error so the
 *     caller's HTTP path is unchanged.
 *
 * Used directly via supabaseAdmin instead of POSTing /api/cron/cron-heartbeat
 * to avoid an internal HTTP subrequest (Workers subrequest budget) and a
 * dependency cycle if cron-heartbeat itself becomes a cron.
 */
import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

export interface HeartbeatInput {
  cron_name: string
  duration_ms?: number
  status?: 'completed' | 'failed'
  details?: Record<string, unknown>
}

export async function recordHeartbeat(input: HeartbeatInput): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from('cron_heartbeats').insert({
      cron_name: input.cron_name,
      ran_at: new Date().toISOString(),
      duration_ms: input.duration_ms,
      status: input.status ?? 'completed',
      details: input.details,
    })
    if (error) {
      logger.warn('[cron-heartbeat] insert failed (table may be absent)', {
        cron_name: input.cron_name,
        error: error.message,
      })
    }
  } catch (err) {
    logger.warn('[cron-heartbeat] unexpected error', {
      cron_name: input.cron_name,
      err: (err as Error).message,
    })
  }
}

/**
 * Wrap a cron handler so success / failure is recorded automatically.
 * Re-throws the original error verbatim so HTTP error semantics are
 * preserved.
 *
 * Usage:
 *   export async function POST(req: NextRequest) {
 *     return runCron('devis-reminder', async () => {
 *       // existing handler body
 *       return NextResponse.json({ ok: true })
 *     })
 *   }
 */
export async function runCron<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now()
  try {
    const result = await fn()
    await recordHeartbeat({
      cron_name: name,
      duration_ms: Date.now() - start,
      status: 'completed',
    })
    return result
  } catch (err) {
    await recordHeartbeat({
      cron_name: name,
      duration_ms: Date.now() - start,
      status: 'failed',
      details: { error: (err as Error).message },
    })
    throw err
  }
}
