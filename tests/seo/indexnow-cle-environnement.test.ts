// @vitest-environment node
/**
 * lib/seo/indexnow.ts — la clé IndexNow n'est plus dans le code (lot 1 Aikido, 28/10/2026) : lue dans
 * l'environnement (INDEXNOW_KEY : process.env puis contexte Cloudflare, getSecret de lib/env.ts),
 * keyLocation fixé à https://vitfix.io/indexnow-key.txt (app/indexnow-key.txt/route.ts).
 * Sans clé : ok:false + avertissement structuré, jamais de throw ni d'appel réseau.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const h = vi.hoisted(() => ({ envWorker: {} as Record<string, string> }))

// Hors Worker Cloudflare : le contexte ne porte un secret que si le test l'y met.
vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: vi.fn(async () => ({ env: h.envWorker })),
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))

const CLE_TEST = 'cle-indexnow-de-test-non-secrete'
const ENDPOINT = 'https://api.indexnow.org/indexnow'

type AppelFetch = [string, RequestInit]
const appelsFetch = () => vi.mocked(fetch).mock.calls as unknown as AppelFetch[]

describe('submitIndexNow — clé lue dans l’environnement', () => {
  beforeEach(() => {
    vi.resetModules()
    h.envWorker = {}
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 202 })))
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('clé absente : ok:false, aucun appel réseau, avertissement structuré dans le logger', async () => {
    vi.stubEnv('INDEXNOW_KEY', '')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { submitIndexNow } = await import('@/lib/seo/indexnow')
    const resultat = await submitIndexNow(['https://vitfix.io/fr/'])
    expect(resultat).toEqual({ ok: false, status: 0, message: 'INDEXNOW_KEY is not set' })
    expect(fetch).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledOnce()
    const entree = JSON.parse(String(warn.mock.calls[0][0]))
    expect(entree.level).toBe('warn')
    expect(entree.message).toContain('INDEXNOW_KEY')
  })

  it('clé présente : un POST JSON vers api.indexnow.org avec key et keyLocation https://vitfix.io/indexnow-key.txt', async () => {
    vi.stubEnv('INDEXNOW_KEY', CLE_TEST)
    const { submitIndexNow, INDEXNOW_KEY_LOCATION } = await import('@/lib/seo/indexnow')
    const resultat = await submitIndexNow(['https://vitfix.io/fr/', 'https://vitfix.io/pt/'])
    expect(resultat).toEqual({ ok: true, status: 202 })
    expect(fetch).toHaveBeenCalledOnce()
    const [url, init] = appelsFetch()[0]
    expect(url).toBe(ENDPOINT)
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json; charset=utf-8' })
    expect(JSON.parse(String(init.body))).toEqual({
      host: 'vitfix.io',
      key: CLE_TEST,
      keyLocation: 'https://vitfix.io/indexnow-key.txt',
      urlList: ['https://vitfix.io/fr/', 'https://vitfix.io/pt/'],
    })
    expect(INDEXNOW_KEY_LOCATION).toBe('https://vitfix.io/indexnow-key.txt')
  })

  it('une seule URL : même POST, la clé ne transite jamais dans l’URL appelée', async () => {
    vi.stubEnv('INDEXNOW_KEY', CLE_TEST)
    const { submitIndexNow } = await import('@/lib/seo/indexnow')
    await submitIndexNow(['https://vitfix.io/pt/'])
    const [url, init] = appelsFetch()[0]
    expect(url).toBe(ENDPOINT)
    expect(url).not.toContain(CLE_TEST)
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body)).urlList).toEqual(['https://vitfix.io/pt/'])
  })

  it('clé posée seulement côté Worker (wrangler secret put) : lue depuis le contexte Cloudflare', async () => {
    vi.stubEnv('INDEXNOW_KEY', '')
    h.envWorker = { INDEXNOW_KEY: CLE_TEST }
    const { submitIndexNow } = await import('@/lib/seo/indexnow')
    const resultat = await submitIndexNow(['https://vitfix.io/fr/'])
    expect(resultat).toEqual({ ok: true, status: 202 })
    expect(JSON.parse(String(appelsFetch()[0][1].body)).key).toBe(CLE_TEST)
  })

  it('clé avec saut de ligne final (echo … | wrangler secret put) : envoyée sans le saut de ligne', async () => {
    vi.stubEnv('INDEXNOW_KEY', `${CLE_TEST}\n`)
    const { submitIndexNow } = await import('@/lib/seo/indexnow')
    expect(await submitIndexNow(['https://vitfix.io/fr/'])).toEqual({ ok: true, status: 202 })
    expect(JSON.parse(String(appelsFetch()[0][1].body)).key).toBe(CLE_TEST)
  })

  it('clé faite de blancs seulement : traitée comme absente (ok:false, aucun appel réseau)', async () => {
    vi.stubEnv('INDEXNOW_KEY', ' \n')
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { submitIndexNow } = await import('@/lib/seo/indexnow')
    expect(await submitIndexNow(['https://vitfix.io/fr/'])).toEqual({ ok: false, status: 0, message: 'INDEXNOW_KEY is not set' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('liste vide : ok:false sans lire la clé ni appeler le réseau', async () => {
    vi.stubEnv('INDEXNOW_KEY', CLE_TEST)
    const { submitIndexNow } = await import('@/lib/seo/indexnow')
    expect(await submitIndexNow([])).toEqual({ ok: false, status: 0, message: 'No URLs provided' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('réseau en échec : ok:false avec le message et un avertissement, jamais de throw', async () => {
    vi.stubEnv('INDEXNOW_KEY', CLE_TEST)
    vi.mocked(fetch).mockRejectedValueOnce(new Error('réseau coupé'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { submitIndexNow } = await import('@/lib/seo/indexnow')
    expect(await submitIndexNow(['https://vitfix.io/fr/'])).toEqual({ ok: false, status: 0, message: 'réseau coupé' })
    expect(warn).toHaveBeenCalledOnce()
  })
})
