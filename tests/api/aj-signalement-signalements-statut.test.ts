// tests/api/aj-signalement-signalements-statut.test.ts
//
// PATCH /api/aj-signalement/signalements/[id] (P1-R7, corrigée) : la copropriété du signalement est lue AVANT
// l'écriture ; la mise à jour est conditionnée par cette copropriété et, si l'écran l'envoie, par le statut attendu
// (sinon 409 conflit_statut) ; trace statut_modifie_* et journal { de, vers }. Le corps actuel { statut } seul reste
// accepté et la réponse garde misAJourLe (lu par changerStatutSignalementQr). Repli sans statut_modifie_* (42703 /
// PGRST204) tant que la migration du 11/11/2026 manque.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/supabase-server', async () => ({ supabaseAdmin: (await import('../helpers/aj-signalement-base')).baseQr.client }))
vi.mock('@/lib/supabase-server-component', async () => (await import('../helpers/aj-signalement-routes')).mockCookies())
vi.mock('@/lib/auth-helpers', async () => (await import('../helpers/aj-signalement-routes')).mockAuth())
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/aj-signalement-routes')).mockLimites())
vi.mock('@/lib/email', async () => (await import('../helpers/aj-signalement-routes')).mockEmail())
vi.mock('@/lib/logger', async () => (await import('../helpers/aj-signalement-routes')).mockLogger())

const { baseQr, simulerProductionAvant1111Qr } = await import('../helpers/aj-signalement-base')
const { ADMIN_QR, contexteQr, reinitialiserSimulQr, requeteQr, simulQr } = await import('../helpers/aj-signalement-routes')
const { PATCH } = await import('@/app/api/aj-signalement/signalements/[id]/route')
const { changerStatutSignalementQr } = await import('@/lib/aj-signalement/api')
const { reinitialiserReplisQr } = await import('@/lib/aj-signalement/serveur')

const CAB = 'ca000000-0000-4000-8000-000000000001'
const COPRO = 'c0000000-0000-4000-8000-000000000001'
const S = '5f2c9a1e-1111-4222-8333-444444444444'

beforeEach(() => {
  reinitialiserSimulQr()
  reinitialiserReplisQr()
  baseQr.reinitialiser()
  baseQr.etat.tables.signalements_qr_coproprietes = [{ id: COPRO, nom: 'Résidence Exemple', cabinet_id: CAB }]
  baseQr.etat.tables.signalements_qr = [{ id: S, copropriete_id: COPRO, statut: 'en_attente', created_at: '2026-11-10T09:00:00+00:00', updated_at: '2026-11-10T09:00:00+00:00' }]
  baseQr.etat.tables.signalements_qr_journal = []
})

const patcher = (corps: unknown) => PATCH(requeteQr(`/api/aj-signalement/signalements/${S}`, 'PATCH', corps), contexteQr(S))

describe('PATCH signalements/[id] (P1-R7)', () => {
  it('corps actuel { statut } : lecture de la copropriété puis écriture conditionnée par elle ; trace et journal { de, vers }', async () => {
    const res = await patcher({ statut: 'en_cours' })
    expect(res.status).toBe(200)
    const lecture = baseQr.etat.lectures.find((l) => l.table === 'signalements_qr')
    const ecriture = baseQr.ecrituresDe('signalements_qr', 'update')[0]
    expect(baseQr.etat.lectures.indexOf(lecture as never)).toBeGreaterThanOrEqual(0)
    expect(ecriture.filtres).toEqual([`id=eq.${S}`, `copropriete_id=eq.${COPRO}`])
    expect(ecriture.valeurs).toEqual({ statut: 'en_cours', statut_modifie_le: expect.any(String), statut_modifie_par: ADMIN_QR.id, statut_modifie_profil: 'super_admin' })
    const corps = await res.json()
    expect(corps).toEqual({ signalement: { id: S, statut: 'en_cours', misAJourLe: '2026-11-10T09:00:00+00:00', statutModifieLe: expect.any(String) } })
    expect(baseQr.table('signalements_qr_journal')).toEqual([expect.objectContaining({
      action: 'signalement.statut', signalement_id: S, copropriete_id: COPRO, cabinet_id: CAB, acteur_id: ADMIN_QR.id, details: { de: 'en_attente', vers: 'en_cours' },
    })])
  })

  it('statutAttendu fourni et différent du statut en base : 409 conflit_statut, rien n’est écrit au journal', async () => {
    const res = await patcher({ statut: 'terminee', statutAttendu: 'acceptee' })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'conflit_statut' })
    expect(baseQr.ecrituresDe('signalements_qr', 'update')[0].filtres).toContain('statut=eq.acceptee')
    expect(baseQr.table('signalements_qr')[0].statut).toBe('en_attente')
    expect(baseQr.table('signalements_qr_journal')).toEqual([])
  })

  it('le client actuel (changerStatutSignalementQr) lit la réponse réelle : statut et misAJourLe', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => patcher(JSON.parse(String(init?.body))))
    const r = await changerStatutSignalementQr(S, 'acceptee', null, fetchImpl as unknown as typeof fetch)
    expect(r).toEqual({ ok: true, statut: 'acceptee', misAJourLe: '2026-11-10T09:00:00+00:00' })
  })

  it('colonnes statut_modifie_* absentes (PGRST204) : écriture rejouée sans elles, 200', async () => {
    baseQr.etat.colonnesAbsentes = { signalements_qr: ['statut_modifie_le', 'statut_modifie_par', 'statut_modifie_profil'] }
    baseQr.etat.tablesAbsentes = ['signalements_qr_journal']
    const res = await patcher({ statut: 'acceptee' })
    expect(res.status).toBe(200)
    expect(baseQr.ecrituresDe('signalements_qr', 'update').at(-1)?.valeurs).toEqual({ statut: 'acceptee' })
    expect((await res.json()).signalement).toMatchObject({ statut: 'acceptee', statutModifieLe: null })
  })

  it.each(['42P01', 'PGRST205'] as const)(
    'production avant la migration du 11/11 (journal %s, colonnes PGRST204) : statut écrit sans trace, 200, replis journalisés une fois',
    async (code) => {
      simulerProductionAvant1111Qr(baseQr, code)
      const res = await patcher({ statut: 'en_cours' })
      expect(res.status).toBe(200)
      expect(baseQr.ecrituresDe('signalements_qr', 'update').at(-1)?.valeurs).toEqual({ statut: 'en_cours' })
      expect(baseQr.table('signalements_qr')[0].statut).toBe('en_cours')
      expect((await res.json()).signalement).toMatchObject({ statut: 'en_cours', statutModifieLe: null })
      expect(baseQr.etat.tablesAbsentesLues).toEqual(['signalements_qr_journal'])
      expect(simulQr.logger.error).not.toHaveBeenCalled()
      expect((await patcher({ statut: 'acceptee' })).status).toBe(200)
      const replis = simulQr.logger.warn.mock.calls.map((c) => String(c[0])).filter((m) => m.includes('migration du 11/11/2026 absente'))
      expect(replis).toEqual([
        '[AJ SIGNALEMENT] migration du 11/11/2026 absente : repli (trace du statut)',
        '[AJ SIGNALEMENT] migration du 11/11/2026 absente : repli (cabinet de la copropriété)',
        '[AJ SIGNALEMENT] migration du 11/11/2026 absente : repli (journal)',
      ])
    },
  )

  it('signalement inconnu : 404 sans écriture ; clé inconnue : 400', async () => {
    baseQr.etat.tables.signalements_qr = []
    expect((await patcher({ statut: 'acceptee' })).status).toBe(404)
    expect(baseQr.ecrituresDe('signalements_qr')).toEqual([])
    expect((await patcher({ statut: 'acceptee', coproprieteId: COPRO })).status).toBe(400)
  })
})
