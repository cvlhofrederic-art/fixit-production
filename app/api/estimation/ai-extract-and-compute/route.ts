import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { estimateProject, recipeRegistry } from '@/lib/estimation-materiaux'
import { extractEstimationWithGroq, extractionToEstimationInput } from '@/lib/estimation-materiaux/ai/groq-extractor'
import type { ChantierProfile } from '@/lib/estimation-materiaux'

export const runtime = 'nodejs'
export const maxDuration = 30

const ProfileSchema = z.object({
  difficulty: z.enum(['facile', 'standard', 'difficile']).optional(),
  size: z.enum(['petit', 'moyen', 'grand']).optional(),
  workforceLevel: z.enum(['experimente', 'mixte', 'apprenti']).optional(),
  complexShapes: z.boolean().optional(),
  isPistoletPainting: z.boolean().optional(),
}).optional()

const BodySchema = z.object({
  description: z.string().min(5).max(5000),
  projectName: z.string().max(200).optional(),
  profileFallback: ProfileSchema,
})

/**
 * POST /api/estimation/ai-extract-and-compute
 * Pipeline complet : description libre → extraction IA (Groq) → calcul → résultat.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  // Plus strict que /compute car un appel déclenche un appel LLM
  if (!(await checkRateLimit(`estim_ai_${ip}`, 10, 60_000))) return rateLimitResponse()

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: 'GROQ_API_KEY non configurée' }, { status: 503 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Entrée invalide', details: parsed.error.issues }, { status: 400 })
  }

  const { description, projectName, profileFallback } = parsed.data

  try {
    const extraction = await extractEstimationWithGroq(description)
    if (extraction.items.length === 0) {
      return NextResponse.json({
        extraction,
        result: null,
        error: 'Aucun ouvrage détecté dans la description',
      }, { status: 200 })
    }

    const input = extractionToEstimationInput(
      extraction,
      projectName,
      profileFallback as ChantierProfile | undefined
    )
    const result = estimateProject(input, recipeRegistry)

    return NextResponse.json({ extraction, result })
  } catch (e) {
    logger.error('ai-extract-and-compute failed', e)
    const msg = e instanceof Error ? e.message : 'Erreur interne'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
