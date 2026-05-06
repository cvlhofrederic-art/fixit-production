/**
 * Idempotent consumer wrapper around lib/tenders/scanner.scanDepartment.
 *
 * Used by the Cloudflare Queue consumer (when activated) and as a
 * fallback worker when run inline. The wrapper:
 *
 *  - Skips if a successful scan completed for this department within the
 *    last `MIN_INTERVAL_MS` window (avoids duplicate work on retries).
 *  - Records start/finish in `background_jobs` so the producer route can
 *    expose status.
 *
 * Activation roadmap (post wrangler queues create fixit-sync-jobs):
 *  1. Uncomment the queue bindings in wrangler.toml.
 *  2. Wire the OpenNext worker entry to dispatch queue messages here:
 *       if (msg.body?.type === 'tenders-scan') await runTendersScanJob(msg.body.payload)
 *  3. Verify on a preview deploy before flipping production.
 */
import { scanDepartment } from '@/lib/tenders/scanner'
import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

export const TENDERS_SCAN_JOB_TYPE = 'tenders-scan' as const

export interface TendersScanPayload {
  department: string
}

const MIN_INTERVAL_MS = 5 * 60 * 1000 // skip if last successful scan < 5 min ago

interface RunResult {
  status: 'completed' | 'skipped_recent' | 'failed'
  jobId: string
  meta?: { total_after_dedup?: number }
  error?: string
}

export async function runTendersScanJob(
  payload: TendersScanPayload,
  opts: { jobId?: string } = {}
): Promise<RunResult> {
  const department = payload?.department || '13'
  const jobId = opts.jobId || crypto.randomUUID()

  // Idempotency window: a recent completed scan for this department wins.
  try {
    const since = new Date(Date.now() - MIN_INTERVAL_MS).toISOString()
    const { data: recent } = await supabaseAdmin
      .from('background_jobs')
      .select('id, status, completed_at')
      .eq('type', TENDERS_SCAN_JOB_TYPE)
      .eq('status', 'completed')
      .contains('payload', { department })
      .gte('completed_at', since)
      .limit(1)
      .maybeSingle()
    if (recent) {
      logger.info(`[tenders-scan] Skipping run for dept ${department} — recent success at ${recent.completed_at}`)
      return { status: 'skipped_recent', jobId }
    }
  } catch (err) {
    // background_jobs table may not have the columns yet; we tolerate the
    // lookup failing and proceed with the scan.
    logger.warn('[tenders-scan] idempotency lookup failed, continuing', err)
  }

  await markJobRunning(jobId, department)

  try {
    const result = await scanDepartment(department)
    await markJobCompleted(jobId, result.meta)
    return { status: 'completed', jobId, meta: result.meta }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await markJobFailed(jobId, message)
    return { status: 'failed', jobId, error: message }
  }
}

async function markJobRunning(jobId: string, department: string) {
  try {
    await supabaseAdmin
      .from('background_jobs')
      .upsert({
        id: jobId,
        type: TENDERS_SCAN_JOB_TYPE,
        payload: { department },
        status: 'processing',
        started_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      })
  } catch (err) {
    logger.warn('[tenders-scan] markJobRunning failed', err)
  }
}

async function markJobCompleted(jobId: string, meta: unknown) {
  try {
    await supabaseAdmin
      .from('background_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        result: meta as Record<string, unknown>,
      })
      .eq('id', jobId)
  } catch (err) {
    logger.warn('[tenders-scan] markJobCompleted failed', err)
  }
}

async function markJobFailed(jobId: string, error: string) {
  try {
    await supabaseAdmin
      .from('background_jobs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error,
      })
      .eq('id', jobId)
  } catch (err) {
    logger.warn('[tenders-scan] markJobFailed failed', err)
  }
}
