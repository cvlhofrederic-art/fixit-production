// @vitest-environment node
// tests/api/tracking.test.ts
//
// Suivi GPS partagé avec le client (bucket privé « tracking », objet {token}.json en service role) :
//   - GET /api/tracking/[token] : public, limité par IP, jeton au format émis par l'application mobile
//     (lib/security/tracking-token.ts) sinon 400 avant toute construction de chemin ; le compte qui alimente
//     la session (artisan_user_id) n'est jamais renvoyé ;
//   - POST /api/tracking/update : compte connecté, jeton validé par le schéma Zod ; la session enregistre
//     le compte qui l'alimente et refuse (403) qu'un autre compte l'écrase ;
//   - DELETE /api/tracking/[token] : même règle de propriété.
// Storage simulé en mémoire (objets par chemin).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => ({
  objets: new Map<string, string>(),
  utilisateur: null as { id: string } | null,
  limiteOk: true,
  clesLimite: [] as string[],
  suppressions: [] as string[][],
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({ logger: { warn: h.loggerWarn, error: h.loggerError, info: vi.fn(), debug: vi.fn() } }))
vi.mock('@/lib/auth-helpers', () => ({ getAuthUser: vi.fn(async () => h.utilisateur) }))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async (cle: string) => { h.clesLimite.push(cle); return h.limiteOk }),
  getClientIP: vi.fn(() => '203.0.113.9'),
  rateLimitResponse: vi.fn(() => Response.json({ error: 'rate' }, { status: 429 })),
}))
vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: {
    storage: {
      createBucket: async () => ({ data: null, error: null }),
      from: (bucket: string) => {
        if (bucket !== 'tracking') throw new Error(`bucket inattendu : ${bucket}`)
        return {
          download: async (chemin: string) => {
            const json = h.objets.get(chemin)
            if (json === undefined) return { data: null, error: { message: 'Object not found', statusCode: '404' } }
            return { data: { text: async () => json }, error: null }
          },
          upload: async (chemin: string, corps: Buffer) => {
            h.objets.set(chemin, corps.toString('utf8'))
            return { data: { path: chemin }, error: null }
          },
          remove: async (chemins: string[]) => {
            h.suppressions.push(chemins)
            for (const c of chemins) h.objets.delete(c)
            return { data: [], error: null }
          },
        }
      },
    },
  },
}))

const { GET, DELETE } = await import('@/app/api/tracking/[token]/route')
const { POST } = await import('@/app/api/tracking/update/route')

const TOKEN = 'TRK-MH6V0ABC-X9ZQ' // gitleaks:allow — jeton de suivi factice (fixture de test, pas un secret)
const OBJET = `${TOKEN}.json`
const ARTISAN = '550e8400-e29b-41d4-a716-446655440000'
const AUTRE = 'ffffffff-0000-4000-8000-000000000001'

const session = (surcharge: Record<string, unknown> = {}) => JSON.stringify({
  token: TOKEN, lat: 43.29, lng: 5.37, status: 'en_route', artisan_nom: 'Paul Durand', artisan_initiales: 'PD',
  mission_titre: 'Fuite cuisine', mission_adresse: '12 rue de Rome, Marseille', photos: [],
  started_at: '2026-10-28T09:00:00.000Z', updated_at: new Date().toISOString(), artisan_user_id: ARTISAN, ...surcharge,
})

const lire = (token: string) =>
  GET(new NextRequest(`https://vitfix.io/api/tracking/${encodeURIComponent(token)}`), { params: Promise.resolve({ token }) })
const supprimer = (token: string) =>
  DELETE(new NextRequest(`https://vitfix.io/api/tracking/${encodeURIComponent(token)}`, { method: 'DELETE', headers: { Authorization: 'Bearer jeton' } }), { params: Promise.resolve({ token }) })
const mettreAJour = (corps: Record<string, unknown>) =>
  POST(new NextRequest('https://vitfix.io/api/tracking/update', {
    method: 'POST', headers: { Authorization: 'Bearer jeton', 'Content-Type': 'application/json' }, body: JSON.stringify(corps),
  }))
const miseAJour = (surcharge: Record<string, unknown> = {}) => ({
  token: TOKEN, lat: 43.3, lng: 5.38, status: 'sur_place', artisanNom: 'Paul Durand', artisanInitiales: 'PD',
  missionTitre: 'Fuite cuisine', missionAdresse: '12 rue de Rome, Marseille', ...surcharge,
})

beforeEach(() => {
  h.objets.clear()
  h.utilisateur = { id: ARTISAN }
  h.limiteOk = true
  h.clesLimite = []
  h.suppressions = []
  h.loggerWarn.mockClear()
  h.loggerError.mockClear()
})

describe('GET /api/tracking/[token] — page publique de suivi', () => {
  it('session en cours → 200 avec la position et le statut, sans le compte qui l’alimente', async () => {
    h.objets.set(OBJET, session())
    const res = await lire(TOKEN)
    expect(res.status).toBe(200)
    const corps = await res.json()
    expect(corps).toMatchObject({ token: TOKEN, lat: 43.29, lng: 5.37, status: 'en_route', artisan_nom: 'Paul Durand', mission_titre: 'Fuite cuisine' })
    expect(corps).not.toHaveProperty('artisan_user_id')
    expect(JSON.stringify(corps)).not.toContain(ARTISAN)
  })

  it('limité par IP (60 lectures par minute) → 429 au-delà', async () => {
    h.objets.set(OBJET, session())
    h.limiteOk = false
    const res = await lire(TOKEN)
    expect(res.status).toBe(429)
    expect(h.clesLimite).toEqual(['tracking_get_203.0.113.9'])
  })

  it.each([
    ['UUID (ancien motif)', '550e8400-e29b-41d4-a716-446655440000'],
    ['remontant', '../x'],
    ['minuscules', 'TRK-mh6v0abc-x9zq'],
    ['suffixe trop long', 'TRK-MH6V0ABC-X9ZQ1'],
    ['avec extension', 'TRK-MH6V0ABC-X9ZQ.json'],
  ])('jeton %s → 400 Token invalide, aucune lecture Storage', async (_cas, token) => {
    const res = await lire(token)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Token invalide' })
  })

  it('session inconnue → 404 ; session de plus de 24 h → 410', async () => {
    expect((await lire(TOKEN)).status).toBe(404)
    h.objets.set(OBJET, session({ updated_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() }))
    expect((await lire(TOKEN)).status).toBe(410)
  })
})

describe('POST /api/tracking/update — écriture de la session', () => {
  it('nouvelle session → 200, objet {token}.json écrit avec le compte qui l’alimente', async () => {
    const res = await mettreAJour(miseAJour())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
    const ecrit = JSON.parse(h.objets.get(OBJET)!)
    expect(ecrit).toMatchObject({ token: TOKEN, lat: 43.3, lng: 5.38, status: 'sur_place', artisan_nom: 'Paul Durand', artisan_user_id: ARTISAN })
  })

  it('session déjà alimentée par un autre compte → 403, objet inchangé', async () => {
    const avant = session({ artisan_user_id: AUTRE })
    h.objets.set(OBJET, avant)
    const res = await mettreAJour(miseAJour())
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Non autorisé' })
    expect(h.objets.get(OBJET)).toBe(avant)
  })

  it('session alimentée par le même compte → 200, mise à jour, propriétaire conservé', async () => {
    h.objets.set(OBJET, session({ status: 'en_route' }))
    expect((await mettreAJour(miseAJour({ status: 'termine' }))).status).toBe(200)
    expect(JSON.parse(h.objets.get(OBJET)!)).toMatchObject({ status: 'termine', artisan_user_id: ARTISAN })
  })

  it('session écrite avant ce contrôle (sans propriétaire) → reprise par le premier compte qui la met à jour', async () => {
    h.objets.set(OBJET, session({ artisan_user_id: undefined }))
    expect(JSON.parse(h.objets.get(OBJET)!)).not.toHaveProperty('artisan_user_id')
    expect((await mettreAJour(miseAJour())).status).toBe(200)
    expect(JSON.parse(h.objets.get(OBJET)!).artisan_user_id).toBe(ARTISAN)
  })

  it.each([['../x'], ['550e8400-e29b-41d4-a716-446655440000'], ['TRK-MH6V0ABC-X9ZQ/..']])('jeton %s → 400, rien écrit', async (token) => {
    const res = await mettreAJour(miseAJour({ token }))
    expect(res.status).toBe(400)
    expect(h.objets.size).toBe(0)
  })

  it('sans utilisateur → 401, rien écrit', async () => {
    h.utilisateur = null
    expect((await mettreAJour(miseAJour())).status).toBe(401)
    expect(h.objets.size).toBe(0)
  })
})

describe('DELETE /api/tracking/[token] — fin de session', () => {
  it('par le compte qui alimente la session → 200, objet supprimé', async () => {
    h.objets.set(OBJET, session())
    const res = await supprimer(TOKEN)
    expect(res.status).toBe(200)
    expect(h.suppressions).toEqual([[OBJET]])
    expect(h.objets.has(OBJET)).toBe(false)
  })

  it('par un autre compte → 403, objet conservé', async () => {
    h.objets.set(OBJET, session({ artisan_user_id: AUTRE }))
    const res = await supprimer(TOKEN)
    expect(res.status).toBe(403)
    expect(h.suppressions).toHaveLength(0)
    expect(h.objets.has(OBJET)).toBe(true)
  })

  it('session sans propriétaire → supprimable par un compte connecté', async () => {
    h.objets.set(OBJET, session({ artisan_user_id: undefined }))
    expect((await supprimer(TOKEN)).status).toBe(200)
    expect(h.objets.has(OBJET)).toBe(false)
  })

  it('jeton hors format → 400 ; sans utilisateur → 401 ; rien supprimé', async () => {
    h.objets.set(OBJET, session())
    expect((await supprimer('../x')).status).toBe(400)
    h.utilisateur = null
    expect((await supprimer(TOKEN)).status).toBe(401)
    expect(h.suppressions).toHaveLength(0)
  })
})
