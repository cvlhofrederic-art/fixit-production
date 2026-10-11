// app/api/administrateur-judiciaire/agent/route.ts
//
// Agents IA de la succursale Administrateur judiciaire (Fixy, Max, Léa, Tempo, Alfredo) sur Claude Sonnet 5.5.
// L'application est servie depuis la base locale du navigateur : le client envoie la question, l'historique
// de la conversation et un résumé de ses données (cf. construireContexteAgent). Données personnelles
// masquées avant l'envoi au modèle, rétablies dans la réponse.
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase-server-component'
import { isSyndicRole } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { getSecret } from '@/lib/env'
import { callClaudeWithRetry, hasAnthropicKey } from '@/lib/claude'
import { traceAgent } from '@/lib/langfuse'
import { sanitizeContextForLLM, resolveSanitizedToken } from '@/lib/ai/sanitize-context'
import { construirePromptSystemeAJ } from '@/lib/administrateur-judiciaire/ia/prompts'

/** Taille maximale du contexte sérialisé (caractères) : au-delà, la requête est refusée. */
const TAILLE_MAX_CONTEXTE = 60_000

const BodySchema = z.object({
  agent: z.enum(['fixy', 'max', 'lea', 'tempo', 'alfredo']),
  message: z.string().trim().min(1).max(4000),
  historique: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(6000) }))
    .max(20)
    .default([]),
  contexte: z.record(z.string(), z.unknown()).default({}),
})

export async function POST(req: NextRequest) {
  const ip = getClientIP(req)
  if (!(await checkRateLimit(`aj-agent:${ip}`, 30, 60_000))) return rateLimitResponse()

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !isSyndicRole(user)) {
    return NextResponse.json({ error: 'non_autorise' }, { status: 401 })
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'requete_invalide' }, { status: 400 })
  const { agent, message, historique, contexte } = parsed.data

  const contexteJson = JSON.stringify(contexte)
  if (contexteJson.length > TAILLE_MAX_CONTEXTE) {
    return NextResponse.json({ error: 'contexte_trop_volumineux' }, { status: 413 })
  }
  if (!(await hasAnthropicKey()) && !(await getSecret('GROQ_API_KEY'))) {
    return NextResponse.json({ error: 'ia_indisponible' }, { status: 503 })
  }

  // Contexte, historique et question masqués ensemble (même table de jetons) : les réponses précédentes,
  // démasquées pour l’utilisateur, reviennent dans l’historique.
  const { sanitized, tokenMap } = sanitizeContextForLLM({ contexte, historique, message })
  const dateDuJour = typeof contexte.dateDuJour === 'string' ? contexte.dateDuJour : new Date().toISOString().slice(0, 10)
  const systeme = construirePromptSystemeAJ(agent, JSON.stringify(sanitized.contexte, null, 1), dateDuJour)

  try {
    const reponse = await traceAgent(
      { agent_id: `aj-${agent}`, user_id: user.id, prompt: message, metadata: { succursale: 'administrateur-judiciaire' } },
      () =>
        callClaudeWithRetry(
          {
            messages: [
              { role: 'system', content: systeme },
              ...sanitized.historique,
              { role: 'user', content: sanitized.message },
            ],
            max_tokens: 1800,
          },
          // Max (questions de droit) réfléchit davantage ; les autres restent rapides. Le prompt (données de
          // l'écran) est identique d'une question à l'autre d'une conversation : mis en cache.
          { effort: agent === 'max' ? 'medium' : 'low', cacheSysteme: true },
        ),
    )
    const brut = reponse.choices?.[0]?.message?.content?.trim() ?? ''
    if (!brut) return NextResponse.json({ error: 'reponse_vide' }, { status: 502 })
    const texte = resolveSanitizedToken(brut, tokenMap) ?? brut
    return NextResponse.json({ text: texte, modele: reponse.model ?? null })
  } catch (err) {
    logger.error('[administrateur-judiciaire/agent] échec de l’appel IA', {
      agent,
      erreur: err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200),
    })
    return NextResponse.json({ error: 'ia_indisponible' }, { status: 502 })
  }
}
