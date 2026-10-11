// tests/api/administrateur-judiciaire-ordres-prestataire.test.ts
//
// /api/administrateur-judiciaire/ordres-prestataire — boucle prestataire de l'Administrateur judiciaire :
//   - POST envoyer : prestataire lu dans le cabinet (404 sinon), compte Vitfix requis (422), mission
//     syndic_missions sans signalement (demandeur_role 'administrateur_judiciaire'), livraison avec origine et
//     numéro de l'ordre de service, mission retirée si l'ordre n'est pas livré ;
//   - GET : seulement les ordres de l'Administrateur judiciaire du cabinet, statut lu dans l'ordre de mission,
//     fil limité à l'ordre (documents du prestataire compris), réponse non mise en cache ;
//   - POST repondre : mission et conversation du cabinet seulement, message côté donneur d'ordre.
// Authentification par cookie (rôle syndic ou super admin, auth-helpers réel) ; Supabase en mémoire.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { appelsDe, clientMemoire, nouvelleBase, type BaseMemoire } from './syndic-supabase-memoire'

const CAB = '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4'
const AUTRE_CAB = '11111111-2222-4333-8444-555555555555'
const ART = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff'
const ART_SANS_COMPTE = 'bbbbbbbb-cccc-4ddd-8eee-000000000000'
const ART_AUTRE_CAB = 'bbbbbbbb-cccc-4ddd-8eee-111111111111'
const MISSION_AJ = 'dddddddd-0000-4000-8000-000000000001'
const MISSION_AJ_2 = 'dddddddd-0000-4000-8000-000000000002'
const MISSION_V54 = 'dddddddd-0000-4000-8000-000000000003'
const MISSION_AUTRE_CAB = 'dddddddd-0000-4000-8000-000000000004'
const CONV = 'eeeeeeee-0000-4000-8000-000000000001'

const h = vi.hoisted(() => ({
  base: null as unknown as BaseMemoire,
  utilisateur: null as Record<string, unknown> | null,
  livrer: vi.fn(),
}))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => true),
  getClientIP: vi.fn(() => '127.0.0.1'),
  rateLimitResponse: vi.fn(() => Response.json({ error: 'rate' }, { status: 429 })),
}))
vi.mock('@/lib/supabase-server-component', () => ({
  createServerSupabaseClient: vi.fn(async () => ({ auth: { getUser: async () => ({ data: { user: h.utilisateur } }) } })),
}))
vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin: { from: (t: string) => clientMemoire(h.base).from(t) } }))
vi.mock('@/lib/syndic/livraison-mission', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/syndic/livraison-mission')>()),
  livrerMission: h.livrer,
}))

const { GET, POST } = await import('@/app/api/administrateur-judiciaire/ordres-prestataire/route')

const URL_ROUTE = 'https://vitfix.io/api/administrateur-judiciaire/ordres-prestataire'
const poster = (body: unknown) =>
  POST(new NextRequest(URL_ROUTE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }))
const lire = () => GET(new NextRequest(URL_ROUTE))

const superAdmin = () => ({ id: CAB, email: 'frederic@example.fr', app_metadata: { role: 'super_admin' }, user_metadata: { full_name: 'Frédéric' } })

const ENVOI = {
  action: 'envoyer',
  syndic_artisan_id: ART,
  copropriete: 'Le Clos des Vignes',
  objet: 'Fuite sur colonne EU — appartement du 4e étage',
  localisation: 'Lot 27',
  urgence: 'urgence',
  date_intervention: '2026-10-13',
  note: 'Clé chez la gardienne',
  reference_aj: 'OS-2026-051',
}

beforeEach(() => {
  h.base = nouvelleBase()
  h.utilisateur = superAdmin()
  h.livrer.mockReset()
  h.livrer.mockResolvedValue({ bookingId: null, conversationId: CONV, messageId: 'msg-1', ordreEnvoye: true, notificationEnvoyee: true })
  h.base.lignes.syndic_artisans = [
    { id: ART, cabinet_id: CAB, artisan_user_id: CAB, nom: 'Frédéric Multiservice', metier: 'Multiservice' },
    { id: ART_SANS_COMPTE, cabinet_id: CAB, artisan_user_id: null, nom: 'Atelier Ménard', metier: 'Peintre' },
    { id: ART_AUTRE_CAB, cabinet_id: AUTRE_CAB, artisan_user_id: 'cccccccc-0000-4000-8000-000000000000', nom: 'Autre artisan' },
  ]
  h.base.lignes.syndic_cabinets = [{ id: CAB, nom: 'Cabinet VitFix' }]
})

afterEach(() => {
  vi.useRealTimers()
})

describe('authentification et validation', () => {
  it('401 sans session, et en vue prestataire (rôle artisan impersonné) : aucune lecture', async () => {
    h.utilisateur = null
    expect((await lire()).status).toBe(401)
    h.utilisateur = { id: CAB, app_metadata: { role: 'artisan', _original_role: 'super_admin' } }
    expect((await lire()).status).toBe(401)
    expect((await poster(ENVOI)).status).toBe(401)
    expect(h.base.appels).toHaveLength(0)
  })

  it('400 sur un corps invalide (Zod) : action, urgence, objet, date', async () => {
    for (const corps of [
      { ...ENVOI, action: 'supprimer' },
      { ...ENVOI, urgence: 'Urgence' },
      { ...ENVOI, objet: '  ' },
      { ...ENVOI, date_intervention: '13/10/2026' },
      { ...ENVOI, syndic_artisan_id: 'pas-un-id' },
      { action: 'repondre', mission_id: MISSION_AJ, content: '' },
    ]) {
      const res = await poster(corps)
      expect(res.status).toBe(400)
      expect(await res.json()).toMatchObject({ error: 'requete_invalide' })
    }
    expect(appelsDe(h.base, 'syndic_missions')).toHaveLength(0)
  })
})

describe('POST envoyer', () => {
  it("404 pour un prestataire d'un autre cabinet (lecture filtrée sur le cabinet), jamais livré", async () => {
    const res = await poster({ ...ENVOI, syndic_artisan_id: ART_AUTRE_CAB })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'prestataire_introuvable' })
    expect(appelsDe(h.base, 'syndic_artisans', 'select')[0].eq).toContainEqual(['cabinet_id', CAB])
    expect(appelsDe(h.base, 'syndic_missions')).toHaveLength(0)
    expect(h.livrer).not.toHaveBeenCalled()
  })

  it('422 prestataire_sans_compte : ni mission, ni livraison', async () => {
    const res = await poster({ ...ENVOI, syndic_artisan_id: ART_SANS_COMPTE })
    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ error: 'prestataire_sans_compte' })
    expect(appelsDe(h.base, 'syndic_missions')).toHaveLength(0)
    expect(h.livrer).not.toHaveBeenCalled()
  })

  it('crée la mission sans signalement et livre au compte du prestataire, avec origine et numéro', async () => {
    const res = await poster(ENVOI)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ mission_id: 'syndic_missions-nouveau', conversation_id: CONV, notification: true })

    const [mission] = appelsDe(h.base, 'syndic_missions', 'insert')
    expect(mission.donnees).toMatchObject({
      cabinet_id: CAB,
      signalement_id: null,
      immeuble: 'Le Clos des Vignes',
      artisan: 'Frédéric Multiservice',
      type: ENVOI.objet,
      description: ENVOI.objet,
      priorite: 'urgente',
      statut: 'en_attente',
      date_intervention: '2026-10-13',
      demandeur_role: 'administrateur_judiciaire',
      demandeur_nom: 'Frédéric',
      zone_signalee: 'Lot 27',
    })

    expect(h.livrer).toHaveBeenCalledTimes(1)
    const livraison = h.livrer.mock.calls[0][1] as Record<string, unknown>
    expect(livraison).toMatchObject({
      artisanUserId: CAB, // artisan_user_id de la fiche du cabinet
      cabinetId: CAB,
      contactId: CAB,
      contactName: 'Cabinet VitFix',
      senderId: CAB,
      titre: ENVOI.objet,
      adresse: 'Le Clos des Vignes — Lot 27',
      dateIntervention: '2026-10-13',
      urgence: 'urgente',
      references: { syndic_mission_id: 'syndic_missions-nouveau' },
      marque: { origine: 'administrateur_judiciaire', reference_aj: 'OS-2026-051' },
    })
    expect(livraison.references).not.toHaveProperty('signalement_id')
    expect(String(livraison.description)).toContain("Note de l'administrateur judiciaire : Clé chez la gardienne")
    expect(String(livraison.description)).toContain('Ordre de service OS-2026-051 — administrateur judiciaire')
  })

  it('« Prioritaire » : mission normale (CHECK) et ordre « haute » ; date par défaut = jour réel du serveur', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-12T08:30:00Z'))
    expect((await poster({ ...ENVOI, urgence: 'prioritaire', date_intervention: '', reference_aj: '' })).status).toBe(200)
    expect(appelsDe(h.base, 'syndic_missions', 'insert')[0].donnees).toMatchObject({ priorite: 'normale', date_intervention: '2026-10-12' })
    const livraison = h.livrer.mock.calls[0][1] as Record<string, unknown>
    expect(livraison).toMatchObject({ urgence: 'haute', dateIntervention: '2026-10-12', marque: { origine: 'administrateur_judiciaire' } })
    expect(livraison.marque).not.toHaveProperty('reference_aj')
  })

  it('ordre non livré : mission retirée (dans le cabinet), 500 livraison_impossible', async () => {
    h.livrer.mockResolvedValue({ bookingId: 'booking-1', conversationId: null, messageId: null, ordreEnvoye: false, notificationEnvoyee: false })
    const res = await poster(ENVOI)
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'livraison_impossible' })
    const [suppression] = appelsDe(h.base, 'syndic_missions', 'delete')
    expect(suppression.eq).toEqual(expect.arrayContaining([['id', 'syndic_missions-nouveau'], ['cabinet_id', CAB]]))
    expect(appelsDe(h.base, 'bookings', 'update')[0].donnees).toEqual({ status: 'cancelled', statut: 'annule' })
  })

  it('mission impossible à créer : 500 sans livraison', async () => {
    h.base.erreurs['syndic_missions.insert'] = { message: 'check violation' }
    expect((await poster(ENVOI)).status).toBe(500)
    expect(h.livrer).not.toHaveBeenCalled()
  })
})

/** Conversation partagée (Syndic v54 + Administrateur judiciaire) entre le cabinet et son prestataire (même compte). */
function poserConversation() {
  h.base.lignes.syndic_missions = [
    { id: MISSION_AJ, cabinet_id: CAB, demandeur_role: 'administrateur_judiciaire', immeuble: 'Le Clos des Vignes', artisan: 'Frédéric Multiservice', type: 'Fuite', statut: 'acceptee', zone_signalee: 'Lot 27', date_intervention: '2026-10-13', created_at: '2026-10-12T09:00:00Z' },
    { id: MISSION_AJ_2, cabinet_id: CAB, demandeur_role: 'administrateur_judiciaire', immeuble: 'Villa Montaigne', artisan: 'Frédéric Multiservice', type: 'Élagage', statut: 'annulee', created_at: '2026-10-12T11:00:00Z' },
    { id: MISSION_V54, cabinet_id: CAB, demandeur_role: 'coproprio', immeuble: 'Le Prado', artisan: 'Frédéric Multiservice', type: 'Plomberie', statut: 'en_attente', created_at: '2026-10-12T10:00:00Z' },
    { id: MISSION_AUTRE_CAB, cabinet_id: AUTRE_CAB, demandeur_role: 'administrateur_judiciaire', immeuble: 'Ailleurs', created_at: '2026-10-12T09:00:00Z' },
  ]
  h.base.lignes.conversations = [
    { id: CONV, artisan_id: CAB, contact_id: CAB, contact_type: 'pro', contact_name: 'Cabinet VitFix', unread_count: 0 },
    { id: 'conv-autre-cab', artisan_id: CAB, contact_id: AUTRE_CAB, contact_type: 'pro' },
  ]
  const msg = (id: string, created_at: string, type: string, extra: Record<string, unknown> = {}) =>
    ({ id, conversation_id: CONV, sender_id: CAB, type, content: id, created_at, metadata: {}, ordre_mission: null, ...extra })
  h.base.lignes.conversation_messages = [
    msg('ancien', '2026-10-11T08:00:00Z', 'text', { metadata: { cote: 'artisan' } }),
    msg('ordre-aj', '2026-10-12T09:00:01Z', 'ordre_mission', {
      metadata: { cote: 'donneur_ordre', syndic_mission_id: MISSION_AJ, origine: 'administrateur_judiciaire', reference_aj: 'OS-2026-051' },
      ordre_mission: { titre: 'Fuite sur colonne EU', adresse: 'Le Clos des Vignes — Lot 27', date_souhaitee: '2026-10-13', urgence: 'urgente', statut: 'en_cours', arrival_time: '09:30', syndic_mission_id: MISSION_AJ, origine: 'administrateur_judiciaire', reference_aj: 'OS-2026-051' },
    }),
    msg('accepte', '2026-10-12T09:05:00Z', 'system', { metadata: { cote: 'artisan', ordre_message_id: 'ordre-aj', statut: 'accepte' } }),
    msg('devis', '2026-10-12T09:10:00Z', 'text', { metadata: { cote: 'artisan', document: { type: 'devis', reference: 'DV-12', montant_ttc: 480, description: 'Remplacement colonne', date: '2026-10-12' } } }),
    msg('reponse-aj', '2026-10-12T09:12:00Z', 'text', { metadata: { cote: 'donneur_ordre', syndic_mission_id: MISSION_AJ } }),
    msg('ordre-v54', '2026-10-12T10:00:01Z', 'ordre_mission', {
      metadata: { cote: 'donneur_ordre', signalement_id: 'sig-1', syndic_mission_id: MISSION_V54 },
      ordre_mission: { titre: 'Plomberie', statut: 'en_attente', signalement_id: 'sig-1', syndic_mission_id: MISSION_V54 },
    }),
    msg('apres-v54', '2026-10-12T10:05:00Z', 'text', { metadata: { cote: 'artisan' } }),
    msg('demarre', '2026-10-12T10:10:00Z', 'system', { metadata: { cote: 'artisan', ordre_message_id: 'ordre-aj', statut: 'en_cours' } }),
    msg('reponse-autre-mission', '2026-10-12T10:11:00Z', 'text', { metadata: { cote: 'donneur_ordre', syndic_mission_id: MISSION_V54 } }),
  ]
}

describe('GET — suivi des ordres de l’Administrateur judiciaire', () => {
  it('prestataires du cabinet (avec compte d’abord) et seulement les ordres AJ du cabinet', async () => {
    poserConversation()
    const res = await lire()
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    const corps = await res.json()

    expect(corps.prestataires).toEqual([
      { id: ART, nom: 'Frédéric Multiservice', metier: 'Multiservice', compte: true },
      { id: ART_SANS_COMPTE, nom: 'Atelier Ménard', metier: 'Peintre', compte: false },
    ])
    const lectureMissions = appelsDe(h.base, 'syndic_missions', 'select')[0]
    expect(lectureMissions.eq).toEqual(expect.arrayContaining([['cabinet_id', CAB], ['demandeur_role', 'administrateur_judiciaire']]))
    expect(corps.ordres.map((o: { missionId: string }) => o.missionId).sort()).toEqual([MISSION_AJ, MISSION_AJ_2])
    // Conversations lues dans le cabinet seulement.
    expect(appelsDe(h.base, 'conversations', 'select')[0].eq).toEqual(expect.arrayContaining([['contact_id', CAB], ['contact_type', 'pro']]))
  })

  it('statut lu dans l’ordre de mission, fil limité à l’ordre, documents du prestataire', async () => {
    poserConversation()
    const { ordres } = await (await lire()).json()
    const ordre = ordres.find((o: { missionId: string }) => o.missionId === MISSION_AJ)
    expect(ordre).toMatchObject({
      conversationId: CONV,
      messageId: 'ordre-aj',
      referenceAj: 'OS-2026-051',
      titre: 'Fuite sur colonne EU',
      copropriete: 'Le Clos des Vignes',
      localisation: 'Lot 27',
      prestataire: { nom: 'Frédéric Multiservice', metier: 'Multiservice' },
      urgence: 'urgente',
      dateIntervention: '2026-10-13',
      statut: 'en_cours',
      heureArrivee: '09:30',
    })
    expect(ordre.messages.map((m: { id: string }) => m.id)).toEqual(['accepte', 'devis', 'reponse-aj', 'demarre'])
    const devis = ordre.messages.find((m: { id: string }) => m.id === 'devis')
    expect(devis).toMatchObject({ cote: 'artisan', document: { type: 'devis', reference: 'DV-12', montant_ttc: 480 } })
    expect(ordre.messages.find((m: { id: string }) => m.id === 'reponse-aj').cote).toBe('donneur_ordre')
  })

  it('ordre introuvable dans les conversations : statut de la mission, fil vide', async () => {
    poserConversation()
    const { ordres } = await (await lire()).json()
    expect(ordres.find((o: { missionId: string }) => o.missionId === MISSION_AJ_2)).toMatchObject({
      conversationId: null, statut: 'refuse', titre: 'Élagage', copropriete: 'Villa Montaigne', messages: [],
    })
  })

  it('aucun ordre AJ : liste vide sans lire les conversations', async () => {
    const res = await lire()
    expect(await res.json()).toMatchObject({ ordres: [] })
    expect(appelsDe(h.base, 'conversations')).toHaveLength(0)
  })

  it('lecture des missions en erreur : 500 sans détail interne', async () => {
    h.base.erreurs['syndic_missions.select'] = { message: 'relation inconnue' }
    const res = await lire()
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toContain('relation')
  })
})

describe('POST repondre', () => {
  it('message côté donneur d’ordre rattaché à la mission, non-lu compté (même compte), notification', async () => {
    poserConversation()
    h.base.inserts.conversation_messages = { id: 'msg-reponse', conversation_id: CONV, sender_id: CAB, type: 'text', content: 'Merci, accès par le parking', metadata: { cote: 'donneur_ordre', syndic_mission_id: MISSION_AJ }, created_at: '2026-10-12T10:20:00Z' }
    const res = await poster({ action: 'repondre', mission_id: MISSION_AJ, content: 'Merci, accès par le parking' })
    expect(res.status).toBe(200)
    expect((await res.json()).message).toMatchObject({ id: 'msg-reponse', cote: 'donneur_ordre', contenu: 'Merci, accès par le parking' })

    const lectureMission = appelsDe(h.base, 'syndic_missions', 'select')[0]
    expect(lectureMission.eq).toEqual(expect.arrayContaining([['id', MISSION_AJ], ['cabinet_id', CAB], ['demandeur_role', 'administrateur_judiciaire']]))
    const [insertion] = appelsDe(h.base, 'conversation_messages', 'insert')
    expect(insertion.donnees).toEqual({
      conversation_id: CONV,
      sender_id: CAB,
      type: 'text',
      content: 'Merci, accès par le parking',
      metadata: { cote: 'donneur_ordre', syndic_mission_id: MISSION_AJ, origine: 'administrateur_judiciaire' },
    })
    expect(appelsDe(h.base, 'conversations', 'update').map((a) => a.donnees)).toContainEqual({ unread_count: 1 })
    expect(appelsDe(h.base, 'artisan_notifications', 'insert')[0].donnees).toMatchObject({ artisan_id: CAB, type: 'message' })
  })

  it("mission d'un autre cabinet ou du Syndic v54 : 404, rien n'est écrit", async () => {
    poserConversation()
    for (const mission_id of [MISSION_AUTRE_CAB, MISSION_V54]) {
      const res = await poster({ action: 'repondre', mission_id, content: 'Bonjour' })
      expect(res.status).toBe(404)
      expect(await res.json()).toEqual({ error: 'ordre_introuvable' })
    }
    expect(h.base.appels.filter((a) => a.op !== 'select')).toHaveLength(0)
  })

  it("prestataire de la conversation absent des fiches du cabinet : 404, rien n'est écrit", async () => {
    poserConversation()
    h.base.lignes.syndic_artisans = h.base.lignes.syndic_artisans.filter((f) => f.id !== ART)
    const res = await poster({ action: 'repondre', mission_id: MISSION_AJ, content: 'Bonjour' })
    expect(res.status).toBe(404)
    expect(appelsDe(h.base, 'conversation_messages', 'insert')).toHaveLength(0)
  })
})
