import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { callCerebrasWithRetry, hasCerebrasKey } from '@/lib/cerebras'
import { CEREBRAS_API_URL, CEREBRAS_MODEL_PRIMARY } from '@/lib/constants'

describe('lib/cerebras', () => {
  const originalKey = process.env.CEREBRAS_API_KEY
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    process.env.CEREBRAS_API_KEY = 'csk-test-key'
  })

  afterEach(() => {
    process.env.CEREBRAS_API_KEY = originalKey
    globalThis.fetch = originalFetch
    vi.useRealTimers()
  })

  describe('hasCerebrasKey', () => {
    it('returns true when env var is set', () => {
      process.env.CEREBRAS_API_KEY = 'csk-x'
      expect(hasCerebrasKey()).toBe(true)
    })

    it('returns false when env var is empty', () => {
      process.env.CEREBRAS_API_KEY = ''
      expect(hasCerebrasKey()).toBe(false)
    })
  })

  describe('callCerebrasWithRetry', () => {
    it('hits the Cerebras endpoint with proper auth and model', async () => {
      const okResponse = {
        choices: [{ message: { content: '{"answer":"ok"}' }, finish_reason: 'stop' }],
        usage: { total_tokens: 50, prompt_tokens: 30, completion_tokens: 20 },
        model: CEREBRAS_MODEL_PRIMARY,
      }
      const fetchMock = vi.fn(async () => new Response(JSON.stringify(okResponse), { status: 200 }))
      globalThis.fetch = fetchMock as unknown as typeof fetch

      const result = await callCerebrasWithRetry({
        messages: [{ role: 'user', content: 'hello' }],
        temperature: 0.1,
        max_tokens: 100,
        response_format: { type: 'json_object' },
      })

      expect(result.choices[0].message.content).toBe('{"answer":"ok"}')
      expect(fetchMock).toHaveBeenCalledTimes(1)

      const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
      expect(call[0]).toBe(CEREBRAS_API_URL)
      const reqInit = call[1]
      const headers = reqInit.headers as Record<string, string>
      expect(headers['Authorization']).toBe('Bearer csk-test-key')
      const body = JSON.parse(reqInit.body as string) as Record<string, unknown>
      expect(body.model).toBe(CEREBRAS_MODEL_PRIMARY)
      expect(body.temperature).toBe(0.1)
      expect(body.max_tokens).toBe(100)
      expect(body.response_format).toEqual({ type: 'json_object' })
    })

    it('throws when CEREBRAS_API_KEY is not configured', async () => {
      process.env.CEREBRAS_API_KEY = ''
      await expect(
        callCerebrasWithRetry({ messages: [{ role: 'user', content: 'hi' }] }),
      ).rejects.toThrow('CEREBRAS_API_KEY not configured')
    })

    it('retries on 429 then succeeds', async () => {
      vi.useFakeTimers()
      const okResponse = {
        choices: [{ message: { content: 'ok' } }],
      }
      let calls = 0
      const fetchMock = vi.fn(async () => {
        calls++
        if (calls === 1) {
          return new Response('rate limit', {
            status: 429,
            headers: { 'retry-after': '1' },
          })
        }
        return new Response(JSON.stringify(okResponse), { status: 200 })
      })
      globalThis.fetch = fetchMock as unknown as typeof fetch

      const promise = callCerebrasWithRetry({
        messages: [{ role: 'user', content: 'hi' }],
      })
      // Push past the retry wait
      await vi.advanceTimersByTimeAsync(2000)
      const result = await promise
      expect(result.choices[0].message.content).toBe('ok')
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('throws on non-429 errors without retrying', async () => {
      const fetchMock = vi.fn(async () =>
        new Response('{"error":"bad request"}', { status: 400 }),
      )
      globalThis.fetch = fetchMock as unknown as typeof fetch

      await expect(
        callCerebrasWithRetry({ messages: [{ role: 'user', content: 'hi' }] }),
      ).rejects.toThrow(/Cerebras 400/)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
  })
})
