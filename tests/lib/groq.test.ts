import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { callGroqWithRetry, callGroqWithTools } from '@/lib/groq'
import { CEREBRAS_API_URL, GROQ_API_URL } from '@/lib/constants'

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
        if (typeof url === 'string' && url.includes('cerebras.ai')) {
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
      const groqCalls = allCalls.filter((c) => String(c[0]).includes('groq.com')).length
      const cerebrasCalls = allCalls.filter((c) => String(c[0]).includes('cerebras.ai')).length
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

      const cerebrasCalls = (fetchMock.mock.calls as unknown as Array<[string, RequestInit?]>).filter((c) => String(c[0]).includes('cerebras.ai')).length
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
        if (typeof url === 'string' && url.includes('cerebras.ai')) {
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
      expect(calls.every((u) => u.includes(CEREBRAS_API_URL))).toBe(true)
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
        if (typeof url === 'string' && url.includes('cerebras.ai')) {
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
      const cerebrasCalls = (fetchMock.mock.calls as unknown as Array<[string, RequestInit?]>).filter((c) => String(c[0]).includes('cerebras.ai')).length
      expect(cerebrasCalls).toBe(1)
    })
  })

  it('exposes the expected Groq endpoint URL', () => {
    expect(GROQ_API_URL).toContain('api.groq.com')
  })
})
