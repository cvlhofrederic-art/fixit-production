// tests/api/syndic-demandes-valider.test.ts
//
// POST /api/syndic/demandes/valider — « Valider la mission » du Canal de communication v54 :
// le signalement et le prestataire doivent appartenir au cabinet de l'utilisateur, le prestataire doit
// avoir un compte Vitfix (artisan_user_id), puis mission syndic + livraison au compte du prestataire
// + signalement « acceptee » avec un message dans le fil du copropriétaire.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { appelsDe, clientMemoire, nouvelleBase, type BaseMemoire } from './syndic-supabase-memoire'

const CAB = '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4'
const AUTRE_CAB = '11111111-2222-4333-8444-555555555555'
const SIG = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const SIG_AUTRE = 'aaaaaaaa-bbbb-4ccc-8ddd-ffffffffffff'
const ART = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff'
const ART_SANS_COMPTE = 'bbbbbbbb-cccc-4ddd-8eee-000000000000'
const ART_AUTRE_CAB = 'bbbbbbbb-cccc-4ddd-8eee-111111111111'

const h = vi.hoisted(() => ({
  base: null as unknown as BaseMemoire,
  syndic: true,
  livrer: vi.fn(),
}))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => true),
  getClientIP: vi.fn(() => '127.0.0.1'),
  rateLimitResponse: vi.fn(() => Response.json({ error: 'rate' }, { status: 429 })),
}))
vi.mock('@/lib/auth-helpers', () => ({
  getAuthUser: vi.fn(async () => ({ id: CAB, email: 'frederic@example.fr', app_metadata: { role: 'super_admin' }, user_metadata: { full_name: 'Frédéric' } })),
  isSyndicRole: vi.fn(() => h.syndic),
  resolveCabinetId: vi.fn(async () => CAB),
}))
vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin: { from: (t: string) => clientMemoire(h.base).from(t) } }))
vi.mock('@/lib/syndic/livraison-mission', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/syndic/livraison-mission')>()),
  livrerMission: h.livrer,
}))

const { POST } = await import('@/app/api/syndic/demandes/valider/route')

const appeler = (body: unknown) =>
  POST(new NextRequest('https://vitfix.io/api/syndic/demandes/valider', {
    method: 'POST',
    headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }))

function poserDonnees(statut = 'en_attente', priorite = 'planifiee') {
  h.base.lignes.syndic_signalements = [
    { id: SIG, cabinet_id: CAB, immeuble_nom: 'Résidence Le Prado', demandeur_nom: 'Marie Coste', demandeur_role: 'coproprio', demandeur_email: 'marie@example.fr', type_intervention: 'Plomberie', description: "Fuite d'eau sous l'évier", priorite, statut, batiment: 'A', etage: '3', num_lot: '12', est_partie_commune: false, zone_signalee: null },
    { id: SIG_AUTRE, cabinet_id: AUTRE_CAB, immeuble_nom: 'Autre', demandeur_nom: 'X', type_intervention: 'Autre', description: 'x', priorite: 'normale', statut: 'en_attente' },
  ]
  h.base.lignes.syndic_artisans = [
    { id: ART, cabinet_id: CAB, artisan_user_id: CAB, nom: 'Damien Perrin', prenom: 'Damien', nom_famille: 'Perrin', metier: 'Plombier' },
    { id: ART_SANS_COMPTE, cabinet_id: CAB, artisan_user_id: null, nom: 'Thomas Ménard', metier: 'Peintre' },
    { id: ART_AUTRE_CAB, cabinet_id: AUTRE_CAB, artisan_user_id: 'cccccccc-0000-4000-8000-000000000000', nom: 'Autre artisan' },
  ]
  h.base.lignes.syndic_cabinets = [{ id: CAB, nom: 'Cabinet VitFix' }]
}

beforeEach(() => {
  h.base = nouvelleBase()
  h.syndic = true
  h.livrer.mockReset()
  h.livrer.mockResolvedValue({ bookingId: null, conversationId: 'conv-1', messageId: 'msg-1', ordreEnvoye: true, notificationEnvoyee: true })
  poserDonnees()
})

describe('POST /api/syndic/demandes/valider — contrôles', () => {
  it('401 hors rôle syndic', async () => {
    h.syndic = false
    const res = await appeler({ signalement_id: SIG, syndic_artisan_id: ART })
    expect(res.status).toBe(401)
    expect(h.base.appels).toHaveLength(0)
  })

  it('400 sur un corps invalide (Zod)', async () => {
    const res = await appeler({ signalement_id: 'pas-un-id', syndic_artisan_id: ART })
    expect(res.status).toBe(400)
    expect(appelsDe(h.base, 'syndic_missions')).toHaveLength(0)
  })

  it("404 pour le signalement d'un autre cabinet (lecture filtrée sur le cabinet)", async () => {
    const res = await appeler({ signalement_id: SIG_AUTRE, syndic_artisan_id: ART })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'signalement_introuvable' })
    expect(appelsDe(h.base, 'syndic_signalements', 'select')[0].eq).toContainEqual(['cabinet_id', CAB])
    expect(appelsDe(h.base, 'syndic_missions')).toHaveLength(0)
    expect(h.livrer).not.toHaveBeenCalled()
  })

  it("404 pour un prestataire d'un autre cabinet, jamais livré", async () => {
    const res = await appeler({ signalement_id: SIG, syndic_artisan_id: ART_AUTRE_CAB })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'prestataire_introuvable' })
    expect(appelsDe(h.base, 'syndic_artisans', 'select')[0].eq).toContainEqual(['cabinet_id', CAB])
    expect(h.livrer).not.toHaveBeenCalled()
  })

  it('422 prestataire_sans_compte : ni mission, ni livraison, signalement inchangé', async () => {
    const res = await appeler({ signalement_id: SIG, syndic_artisan_id: ART_SANS_COMPTE })
    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ error: 'prestataire_sans_compte' })
    expect(appelsDe(h.base, 'syndic_missions')).toHaveLength(0)
    expect(appelsDe(h.base, 'syndic_signalements', 'update')).toHaveLength(0)
    expect(h.livrer).not.toHaveBeenCalled()
  })

  it('409 pour une demande déjà confiée', async () => {
    poserDonnees('acceptee')
    const res = await appeler({ signalement_id: SIG, syndic_artisan_id: ART })
    expect(res.status).toBe(409)
    expect(appelsDe(h.base, 'syndic_missions')).toHaveLength(0)
  })

  it('500 sans livraison si la mission ne peut pas être créée', async () => {
    h.base.erreurs['syndic_missions.insert'] = { message: 'check violation' }
    const res = await appeler({ signalement_id: SIG, syndic_artisan_id: ART })
    expect(res.status).toBe(500)
    expect(h.livrer).not.toHaveBeenCalled()
  })
})

describe('POST /api/syndic/demandes/valider — mission confiée', () => {
  it('crée la mission, livre au compte du prestataire et accepte le signalement', async () => {
    const res = await appeler({ signalement_id: SIG, syndic_artisan_id: ART, date_intervention: '2026-10-13', note: 'Clé chez la gardienne' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ mission_id: 'syndic_missions-nouveau', conversation_id: 'conv-1', notification: true })

    // (a) mission : priorité du CHECK (planifiee conservée), statut en cours, liée au signalement.
    const [mission] = appelsDe(h.base, 'syndic_missions', 'insert')
    expect(mission.donnees).toMatchObject({
      cabinet_id: CAB,
      signalement_id: SIG,
      immeuble: 'Résidence Le Prado',
      artisan: 'Damien Perrin',
      type: 'Plomberie',
      description: "Fuite d'eau sous l'évier",
      priorite: 'planifiee',
      statut: 'en_cours',
      date_intervention: '2026-10-13',
    })

    // (b) livraison : artisan_user_id de la ligne du cabinet, donneur d'ordre = cabinet, planifiee → normale.
    expect(h.livrer).toHaveBeenCalledTimes(1)
    const livraison = h.livrer.mock.calls[0][1]
    expect(livraison).toMatchObject({
      artisanUserId: CAB,
      cabinetId: CAB,
      contactId: CAB,
      contactName: 'Cabinet VitFix',
      senderId: CAB,
      titre: 'Plomberie',
      adresse: 'Résidence Le Prado, bât. A, étage 3, lot 12',
      dateIntervention: '2026-10-13',
      priorite: 'normale',
      urgence: 'normale',
      references: { signalement_id: SIG, syndic_mission_id: 'syndic_missions-nouveau' },
    })
    expect(livraison.description).toContain("Fuite d'eau sous l'évier")
    expect(livraison.description).toContain('Note du syndic : Clé chez la gardienne')

    // (c) signalement accepté + message dans le fil du copropriétaire.
    const [maj] = appelsDe(h.base, 'syndic_signalements', 'update')
    expect(maj.donnees).toMatchObject({ statut: 'acceptee', artisan_assigne: 'Damien Perrin' })
    expect(maj.eq).toEqual(expect.arrayContaining([['id', SIG], ['cabinet_id', CAB]]))
    const [message] = appelsDe(h.base, 'syndic_signalement_messages', 'insert')
    expect(message.donnees).toMatchObject({ signalement_id: SIG, auteur: 'Syndic' })
    expect((message.donnees as { texte: string }).texte).toMatch(/^Mission confiée à Damien Perrin \(Plombier\)/)
  })

  it("demande urgente : mission et ordre de mission en 'urgente', jamais 'haute'", async () => {
    poserDonnees('en_attente', 'urgente')
    await appeler({ signalement_id: SIG, syndic_artisan_id: ART })
    expect(appelsDe(h.base, 'syndic_missions', 'insert')[0].donnees).toMatchObject({ priorite: 'urgente' })
    expect(h.livrer.mock.calls[0][1]).toMatchObject({ urgence: 'urgente', priorite: 'urgente' })
  })

  it('notification: false quand la livraison est incomplète', async () => {
    h.livrer.mockResolvedValue({ bookingId: null, conversationId: 'conv-1', messageId: 'msg-1', ordreEnvoye: true, notificationEnvoyee: false })
    const res = await appeler({ signalement_id: SIG, syndic_artisan_id: ART })
    expect(res.status).toBe(200)
    expect((await res.json()).notification).toBe(false)
  })
})
