import { NextResponse, type NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { callClaudeWithRetry, callClaudeStreaming, hasAnthropicKey } from '@/lib/claude'
import { getSecret } from '@/lib/env'
import { getAuthUser } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import { validateBody, coproAiSchema } from '@/lib/validation'
import { construirePromptCopro, langueCopro, type LangueCopro } from '@/lib/copro-ia-contexte'
import { estSuperAdmin, resoudreCoproprietaire } from '@/lib/coproprietaire/acces'
import { lireEspaceCopro } from '@/lib/coproprietaire/lecture'
import { espaceDemo } from '@/lib/coproprietaire/demo'
import type { EspaceCopro } from '@/lib/coproprietaire/types'

export const maxDuration = 30

// ── POST /api/copro-ai ───────────────────────────────────────────────────────
// Fixy, l'assistant de l'espace copropriétaire. Le prompt système est construit
// côté serveur (lib/copro-ia-contexte.ts) à partir de l'espace du compte connecté :
//   - copropriétaire ou locataire rattaché à une fiche du syndic → ses vraies données
//     (lib/coproprietaire/lecture.ts, mêmes lectures et filtres que /api/coproprietaire/espace) ;
//   - super admin → la fiche de son cabinet désignée par `email` (ou la première), sinon
//     la démonstration (espaceDemo()) ;
//   - compte sans fiche, ou d'un autre espace (syndic, artisan…) → 403 { error: code }.
// Le navigateur n'envoie aucun prompt (audit anti-injection du 2026-06-10).

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

type EspaceOuRefus = { ok: true; espace: EspaceCopro } | { ok: false; reponse: NextResponse }

/**
 * Espace décrit à Fixy pour le compte connecté. Le super admin sans fiche reçoit la
 * démonstration ; un copropriétaire sans fiche (ou un autre rôle) est refusé avec le code
 * d'accès, comme sur le portail. Une panne de la base est rendue par un 500.
 */
async function espacePour(user: User, email: string | undefined, lot: string | undefined): Promise<EspaceOuRefus> {
  const superAdmin = estSuperAdmin(user)
  const acces = await resoudreCoproprietaire(user, supabaseAdmin, { email: superAdmin ? email : undefined, coproprioId: lot })
  if (acces.ok) return { ok: true, espace: await lireEspaceCopro(acces.acces, supabaseAdmin) }
  if (acces.code === 'erreur') {
    return { ok: false, reponse: NextResponse.json({ error: acces.code }, { status: 500 }) }
  }
  if (superAdmin) {
    logger.info('[copro-ai] super admin sans fiche : espace de démonstration', { code: acces.code })
    return { ok: true, espace: espaceDemo() }
  }
  return { ok: false, reponse: NextResponse.json({ error: acces.code }, { status: 403 }) }
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
    const { messages, stream, locale, email, lot } = v.data
    langue = langueCopro(locale)
    const R = REPONSES[langue]

    // Clés lues à la requête : sur Cloudflare, les secrets ne sont pas toujours
    // dans process.env au chargement du module (cf. lib/env.ts).
    if (!(await getSecret('GROQ_API_KEY')) && !(await hasAnthropicKey())) {
      return NextResponse.json({ reply: R.indisponible })
    }

    // ── Espace du compte : vraies données du syndic, ou démonstration (super admin) ──
    const resultat = await espacePour(user, email, lot)
    if (!resultat.ok) return resultat.reponse

    // SÉCURITÉ : system prompt construit côté serveur uniquement (le
    // systemPrompt client est supprimé — injection de prompt, audit 2026-06-10).
    // Il décrit l'espace affiché au copropriétaire (lib/copro-ia-contexte.ts) :
    // Fixy répond avec ces données, sans rien inventer. Défense en profondeur :
    // les rôles client sont coercés user/assistant même si le schéma Zod les
    // restreint déjà.
    const groqMessages = [
      { role: 'system', content: construirePromptCopro(langue, resultat.espace) },
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
