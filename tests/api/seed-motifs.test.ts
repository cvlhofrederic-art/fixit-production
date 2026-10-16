// @vitest-environment node
// POST /api/seed-motifs — motifs par défaut d'un artisan connecté (Bearer obligatoire,
// artisan_id contrôlé contre la session). Logique d'insertion dans lib/seed-motifs.ts,
// partagée avec /api/pro/register/motifs-artisan. Supabase en mémoire.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import defaultMotifs from '@/lib/default-motifs.json'
import { appelsDe, clientMemoire, nouvelleBase, type BaseMemoire } from './syndic-supabase-memoire'

const USER_ID = '550e8400-e29b-41d4-a716-446655440000'
const ARTISAN_ID = '6ba7b810-9dad-41d1-80b4-00c04fd430c8'
const AUTRE_ARTISAN_ID = '6ba7b811-9dad-41d1-80b4-00c04fd430c8'

const h = vi.hoisted(() => ({
  base: null as unknown as BaseMemoire,
  sessionUser: null as { id: string } | null,
  checkRateLimit: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: h.checkRateLimit,
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
  rateLimitResponse: vi.fn(() => new Response(null, { status: 429 })),
}))

vi.mock('@/lib/auth-helpers', () => ({ getAuthUser: vi.fn(async () => h.sessionUser) }))

vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: { from: (t: string) => clientMemoire(h.base).from(t) },
}))

async function appeler(body: unknown) {
  const { POST } = await import('@/app/api/seed-motifs/route')
  return POST(new Request('http://localhost/api/seed-motifs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer jeton' },
    body: JSON.stringify(body),
  }) as never)
}

const servicesInseres = () => appelsDe(h.base, 'services', 'insert')[0]?.donnees as Array<Record<string, unknown>> | undefined

beforeEach(() => {
  h.base = nouvelleBase()
  h.base.lignes.profiles_artisan = [
    { id: ARTISAN_ID, user_id: USER_ID },
    { id: AUTRE_ARTISAN_ID, user_id: 'autre-user' },
  ]
  h.sessionUser = { id: USER_ID }
  h.checkRateLimit.mockReset().mockResolvedValue(true)
})

describe('POST /api/seed-motifs', () => {
  it("insère les motifs du métier demandé pour l'artisan de la session", async () => {
    const res = await appeler({ artisan_id: ARTISAN_ID, categories: ['electricite'] })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, count: 1, etapes_count: 0, metiers: ['electricien'] })
    const lignes = servicesInseres()!
    const electricien = defaultMotifs.metiers.find((m) => m.id === 'electricien')!.motifs
    expect(lignes.map((l) => l.name)).toEqual(electricien.map((m) => m.nom))
    expect(lignes.every((l) => l.artisan_id === ARTISAN_ID)).toBe(true)
  })

  it("ignore un artisan qui a déjà des motifs", async () => {
    h.base.lignes.services = [{ id: 'svc-1', artisan_id: ARTISAN_ID }]
    const res = await appeler({ artisan_id: ARTISAN_ID, categories: ['electricite'] })
    expect(await res.json()).toEqual({ skipped: true, reason: 'Motifs déjà existants' })
    expect(servicesInseres()).toBeUndefined()
  })

  it('401 sans session', async () => {
    h.sessionUser = null
    const res = await appeler({ artisan_id: ARTISAN_ID, categories: ['electricite'] })
    expect(res.status).toBe(401)
    expect(servicesInseres()).toBeUndefined()
  })

  it("403 pour l'artisan d'un autre compte", async () => {
    const res = await appeler({ artisan_id: AUTRE_ARTISAN_ID, categories: ['electricite'] })
    expect(res.status).toBe(403)
    expect(servicesInseres()).toBeUndefined()
  })

  it('404 pour un artisan inconnu', async () => {
    const res = await appeler({ artisan_id: '6ba7b812-9dad-41d1-80b4-00c04fd430c8', categories: ['electricite'] })
    expect(res.status).toBe(404)
  })

  it('400 sans catégorie ou avec un artisan_id mal formé', async () => {
    expect((await appeler({ artisan_id: ARTISAN_ID, categories: [] })).status).toBe(400)
    expect((await appeler({ artisan_id: 'pas-un-uuid', categories: ['electricite'] })).status).toBe(400)
    expect(servicesInseres()).toBeUndefined()
  })

  it("500 quand l'insertion échoue", async () => {
    h.base.erreurs['services.insert'] = { message: 'insert failed' }
    const res = await appeler({ artisan_id: ARTISAN_ID, categories: ['electricite'] })
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Erreur serveur' })
  })
})
