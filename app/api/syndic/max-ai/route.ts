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
  getRefusalMessage,
} from '@/lib/syndic/max-strict-prompt'
import { validateMaxResponse, type MaxValidatedCitation } from '@/lib/syndic/max-validate'
import { getSecret, getCfEnv } from '@/lib/env'

export const maxDuration = 30

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
// Pipeline : Embed → Hybrid search (vector + BM25 + ILIKE fallback) → Rerank →
// MMR → Prompt strict JSON → Validation → Response.
// Budget 30s Worker : single LLM attempt, no HyDE, no retry.

// HyDE rewriter désactivé : le coût en latence (~2-5s Groq + embed supplémentaire)
// est incompatible avec le budget de 30s du Worker. Le recall du retrieval est
// suffisant avec le hybrid search (vector + BM25 + ILIKE fallback).

// ─────────────────────────────────────────────────────────────────────────────
// Route principale
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const GROQ_API_KEY = await getSecret('GROQ_API_KEY')

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

    // ── Diagnostic : taille du corpus (log uniquement) ──
    const { count: corpusSize } = await supabaseAdmin
      .from(isPt ? 'syndic_legal_corpus_pt' : 'syndic_legal_corpus_fr')
      .select('id', { count: 'exact', head: true })
    logger.info('[max-ai] corpus check', {
      language: ragLanguage,
      corpus_size: corpusSize ?? 0,
      groq_key_present: !!GROQ_API_KEY,
    })

    // ── 1. Retrieval : Hybrid search (vector + BM25 + ILIKE fallback) ──
    let aiBinding: unknown = null
    try {
      const cfEnv = await getCfEnv()
      aiBinding = (cfEnv as Record<string, unknown>).AI ?? null
    } catch { /* non-bloquant */ }

    const chunks = await retrieveLegalChunks(supabaseAdmin, message, ragLanguage, {
      aiBinding: aiBinding ?? undefined,
    })

    // ── 2. Aucun chunk pertinent → refus formaté (corpus gap) ──
    if (chunks.length === 0) {
      logger.info('[max-ai] corpus gap — returning refusal', {
        query: message.slice(0, 80),
        language: ragLanguage,
        corpus_size: corpusSize ?? 0,
      })
      return NextResponse.json({
        response: getRefusalMessage(ragLanguage),
        citations: [],
        confidence: 0,
        refusal: true,
        retrieval: { chunks_found: 0, corpus_size: corpusSize ?? 0 },
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

    // ── 4. Appel LLM (Groq primary, Cerebras fallback) — single attempt ──
    // maxRetries: 0 pour éviter les délais de retry internes (429 backoff).
    // disableCerebrasFallback: true — on gère le fallback nous-mêmes pour le tracing.
    let groqData: GroqResponse
    let providerUsed: 'groq' | 'cerebras' = 'groq'
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
              provider: 'groq',
              ...(evalRunId ? { eval_run_id: evalRunId } : {}),
            },
          },
          () => callGroqWithRetry({
            messages,
            temperature: 0.1,
            max_tokens: 3500,
            response_format: { type: 'json_object' },
          }, { apiKey: GROQ_API_KEY, maxRetries: 0, disableCerebrasFallback: true }),
        )
        providerUsed = 'groq'
      } catch (groqErr) {
        if (!hasCerebrasKey()) throw groqErr
        logger.warn('[max-ai] Groq failed, fallback to Cerebras', {
          error: groqErr instanceof Error ? groqErr.message : String(groqErr),
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
          }, { maxRetries: 0 }),
        )
        providerUsed = 'cerebras'
      }
    } catch (err) {
      logger.error('[max-ai] LLM call failed (Groq + Cerebras)', {
        error: err instanceof Error ? err.message : String(err),
      })
      return NextResponse.json({
        response: getRefusalMessage(ragLanguage),
        citations: [],
        confidence: 0,
        refusal: true,
        error: 'llm_unreachable',
      })
    }

    const rawJson = groqData.choices?.[0]?.message?.content ?? ''
    const validated = validateMaxResponse(rawJson, chunks, ragLanguage)

    if (!validated.ok) {
      logger.warn('[max-ai] validation failed', {
        reasons: validated.reasons.slice(0, 5),
      })
      // Return the answer anyway if we got one — better than silent refusal
      if (validated.answer && validated.answer.length > 20) {
        logger.info('[max-ai] returning unvalidated answer (soft pass)')
      } else {
        return NextResponse.json({
          response: getRefusalMessage(ragLanguage),
          citations: [],
          confidence: 0,
          refusal: true,
          error: 'validation_failed',
          debug: process.env.NODE_ENV === 'development' ? validated.reasons : undefined,
        })
      }
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
