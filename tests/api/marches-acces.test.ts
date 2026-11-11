// tests/api/marches-acces.test.ts
//
// /api/marches — qui peut lire quoi (audit des fondations BTP du 11/11/2026).
// La route lit avec le client « service role » (sans RLS). Trois modes rendent les données d'UN compte :
//   - ?publisher_user_id=… : ses offres AVEC leur clé de gestion (access_token) ;
//   - ?my_bids=true&artisan_id=… : ses candidatures (prix, délais, textes) ;
//   - ?artisan_user_id=… : les marchés qui lui sont proposés et leur distance à son adresse.
// Ces modes exigent le jeton de la session et ne répondent qu'au compte concerné.
// La liste publique et la fiche publique d'un marché, elles, restent ouvertes mais ne rendent aucun
// identifiant de compte.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

type Filtre = [string, string, unknown]
type Appel = { table: string; colonnes?: string; filtres: Filtre[] }
type Reponse = { data: unknown; error: unknown }

const h = vi.hoisted(() => {
  const appels: Appel[] = []
  const etat = {
    user: null as null | { id: string },
    repondre: (_a: Appel): Reponse => ({ data: [], error: null }),
  }
  const from = (table: string) => {
    const appel: Appel = { table, filtres: [] }
    appels.push(appel)
    const b: Record<string, unknown> = {}
    b.select = (cols?: string) => { appel.colonnes = cols; return b }
    for (const m of ['eq', 'gte', 'lte', 'in', 'ilike', 'or', 'is', 'contains', 'not']) {
      b[m] = (col: string, val: unknown) => { appel.filtres.push([m, col, val]); return b }
    }
    b.order = () => b
    b.range = () => b
    b.single = () => Promise.resolve(etat.repondre(appel))
    b.maybeSingle = () => Promise.resolve(etat.repondre(appel))
    b.then = (ok: (v: Reponse) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(etat.repondre(appel)).then(ok, ko)
    return b
  }
  return { appels, etat, from }
})

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn(), addBreadcrumb: vi.fn() }))
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/mocks-routes-api')).rateLimitPermissif())
vi.mock('@/lib/cache', () => ({ cacheable: (_cle: string, lire: () => Promise<unknown>) => lire() }))
vi.mock('@/lib/auth-helpers', () => ({ getAuthUser: vi.fn(async () => h.etat.user) }))
vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin: { from: (t: string) => h.from(t) } }))

const { GET } = await import('@/app/api/marches/route')
const { GET: GET_FICHE } = await import('@/app/api/marches/[id]/route')
const { getAuthUser } = await import('@/lib/auth-helpers')

const MOI = '11111111-1111-4111-8111-111111111111'
const AUTRE = '22222222-2222-4222-8222-222222222222'
const MA_FICHE = '33333333-3333-4333-8333-333333333333'
const MARCHE = '44444444-4444-4444-8444-444444444444'

const lire = (requete: string) => GET(new NextRequest(`https://vitfix.io/api/marches?${requete}`))
const appelsSur = (table: string) => h.appels.filter(a => a.table === table)
const filtre = (a: Appel, col: string) => a.filtres.find(([, c]) => c === col)?.[2]

beforeEach(() => {
  h.appels.length = 0
  h.etat.user = null
  h.etat.repondre = () => ({ data: [], error: null })
  vi.mocked(getAuthUser).mockClear()
})

describe('GET /api/marches?publisher_user_id — offres d’un compte, avec leurs clés de gestion', () => {
  it('sans connexion : 401, aucune lecture en base', async () => {
    const res = await lire(`publisher_user_id=${MOI}`)
    expect(res.status).toBe(401)
    expect(h.appels).toHaveLength(0)
  })

  it('connecté sous un autre compte : 403, aucune lecture en base', async () => {
    h.etat.user = { id: AUTRE }
    const res = await lire(`publisher_user_id=${MOI}`)
    expect(res.status).toBe(403)
    expect(h.appels).toHaveLength(0)
  })

  it('le compte lui-même : ses offres, clé de gestion comprise', async () => {
    h.etat.user = { id: MOI }
    h.etat.repondre = () => ({ data: [{ id: MARCHE, title: 'Ravalement', access_token: 'cle-de-gestion' }], error: null })
    const res = await lire(`publisher_user_id=${MOI}`)
    expect(res.status).toBe(200)
    expect((await res.json()).marches).toEqual([{ id: MARCHE, title: 'Ravalement', access_token: 'cle-de-gestion' }])
    const [appel] = appelsSur('marches')
    expect(filtre(appel, 'publisher_user_id')).toBe(MOI)
    expect(h.appels).toHaveLength(1)
  })
})

describe('GET /api/marches?my_bids=true&artisan_id — candidatures d’une entreprise', () => {
  it('sans connexion : 401, aucune lecture en base', async () => {
    const res = await lire(`my_bids=true&artisan_id=${MA_FICHE}`)
    expect(res.status).toBe(401)
    expect(h.appels).toHaveLength(0)
  })

  it('fiche d’une autre entreprise : 403, les candidatures ne sont pas lues', async () => {
    h.etat.user = { id: AUTRE }
    h.etat.repondre = appel => ({ data: appel.table === 'profiles_artisan' ? null : [{ id: 'c1', price: 12000 }], error: null })
    const res = await lire(`my_bids=true&artisan_id=${MA_FICHE}`)
    expect(res.status).toBe(403)
    const [fiche] = appelsSur('profiles_artisan')
    // L'appartenance est demandée à la base : cette fiche, pour ce compte.
    expect([filtre(fiche, 'id'), filtre(fiche, 'user_id')]).toEqual([MA_FICHE, AUTRE])
    expect(appelsSur('marches_candidatures')).toHaveLength(0)
  })

  it('le titulaire de la fiche : ses candidatures', async () => {
    h.etat.user = { id: MOI }
    h.etat.repondre = appel => (appel.table === 'profiles_artisan'
      ? { data: { id: MA_FICHE }, error: null }
      : { data: [{ id: 'c1', price: 12000, marches: { id: MARCHE, title: 'Ravalement' } }], error: null })
    const res = await lire(`my_bids=true&artisan_id=${MA_FICHE}`)
    expect(res.status).toBe(200)
    const { candidatures } = await res.json()
    expect(candidatures).toHaveLength(1)
    expect(candidatures[0]).toMatchObject({ id: 'c1', price: 12000, my_candidature_id: 'c1', marche: { id: MARCHE } })
    expect(filtre(appelsSur('marches_candidatures')[0], 'artisan_id')).toBe(MA_FICHE)
  })
})

describe('GET /api/marches?artisan_user_id — marchés proposés à un compte', () => {
  it('sans connexion : 401 ; pour un autre compte : 403 ; aucune lecture en base', async () => {
    expect((await lire(`artisan_user_id=${MOI}`)).status).toBe(401)
    h.etat.user = { id: AUTRE }
    expect((await lire(`artisan_user_id=${MOI}`)).status).toBe(403)
    expect(h.appels).toHaveLength(0)
  })

  it('le compte lui-même : la liste filtrée sur ses marchés', async () => {
    h.etat.user = { id: MOI }
    h.etat.repondre = appel => (appel.table === 'marches' ? { data: [{ id: MARCHE, title: 'Ravalement' }], error: null } : { data: null, error: null })
    const res = await lire(`artisan_user_id=${MOI}`)
    expect(res.status).toBe(200)
    expect((await res.json()).marches).toEqual([{ id: MARCHE, title: 'Ravalement' }])
    expect(filtre(appelsSur('marches')[0], 'matched_artisans')).toEqual([MOI])
  })
})

describe('GET /api/marches — liste publique', () => {
  it('reste ouverte sans connexion, et ne demande ni clé de gestion ni identifiant de compte à la base', async () => {
    h.etat.repondre = () => ({ data: [{ id: MARCHE, title: 'Ravalement' }], error: null })
    const res = await lire('pays=FR&marche_type=publics')
    expect(res.status).toBe(200)
    expect((await res.json()).marches).toEqual([{ id: MARCHE, title: 'Ravalement' }])
    expect(getAuthUser).not.toHaveBeenCalled()
    const colonnes = (appelsSur('marches')[0].colonnes ?? '').split(',').map(c => c.trim())
    expect(colonnes).toContain('title')
    for (const interdite of ['access_token', 'matched_artisans', 'publisher_user_id', 'publisher_email', 'publisher_phone']) {
      expect(colonnes).not.toContain(interdite)
    }
  })
})

describe('GET /api/marches/[id] — fiche d’un marché', () => {
  const ligne = {
    id: MARCHE, title: 'Ravalement', access_token: 'cle-de-gestion', publisher_email: 'publieur@example.test',
    publisher_phone: '0102030405', publisher_user_id: MOI, matched_artisans: [AUTRE],
  }
  const fiche = (suffixe = '') =>
    GET_FICHE(new NextRequest(`https://vitfix.io/api/marches/${MARCHE}${suffixe}`), { params: Promise.resolve({ id: MARCHE }) })

  it('vue publique : ni clé de gestion, ni coordonnées du publieur, ni identifiants de compte', async () => {
    h.etat.repondre = () => ({ data: ligne, error: null })
    for (const suffixe of ['', '?token=mauvaise-cle']) {
      const res = await fiche(suffixe)
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ marche: { id: MARCHE, title: 'Ravalement' } })
    }
    expect(appelsSur('marches_candidatures')).toHaveLength(0)
  })

  it('avec la bonne clé de gestion : fiche complète et candidatures', async () => {
    h.etat.repondre = appel => (appel.table === 'marches' ? { data: ligne, error: null } : { data: [{ id: 'c1', price: 12000 }], error: null })
    const res = await fiche('?token=cle-de-gestion')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ marche: ligne, candidatures: [{ id: 'c1', price: 12000 }], is_publisher: true })
  })
})
