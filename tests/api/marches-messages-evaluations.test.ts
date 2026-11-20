// tests/api/marches-messages-evaluations.test.ts
//
// Messages et évaluations d'un marché de la Bourse (audit des fondations BTP du 11/11/2026) :
//   - POST /api/marches/[id]/messages, message du publieur : le candidat est prévenu sous l'identifiant de son
//     compte (celui que lit sa cloche), avec les colonnes réelles de la table des notifications. La route écrivait
//     l'identifiant de la fiche et deux colonnes absentes (user_id, metadata) : la base refusait la notification
//     et rien ne le disait.
//   - GET /api/marches/[id]/evaluation : la lecture demandait deux colonnes absentes de marches_candidatures
//     (artisan_name, artisan_city) et échouait toujours.
//   - POST /api/marches/[id]/evaluation, évaluation par le publieur : la route remplaçait la note publique de la
//     fiche de l'entreprise (rating_avg, rating_count, tirés des avis clients) par la moyenne des seules évaluations
//     de marchés. Une donnée existante de la société serait écrasée : la fiche n'est plus touchée, l'évaluation est
//     seulement enregistrée (la façon de la compter dans la note publique est laissée à la décision de Frédéric).
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

const { POST: ECRIRE } = await import('@/app/api/marches/[id]/messages/route')
const { GET: LIRE_EVALUATIONS, POST: EVALUER } = await import('@/app/api/marches/[id]/evaluation/route')
const { logger } = await import('@/lib/logger')

const COMPTE_CANDIDAT = '22222222-2222-4222-8222-222222222222'
const FICHE_CANDIDAT = '33333333-3333-4333-8333-333333333333'
const MARCHE = '44444444-4444-4444-8444-444444444444'
const CANDIDATURE = '66666666-6666-4666-8666-666666666666'

const base = () => h.base as FauxSupabase
const contexte = () => ({ params: Promise.resolve({ id: MARCHE }) })
const requete = (chemin: string, corps?: Record<string, unknown>) =>
  new NextRequest(`https://vitfix.io/api/marches/${MARCHE}/${chemin}`, corps
    ? { method: 'POST', body: JSON.stringify(corps), headers: { 'Content-Type': 'application/json' } }
    : undefined)

/** Un marché attribué (clé de gestion « cle »), la candidature retenue de l'entreprise, ses évaluations. */
const enBase = (surcharge: (appel: Appel) => Reponse | undefined = () => undefined) => (appel: Appel): Reponse => {
  const special = surcharge(appel)
  if (special) return special
  if (appel.table === 'marches') return { data: { id: MARCHE, status: 'awarded', access_token: 'cle' }, error: null }
  if (appel.table === 'marches_candidatures' && appel.operation === 'select') {
    return { data: { id: CANDIDATURE, artisan_id: FICHE_CANDIDAT, artisan_user_id: COMPTE_CANDIDAT, status: 'accepted' }, error: null }
  }
  if (appel.table === 'marches_messages' && appel.operation === 'insert') {
    return { data: { id: 'm1', ...(appel.donnees as object) }, error: null }
  }
  if (appel.table === 'marches_evaluations' && appel.operation === 'insert') {
    return { data: { id: 'e1', ...(appel.donnees as object) }, error: null }
  }
  if (appel.table === 'marches_evaluations' && appel.operation === 'select') {
    const filtreSur = (colonne: string) => appel.filtres.some(([, c]) => c === colonne)
    // Contrôle des doublons (cette candidature, ce type d'évaluateur) : aucune évaluation antérieure.
    if (filtreSur('candidature_id') && filtreSur('evaluator_type')) return { data: null, error: null }
    // Toute autre lecture (liste du marché, évaluations d'une entreprise) : une évaluation déjà reçue.
    return { data: [{ id: 'e0', evaluator_type: 'publisher', note_globale: 4, commentaire: 'Travail soigné', candidature_id: CANDIDATURE }], error: null }
  }
  return { data: null, error: null }
}

beforeEach(() => {
  base().vider()
  base().repondre = enBase()
  h.user = null
  vi.mocked(logger.error).mockClear()
  vi.mocked(logger.warn).mockClear()
})

describe('POST /api/marches/[id]/messages — message du publieur', () => {
  const MESSAGE = { content: 'Pouvez-vous commencer lundi ?', candidature_id: CANDIDATURE, sender_type: 'publisher', sender_name: 'Donneur d’ordre', access_token: 'cle' }

  it('le candidat est prévenu sous l’identifiant de son compte, avec les colonnes réelles de la table', async () => {
    const res = await ECRIRE(requete('messages', MESSAGE), contexte())
    expect(res.status).toBe(201)
    const [notification] = base().sur('artisan_notifications', 'insert')
    expect(notification.donnees).toEqual({
      artisan_id: COMPTE_CANDIDAT,
      type: 'marche_message',
      title: 'Nouveau message sur votre candidature',
      body: 'Pouvez-vous commencer lundi ?',
      data_json: { marche_id: MARCHE, candidature_id: CANDIDATURE },
    })
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('une notification refusée par la base n’empêche pas le message, mais laisse une trace au journal', async () => {
    base().repondre = enBase(appel => (appel.table === 'artisan_notifications' ? { data: null, error: { message: 'insert refusé' } } : undefined))
    const res = await ECRIRE(requete('messages', MESSAGE), contexte())
    expect(res.status).toBe(201)
    expect(logger.error).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls[0])).toContain('insert refusé')
  })
})

describe('GET /api/marches/[id]/evaluation — lecture', () => {
  it('publieur (clé de gestion) : la lecture aboutit, avec le nom de l’entreprise tiré de la colonne réelle', async () => {
    const res = await LIRE_EVALUATIONS(requete('evaluation?token=cle'), contexte())
    expect(res.status).toBe(200)
    expect((await res.json()).evaluations).toHaveLength(1)
    const [lecture] = base().sur('marches_evaluations', 'select')
    expect(lecture.colonnes).toContain('marches_candidatures(id, artisan_company_name, price)')
  })

  it('entreprise connectée : ses évaluations, lecture aboutie', async () => {
    h.user = { id: COMPTE_CANDIDAT }
    base().repondre = enBase(appel => (appel.table === 'marches_candidatures' ? { data: [{ id: CANDIDATURE }], error: null } : undefined))
    const res = await LIRE_EVALUATIONS(requete('evaluation'), contexte())
    expect(res.status).toBe(200)
    expect((await res.json()).evaluations).toEqual([expect.objectContaining({ id: 'e0', note_globale: 4 })])
  })
})

describe('POST /api/marches/[id]/evaluation — évaluer', () => {
  it('publieur : l’évaluation est enregistrée, la note publique de la fiche de l’entreprise n’est pas écrasée', async () => {
    const res = await EVALUER(requete('evaluation', {
      candidature_id: CANDIDATURE, evaluator_type: 'publisher', note_globale: 2, access_token: 'cle',
    }), contexte())
    expect(res.status).toBe(201)
    expect(base().sur('marches_evaluations', 'insert')[0].donnees).toMatchObject({ candidature_id: CANDIDATURE, note_globale: 2 })
    expect(base().sur('marches_candidatures', 'update')[0].donnees).toEqual({ publisher_evaluated: true })
    // Ni lecture ni écriture de la fiche : sa note et son nombre d'avis restent ceux des avis clients.
    expect(base().sur('profiles_artisan')).toHaveLength(0)
  })

  it('entreprise retenue, connectée : son évaluation du publieur est enregistrée', async () => {
    h.user = { id: COMPTE_CANDIDAT }
    const res = await EVALUER(requete('evaluation', {
      candidature_id: CANDIDATURE, evaluator_type: 'artisan', note_globale: 5, commentaire: 'Paiement rapide',
    }), contexte())
    expect(res.status).toBe(201)
    expect(base().sur('marches_candidatures', 'update')[0].donnees).toEqual({ artisan_evaluated: true })
  })

  it('marqueur « évalué » impossible à poser : l’évaluation reste enregistrée, l’échec est journalisé', async () => {
    h.user = { id: COMPTE_CANDIDAT }
    base().repondre = enBase(appel => (appel.table === 'marches_candidatures' && appel.operation === 'update'
      ? { data: null, error: { message: 'timeout' } }
      : undefined))
    const res = await EVALUER(requete('evaluation', { candidature_id: CANDIDATURE, evaluator_type: 'artisan', note_globale: 5 }), contexte())
    expect(res.status).toBe(201)
    expect(logger.error).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls[0])).toContain('timeout')
  })
})
