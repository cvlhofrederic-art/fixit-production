// @vitest-environment node
// tests/api/aj-signalement-adresse.test.ts
//
// POST /api/aj-signalement/adresse — adresse proposée d'après la position de la personne qui a scanné le QR code
// d'une copropriété dont l'adresse n'est pas renseignée (demande de Hugo du 06/11/2026) :
//   - corps validé (jeton, latitude −90..90, longitude −180..180) ; jeton inconnu ou QR code désactivé → 404 ;
//   - adresse déjà renseignée → 409, sans appeler le service de géocodage ;
//   - géocodage inverse auprès de data.geopf.fr ; seule l'adresse revient, null si le service échoue ;
//   - limites par IP et par copropriété ; aucune écriture en base ; la position n'est ni journalisée ni renvoyée.
// Simulés : Supabase, le limiteur, le logger, Sentry et fetch (le service de l'État).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => {
  const etat = {
    copropriete: null as null | Record<string, unknown>,
    erreurLecture: null as null | { code: string; message: string },
    filtres: [] as Array<[string, unknown]>,
    ecritures: [] as string[],
    limites: [] as string[],
    refuser: [] as string[],
  }
  const from = (table: string) => {
    const q: Record<string, unknown> = {}
    q.select = () => q
    q.eq = (colonne: string, valeur: unknown) => { etat.filtres.push([colonne, valeur]); return q }
    for (const m of ['insert', 'update', 'upsert', 'delete']) q[m] = () => { etat.ecritures.push(`${m} ${table}`); return q }
    q.maybeSingle = async () => (etat.erreurLecture ? { data: null, error: etat.erreurLecture } : { data: etat.copropriete, error: null })
    return q
  }
  return { etat, from, warn: vi.fn(), error: vi.fn(), info: vi.fn() }
})

vi.mock('@sentry/nextjs', () => ({ suppressTracing: <T,>(rappel: () => T): T => rappel(), captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { error: h.error, warn: h.warn, info: h.info, debug: vi.fn() } }))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async (cle: string) => {
    h.etat.limites.push(cle)
    return !h.etat.refuser.some((prefixe) => cle.startsWith(prefixe))
  }),
  getClientIP: vi.fn(() => '127.0.0.1'),
  rateLimitResponse: vi.fn(() => Response.json({ error: 'rate' }, { status: 429 })),
}))
vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin: { from: (table: string) => h.from(table) } }))
vi.mock('@/lib/supabase-server-component', () => ({ createServerSupabaseClient: vi.fn(async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } })) }))
vi.mock('@/lib/auth-helpers', () => ({ getAuthUser: vi.fn(async () => null) }))

const { POST } = await import('@/app/api/aj-signalement/adresse/route')

const JETON = '0123456789abcdef0123456789abcdef'
const COPRO = {
  id: 'c0000000-0000-4000-8000-000000000001', nom: 'Parc Belle Ombre', adresse: '', jeton: JETON,
  emails_destinataires: [], actif: true, created_at: '2026-11-04T10:00:00.000Z',
}
// Lieu public (Vieux-Port de Marseille), aucune donnée réelle d'une personne.
const LATITUDE = 43.2951234
const LONGITUDE = 5.3741234
const CORPS = { jeton: JETON, latitude: LATITUDE, longitude: LONGITUDE }
const BAN = {
  type: 'FeatureCollection',
  features: [{ type: 'Feature', properties: { type: 'housenumber', label: '1 Quai du Port 13002 Marseille', name: '1 Quai du Port', postcode: '13002', city: 'Marseille' } }],
}

let appelsBan: string[] = []
function simulerBan(reponse: () => Response | Promise<Response>) {
  appelsBan = []
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    appelsBan.push(String(url))
    return reponse()
  }))
}
const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } })

function poster(corps: unknown) {
  return POST(new NextRequest('https://vitfix.io/api/aj-signalement/adresse', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corps),
  }))
}

/** Tout ce que la route a écrit au logger : jamais la position. */
const journal = () => JSON.stringify([h.warn.mock.calls, h.error.mock.calls, h.info.mock.calls])

beforeEach(() => {
  h.etat.copropriete = { ...COPRO }
  h.etat.erreurLecture = null
  h.etat.filtres = []
  h.etat.ecritures = []
  h.etat.limites = []
  h.etat.refuser = []
  h.warn.mockClear()
  h.error.mockClear()
  h.info.mockClear()
  vi.unstubAllGlobals()
  simulerBan(() => json(BAN))
})

describe('validation', () => {
  it.each([
    ['latitude au-delà de 90', { ...CORPS, latitude: 90.0001 }],
    ['latitude en deçà de −90', { ...CORPS, latitude: -91 }],
    ['longitude au-delà de 180', { ...CORPS, longitude: 180.5 }],
    ['longitude en deçà de −180', { ...CORPS, longitude: -181 }],
    ['latitude en texte', { ...CORPS, latitude: '43.29' }],
    ['longitude absente', { jeton: JETON, latitude: LATITUDE }],
    ['jeton mal formé', { ...CORPS, jeton: 'abc' }],
  ])('400 : %s ; ni base, ni service de géocodage', async (_cas, corps) => {
    const res = await poster(corps)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('invalide')
    expect(appelsBan).toHaveLength(0)
    expect(h.etat.filtres).toHaveLength(0)
  })

  it('bornes comprises : −90, 90, −180 et 180 sont acceptés', async () => {
    for (const [latitude, longitude] of [[-90, -180], [90, 180]]) {
      expect((await poster({ jeton: JETON, latitude, longitude })).status).toBe(200)
    }
  })
})

describe('copropriété', () => {
  it('404 quand le jeton ne désigne aucune copropriété active (filtre actif = true)', async () => {
    h.etat.copropriete = null
    const res = await poster(CORPS)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'introuvable' })
    expect(h.etat.filtres).toContainEqual(['jeton', JETON])
    expect(h.etat.filtres).toContainEqual(['actif', true])
    expect(appelsBan).toHaveLength(0)
  })

  it('409 adresse_connue quand l’adresse est déjà renseignée : le service de géocodage n’est pas appelé', async () => {
    h.etat.copropriete = { ...COPRO, adresse: '12 allée des Pins, 13009 Marseille' }
    const res = await poster(CORPS)
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'adresse_connue' })
    expect(appelsBan).toHaveLength(0)
  })

  it('503 base_absente tant que la migration 20261104 n’est pas appliquée', async () => {
    h.etat.erreurLecture = { code: '42P01', message: 'relation "signalements_qr_coproprietes" does not exist' }
    const res = await poster(CORPS)
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'base_absente' })
  })

  it('429 au-delà de la limite par adresse IP, puis par copropriété', async () => {
    h.etat.refuser = ['qr_adresse_127']
    expect((await poster(CORPS)).status).toBe(429)
    h.etat.refuser = ['qr_adresse_copro_']
    expect((await poster(CORPS)).status).toBe(429)
    expect(h.etat.limites).toContain(`qr_adresse_copro_${COPRO.id}`)
    expect(appelsBan).toHaveLength(0)
  })
})

describe('adresse proposée', () => {
  it('200 : seulement le libellé de l’adresse, jamais mis en cache ; service officiel appelé ; aucune écriture en base', async () => {
    const res = await poster(CORPS)
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    const corps = await res.json()
    expect(corps).toEqual({ adresse: '1 Quai du Port 13002 Marseille' })
    expect(JSON.stringify(corps)).not.toContain('43.29')
    expect(appelsBan).toHaveLength(1)
    expect(appelsBan[0].startsWith('https://data.geopf.fr/geocodage/reverse?')).toBe(true)
    expect(h.etat.ecritures).toEqual([])
    expect(journal()).not.toContain('43.29')
    expect(journal()).not.toContain('5.374')
  })

  it.each([
    ['service en panne (500)', () => json({}, 500)],
    ['trop de requêtes (429)', () => json({}, 429)],
    ['aucune adresse à cet endroit', () => json({ type: 'FeatureCollection', features: [] })],
    ['délai dépassé', () => Promise.reject(new DOMException('The operation was aborted', 'TimeoutError'))],
  ])('%s : 200 { adresse: null }, le signalement reste possible ; rien de la position au logger', async (_cas, reponse) => {
    simulerBan(reponse)
    const res = await poster(CORPS)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ adresse: null })
    expect(journal()).not.toContain('43.29')
    expect(journal()).not.toContain('5.374')
  })

  it('corps illisible : 400 sans rien journaliser du corps', async () => {
    const res = await POST(new NextRequest('https://vitfix.io/api/aj-signalement/adresse', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"latitude":43.29512,',
    }))
    expect(res.status).toBe(400)
    expect(journal()).not.toContain('43.29')
  })
})
