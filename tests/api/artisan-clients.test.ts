// @vitest-environment node
// tests/api/artisan-clients.test.ts — GET /api/artisan-clients (lot 4 Sentry du 28/10/2026).
//   - 401 sans session (Bearer absent ou invalide) ;
//   - mode artisan_id : 403 si la fiche n'appartient pas à l'utilisateur connecté, 200 avec ses clients
//     (réservations groupées par client) ;
//   - mode client_id : 403 sans réservation commune, 200 avec ;
//   - 400 sans paramètre.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

type Ligne = Record<string, unknown>

const h = vi.hoisted(() => {
  const etat = {
    user: null as null | { id: string },
    profils: [] as Array<{ id: string; user_id: string }>,
    bookings: [] as Ligne[],
    utilisateurs: {} as Record<string, { id: string; email: string; user_metadata: Record<string, unknown> }>,
  }
  const from = (table: string) => {
    const filtres: Array<[string, unknown]> = []
    const lignes = (): Ligne[] => {
      const source: Ligne[] = table === 'profiles_artisan' ? etat.profils : table === 'bookings' ? etat.bookings : []
      return source.filter((l) => filtres.every(([c, v]) => l[c] === v))
    }
    const b: Record<string, unknown> = {}
    b.select = () => b
    b.eq = (c: string, v: unknown) => { filtres.push([c, v]); return b }
    b.not = () => b
    b.order = () => b
    b.limit = () => b
    b.single = async () => {
      const [premiere] = lignes()
      return premiere ? { data: premiere, error: null } : { data: null, error: { message: 'no rows' } }
    }
    b.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) =>
      Promise.resolve({ data: lignes(), error: null }).then(ok, ko)
    return b
  }
  return { etat, from }
})

vi.mock('@/lib/auth-helpers', () => ({ getAuthUser: vi.fn(async () => h.etat.user) }))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => true),
  getClientIP: vi.fn(() => '127.0.0.1'),
  rateLimitResponse: vi.fn(() => Response.json({ error: 'rate' }, { status: 429 })),
}))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))
vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: {
    from: (t: string) => h.from(t),
    auth: {
      admin: {
        getUserById: async (id: string) => {
          const user = h.etat.utilisateurs[id] ?? null
          return { data: { user }, error: user ? null : { message: 'absent' } }
        },
      },
    },
  },
}))

const { GET } = await import('@/app/api/artisan-clients/route')

const USER_A = '550e8400-e29b-41d4-a716-446655440000'
const USER_B = '660e8400-e29b-41d4-a716-446655440001'
const ARTISAN_A = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const ARTISAN_B = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e'
const CLIENT_1 = 'c1000000-0000-4000-8000-000000000001'
const CLIENT_2 = 'c2000000-0000-4000-8000-000000000002'

const appeler = async (query: string) => {
  const res = await GET(new NextRequest(`https://vitfix.io/api/artisan-clients${query}`, { headers: { Authorization: 'Bearer tok' } }))
  return { status: res.status, json: await res.json() }
}

beforeEach(() => {
  h.etat.user = { id: USER_A }
  h.etat.profils = [
    { id: ARTISAN_A, user_id: USER_A },
    { id: ARTISAN_B, user_id: USER_B },
  ]
  h.etat.bookings = [
    { id: 'b1', artisan_id: ARTISAN_A, client_id: CLIENT_1, booking_date: '2026-10-01', status: 'completed', address: '1 rue A', price_ttc: 120, services: { name: 'Plomberie' } },
    { id: 'b2', artisan_id: ARTISAN_A, client_id: CLIENT_1, booking_date: '2026-09-01', status: 'completed', address: '1 rue A', price_ttc: 80, services: null },
    { id: 'b3', artisan_id: ARTISAN_A, client_id: CLIENT_2, booking_date: '2026-08-01', status: 'cancelled', address: '2 rue B', price_ttc: 50, services: { name: 'Électricité' } },
    { id: 'b4', artisan_id: ARTISAN_B, client_id: CLIENT_2, booking_date: '2026-07-01', status: 'completed', address: '3 rue C', price_ttc: 40, services: null },
  ]
  h.etat.utilisateurs = {
    [CLIENT_1]: { id: CLIENT_1, email: 'camille@example.com', user_metadata: { full_name: 'Camille Client', phone: '0600000001', address: '1 rue A' } },
  }
})

describe('GET /api/artisan-clients — authentification', () => {
  it('401 sans session', async () => {
    h.etat.user = null
    const res = await appeler(`?artisan_id=${ARTISAN_A}`)
    expect(res.status).toBe(401)
    expect(res.json).toEqual({ error: 'Non authentifié' })
  })

  it('400 sans paramètre', async () => {
    const res = await appeler('')
    expect(res.status).toBe(400)
  })
})

describe('GET /api/artisan-clients?artisan_id — autorisation', () => {
  it('200 avec sa propre fiche : clients groupés par réservation, client sans compte ignoré', async () => {
    const res = await appeler(`?artisan_id=${ARTISAN_A}`)
    expect(res.status).toBe(200)
    expect(res.json.clients).toHaveLength(1)
    const [client] = res.json.clients
    expect(client).toMatchObject({ id: CLIENT_1, source: 'auth', name: 'Camille Client', email: 'camille@example.com', phone: '0600000001' })
    expect(client.bookings).toEqual([
      { id: 'b1', date: '2026-10-01', service: 'Plomberie', status: 'completed', address: '1 rue A', price: 120 },
      { id: 'b2', date: '2026-09-01', service: 'Intervention', status: 'completed', address: '1 rue A', price: 80 },
    ])
  })

  it('403 avec la fiche d’un autre artisan', async () => {
    const res = await appeler(`?artisan_id=${ARTISAN_B}`)
    expect(res.status).toBe(403)
    expect(res.json).toEqual({ error: 'Accès refusé' })
  })

  it('403 avec une fiche inexistante', async () => {
    const res = await appeler('?artisan_id=00000000-0000-4000-8000-000000000000')
    expect(res.status).toBe(403)
  })
})

describe('GET /api/artisan-clients?client_id — pré-remplissage du devis', () => {
  it('200 pour un client qui a réservé chez l’artisan connecté', async () => {
    const res = await appeler(`?client_id=${CLIENT_1}`)
    expect(res.status).toBe(200)
    expect(res.json).toEqual({ id: CLIENT_1, email: 'camille@example.com', name: 'Camille Client', phone: '0600000001', address: '1 rue A' })
  })

  it('403 pour un client sans réservation chez l’artisan connecté', async () => {
    h.etat.user = { id: USER_B }
    const res = await appeler(`?client_id=${CLIENT_1}`)
    expect(res.status).toBe(403)
  })

  it('403 pour un compte sans fiche artisan', async () => {
    h.etat.user = { id: '770e8400-e29b-41d4-a716-446655440002' }
    const res = await appeler(`?client_id=${CLIENT_1}`)
    expect(res.status).toBe(403)
  })
})
