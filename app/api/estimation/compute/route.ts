import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import {
  EstimationInputSchema,
  estimateProject,
  recipeRegistry,
  CountrySchema,
  CountryMismatchError,
  assertSameCountry,
} from '@/lib/estimation-materiaux'

export const runtime = 'nodejs'

/**
 * Schéma d'entrée pays : accepte `country` optionnel au top-level du body
 * pour brancher le guard d'isolation. Absent = 'FR' (rétro-compatibilité).
 */
const ComputeBodySchema = z.object({
  country: CountrySchema.optional(),
}).passthrough()

/**
 * POST /api/estimation/compute
 * Calcule les matériaux nécessaires pour un projet BTP.
 * Input: { country?, projectName?, items[], chantierProfile? }
 * Output: EstimationResult (items détaillés + agrégé + humanSummary)
 *
 * Isolation pays : si `country` est renseigné, assertSameCountry() vérifie
 * que TOUTES les recettes référencées par `items[].recipeId` sont bien du pays
 * demandé. Sinon → 422 CountryMismatch (pas d'erreur silencieuse).
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

  const countryWrap = ComputeBodySchema.safeParse(body)
  if (!countryWrap.success) {
    return NextResponse.json({ error: 'Entrée invalide', details: countryWrap.error.issues }, { status: 400 })
  }
  const declaredCountry = countryWrap.data.country

  const parsed = EstimationInputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Entrée invalide', details: parsed.error.issues }, { status: 400 })
  }

  // Guard isolation pays : si le client déclare un pays, les recettes référencées
  // doivent toutes appartenir à ce pays (pas de fuite FR↔PT).
  if (declaredCountry) {
    const referenced = parsed.data.items
      .map(i => recipeRegistry[i.recipeId])
      .filter((r): r is NonNullable<typeof r> => !!r)
    try {
      assertSameCountry(declaredCountry, referenced)
    } catch (e) {
      if (e instanceof CountryMismatchError) {
        return NextResponse.json({
          error: e.message,
          code: 'COUNTRY_MISMATCH',
          expected: e.expectedCountry,
          recipeId: e.recipeId,
          recipeCountry: e.recipeCountry,
        }, { status: 422 })
      }
      throw e
    }
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
