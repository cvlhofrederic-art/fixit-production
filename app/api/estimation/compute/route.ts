import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { EstimationInputSchema, estimateProject, recipeRegistry } from '@/lib/estimation-materiaux'

export const runtime = 'nodejs'

/**
 * POST /api/estimation/compute
 * Calcule les matériaux nécessaires pour un projet BTP.
 * Input: { projectName?, items[], chantierProfile? }
 * Output: EstimationResult (items détaillés + agrégé + humanSummary)
 */
export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`estim_compute_${ip}`, 30, 60_000))) return rateLimitResponse()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const parsed = EstimationInputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Entrée invalide', details: parsed.error.issues }, { status: 400 })
  }

  try {
    const result = estimateProject(parsed.data, recipeRegistry)
    return NextResponse.json(result)
  } catch (e) {
    logger.error('estimation/compute failed', e)
    const msg = e instanceof Error ? e.message : 'Erreur interne'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
