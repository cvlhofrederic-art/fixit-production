import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { runKycPipeline } from '@/lib/kyc-orchestrate'

// ---------------------------------------------------------------------------
// POST handler — pipeline dans lib/kyc-orchestrate.ts
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const start = Date.now()

  // Rate limit: 5 req/min per IP
  const ip = getClientIP(request)
  const allowed = await checkRateLimit(`kyc_orchestrate_${ip}`, 5, 60_000)
  if (!allowed) return rateLimitResponse()

  // Auth
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse body
  let artisan_id: string
  try {
    const body = await request.json() as { artisan_id?: unknown }
    if (!body.artisan_id || typeof body.artisan_id !== 'string') {
      return NextResponse.json({ error: 'artisan_id required' }, { status: 400 })
    }
    artisan_id = body.artisan_id
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const outcome = await runKycPipeline(artisan_id, user.id)
  if (!outcome.ok) {
    return outcome.status === 404
      ? NextResponse.json({ error: 'Artisan not found' }, { status: 404 })
      : NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  logger.api('/api/kyc-orchestrate', 'POST', 200, Date.now() - start)

  return NextResponse.json(outcome.result)
}
