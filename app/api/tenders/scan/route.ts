import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { scanDepartment } from '@/lib/tenders/scanner'
import { getAuthUser } from '@/lib/auth-helpers'
import { TENDERS_SCAN_JOB_TYPE } from '@/lib/queue/consumers/tenders-scan'

const scanBodySchema = z.object({
  department: z.string().regex(/^\d{2,3}$/, 'Code département invalide').default('13'),
})

export const maxDuration = 300 // 5 min for full scan

function isAuthorized(request: NextRequest): boolean {
  // 1. Cron secret header (Cloudflare cron triggers via wrangler.toml)
  const cronSecret = request.headers.get('x-cron-secret')
  if (cronSecret && cronSecret === process.env.CRON_SECRET) return true

  // 2. Service role key in Authorization header
  const authHeader = request.headers.get('authorization')
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (serviceKey && authHeader?.includes(serviceKey)) return true

  return false
}

interface SyncQueueBinding {
  send: (msg: unknown) => Promise<void>
}

function getSyncQueueBinding(): SyncQueueBinding | null {
  // Cloudflare Workers expose queue bindings on the request env. The
  // OpenNext adapter surfaces it via globalThis.process.env at runtime.
  // When the binding is absent (local dev, plain Node, Vercel), we fall
  // back to the inline scan path — same behaviour as before this change.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const env = (globalThis as any).process?.env || (globalThis as any)
  const binding = env?.SYNC_QUEUE
  return binding && typeof binding.send === 'function' ? (binding as SyncQueueBinding) : null
}

export async function POST(request: NextRequest) {
  // Auth: cron secret, service role key, or logged-in user
  if (!isAuthorized(request)) {
    // Fallback: check if it's an authenticated user (super admin manual trigger)
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const rawBody = await request.json().catch(() => ({}))
  const parsed = scanBodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Code département invalide' }, { status: 400 })
  }
  const { department } = parsed.data

  // If the Cloudflare Queue binding is wired, hand the work off and return
  // 202 immediately — consumers get up to 15 min, well past the 30s CPU
  // limit Workers enforces for HTTP requests on the standard plan.
  const queue = getSyncQueueBinding()
  if (queue) {
    try {
      const jobId = crypto.randomUUID()
      await queue.send({
        type: TENDERS_SCAN_JOB_TYPE,
        jobId,
        payload: { department },
        enqueuedAt: new Date().toISOString(),
      })
      logger.info(`[tenders/scan] Enqueued job ${jobId} for department ${department}`)
      return NextResponse.json({ success: true, queued: true, jobId }, { status: 202 })
    } catch (err) {
      logger.error('[tenders/scan] Queue enqueue failed, falling back to inline scan', err)
      // fall through to inline execution as a safety net
    }
  }

  try {
    logger.info(`[tenders/scan] Starting inline scan for department ${department}`)
    const result = await scanDepartment(department)
    logger.info(`[tenders/scan] Completed: ${result.meta.total_after_dedup} tenders found`)
    return NextResponse.json({ success: true, queued: false, ...result.meta })
  } catch (err: unknown) {
    logger.error('[tenders/scan] Fatal error:', err)
    return NextResponse.json({ error: 'Erreur interne du scan' }, { status: 500 })
  }
}

// Cloudflare cron triggers GET — same auth logic
export async function GET(request: NextRequest) {
  return POST(request)
}
