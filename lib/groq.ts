// ── Shared Groq API helper with retry 429 + model fallback ──────────────────

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

export interface GroqMessage {
  role: string
  content: string | any[]
}

export interface GroqCallOptions {
  model?: string
  messages: GroqMessage[]
  temperature?: number
  max_tokens?: number
  response_format?: { type: string }
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
 * - Falls back to `fallbackModel` (8B) if the primary model fails
 * - Throws on all other errors after exhausting attempts
 */
export async function callGroqWithRetry(
  opts: GroqCallOptions,
  config: { maxRetries?: number; fallbackModel?: string; apiKey?: string } = {}
): Promise<GroqResponse> {
  const apiKey = config.apiKey || process.env.GROQ_API_KEY || ''
  if (!apiKey) throw new Error('GROQ_API_KEY not configured')

  const maxRetries = config.maxRetries ?? 2
  const primaryModel = opts.model || 'llama-3.3-70b-versatile'
  const fallbackModel = config.fallbackModel || 'llama-3.1-8b-instant'
  const models = primaryModel === fallbackModel ? [primaryModel] : [primaryModel, fallbackModel]

  let lastError: Error | null = null

  for (const currentModel of models) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
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
            max_tokens: opts.max_tokens ?? 3000,
            ...(opts.response_format ? { response_format: opts.response_format } : {}),
          }),
          signal: AbortSignal.timeout(25000), // 25s timeout
        })

        if (res.ok) return res.json()

        if (res.status === 429) {
          const retryAfter = res.headers.get('retry-after')
          const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : (attempt + 1) * 2000
          console.warn(`[groq] 429 on ${currentModel}, retry ${attempt + 1}/${maxRetries}, wait ${waitMs}ms`)
          await new Promise(r => setTimeout(r, Math.min(waitMs, 10000)))
          continue
        }

        // Non-429 error — log and try next model
        const errText = await res.text().catch(() => '')
        console.error(`[groq] Error ${res.status} on ${currentModel}:`, errText.substring(0, 200))
        lastError = new Error(`Groq ${res.status}: ${errText.substring(0, 100)}`)
        break // Don't retry non-429 errors, move to fallback model
      } catch (fetchErr: any) {
        console.error(`[groq] Fetch error on ${currentModel}:`, fetchErr.message)
        lastError = fetchErr
        break
      }
    }
  }

  throw lastError || new Error('All Groq API attempts failed')
}
