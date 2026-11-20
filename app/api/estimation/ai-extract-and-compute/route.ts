import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { getAuthUser, isArtisanRole, isProSocieteRole, unauthorizedResponse } from '@/lib/auth-helpers'
import { logger } from '@/lib/logger'
import {
  estimateProject,
  recipeRegistry,
  CountrySchema,
  getRecipesByCountry,
} from '@/lib/estimation-materiaux'
import { extractEstimationWithGroq, extractionToEstimationInput } from '@/lib/estimation-materiaux/ai/groq-extractor'
import { hasAnthropicKey } from '@/lib/claude'
import type { ChantierProfile } from '@/lib/estimation-materiaux'

export const runtime = 'nodejs'
export const maxDuration = 30

// Messages rendus à l'écran, qui les affiche tels quels. Aucun détail interne (fournisseur, modèle, erreur
// brute) : il est dans les journaux.
const MESSAGE_INDISPONIBLE = {
  FR: 'L’analyse par IA est indisponible pour le moment. Utilisez le mode Formulaire ou réessayez plus tard.',
  PT: 'A análise por IA está indisponível de momento. Use o modo Formulário ou tente mais tarde.',
}
const MESSAGE_ECHEC = {
  FR: 'L’IA n’a pas pu analyser cette description. Réessayez dans un instant ou utilisez le mode Formulaire.',
  PT: 'A IA não conseguiu analisar esta descrição. Tente novamente dentro de instantes ou use o modo Formulário.',
}
const MESSAGE_QUOTA = {
  FR: 'Trop d’analyses par IA en une heure. Réessayez plus tard ou utilisez le mode Formulaire.',
  PT: 'Demasiadas análises por IA numa hora. Tente mais tarde ou use o modo Formulário.',
}

// Plafond par compte, en plus de celui par adresse IP : chaque analyse coûte un appel de modèle (Claude en relais).
// 30 par heure laisse large pour affiner un chantier en deux ou trois échanges.
const LIMITE_PAR_COMPTE = { requetes: 30, fenetreMs: 60 * 60_000 }

const ProfileSchema = z.object({
  difficulty: z.enum(['facile', 'standard', 'difficile']).optional(),
  size: z.enum(['petit', 'moyen', 'grand']).optional(),
  workforceLevel: z.enum(['experimente', 'mixte', 'apprenti']).optional(),
  complexShapes: z.boolean().optional(),
  isPistoletPainting: z.boolean().optional(),
}).optional()

// Enum des 26 trades supportés (doit rester aligné avec lib/estimation-materiaux/types).
const TradeEnum = z.enum([
  'maconnerie', 'placo', 'peinture', 'carrelage',
  'charpente', 'couverture', 'zinguerie',
  'etancheite', 'isolation', 'facade',
  'menuiserie_ext', 'menuiserie_int',
  'revetement_sol', 'revetement_mural',
  'plomberie', 'chauffage', 'ventilation', 'climatisation',
  'electricite', 'electricite_cfa',
  'vrd', 'assainissement',
  'cloture', 'terrasse_ext', 'jardin', 'piscine',
])

const BodySchema = z.object({
  description: z.string().min(5).max(5000),
  projectName: z.string().max(200).optional(),
  profileFallback: ProfileSchema,
  country: CountrySchema.optional(),
  // Restriction de périmètre métier — super-admin multi-trade OU entreprise
  // calibrée sur son corps de métier. Array vide ou absent = tout le catalogue.
  trades: z.array(TradeEnum).max(26).optional(),
})

/**
 * POST /api/estimation/ai-extract-and-compute
 * Pipeline complet : description libre → extraction IA (Groq) → calcul → résultat.
 */
export async function POST(request: NextRequest) {
  // Auth check: user must be authenticated
  const user = await getAuthUser(request)
  if (!user) return unauthorizedResponse()
  // Réservée aux comptes pro (artisan, BTP ; super admin compris par isProSocieteRole) : l'écran d'Estimation
  // n'existe que dans leur tableau de bord, et chaque appel coûte un appel de modèle.
  if (!isArtisanRole(user) && !isProSocieteRole(user)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const ip = getClientIP(request)
  // Plus strict que /compute car un appel déclenche un appel LLM
  if (!(await checkRateLimit(`estim_ai_${ip}`, 10, 60_000))) return rateLimitResponse()

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

  const { description, projectName, profileFallback, country, trades } = parsed.data
  const langue = country === 'PT' ? 'PT' : 'FR'

  // L'extraction passe par Groq, puis par Claude si Groq échoue (groq-extractor) : il faut au moins l'un des deux.
  if (!process.env.GROQ_API_KEY && !(await hasAnthropicKey())) {
    return NextResponse.json({ error: MESSAGE_INDISPONIBLE[langue] }, { status: 503 })
  }

  // Compté juste avant l'appel du modèle : une requête refusée plus haut ne consomme rien du plafond.
  if (!(await checkRateLimit(`estim_ai_user_${user.id}`, LIMITE_PAR_COMPTE.requetes, LIMITE_PAR_COMPTE.fenetreMs))) {
    return NextResponse.json({ error: MESSAGE_QUOTA[langue] }, { status: 429 })
  }

  try {
    const extraction = await extractEstimationWithGroq(
      description,
      undefined,
      (country || (trades && trades.length > 0)) ? { country, trades } : undefined
    )

    // Isolation pays : si `country` est renseigné, on FILTRE les items
    // hors-scope de l'extraction IA (anti-leak, redondant avec whitelist prompt
    // mais indispensable — ceinture + bretelles).
    if (country) {
      const allowedIds = new Set(getRecipesByCountry(country).map(r => r.id))
      const rejected: string[] = []
      extraction.items = extraction.items.filter(it => {
        if (allowedIds.has(it.recipeId)) return true
        rejected.push(it.recipeId)
        return false
      })
      if (rejected.length > 0) {
        extraction.assumptions.push(
          `Recettes hors scope pays ${country} ignorées : ${rejected.join(', ')}`
        )
      }
    }

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
    // L'objet d'erreur en troisième argument : c'est lui qui part dans Sentry (lib/logger), pas le contexte.
    logger.error('ai-extract-and-compute failed', { module: 'estimation-materiaux' }, e)
    return NextResponse.json({ error: MESSAGE_ECHEC[langue] }, { status: 500 })
  }
}
