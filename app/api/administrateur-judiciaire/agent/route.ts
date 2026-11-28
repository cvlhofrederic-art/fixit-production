// app/api/administrateur-judiciaire/agent/route.ts
//
// Agents IA de la succursale Administrateur judiciaire (Fixy, Max, Léa, Tempo, Alfredo) sur Claude Sonnet 5.5.
// L'application est servie depuis la base locale du navigateur : le client envoie la question, l'historique
// de la conversation et un résumé de ses données (cf. construireContexteAgent). Avant l'envoi au modèle, noms des
// personnes et des prestataires remplacés par des pseudonymes (lib/administrateur-judiciaire/ia/pseudonymes.ts) et
// autres données personnelles masquées ; vrais noms et données rétablis dans la réponse.
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
import { pseudonymiserNoms } from '@/lib/administrateur-judiciaire/ia/pseudonymes'

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

/**
 * Métadonnées de la trace Langfuse : des nombres, aucun texte (question, historique, contexte, réponse) ; ces textes
 * portent des noms de débiteurs et des montants dus que le masquage ne couvre pas. L'évaluation nocturne
 * (langfuse-eval.yml) ne lit que le nom des traces et leur statut.
 */
function metadonneesTrace({ agent, message, historique, contexte }: z.infer<typeof BodySchema>, tailleContexte: number) {
  return {
    succursale: 'administrateur-judiciaire',
    agent,
    longueurQuestion: message.length,
    echangesPrecedents: historique.length,
    tailleContexte,
    elementsContexte: Object.values(contexte).reduce<number>((n, v) => n + (Array.isArray(v) ? v.length : 0), 0),
  }
}

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
  // Noms des personnes et des prestataires → pseudonymes (« Copropriétaire 1 »…), dans le contexte, l'historique et la
  // question (décision du 20/11/2026). La correspondance ne vit que dans `retablirNoms`, le temps de la requête : elle
  // ne va ni au journal ni à Langfuse, qui ne reçoit que des nombres (metadonneesTrace).
  const { donnees: envoi, retablir: retablirNoms } = pseudonymiserNoms(sanitized, sanitized.contexte)
  const dateDuJour = typeof contexte.dateDuJour === 'string' ? contexte.dateDuJour : new Date().toISOString().slice(0, 10)
  const systeme = construirePromptSystemeAJ(agent, JSON.stringify(envoi.contexte, null, 1), dateDuJour)

  try {
    const reponse = await traceAgent(
      {
        agent_id: `aj-${agent}`,
        user_id: user.id,
        metadonneesSeules: true,
        metadata: metadonneesTrace(parsed.data, contexteJson.length),
      },
      () =>
        callClaudeWithRetry(
          {
            messages: [
              { role: 'system', content: systeme },
              ...envoi.historique,
              { role: 'user', content: envoi.message },
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
    const texte = retablirNoms(resolveSanitizedToken(brut, tokenMap) ?? brut)
    return NextResponse.json({ text: texte, modele: reponse.model ?? null })
  } catch (err) {
    logger.error('[administrateur-judiciaire/agent] échec de l’appel IA', {
      agent,
      erreur: err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200),
    })
    return NextResponse.json({ error: 'ia_indisponible' }, { status: 502 })
  }
}
