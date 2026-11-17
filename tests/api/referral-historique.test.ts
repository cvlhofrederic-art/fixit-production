// tests/api/referral-historique.test.ts
//
// GET /api/referral/history — historique des parrainages, affiché par l'écran Parrainage du tableau de bord pro.
// Relecture adverse du 16/11/2026 : depuis que la société BTP envoie sa session (constat api-peripherie-8), elle atteint
// cette route. Les noms des filleuls y étaient lus avec une colonne absente de profiles_artisan en production
// (first_name) : la base refusait toute la lecture, l'erreur n'était pas lue, et chaque filleul s'affichait « Artisan ».
// Troisième relecture adverse (17/11/2026) : la lecture de la fiche du compte et celle des parrainages ignoraient aussi
// leur erreur ; une panne répondait « fiche introuvable » (404) ou un historique vide (200), sans trace au journal.
// Le faux client ne connaît que les tables et colonnes réelles de la production (tests/helpers/faux-supabase-marches),
// profiles_artisan comprise.

import { describe, it, expect, vi, beforeEach } from 'vitest'
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
// Seule la lecture du jeton est simulée.
vi.mock('@/lib/auth-helpers', async importOriginal => {
  const reel = await importOriginal<typeof import('@/lib/auth-helpers')>()
  return { ...reel, getAuthUser: vi.fn(async () => h.user) }
})
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/mocks-routes-api')).rateLimitPermissif())
vi.mock('@/lib/logger', async () => (await import('../helpers/mocks-routes-api')).loggerSilencieux())

const { GET } = await import('@/app/api/referral/history/route')
const { logger } = await import('@/lib/logger')

const COMPTE_SOCIETE = '11111111-1111-4111-8111-111111111111'
const FICHE_SOCIETE = '33333333-3333-4333-8333-333333333333'
const FICHE_FILLEUL = '55555555-5555-4555-8555-555555555555'

const base = () => h.base as FauxSupabase
const historique = () => GET(new NextRequest('https://vitfix.io/api/referral/history'))

/** Un parrainage de la société, dont le filleul a une fiche ; `fichesDesFilleuls` : réponse à la lecture de leurs noms. */
const enBase = (fichesDesFilleuls: Reponse) => (appel: Appel): Reponse => {
  if (appel.table === 'referrals') {
    return {
      data: [{
        id: 'r1', statut: 'inscrit', date_inscription: '2026-11-10T09:00:00Z', date_recompense: null,
        date_fin_periode_verification: null, filleul_id: FICHE_FILLEUL, mois_offerts_parrain: 0,
      }],
      error: null,
    }
  }
  if (appel.table === 'profiles_artisan') {
    // Fiche du compte connecté (lue par user_id), puis fiches des filleuls (lues par leurs identifiants).
    const ficheDuCompte = appel.filtres.some(([, colonne]) => colonne === 'user_id')
    return ficheDuCompte ? { data: { id: FICHE_SOCIETE }, error: null } : fichesDesFilleuls
  }
  return { data: null, error: null }
}

beforeEach(() => {
  base().vider()
  h.user = { id: COMPTE_SOCIETE, app_metadata: { role: 'pro_societe' } }
  vi.mocked(logger.error).mockClear()
})

describe('GET /api/referral/history — noms des filleuls', () => {
  it('chaque filleul est nommé par le nom de sa société, lu avec les colonnes réelles des fiches', async () => {
    base().repondre = enBase({ data: [{ id: FICHE_FILLEUL, company_name: 'Menuiserie du Quai' }], error: null })
    const res = await historique()
    expect(res.status).toBe(200)
    expect((await res.json()).history).toEqual([expect.objectContaining({ id: 'r1', filleul_name: 'Menuiserie du Quai' })])
    const lectureDesFilleuls = base().sur('profiles_artisan', 'select').find(a => a.filtres.some(([operateur]) => operateur === 'in'))
    expect(lectureDesFilleuls?.filtres).toContainEqual(['in', 'id', [FICHE_FILLEUL]])
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('lecture des fiches des filleuls impossible : l’historique reste affiché, avec un nom générique, et l’échec est journalisé', async () => {
    base().repondre = enBase({ data: null, error: { message: 'délai dépassé' } })
    const res = await historique()
    expect(res.status).toBe(200)
    expect((await res.json()).history).toEqual([expect.objectContaining({ id: 'r1', filleul_name: 'Artisan' })])
    expect(logger.error).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls[0])).toContain('délai dépassé')
  })
})

describe('GET /api/referral/history — panne ou absence', () => {
  const NOMS_DES_FILLEULS: Reponse = { data: [{ id: FICHE_FILLEUL, company_name: 'Menuiserie du Quai' }], error: null }
  const PANNE: Reponse = { data: null, error: { message: 'délai dépassé' } }

  it('fiche du compte illisible (panne) : 500, l’échec est journalisé et les parrainages ne sont pas lus', async () => {
    base().repondre = appel => (appel.table === 'profiles_artisan' ? PANNE : enBase(NOMS_DES_FILLEULS)(appel))
    const res = await historique()
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('Une erreur interne est survenue')
    expect(base().sur('referrals')).toHaveLength(0)
    expect(logger.error).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls[0])).toContain('délai dépassé')
  })

  it('parrainages illisibles (panne) : 500 et l’échec est journalisé, pas un historique vide', async () => {
    base().repondre = appel => (appel.table === 'referrals' ? PANNE : enBase(NOMS_DES_FILLEULS)(appel))
    const res = await historique()
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('Une erreur interne est survenue')
    expect(logger.error).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls[0])).toContain('délai dépassé')
  })

  it('compte sans fiche : 404, rien n’est journalisé (inchangé)', async () => {
    base().repondre = () => ({ data: null, error: null })
    expect((await historique()).status).toBe(404)
    expect(base().sur('referrals')).toHaveLength(0)
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('aucun parrainage : historique vide (200), rien n’est journalisé (inchangé)', async () => {
    base().repondre = appel => (appel.table === 'referrals' ? { data: [], error: null } : enBase(NOMS_DES_FILLEULS)(appel))
    const res = await historique()
    expect(res.status).toBe(200)
    expect((await res.json()).history).toEqual([])
    expect(logger.error).not.toHaveBeenCalled()
  })
})
