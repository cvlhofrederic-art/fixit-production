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

  // Fallback Supabase RETIRÉ : la table background_jobs n'existe pas dans le
  // schéma live et n'est pas dans le lot de migrations en attente (audit P2
  // data layer). L'insert échouait systématiquement → on retournait déjà
  // { queued: false }. Même sémantique, sans requête morte.
  logger.warn(`[queue] No queue backend available, job ${job.type} not queued`, { jobId })
  return { queued: false, jobId }
}

/**
 * Check the status of a background job.
 *
 * Toujours null : la table background_jobs n'existe pas dans le schéma live
 * (audit P2 data layer) — l'ancienne requête échouait et retournait déjà null.
 * À réimplémenter quand un backend de queue persistant existera.
 */
export async function getJobStatus(_jobId: string): Promise<{ status: string; result?: unknown } | null> {
  return null
}
