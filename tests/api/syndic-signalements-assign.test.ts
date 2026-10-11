// tests/api/syndic-signalements-assign.test.ts
//
// - GET /api/syndic/signalements : jamais en cache (une demande de copropriétaire doit apparaître au
//   syndic sans délai), filtré sur le cabinet.
// - POST /api/syndic/signalements : un message ne s'ajoute qu'à un signalement du cabinet.
// - POST /api/syndic/assign-mission : la livraison passe par le helper partagé lib/syndic/livraison-mission.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { appelsDe, clientMemoire, nouvelleBase, type BaseMemoire } from './syndic-supabase-memoire'

const CAB = '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4'
const SIG = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const SIG_AUTRE = 'aaaaaaaa-bbbb-4ccc-8ddd-ffffffffffff'
const ARTISAN = '22222222-3333-4444-8555-666666666666'

const h = vi.hoisted(() => ({ base: null as unknown as BaseMemoire, livrer: vi.fn() }))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => true),
  getClientIP: vi.fn(() => '127.0.0.1'),
  rateLimitResponse: vi.fn(() => Response.json({ error: 'rate' }, { status: 429 })),
}))
vi.mock('@/lib/auth-helpers', () => ({
  getAuthUser: vi.fn(async () => ({ id: CAB, email: 'syndic@example.fr', app_metadata: { role: 'syndic' }, user_metadata: { full_name: 'Cabinet VitFix' } })),
  isSyndicRole: vi.fn(() => true),
  isSuperAdmin: vi.fn(() => false),
  resolveCabinetId: vi.fn(async () => CAB),
}))
vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: {
    from: (t: string) => clientMemoire(h.base).from(t),
    auth: { admin: { getUserById: vi.fn(async (id: string) => ({ data: { user: { id } } })) } },
  },
}))
vi.mock('@/lib/syndic/livraison-mission', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/syndic/livraison-mission')>()),
  livrerMission: h.livrer,
}))

const signalements = await import('@/app/api/syndic/signalements/route')
const assign = await import('@/app/api/syndic/assign-mission/route')

const requete = (url: string, body?: unknown) => new NextRequest(url, body === undefined
  ? { headers: { Authorization: 'Bearer tok' } }
  : { method: 'POST', headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

beforeEach(() => {
  h.base = nouvelleBase()
  h.base.lignes.syndic_signalements = [
    { id: SIG, cabinet_id: CAB, immeuble_nom: 'Le Prado', demandeur_nom: 'Marie', statut: 'en_attente', created_at: '2026-10-12T07:00:00Z' },
    { id: SIG_AUTRE, cabinet_id: 'autre-cabinet', immeuble_nom: 'Autre', statut: 'en_attente', created_at: '2026-10-12T07:00:00Z' },
  ]
  h.livrer.mockReset()
  h.livrer.mockResolvedValue({ bookingId: 'b1', conversationId: 'c1', messageId: 'm1', ordreEnvoye: true, notificationEnvoyee: true })
})

describe('GET /api/syndic/signalements', () => {
  it('réponse jamais mise en cache, filtrée sur le cabinet', async () => {
    const res = await signalements.GET(requete('https://vitfix.io/api/syndic/signalements'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    expect(appelsDe(h.base, 'syndic_signalements', 'select')[0].eq).toContainEqual(['cabinet_id', CAB])
    const { signalements: liste } = await res.json()
    expect(liste.map((s: { id: string }) => s.id)).toEqual([SIG])
  })
})

describe('POST /api/syndic/signalements (message)', () => {
  it("404 pour le signalement d'un autre cabinet, rien n'est écrit", async () => {
    const res = await signalements.POST(requete('https://vitfix.io/api/syndic/signalements', { signalementId: SIG_AUTRE, texte: 'Bonjour' }))
    expect(res.status).toBe(404)
    expect(appelsDe(h.base, 'syndic_signalement_messages', 'insert')).toHaveLength(0)
  })

  it('message ajouté au fil d’un signalement du cabinet', async () => {
    const res = await signalements.POST(requete('https://vitfix.io/api/syndic/signalements', { signalementId: SIG, texte: 'Intervention demain', auteur: 'Syndic', role: 'syndic' }))
    expect(res.status).toBe(200)
    expect(appelsDe(h.base, 'syndic_signalement_messages', 'insert')[0].donnees).toEqual({ signalement_id: SIG, auteur: 'Syndic', role: 'syndic', texte: 'Intervention demain' })
  })
})

describe('POST /api/syndic/assign-mission — livraison partagée', () => {
  it('artisan_user_id : livraison au compte, donneur d’ordre = utilisateur, priorité haute conservée pour l’ordre', async () => {
    const res = await assign.POST(requete('https://vitfix.io/api/syndic/assign-mission', {
      artisan_user_id: ARTISAN, artisan_name: 'Damien Perrin', description: 'Fuite colonne', type_travaux: 'Plomberie',
      date_intervention: '2026-10-13', immeuble: 'Le Prado', priorite: 'haute', notes: 'Clé gardienne',
    }))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ success: true, booking_id: 'b1', conversation_id: 'c1', artisan_found: true })
    expect(h.livrer).toHaveBeenCalledTimes(1)
    expect(h.livrer.mock.calls[0][1]).toMatchObject({
      artisanUserId: ARTISAN,
      cabinetId: CAB,
      contactId: CAB,
      senderId: CAB,
      titre: 'Plomberie',
      description: 'Fuite colonne',
      adresse: 'Le Prado',
      dateIntervention: '2026-10-13',
      priorite: 'haute',
      urgence: 'haute',
      notes: 'Clé gardienne',
    })
  })

  it('artisan introuvable : aucune livraison', async () => {
    const res = await assign.POST(requete('https://vitfix.io/api/syndic/assign-mission', { artisan_name: 'Inconnu', description: 'Fuite' }))
    expect(res.status).toBe(200)
    expect((await res.json()).artisan_found).toBe(false)
    expect(h.livrer).not.toHaveBeenCalled()
  })
})
