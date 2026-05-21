// ── Cerebras Inference API helper (OpenAI-compatible) ──────────────────────
//
// Provider de secours pour les agents qui dépassent le rate-limit Groq free tier
// (6K TPM sur llama-3.3-70b). Cerebras Inference offre la même famille de
// modèles avec un free tier nettement plus large.
//
// API 100% compatible OpenAI Chat Completions — même schéma JSON que Groq, on
// ne fait que changer l'URL, le modèle et la clé.
//
// Voir : https://inference-docs.cerebras.ai/api-reference/chat-completions

import { CEREBRAS_API_URL, CEREBRAS_MODEL_PRIMARY } from '@/lib/constants'
import type { GroqMessage, GroqResponse } from '@/lib/groq'

export interface CerebrasCallOptions {
  model?: string
  messages: GroqMessage[]
  temperature?: number
  max_tokens?: number
  response_format?: { type: string }
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
): Promise<GroqResponse> {
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
          max_tokens: opts.max_tokens ?? 3000,
          ...(opts.response_format ? { response_format: opts.response_format } : {}),
        }),
        signal: AbortSignal.timeout(25000),
      })

      if (res.ok) return res.json()

      if (res.status === 429) {
        const retryAfter = res.headers.get('retry-after')
        const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : (attempt + 1) * 2000
        console.warn(`[cerebras] 429 on ${model}, retry ${attempt + 1}/${maxRetries}, wait ${waitMs}ms`)
        await new Promise(r => setTimeout(r, Math.min(waitMs, 10000)))
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
