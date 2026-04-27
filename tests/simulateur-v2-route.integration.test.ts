import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Module mocks (hoisted before imports) ────────────────────────────────────
// vi.hoisted() ensures these vi.fn() instances exist before vi.mock factories run.

const {
  mockCallGroqStreaming,
  mockCallGroqWithTools,
  mockGetAuthUser,
  mockUnauthorizedResponse,
  mockCheckRateLimit,
  mockGetClientIP,
  mockRateLimitResponse,
} = vi.hoisted(() => ({
  mockCallGroqStreaming: vi.fn(),
  mockCallGroqWithTools: vi.fn(),
  mockGetAuthUser: vi.fn(),
  mockUnauthorizedResponse: vi.fn(() => Response.json({ error: 'Unauthorized' }, { status: 401 })),
  mockCheckRateLimit: vi.fn(),
  mockGetClientIP: vi.fn(),
  mockRateLimitResponse: vi.fn(() => Response.json({ error: 'Rate limit' }, { status: 429 })),
}))

vi.mock('@/lib/groq', () => ({
  callGroqStreaming: (...args: unknown[]) => mockCallGroqStreaming(...args),
  callGroqWithTools: (...args: unknown[]) => mockCallGroqWithTools(...args),
}))

vi.mock('@/lib/auth-helpers', () => ({
  getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
  unauthorizedResponse: () => mockUnauthorizedResponse(),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  getClientIP: (...args: unknown[]) => mockGetClientIP(...args),
  rateLimitResponse: () => mockRateLimitResponse(),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePOST(body: unknown, cookies: Record<string, string> = {}) {
  const headers = new Headers({ 'content-type': 'application/json' })
  if (Object.keys(cookies).length > 0) {
    headers.set('cookie', Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; '))
  }
  return new NextRequest('https://vitfix.io/api/simulateur-travaux', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

async function readSSE(res: Response): Promise<string[]> {
  const text = await res.text()
  return text.split('\n').filter(l => l.startsWith('data: ')).map(l => l.slice(6))
}

/** Reassemble the decoded text stream from SSE events (joins .text fields). */
function joinTextEvents(events: string[]): string {
  const parts: string[] = []
  for (const ev of events) {
    if (ev === '[DONE]') continue
    try {
      const json = JSON.parse(ev) as { text?: string }
      if (typeof json.text === 'string') parts.push(json.text)
    } catch {
      // raw non-JSON events (e.g. '[DONE]') — already filtered above
      parts.push(ev)
    }
  }
  return parts.join('')
}

// ── Shared setup ──────────────────────────────────────────────────────────────

beforeEach(() => {
  process.env.GROQ_API_KEY = 'test-key'
  process.env.SIMULATEUR_V2_FORCE_V1 = 'false'
  process.env.SIMULATEUR_V2_ROLLOUT = '0'
  mockGetAuthUser.mockResolvedValue({ id: 'test-user' })
  mockCheckRateLimit.mockResolvedValue(true)
  mockGetClientIP.mockReturnValue('127.0.0.1')
})

afterEach(() => {
  vi.clearAllMocks()
})

// ── Task 16 : V1 path (rollout=0) ─────────────────────────────────────────────
describe('route — V1 path (rollout=0)', () => {
  it('délègue à handleV1, ne contient pas [ESTIMATION_DATA]', async () => {
    const { POST } = await import('@/app/api/simulateur-travaux/route')
    const fakeStream = new ReadableStream<Uint8Array>({
      start(controller) {
        const enc = new TextEncoder()
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ text: 'V1 réponse standard' })}\n\n`))
        controller.enqueue(enc.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })
    mockCallGroqStreaming.mockResolvedValue(fakeStream)

    const req = makePOST({ messages: [{ role: 'user', content: 'peinture salon' }] })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const events = await readSSE(res)
    const joined = events.join('\n')
    expect(joined).toContain('V1 réponse standard')
    expect(joined).not.toContain('[ESTIMATION_DATA]')
  })

  it('respecte SIMULATEUR_V2_FORCE_V1 même si rollout=100', async () => {
    process.env.SIMULATEUR_V2_FORCE_V1 = 'true'
    process.env.SIMULATEUR_V2_ROLLOUT = '100'
    const { POST } = await import('@/app/api/simulateur-travaux/route')
    const fakeStream = new ReadableStream<Uint8Array>({
      start(controller) {
        const enc = new TextEncoder()
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ text: 'V1 forced' })}\n\n`))
        controller.enqueue(enc.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })
    mockCallGroqStreaming.mockResolvedValue(fakeStream)

    const req = makePOST({ messages: [{ role: 'user', content: 'x' }] })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockCallGroqStreaming).toHaveBeenCalled()
  })
})

// ── Task 17 : V2 happy path (in-catalog) ──────────────────────────────────────
describe('route — V2 happy path (in-catalog)', () => {
  beforeEach(() => {
    process.env.SIMULATEUR_V2_ROLLOUT = '100'
  })

  it('peinture salon 25m² → 2 tool calls + stream + [ESTIMATION_DATA]', async () => {
    const { POST } = await import('@/app/api/simulateur-travaux/route')

    mockCallGroqWithTools
      .mockResolvedValueOnce({
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [{
            id: 'c1', type: 'function',
            function: { name: 'lookupVariants', arguments: JSON.stringify({ description: 'peinture salon 25m²', metierHint: 'peinture', surface: 25 }) },
          }],
        },
      })
      .mockResolvedValueOnce({
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [{
            id: 'c2', type: 'function',
            function: { name: 'computeQuote', arguments: JSON.stringify({
              items: [{ taskId: 'peinture-murs-interieur-2couches', qty: 25 }],
              region: '13', gamme: 'standard', etat: 'bon',
            }) },
          }],
        },
      })
      .mockResolvedValueOnce({
        message: { role: 'assistant', content: 'Done' },
      })

    const fakeStream = new ReadableStream<Uint8Array>({
      start(controller) {
        const enc = new TextEncoder()
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ text: '📌 Peinture salon — {TOTAL_MIN} — {TOTAL_MAX}\n[CTA_BOURSE_AUX_MARCHES]\n[CTA_CONSEILLER_VITFIX]\n' })}\n\n`))
        controller.enqueue(enc.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })
    mockCallGroqStreaming.mockResolvedValue(fakeStream)

    const req = makePOST({ messages: [{ role: 'user', content: 'peinture salon 25m² Marseille' }] })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mockCallGroqWithTools).toHaveBeenCalledTimes(3)

    const events = await readSSE(res)
    const text = joinTextEvents(events)
    expect(text).toMatch(/Peinture salon/)
    expect(text).toMatch(/\d+\s*€/)  // valeurs substituées
    expect(text).toContain('[ESTIMATION_DATA]')
    expect(text).toContain('[/ESTIMATION_DATA]')

    const dataMatch = text.match(/\[ESTIMATION_DATA\]([\s\S]*?)\[\/ESTIMATION_DATA\]/)
    expect(dataMatch).toBeTruthy()
    const payload = JSON.parse(dataMatch![1])
    expect(payload.mode).toBe('normal')
    expect(payload.zoneDetected).toBe('PACA')
    expect(payload.breakdown).toHaveLength(1)
  })

  it('Set-Cookie bucket envoyé sur première requête', async () => {
    process.env.SIMULATEUR_V2_ROLLOUT = '50'
    const { POST } = await import('@/app/api/simulateur-travaux/route')

    mockCallGroqWithTools.mockResolvedValue({
      message: { role: 'assistant', content: 'x' },
    })
    const fakeStream = new ReadableStream<Uint8Array>({ start(c) { c.close() } })
    mockCallGroqStreaming.mockResolvedValue(fakeStream)

    const req = makePOST({ messages: [{ role: 'user', content: 'x' }] })
    const res = await POST(req)
    const setCookie = res.headers.get('Set-Cookie')
    expect(setCookie).toMatch(/vitfix_sim_v2_bucket=/)
  })
})

// ── Task 18 : V2 edge cases ──────────────────────────────────────────────────
describe('route — V2 edge cases', () => {
  beforeEach(() => {
    process.env.SIMULATEUR_V2_ROLLOUT = '100'
  })

  it('out-of-catalog : lookupVariants vide → mode=out-of-catalog', async () => {
    const { POST } = await import('@/app/api/simulateur-travaux/route')

    mockCallGroqWithTools
      .mockResolvedValueOnce({
        message: {
          role: 'assistant', content: null,
          tool_calls: [{ id: 'c1', type: 'function', function: { name: 'lookupVariants', arguments: JSON.stringify({ description: 'panneaux solaires' }) } }],
        },
      })
      .mockResolvedValueOnce({
        message: { role: 'assistant', content: 'OK' },
      })

    const fakeStream = new ReadableStream<Uint8Array>({
      start(controller) {
        const enc = new TextEncoder()
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ text: 'Tarif horaire {ARTISAN_RATE_MIN} — {ARTISAN_RATE_MAX}\n[CTA_BOURSE_AUX_MARCHES]\n' })}\n\n`))
        controller.enqueue(enc.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })
    mockCallGroqStreaming.mockResolvedValue(fakeStream)

    const req = makePOST({ messages: [{ role: 'user', content: 'panneaux solaires' }] })
    const res = await POST(req)
    const events = await readSSE(res)
    const text = joinTextEvents(events)
    expect(text).toMatch(/Tarif horaire/)
    const dataMatch = text.match(/\[ESTIMATION_DATA\]([\s\S]*?)\[\/ESTIMATION_DATA\]/)
    expect(dataMatch).toBeTruthy()
    const payload = JSON.parse(dataMatch![1])
    expect(payload.mode).toBe('out-of-catalog')
    expect(payload.artisanRate).toBeTruthy()
  })

  it('hallucination prix brut → chunk skipped', async () => {
    const { POST } = await import('@/app/api/simulateur-travaux/route')

    mockCallGroqWithTools
      .mockResolvedValueOnce({
        message: {
          role: 'assistant', content: null,
          tool_calls: [{ id: 'c1', type: 'function', function: { name: 'lookupVariants', arguments: JSON.stringify({ description: 'peinture mur' }) } }],
        },
      })
      .mockResolvedValueOnce({
        message: {
          role: 'assistant', content: null,
          tool_calls: [{ id: 'c2', type: 'function', function: { name: 'computeQuote', arguments: JSON.stringify({ items: [{ taskId: 'peinture-murs-interieur-2couches', qty: 10 }], region: 'PACA', gamme: 'standard', etat: 'bon' }) } }],
        },
      })
      .mockResolvedValueOnce({
        message: { role: 'assistant', content: 'final' },
      })

    const fakeStream = new ReadableStream<Uint8Array>({
      start(controller) {
        const enc = new TextEncoder()
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ text: 'Estimation : {TOTAL_MIN} — {TOTAL_MAX}\n' })}\n\n`))
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ text: "En vrai c'est plutôt 999 €\n" })}\n\n`))
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ text: '[CTA_BOURSE_AUX_MARCHES]\n' })}\n\n`))
        controller.enqueue(enc.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })
    mockCallGroqStreaming.mockResolvedValue(fakeStream)

    const req = makePOST({ messages: [{ role: 'user', content: 'peinture mur' }] })
    const res = await POST(req)
    const events = await readSSE(res)
    const joined = events.join('\n')
    expect(joined).not.toMatch(/999\s*€/)  // chunk hallu skipped
    expect(joined).toMatch(/Estimation/)
    expect(joined).toMatch(/CTA_BOURSE/)
  })

  it('validation rejet (computeQuote taskId inconnu) → fallback CTA', async () => {
    const { POST } = await import('@/app/api/simulateur-travaux/route')

    mockCallGroqWithTools
      .mockResolvedValueOnce({
        message: {
          role: 'assistant', content: null,
          tool_calls: [{ id: 'c1', type: 'function', function: { name: 'computeQuote', arguments: JSON.stringify({ items: [{ taskId: 'fake-not-existing', qty: 1 }], region: 'PACA', gamme: 'standard', etat: 'bon' }) } }],
        },
      })
      .mockResolvedValueOnce({
        message: { role: 'assistant', content: 'fini' },
      })

    const fakeStream = new ReadableStream<Uint8Array>({
      start(controller) {
        const enc = new TextEncoder()
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ text: '[CTA_BOURSE_AUX_MARCHES]\n' })}\n\n`))
        controller.enqueue(enc.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })
    mockCallGroqStreaming.mockResolvedValue(fakeStream)

    const req = makePOST({ messages: [{ role: 'user', content: 'x' }] })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const events = await readSSE(res)
    const joined = events.join('\n')
    expect(joined).toMatch(/CTA_BOURSE/)
  })
})
