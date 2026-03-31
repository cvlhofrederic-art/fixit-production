import { NextResponse, type NextRequest } from 'next/server'
import { logger } from '@/lib/logger'
import { scanDepartment } from '@/lib/tenders/scanner'
import { getAuthUser } from '@/lib/auth-helpers'

export const maxDuration = 300 // 5 min for full scan

function isAuthorized(request: NextRequest): boolean {
  // 1. Vercel cron secret (set via Vercel dashboard)
  const cronSecret = request.headers.get('x-cron-secret')
  if (cronSecret && cronSecret === process.env.CRON_SECRET) return true

  // 2. Service role key in Authorization header
  const authHeader = request.headers.get('authorization')
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (serviceKey && authHeader?.includes(serviceKey)) return true

  // 3. Vercel cron — Vercel sends GET with no auth but sets x-vercel-cron-signature
  const vercelCron = request.headers.get('x-vercel-cron-signature')
  if (vercelCron) return true

  return false
}

export async function POST(request: NextRequest) {
  // Auth: cron secret, service role key, Vercel cron signature, or logged-in user
  if (!isAuthorized(request)) {
    // Fallback: check if it's an authenticated user (super admin manual trigger)
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const body = await request.json().catch(() => ({}))
  const department = body.department || '13'

  try {
    logger.info(`[tenders/scan] Starting scan for department ${department}`)
    const result = await scanDepartment(department)
    logger.info(`[tenders/scan] Completed: ${result.meta.total_after_dedup} tenders found`)
    return NextResponse.json({ success: true, ...result.meta })
  } catch (err: any) {
    logger.error('[tenders/scan] Fatal error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// Vercel cron sends GET — same auth logic
export async function GET(request: NextRequest) {
  return POST(request)
}
