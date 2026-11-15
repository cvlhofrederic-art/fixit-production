import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { callGroqStreaming, callGroqWithRetry, callGroqWithTools } from '@/lib/groq'
import { CEREBRAS_API_URL, GROQ_API_URL } from '@/lib/constants'
import { MARGE_RAISONNEMENT } from '@/lib/ai/raisonnement'

type AppelFetch = [string, RequestInit?]
const corpsDe = (appel: AppelFetch) => JSON.parse(String(appel[1]?.body)) as Record<string, unknown>

// Modèles retirés par Groq le 16/08/2026 (llama-3.3-70b-versatile, llama-3.1-8b-instant) : depuis, chaque agent
// répondait « Model does not exist ». Les modèles envoyés sont ceux de lib/constants.ts (gpt-oss).
describe('lib/groq — modèles envoyés et budget de raisonnement', () => {
  const originalGroqKey = process.env.GROQ_API_KEY
  const originalCerebrasKey = process.env.CEREBRAS_API_KEY
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    process.env.GROQ_API_KEY = 'gsk-test'
    process.env.CEREBRAS_API_KEY = ''
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    process.env.GROQ_API_KEY = originalGroqKey
    process.env.CEREBRAS_API_KEY = originalCerebrasKey
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('appel simple : openai/gpt-oss-120b, effort bas, budget majoré de la marge', async () => {
    const fetchMock = vi.fn(async () => Response.json({ choices: [{ message: { content: 'ok' } }] }))
    globalThis.fetch = fetchMock as unknown as typeof fetch
    await callGroqWithRetry({ messages: [{ role: 'user', content: 'q' }], max_tokens: 600 })
    const corps = corpsDe((fetchMock.mock.calls as unknown as AppelFetch[])[0])
    expect(corps).toMatchObject({ model: 'openai/gpt-oss-120b', reasoning_effort: 'low', max_tokens: 600 + MARGE_RAISONNEMENT })
  })

  it('modèle retiré ou en panne : le repli est openai/gpt-oss-20b, plus aucun Llama', async () => {
    const fetchMock = vi.fn(async () => Response.json({ error: { message: 'model_decommissioned' } }, { status: 404 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch
    await expect(callGroqWithRetry({ messages: [{ role: 'user', content: 'q' }] })).rejects.toThrow(/Groq 404/)
    const modeles = (fetchMock.mock.calls as unknown as AppelFetch[]).map(c => corpsDe(c).model)
    expect(modeles).toEqual(['openai/gpt-oss-120b', 'openai/gpt-oss-20b'])
  })

  it('l’effort demandé par la route est transmis ; un modèle qui ne raisonne pas garde son budget', async () => {
    const fetchMock = vi.fn(async () => Response.json({ choices: [{ message: { content: 'ok' } }] }))
    globalThis.fetch = fetchMock as unknown as typeof fetch
    await callGroqWithRetry({ messages: [{ role: 'user', content: 'q' }], max_tokens: 900, reasoning_effort: 'medium' })
    await callGroqWithRetry({ model: 'autre-modele', messages: [{ role: 'user', content: 'q' }], max_tokens: 900 }, { fallbackModel: 'autre-modele' })
    const [gptOss, autre] = (fetchMock.mock.calls as unknown as AppelFetch[]).map(corpsDe)
    expect(gptOss).toMatchObject({ reasoning_effort: 'medium', max_tokens: 900 + MARGE_RAISONNEMENT })
    expect(autre.max_tokens).toBe(900)
    expect(autre).not.toHaveProperty('reasoning_effort')
  })

  it('flux et appels d’outils (simulateur) : même modèle, même budget majoré', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const corps = JSON.parse(String(init?.body)) as Record<string, unknown>
      if (corps.stream) return new Response('data: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } })
      return Response.json({ choices: [{ message: { role: 'assistant', content: 'fini' }, finish_reason: 'stop' }] })
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch
    await callGroqStreaming({ messages: [{ role: 'user', content: 'q' }], max_tokens: 1200 })
    await callGroqWithTools({
      messages: [{ role: 'user', content: 'q' }],
      tools: [{ type: 'function', function: { name: 'outil', description: 'un outil', parameters: {} } }],
      max_tokens: 800,
    })
    const [flux, outils] = (fetchMock.mock.calls as unknown as AppelFetch[]).map(corpsDe)
    expect(flux).toMatchObject({ model: 'openai/gpt-oss-120b', stream: true, reasoning_effort: 'low', max_tokens: 1200 + MARGE_RAISONNEMENT })
    expect(outils).toMatchObject({ model: 'openai/gpt-oss-120b', reasoning_effort: 'low', max_tokens: 800 + MARGE_RAISONNEMENT })
  })

  it('429 dont le quota ne revient que dans une heure : modèle suivant sans attendre (avant : 10 s × 3 essais par modèle)', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ error: { message: 'rate_limit_exceeded' } }, { status: 429, headers: { 'retry-after': '3600' } }),
    )
    globalThis.fetch = fetchMock as unknown as typeof fetch
    await expect(callGroqWithRetry({ messages: [{ role: 'user', content: 'q' }] })).rejects.toThrow(/Groq 429/)
    const modeles = (fetchMock.mock.calls as unknown as AppelFetch[]).map(c => corpsDe(c).model)
    expect(modeles).toEqual(['openai/gpt-oss-120b', 'openai/gpt-oss-20b'])
  })

  it('échéance déjà passée : aucun essai', async () => {
    const fetchMock = vi.fn(async () => Response.json({ choices: [{ message: { content: 'ok' } }] }))
    globalThis.fetch = fetchMock as unknown as typeof fetch
    await expect(callGroqWithRetry({ messages: [{ role: 'user', content: 'q' }] }, { echeance: Date.now() - 1 })).rejects.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('échéance atteinte pendant l’appel du principal : appel coupé, le repli n’est pas essayé (le relais garde son temps)', async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_, rejeter) => {
      init?.signal?.addEventListener('abort', () => rejeter(init.signal?.reason ?? new Error('abort')))
    }))
    globalThis.fetch = fetchMock as unknown as typeof fetch
    await expect(callGroqWithRetry({ messages: [{ role: 'user', content: 'q' }] }, { echeance: Date.now() + 1_000 })).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('secours Cerebras : gpt-oss-120b (son llama-3.3-70b a été retiré), même effort', async () => {
    process.env.CEREBRAS_API_KEY = 'csk-test'
    const fetchMock = vi.fn(async (url: string) =>
      url === CEREBRAS_API_URL
        ? Response.json({ choices: [{ message: { content: 'cerebras' } }] })
        : Response.json({ error: { message: 'model_decommissioned' } }, { status: 404 }),
    )
    globalThis.fetch = fetchMock as unknown as typeof fetch
    const r = await callGroqWithRetry({ messages: [{ role: 'user', content: 'q' }], max_tokens: 300, reasoning_effort: 'high' })
    expect(r.choices[0].message.content).toBe('cerebras')
    const cerebras = (fetchMock.mock.calls as unknown as AppelFetch[]).find(c => c[0] === CEREBRAS_API_URL)
    expect(cerebras && corpsDe(cerebras)).toMatchObject({ model: 'gpt-oss-120b', reasoning_effort: 'high', max_tokens: 300 + MARGE_RAISONNEMENT })
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
