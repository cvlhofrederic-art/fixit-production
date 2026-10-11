import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { callGroqStreaming, callGroqWithRetry, callGroqWithTools, parametresRaisonnementGroq } from '@/lib/groq'
import { CEREBRAS_API_URL, GROQ_API_URL, GROQ_MODEL_FALLBACK, GROQ_MODEL_PRIMARY } from '@/lib/constants'

type AppelFetch = [string, RequestInit?]
const corpsRequete = (appel: AppelFetch): Record<string, unknown> => JSON.parse(String(appel[1]?.body))

async function lireFlux(flux: ReadableStream<Uint8Array>): Promise<string> {
  const lecteur = flux.getReader()
  const decodeur = new TextDecoder()
  let sortie = ''
  while (true) {
    const { done, value } = await lecteur.read()
    if (done) return sortie
    sortie += decodeur.decode(value)
  }
}

// Groq a arrêté llama-3.3-70b-versatile et llama-3.1-8b-instant le 16/08/2026 (404).
describe('lib/groq — modèles gpt-oss et réglages de raisonnement', () => {
  const originalGroqKey = process.env.GROQ_API_KEY
  const originalCerebrasKey = process.env.CEREBRAS_API_KEY
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    process.env.GROQ_API_KEY = 'gsk-test'
    process.env.CEREBRAS_API_KEY = ''
  })

  afterEach(() => {
    process.env.GROQ_API_KEY = originalGroqKey
    process.env.CEREBRAS_API_KEY = originalCerebrasKey
    globalThis.fetch = originalFetch
  })

  it('modèles par défaut : gpt-oss-120b (principal) et gpt-oss-20b (secours)', () => {
    expect(GROQ_MODEL_PRIMARY).toBe('openai/gpt-oss-120b')
    expect(GROQ_MODEL_FALLBACK).toBe('openai/gpt-oss-20b')
  })

  it('parametresRaisonnementGroq : effort bas et réflexion exclue pour gpt-oss, rien pour un autre modèle', () => {
    expect(parametresRaisonnementGroq('openai/gpt-oss-120b')).toEqual({ reasoning_effort: 'low', include_reasoning: false })
    expect(parametresRaisonnementGroq('openai/gpt-oss-20b')).toEqual({ reasoning_effort: 'low', include_reasoning: false })
    expect(parametresRaisonnementGroq('meta-llama/llama-4-scout-17b-16e-instruct')).toEqual({})
  })

  it('callGroqWithRetry : principal puis secours gpt-oss, chacun avec reasoning_effort low', async () => {
    const fetchMock = vi.fn(async () => new Response('{"error":{"message":"boom"}}', { status: 500 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    await expect(callGroqWithRetry({ messages: [{ role: 'user', content: 'q' }] })).rejects.toThrow(/Groq 500/)

    const appels = fetchMock.mock.calls as unknown as AppelFetch[]
    expect(appels.map(a => corpsRequete(a).model)).toEqual(['openai/gpt-oss-120b', 'openai/gpt-oss-20b'])
    for (const appel of appels) {
      expect(corpsRequete(appel).reasoning_effort).toBe('low')
      expect(corpsRequete(appel).include_reasoning).toBe(false)
    }
  })

  it('callGroqWithRetry : un autre modèle garde exactement son corps (pas de champ de raisonnement)', async () => {
    const fetchMock = vi.fn(async () => Response.json({ choices: [{ message: { content: 'ok' } }] }))
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const vision = 'meta-llama/llama-4-scout-17b-16e-instruct'

    await callGroqWithRetry(
      { model: vision, messages: [{ role: 'user', content: 'q' }], temperature: 0.1, max_tokens: 800, response_format: { type: 'json_object' } },
      { fallbackModel: vision },
    )

    const corps = corpsRequete((fetchMock.mock.calls as unknown as AppelFetch[])[0])
    expect(corps).toEqual({
      model: vision,
      messages: [{ role: 'user', content: 'q' }],
      temperature: 0.1,
      max_tokens: 800,
      response_format: { type: 'json_object' },
    })
    expect(corps).not.toHaveProperty('reasoning_effort')
    expect(corps).not.toHaveProperty('include_reasoning')
  })

  it('callGroqWithTools : reasoning_effort low sur gpt-oss', async () => {
    const fetchMock = vi.fn(async () => Response.json({ choices: [{ message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }] }))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    await callGroqWithTools({
      messages: [{ role: 'user', content: 'q' }],
      tools: [{ type: 'function', function: { name: 'foo', description: 'foo', parameters: {} } }],
    })

    const corps = corpsRequete((fetchMock.mock.calls as unknown as AppelFetch[])[0])
    expect(corps.model).toBe('openai/gpt-oss-120b')
    expect(corps.reasoning_effort).toBe('low')
    expect(corps.include_reasoning).toBe(false)
  })

  it('callGroqStreaming : reasoning_effort low, et le flux ne relaie jamais la réflexion', async () => {
    const sse = [
      'data: {"choices":[{"delta":{"role":"assistant","content":""}}]}',
      'data: {"choices":[{"delta":{"reasoning":"Je réfléchis en secret."}}]}',
      'data: {"choices":[{"delta":{"content":"Bonjour"}}]}',
      'data: {"choices":[{"delta":{"content":" !"}}]}',
      'data: [DONE]',
    ].join('\n\n') + '\n\n'
    const fetchMock = vi.fn(async () => new Response(sse, { headers: { 'content-type': 'text/event-stream' } }))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const flux = await callGroqStreaming({ messages: [{ role: 'user', content: 'q' }] })
    const sortie = await lireFlux(flux)

    const corps = corpsRequete((fetchMock.mock.calls as unknown as AppelFetch[])[0])
    expect(corps.model).toBe('openai/gpt-oss-120b')
    expect(corps.stream).toBe(true)
    expect(corps.reasoning_effort).toBe('low')
    expect(corps.include_reasoning).toBe(false)
    expect(sortie).toBe('data: {"text":"Bonjour"}\n\ndata: {"text":" !"}\n\ndata: [DONE]\n\n')
    expect(sortie).not.toContain('réfléchis')
  })
})

describe('lib/groq — Cerebras fallback', () => {
  const originalGroqKey = process.env.GROQ_API_KEY
  const originalCerebrasKey = process.env.CEREBRAS_API_KEY
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    process.env.GROQ_API_KEY = 'gsk-test'
    process.env.CEREBRAS_API_KEY = 'csk-test'
  })

  afterEach(() => {
    process.env.GROQ_API_KEY = originalGroqKey
    process.env.CEREBRAS_API_KEY = originalCerebrasKey
    globalThis.fetch = originalFetch
    vi.useRealTimers()
  })

  describe('callGroqWithRetry', () => {
    it('falls back to Cerebras when Groq returns 413 on all models', async () => {
      const okResp = { choices: [{ message: { content: 'cerebras answer' } }] }
      const fetchMock = vi.fn(async (url: string) => {
        if (typeof url === 'string' && url === CEREBRAS_API_URL) {
          return new Response(JSON.stringify(okResp), { status: 200 })
        }
        // Groq returns 413 rate limit on both primary and fallback model
        return new Response(JSON.stringify({ error: 'rate_limit_exceeded' }), { status: 413 })
      })
      globalThis.fetch = fetchMock as unknown as typeof fetch

      const result = await callGroqWithRetry({
        messages: [{ role: 'user', content: 'hello' }],
      })

      expect(result.choices[0].message.content).toBe('cerebras answer')
      // Groq tried both primary + fallback model = 2 calls; Cerebras = 1 call
      const allCalls = fetchMock.mock.calls as unknown as Array<[string, RequestInit?]>
      const groqCalls = allCalls.filter((c) => String(c[0]) === GROQ_API_URL).length
      const cerebrasCalls = allCalls.filter((c) => String(c[0]) === CEREBRAS_API_URL).length
      expect(groqCalls).toBeGreaterThanOrEqual(1)
      expect(cerebrasCalls).toBe(1)
    })

    it('does not fall back when disableCerebrasFallback is true', async () => {
      const fetchMock = vi.fn(async () =>
        new Response(JSON.stringify({ error: 'rate_limit_exceeded' }), { status: 413 }),
      )
      globalThis.fetch = fetchMock as unknown as typeof fetch

      await expect(
        callGroqWithRetry(
          { messages: [{ role: 'user', content: 'hi' }] },
          { disableCerebrasFallback: true },
        ),
      ).rejects.toThrow(/Groq 413/)

      const cerebrasCalls = (fetchMock.mock.calls as unknown as Array<[string, RequestInit?]>).filter((c) => String(c[0]) === CEREBRAS_API_URL).length
      expect(cerebrasCalls).toBe(0)
    })

    it('skips Cerebras fallback when CEREBRAS_API_KEY is not configured', async () => {
      process.env.CEREBRAS_API_KEY = ''
      const fetchMock = vi.fn(async () =>
        new Response(JSON.stringify({ error: 'rate_limit_exceeded' }), { status: 413 }),
      )
      globalThis.fetch = fetchMock as unknown as typeof fetch

      await expect(
        callGroqWithRetry({ messages: [{ role: 'user', content: 'hi' }] }),
      ).rejects.toThrow(/Groq 413/)
    })

    it('uses Cerebras when GROQ_API_KEY is missing but Cerebras is configured', async () => {
      process.env.GROQ_API_KEY = ''
      const okResp = { choices: [{ message: { content: 'cerebras only' } }] }
      const fetchMock = vi.fn(async (url: string) => {
        if (typeof url === 'string' && url === CEREBRAS_API_URL) {
          return new Response(JSON.stringify(okResp), { status: 200 })
        }
        throw new Error('Groq should not have been called')
      })
      globalThis.fetch = fetchMock as unknown as typeof fetch

      const result = await callGroqWithRetry({
        messages: [{ role: 'user', content: 'hi' }],
      })
      expect(result.choices[0].message.content).toBe('cerebras only')
      const calls = (fetchMock.mock.calls as unknown as Array<[string, RequestInit?]>).map((c) => String(c[0]))
      expect(calls.every((u) => u === CEREBRAS_API_URL)).toBe(true)
    })
  })

  describe('callGroqWithTools', () => {
    it('falls back to Cerebras tools API when Groq returns 413', async () => {
      const cerebrasToolsResp = {
        choices: [{
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [{ id: 'c1', type: 'function', function: { name: 'foo', arguments: '{}' } }],
          },
          finish_reason: 'tool_calls',
        }],
      }
      const fetchMock = vi.fn(async (url: string) => {
        if (typeof url === 'string' && url === CEREBRAS_API_URL) {
          return new Response(JSON.stringify(cerebrasToolsResp), { status: 200 })
        }
        return new Response(JSON.stringify({ error: 'rate_limit_exceeded' }), { status: 413 })
      })
      globalThis.fetch = fetchMock as unknown as typeof fetch

      const result = await callGroqWithTools({
        messages: [{ role: 'user', content: 'do it' }],
        tools: [{
          type: 'function',
          function: { name: 'foo', description: 'does foo', parameters: {} },
        }],
      })

      expect(result.message.tool_calls?.[0].function.name).toBe('foo')
      const cerebrasCalls = (fetchMock.mock.calls as unknown as Array<[string, RequestInit?]>).filter((c) => String(c[0]) === CEREBRAS_API_URL).length
      expect(cerebrasCalls).toBe(1)
    })
  })

  it('exposes the expected Groq endpoint URL', () => {
    expect(GROQ_API_URL).toContain('api.groq.com')
  })
})
