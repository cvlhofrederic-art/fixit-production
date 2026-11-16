// tests/api/marches-candidater.test.ts
//
// POST /api/marches/[id]/candidature — une entreprise candidate à un marché de la Bourse.
// Audit des fondations BTP du 11/11/2026 : une fois le jeton envoyé par l'écran, la candidature échouait encore en
// production, parce que la route écrivait deux colonnes absentes de la table (artisan_name, artisan_city ; le nom
// de l'entreprise va dans artisan_company_name) et refusait une garantie laissée vide (l'écran envoie null).
// Le compteur de candidatures du marché, qui borne max_candidatures, ne bougeait jamais : la fonction appelée
// n'existe dans aucune migration et son échec, rendu dans { error }, ne déclenchait pas la mise à jour de secours.
// Relecture adverse du 16/11/2026 : la lecture de la fiche du candidat, qui précède l'enregistrement, demandait aussi une
// colonne absente de profiles_artisan (city) ; la route répondait « Profil artisan non trouvé » à toute candidature.
// Le faux client ne connaît que les tables et colonnes réelles de la production (tests/helpers/faux-supabase-marches),
// profiles_artisan comprise.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { Appel, FauxSupabase, Reponse } from '../helpers/faux-supabase-marches'

const h = vi.hoisted(() => ({ base: null as null | FauxSupabase, user: null as null | { id: string } }))

vi.mock('@/lib/supabase-server', async () => {
  const { creerFauxSupabase } = await import('../helpers/faux-supabase-marches')
  h.base = creerFauxSupabase()
  return { supabaseAdmin: h.base.client }
})
vi.mock('@/lib/auth-helpers', () => ({ getAuthUser: vi.fn(async () => h.user) }))
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/mocks-routes-api')).rateLimitPermissif())
// Journal observable ; le reste du module (parsePagination…) est le vrai.
vi.mock('@/lib/logger', async importOriginal => {
  const reel = await importOriginal<typeof import('@/lib/logger')>()
  return { ...reel, logger: { ...reel.logger, error: vi.fn(), warn: vi.fn(), info: vi.fn() } }
})

const { POST } = await import('@/app/api/marches/[id]/candidature/route')
const { logger } = await import('@/lib/logger')

const COMPTE = '11111111-1111-4111-8111-111111111111'
const FICHE = '33333333-3333-4333-8333-333333333333'
const MARCHE = '44444444-4444-4444-8444-444444444444'

const base = () => h.base as FauxSupabase
const FONCTION_ABSENTE: Reponse = {
  data: null,
  error: { code: 'PGRST202', message: 'Could not find the function public.increment_counter in the schema cache' },
}

/** Un marché ouvert (1 candidature sur 3), la fiche de l'entreprise (abonnée), aucune candidature antérieure. */
const enBase = (surcharge: (appel: Appel) => Reponse | undefined = () => undefined) => (appel: Appel): Reponse => {
  const special = surcharge(appel)
  if (special) return special
  if (appel.table === 'marches' && appel.operation === 'select') {
    return {
      data: {
        id: MARCHE, status: 'open', deadline: '2099-12-31', candidatures_count: 1, max_candidatures: 3,
        require_rc_pro: false, require_decennale: false, require_rge: false, require_qualibat: false,
      },
      error: null,
    }
  }
  if (appel.table === 'profiles_artisan') {
    return {
      data: {
        id: FICHE, subscription_tier: 'artisan_pro', company_name: 'Bâtiment du Banc SARL',
        rc_pro_valid: true, decennale_valid: true, rge_valid: false, qualibat_valid: false,
      },
      error: null,
    }
  }
  if (appel.table === 'marches_candidatures' && appel.operation === 'insert') {
    return { data: { id: 'c1', ...(appel.donnees as object) }, error: null }
  }
  if (appel.operation === 'rpc') return FONCTION_ABSENTE
  return { data: null, error: null }
}

const CORPS = {
  artisan_id: FICHE, price: 5000, timeline: '1_mois', description: 'Pose de plaques de plâtre, deux équipes.',
  materials_included: true, guarantee: 'Décennale', effectif: 4,
}

const candidater = (corps: Record<string, unknown> = CORPS) =>
  POST(
    new NextRequest(`https://vitfix.io/api/marches/${MARCHE}/candidature`, {
      method: 'POST',
      body: JSON.stringify(corps),
      headers: { 'Content-Type': 'application/json' },
    }),
    { params: Promise.resolve({ id: MARCHE }) },
  )

beforeEach(() => {
  base().vider()
  base().repondre = enBase()
  h.user = { id: COMPTE }
  vi.mocked(logger.error).mockClear()
})

describe('POST /api/marches/[id]/candidature — candidater', () => {
  it('la candidature est enregistrée avec les colonnes réelles de la table, nom de l’entreprise compris', async () => {
    const res = await candidater()
    expect(res.status).toBe(201)
    const [insertion] = base().sur('marches_candidatures', 'insert')
    expect(insertion.donnees).toEqual({
      marche_id: MARCHE, artisan_id: FICHE, artisan_user_id: COMPTE, artisan_company_name: 'Bâtiment du Banc SARL',
      price: 5000, timeline: '1_mois', description: 'Pose de plaques de plâtre, deux équipes.', materials_included: true,
      guarantee: 'Décennale', status: 'pending',
    })
    expect((await res.json()).candidature).toMatchObject({ id: 'c1', artisan_company_name: 'Bâtiment du Banc SARL' })
  })

  it('une garantie laissée vide (null, envoyé par l’écran) est acceptée et enregistrée vide', async () => {
    const res = await candidater({ ...CORPS, guarantee: null })
    expect(res.status).toBe(201)
    expect(base().sur('marches_candidatures', 'insert')[0].donnees).toMatchObject({ guarantee: null })
  })

  it('fonction de compteur absente : le compteur du marché est quand même augmenté, par une mise à jour directe', async () => {
    await candidater()
    const [mise] = base().sur('marches', 'update')
    expect(mise?.donnees).toEqual({ candidatures_count: 2 })
    expect(mise?.filtres).toContainEqual(['eq', 'id', MARCHE])
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('fonction de compteur présente : pas de seconde mise à jour', async () => {
    base().repondre = enBase(appel => (appel.operation === 'rpc' ? { data: null, error: null } : undefined))
    await candidater()
    expect(base().sur('increment_counter', 'rpc')).toHaveLength(1)
    expect(base().sur('marches', 'update')).toHaveLength(0)
  })

  it('compteur impossible à mettre à jour : la candidature reste enregistrée, l’échec est journalisé', async () => {
    base().repondre = enBase(appel => (appel.table === 'marches' && appel.operation === 'update' ? { data: null, error: { message: 'timeout' } } : undefined))
    const res = await candidater()
    expect(res.status).toBe(201)
    expect(logger.error).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls[0])).toContain('timeout')
  })

  it('comportement conservé (décision en attente) : sans abonnement Artisan Pro, la candidature est refusée', async () => {
    base().repondre = enBase(appel => (appel.table === 'profiles_artisan'
      ? { data: { id: FICHE, subscription_tier: null, company_name: 'Bâtiment du Banc SARL' }, error: null }
      : undefined))
    const res = await candidater()
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('Abonnement Artisan Pro requis pour candidater')
    expect(base().sur('marches_candidatures', 'insert')).toHaveLength(0)
  })

  it('sans connexion : 401, rien n’est lu ni écrit', async () => {
    h.user = null
    const res = await candidater()
    expect(res.status).toBe(401)
    expect(base().appels).toHaveLength(0)
  })
})
