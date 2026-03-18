// ── Shared Groq API helper with retry 429 + model fallback ──────────────────

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

export interface GroqMessage {
  role: string
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>
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
      } catch (fetchErr: unknown) {
        const errMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
        console.error(`[groq] Fetch error on ${currentModel}:`, errMsg)
        lastError = fetchErr instanceof Error ? fetchErr : new Error(errMsg)
        break
      }
    }
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
  config: { maxRetries?: number; fallbackModel?: string; apiKey?: string } = {}
): Promise<ReadableStream<Uint8Array>> {
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
            stream: true,
          }),
          signal: AbortSignal.timeout(30000),
        })

        if (res.ok && res.body) {
          // Transform Groq SSE stream → plain text chunks
          const reader = res.body.getReader()
          const decoder = new TextDecoder()
          const encoder = new TextEncoder()

          return new ReadableStream<Uint8Array>({
            async pull(controller) {
              let buffer = ''
              // eslint-disable-next-line no-constant-condition
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
          const retryAfter = res.headers.get('retry-after')
          const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : (attempt + 1) * 2000
          console.warn(`[groq-stream] 429 on ${currentModel}, retry ${attempt + 1}/${maxRetries}, wait ${waitMs}ms`)
          await new Promise(r => setTimeout(r, Math.min(waitMs, 10000)))
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
