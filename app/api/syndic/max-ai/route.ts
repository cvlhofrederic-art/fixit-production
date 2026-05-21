import { NextResponse, type NextRequest } from 'next/server'
import { getAuthUser, getUserRole, isSyndicRole } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { callGroqWithRetry, type GroqResponse } from '@/lib/groq'
import { callCerebrasWithRetry, hasCerebrasKey } from '@/lib/cerebras'
import { logger } from '@/lib/logger'
import { traceAgent } from '@/lib/langfuse'
import { validateBody, syndicMaxAiSchema } from '@/lib/validation'
import { sanitizeContextForLLM, resolveSanitizedToken } from '@/lib/ai/sanitize-context'
import type { MaxPromptContext } from '@/lib/syndic/prompts/max/system-prompt-fr'
import { supabaseAdmin } from '@/lib/supabase-server'
import { retrieveLegalChunks } from '@/lib/syndic/max-legal-rag'
import {
  buildMaxStrictSystemPrompt,
  buildHyDEPrompt,
  getRefusalMessage,
} from '@/lib/syndic/max-strict-prompt'
import { validateMaxResponse, type MaxValidatedCitation } from '@/lib/syndic/max-validate'

export const maxDuration = 30

const GROQ_API_KEY = process.env.GROQ_API_KEY || ''

// Cache module-level de l'índice (TOC) du corpus PT. Lu une fois au cold-start
// du Worker, invalidation au prochain redéploiement (durée de vie de l'isolate).
// Stratégie hybride Anthropic : la TOC est pré-chargée dans le system prompt,
// pas récupérée via retrieval — le chunk parent_path='__TOC__' est exclu du RPC.
let _cachedTocPt: string | null = null

async function loadTocPt(): Promise<string | null> {
  if (_cachedTocPt !== null) return _cachedTocPt
  try {
    const { data, error } = await supabaseAdmin
      .from('syndic_legal_corpus_pt')
      .select('content')
      .eq('parent_path', '__TOC__')
      .limit(1)
      .maybeSingle()
    if (error) {
      logger.warn('[max-ai] TOC load failed (non-bloquant)', { error: error.message })
      return null
    }
    _cachedTocPt = (data?.content as string) ?? null
    return _cachedTocPt
  } catch (err) {
    logger.warn('[max-ai] TOC load exception (non-bloquant)', {
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

// ── Max — Consultor juridique strict (Plan 2026) ────────────────────────────
// Pipeline anti-hallucination :
//  1. Embed la question + HyDE rewrite (LLM rapide)
//  2. Hybrid search PT (vector + BM25 RRF) sur syndic_legal_corpus_pt
//  3. Rerank cross-encoder + MMR diversité
//  4. Si 0 chunks pertinents → refus formaté (corpus gap)
//  5. Prompt strict + JSON mode + tool calling structuré
//  6. Validation post-gen : chunk_id existence + quote literal + coverage + cross-locale
//  7. Retry une fois si validation échoue, sinon refusal de secours
//
// Réponse : { response: string, citations: Citation[], confidence, refusal }

// ─────────────────────────────────────────────────────────────────────────────
// HyDE rewriter — appel Groq très court (~500ms) pour générer une réponse
// hypothétique qu'on embed pour augmenter le recall du retrieval.
// ─────────────────────────────────────────────────────────────────────────────
async function generateHyDE(query: string, locale: 'fr' | 'pt'): Promise<string | null> {
  try {
    const data = await callGroqWithRetry({
      messages: [
        { role: 'user', content: buildHyDEPrompt(query, locale) },
      ],
      temperature: 0.2,
      max_tokens: 300,
      model: 'llama-3.1-8b-instant', // petit modèle rapide pour HyDE
    })
    return data.choices?.[0]?.message?.content?.trim() ?? null
  } catch (err) {
    logger.warn('[max-ai] HyDE generation failed (non-bloquant)', {
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Route principale
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(ip, 40, 60_000))) {
      return rateLimitResponse()
    }

    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = getUserRole(user) || 'syndic'

    // Tag d'observabilité pour les évals : le header X-Eval-Run-Id permet de
    // filtrer les traces Langfuse appartenant à une passe d'évaluation
    // particulière (cf. docs/agent-max/evals/). En production normale, header
    // absent → tag null, traces dans le flux habituel.
    const evalRunId = request.headers.get('x-eval-run-id') || null

    const rawBody = await request.json()
    const v = validateBody(syndicMaxAiSchema, rawBody)
    if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })
    const { message, conversation_history = [], locale } = v.data
    const ragLanguage: 'fr' | 'pt' = locale === 'pt' ? 'pt' : 'fr'
    const isPt = ragLanguage === 'pt'

    // Le contexte syndic est utilisé uniquement pour la sanitization PII.
    // Le nouveau pipeline strict n'injecte PAS les stats/missions/etc. dans le
    // prompt de Max — uniquement les chunks juridiques retrievés. Cela évite
    // les hallucinations basées sur du contexte hors-sujet.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const syndic_context = (v.data.syndic_context || {}) as Record<string, any>
    const { tokenMap } = sanitizeContextForLLM(syndic_context as MaxPromptContext)

    if (!GROQ_API_KEY) {
      // Cas pathologique : la clé Groq n'est pas configurée côté Worker.
      // On retourne un refusal explicite (pas un fallback marketing).
      return NextResponse.json({
        response: getRefusalMessage(ragLanguage),
        citations: [],
        confidence: 0,
        refusal: true,
        error: 'groq_api_key_missing',
      })
    }

    // ── 1. Retrieval multi-étapes : HyDE + Hybrid + Rerank + MMR ──
    const hydeQuery = await generateHyDE(message, ragLanguage)
    const chunks = await retrieveLegalChunks(supabaseAdmin, message, ragLanguage, {
      hydeQuery: hydeQuery ?? undefined,
    })

    // ── 2. Aucun chunk pertinent → refus formaté (corpus gap) ──
    if (chunks.length === 0) {
      logger.info('[max-ai] corpus gap — returning refusal', {
        query: message.slice(0, 80),
        language: ragLanguage,
        hyde_used: !!hydeQuery,
      })
      return NextResponse.json({
        response: getRefusalMessage(ragLanguage),
        citations: [],
        confidence: 0,
        refusal: true,
        retrieval: { chunks_found: 0, hyde_used: !!hydeQuery },
      })
    }

    // ── 3. Construction du prompt strict avec chunks injectés ──
    // Pré-chargement de l'índice (TOC) pour la stratégie hybride Anthropic :
    // Max sait toujours quelles matières la base couvre avant de répondre.
    const tocContent = isPt ? await loadTocPt() : null
    const systemPrompt = buildMaxStrictSystemPrompt({
      chunks,
      locale: ragLanguage,
      userRole,
      tocContent: tocContent ?? undefined,
    })

    // Historique conversation (limité) — sans le contexte syndic (anti-hallu)
    const limitedHistory = Array.isArray(conversation_history) ? conversation_history.slice(-12) : []
    const historyMessages = limitedHistory
      .filter((m: { role?: string; content?: string }) => m.role && m.content)
      .map((m: { role: string; content: string }) => ({
        role: m.role,
        content: String(m.content).substring(0, 2000),
      }))

    const messages = [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      { role: 'user', content: message },
    ]

    // ── 4. Appel LLM (Groq primary, Cerebras fallback) avec JSON mode strict ──
    // Le system prompt v1.1 PT (XML + TOC + 6 chunks) peut dépasser les 6K TPM
    // du free tier Groq llama-3.3-70b → 413 instantané. Si Groq plante ET que
    // CEREBRAS_API_KEY est configurée, on bascule sur Cerebras Inference (même
    // famille de modèles, free tier nettement plus large, API OpenAI-compat).
    let groqData: GroqResponse
    let providerUsed: 'groq' | 'cerebras' = 'groq'
    let validated: ReturnType<typeof validateMaxResponse> | null = null
    let attempt = 0
    const MAX_ATTEMPTS = 2

    while (attempt < MAX_ATTEMPTS) {
      attempt++
      try {
        try {
          groqData = await traceAgent(
            {
              agent_id: 'max',
              user_id: user.id,
              conversation_id: rawBody.conversation_id,
              prompt: message,
              metadata: {
                locale: ragLanguage,
                chunks_found: chunks.length,
                hyde_used: !!hydeQuery,
                attempt,
                provider: 'groq',
                ...(evalRunId ? { eval_run_id: evalRunId } : {}),
              },
            },
            () => callGroqWithRetry({
              messages,
              temperature: 0.1,
              max_tokens: 3500,
              response_format: { type: 'json_object' },
            }),
          )
          providerUsed = 'groq'
        } catch (groqErr) {
          if (!hasCerebrasKey()) throw groqErr
          logger.warn('[max-ai] Groq failed, fallback to Cerebras', {
            error: groqErr instanceof Error ? groqErr.message : String(groqErr),
            attempt,
          })
          groqData = await traceAgent(
            {
              agent_id: 'max',
              user_id: user.id,
              conversation_id: rawBody.conversation_id,
              prompt: message,
              metadata: {
                locale: ragLanguage,
                chunks_found: chunks.length,
                hyde_used: !!hydeQuery,
                attempt,
                provider: 'cerebras',
                groq_error: (groqErr instanceof Error ? groqErr.message : String(groqErr)).slice(0, 200),
                ...(evalRunId ? { eval_run_id: evalRunId } : {}),
              },
            },
            () => callCerebrasWithRetry({
              messages,
              temperature: 0.1,
              max_tokens: 3500,
              response_format: { type: 'json_object' },
            }),
          )
          providerUsed = 'cerebras'
        }
      } catch (err) {
        logger.error('[max-ai] LLM call failed (Groq + Cerebras)', {
          error: err instanceof Error ? err.message : String(err),
          attempt,
        })
        if (attempt >= MAX_ATTEMPTS) {
          return NextResponse.json({
            response: getRefusalMessage(ragLanguage),
            citations: [],
            confidence: 0,
            refusal: true,
            error: 'llm_unreachable',
          })
        }
        continue
      }

      const rawJson = groqData.choices?.[0]?.message?.content ?? ''
      validated = validateMaxResponse(rawJson, chunks, ragLanguage)

      if (validated.ok) {
        break
      }
      // Si validation échoue, on retry avec un message d'erreur pour le LLM
      logger.warn('[max-ai] validation failed, retrying', {
        attempt,
        reasons: validated.reasons.slice(0, 3),
      })
      if (attempt < MAX_ATTEMPTS) {
        messages.push(
          { role: 'assistant', content: rawJson },
          {
            role: 'user',
            content: isPt
              ? `A tua resposta foi rejeitada pelo sistema de validação porque: ${validated.reasons.join('; ')}. Reformula respeitando ESTRITAMENTE as fontes [FONT-X] e o formato JSON.`
              : `Ta réponse a été rejetée par le système de validation car : ${validated.reasons.join('; ')}. Reformule en respectant STRICTEMENT les sources [FONT-X] et le format JSON.`,
          },
        )
      }
    }

    // ── 5. Si validation finale échoue → refus de secours ──
    if (!validated || !validated.ok) {
      logger.error('[max-ai] validation failed after retries — refusing', {
        reasons: validated?.reasons ?? ['unknown'],
      })
      return NextResponse.json({
        response: getRefusalMessage(ragLanguage),
        citations: [],
        confidence: 0,
        refusal: true,
        error: 'validation_failed',
        debug: process.env.NODE_ENV === 'development' ? validated?.reasons : undefined,
      })
    }

    // ── 6. Résolution finale des tokens PII (sécurité défense en profondeur) ──
    const finalAnswer = resolveSanitizedToken(validated.answer, tokenMap) ?? validated.answer

    // ── 7. Calcul confidence (moyenne des rerankScore des chunks utilisés) ──
    const usedFontIds = new Set(validated.citations.map((c) => c.font_id))
    const usedChunks = chunks.filter((c, i) => usedFontIds.has(`FONT-${i + 1}`))
    const confidence = usedChunks.length > 0
      ? usedChunks.reduce((s, c) => s + c.score, 0) / usedChunks.length
      : 0

    return NextResponse.json({
      response: finalAnswer,
      citations: validated.citations,
      confidence: Number(confidence.toFixed(3)),
      refusal: validated.refusal,
      role: userRole,
      provider: providerUsed,
      retrieval: {
        chunks_found: chunks.length,
        chunks_cited: validated.citations.length,
        hyde_used: !!hydeQuery,
        // Identifiants des chunks effectivement injectés au LLM — utile pour
        // le replay côté évals (cf. docs/agent-max/evals/run-evals.ts) et le
        // debug Langfuse. Pas de fuite PII (les ids sont des uuid v4).
        chunk_ids: chunks.map((c) => c.id),
        ...(evalRunId ? { eval_run_id: evalRunId } : {}),
      },
    })
  } catch (err: unknown) {
    logger.error('[max-ai] unexpected error', {
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({
      response: getRefusalMessage('pt'),
      citations: [],
      confidence: 0,
      refusal: true,
      error: 'internal_error',
    }, { status: 500 })
  }
}

// Suppress unused export warning for MaxValidatedCitation (used by frontend)
export type { MaxValidatedCitation }
