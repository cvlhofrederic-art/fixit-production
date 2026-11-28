// @vitest-environment node
/**
 * GET /indexnow-key.txt — fichier de vérification IndexNow servi depuis INDEXNOW_KEY (lot 1 Aikido,
 * 28/10/2026) : plus aucun fichier statique public/{clé}.txt dans le dépôt. Clé absente → 404 ;
 * présente (process.env ou contexte Cloudflare) → corps exact en text/plain.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readdirSync } from 'node:fs'
import path from 'node:path'

const h = vi.hoisted(() => ({ envWorker: {} as Record<string, string> }))

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: vi.fn(async () => ({ env: h.envWorker })),
}))

const CLE_TEST = 'cle-indexnow-de-test-non-secrete'

describe('GET /indexnow-key.txt', () => {
  beforeEach(() => {
    vi.resetModules()
    h.envWorker = {}
  })
  afterEach(() => vi.unstubAllEnvs())

  it('clé absente : 404, route dynamique (jamais figée au build)', async () => {
    vi.stubEnv('INDEXNOW_KEY', '')
    const { GET, dynamic } = await import('@/app/indexnow-key.txt/route')
    expect(dynamic).toBe('force-dynamic')
    const res = await GET()
    expect(res.status).toBe(404)
    expect(await res.text()).not.toContain(CLE_TEST)
  })

  it('clé présente dans process.env : corps exact, text/plain, cache 1 h', async () => {
    vi.stubEnv('INDEXNOW_KEY', CLE_TEST)
    const { GET } = await import('@/app/indexnow-key.txt/route')
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.text()).toBe(CLE_TEST)
    expect(res.headers.get('content-type')).toBe('text/plain; charset=utf-8')
    expect(res.headers.get('cache-control')).toBe('public, max-age=3600')
  })

  it('clé posée seulement côté Worker (wrangler secret put INDEXNOW_KEY) : servie aussi', async () => {
    vi.stubEnv('INDEXNOW_KEY', '')
    h.envWorker = { INDEXNOW_KEY: CLE_TEST }
    const { GET } = await import('@/app/indexnow-key.txt/route')
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.text()).toBe(CLE_TEST)
  })

  it('clé avec saut de ligne final : corps exact sans le saut de ligne (identique au champ key des pings)', async () => {
    vi.stubEnv('INDEXNOW_KEY', `${CLE_TEST}\n`)
    const { GET } = await import('@/app/indexnow-key.txt/route')
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.text()).toBe(CLE_TEST)
  })

  it('clé faite de blancs seulement : 404 comme une clé absente', async () => {
    vi.stubEnv('INDEXNOW_KEY', ' \n')
    const { GET } = await import('@/app/indexnow-key.txt/route')
    expect((await GET()).status).toBe(404)
  })

  it('plus aucun fichier de clé statique {32 hexadécimaux}.txt dans public/', () => {
    const fichiersCle = readdirSync(path.resolve(__dirname, '../../public')).filter((f) => /^[0-9a-f]{32}\.txt$/i.test(f))
    expect(fichiersCle).toEqual([])
  })
})
