// tests/api/syndic-signalements-origine.test.ts
//
// GET /api/syndic/signalements — provenance des demandes (colonne `origine`, migration 20261017) :
//   - la colonne est demandée et servie telle quelle ('portail' / 'public'), une valeur inattendue → null ;
//   - colonne absente en production (42703) : relecture sans elle, `origine: null`, un seul avertissement
//     par instance (le Canal relit toutes les 15 s) ;
//   - toute autre erreur reste une erreur (500, journalisée), sans relecture.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { appelsDe, clientMemoire, nouvelleBase, type BaseMemoire } from './syndic-supabase-memoire'

const CAB = '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4'
const SIG_PORTAIL = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000001'
const SIG_PUBLIC = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000002'
const SIG_INCONNUE = 'aaaaaaaa-bbbb-4ccc-8ddd-000000000003'

const h = vi.hoisted(() => ({ base: null as unknown as BaseMemoire, loggerWarn: vi.fn(), loggerError: vi.fn() }))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { error: h.loggerError, warn: h.loggerWarn, info: vi.fn(), debug: vi.fn() } }))
vi.mock('@/lib/auth-helpers', () => ({
  getAuthUser: vi.fn(async () => ({ id: CAB, email: 'syndic@example.fr', app_metadata: { role: 'syndic' }, user_metadata: { full_name: 'Cabinet VitFix' } })),
  isSyndicRole: vi.fn(() => true),
  isSuperAdmin: vi.fn(() => false),
  resolveCabinetId: vi.fn(async () => CAB),
}))
vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: { from: (t: string) => clientMemoire(h.base).from(t) },
}))

const { GET } = await import('@/app/api/syndic/signalements/route')

const lire = () => GET(new NextRequest('https://vitfix.io/api/syndic/signalements', { headers: { Authorization: 'Bearer tok' } }))

const ligne = (id: string, created_at: string, extra: Record<string, unknown> = {}) => ({
  id, cabinet_id: CAB, immeuble_nom: 'Le Prado', demandeur_nom: 'Marie Coste', demandeur_email: 'marie@example.fr',
  type_intervention: 'Plomberie', statut: 'en_attente', created_at, ...extra,
})

const selects = () => appelsDe(h.base, 'syndic_signalements', 'select')
const nomme = (colonnes: string | undefined, colonne: string) => (colonnes ?? '').split(',').map((c) => c.trim()).includes(colonne)

beforeEach(() => {
  h.base = nouvelleBase()
  h.loggerWarn.mockReset()
  h.loggerError.mockReset()
})

describe('GET /api/syndic/signalements — provenance (origine)', () => {
  it("demande la colonne origine et la sert : 'portail', 'public', valeur inattendue → null", async () => {
    h.base.lignes.syndic_signalements = [
      ligne(SIG_PORTAIL, '2026-10-17T09:00:00Z', { origine: 'portail' }),
      ligne(SIG_PUBLIC, '2026-10-17T08:00:00Z', { origine: 'public' }),
      ligne(SIG_INCONNUE, '2026-10-17T07:00:00Z', { origine: 'autre' }),
    ]
    const res = await lire()
    expect(res.status).toBe(200)
    expect(selects()).toHaveLength(1)
    expect(nomme(selects()[0].colonnes, 'origine')).toBe(true)
    const { signalements } = await res.json()
    expect(signalements.map((s: { id: string; origine: string | null }) => [s.id, s.origine])).toEqual([
      [SIG_PORTAIL, 'portail'],
      [SIG_PUBLIC, 'public'],
      [SIG_INCONNUE, null],
    ])
    expect(h.loggerWarn).not.toHaveBeenCalled()
    expect(h.loggerError).not.toHaveBeenCalled()
  })

  it('colonne absente (migration 20261017 non appliquée) : relecture sans la colonne, origine null, un seul avertissement', async () => {
    h.base.colonnesAbsentes = { syndic_signalements: ['origine'] }
    // Sans la colonne en base, les lignes ne la portent pas.
    h.base.lignes.syndic_signalements = [ligne(SIG_PORTAIL, '2026-10-17T09:00:00Z'), ligne(SIG_PUBLIC, '2026-10-17T08:00:00Z')]

    const res = await lire()
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    const { signalements } = await res.json()
    expect(signalements.map((s: { id: string; origine: string | null }) => [s.id, s.origine])).toEqual([[SIG_PORTAIL, null], [SIG_PUBLIC, null]])
    // Première lecture avec `origine`, seconde sans ; les deux filtrées sur le cabinet.
    expect(selects()).toHaveLength(2)
    expect(nomme(selects()[0].colonnes, 'origine')).toBe(true)
    expect(nomme(selects()[1].colonnes, 'origine')).toBe(false)
    expect(selects()[1].colonnes).toContain('syndic_signalement_messages')
    expect(selects()[1].eq).toContainEqual(['cabinet_id', CAB])
    expect(h.loggerError).not.toHaveBeenCalled()
    expect(h.loggerWarn).toHaveBeenCalledTimes(1)
    expect(h.loggerWarn.mock.calls[0][0]).toMatch(/origine absente/)

    // Lecture suivante (polling) : même repli, mais plus d'avertissement.
    const res2 = await lire()
    expect(res2.status).toBe(200)
    expect(selects()).toHaveLength(4)
    expect(h.loggerWarn).toHaveBeenCalledTimes(1)
  })

  it('autre erreur de lecture : 500 journalisé, sans relecture', async () => {
    h.base.erreurs['syndic_signalements.select'] = { message: 'connection refused' }
    const res = await lire()
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Une erreur interne est survenue' })
    expect(selects()).toHaveLength(1)
    expect(h.loggerError).toHaveBeenCalledTimes(1)
    expect(h.loggerError.mock.calls[0][1]).toMatchObject({ message: 'connection refused' })
    expect(h.loggerWarn).not.toHaveBeenCalled()
  })
})
