import { NextResponse, type NextRequest } from 'next/server'
import { logger } from '@/lib/logger'
import { scanDepartment } from '@/lib/tenders/scanner'

export const maxDuration = 300 // 5 min for full scan

export async function POST(request: NextRequest) {
  const cronSecret = request.headers.get('x-cron-secret')
  const authHeader = request.headers.get('authorization')
  if (cronSecret !== process.env.CRON_SECRET && !authHeader?.includes(process.env.SUPABASE_SERVICE_ROLE_KEY || '___')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

// Vercel cron sends GET
export async function GET(request: NextRequest) {
  return POST(request)
}
