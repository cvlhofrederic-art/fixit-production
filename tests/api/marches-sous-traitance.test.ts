// tests/api/marches-sous-traitance.test.ts
//
// /api/marches/sous-traitance — offres de sous-traitance des sociétés BTP (« Recruter sous-traitants »).
// Audit des fondations BTP du 11/11/2026.
//   - GET ?btp_company_id=…&offer_id=… (« voir les candidats » d'une offre) : la lecture demandait trois colonnes
//     absentes de marches_candidatures (disponibilites, experience_years, artisan_phone) et échouait toujours ;
//     l'écran affichait une liste de candidats vide.
//   - POST (publier une offre, constat api-peripherie-4) : l'identifiant et le nom de la société venaient du corps de
//     la requête, sans contrôle de rôle. L'offre est désormais publiée au nom de la fiche société du compte connecté,
//     relue en base, et réservée aux sociétés BTP.
// Relecture adverse du 16/11/2026 :
//   - la fiche de chaque candidat était lue avec trois colonnes absentes de profiles_artisan (photo_url, city,
//     services_offered) : photo, ville et pastilles d'assurance ne s'affichaient jamais ;
//   - un sous-compte (conducteur de travaux), qui n'a pas de fiche à lui, envoie comme identifiant de société celui de
//     son propre compte (le tableau de bord l'identifie ainsi) : il était refusé ;
//   - une panne de la lecture de la fiche répondait « Cette fiche société n'est pas celle de votre compte ».
// Le faux client ne connaît que les tables et colonnes réelles de la production (tests/helpers/faux-supabase-marches),
// profiles_artisan comprise.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { Appel, FauxSupabase, Reponse } from '../helpers/faux-supabase-marches'

const h = vi.hoisted(() => ({
  base: null as null | FauxSupabase,
  user: null as null | { id: string; app_metadata?: Record<string, unknown> },
}))

vi.mock('@/lib/supabase-server', async () => {
  const { creerFauxSupabase } = await import('../helpers/faux-supabase-marches')
  h.base = creerFauxSupabase()
  return { supabaseAdmin: h.base.client }
})
// Seule la lecture du jeton est simulée ; les contrôles de rôle et de société sont les vrais.
vi.mock('@/lib/auth-helpers', async importOriginal => {
  const reel = await importOriginal<typeof import('@/lib/auth-helpers')>()
  return { ...reel, getAuthUser: vi.fn(async () => h.user) }
})
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/mocks-routes-api')).rateLimitPermissif())
vi.mock('@/lib/logger', async () => (await import('../helpers/mocks-routes-api')).loggerSilencieux())

const { GET, POST } = await import('@/app/api/marches/sous-traitance/route')
const { logger } = await import('@/lib/logger')

const SOCIETE = '11111111-1111-4111-8111-111111111111'
const FICHE_SOCIETE = '33333333-3333-4333-8333-333333333333'
const COMPTE_CANDIDAT = '22222222-2222-4222-8222-222222222222'
const FICHE_CANDIDAT = '55555555-5555-4555-8555-555555555555'
const OFFRE = '44444444-4444-4444-8444-444444444444'
// Conducteur de travaux de la société SOCIETE : un compte sans fiche à lui.
const SOUS_COMPTE = '66666666-6666-4666-8666-666666666666'

const base = () => h.base as FauxSupabase

/** Fiche du candidat telle que la rend la base, sous les noms demandés par la route. */
const FICHE_DU_CANDIDAT = {
  company_name: 'Plâtrerie du Port', rating_avg: 4.6, photo_url: 'https://projet.supabase.co/storage/v1/object/public/photo.jpg',
  city: 'Marseille', rc_pro_valid: true, decennale_valid: true, qualibat_valid: false,
}

const enBase = (surcharge: (appel: Appel) => Reponse | undefined = () => undefined) => (appel: Appel): Reponse => {
  const special = surcharge(appel)
  if (special) return special
  if (appel.table === 'marches') return { data: { id: OFFRE, publisher_user_id: SOCIETE }, error: null }
  if (appel.table === 'marches_candidatures') {
    return {
      data: [{
        id: 'c1', artisan_id: FICHE_CANDIDAT, artisan_user_id: COMPTE_CANDIDAT, price: 8000, timeline: '2_semaines',
        description: 'Équipe de deux plaquistes.', artisan_company_name: 'Plâtrerie du Port', artisan_rating: null,
        materials_included: false, guarantee: null, status: 'pending', created_at: '2026-11-16T09:00:00Z',
      }],
      error: null,
    }
  }
  if (appel.table === 'profiles_artisan') return { data: FICHE_DU_CANDIDAT, error: null }
  return { data: null, error: null }
}

beforeEach(() => {
  base().vider()
  base().repondre = enBase()
  h.user = { id: SOCIETE, app_metadata: { role: 'pro_societe' } }
  vi.mocked(logger.error).mockClear()
})

describe('GET /api/marches/sous-traitance?offer_id — voir les candidats d’une offre', () => {
  const voirLesCandidats = () => GET(new NextRequest(`https://vitfix.io/api/marches/sous-traitance?btp_company_id=${FICHE_SOCIETE}&offer_id=${OFFRE}`))

  it('la société qui a publié l’offre voit ses candidats, avec photo, ville et pastilles de leur fiche (colonnes réelles)', async () => {
    const res = await voirLesCandidats()
    expect(res.status).toBe(200)
    const { candidatures } = await res.json()
    expect(candidatures).toEqual([
      expect.objectContaining({ id: 'c1', artisan_company_name: 'Plâtrerie du Port', profile: FICHE_DU_CANDIDAT }),
    ])
    const [lecture] = base().sur('marches_candidatures', 'select')
    expect(lecture.filtres).toContainEqual(['eq', 'marche_id', OFFRE])
    // La fiche du candidat est lue par son identifiant, sans aucune erreur.
    expect(base().sur('profiles_artisan', 'select')[0].filtres).toContainEqual(['eq', 'id', FICHE_CANDIDAT])
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('fiche du candidat illisible : le candidat reste listé, sans fiche, et l’échec est journalisé', async () => {
    base().repondre = enBase(appel => (appel.table === 'profiles_artisan' ? { data: null, error: { message: 'délai dépassé' } } : undefined))
    const res = await voirLesCandidats()
    expect(res.status).toBe(200)
    expect((await res.json()).candidatures).toEqual([expect.objectContaining({ id: 'c1', profile: null })])
    expect(logger.error).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls[0])).toContain('délai dépassé')
  })

  it('une autre société : 403, les candidats ne sont pas lus', async () => {
    h.user = { id: COMPTE_CANDIDAT, app_metadata: { role: 'pro_societe' } }
    const res = await voirLesCandidats()
    expect(res.status).toBe(403)
    expect(base().sur('marches_candidatures')).toHaveLength(0)
  })
})

describe('POST /api/marches/sous-traitance — publier une offre', () => {
  const FICHE_D_UNE_AUTRE = '77777777-7777-4777-8777-777777777777'
  const OFFRE_PUBLIEE = {
    btp_company_id: FICHE_SOCIETE, btp_company_name: 'Nom choisi par le navigateur', publisher_user_id: SOCIETE,
    publisher_name: 'Nom choisi par le navigateur', publisher_email: 'contact@exemple.fr',
    title: 'Lot plâtrerie, immeuble de 12 logements', description: 'Cloisons et doublages, trois semaines de travaux.',
    category: 'pintura', mission_type: 'sous_traitance_complete', location_city: 'Marseille', location_postal: '13001',
    deadline: '2099-12-31', urgency: 'normal',
  }
  /**
   * Corps que construit l'écran « Recruter sous-traitants » pour un sous-compte : sans fiche à lui, le tableau de bord
   * l'identifie par son propre compte (artisan.id = user.id), et le nom affiché est celui de son compte.
   */
  const OFFRE_DU_SOUS_COMPTE = {
    ...OFFRE_PUBLIEE, btp_company_id: SOUS_COMPTE, btp_company_name: 'Conducteur de travaux', publisher_user_id: SOUS_COMPTE,
    publisher_name: 'Conducteur de travaux', publisher_email: 'conducteur@exemple.fr',
    require_rc_pro: false, require_decennale: false, require_qualibat: false, photos: [],
  }
  const publier = (corps: Record<string, unknown> = OFFRE_PUBLIEE) => POST(new NextRequest('https://vitfix.io/api/marches/sous-traitance', {
    method: 'POST', body: JSON.stringify(corps), headers: { 'Content-Type': 'application/json' },
  }))
  /** Le compte SOCIETE possède la fiche FICHE_SOCIETE ; SOUS_COMPTE est membre actif de son équipe. */
  const fiches = (appel: Appel): Reponse | undefined => {
    if (appel.table === 'profiles_artisan') {
      const valeur = (colonne: string) => appel.filtres.find(([, c]) => c === colonne)?.[2]
      const id = valeur('id')
      const trouvee = valeur('user_id') === SOCIETE && (id === undefined || id === FICHE_SOCIETE)
      return { data: trouvee ? { id: FICHE_SOCIETE, company_name: 'Bâtiment du Banc SARL' } : null, error: null }
    }
    if (appel.table === 'marches' && appel.operation === 'insert') return { data: { id: OFFRE, ...(appel.donnees as object) }, error: null }
    if (appel.table === 'pro_team_members') {
      const membre = appel.filtres.find(([, c]) => c === 'user_id')?.[2]
      return { data: membre === SOUS_COMPTE ? { company_id: SOCIETE } : null, error: null }
    }
    return undefined
  }

  beforeEach(() => {
    base().repondre = enBase(fiches)
    // Géolocalisation de l'offre (service externe) : sans réponse, la route publie sans prévenir personne.
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })))
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('l’offre est publiée au nom de la fiche société du compte connecté, relue en base', async () => {
    const res = await publier()
    expect(res.status).toBe(201)
    const [insertion] = base().sur('marches', 'insert')
    expect(insertion.donnees).toMatchObject({
      btp_company_id: FICHE_SOCIETE, btp_company_name: 'Bâtiment du Banc SARL', publisher_name: 'Bâtiment du Banc SARL',
      publisher_user_id: SOCIETE, source_type: 'btp_sous_traitance',
    })
  })

  it('la fiche d’une autre société : 403, rien n’est publié', async () => {
    const res = await publier({ ...OFFRE_PUBLIEE, btp_company_id: FICHE_D_UNE_AUTRE })
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('Cette fiche société n\'est pas celle de votre compte')
    expect(base().sur('marches', 'insert')).toHaveLength(0)
  })

  it('un compte qui n’est pas une société BTP : 403, rien n’est publié', async () => {
    for (const role of ['client', 'artisan', 'syndic']) {
      h.user = { id: SOCIETE, app_metadata: { role } }
      expect((await publier()).status, role).toBe(403)
    }
    expect(base().sur('marches', 'insert')).toHaveLength(0)
  })

  it('un sous-compte (conducteur de travaux) publie avec le corps réel de son écran, au nom de sa société', async () => {
    h.user = { id: SOUS_COMPTE, app_metadata: { role: 'pro_societe', pro_team_role: 'CONDUCTEUR_TRAVAUX', company_id: SOCIETE } }
    const res = await publier(OFFRE_DU_SOUS_COMPTE)
    expect(res.status).toBe(201)
    // Le nom est celui de la fiche de sa société, relue en base ; l'identifiant reste celui par lequel son écran
    // retrouve ses offres.
    expect(base().sur('marches', 'insert')[0].donnees).toMatchObject({
      btp_company_id: SOUS_COMPTE, btp_company_name: 'Bâtiment du Banc SARL', publisher_name: 'Bâtiment du Banc SARL',
      publisher_user_id: SOUS_COMPTE,
    })
    // « Mes offres » du sous-compte : lue par ce même identifiant et par son compte, elle retrouve l'offre publiée.
    base().vider()
    base().repondre = enBase(fiches)
    expect((await GET(new NextRequest(`https://vitfix.io/api/marches/sous-traitance?btp_company_id=${SOUS_COMPTE}`))).status).toBe(200)
    expect(base().sur('marches', 'select')[0].filtres).toEqual(expect.arrayContaining([
      ['eq', 'btp_company_id', SOUS_COMPTE], ['eq', 'publisher_user_id', SOUS_COMPTE],
    ]))
  })

  it('un sous-compte ne publie pas au nom d’une autre société : 403, rien n’est publié', async () => {
    h.user = { id: SOUS_COMPTE, app_metadata: { role: 'pro_societe', pro_team_role: 'CONDUCTEUR_TRAVAUX', company_id: SOCIETE } }
    const res = await publier({ ...OFFRE_DU_SOUS_COMPTE, btp_company_id: FICHE_D_UNE_AUTRE })
    expect(res.status).toBe(403)
    expect(base().sur('marches', 'insert')).toHaveLength(0)
  })

  it('lecture de la fiche impossible (panne) : 500 et message d’erreur interne, pas un refus ; rien n’est publié', async () => {
    base().repondre = enBase(appel => (appel.table === 'profiles_artisan' ? { data: null, error: { message: 'délai dépassé' } } : fiches(appel)))
    const res = await publier()
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('Une erreur interne est survenue')
    expect(base().sur('marches', 'insert')).toHaveLength(0)
    expect(logger.error).toHaveBeenCalledTimes(1)
  })

  it('sans connexion : 401 ; publieur différent du compte connecté : 403 (inchangés)', async () => {
    h.user = null
    expect((await publier()).status).toBe(401)
    h.user = { id: SOCIETE, app_metadata: { role: 'pro_societe' } }
    expect((await publier({ ...OFFRE_PUBLIEE, publisher_user_id: COMPTE_CANDIDAT })).status).toBe(403)
    expect(base().sur('marches', 'insert')).toHaveLength(0)
  })
})
