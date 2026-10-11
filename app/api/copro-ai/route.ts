import { NextResponse, type NextRequest } from 'next/server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { callClaudeWithRetry, callClaudeStreaming, hasAnthropicKey } from '@/lib/claude'
import { getSecret } from '@/lib/env'
import { getAuthUser } from '@/lib/auth-helpers'
import { logger } from '@/lib/logger'
import { validateBody, coproAiSchema } from '@/lib/validation'
import { construirePromptCopro, langueCopro, type LangueCopro } from '@/lib/copro-ia-contexte'

export const maxDuration = 30

// Réponses de secours (sans IA), dans la langue de l'espace Copropriétaire.
const REPONSES: Record<LangueCopro, { indisponible: string; probleme: string; vide: string; erreur: string }> = {
  fr: {
    indisponible: '⚠️ Service IA temporairement indisponible. Veuillez réessayer plus tard.',
    probleme: 'Je rencontre un problème technique. Réessayez dans quelques instants.',
    vide: 'Désolée, je n\'ai pas pu générer une réponse.',
    erreur: 'Une erreur est survenue. Veuillez réessayer.',
  },
  pt: {
    indisponible: '⚠️ Serviço de IA temporariamente indisponível. Tente novamente mais tarde.',
    probleme: 'Estou com um problema técnico. Tente novamente dentro de instantes.',
    vide: 'Desculpe, não consegui gerar uma resposta.',
    erreur: 'Ocorreu um erro. Tente novamente.',
  },
}

export async function POST(request: NextRequest) {
  let langue: LangueCopro = 'fr'
  try {
    // Rate limiting — 30 req/min
    const ip = getClientIP(request)
    if (!(await checkRateLimit(ip, 30, 60_000))) return rateLimitResponse()

    // ── Auth obligatoire ──
    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const body = await request.json()
    const v = validateBody(coproAiSchema, body)
    if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })
    const { messages, stream, locale } = v.data
    langue = langueCopro(locale)
    const R = REPONSES[langue]

    // Clés lues à la requête : sur Cloudflare, les secrets ne sont pas toujours
    // dans process.env au chargement du module (cf. lib/env.ts).
    if (!(await getSecret('GROQ_API_KEY')) && !(await hasAnthropicKey())) {
      return NextResponse.json({ reply: R.indisponible })
    }

    // SÉCURITÉ : system prompt construit côté serveur uniquement (le
    // systemPrompt client est supprimé — injection de prompt, audit 2026-06-10).
    // Il contient les données de la copropriété affichées dans l'espace
    // (lib/copro-ia-contexte.ts) : Fixy répond avec elles, sans rien inventer.
    // Défense en profondeur : les rôles client sont coercés user/assistant même
    // si le schéma Zod les restreint déjà.
    const groqMessages = [
      { role: 'system', content: construirePromptCopro(langue) },
      ...messages.slice(-20).map((m: { role: string; content: string }) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
    ]

    // ── Mode streaming SSE ──
    if (stream) {
      try {
        const sseStream = await callClaudeStreaming({
          messages: groqMessages,
          temperature: 0.2,
          max_tokens: 3000,
        }, { cacheSysteme: true })
        return new Response(sseStream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        })
      } catch (err) {
        logger.error('[copro-ai] Streaming error:', err)
        return NextResponse.json({ reply: R.probleme }, { status: 500 })
      }
    }

    // ── Mode classique (rétrocompatibilité) ──
    try {
      const groqData = await callClaudeWithRetry({
        messages: groqMessages,
        temperature: 0.2,
        max_tokens: 3000,
      }, { cacheSysteme: true })
      const reply = groqData.choices?.[0]?.message?.content || R.vide
      return NextResponse.json({ reply })
    } catch (err) {
      logger.error('[copro-ai] LLM error:', err)
      return NextResponse.json({ reply: R.probleme }, { status: 500 })
    }

  } catch (error: unknown) {
    logger.error('[copro-ai] Error:', error)
    return NextResponse.json({ reply: REPONSES[langue].erreur }, { status: 500 })
  }
}
