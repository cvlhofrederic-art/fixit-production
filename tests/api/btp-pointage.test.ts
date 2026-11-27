// @vitest-environment node
// tests/api/btp-pointage.test.ts — GET et POST /api/btp/pointage (pointage géolocalisé BTP, 16/11/2026).
//
// Base simulée en mémoire et données fictives : tests/helpers/base-memoire-pointage.ts (partagées avec le test de
// /api/btp/pointage/evenement). La société du compte est résolue par le VRAI resolveCompanyId (lib/auth-helpers.ts)
// sur cette base.

import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { NOTE_A_REGULARISER, NOTE_DEPART_APRES_COUPURE, NOTE_DOUBLON } from '@/lib/btp/pointage-regles'
import { empreinteJeton } from '@/lib/btp/pointage-arriere-plan'

import {
  C_FINI, C_GARAGE, C_IMMEUBLE, C_JEAN, C_SOC_B, C_VILLA, GERANT_A, HEURE, M_GERANT, M_JEAN, M_LUC, M_PAUL, MAINTENANT,
  OUVRIER_INACTIF, OUVRIER_PAUL, OUVRIER_SANS_FICHE, SOC_A, SOC_B, U_INACTIF, U_PAUL, U_SANS_FICHE, donnees, etat, type Ligne,
} from '../helpers/base-memoire-pointage'

vi.mock('@/lib/supabase-server', async () => ({ supabaseAdmin: (await import('../helpers/base-memoire-pointage')).supabaseMemoire }))
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/mocks-routes-api')).rateLimitPermissif())
vi.mock('@/lib/logger', async () => (await import('../helpers/mocks-routes-api')).loggerSilencieux())
vi.mock('@/lib/auth-helpers', async (original) => {
  const base = await import('../helpers/base-memoire-pointage')
  return { ...(await original<typeof import('@/lib/auth-helpers')>()), getAuthUser: vi.fn(async () => base.etat.user) }
})

const { GET, POST } = await import('@/app/api/btp/pointage/route')

const lire = async (fuseau = 'Europe/Paris') => {
  const res = await GET(new NextRequest(`https://vitfix.io/api/btp/pointage?fuseau=${encodeURIComponent(fuseau)}`, { headers: { Authorization: 'Bearer tok' } }))
  return { status: res.status, json: await res.json() as Record<string, any> } // eslint-disable-line @typescript-eslint/no-explicit-any -- réponse JSON lue par les tests
}
const envoyer = async (corps: Record<string, unknown>) => {
  const res = await POST(new NextRequest('https://vitfix.io/api/btp/pointage', {
    method: 'POST',
    headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  }))
  return { status: res.status, json: await res.json() as Record<string, any> } // eslint-disable-line @typescript-eslint/no-explicit-any -- réponse JSON lue par les tests
}
const pointagesDe = (membreId: string) => (etat.tables.pointages_btp ?? []).filter(p => p.membre_id === membreId)
const ouvertsDe = (membreId: string) => pointagesDe(membreId).filter(p => p.heure_depart == null)
const duJour = (membreId: string, date = '2026-11-16') => pointagesDe(membreId).filter(p => p.date === date)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(MAINTENANT)
  donnees()
  etat.user = OUVRIER_PAUL
  etat.indexUnique = true
  etat.tablesAbsentes = new Set()
  etat.courseAvantInsertion = null
  etat.courseAppareil = null
  etat.ecritures = []
})
afterEach(() => { vi.useRealTimers() })

describe('GET /api/btp/pointage', () => {
  it('sans session : 401 ; compte artisan : 403', async () => {
    etat.user = null
    expect((await lire()).status).toBe(401)
    etat.user = { id: randomUUID(), email: 'artisan@example.test', app_metadata: { role: 'artisan' } }
    expect((await lire()).status).toBe(403)
  })

  it('employé (sous-compte actif) : sa fiche par e-mail, ses chantiers en cours affectés, rien d’une autre société', async () => {
    const { status, json } = await lire()
    expect(status).toBe(200)
    expect(json.gerant).toBe(false)
    expect(json.rattachement).toBe('relie')
    expect(json.moi).toEqual({ id: M_PAUL, nom: 'Paul Exemple' })
    // Villa et Garage directement, Immeuble par l'équipe ; pas le chantier terminé, ni celui de Jean, ni celui de B.
    expect(json.chantiers.map((c: { id: string }) => c.id)).toEqual([C_VILLA, C_GARAGE, C_IMMEUBLE])
    expect(json.chantiers[0]).toEqual({ id: C_VILLA, titre: 'Villa', adresse: '1 rue des Lilas, 13008 Marseille', latitude: 43.25, longitude: 5.38, rayonM: 150 })
    expect(json).toMatchObject({ pointageAutoActive: true, reglageDisponible: true, pointageEnCours: null, pointagesOublies: [] })
    expect(json.comptes).toBeUndefined()
    expect(json.affectationIndividuelle).toBeUndefined()
  })

  it('historique : ses seuls pointages des 31 derniers jours, sans position ni distance', async () => {
    const { json } = await lire()
    expect(json.historique).toEqual([{
      id: expect.any(String), chantierId: C_VILLA, chantierNom: 'Villa', date: '2026-11-13',
      heureArrivee: '08:00:00', heureDepart: '16:00:00', heuresTravaillees: 7, mode: 'manuel',
    }])
    expect(JSON.stringify(json)).not.toMatch(/arrivee_lat|distance|owner_id|budget|client/)
  })

  it('pointage automatique : coupé sans ligne de réglage ; migration absente : signalée, toujours coupé', async () => {
    etat.tables.pointage_reglages_btp = []
    expect((await lire()).json).toMatchObject({ pointageAutoActive: false, reglageDisponible: true })
    etat.tablesAbsentes.add('pointage_reglages_btp')
    expect((await lire()).json).toMatchObject({ pointageAutoActive: false, reglageDisponible: false })
  })

  it('pointage resté ouvert la veille : listé comme oublié, pas comme en cours ; GET n’écrit rien', async () => {
    etat.tables.pointages_btp.push({ id: randomUUID(), owner_id: SOC_A, membre_id: M_PAUL, chantier_id: C_VILLA, chantier_nom: 'Villa', employe: 'Paul Exemple', date: '2026-11-15', heure_arrivee: '08:30:00', heure_depart: null, pause_minutes: 0, mode: 'geo_auto', created_at: '2026-11-15T07:30:00.000Z' })
    const { json } = await lire()
    expect(json.pointageEnCours).toBeNull()
    expect(json.pointagesOublies).toEqual([expect.objectContaining({ date: '2026-11-15', heureDepart: null })])
    expect(etat.ecritures).toEqual([])
  })

  it('sous-compte désactivé : aucune donnée de la société', async () => {
    etat.user = OUVRIER_INACTIF
    const { status, json } = await lire()
    expect(status).toBe(200)
    expect(json).toMatchObject({ rattachement: 'aucun', moi: null, chantiers: [], historique: [], pointageEnCours: null })
  })

  it('co-gérant désactivé (GERANT d’une autre société, sans ligne active) : 403, aucun réglage écrit à son nom', async () => {
    // Avant le 25/11/2026 : « gérant » de sa propre société vide, il pouvait y poser le réglage du pointage automatique.
    etat.user = { ...OUVRIER_INACTIF, app_metadata: { ...OUVRIER_INACTIF.app_metadata, pro_team_role: 'GERANT' } }
    expect((await lire()).status).toBe(403)
  })

  it('compte sans fiche à son adresse : non relié ; deux fiches à la même adresse : ambigu', async () => {
    etat.user = OUVRIER_SANS_FICHE
    expect((await lire()).json).toMatchObject({ rattachement: 'aucun', moi: null, chantiers: [] })
    etat.tables.membres_btp.push({ id: randomUUID(), owner_id: SOC_A, prenom: 'Sans', nom: 'Fiche', email: 'sans.fiche@a.example', actif: true })
    etat.tables.membres_btp.push({ id: randomUUID(), owner_id: SOC_A, prenom: 'Sans', nom: 'Fiche bis', email: 'SANS.FICHE@a.example', actif: true })
    expect((await lire()).json).toMatchObject({ rattachement: 'ambigu', moi: null, chantiers: [] })
  })

  it('gérant : état des comptes (un compte désactivé ne compte pas), affectation individuelle disponible', async () => {
    etat.user = GERANT_A
    const { json } = await lire()
    expect(json.gerant).toBe(true)
    expect(json.rattachement).toBe('aucun')
    expect(json.comptes).toEqual({ [M_PAUL]: 'actif', [M_JEAN]: 'invitation', [M_GERANT]: 'aucun', [M_LUC]: 'aucun' })
    expect(json.affectationIndividuelle).toBe(true)
  })

  it('gérant : sans la colonne membres_ids (migration non appliquée), l’affectation individuelle est signalée indisponible', async () => {
    etat.user = GERANT_A
    etat.tables.chantiers_btp = etat.tables.chantiers_btp.map(({ membres_ids: _sans, ...reste }) => reste)
    expect((await lire()).json.affectationIndividuelle).toBe(false)
  })
})

describe('POST /api/btp/pointage — arrivée', () => {
  it('à la main sur un chantier affecté : pointage ouvert pour la société et la fiche résolues par le serveur', async () => {
    const { status, json } = await envoyer({ action: 'arrivee', chantierId: C_GARAGE, mode: 'manuel', owner_id: SOC_B, membre_id: M_JEAN })
    expect(status).toBe(201)
    expect(json.pointage).toMatchObject({ chantierId: C_GARAGE, chantierNom: 'Garage', date: '2026-11-16', heureArrivee: '08:30:00', heureDepart: null, mode: 'manuel' })
    const [cree] = ouvertsDe(M_PAUL)
    expect(cree).toMatchObject({ owner_id: SOC_A, membre_id: M_PAUL, chantier_id: C_GARAGE, employe: 'Paul Exemple', pause_minutes: 0, heures_travaillees: null, created_at: new Date(MAINTENANT).toISOString() })
    expect(cree).not.toHaveProperty('arrivee_lat')
    expect(cree).not.toHaveProperty('distance_m')
    expect(ouvertsDe(M_JEAN)).toEqual([])
  })

  it('automatique : heure de l’entrée dans la zone (passée, moins de 10 min) dans le fuseau du téléphone', async () => {
    const { json } = await envoyer({ action: 'arrivee', chantierId: C_VILLA, mode: 'geo_auto', observeA: MAINTENANT - 5 * 60_000, fuseau: 'Europe/Lisbon' })
    expect(json.pointage).toMatchObject({ date: '2026-11-16', heureArrivee: '07:25:00', mode: 'geo_auto' })
    expect(ouvertsDe(M_PAUL)[0].created_at).toBe(new Date(MAINTENANT - 5 * 60_000).toISOString())
  })

  it('heure du téléphone refusée : trop ancienne, dans le futur, ou pointage à la main', async () => {
    expect((await envoyer({ action: 'arrivee', chantierId: C_VILLA, mode: 'geo_auto', observeA: MAINTENANT - 3 * HEURE })).json.pointage.heureArrivee).toBe('08:30:00')
    await envoyer({ action: 'depart', mode: 'manuel' })
    expect((await envoyer({ action: 'arrivee', chantierId: C_IMMEUBLE, mode: 'geo_auto', observeA: MAINTENANT + 5 * 60_000 })).json.pointage.heureArrivee).toBe('08:30:00')
    await envoyer({ action: 'depart', mode: 'manuel' })
    expect((await envoyer({ action: 'arrivee', chantierId: C_GARAGE, mode: 'manuel', observeA: MAINTENANT - 5 * 60_000 })).json.pointage.heureArrivee).toBe('08:30:00')
  })

  it('fuseau hors liste : celui de la France métropolitaine', async () => {
    const { json } = await envoyer({ action: 'arrivee', chantierId: C_VILLA, mode: 'manuel', fuseau: 'America/Sao_Paulo' })
    expect(json.pointage.heureArrivee).toBe('08:30:00')
  })

  it('automatique refusé tant que le gérant ne l’a pas activé (ou sans la migration) ; à la main, toujours possible', async () => {
    etat.tables.pointage_reglages_btp = [{ owner_id: SOC_A, auto_active: false }]
    expect(await envoyer({ action: 'arrivee', chantierId: C_VILLA, mode: 'geo_auto' })).toEqual({ status: 403, json: { error: 'pointage_auto_desactive' } })
    etat.tablesAbsentes.add('pointage_reglages_btp')
    expect(await envoyer({ action: 'arrivee', chantierId: C_VILLA, mode: 'geo_auto' })).toEqual({ status: 403, json: { error: 'pointage_auto_desactive' } })
    expect(ouvertsDe(M_PAUL)).toEqual([])
    expect((await envoyer({ action: 'arrivee', chantierId: C_VILLA, mode: 'manuel' })).status).toBe(201)
  })

  it('automatique sur un chantier sans position GPS : 422', async () => {
    expect(await envoyer({ action: 'arrivee', chantierId: C_GARAGE, mode: 'geo_auto' })).toEqual({ status: 422, json: { error: 'chantier_sans_position' } })
  })

  it('chantier non affecté, terminé ou d’une autre société : 403, rien d’écrit', async () => {
    for (const chantierId of [C_JEAN, C_FINI, C_SOC_B, randomUUID()]) {
      expect(await envoyer({ action: 'arrivee', chantierId, mode: 'manuel' })).toEqual({ status: 403, json: { error: 'chantier_non_affecte' } })
    }
    expect(etat.ecritures).toEqual([])
  })

  it('déjà en cours aujourd’hui sur ce chantier : le même pointage, aucun doublon', async () => {
    await envoyer({ action: 'arrivee', chantierId: C_VILLA, mode: 'geo_auto' })
    const second = await envoyer({ action: 'arrivee', chantierId: C_VILLA, mode: 'geo_auto' })
    expect(second.status).toBe(200)
    expect(second.json.deja).toBe(true)
    expect(ouvertsDe(M_PAUL)).toHaveLength(1)
  })

  it('arrivée à la main sur un autre chantier : le pointage en cours est clos d’abord, heures calculées', async () => {
    await envoyer({ action: 'arrivee', chantierId: C_VILLA, mode: 'geo_auto' })
    vi.setSystemTime(MAINTENANT + 2 * HEURE + 15 * 60_000)
    const { status } = await envoyer({ action: 'arrivee', chantierId: C_IMMEUBLE, mode: 'manuel' })
    expect(status).toBe(201)
    expect(duJour(M_PAUL).find(p => p.chantier_id === C_VILLA)).toMatchObject({ heure_depart: '10:45:00', heures_travaillees: 2.25 })
    expect(ouvertsDe(M_PAUL).map(p => p.chantier_id)).toEqual([C_IMMEUBLE])
  })

  it('arrivée automatique pendant un autre pointage du jour (à la main, ou sur un autre chantier) : 409, rien de clos', async () => {
    await envoyer({ action: 'arrivee', chantierId: C_VILLA, mode: 'manuel' })
    vi.setSystemTime(MAINTENANT + 2 * HEURE)
    expect(await envoyer({ action: 'arrivee', chantierId: C_IMMEUBLE, mode: 'geo_auto' })).toEqual({ status: 409, json: { error: 'pointage_different' } })
    expect(ouvertsDe(M_PAUL)).toEqual([expect.objectContaining({ chantier_id: C_VILLA, mode: 'manuel', heure_depart: null })])
    await envoyer({ action: 'depart', mode: 'manuel' })
    await envoyer({ action: 'arrivee', chantierId: C_VILLA, mode: 'geo_auto' })
    expect(await envoyer({ action: 'arrivee', chantierId: C_IMMEUBLE, mode: 'geo_auto' })).toEqual({ status: 409, json: { error: 'pointage_different' } })
    expect(ouvertsDe(M_PAUL).map(p => [p.chantier_id, p.mode])).toEqual([[C_VILLA, 'geo_auto']])
  })

  it('départ oublié la veille, arrivée le lendemain sur le même chantier : la veille refermée sans heures, la journée ouverte', async () => {
    await envoyer({ action: 'arrivee', chantierId: C_VILLA, mode: 'geo_auto' })
    vi.setSystemTime(MAINTENANT + 24 * HEURE)
    const { status, json } = await envoyer({ action: 'arrivee', chantierId: C_VILLA, mode: 'geo_auto' })
    expect(status).toBe(201)
    expect(json.deja).toBeUndefined()
    expect(json.pointage).toMatchObject({ date: '2026-11-17', heureArrivee: '08:30:00' })
    expect(duJour(M_PAUL, '2026-11-16')).toEqual([expect.objectContaining({ heure_depart: '08:30:00', heures_travaillees: 0, notes: NOTE_A_REGULARISER })])
    expect(ouvertsDe(M_PAUL).map(p => p.date)).toEqual(['2026-11-17'])
  })

  it('double envoi simultané (index unique) : le pointage déjà ouvert est rendu', async () => {
    const deja: Ligne = { id: randomUUID(), owner_id: SOC_A, membre_id: M_PAUL, chantier_id: C_VILLA, chantier_nom: 'Villa', employe: 'Paul Exemple', date: '2026-11-16', heure_arrivee: '08:29:58', heure_depart: null, pause_minutes: 0, mode: 'geo_auto', created_at: new Date(MAINTENANT - 2000).toISOString() }
    etat.courseAvantInsertion = deja
    const { status, json } = await envoyer({ action: 'arrivee', chantierId: C_VILLA, mode: 'geo_auto' })
    expect(status).toBe(200)
    expect(json).toMatchObject({ deja: true, pointage: { id: deja.id, heureArrivee: '08:29:58' } })
    expect(ouvertsDe(M_PAUL)).toHaveLength(1)
  })

  it('compte non relié : 409 fiche_absente ; corps invalide : 400', async () => {
    etat.user = OUVRIER_SANS_FICHE
    expect(await envoyer({ action: 'arrivee', chantierId: C_VILLA, mode: 'manuel' })).toEqual({ status: 409, json: { error: 'fiche_absente' } })
    etat.user = OUVRIER_PAUL
    expect((await envoyer({ action: 'arrivee', chantierId: 'pas-un-uuid', mode: 'manuel' })).status).toBe(400)
    expect((await envoyer({ action: 'supprimer', chantierId: C_VILLA, mode: 'manuel' })).status).toBe(400)
    expect((await envoyer({ action: 'arrivee', chantierId: C_VILLA, mode: 'geo_confirme' })).status).toBe(400)
  })
})

describe('POST /api/btp/pointage — départ', () => {
  it('clôt le pointage en cours de l’employé, heures calculées sur les instants', async () => {
    await envoyer({ action: 'arrivee', chantierId: C_VILLA, mode: 'geo_auto' })
    vi.setSystemTime(MAINTENANT + 4 * HEURE + 6 * 60_000)
    const { status, json } = await envoyer({ action: 'depart', chantierId: C_VILLA, mode: 'geo_auto' })
    expect(status).toBe(200)
    expect(json.pointage).toMatchObject({ heureArrivee: '08:30:00', heureDepart: '12:36:00', heuresTravaillees: 4.1 })
    expect(ouvertsDe(M_PAUL)).toEqual([])
    // La clôture ne touche que la ligne ouverte de la société et de l'employé.
    const cloture = etat.ecritures.find(e => e.op === 'update')
    expect(cloture?.filtres).toEqual(expect.arrayContaining([`owner_id=${SOC_A}`, 'heure_depart is null']))
  })

  it('changer le fuseau du téléphone entre l’arrivée et le départ ne change pas la durée', async () => {
    await envoyer({ action: 'arrivee', chantierId: C_VILLA, mode: 'manuel', fuseau: 'Europe/Lisbon' })
    vi.setSystemTime(MAINTENANT + 8 * HEURE)
    const { json } = await envoyer({ action: 'depart', mode: 'manuel', fuseau: 'Indian/Reunion' })
    expect(json.pointage).toMatchObject({ heureArrivee: '07:30:00', heureDepart: '15:30:00', heuresTravaillees: 8 })
  })

  it('départ automatique daté de la sortie vue par le téléphone (envoi retardé), jamais avant l’arrivée ni après maintenant', async () => {
    await envoyer({ action: 'arrivee', chantierId: C_VILLA, mode: 'geo_auto' })
    vi.setSystemTime(MAINTENANT + 11 * HEURE)
    const { json } = await envoyer({ action: 'depart', chantierId: C_VILLA, mode: 'geo_auto', observeA: MAINTENANT + 8 * HEURE + 30 * 60_000 })
    expect(json.pointage).toMatchObject({ heureDepart: '17:00:00', heuresTravaillees: 8.5 })
  })

  it('le téléphone ne termine pas tout seul un pointage commencé à la main, ni un autre chantier', async () => {
    await envoyer({ action: 'arrivee', chantierId: C_VILLA, mode: 'manuel' })
    expect(await envoyer({ action: 'depart', chantierId: C_VILLA, mode: 'geo_auto' })).toEqual({ status: 409, json: { error: 'pointage_different' } })
    await envoyer({ action: 'depart', mode: 'manuel' })
    await envoyer({ action: 'arrivee', chantierId: C_IMMEUBLE, mode: 'geo_auto' })
    expect(await envoyer({ action: 'depart', chantierId: C_VILLA, mode: 'geo_auto' })).toEqual({ status: 409, json: { error: 'pointage_different' } })
    expect(await envoyer({ action: 'depart', mode: 'geo_auto' })).toEqual({ status: 409, json: { error: 'pointage_different' } })
    expect(ouvertsDe(M_PAUL).map(p => p.chantier_id)).toEqual([C_IMMEUBLE])
  })

  it('fin à la main après une coupure du suivi : départ à l’heure du serveur, note au gérant avec la dernière présence vue', async () => {
    await envoyer({ action: 'arrivee', chantierId: C_VILLA, mode: 'geo_auto' })
    vi.setSystemTime(MAINTENANT + 4 * HEURE + 30 * 60_000)
    const { json } = await envoyer({ action: 'depart', mode: 'manuel', derniereVue: MAINTENANT + 35 * 60_000 })
    expect(json.pointage).toMatchObject({ heureDepart: '13:00:00', heuresTravaillees: 4.5 })
    expect(duJour(M_PAUL)[0].notes).toBe(`${NOTE_DEPART_APRES_COUPURE} ; dernière présence vue sur le chantier à 09:05 : à vérifier.`)
  })

  it('dernière présence hors de l’arrivée et du départ : ignorée, pas de note', async () => {
    await envoyer({ action: 'arrivee', chantierId: C_VILLA, mode: 'geo_auto' })
    vi.setSystemTime(MAINTENANT + 4 * HEURE)
    await envoyer({ action: 'depart', mode: 'manuel', derniereVue: MAINTENANT - HEURE })
    expect(duJour(M_PAUL)[0].notes ?? null).toBeNull()
    expect((await envoyer({ action: 'depart', mode: 'manuel', derniereVue: 'hier' })).status).toBe(400)
  })

  it('sans pointage en cours : 404, rien d’écrit', async () => {
    expect(await envoyer({ action: 'depart', mode: 'manuel' })).toEqual({ status: 404, json: { error: 'aucun_pointage_en_cours' } })
    expect(etat.ecritures).toEqual([])
  })

  it('départ oublié jusqu’au lendemain : refermé sans heures et à régulariser, plus rien en cours', async () => {
    await envoyer({ action: 'arrivee', chantierId: C_VILLA, mode: 'manuel' })
    vi.setSystemTime(MAINTENANT + 24 * HEURE)
    expect(await envoyer({ action: 'depart', mode: 'manuel' })).toEqual({ status: 404, json: { error: 'aucun_pointage_en_cours' } })
    expect(duJour(M_PAUL)).toEqual([expect.objectContaining({ heure_depart: '08:30:00', heures_travaillees: 0, notes: NOTE_A_REGULARISER })])
  })

  it('sans l’index de la migration, deux pointages ouverts : le plus ancien porte les heures, l’autre est refermé sans heures', async () => {
    etat.indexUnique = false
    await envoyer({ action: 'arrivee', chantierId: C_VILLA, mode: 'manuel' })
    etat.tables.pointages_btp.push({ id: randomUUID(), owner_id: SOC_A, membre_id: M_PAUL, chantier_id: C_VILLA, chantier_nom: 'Villa', employe: 'Paul Exemple', date: '2026-11-16', heure_arrivee: '08:30:01', heure_depart: null, pause_minutes: 0, mode: 'manuel', created_at: new Date(MAINTENANT + 1000).toISOString() })
    vi.setSystemTime(MAINTENANT + 8 * HEURE)
    const { json } = await envoyer({ action: 'depart', mode: 'manuel' })
    expect(json.pointage).toMatchObject({ heureArrivee: '08:30:00', heuresTravaillees: 8 })
    expect(ouvertsDe(M_PAUL)).toEqual([])
    expect(duJour(M_PAUL).map(p => [p.heure_arrivee, p.heures_travaillees, p.notes ?? null])).toEqual([
      ['08:30:00', 8, null],
      ['08:30:01', 0, NOTE_DOUBLON],
    ])
  })

  it('le pointage en cours apparaît dans GET, puis disparaît après le départ', async () => {
    await envoyer({ action: 'arrivee', chantierId: C_IMMEUBLE, mode: 'manuel' })
    expect((await lire()).json.pointageEnCours).toMatchObject({ chantierId: C_IMMEUBLE, heureDepart: null })
    await envoyer({ action: 'depart', mode: 'manuel' })
    expect((await lire()).json.pointageEnCours).toBeNull()
  })
})

describe('POST /api/btp/pointage — interrupteur du pointage automatique', () => {
  beforeEach(() => { etat.tables.pointage_reglages_btp = [] })

  it('réservé au gérant ; activation seulement avec la confirmation d’information des salariés', async () => {
    expect(await envoyer({ action: 'reglage_auto', actif: true, confirmation: true })).toEqual({ status: 403, json: { error: 'reserve_au_gerant' } })
    etat.user = GERANT_A
    expect(await envoyer({ action: 'reglage_auto', actif: true })).toEqual({ status: 422, json: { error: 'confirmation_requise' } })
    expect(etat.tables.pointage_reglages_btp).toEqual([])
  })

  it('activation : qui et quand gardés ; coupure : la trace de la confirmation reste ; settings_btp jamais touché', async () => {
    etat.user = GERANT_A
    expect(await envoyer({ action: 'reglage_auto', actif: true, confirmation: true })).toEqual({ status: 200, json: { pointageAutoActive: true } })
    const confirmeLe = new Date(MAINTENANT).toISOString()
    expect(etat.tables.pointage_reglages_btp).toEqual([{ owner_id: SOC_A, auto_active: true, confirme_le: confirmeLe, confirme_par: SOC_A, modifie_le: confirmeLe }])
    vi.setSystemTime(MAINTENANT + HEURE)
    await envoyer({ action: 'reglage_auto', actif: false })
    expect(etat.tables.pointage_reglages_btp[0]).toMatchObject({ auto_active: false, confirme_le: confirmeLe, confirme_par: SOC_A })
    expect(etat.ecritures.filter(e => e.table === 'settings_btp')).toEqual([])
    expect(etat.tables.settings_btp).toEqual([])
  })

  it('migration non appliquée : 409 migration_requise', async () => {
    etat.user = GERANT_A
    etat.tablesAbsentes.add('pointage_reglages_btp')
    expect(await envoyer({ action: 'reglage_auto', actif: true, confirmation: true })).toEqual({ status: 409, json: { error: 'migration_requise' } })
  })
})

describe('POST /api/btp/pointage — téléphone en poche (appareil, appareil_retirer)', () => {
  it('enregistre ce téléphone : jeton rendu une fois, seule son empreinte gardée ; un nouvel enregistrement retire l’ancien', async () => {
    const premier = await envoyer({ action: 'appareil', plateforme: 'android', fuseau: 'Europe/Lisbon' })
    expect(premier.status).toBe(201)
    expect(premier.json.url).toBe('https://vitfix.io/api/btp/pointage/evenement')
    expect(premier.json.jeton).toMatch(/^[\w-]{43}$/)
    expect(premier.json.appareil).toMatch(/^[0-9a-f-]{36}$/)
    expect(etat.tables.pointage_appareils_btp).toEqual([expect.objectContaining({
      id: premier.json.appareil, owner_id: SOC_A, membre_id: M_PAUL, user_id: U_PAUL, plateforme: 'android', fuseau: 'Europe/Lisbon',
      empreinte: await empreinteJeton(String(premier.json.jeton)),
      // Adresse de la fiche, normalisée : le rattachement du compte (« Paul@A.example » sur la fiche).
      email_fiche: 'paul@a.example',
    })])
    expect(JSON.stringify(etat.tables.pointage_appareils_btp)).not.toContain(String(premier.json.jeton))

    vi.setSystemTime(MAINTENANT + HEURE)
    const second = await envoyer({ action: 'appareil', plateforme: 'ios', fuseau: 'Pacific/Fiji' })
    expect(second.status).toBe(201)
    const [ancien, nouveau] = etat.tables.pointage_appareils_btp
    expect(ancien.retire_le).toBe(new Date(MAINTENANT + HEURE).toISOString())
    expect(nouveau).toMatchObject({ id: second.json.appareil, plateforme: 'ios', fuseau: 'Europe/Paris' })
    expect(second.json.appareil).not.toBe(premier.json.appareil)
    expect(nouveau.retire_le ?? null).toBeNull()
  })

  it('pointage automatique coupé par le gérant, fiche absente, migration non appliquée : refusé, rien d’écrit', async () => {
    etat.tables.pointage_reglages_btp = [{ owner_id: SOC_A, auto_active: false }]
    expect(await envoyer({ action: 'appareil', plateforme: 'android' })).toEqual({ status: 403, json: { error: 'pointage_auto_desactive' } })
    donnees()
    etat.user = OUVRIER_SANS_FICHE
    expect(await envoyer({ action: 'appareil', plateforme: 'android' })).toEqual({ status: 409, json: { error: 'fiche_absente' } })
    etat.user = OUVRIER_PAUL
    etat.tablesAbsentes.add('pointage_appareils_btp')
    expect(await envoyer({ action: 'appareil', plateforme: 'android' })).toEqual({ status: 409, json: { error: 'migration_requise_appareils' } })
    expect(etat.tables.pointage_appareils_btp ?? []).toEqual([])
  })

  it('activation pendant un pointage automatique en cours (page ouverte) : confié au téléphone, arrivée au journal', async () => {
    const ouvert = { id: randomUUID(), owner_id: SOC_A, membre_id: M_PAUL, chantier_id: C_VILLA, chantier_nom: 'Villa', date: '2026-11-16', heure_arrivee: '08:20:00', heure_depart: null, heures_travaillees: null, notes: null, mode: 'geo_auto', created_at: new Date(MAINTENANT - 10 * 60_000).toISOString() }
    etat.tables.pointages_btp.push(ouvert)
    const { json } = await envoyer({ action: 'appareil', plateforme: 'android' })
    expect(etat.tables.pointage_lignes_appareil_btp).toEqual([expect.objectContaining({
      pointage_id: ouvert.id, appareil_id: json.appareil, date: '2026-11-16',
      ecrit: { chantier_id: C_VILLA, date: '2026-11-16', heure_arrivee: '08:20:00', heure_depart: null, heures_travaillees: null, notes: null, created_at: ouvert.created_at },
    })])
    expect(etat.tables.pointage_evenements_btp).toEqual([expect.objectContaining({
      appareil_id: json.appareil, chantier_id: C_VILLA, sens: 'enter', detecte_le: ouvert.created_at, recu_le: ouvert.created_at,
    })])
  })

  it('pointage en cours : lien en échec après l’arrivée au journal → arrivée seule (sans effet), pointage laissé à l’employé', async () => {
    const ouvert = { id: randomUUID(), owner_id: SOC_A, membre_id: M_PAUL, chantier_id: C_VILLA, chantier_nom: 'Villa', date: '2026-11-16', heure_arrivee: '08:20:00', heure_depart: null, mode: 'geo_auto', created_at: new Date(MAINTENANT - 10 * 60_000).toISOString() }
    etat.tables.pointages_btp.push(ouvert)
    etat.tablesAbsentes.add('pointage_lignes_appareil_btp')
    expect((await envoyer({ action: 'appareil', plateforme: 'android' })).status).toBe(201)
    expect(etat.tables.pointage_evenements_btp).toHaveLength(1)
    expect(etat.tables.pointage_lignes_appareil_btp ?? []).toEqual([])
  })

  it('activation pendant un pointage commencé à la main : rien de confié (il se termine à la main)', async () => {
    etat.tables.pointages_btp.push({ id: randomUUID(), owner_id: SOC_A, membre_id: M_PAUL, chantier_id: C_VILLA, date: '2026-11-16', heure_arrivee: '08:20:00', heure_depart: null, mode: 'manuel', created_at: new Date(MAINTENANT - 10 * 60_000).toISOString() })
    expect((await envoyer({ action: 'appareil', plateforme: 'android' })).status).toBe(201)
    expect(etat.tables.pointage_lignes_appareil_btp ?? []).toEqual([])
    expect(etat.tables.pointage_evenements_btp ?? []).toEqual([])
  })

  it('seconde activation du même compte passée entre le retrait et l’enregistrement : 409, un seul téléphone actif', async () => {
    etat.courseAppareil = { id: randomUUID(), owner_id: SOC_A, membre_id: M_PAUL, user_id: U_PAUL, empreinte: 'f'.repeat(64), plateforme: 'ios', retire_le: null }
    expect(await envoyer({ action: 'appareil', plateforme: 'android' })).toEqual({ status: 409, json: { error: 'activation_en_cours' } })
    expect(etat.tables.pointage_appareils_btp.filter(a => a.retire_le == null)).toHaveLength(1)
  })

  it('plateforme inconnue : 400', async () => {
    expect((await envoyer({ action: 'appareil', plateforme: 'windows' })).status).toBe(400)
  })

  it('retirer : ce téléphone, même sans fiche reliée ; GET donne le téléphone qui pointe et si la table existe', async () => {
    expect((await lire()).json).toMatchObject({ appareilArrierePlan: null, arrierePlanDisponible: true })
    const { json } = await envoyer({ action: 'appareil', plateforme: 'android' })
    expect((await lire()).json.appareilArrierePlan).toBe(json.appareil)
    expect(await envoyer({ action: 'appareil_retirer', appareil: json.appareil })).toEqual({ status: 200, json: { retires: 1 } })
    expect((await lire()).json.appareilArrierePlan).toBeNull()
    expect(await envoyer({ action: 'appareil_retirer', appareil: json.appareil })).toEqual({ status: 200, json: { retires: 0 } })
    etat.user = OUVRIER_SANS_FICHE
    expect(await envoyer({ action: 'appareil_retirer', appareil: json.appareil })).toEqual({ status: 200, json: { retires: 0 } })
    etat.tablesAbsentes.add('pointage_appareils_btp')
    etat.user = OUVRIER_PAUL
    expect((await lire()).json).toMatchObject({ appareilArrierePlan: null, arrierePlanDisponible: false })
    expect(await envoyer({ action: 'appareil_retirer', appareil: json.appareil })).toEqual({ status: 200, json: { retires: 0 } })
    // Le téléphone à retirer est toujours désigné.
    expect((await envoyer({ action: 'appareil_retirer' })).status).toBe(400)
  })

  it('« Couper » sur un ancien téléphone ne retire jamais celui activé depuis sur le même compte', async () => {
    const ancien = await envoyer({ action: 'appareil', plateforme: 'android' })
    vi.setSystemTime(MAINTENANT + HEURE)
    const nouveau = await envoyer({ action: 'appareil', plateforme: 'ios' })
    expect(await envoyer({ action: 'appareil_retirer', appareil: ancien.json.appareil })).toEqual({ status: 200, json: { retires: 0 } })
    expect((await lire()).json.appareilArrierePlan).toBe(nouveau.json.appareil)
  })

  it('compte sans fiche reliée : GET donne quand même son téléphone (l’appli retire ses zones s’il est retiré)', async () => {
    const { json } = await envoyer({ action: 'appareil', plateforme: 'android' })
    etat.tables.membres_btp = etat.tables.membres_btp.filter(m => m.id !== M_PAUL)
    expect((await lire()).json).toMatchObject({ rattachement: 'aucun', appareilArrierePlan: json.appareil, arrierePlanIncertain: false })
  })

  it('réglage ou téléphones illisibles (panne passagère) : GET le dit, l’appli ne retire rien sur cette foi', async () => {
    expect((await lire()).json.arrierePlanIncertain).toBe(false)
    etat.tablesAbsentes.add('pointage_appareils_btp')
    // Table absente : réponse sûre (mode indisponible), pas une incertitude.
    expect((await lire()).json).toMatchObject({ arrierePlanDisponible: false, arrierePlanIncertain: false })
    const serveur = await import('@/lib/btp/pointage-serveur')
    const lecture = vi.spyOn(serveur, 'lireDonneesSociete')
    lecture.mockImplementationOnce(async societeId => ({
      societeId, membres: [...etat.tables.membres_btp] as never, chantiersEnCours: [], equipes: [], pointageAutoActive: false, reglageDisponible: true, reglageLu: false,
    }))
    expect((await lire()).json).toMatchObject({ arrierePlanIncertain: true })
    lecture.mockRestore()
  })

  it('le gérant coupe le mode automatique : téléphones de toute la société retirés, jamais ceux d’une autre', async () => {
    const actif = (id: string, owner: string, user: string) => ({ id, owner_id: owner, membre_id: M_PAUL, user_id: user, empreinte: id.repeat(64), plateforme: 'android', retire_le: null })
    etat.tables.pointage_appareils_btp = [actif('a', SOC_A, U_PAUL), actif('b', SOC_A, U_SANS_FICHE), actif('c', SOC_B, U_INACTIF)]
    etat.user = GERANT_A
    expect(await envoyer({ action: 'reglage_auto', actif: false })).toEqual({ status: 200, json: { pointageAutoActive: false } })
    const retire = new Date(MAINTENANT).toISOString()
    expect(etat.tables.pointage_appareils_btp.map(a => [a.id, a.retire_le])).toEqual([['a', retire], ['b', retire], ['c', null]])
    // Activer ne retire rien.
    etat.tables.pointage_appareils_btp = [actif('d', SOC_A, U_PAUL)]
    await envoyer({ action: 'reglage_auto', actif: true, confirmation: true })
    expect(etat.tables.pointage_appareils_btp[0].retire_le).toBeNull()
  })

  it('coupure du mode sans la table des téléphones (migration 20261117 non appliquée) : le réglage passe quand même', async () => {
    etat.user = GERANT_A
    etat.tablesAbsentes.add('pointage_appareils_btp')
    expect(await envoyer({ action: 'reglage_auto', actif: false })).toEqual({ status: 200, json: { pointageAutoActive: false } })
    expect(etat.tables.pointage_reglages_btp[0]).toMatchObject({ owner_id: SOC_A, auto_active: false })
  })

  it('les téléphones d’un autre compte ne sont jamais retirés', async () => {
    const autre = randomUUID()
    etat.tables.pointage_appareils_btp = [{ id: autre, owner_id: SOC_A, membre_id: M_JEAN, user_id: U_INACTIF, empreinte: 'e'.repeat(64), plateforme: 'android', retire_le: null }]
    expect(await envoyer({ action: 'appareil_retirer', appareil: autre })).toEqual({ status: 200, json: { retires: 0 } })
    expect(etat.tables.pointage_appareils_btp[0].retire_le).toBeNull()
  })
})

describe('/api/btp/pointage — ligne d’équipe illisible (signalement du 27/11/2026)', () => {
  // resolveCompanyId avale l'erreur de lecture de pro_team_members et rend le compte lui-même. Le salarié recevait
  // alors 200 « compte non relié à une fiche employé », sur l'écran où s'ouvre son appli, au lieu d'une erreur à
  // réessayer ; et un pointage d'arrivée était refusé pour « fiche absente ».
  /** Paul sous un compte neuf (resolveCompanyId garde 60 s une société lue), avec sa ligne d'équipe active dans A. */
  const paulSousUnCompteNeuf = () => {
    const id = randomUUID()
    etat.user = { ...OUVRIER_PAUL, id }
    etat.tables.pro_team_members.push({ id: randomUUID(), company_id: SOC_A, user_id: id, email: 'paul@a.example', role: 'OUVRIER', is_active: true })
    return id
  }

  it('lecture en panne : GET répond 500 à réessayer, jamais « compte non relié »', async () => {
    paulSousUnCompteNeuf()
    etat.pannes.set('pro_team_members', 2)
    const { status, json } = await lire()
    expect(status).toBe(500)
    expect(json).not.toHaveProperty('rattachement')
  })

  it('lecture en panne : l’arrivée répond 500 (à réessayer), pas « fiche absente », et rien n’est écrit', async () => {
    paulSousUnCompteNeuf()
    etat.pannes.set('pro_team_members', 2)
    const { status, json } = await envoyer({ action: 'arrivee', chantierId: C_VILLA, mode: 'manuel' })
    expect(status).toBe(500)
    expect(json.error).not.toBe('fiche_absente')
    expect(etat.ecritures).toEqual([])
  })

  it('panne passagère : la relecture retrouve la société, l’écran est celui de Paul', async () => {
    paulSousUnCompteNeuf()
    etat.pannes.set('pro_team_members', 1)
    const { status, json } = await lire()
    expect(status).toBe(200)
    expect(json).toMatchObject({ rattachement: 'relie', moi: { id: M_PAUL, nom: 'Paul Exemple' } })
    expect(json.chantiers.map((c: { id: string }) => c.id)).toEqual([C_VILLA, C_GARAGE, C_IMMEUBLE])
  })

  it('lecture en panne : « Couper » retire quand même ce téléphone-là côté serveur', async () => {
    const compte = paulSousUnCompteNeuf()
    const appareil = randomUUID()
    etat.tables.pointage_appareils_btp = [{ id: appareil, owner_id: SOC_A, membre_id: M_PAUL, user_id: compte, empreinte: 'f'.repeat(64), plateforme: 'android', retire_le: null }]
    etat.pannes.set('pro_team_members', 2)
    expect(await envoyer({ action: 'appareil_retirer', appareil })).toEqual({ status: 200, json: { retires: 1 } })
    expect(etat.tables.pointage_appareils_btp[0].retire_le).not.toBeNull()
  })

  it('compte artisan : « Couper » reste refusé (403), comme avant', async () => {
    const id = randomUUID()
    etat.user = { id, email: 'artisan@example.test', app_metadata: { role: 'artisan' } }
    expect((await envoyer({ action: 'appareil_retirer', appareil: randomUUID() })).status).toBe(403)
  })

  it('co-gérant désactivé : « Couper » reste refusé (403), comme avant, avec ou sans panne', async () => {
    etat.user = { ...OUVRIER_INACTIF, app_metadata: { ...OUVRIER_INACTIF.app_metadata, pro_team_role: 'GERANT' } }
    expect((await envoyer({ action: 'appareil_retirer', appareil: randomUUID() })).status).toBe(403)
    etat.pannes.set('pro_team_members', 2)
    expect((await envoyer({ action: 'appareil_retirer', appareil: randomUUID() })).status).toBe(403)
  })

  it('super_admin portant la société d’un autre compte : refusé (403) comme avant, sans relecture qui le ferait gérant', async () => {
    const id = randomUUID()
    etat.user = { id, email: 'admin@exemple.test', app_metadata: { role: 'super_admin', pro_team_role: 'GERANT', company_id: SOC_A } }
    etat.tables.pro_team_members.push({ id: randomUUID(), company_id: SOC_A, user_id: id, email: 'admin@exemple.test', role: 'GERANT', is_active: true })
    expect((await lire()).status).toBe(403)
    expect((await envoyer({ action: 'reglage_auto', actif: false })).status).toBe(403)
    expect((await envoyer({ action: 'appareil_retirer', appareil: randomUUID() })).status).toBe(403)
    expect(etat.ecritures).toEqual([])
  })
})
