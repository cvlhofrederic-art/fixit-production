// tests/api/syndic-canal-pro.test.ts
//
// /api/syndic/canal-pro — onglet « Professionnels » du Canal de communication v54 :
// GET ne lit que les conversations « pro » dont le cabinet est le donneur d'ordre, marque chaque
// message de son côté (règle metadata.cote) et lit les documents ; POST n'écrit que dans une
// conversation du cabinet, côté donneur d'ordre.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { appelsDe, clientMemoire, nouvelleBase, type BaseMemoire } from './syndic-supabase-memoire'

const CAB = '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4'
const PRESTA = '22222222-3333-4444-8555-666666666666'
const CONV = 'cccccccc-dddd-4eee-8fff-000000000001'
const CONV_DEMO = 'cccccccc-dddd-4eee-8fff-000000000002'
const CONV_AUTRE = 'cccccccc-dddd-4eee-8fff-000000000003'
// Conversation « pro » vers le cabinet, mais avec un compte qui n'est PAS un prestataire du cabinet.
const CONV_INCONNU = 'cccccccc-dddd-4eee-8fff-000000000004'
const INCONNU = '99999999-3333-4444-8555-666666666666'

const h = vi.hoisted(() => ({ base: null as unknown as BaseMemoire, syndic: true }))

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

const { GET, POST } = await import('@/app/api/syndic/canal-pro/route')

const lire = () => GET(new NextRequest('https://vitfix.io/api/syndic/canal-pro', { headers: { Authorization: 'Bearer tok' } }))
const ecrire = (body: unknown) => POST(new NextRequest('https://vitfix.io/api/syndic/canal-pro', {
  method: 'POST',
  headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
}))

beforeEach(() => {
  h.base = nouvelleBase()
  h.syndic = true
  h.base.lignes.conversations = [
    { id: CONV, artisan_id: PRESTA, contact_id: CAB, contact_type: 'pro', contact_name: 'Cabinet VitFix', last_message_at: '2026-10-12T09:00:00Z', created_at: '2026-10-12T08:00:00Z' },
    // Démo : le prestataire est le compte du syndic lui-même.
    { id: CONV_DEMO, artisan_id: CAB, contact_id: CAB, contact_type: 'pro', contact_name: 'Cabinet VitFix', last_message_at: '2026-10-12T10:00:00Z' },
    { id: CONV_AUTRE, artisan_id: PRESTA, contact_id: 'autre-cabinet', contact_type: 'pro' },
    { id: CONV_INCONNU, artisan_id: INCONNU, contact_id: CAB, contact_type: 'pro', contact_name: 'Cabinet VitFix', last_message_at: '2026-10-12T11:00:00Z' },
  ]
  h.base.lignes.syndic_artisans = [
    { id: 'f1', cabinet_id: CAB, artisan_user_id: PRESTA, nom: 'Damien Perrin', metier: 'Plombier' },
    { id: 'f2', cabinet_id: CAB, artisan_user_id: CAB, nom: 'Frédéric Artisan', metier: 'Multiservice' },
    // Fiche sans compte Vitfix : aucune conversation possible.
    { id: 'f3', cabinet_id: CAB, artisan_user_id: null, nom: 'Thomas Ménard', metier: 'Peintre' },
    // L'inconnu est prestataire d'un AUTRE cabinet seulement.
    { id: 'f4', cabinet_id: 'autre-cabinet', artisan_user_id: INCONNU, nom: 'Autre prestataire' },
  ]
  h.base.lignes.conversation_messages = [
    { id: 'm1', conversation_id: CONV_DEMO, sender_id: CAB, type: 'ordre_mission', content: 'Fuite', metadata: { cote: 'donneur_ordre', signalement_id: 's1', syndic_mission_id: 'mi1' }, ordre_mission: { titre: 'Plomberie', adresse: 'Le Prado', date_souhaitee: '2026-10-13', description: 'Fuite', urgence: 'urgente', statut: 'accepte', arrival_time: '09:30', signalement_id: 's1', syndic_mission_id: 'mi1' }, created_at: '2026-10-12T08:01:00Z' },
    { id: 'm2', conversation_id: CONV_DEMO, sender_id: CAB, type: 'system', content: '✅ Mission acceptée', metadata: { cote: 'artisan' }, ordre_mission: null, created_at: '2026-10-12T08:02:00Z' },
    { id: 'm3', conversation_id: CONV_DEMO, sender_id: CAB, type: 'text', content: '📄 Devis D-2026-014 — 640,00 € TTC — Remplacement colonne EF', metadata: { cote: 'artisan', document: { type: 'devis', reference: 'D-2026-014', montant_ttc: 640, description: 'Remplacement colonne EF', date: '2026-10-12' } }, ordre_mission: null, created_at: '2026-10-12T08:03:00Z' },
    { id: 'm4', conversation_id: CONV_DEMO, sender_id: CAB, type: 'text', content: 'Merci, devis validé', metadata: { cote: 'donneur_ordre' }, ordre_mission: null, created_at: '2026-10-12T08:04:00Z' },
    // Messages historiques sans cote : règle sender_id === artisan_id.
    { id: 'm5', conversation_id: CONV, sender_id: PRESTA, type: 'text', content: 'Je passe demain', metadata: {}, ordre_mission: null, created_at: '2026-10-12T08:05:00Z' },
    { id: 'm6', conversation_id: CONV, sender_id: CAB, type: 'text', content: 'Parfait', metadata: null, ordre_mission: null, created_at: '2026-10-12T08:06:00Z' },
  ]
})

describe('GET /api/syndic/canal-pro', () => {
  it('401 hors rôle syndic', async () => {
    h.syndic = false
    expect((await lire()).status).toBe(401)
  })

  it("conversations « pro » du cabinet seulement (contact_id = cabinet), jamais en cache", async () => {
    const res = await lire()
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toContain('no-store')
    const [convs] = appelsDe(h.base, 'conversations', 'select')
    expect(convs.eq).toEqual(expect.arrayContaining([['contact_id', CAB], ['contact_type', 'pro']]))
    const { conversations } = await res.json()
    expect(conversations.map((c: { id: string }) => c.id).sort()).toEqual([CONV, CONV_DEMO].sort())
    // Noms lus dans les fiches prestataires DU cabinet.
    expect(appelsDe(h.base, 'syndic_artisans', 'select')[0].eq).toContainEqual(['cabinet_id', CAB])
    const demo = conversations.find((c: { id: string }) => c.id === CONV_DEMO)
    expect(demo.prestataire).toEqual({ nom: 'Frédéric Artisan', metier: 'Multiservice' })
  })

  it('seulement les conversations avec les prestataires DU cabinet (artisan_id ∈ fiches du cabinet)', async () => {
    const res = await lire()
    const { conversations } = await res.json()
    expect(conversations.map((c: { id: string }) => c.id)).not.toContain(CONV_INCONNU)
    const [fiches] = appelsDe(h.base, 'syndic_artisans', 'select')
    expect(fiches.eq).toContainEqual(['cabinet_id', CAB])
    const [convs] = appelsDe(h.base, 'conversations', 'select')
    const filtre = convs.in.find(([c]) => c === 'artisan_id')
    expect(filtre?.[1]).toEqual(expect.arrayContaining([PRESTA, CAB]))
    expect(filtre?.[1]).toHaveLength(2)
  })

  it('aucun prestataire avec compte Vitfix : liste vide, aucune conversation lue', async () => {
    h.base.lignes.syndic_artisans = [{ id: 'f3', cabinet_id: CAB, artisan_user_id: null, nom: 'Thomas Ménard' }]
    const res = await lire()
    expect(res.status).toBe(200)
    expect((await res.json()).conversations).toEqual([])
    expect(appelsDe(h.base, 'conversations')).toHaveLength(0)
  })

  it('lecture des fiches prestataires en erreur : 500', async () => {
    h.base.erreurs['syndic_artisans.select'] = { message: 'boom' }
    expect((await lire()).status).toBe(500)
  })

  it('même compte des deux côtés : côté de chaque message, ordre et document lus', async () => {
    const { conversations } = await (await lire()).json()
    const demo = conversations.find((c: { id: string }) => c.id === CONV_DEMO)
    expect(demo.messages.map((m: { id: string; cote: string }) => [m.id, m.cote])).toEqual([
      ['m1', 'donneur_ordre'], ['m2', 'artisan'], ['m3', 'artisan'], ['m4', 'donneur_ordre'],
    ])
    expect(demo.ordre).toMatchObject({ messageId: 'm1', titre: 'Plomberie', statut: 'accepte', urgence: 'urgente', heureArrivee: '09:30', signalementId: 's1', syndicMissionId: 'mi1' })
    expect(demo.messages[2].document).toEqual({ type: 'devis', reference: 'D-2026-014', montant_ttc: 640, description: 'Remplacement colonne EF', date: '2026-10-12' })
    expect(demo.messages[2].contenu).toContain('Devis D-2026-014')
  })

  it('messages historiques sans cote : artisan si sender_id = artisan_id', async () => {
    const { conversations } = await (await lire()).json()
    const conv = conversations.find((c: { id: string }) => c.id === CONV)
    expect(conv.messages.map((m: { id: string; cote: string }) => [m.id, m.cote])).toEqual([['m5', 'artisan'], ['m6', 'donneur_ordre']])
    expect(conv.prestataire.nom).toBe('Damien Perrin')
    expect(conv.ordre).toBeNull()
  })
})

describe('POST /api/syndic/canal-pro', () => {
  it('400 sur un message vide', async () => {
    expect((await ecrire({ conversation_id: CONV, content: '   ' })).status).toBe(400)
  })

  it("404 pour une conversation d'un autre cabinet, rien n'est écrit", async () => {
    const res = await ecrire({ conversation_id: CONV_AUTRE, content: 'Bonjour' })
    expect(res.status).toBe(404)
    expect(appelsDe(h.base, 'conversations', 'select')[0].eq).toEqual(expect.arrayContaining([['id', CONV_AUTRE], ['contact_id', CAB]]))
    expect(appelsDe(h.base, 'conversation_messages', 'insert')).toHaveLength(0)
  })

  it("404 pour une conversation du cabinet avec un compte qui n'est pas son prestataire, rien n'est écrit", async () => {
    const res = await ecrire({ conversation_id: CONV_INCONNU, content: 'Bonjour' })
    expect(res.status).toBe(404)
    const controle = appelsDe(h.base, 'syndic_artisans', 'select')[0]
    expect(controle.eq).toEqual(expect.arrayContaining([['cabinet_id', CAB], ['artisan_user_id', INCONNU]]))
    expect(appelsDe(h.base, 'conversation_messages', 'insert')).toHaveLength(0)
    expect(appelsDe(h.base, 'artisan_notifications')).toHaveLength(0)
  })

  it("réponse du syndic : message texte côté donneur d'ordre + notification in-app du prestataire", async () => {
    h.base.inserts.conversation_messages = { id: 'nouveau', conversation_id: CONV, sender_id: CAB, type: 'text', content: 'Bonjour', metadata: { cote: 'donneur_ordre' }, ordre_mission: null, created_at: '2026-10-12T11:00:00Z' }
    const res = await ecrire({ conversation_id: CONV, content: 'Bonjour' })
    expect(res.status).toBe(200)
    expect(appelsDe(h.base, 'conversation_messages', 'insert')[0].donnees).toEqual({
      conversation_id: CONV, sender_id: CAB, type: 'text', content: 'Bonjour', metadata: { cote: 'donneur_ordre' },
    })
    const notif = appelsDe(h.base, 'artisan_notifications', 'insert')[0].donnees as Record<string, unknown>
    expect(notif).toMatchObject({ artisan_id: PRESTA, type: 'message' })
    expect((await res.json()).message).toMatchObject({ id: 'nouveau', cote: 'donneur_ordre', contenu: 'Bonjour' })
    // Comptes distincts : le trigger compte le non-lu, pas la route.
    expect(appelsDe(h.base, 'conversations', 'update')).toHaveLength(0)
  })

  it('même compte (démo) : non-lu compté pour le prestataire', async () => {
    h.base.lignes.conversations[1].unread_count = 0
    const res = await ecrire({ conversation_id: CONV_DEMO, content: 'Merci' })
    expect(res.status).toBe(200)
    expect(appelsDe(h.base, 'conversations', 'update').map((a) => a.donnees)).toContainEqual({ unread_count: 1 })
  })
})
