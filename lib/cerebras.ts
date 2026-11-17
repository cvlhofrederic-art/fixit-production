// ── Cerebras Inference API helper (OpenAI-compatible) ──────────────────────
//
// Provider de secours pour les agents qui dépassent le rate-limit de l'offre
// gratuite de Groq. Cerebras Inference sert le même modèle que Groq
// (gpt-oss-120b, `CEREBRAS_MODEL_PRIMARY`) avec une offre gratuite plus large.
//
// API 100% compatible OpenAI Chat Completions — même schéma JSON que Groq, on
// ne fait que changer l'URL, le modèle et la clé. gpt-oss raisonne avant de
// répondre : même budget majoré et même effort que chez Groq
// (`lib/ai/raisonnement.ts`), raisonnement rendu à part (`message.reasoning`).
//
// Voir : https://inference-docs.cerebras.ai/api-reference/chat-completions

import { CEREBRAS_API_URL, CEREBRAS_MODEL_PRIMARY } from '@/lib/constants'
import { parametresRaisonnement, type EffortRaisonnement } from '@/lib/ai/raisonnement'
import { delaiApres429 } from '@/lib/ai/reessai'

// Shape OpenAI-compatible (identique à GroqMessage / GroqResponse côté `lib/groq.ts`).
// On redéfinit ici pour éviter une dépendance circulaire — `lib/groq.ts` importe
// `callCerebrasWithRetry` pour son fallback inter-provider.
export interface CerebrasMessage {
  role: string
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> | null
  tool_call_id?: string
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>
  name?: string
}

export interface CerebrasResponse {
  choices: { message: { content: string }; finish_reason?: string }[]
  usage?: { total_tokens: number; prompt_tokens: number; completion_tokens: number }
  model?: string
}

export interface CerebrasCallOptions {
  model?: string
  messages: CerebrasMessage[]
  temperature?: number
  max_tokens?: number
  response_format?: { type: string }
  reasoning_effort?: EffortRaisonnement
}

/**
 * Appel Cerebras Inference avec retry exponentiel sur 429.
 *
 * - Retour identique à `callGroqWithRetry` (même `GroqResponse` shape) pour
 *   permettre une bascule transparente côté caller.
 * - Lit `CEREBRAS_API_KEY` depuis l'environnement (ou opts.apiKey).
 * - Renvoie une erreur si la clé n'est pas configurée — le caller doit
 *   vérifier avant d'appeler pour distinguer "non configuré" de "erreur API".
 */
export async function callCerebrasWithRetry(
  opts: CerebrasCallOptions,
  config: { maxRetries?: number; apiKey?: string } = {},
): Promise<CerebrasResponse> {
  const apiKey = config.apiKey || process.env.CEREBRAS_API_KEY || ''
  if (!apiKey) throw new Error('CEREBRAS_API_KEY not configured')

  const maxRetries = config.maxRetries ?? 2
  const model = opts.model || CEREBRAS_MODEL_PRIMARY

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(CEREBRAS_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: opts.messages,
          temperature: opts.temperature ?? 0.2,
          ...parametresRaisonnement(model, opts.max_tokens ?? 3000, opts.reasoning_effort),
          ...(opts.response_format ? { response_format: opts.response_format } : {}),
        }),
        signal: AbortSignal.timeout(25000),
      })

      if (res.ok) return res.json()

      if (res.status === 429) {
        lastError = new Error(`Cerebras 429 on ${model}`)
        const waitMs = delaiApres429(res.headers.get('retry-after'), attempt, maxRetries)
        if (waitMs === null) break
        console.warn(`[cerebras] 429 on ${model}, retry ${attempt + 1}/${maxRetries}, wait ${waitMs}ms`)
        await new Promise(r => setTimeout(r, waitMs))
        continue
      }

      const errText = await res.text().catch(() => '')
      console.error(`[cerebras] Error ${res.status} on ${model}:`, errText.substring(0, 200))
      lastError = new Error(`Cerebras ${res.status}: ${errText.substring(0, 100)}`)
      break
    } catch (fetchErr: unknown) {
      const errMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
      console.error(`[cerebras] Fetch error on ${model}:`, errMsg)
      lastError = fetchErr instanceof Error ? fetchErr : new Error(errMsg)
      break
    }
  }

  throw lastError || new Error('All Cerebras API attempts failed')
}

/** True si la clé Cerebras est configurée — à utiliser pour activer le fallback côté caller. */
export function hasCerebrasKey(): boolean {
  return !!process.env.CEREBRAS_API_KEY
}

// ── Tool-calling support ────────────────────────────────────────────────────

export interface CerebrasToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export interface CerebrasToolsCallOptions {
  model?: string
  messages: CerebrasMessage[]
  tools: Array<{
    type: 'function'
    function: { name: string; description: string; parameters: Record<string, unknown> }
  }>
  tool_choice?: 'auto' | 'required' | 'none'
  temperature?: number
  max_tokens?: number
  reasoning_effort?: EffortRaisonnement
}

export interface CerebrasToolsResponse {
  message: {
    role: 'assistant'
    content: string | null
    tool_calls?: CerebrasToolCall[]
  }
  finish_reason?: string
  usage?: { total_tokens: number; prompt_tokens: number; completion_tokens: number }
  model?: string
}

export async function callCerebrasWithTools(
  opts: CerebrasToolsCallOptions,
  config: { maxRetries?: number; apiKey?: string } = {},
): Promise<CerebrasToolsResponse> {
  const apiKey = config.apiKey || process.env.CEREBRAS_API_KEY || ''
  if (!apiKey) throw new Error('CEREBRAS_API_KEY not configured')

  const maxRetries = config.maxRetries ?? 2
  const model = opts.model || CEREBRAS_MODEL_PRIMARY

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(CEREBRAS_API_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: opts.messages,
          tools: opts.tools,
          tool_choice: opts.tool_choice ?? 'auto',
          temperature: opts.temperature ?? 0.2,
          ...parametresRaisonnement(model, opts.max_tokens ?? 1500, opts.reasoning_effort),
        }),
        signal: AbortSignal.timeout(25000),
      })

      if (res.ok) {
        const json = await res.json()
        const choice = json.choices?.[0]
        if (!choice) throw new Error('cerebras tools: no choice in response')
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
        lastError = new Error(`Cerebras tools 429 on ${model}`)
        const waitMs = delaiApres429(res.headers.get('retry-after'), attempt, maxRetries)
        if (waitMs === null) break
        console.warn(`[cerebras-tools] 429 on ${model}, retry ${attempt + 1}/${maxRetries}, wait ${waitMs}ms`)
        await new Promise(r => setTimeout(r, waitMs))
        continue
      }

      const errText = await res.text().catch(() => '')
      console.error(`[cerebras-tools] Error ${res.status} on ${model}:`, errText.substring(0, 200))
      lastError = new Error(`Cerebras tools ${res.status}: ${errText.substring(0, 100)}`)
      break
    } catch (fetchErr: unknown) {
      const errMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
      console.error(`[cerebras-tools] Fetch error on ${model}:`, errMsg)
      lastError = fetchErr instanceof Error ? fetchErr : new Error(errMsg)
      break
    }
  }

  throw lastError || new Error('All Cerebras tools attempts failed')
}
