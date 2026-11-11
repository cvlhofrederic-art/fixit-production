// tests/api/aj-signalement-elevation.test.ts
//
// Élévation de droits d'un gestionnaire connecté (PR 2, SPEC § 2.4 et § 2.11), partie LECTURE et STATUT (lot 1), puis
// ÉCRITURE (lot 2 : création et modification de copropriété) :
//   - corps avec actif, regenererJeton, attribueeATous, gestionnaireIds, cabinetId, forcerDoublon, confirmerHorsDomaine
//     (ou tout paramètre de la fonction SQL) → 400, sans aucun appel ni écriture ;
//   - p_acteur, p_gestionnaire et p_cabinet viennent de la session (fiche relue), jamais du corps ni du repère ;
//   - ?gestionnaire= et ?cabinet= du tableau : réservés au super admin → 403 interdit (même vers son propre cabinet) ;
//   - routes réservées au super admin (gestionnaires/*, cabinets/*, coproprietes/[id]/gestionnaires, DELETE, import,
//     journal) → 403 interdit, SANS que la fiche du compte soit lue (aucune colonne de la 20261112 nommée) ;
//   - statut sans statutAttendu → 400 avant toute lecture ;
//   - user_metadata.role seul → aucun droit ; rôle sans fiche → 403 acces_retire ; un compte gestionnaire n'est jamais
//     super admin.
// Données fictives (tests/helpers/aj-signalement-acces.ts).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/supabase-server', async () => ({ supabaseAdmin: (await import('../helpers/aj-signalement-base')).baseQr.client }))
vi.mock('@/lib/supabase-server-component', async () => (await import('../helpers/aj-signalement-routes')).mockCookies())
vi.mock('@/lib/auth-helpers', async () => (await import('../helpers/aj-signalement-routes')).mockAuth())
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/aj-signalement-routes')).mockLimites())
vi.mock('@/lib/email', async () => (await import('../helpers/aj-signalement-routes')).mockEmail())
vi.mock('@/lib/logger', async () => (await import('../helpers/aj-signalement-routes')).mockLogger())

const { baseQr } = await import('../helpers/aj-signalement-base')
const { contexteQr, reinitialiserSimulQr, requeteQr, simulQr } = await import('../helpers/aj-signalement-routes')
const A = await import('../helpers/aj-signalement-acces')
const { GET: TABLEAU } = await import('@/app/api/aj-signalement/tableau/route')
const { PATCH: STATUT } = await import('@/app/api/aj-signalement/signalements/[id]/route')
const GESTIONNAIRES = await import('@/app/api/aj-signalement/gestionnaires/route')
const GESTIONNAIRE = await import('@/app/api/aj-signalement/gestionnaires/[id]/route')
const DEPART = await import('@/app/api/aj-signalement/gestionnaires/[id]/depart/route')
const EXPORT = await import('@/app/api/aj-signalement/gestionnaires/[id]/export/route')
const CONFIRMATION = await import('@/app/api/aj-signalement/gestionnaires/[id]/confirmation/route')
const ACCES = await import('@/app/api/aj-signalement/gestionnaires/[id]/acces/route')
const ACCES_GROUPE = await import('@/app/api/aj-signalement/gestionnaires/acces/route')
const COPROS_GESTIONNAIRE = await import('@/app/api/aj-signalement/gestionnaires/[id]/coproprietes/route')
const COPROS = await import('@/app/api/aj-signalement/coproprietes/route')
const COPRO = await import('@/app/api/aj-signalement/coproprietes/[id]/route')
const COPRO_GESTIONNAIRES = await import('@/app/api/aj-signalement/coproprietes/[id]/gestionnaires/route')
const IMPORT = await import('@/app/api/aj-signalement/coproprietes/import/route')
const JOURNAL = await import('@/app/api/aj-signalement/journal/route')
const CABINETS = await import('@/app/api/aj-signalement/cabinets/route')
const CABINET = await import('@/app/api/aj-signalement/cabinets/[id]/route')
const RATTACHEMENT = await import('@/app/api/aj-signalement/cabinets/[id]/rattachement/route')
const { reinitialiserReplisQr } = await import('@/lib/aj-signalement/serveur')

type Route = (request: NextRequest, contexte: { params: Promise<{ id: string }> }) => Promise<Response>
const appeler = (route: unknown, chemin: string, methode: string, id: string, corps?: unknown) =>
  (route as Route)(requeteQr(chemin, methode, corps), contexteQr(id))

beforeEach(() => {
  reinitialiserSimulQr()
  reinitialiserReplisQr()
  baseQr.reinitialiser()
  A.poserJeuAccesQr()
  A.connecterQr(A.COMPTE_G1)
})

/** La fiche du compte a-t-elle été relue (lecture par user_id) ? */
const ficheDuCompteLue = () => baseQr.etat.lectures.some((l) => l.table === 'signalements_qr_gestionnaires' && l.filtres.some((f) => f.startsWith('user_id=')))

describe('paramètres du tableau réservés au super admin', () => {
  it.each([
    ['?gestionnaire= d’un collègue', `?gestionnaire=${A.G2}`],
    ['?gestionnaire= de lui-même', `?gestionnaire=${A.G1}`],
    ['?cabinet= de son cabinet', `?cabinet=${A.CAB}`],
    ['?cabinet= d’un autre cabinet', `?cabinet=${A.CAB_AUTRE}`],
  ])('%s : 403 interdit, aucun signalement lu', async (_cas, query) => {
    const res = await TABLEAU(requeteQr(`/api/aj-signalement/tableau${query}`))
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'interdit' })
    expect(baseQr.etat.lectures.filter((l) => l.table === 'signalements_qr')).toEqual([])
  })

  it('paramètre inconnu : 400 comme pour le super admin', async () => {
    expect((await TABLEAU(requeteQr('/api/aj-signalement/tableau?vue_en_tant_que=1'))).status).toBe(400)
  })
})

describe('routes réservées au super admin : 403 interdit pour un gestionnaire, sans lire sa fiche', () => {
  const G = A.G2
  const C = A.C1
  const ROUTES: Array<[string, unknown, string, string, string, unknown?]> = [
    ['GET gestionnaires', GESTIONNAIRES.GET, '/api/aj-signalement/gestionnaires', 'GET', ''],
    ['POST gestionnaires', GESTIONNAIRES.POST, '/api/aj-signalement/gestionnaires', 'POST', '', { nom: 'Nouveau', email: 'nouveau@exemple.test', cabinetId: A.CAB }],
    ['GET gestionnaires/[id]', GESTIONNAIRE.GET, `/api/aj-signalement/gestionnaires/${G}`, 'GET', G],
    ['PATCH gestionnaires/[id]', GESTIONNAIRE.PATCH, `/api/aj-signalement/gestionnaires/${G}`, 'PATCH', G, { actif: true }],
    ['POST gestionnaires/[id]/depart', DEPART.POST, `/api/aj-signalement/gestionnaires/${G}/depart`, 'POST', G, { successions: [] }],
    ['GET gestionnaires/[id]/export', EXPORT.GET, `/api/aj-signalement/gestionnaires/${G}/export`, 'GET', G],
    ['POST gestionnaires/[id]/confirmation', CONFIRMATION.POST, `/api/aj-signalement/gestionnaires/${G}/confirmation`, 'POST', G, {}],
    // Lot 3 : ouverture des accès (envoi d'une fiche, envoi groupé), jamais par un gestionnaire, même pour lui-même.
    ['POST gestionnaires/[id]/acces', ACCES.POST, `/api/aj-signalement/gestionnaires/${G}/acces`, 'POST', G],
    ['POST gestionnaires/[id]/acces (sa propre fiche)', ACCES.POST, `/api/aj-signalement/gestionnaires/${A.G1}/acces`, 'POST', A.G1],
    ['POST gestionnaires/acces', ACCES_GROUPE.POST, '/api/aj-signalement/gestionnaires/acces', 'POST', '', { gestionnaireIds: [A.G1, G] }],
    ['PUT gestionnaires/[id]/coproprietes', COPROS_GESTIONNAIRE.PUT, `/api/aj-signalement/gestionnaires/${G}/coproprietes`, 'PUT', G, { coproprieteIds: [C] }],
    ['DELETE coproprietes/[id]', COPRO.DELETE, `/api/aj-signalement/coproprietes/${C}`, 'DELETE', C],
    ['PUT coproprietes/[id]/gestionnaires', COPRO_GESTIONNAIRES.PUT, `/api/aj-signalement/coproprietes/${C}/gestionnaires`, 'PUT', C, { gestionnaireIds: [A.G1] }],
    ['POST coproprietes/import', IMPORT.POST, '/api/aj-signalement/coproprietes/import', 'POST', '', { mode: 'verification', lignes: [] }],
    ['GET journal', JOURNAL.GET, '/api/aj-signalement/journal', 'GET', ''],
    ['GET cabinets', CABINETS.GET, '/api/aj-signalement/cabinets', 'GET', ''],
    ['POST cabinets', CABINETS.POST, '/api/aj-signalement/cabinets', 'POST', '', { nom: 'Cabinet', identifiant: 'cabinet-nouveau', langue: 'fr', domaines: [] }],
    ['PATCH cabinets/[id]', CABINET.PATCH, `/api/aj-signalement/cabinets/${A.CAB}`, 'PATCH', A.CAB, { nom: 'Autre nom' }],
    ['POST cabinets/[id]/rattachement', RATTACHEMENT.POST, `/api/aj-signalement/cabinets/${A.CAB}/rattachement`, 'POST', A.CAB, { coproprieteIds: [A.C_SANS] }],
  ]

  it.each(ROUTES)('%s', async (_nom, route, chemin, methode, id, corps) => {
    const res = await appeler(route, chemin, methode, id, corps)
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'interdit' })
    expect(ficheDuCompteLue()).toBe(false)
    expect(baseQr.etat.ecritures).toEqual([])
    expect(baseQr.etat.appelsRpc).toEqual([])
  })
})

describe('statut : statutAttendu exigé d’un gestionnaire', () => {
  it('sans statutAttendu : 400 avant toute lecture du signalement', async () => {
    const res = await STATUT(requeteQr(`/api/aj-signalement/signalements/${A.S1}`, 'PATCH', { statut: 'en_cours' }), contexteQr(A.S1))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('invalide')
    expect(baseQr.etat.lectures.filter((l) => l.table === 'signalements_qr')).toEqual([])
    expect(baseQr.etat.ecritures).toEqual([])
  })

  it('champ inconnu (copropriété, profil, auteur) : 400 (schéma strict)', async () => {
    for (const intrus of [{ coproprieteId: A.C1 }, { statut_modifie_profil: 'super_admin' }, { statutModifiePar: A.U2 }]) {
      const res = await STATUT(requeteQr(`/api/aj-signalement/signalements/${A.S1}`, 'PATCH', { statut: 'en_cours', statutAttendu: 'en_attente', ...intrus }), contexteQr(A.S1))
      expect(res.status).toBe(400)
    }
    expect(baseQr.etat.ecritures).toEqual([])
  })

  it('le super admin peut toujours l’omettre (écran actuel)', async () => {
    reinitialiserSimulQr()
    const res = await STATUT(requeteQr(`/api/aj-signalement/signalements/${A.S1}`, 'PATCH', { statut: 'en_cours' }), contexteQr(A.S1))
    expect(res.status).toBe(200)
  })
})

describe('écritures d’une copropriété : le corps ne donne aucun droit d’administration (RG-20, RG-21)', () => {
  const SAISIE = { operationId: 'f0000000-0000-4000-8000-000000000001', nom: 'Résidence Neuve', adresse: '8 avenue Neuve', codePostal: '13002', ville: 'Marseille' }
  const INTRUS: Array<[string, Record<string, unknown>]> = [
    ['actif', { actif: false }],
    ['regenererJeton', { regenererJeton: true }],
    ['attribueeATous', { attribueeATous: true }],
    ['gestionnaireIds', { gestionnaireIds: [A.G2] }],
    ['cabinetId', { cabinetId: A.CAB_AUTRE }],
    ['forcerDoublon', { forcerDoublon: true }],
    ['confirmerHorsDomaine', { confirmerHorsDomaine: true }],
    ['p_cabinet', { p_cabinet: A.CAB_AUTRE }],
    ['p_gestionnaire', { p_gestionnaire: A.G2 }],
    ['p_acteur', { p_acteur: A.U2 }],
    ['p_profil', { p_profil: 'super_admin' }],
  ]
  const creer = (corps: unknown) => COPROS.POST(requeteQr('/api/aj-signalement/coproprietes', 'POST', corps))

  it.each(INTRUS)('POST avec %s : 400, aucun appel, rien écrit', async (_cle, intrus) => {
    const res = await creer({ ...SAISIE, ...intrus })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('invalide')
    expect(baseQr.etat.appelsRpc).toEqual([])
    expect(baseQr.etat.ecritures).toEqual([])
  })

  it.each(INTRUS)('PATCH de SA copropriété avec %s : 400, rien écrit', async (_cle, intrus) => {
    const res = await appeler(COPRO.PATCH, `/api/aj-signalement/coproprietes/${A.C1}`, 'PATCH', A.C1, { ville: 'Aubagne', ...intrus })
    expect(res.status).toBe(400)
    expect(baseQr.etat.ecritures).toEqual([])
    expect(baseQr.etat.appelsRpc).toEqual([])
  })

  it('p_acteur, p_gestionnaire et p_cabinet viennent de la session : un repère d’un autre cabinet est sans effet', async () => {
    A.simulerCreationCoproprietesQr()
    simulQr.user = { ...A.COMPTE_G1, app_metadata: { role: 'gestionnaire_signalement', aj_signalement_cabinet: 'autre-cabinet' } }
    const res = await creer(SAISIE)
    expect(res.status).toBe(201)
    const appel = baseQr.etat.appelsRpc.find((a) => a.nom === 'signalements_qr_creer_coproprietes')
    expect(appel?.args).toMatchObject({ p_acteur: A.U1, p_profil: 'gestionnaire', p_gestionnaire: A.G1, p_cabinet: A.CAB })
  })

  it('« à tous » non modifiable : 403 lecture_seule, même pour un champ anodin', async () => {
    const res = await appeler(COPRO.PATCH, `/api/aj-signalement/coproprietes/${A.C_TOUS}`, 'PATCH', A.C_TOUS, { ville: 'Aubagne' })
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'lecture_seule' })
  })
})

describe('rôle et fiche', () => {
  it('user_metadata.role = gestionnaire_signalement sans app_metadata : 403 interdit, aucune lecture de fiche', async () => {
    simulQr.user = { id: A.U1, email: A.EMAIL_G1, app_metadata: {}, user_metadata: { role: 'gestionnaire_signalement' } } as never
    const res = await TABLEAU(requeteQr('/api/aj-signalement/tableau'))
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'interdit' })
    expect(ficheDuCompteLue()).toBe(false)
  })

  it('app_metadata.role sans fiche reliée : 403 acces_retire', async () => {
    simulQr.user = { id: '0b000000-0000-4000-8000-0000000000ff', email: 'inconnu@exemple.test', app_metadata: { role: 'gestionnaire_signalement' } }
    const res = await TABLEAU(requeteQr('/api/aj-signalement/tableau'))
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'acces_retire' })
  })

  it('repère de routage d’un autre cabinet dans app_metadata : sans effet, la portée vient de la fiche', async () => {
    simulQr.user = { ...A.COMPTE_G1, app_metadata: { role: 'gestionnaire_signalement', aj_signalement_cabinet: 'autre-cabinet' } }
    const corps = await (await TABLEAU(requeteQr('/api/aj-signalement/tableau'))).json()
    expect(corps.tableau.coproprietes.map((c: { id: string }) => c.id)).toEqual([A.C1, A.C_TOUS])
  })

  it('compte gestionnaire dont l’adresse serait celle de l’administrateur : jamais super admin', async () => {
    simulQr.user = { ...A.COMPTE_G1, email: 'admin@exemple.test' }
    const res = await GESTIONNAIRES.GET(requeteQr('/api/aj-signalement/gestionnaires'))
    expect(res.status).toBe(403)
  })
})
