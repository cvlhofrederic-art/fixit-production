import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────────────────
const mockMaybeSingle = vi.fn()
const chain: Record<string, unknown> = {}
chain.select = vi.fn(() => chain)
chain.eq = vi.fn(() => chain)
chain.maybeSingle = mockMaybeSingle
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: vi.fn(() => chain) })),
}))

const mockLoggerWarn = vi.fn()
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    error: vi.fn(),
  },
}))

// ── Mock partiel de next/server (ALF-1) ──────────────────────────────────────
// after() réel throw hors contexte requête Next (vitest appelle le handler
// directement). On capture les callbacks pour vérifier qu'ils sont bien
// enregistrés PUIS les exécuter manuellement (= ce que fait ctx.waitUntil en
// prod via OpenNext). NextRequest/NextResponse réels préservés.
const afterCallbacks: Array<() => unknown | Promise<unknown>> = []
const mockAfter = vi.fn((task: () => unknown | Promise<unknown>) => {
  afterCallbacks.push(task)
})
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return { ...actual, after: (task: () => unknown | Promise<unknown>) => mockAfter(task) }
})

// Exécute les callbacks after() enregistrés (simule la phase post-réponse).
async function flushAfterCallbacks() {
  const tasks = afterCallbacks.splice(0)
  for (const task of tasks) await task()
}

const GMAIL_SECRET = 'gmail-webhook-secret-test'
const SYNDIC_ID = 'cab-123'

function webhookRequest(opts: { token?: string; email?: string } = {}) {
  const payload = { emailAddress: opts.email ?? 'syndic@example.com', historyId: '42' }
  const data = Buffer.from(JSON.stringify(payload)).toString('base64')
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (opts.token !== undefined) headers['x-gmail-webhook-token'] = opts.token
  return new Request('http://localhost:3000/api/email-agent/webhook', {
    method: 'POST',
    headers,
    body: JSON.stringify({ message: { data } }),
  })
}

async function callPOST(req: Request) {
  const { POST } = await import('@/app/api/email-agent/webhook/route')
  return POST(req as never)
}

describe('/api/email-agent/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    afterCallbacks.length = 0
    mockMaybeSingle.mockResolvedValue({
      data: { syndic_id: SYNDIC_ID, email_compte: 'syndic@example.com' },
    })
    vi.stubEnv('GMAIL_WEBHOOK_SECRET', GMAIL_SECRET)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')))
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('module loads', async () => {
    const mod = await import('@/app/api/email-agent/webhook/route')
    expect(typeof mod.POST).toBe('function')
  })

  it('rejette si x-gmail-webhook-token absent → 401', async () => {
    const res = await callPOST(webhookRequest())
    expect(res.status).toBe(401)
  })

  it('rejette si body.message.data invalide → 400', async () => {
    const req = new Request('http://localhost:3000/api/email-agent/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-gmail-webhook-token': GMAIL_SECRET },
      body: JSON.stringify({ message: {} }),
    })
    const res = await callPOST(req)
    expect(res.status).toBe(400)
  })

  it('retourne ignored si aucun syndic pour cet email', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null })
    const res = await callPOST(webhookRequest({ token: GMAIL_SECRET }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.status).toBe('ignored')
    expect(mockAfter).not.toHaveBeenCalled()
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('enregistre le poll via after() (ctx.waitUntil) — fetch APRÈS la réponse, avec x-internal-trigger', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://vitfix.io')
    vi.stubEnv('INTERNAL_POLL_TOKEN', 'secret-interne')
    const res = await callPOST(webhookRequest({ token: GMAIL_SECRET }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.status).toBe('queued')
    // Le callback est ENREGISTRÉ via after() mais pas encore exécuté :
    // l'ack Pub/Sub part sans attendre le fetch.
    expect(mockAfter).toHaveBeenCalledTimes(1)
    expect(globalThis.fetch).not.toHaveBeenCalled()
    // Phase post-réponse (ctx.waitUntil) : le fetch est bien EXÉCUTÉ.
    await flushAfterCallbacks()
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe('https://vitfix.io/api/email-agent/poll')
    expect(init.headers['x-internal-trigger']).toBe('secret-interne')
    expect(JSON.parse(init.body).syndic_id).toBe(SYNDIC_ID)
  })

  it('fallback NEXT_PUBLIC_SITE_URL si NEXT_PUBLIC_APP_URL absente', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '')
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://legacy.vitfix.io')
    vi.stubEnv('INTERNAL_POLL_TOKEN', 'secret-interne')
    const res = await callPOST(webhookRequest({ token: GMAIL_SECRET }))
    expect(res.status).toBe(200)
    await flushAfterCallbacks()
    const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe('https://legacy.vitfix.io/api/email-agent/poll')
  })

  it('INTERNAL_POLL_TOKEN absent → AUCUN appel poll (pas de header vide) + warn', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://vitfix.io')
    vi.stubEnv('INTERNAL_POLL_TOKEN', '')
    const res = await callPOST(webhookRequest({ token: GMAIL_SECRET }))
    // Le webhook ack quand même Pub/Sub (200) mais ne déclenche pas le poll
    expect(res.status).toBe(200)
    expect(mockAfter).not.toHaveBeenCalled()
    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('INTERNAL_POLL_TOKEN'),
      expect.objectContaining({ syndic_id: SYNDIC_ID }),
    )
  })

  it('base URL absente → AUCUN appel poll + warn', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '')
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')
    vi.stubEnv('INTERNAL_POLL_TOKEN', 'secret-interne')
    const res = await callPOST(webhookRequest({ token: GMAIL_SECRET }))
    expect(res.status).toBe(200)
    expect(mockAfter).not.toHaveBeenCalled()
    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('NEXT_PUBLIC_APP_URL'),
      expect.objectContaining({ syndic_id: SYNDIC_ID }),
    )
  })

  it('fetch rejette dans le callback after → warn, jamais propagé', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://vitfix.io')
    vi.stubEnv('INTERNAL_POLL_TOKEN', 'secret-interne')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom réseau')))
    const res = await callPOST(webhookRequest({ token: GMAIL_SECRET }))
    expect(res.status).toBe(200)
    // L'exécution du callback ne doit PAS throw (échec avalé + warn)
    await expect(flushAfterCallbacks()).resolves.toBeUndefined()
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      'webhook: trigger poll failed',
      expect.objectContaining({ error: 'boom réseau', syndic_id: SYNDIC_ID }),
    )
  })

  it('poll répond non-ok → warn avec le status, jamais propagé', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://vitfix.io')
    vi.stubEnv('INTERNAL_POLL_TOKEN', 'secret-interne')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 401 })))
    const res = await callPOST(webhookRequest({ token: GMAIL_SECRET }))
    expect(res.status).toBe(200)
    await expect(flushAfterCallbacks()).resolves.toBeUndefined()
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      'webhook: trigger poll non-ok',
      expect.objectContaining({ status: 401, syndic_id: SYNDIC_ID }),
    )
  })

  it('after() throw à l\'enregistrement → warn + ack 200 quand même', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://vitfix.io')
    vi.stubEnv('INTERNAL_POLL_TOKEN', 'secret-interne')
    mockAfter.mockImplementationOnce(() => {
      throw new Error('after unavailable')
    })
    const res = await callPOST(webhookRequest({ token: GMAIL_SECRET }))
    expect(res.status).toBe(200)
    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('after() indisponible'),
      expect.objectContaining({ error: 'after unavailable', syndic_id: SYNDIC_ID }),
    )
  })
})
