// Tests du webhook Gmail Pub/Sub POST /api/email-agent/webhook (ALF-1).
// Échafaudage commun (mocks, builders, capture after()) : ./email-agent-test-utils.ts.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  SYNDIC_ID,
  GMAIL_SECRET,
  callWebhookPOST,
  expectJson,
  makeAfterCapture,
  makeLoggerMock,
  makeLoggerSpies,
  makeMaybeSingleChain,
  makeNextServerMockWithAfter,
  makeSupabaseJsMock,
  makeWebhookRequest,
} from './email-agent-test-utils'

// ── Mocks ────────────────────────────────────────────────────────────────────
// vi.mock est hoisté par fichier : les appels restent ici, mais les factories
// viennent du module partagé (exécution paresseuse à l'import de la route).
const sb = makeMaybeSingleChain()
vi.mock('@supabase/supabase-js', () => makeSupabaseJsMock(sb.chain))

const logger = makeLoggerSpies()
vi.mock('@/lib/logger', () => makeLoggerMock(logger))

// ── Mock partiel de next/server (ALF-1) ──────────────────────────────────────
// after() réel throw hors contexte requête Next (vitest appelle le handler
// directement). makeAfterCapture capture les callbacks pour vérifier qu'ils
// sont bien enregistrés PUIS les exécuter via flushAfterCallbacks (= ce que
// fait ctx.waitUntil en prod via OpenNext). NextRequest/NextResponse réels
// préservés par makeNextServerMockWithAfter.
const { mockAfter, flushAfterCallbacks, resetAfterCallbacks } = makeAfterCapture()
vi.mock('next/server', (importOriginal) => makeNextServerMockWithAfter(importOriginal, mockAfter))

describe('/api/email-agent/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetAfterCallbacks()
    sb.maybeSingle.mockResolvedValue({
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
    const res = await callWebhookPOST(makeWebhookRequest())
    expect(res.status).toBe(401)
  })

  it('rejette si body.message.data invalide → 400', async () => {
    const req = makeWebhookRequest({
      token: GMAIL_SECRET,
      body: JSON.stringify({ message: {} }),
    })
    const res = await callWebhookPOST(req)
    expect(res.status).toBe(400)
  })

  it('retourne ignored si aucun syndic pour cet email', async () => {
    sb.maybeSingle.mockResolvedValue({ data: null })
    const res = await callWebhookPOST(makeWebhookRequest({ token: GMAIL_SECRET }))
    const data = await expectJson(res, 200)
    expect(data.status).toBe('ignored')
    expect(mockAfter).not.toHaveBeenCalled()
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('enregistre le poll via after() (ctx.waitUntil) — fetch APRÈS la réponse, avec x-internal-trigger', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://vitfix.io')
    vi.stubEnv('INTERNAL_POLL_TOKEN', 'secret-interne')
    const res = await callWebhookPOST(makeWebhookRequest({ token: GMAIL_SECRET }))
    const data = await expectJson(res, 200)
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
    const res = await callWebhookPOST(makeWebhookRequest({ token: GMAIL_SECRET }))
    expect(res.status).toBe(200)
    await flushAfterCallbacks()
    const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe('https://legacy.vitfix.io/api/email-agent/poll')
  })

  it('INTERNAL_POLL_TOKEN absent → AUCUN appel poll (pas de header vide) + warn', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://vitfix.io')
    vi.stubEnv('INTERNAL_POLL_TOKEN', '')
    const res = await callWebhookPOST(makeWebhookRequest({ token: GMAIL_SECRET }))
    // Le webhook ack quand même Pub/Sub (200) mais ne déclenche pas le poll
    expect(res.status).toBe(200)
    expect(mockAfter).not.toHaveBeenCalled()
    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('INTERNAL_POLL_TOKEN'),
      expect.objectContaining({ syndic_id: SYNDIC_ID }),
    )
  })

  it('base URL absente → AUCUN appel poll + warn', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '')
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')
    vi.stubEnv('INTERNAL_POLL_TOKEN', 'secret-interne')
    const res = await callWebhookPOST(makeWebhookRequest({ token: GMAIL_SECRET }))
    expect(res.status).toBe(200)
    expect(mockAfter).not.toHaveBeenCalled()
    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('NEXT_PUBLIC_APP_URL'),
      expect.objectContaining({ syndic_id: SYNDIC_ID }),
    )
  })

  it('fetch rejette dans le callback after → warn, jamais propagé', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://vitfix.io')
    vi.stubEnv('INTERNAL_POLL_TOKEN', 'secret-interne')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom réseau')))
    const res = await callWebhookPOST(makeWebhookRequest({ token: GMAIL_SECRET }))
    expect(res.status).toBe(200)
    // L'exécution du callback ne doit PAS throw (échec avalé + warn)
    await expect(flushAfterCallbacks()).resolves.toBeUndefined()
    expect(logger.warn).toHaveBeenCalledWith(
      'webhook: trigger poll failed',
      expect.objectContaining({ error: 'boom réseau', syndic_id: SYNDIC_ID }),
    )
  })

  it('poll répond non-ok → warn avec le status, jamais propagé', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://vitfix.io')
    vi.stubEnv('INTERNAL_POLL_TOKEN', 'secret-interne')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 401 })))
    const res = await callWebhookPOST(makeWebhookRequest({ token: GMAIL_SECRET }))
    expect(res.status).toBe(200)
    await expect(flushAfterCallbacks()).resolves.toBeUndefined()
    expect(logger.warn).toHaveBeenCalledWith(
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
    const res = await callWebhookPOST(makeWebhookRequest({ token: GMAIL_SECRET }))
    expect(res.status).toBe(200)
    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('after() indisponible'),
      expect.objectContaining({ error: 'after unavailable', syndic_id: SYNDIC_ID }),
    )
  })
})
