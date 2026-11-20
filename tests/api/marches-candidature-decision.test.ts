// tests/api/marches-candidature-decision.test.ts
//
// PATCH /api/marches/[id]/candidature/[cid] — le publieur d'une offre accepte ou refuse une candidature
// (« Recruter sous-traitants » d'une société BTP, page publique de gestion d'un appel d'offres).
// Audit des fondations BTP du 11/11/2026 : la route lisait et écrivait une table qui n'existe pas en production
// (« marche_candidatures », sans « s ») et répondait toujours « Candidature introuvable » ; la notification au
// candidat était écrite sous l'identifiant de sa fiche, alors que la cloche lit l'identifiant de son compte.
// Le faux client ne connaît que les tables et colonnes réelles de la production (tests/helpers/faux-supabase-marches).

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
vi.mock('@/lib/logger', async () => (await import('../helpers/mocks-routes-api')).loggerSilencieux())

const { PATCH } = await import('@/app/api/marches/[id]/candidature/[cid]/route')
const { logger } = await import('@/lib/logger')

const PUBLIEUR = '11111111-1111-4111-8111-111111111111'
const COMPTE_CANDIDAT = '22222222-2222-4222-8222-222222222222'
const FICHE_CANDIDAT = '33333333-3333-4333-8333-333333333333'
const MARCHE = '44444444-4444-4444-8444-444444444444'
const AUTRE_MARCHE = '55555555-5555-4555-8555-555555555555'
const CANDIDATURE = '66666666-6666-4666-8666-666666666666'

const base = () => h.base as FauxSupabase

/** Le marché (publié par PUBLIEUR, clé de gestion « cle ») et la candidature d'une entreprise sur ce marché. */
const enBase = (surcharge: (appel: Appel) => Reponse | undefined = () => undefined) => (appel: Appel): Reponse => {
  const special = surcharge(appel)
  if (special) return special
  if (appel.table === 'marches' && appel.operation === 'select') {
    return { data: { id: MARCHE, title: 'Lot plâtrerie', publisher_user_id: PUBLIEUR, access_token: 'cle', status: 'open' }, error: null }
  }
  if (appel.table === 'marches_candidatures' && appel.operation === 'select') {
    return {
      data: { id: CANDIDATURE, marche_id: MARCHE, artisan_id: FICHE_CANDIDAT, artisan_user_id: COMPTE_CANDIDAT, status: 'pending' },
      error: null,
    }
  }
  if (appel.table === 'marches_candidatures' && appel.operation === 'update') {
    return { data: { id: CANDIDATURE, ...(appel.donnees as object) }, error: null }
  }
  return { data: null, error: null }
}

const decider = (corps: Record<string, unknown>) =>
  PATCH(
    new NextRequest(`https://vitfix.io/api/marches/${MARCHE}/candidature/${CANDIDATURE}`, {
      method: 'PATCH',
      body: JSON.stringify(corps),
      headers: { 'Content-Type': 'application/json' },
    }),
    { params: Promise.resolve({ id: MARCHE, cid: CANDIDATURE }) },
  )

const notifications = () => base().sur('artisan_notifications', 'insert').map(a => a.donnees as Record<string, unknown>)

beforeEach(() => {
  base().vider()
  base().repondre = enBase()
  h.user = { id: PUBLIEUR }
  vi.mocked(logger.error).mockClear()
})

describe('PATCH /api/marches/[id]/candidature/[cid] — accepter ou refuser une candidature', () => {
  it('accepter : la candidature passe à « acceptée » dans la table réelle et le marché est attribué', async () => {
    const res = await decider({ status: 'accepted' })
    expect(res.status).toBe(200)
    expect((await res.json()).candidature).toMatchObject({ id: CANDIDATURE, status: 'accepted' })
    // Aucune lecture ni écriture dans une table absente de la base.
    expect(base().appels.map(a => a.table)).not.toContain('marche_candidatures')
    const [ecriture] = base().sur('marches_candidatures', 'update')
    expect(ecriture.donnees).toMatchObject({ status: 'accepted' })
    expect(ecriture.filtres).toContainEqual(['eq', 'id', CANDIDATURE])
    const [attribution] = base().sur('marches', 'update')
    expect(attribution.donnees).toMatchObject({ status: 'awarded' })
    expect(attribution.filtres).toContainEqual(['eq', 'id', MARCHE])
  })

  it('accepter : le candidat est prévenu sous l’identifiant de son compte, celui que lit sa cloche', async () => {
    await decider({ status: 'accepted' })
    expect(notifications()).toEqual([
      expect.objectContaining({ artisan_id: COMPTE_CANDIDAT, type: 'marche_won', title: 'Marché remporté !' }),
    ])
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('refuser : la candidature passe à « refusée », le marché reste ouvert, le candidat est prévenu sur son compte', async () => {
    const res = await decider({ status: 'rejected' })
    expect(res.status).toBe(200)
    expect(base().sur('marches_candidatures', 'update')[0].donnees).toMatchObject({ status: 'rejected' })
    expect(base().sur('marches', 'update')).toHaveLength(0)
    expect(notifications()).toEqual([
      expect.objectContaining({ artisan_id: COMPTE_CANDIDAT, type: 'marche_rejected', title: 'Candidature non retenue' }),
    ])
  })

  it('publieur sans compte, par la clé de gestion de la page publique : même décision', async () => {
    h.user = null
    const res = await decider({ status: 'accepted', access_token: 'cle' })
    expect(res.status).toBe(200)
    expect(base().sur('marches_candidatures', 'update')).toHaveLength(1)
  })

  it('une notification refusée par la base ne fait pas échouer la décision, mais laisse une trace au journal', async () => {
    base().repondre = enBase(appel => (appel.table === 'artisan_notifications' ? { data: null, error: { message: 'insert refusé' } } : undefined))
    const res = await decider({ status: 'accepted' })
    expect(res.status).toBe(200)
    expect(logger.error).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls[0])).toContain('insert refusé')
  })

  it('un autre compte que le publieur, sans la clé : 403, rien n’est écrit', async () => {
    h.user = { id: COMPTE_CANDIDAT }
    const res = await decider({ status: 'accepted', access_token: 'mauvaise-cle' })
    expect(res.status).toBe(403)
    expect(base().appels.filter(a => a.operation !== 'select')).toHaveLength(0)
  })

  it('une candidature déposée sur un autre marché : 400, rien n’est écrit', async () => {
    base().repondre = enBase(appel => (appel.table === 'marches_candidatures' && appel.operation === 'select'
      ? { data: { id: CANDIDATURE, marche_id: AUTRE_MARCHE, artisan_id: FICHE_CANDIDAT, artisan_user_id: COMPTE_CANDIDAT, status: 'pending' }, error: null }
      : undefined))
    const res = await decider({ status: 'accepted' })
    expect(res.status).toBe(400)
    expect(base().appels.filter(a => a.operation !== 'select')).toHaveLength(0)
  })
})
