// tests/api/marches-acces.test.ts
//
// /api/marches — qui peut lire quoi (audit des fondations BTP du 11/11/2026).
// Ces routes lisent avec le client « service role » (sans RLS). Plusieurs modes rendent les données d'UN compte :
//   - GET /api/marches?publisher_user_id=… : ses offres AVEC leur clé de gestion (access_token) ;
//   - GET /api/marches?my_bids=true&artisan_id=… : ses candidatures (prix, délais, textes) ;
//   - GET /api/marches?artisan_user_id=… et /api/marches/sous-traitance?artisan_user_id=… : les marchés qui lui
//     sont proposés et leur distance à son adresse ;
//   - GET /api/marches/sous-traitance?btp_company_id=… : les offres d'une entreprise, tous statuts confondus ;
//   - GET /api/marches/[id]/evaluation : notes, commentaires et prix des candidatures évaluées.
// Ces modes exigent le jeton de la session (ou la clé de gestion, pour les évaluations) et ne répondent qu'au
// compte concerné.
// La liste publique et la fiche publique d'un marché restent ouvertes, réduites à une liste blanche de colonnes.
// Sur les routes voisines (candidatures, messages), une réponse propre à un compte n'est gardée par aucun cache.

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
    b.limit = () => b
    b.single = () => Promise.resolve(etat.repondre(appel))
    b.maybeSingle = () => Promise.resolve(etat.repondre(appel))
    b.then = (ok: (v: Reponse) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(etat.repondre(appel)).then(ok, ko)
    return b
  }
  return { appels, etat, from }
})

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn(), addBreadcrumb: vi.fn() }))
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/mocks-routes-api')).rateLimitPermissif())
vi.mock('@/lib/cache', () => ({ cacheable: vi.fn((_cle: string, lire: () => Promise<unknown>) => lire()) }))
vi.mock('@/lib/auth-helpers', () => ({ getAuthUser: vi.fn(async () => h.etat.user) }))
vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin: { from: (t: string) => h.from(t) } }))
// Journal d'erreurs observable (une panne de la base doit y laisser une trace) ; le reste du module est le vrai.
vi.mock('@/lib/logger', async importOriginal => {
  const reel = await importOriginal<typeof import('@/lib/logger')>()
  return { ...reel, logger: { ...reel.logger, error: vi.fn() } }
})

const { GET } = await import('@/app/api/marches/route')
const { GET: GET_FICHE } = await import('@/app/api/marches/[id]/route')
const { GET: GET_SOUS_TRAITANCE } = await import('@/app/api/marches/sous-traitance/route')
const { GET: GET_EVALUATIONS } = await import('@/app/api/marches/[id]/evaluation/route')
const { GET: GET_CANDIDATURES } = await import('@/app/api/marches/[id]/candidature/route')
const { GET: GET_MESSAGES } = await import('@/app/api/marches/[id]/messages/route')
const { getAuthUser } = await import('@/lib/auth-helpers')
const { logger } = await import('@/lib/logger')
const { cacheable } = await import('@/lib/cache')
const { COLONNES_PUBLIQUES_MARCHE } = await import('@/lib/marches-public')

const MOI = '11111111-1111-4111-8111-111111111111'
const AUTRE = '22222222-2222-4222-8222-222222222222'
const MA_FICHE = '33333333-3333-4333-8333-333333333333'
const FICHE_D_UN_AUTRE = '55555555-5555-4555-8555-555555555555'
const MARCHE = '44444444-4444-4444-8444-444444444444'
const PERSONNEL = 'private, no-store'

const lire = (requete: string) => GET(new NextRequest(`https://vitfix.io/api/marches?${requete}`))
const lireSousTraitance = (requete: string) => GET_SOUS_TRAITANCE(new NextRequest(`https://vitfix.io/api/marches/sous-traitance?${requete}`))
const appelsSur = (table: string) => h.appels.filter(a => a.table === table)
const filtre = (a: Appel, col: string) => a.filtres.find(([, c]) => c === col)?.[2]
const cache = (res: Response) => res.headers.get('Cache-Control')
/** La fiche MA_FICHE appartient à MOI ; toute autre fiche est introuvable pour le compte appelant. */
const fichesDeMoi = (appel: Appel, sinon: Reponse): Reponse =>
  appel.table === 'profiles_artisan'
    ? { data: filtre(appel, 'id') === MA_FICHE && filtre(appel, 'user_id') === MOI ? { id: MA_FICHE } : null, error: null }
    : sinon

beforeEach(() => {
  h.appels.length = 0
  h.etat.user = null
  h.etat.repondre = () => ({ data: [], error: null })
  vi.mocked(getAuthUser).mockClear()
  vi.mocked(cacheable).mockClear()
  vi.mocked(logger.error).mockClear()
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

  it('le compte lui-même : ses offres, clé de gestion comprise, jamais gardées par un cache', async () => {
    h.etat.user = { id: MOI }
    h.etat.repondre = () => ({ data: [{ id: MARCHE, title: 'Ravalement', access_token: 'cle-de-gestion' }], error: null })
    const res = await lire(`publisher_user_id=${MOI}`)
    expect(res.status).toBe(200)
    expect(cache(res)).toBe(PERSONNEL)
    expect((await res.json()).marches).toEqual([{ id: MARCHE, title: 'Ravalement', access_token: 'cle-de-gestion' }])
    const [appel] = appelsSur('marches')
    expect(filtre(appel, 'publisher_user_id')).toBe(MOI)
    // La clé de gestion est bien demandée à la base : c'est elle qui permet à l'écran d'ouvrir la gestion de l'offre.
    expect(appel.colonnes?.split(',').map(c => c.trim())).toContain('access_token')
    expect(h.appels).toHaveLength(1)
    expect(cacheable).not.toHaveBeenCalled()
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
    h.etat.repondre = appel => fichesDeMoi(appel, { data: [{ id: 'c1', price: 12000 }], error: null })
    const res = await lire(`my_bids=true&artisan_id=${MA_FICHE}`)
    expect(res.status).toBe(403)
    const [fiche] = appelsSur('profiles_artisan')
    // L'appartenance est demandée à la base : cette fiche, pour ce compte.
    expect([filtre(fiche, 'id'), filtre(fiche, 'user_id')]).toEqual([MA_FICHE, AUTRE])
    expect(appelsSur('marches_candidatures')).toHaveLength(0)
    // Un refus ordinaire n'est pas une erreur : rien au journal.
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('panne de la base pendant le contrôle de la fiche : refus, pas d’accord par défaut, et la panne est journalisée', async () => {
    h.etat.user = { id: MOI }
    h.etat.repondre = appel => (appel.table === 'profiles_artisan' ? { data: null, error: { message: 'timeout' } } : { data: [{ id: 'c1' }], error: null })
    const res = await lire(`my_bids=true&artisan_id=${MA_FICHE}`)
    expect(res.status).toBe(403)
    expect(appelsSur('marches_candidatures')).toHaveLength(0)
    // Le refus ne cache pas la panne : sans trace, elle passerait pour un simple « accès refusé ».
    expect(logger.error).toHaveBeenCalledTimes(1)
    expect(vi.mocked(logger.error).mock.calls[0][1]).toEqual({ error: 'timeout' })
  })

  it('le titulaire de la fiche : ses candidatures, jamais gardées par un cache', async () => {
    h.etat.user = { id: MOI }
    h.etat.repondre = appel => fichesDeMoi(appel, { data: [{ id: 'c1', price: 12000, marches: { id: MARCHE, title: 'Ravalement' } }], error: null })
    const res = await lire(`my_bids=true&artisan_id=${MA_FICHE}`)
    expect(res.status).toBe(200)
    expect(cache(res)).toBe(PERSONNEL)
    const { candidatures } = await res.json()
    expect(candidatures).toHaveLength(1)
    expect(candidatures[0]).toMatchObject({ id: 'c1', price: 12000, my_candidature_id: 'c1', marche: { id: MARCHE } })
    expect(filtre(appelsSur('marches_candidatures')[0], 'artisan_id')).toBe(MA_FICHE)
  })

  it('un identifiant à soi dans un autre paramètre n’ouvre pas les candidatures d’une autre entreprise', async () => {
    h.etat.user = { id: MOI }
    h.etat.repondre = appel => fichesDeMoi(appel, { data: [{ id: 'c1', price: 12000 }], error: null })
    for (const prefixe of [`publisher_user_id=${MOI}&`, `artisan_user_id=${MOI}&`]) {
      const res = await lire(`${prefixe}my_bids=true&artisan_id=${FICHE_D_UN_AUTRE}`)
      expect(res.status).toBe(403)
    }
    expect(appelsSur('marches_candidatures')).toHaveLength(0)
    expect(appelsSur('marches')).toHaveLength(0)
  })
})

describe('GET /api/marches?artisan_user_id — marchés proposés à un compte', () => {
  it('sans connexion : 401 ; pour un autre compte : 403 ; aucune lecture en base', async () => {
    expect((await lire(`artisan_user_id=${MOI}`)).status).toBe(401)
    h.etat.user = { id: AUTRE }
    expect((await lire(`artisan_user_id=${MOI}`)).status).toBe(403)
    expect(h.appels).toHaveLength(0)
  })

  it('le compte lui-même : la liste filtrée sur ses marchés, hors du cache partagé', async () => {
    h.etat.user = { id: MOI }
    h.etat.repondre = appel => (appel.table === 'marches' ? { data: [{ id: MARCHE, title: 'Ravalement' }], error: null } : { data: null, error: null })
    const res = await lire(`artisan_user_id=${MOI}`)
    expect(res.status).toBe(200)
    expect(cache(res)).toBe(PERSONNEL)
    expect(cacheable).not.toHaveBeenCalled()
    expect((await res.json()).marches).toEqual([{ id: MARCHE, title: 'Ravalement' }])
    expect(filtre(appelsSur('marches')[0], 'matched_artisans')).toEqual([MOI])
  })
})

describe('GET /api/marches — liste publique', () => {
  it('reste ouverte sans connexion, en cache partagé, et ne demande que la liste blanche de colonnes', async () => {
    h.etat.repondre = () => ({ data: [{ id: MARCHE, title: 'Ravalement' }], error: null })
    const res = await lire('pays=FR&marche_type=publics')
    expect(res.status).toBe(200)
    expect(cache(res)).toMatch(/^public/)
    expect(cacheable).toHaveBeenCalledTimes(1)
    expect((await res.json()).marches).toEqual([{ id: MARCHE, title: 'Ravalement' }])
    expect(getAuthUser).not.toHaveBeenCalled()
    const colonnes = (appelsSur('marches')[0].colonnes ?? '').split(',').map(c => c.trim())
    expect(colonnes).toEqual([...COLONNES_PUBLIQUES_MARCHE])
  })

  it('la liste blanche ne contient ni clé de gestion, ni coordonnées du publieur, ni identifiant de compte, ni adresse précise', () => {
    const interdites = [
      'access_token', 'publisher_email', 'publisher_phone', 'publisher_user_id', 'matched_artisans', 'btp_company_id',
      'location_address', 'immeuble_adresse', 'publisher_siret', 'unread_messages_count',
    ]
    for (const colonne of interdites) expect(COLONNES_PUBLIQUES_MARCHE).not.toContain(colonne)
    expect(COLONNES_PUBLIQUES_MARCHE).toContain('title')
  })
})

describe('GET /api/marches/[id] — fiche d’un marché', () => {
  const ligne = {
    id: MARCHE, title: 'Ravalement', location_city: 'Marseille', access_token: 'cle-de-gestion',
    publisher_email: 'publieur@example.test', publisher_phone: '0102030405', publisher_user_id: MOI,
    matched_artisans: [AUTRE], btp_company_id: MOI, location_address: '1 rue des Lilas', immeuble_adresse: '2 rue des Lilas',
    publisher_siret: '00000000000000', numero_sinistre: 'S-1', expert_referent: 'Expert', unread_messages_count: 3,
  }
  const fiche = (suffixe = '') =>
    GET_FICHE(new NextRequest(`https://vitfix.io/api/marches/${MARCHE}${suffixe}`), { params: Promise.resolve({ id: MARCHE }) })

  it('vue publique : seulement les colonnes de la liste blanche', async () => {
    h.etat.repondre = () => ({ data: ligne, error: null })
    for (const suffixe of ['', '?token=mauvaise-cle']) {
      const res = await fiche(suffixe)
      expect(res.status).toBe(200)
      expect(cache(res)).toMatch(/^public/)
      expect(await res.json()).toEqual({ marche: { id: MARCHE, title: 'Ravalement', location_city: 'Marseille' } })
    }
    expect(appelsSur('marches_candidatures')).toHaveLength(0)
  })

  it('avec la bonne clé de gestion : fiche complète et candidatures, jamais gardées par un cache', async () => {
    h.etat.repondre = appel => (appel.table === 'marches' ? { data: ligne, error: null } : { data: [{ id: 'c1', price: 12000 }], error: null })
    const res = await fiche('?token=cle-de-gestion')
    expect(res.status).toBe(200)
    expect(cache(res)).toBe(PERSONNEL)
    expect(await res.json()).toEqual({ marche: ligne, candidatures: [{ id: 'c1', price: 12000 }], is_publisher: true })
  })
})

describe('GET /api/marches/sous-traitance — offres de sous-traitance', () => {
  it('?btp_company_id sans connexion : 401, aucune lecture en base', async () => {
    const res = await lireSousTraitance(`btp_company_id=${MA_FICHE}`)
    expect(res.status).toBe(401)
    expect(h.appels).toHaveLength(0)
  })

  it('?btp_company_id connecté : seulement les offres publiées par le compte appelant', async () => {
    h.etat.user = { id: MOI }
    h.etat.repondre = () => ({ data: [{ id: MARCHE, title: 'Lot plâtrerie', status: 'closed' }], error: null })
    const res = await lireSousTraitance(`btp_company_id=${FICHE_D_UN_AUTRE}`)
    expect(res.status).toBe(200)
    expect(cache(res)).toBe(PERSONNEL)
    const [appel] = appelsSur('marches')
    // Passer la fiche d'une autre entreprise ne rend rien d'elle : la base filtre sur le compte du jeton.
    expect([filtre(appel, 'btp_company_id'), filtre(appel, 'publisher_user_id')]).toEqual([FICHE_D_UN_AUTRE, MOI])
  })

  it('?artisan_user_id : 401 sans connexion, 403 pour un autre compte, aucune lecture en base', async () => {
    expect((await lireSousTraitance(`artisan_user_id=${MOI}`)).status).toBe(401)
    h.etat.user = { id: AUTRE }
    expect((await lireSousTraitance(`artisan_user_id=${MOI}`)).status).toBe(403)
    expect(h.appels).toHaveLength(0)
  })

  it('?artisan_user_id pour soi : offres ouvertes avec ses distances, hors cache partagé', async () => {
    h.etat.user = { id: MOI }
    h.etat.repondre = appel => (appel.table === 'marches'
      ? { data: [{ id: MARCHE, location_lat: 43.3, location_lng: 5.4 }], error: null }
      : { data: { latitude: 43.3, longitude: 5.4 }, error: null })
    const res = await lireSousTraitance(`artisan_user_id=${MOI}`)
    expect(res.status).toBe(200)
    expect(cache(res)).toBe(PERSONNEL)
    expect((await res.json()).offers).toEqual([{ id: MARCHE, location_lat: 43.3, location_lng: 5.4, distance_km: 0 }])
    expect(filtre(appelsSur('profiles_artisan')[0], 'user_id')).toBe(MOI)
  })

  it('parcours des offres ouvertes : reste public, sans jeton, sans donnée de compte', async () => {
    h.etat.repondre = () => ({ data: [{ id: MARCHE, title: 'Lot plâtrerie' }], error: null })
    const res = await lireSousTraitance('mode=browse')
    expect(res.status).toBe(200)
    expect(cache(res)).toMatch(/^public/)
    expect(getAuthUser).not.toHaveBeenCalled()
    expect(appelsSur('profiles_artisan')).toHaveLength(0)
  })
})

describe('GET /api/marches/[id]/evaluation — évaluations d’un marché', () => {
  const evaluations = (suffixe = '') =>
    GET_EVALUATIONS(new NextRequest(`https://vitfix.io/api/marches/${MARCHE}/evaluation${suffixe}`), { params: Promise.resolve({ id: MARCHE }) })
  const base = (appel: Appel): Reponse => {
    if (appel.table === 'marches') return { data: { access_token: 'cle-de-gestion' }, error: null }
    if (appel.table === 'marches_candidatures') return { data: h.etat.user?.id === MOI ? [{ id: 'c1' }] : [], error: null }
    return { data: [{ id: 'e1', note_globale: 5, candidature_id: 'c1' }], error: null }
  }

  it('sans clé ni connexion : 401 ; mauvaise clé : 403 ; les évaluations ne sont pas lues', async () => {
    h.etat.repondre = base
    expect((await evaluations()).status).toBe(401)
    expect((await evaluations('?token=mauvaise-cle')).status).toBe(403)
    expect(appelsSur('marches_evaluations')).toHaveLength(0)
  })

  it('publieur (bonne clé de gestion) : toutes les évaluations du marché', async () => {
    h.etat.repondre = base
    const res = await evaluations('?token=cle-de-gestion')
    expect(res.status).toBe(200)
    expect(cache(res)).toBe(PERSONNEL)
    expect((await res.json()).evaluations).toEqual([{ id: 'e1', note_globale: 5, candidature_id: 'c1' }])
    expect(filtre(appelsSur('marches_evaluations')[0], 'candidature_id')).toBeUndefined()
  })

  it('entreprise connectée : seulement les évaluations de ses propres candidatures', async () => {
    h.etat.user = { id: MOI }
    h.etat.repondre = base
    const res = await evaluations()
    expect(res.status).toBe(200)
    expect((await res.json()).evaluations).toHaveLength(1)
    expect(filtre(appelsSur('marches_candidatures')[0], 'artisan_user_id')).toBe(MOI)
    expect(filtre(appelsSur('marches_evaluations')[0], 'candidature_id')).toEqual(['c1'])
  })

  it('compte connecté sans candidature sur ce marché : liste vide, les évaluations ne sont pas lues', async () => {
    h.etat.user = { id: AUTRE }
    h.etat.repondre = base
    const res = await evaluations()
    expect(res.status).toBe(200)
    expect((await res.json()).evaluations).toEqual([])
    expect(appelsSur('marches_evaluations')).toHaveLength(0)
  })

  it('clé présentée pour un marché introuvable : refus, les évaluations ne sont pas lues', async () => {
    h.etat.repondre = appel => (appel.table === 'marches' ? { data: null, error: null } : base(appel))
    expect((await evaluations('?token=cle-de-gestion')).status).toBe(403)
    expect(appelsSur('marches_evaluations')).toHaveLength(0)
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('panne de la base pendant le contrôle de la clé : refus, pas d’accord par défaut, et la panne est journalisée', async () => {
    h.etat.repondre = appel => (appel.table === 'marches' ? { data: null, error: { message: 'timeout' } } : base(appel))
    expect((await evaluations('?token=cle-de-gestion')).status).toBe(403)
    expect(appelsSur('marches_evaluations')).toHaveLength(0)
    expect(logger.error).toHaveBeenCalledTimes(1)
    expect(vi.mocked(logger.error).mock.calls[0][1]).toEqual({ error: 'timeout', marcheId: MARCHE })
  })

  it('panne de la base pendant la lecture des candidatures de l’appelant : erreur dite et journalisée, pas une liste vide', async () => {
    h.etat.user = { id: MOI }
    h.etat.repondre = appel => (appel.table === 'marches_candidatures' ? { data: null, error: { message: 'timeout' } } : base(appel))
    const res = await evaluations()
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Une erreur interne est survenue' })
    expect(logger.error).toHaveBeenCalledTimes(1)
    expect(vi.mocked(logger.error).mock.calls[0][1]).toEqual({ error: 'timeout', marcheId: MARCHE })
    expect(appelsSur('marches_evaluations')).toHaveLength(0)
  })
})

describe('Routes voisines — une réponse propre à un compte n’est gardée par aucun cache', () => {
  const contexte = () => ({ params: Promise.resolve({ id: MARCHE }) })
  const candidatures = (suffixe = '') =>
    GET_CANDIDATURES(new NextRequest(`https://vitfix.io/api/marches/${MARCHE}/candidature${suffixe}`), contexte())
  const messages = (suffixe = '') =>
    GET_MESSAGES(new NextRequest(`https://vitfix.io/api/marches/${MARCHE}/messages${suffixe}`), contexte())
  /** MOI tient la fiche MA_FICHE, a publié MARCHE (clé « cle-de-gestion ») et y porte la candidature c1. */
  const base = (appel: Appel): Reponse => {
    if (appel.table === 'profiles_artisan') return { data: { id: MA_FICHE, company_name: 'Bâtiment du Banc SARL' }, error: null }
    if (appel.table === 'marches') return { data: { id: MARCHE, access_token: 'cle-de-gestion', publisher_user_id: MOI }, error: null }
    if (appel.table === 'marches_candidatures') return { data: [{ id: 'c1', artisan_id: MA_FICHE, price: 12000 }], error: null }
    return { data: [{ id: 'm1', candidature_id: 'c1', content: 'Bonjour' }], error: null }
  }

  it('GET /api/marches/[id]/candidature : mes candidatures, la vue du publieur et ma candidature sur ce marché', async () => {
    h.etat.user = { id: MOI }
    h.etat.repondre = base
    for (const suffixe of ['?my=true', '?token=cle-de-gestion', '']) {
      const res = await candidatures(suffixe)
      expect(res.status, suffixe).toBe(200)
      expect(cache(res), suffixe).toBe(PERSONNEL)
      expect((await res.json()).candidatures, suffixe).toHaveLength(1)
    }
  })

  it('GET /api/marches/[id]/messages : fil du publieur (clé de gestion)', async () => {
    h.etat.repondre = base
    const res = await messages('?token=cle-de-gestion')
    expect(res.status).toBe(200)
    expect(cache(res)).toBe(PERSONNEL)
    expect((await res.json()).messages).toHaveLength(1)
  })

  it('GET /api/marches/[id]/messages : fil de l’entreprise connectée, avec ou sans candidature sur ce marché', async () => {
    h.etat.user = { id: MOI }
    h.etat.repondre = base
    const avec = await messages()
    expect(avec.status).toBe(200)
    expect(cache(avec)).toBe(PERSONNEL)
    expect((await avec.json()).messages).toHaveLength(1)

    h.etat.repondre = appel => (appel.table === 'marches_candidatures' ? { data: [], error: null } : base(appel))
    const sans = await messages()
    expect(sans.status).toBe(200)
    expect(cache(sans)).toBe(PERSONNEL)
    expect((await sans.json()).messages).toEqual([])
  })

  it('GET /api/marches/sous-traitance?offer_id : candidatures reçues sur une offre de la société', async () => {
    h.etat.user = { id: MOI }
    h.etat.repondre = base
    const res = await lireSousTraitance(`btp_company_id=${MA_FICHE}&offer_id=${MARCHE}`)
    expect(res.status).toBe(200)
    expect(cache(res)).toBe(PERSONNEL)
    expect((await res.json()).candidatures).toHaveLength(1)
  })
})
