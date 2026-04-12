// ── Cloudflare Queue Abstraction ─────────────────────────────────────────────
// Provides a unified interface for enqueuing background jobs.
// On Cloudflare Workers: uses native Queues (env.SYNC_QUEUE.send()).
// On Vercel/Node.js: falls back to direct execution (no queue available).
//
// This allows the same route code to work in both environments during migration.

import { logger } from '@/lib/logger'

export interface QueueJob {
  type: string
  payload: Record<string, unknown>
  scheduledAt?: string
}

/**
 * Enqueue a job for background processing.
 *
 * In Cloudflare Workers, this sends to a Cloudflare Queue.
 * In Vercel/Node.js, this stores the job in Supabase for async processing
 * or executes inline if no queue backend is configured.
 */
export async function enqueueJob(job: QueueJob): Promise<{ queued: boolean; jobId: string }> {
  const jobId = crypto.randomUUID()
  const jobWithId = { ...job, jobId, enqueuedAt: new Date().toISOString() }

  // Try Cloudflare Queue binding (available in Workers runtime)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const env = (globalThis as any).process?.env || globalThis
  if (typeof env.SYNC_QUEUE?.send === 'function') {
    try {
      await env.SYNC_QUEUE.send(jobWithId)
      logger.info(`[queue] Job ${job.type} enqueued to Cloudflare Queue`, { jobId })
      return { queued: true, jobId }
    } catch (err) {
      logger.error(`[queue] Failed to enqueue to Cloudflare Queue`, err)
    }
  }

  // Fallback: store in Supabase queue table for async processing
  try {
    const { supabaseAdmin } = await import('@/lib/supabase-server')
    const { error } = await supabaseAdmin
      .from('background_jobs')
      .insert({
        id: jobId,
        type: job.type,
        payload: job.payload,
        status: 'pending',
        scheduled_at: job.scheduledAt || new Date().toISOString(),
        created_at: new Date().toISOString(),
      })
    if (error) throw error
    logger.info(`[queue] Job ${job.type} stored in Supabase fallback`, { jobId })
    return { queued: true, jobId }
  } catch (err) {
    logger.warn(`[queue] Supabase fallback failed, job ${job.type} not queued`, err)
    return { queued: false, jobId }
  }
}

/**
 * Check the status of a background job.
 */
export async function getJobStatus(jobId: string): Promise<{ status: string; result?: unknown } | null> {
  try {
    const { supabaseAdmin } = await import('@/lib/supabase-server')
    const { data, error } = await supabaseAdmin
      .from('background_jobs')
      .select('status, result, error')
      .eq('id', jobId)
      .single()
    if (error || !data) return null
    return { status: data.status, result: data.result }
  } catch {
    return null
  }
}
