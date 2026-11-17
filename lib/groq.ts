// ── Shared Groq API helper with retry 429 + model fallback ──────────────────
//
// Inter-provider fallback : si Groq plante (rate-limit, network, etc.) ET que
// CEREBRAS_API_KEY est configurée, on bascule transparentement sur Cerebras
// Inference. Activé pour `callGroqWithRetry` et `callGroqWithTools` ; le
// streaming SSE reste sur Groq (pas de bascule mid-stream).
//
// Désactivable cas par cas via `config.disableCerebrasFallback: true` (utile
// pour les évals où l'on veut tester un provider précis).
//
// Modèles par défaut : `lib/constants.ts` (gpt-oss depuis le retrait des Llama
// par Groq). gpt-oss raisonne avant de répondre : budget majoré et effort `low`
// par défaut (`lib/ai/raisonnement.ts`). Relais des agents artisan / BTP par
// Workers AI quand Groq échoue : `lib/ai/relais.ts`.

import { GROQ_API_URL, GROQ_MODEL_PRIMARY, GROQ_MODEL_FALLBACK } from '@/lib/constants'
import { callCerebrasWithRetry, callCerebrasWithTools, hasCerebrasKey } from '@/lib/cerebras'
import { parametresRaisonnement, type EffortRaisonnement } from '@/lib/ai/raisonnement'
import { delaiApres429 } from '@/lib/ai/reessai'

const GROQ_URL = GROQ_API_URL

/** Échéance passée (aucune échéance : jamais). */
function echeanceDepassee(echeance: number | undefined): boolean {
  return echeance !== undefined && Date.now() >= echeance
}

/** Délai d'un appel : le délai habituel, ou le temps qui reste avant l'échéance s'il est plus court (1 s au moins). */
function delaiAppel(habituel: number, echeance: number | undefined): number {
  return echeance === undefined ? habituel : Math.max(1000, Math.min(habituel, echeance - Date.now()))
}

/** Une attente après un 429 qui finirait après l'échéance : inutile, on passe au modèle suivant. */
function attenteDepasseEcheance(attenteMs: number, echeance: number | undefined): boolean {
  return echeance !== undefined && Date.now() + attenteMs >= echeance
}

export interface GroqMessage {
  role: string
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> | null
  // Optional: pass-through for tool-calling round-trips. Required when role='tool'.
  tool_call_id?: string
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>
  name?: string
}

export interface GroqCallOptions {
  model?: string
  messages: GroqMessage[]
  temperature?: number
  /** Budget de la réponse ; pour un modèle qui raisonne (gpt-oss), la marge de raisonnement s'y ajoute. */
  max_tokens?: number
  response_format?: { type: string }
  /** Effort de raisonnement des modèles gpt-oss (défaut `low`) ; ignoré par les autres modèles, Claude et Workers AI. */
  reasoning_effort?: EffortRaisonnement
}

export interface GroqResponse {
  choices: { message: { content: string }; finish_reason?: string }[]
  usage?: { total_tokens: number; prompt_tokens: number; completion_tokens: number }
  model?: string
}

/**
 * Call Groq API with automatic retry on 429 (rate limit) and model fallback.
 *
 * - Retries up to `maxRetries` times per model on 429 with exponential backoff
 * - Falls back to `fallbackModel` (GROQ_MODEL_FALLBACK, gpt-oss-20b) if the primary model fails
 * - Throws on all other errors after exhausting attempts
 */
export async function callGroqWithRetry(
  opts: GroqCallOptions,
  // echeance : horodatage (ms) au-delà duquel plus aucun essai ne part et l'appel en cours est coupé.
  config: { maxRetries?: number; fallbackModel?: string; apiKey?: string; disableCerebrasFallback?: boolean; echeance?: number } = {}
): Promise<GroqResponse> {
  const apiKey = config.apiKey || process.env.GROQ_API_KEY || ''
  // Si Groq n'est pas configuré mais Cerebras l'est, on saute direct sur Cerebras.
  if (!apiKey) {
    if (!config.disableCerebrasFallback && hasCerebrasKey()) {
      return callCerebrasWithRetry({
        messages: opts.messages,
        temperature: opts.temperature,
        max_tokens: opts.max_tokens,
        response_format: opts.response_format,
        reasoning_effort: opts.reasoning_effort,
      }, { maxRetries: config.maxRetries })
    }
    throw new Error('GROQ_API_KEY not configured')
  }

  const maxRetries = config.maxRetries ?? 2
  const primaryModel = opts.model || GROQ_MODEL_PRIMARY
  const fallbackModel = config.fallbackModel || GROQ_MODEL_FALLBACK
  const models = primaryModel === fallbackModel ? [primaryModel] : [primaryModel, fallbackModel]

  let lastError: Error | null = null

  for (const currentModel of models) {
    if (echeanceDepassee(config.echeance)) break
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (echeanceDepassee(config.echeance)) {
        lastError ??= new Error('Groq: échéance dépassée')
        break
      }
      try {
        const res = await fetch(GROQ_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: currentModel,
            messages: opts.messages,
            temperature: opts.temperature ?? 0.2,
            ...parametresRaisonnement(currentModel, opts.max_tokens ?? 3000, opts.reasoning_effort),
            ...(opts.response_format ? { response_format: opts.response_format } : {}),
          }),
          signal: AbortSignal.timeout(delaiAppel(25000, config.echeance)), // 25s timeout, ou moins avant l'échéance
        })

        if (res.ok) return res.json()

        if (res.status === 429) {
          lastError = new Error(`Groq 429 on ${currentModel}`)
          const waitMs = delaiApres429(res.headers.get('retry-after'), attempt, maxRetries)
          if (waitMs === null || attenteDepasseEcheance(waitMs, config.echeance)) {
            console.warn(`[groq] 429 on ${currentModel}, next model or provider`)
            break
          }
          console.warn(`[groq] 429 on ${currentModel}, retry ${attempt + 1}/${maxRetries}, wait ${waitMs}ms`)
          await new Promise(r => setTimeout(r, waitMs))
          continue
        }

        // Non-429 error — log and try next model
        const errText = await res.text().catch(() => '')
        console.error(`[groq] Error ${res.status} on ${currentModel}:`, errText.substring(0, 200))
        lastError = new Error(`Groq ${res.status}: ${errText.substring(0, 100)}`)
        break // Don't retry non-429 errors, move to fallback model
      } catch (fetchErr: unknown) {
        const errMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
        console.error(`[groq] Fetch error on ${currentModel}:`, errMsg)
        lastError = fetchErr instanceof Error ? fetchErr : new Error(errMsg)
        break
      }
    }
  }

  // Tous les modèles Groq ont échoué → fallback Cerebras si dispo.
  if (!config.disableCerebrasFallback && hasCerebrasKey()) {
    console.warn('[groq] all attempts failed, fallback to Cerebras', {
      groqError: lastError?.message,
    })
    return callCerebrasWithRetry({
      messages: opts.messages,
      temperature: opts.temperature,
      max_tokens: opts.max_tokens,
      response_format: opts.response_format,
      reasoning_effort: opts.reasoning_effort,
    }, { maxRetries: config.maxRetries })
  }

  throw lastError || new Error('All Groq API attempts failed')
}

/**
 * Call Groq API with streaming (SSE). Returns a ReadableStream of text chunks.
 *
 * - Retry 429 + model fallback (same logic as callGroqWithRetry)
 * - Each chunk is a text delta from the streaming response
 * - Use with: new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } })
 */
export async function callGroqStreaming(
  opts: GroqCallOptions,
  // onModel : appelé avec le modèle qui a ouvert le flux (le principal ou son repli).
  // echeance : horodatage (ms) au-delà duquel plus aucun essai ne part (le flux une fois ouvert n'est pas coupé).
  config: { maxRetries?: number; fallbackModel?: string; apiKey?: string; onModel?: (model: string) => void; echeance?: number } = {}
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = config.apiKey || process.env.GROQ_API_KEY || ''
  if (!apiKey) throw new Error('GROQ_API_KEY not configured')

  const maxRetries = config.maxRetries ?? 2
  const primaryModel = opts.model || GROQ_MODEL_PRIMARY
  const fallbackModel = config.fallbackModel || GROQ_MODEL_FALLBACK
  const models = primaryModel === fallbackModel ? [primaryModel] : [primaryModel, fallbackModel]

  let lastError: Error | null = null

  for (const currentModel of models) {
    if (echeanceDepassee(config.echeance)) break
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (echeanceDepassee(config.echeance)) {
        lastError ??= new Error('Groq: échéance dépassée')
        break
      }
      try {
        const res = await fetch(GROQ_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: currentModel,
            messages: opts.messages,
            temperature: opts.temperature ?? 0.2,
            // Le raisonnement de gpt-oss arrive dans `delta.reasoning`, ignoré ci-dessous : seul `delta.content` est rendu.
            ...parametresRaisonnement(currentModel, opts.max_tokens ?? 3000, opts.reasoning_effort),
            stream: true,
          }),
          signal: AbortSignal.timeout(delaiAppel(30000, config.echeance)),
        })

        if (res.ok && res.body) {
          config.onModel?.(currentModel)
          // Transform Groq SSE stream → plain text chunks
          const reader = res.body.getReader()
          const decoder = new TextDecoder()
          const encoder = new TextEncoder()

          return new ReadableStream<Uint8Array>({
            async pull(controller) {
              let buffer = ''
              while (true) {
                const { done, value } = await reader.read()
                if (done) {
                  // Send final SSE event
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                  controller.close()
                  return
                }
                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                  const trimmed = line.trim()
                  if (!trimmed || !trimmed.startsWith('data: ')) continue
                  const payload = trimmed.slice(6)
                  if (payload === '[DONE]') {
                    controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                    controller.close()
                    return
                  }
                  try {
                    const json = JSON.parse(payload)
                    const delta = json.choices?.[0]?.delta?.content
                    if (delta) {
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: delta })}\n\n`))
                    }
                  } catch {
                    // Skip malformed JSON
                  }
                }
              }
            },
            cancel() {
              reader.cancel()
            }
          })
        }

        if (res.status === 429) {
          lastError = new Error(`Groq stream 429 on ${currentModel}`)
          const waitMs = delaiApres429(res.headers.get('retry-after'), attempt, maxRetries)
          if (waitMs === null || attenteDepasseEcheance(waitMs, config.echeance)) {
            console.warn(`[groq-stream] 429 on ${currentModel}, next model`)
            break
          }
          console.warn(`[groq-stream] 429 on ${currentModel}, retry ${attempt + 1}/${maxRetries}, wait ${waitMs}ms`)
          await new Promise(r => setTimeout(r, waitMs))
          continue
        }

        const errText = await res.text().catch(() => '')
        console.error(`[groq-stream] Error ${res.status} on ${currentModel}:`, errText.substring(0, 200))
        lastError = new Error(`Groq stream ${res.status}: ${errText.substring(0, 100)}`)
        break
      } catch (fetchErr: unknown) {
        const errMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
        console.error(`[groq-stream] Fetch error on ${currentModel}:`, errMsg)
        lastError = fetchErr instanceof Error ? fetchErr : new Error(errMsg)
        break
      }
    }
  }

  throw lastError || new Error('All Groq streaming attempts failed')
}

// ── Tool-calling support (non-stream) ────────────────────────────────────────

export interface GroqToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export interface GroqMessageWithTools {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: GroqToolCall[]
  tool_call_id?: string
  name?: string
}

export interface GroqToolsCallOptions {
  model?: string
  messages: GroqMessageWithTools[]
  tools: Array<{
    type: 'function'
    function: { name: string; description: string; parameters: Record<string, unknown> }
  }>
  tool_choice?: 'auto' | 'required' | 'none'
  temperature?: number
  max_tokens?: number
  /** Effort de raisonnement des modèles gpt-oss (défaut `low`). */
  reasoning_effort?: EffortRaisonnement
}

export interface GroqToolsResponse {
  message: {
    role: 'assistant'
    content: string | null
    tool_calls?: GroqToolCall[]
  }
  finish_reason?: string
  usage?: { total_tokens: number; prompt_tokens: number; completion_tokens: number }
  model?: string
}

export async function callGroqWithTools(
  opts: GroqToolsCallOptions,
  config: { maxRetries?: number; fallbackModel?: string; apiKey?: string; disableCerebrasFallback?: boolean } = {}
): Promise<GroqToolsResponse> {
  const apiKey = config.apiKey || process.env.GROQ_API_KEY || ''
  if (!apiKey) {
    if (!config.disableCerebrasFallback && hasCerebrasKey()) {
      return callCerebrasWithTools({
        messages: opts.messages,
        tools: opts.tools,
        tool_choice: opts.tool_choice,
        temperature: opts.temperature,
        max_tokens: opts.max_tokens,
        reasoning_effort: opts.reasoning_effort,
      }, { maxRetries: config.maxRetries })
    }
    throw new Error('GROQ_API_KEY not configured')
  }

  const maxRetries = config.maxRetries ?? 2
  const primaryModel = opts.model || GROQ_MODEL_PRIMARY
  const fallbackModel = config.fallbackModel || GROQ_MODEL_FALLBACK
  const models = primaryModel === fallbackModel ? [primaryModel] : [primaryModel, fallbackModel]

  let lastError: Error | null = null

  for (const currentModel of models) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(GROQ_URL, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: currentModel,
            messages: opts.messages,
            tools: opts.tools,
            tool_choice: opts.tool_choice ?? 'auto',
            temperature: opts.temperature ?? 0.2,
            ...parametresRaisonnement(currentModel, opts.max_tokens ?? 1500, opts.reasoning_effort),
          }),
          signal: AbortSignal.timeout(25000),
        })

        if (res.ok) {
          const json = await res.json()
          const choice = json.choices?.[0]
          if (!choice) throw new Error('groq tools: no choice in response')
          return {
            message: {
              role: 'assistant',
              content: choice.message?.content ?? null,
              tool_calls: choice.message?.tool_calls,
            },
            finish_reason: choice.finish_reason,
            usage: json.usage,
            model: json.model,
          }
        }

        if (res.status === 429) {
          lastError = new Error(`Groq tools 429 on ${currentModel}`)
          const waitMs = delaiApres429(res.headers.get('retry-after'), attempt, maxRetries)
          if (waitMs === null) {
            console.warn(`[groq-tools] 429 on ${currentModel}, next model or provider`)
            break
          }
          console.warn(`[groq-tools] 429 on ${currentModel}, retry ${attempt + 1}/${maxRetries}, wait ${waitMs}ms`)
          await new Promise(r => setTimeout(r, waitMs))
          continue
        }

        const errText = await res.text().catch(() => '')
        console.error(`[groq-tools] Error ${res.status} on ${currentModel}:`, errText.substring(0, 200))
        lastError = new Error(`Groq tools ${res.status}: ${errText.substring(0, 100)}`)
        break
      } catch (fetchErr: unknown) {
        const errMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
        console.error(`[groq-tools] Fetch error on ${currentModel}:`, errMsg)
        lastError = fetchErr instanceof Error ? fetchErr : new Error(errMsg)
        break
      }
    }
  }

  // Tous les modèles Groq ont échoué → fallback Cerebras si dispo.
  if (!config.disableCerebrasFallback && hasCerebrasKey()) {
    console.warn('[groq-tools] all attempts failed, fallback to Cerebras', {
      groqError: lastError?.message,
    })
    return callCerebrasWithTools({
      messages: opts.messages,
      tools: opts.tools,
      tool_choice: opts.tool_choice,
      temperature: opts.temperature,
      max_tokens: opts.max_tokens,
      reasoning_effort: opts.reasoning_effort,
    }, { maxRetries: config.maxRetries })
  }

  throw lastError || new Error('All Groq tools attempts failed')
}
