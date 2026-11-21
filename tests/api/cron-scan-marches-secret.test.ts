// @vitest-environment node
// tests/api/cron-scan-marches-secret.test.ts
//
// GET /api/cron/scan-marches — tâche planifiée qui retire les marchés collectés de plus de 8 jours puis relance
// une collecte complète. Comme les autres tâches (/api/cron/booking-reminder, devis-reminder, referral), elle ne
// s'exécute qu'avec le secret des tâches planifiées : sans secret configuré, elle refuse tout appel.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => ({
  suppressions: 0,
  scanMarches: vi.fn(async () => ({
    marches: [],
    meta: { scannedAt: '2026-11-14T06:00:00Z', totalScanned: 0, totalFiltered: 0, sources: [] },
  })),
}))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/logger', async () => (await import('../helpers/mocks-routes-api')).loggerSilencieux())
vi.mock('@/lib/marches-scanner', () => ({ scanMarches: h.scanMarches }))
vi.mock('@/lib/supabase-server', () => {
  const requete: Record<string, unknown> = {}
  requete.delete = () => { h.suppressions += 1; return requete }
  for (const m of ['like', 'lt']) requete[m] = () => requete
  requete.then = (ok: (v: unknown) => unknown) => Promise.resolve({ count: 0, error: null }).then(ok)
  return { supabaseAdmin: { from: () => requete } }
})

const { GET } = await import('@/app/api/cron/scan-marches/route')

const appeler = (autorisation?: string) => GET(new NextRequest('https://vitfix.io/api/cron/scan-marches', {
  headers: autorisation ? { authorization: autorisation } : {},
}))

describe('GET /api/cron/scan-marches — secret des tâches planifiées', () => {
  const secretAvant = process.env.CRON_SECRET
  beforeEach(() => {
    h.suppressions = 0
    h.scanMarches.mockClear()
  })
  afterEach(() => {
    if (secretAvant === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = secretAvant
  })

  it.each([
    ['sans en-tête', undefined],
    ['avec un en-tête quelconque', 'Bearer undefined'],
  ])('secret non configuré, appel %s : 401, rien n’est supprimé, aucune collecte', async (_cas, autorisation) => {
    delete process.env.CRON_SECRET
    const res = await appeler(autorisation)
    expect(res.status).toBe(401)
    expect(h.suppressions).toBe(0)
    expect(h.scanMarches).not.toHaveBeenCalled()
  })

  it('secret configuré, mauvais en-tête ou aucun : 401, rien n’est supprimé', async () => {
    process.env.CRON_SECRET = 'secret-des-taches'
    expect((await appeler('Bearer autre-valeur')).status).toBe(401)
    expect((await appeler()).status).toBe(401)
    expect(h.suppressions).toBe(0)
    expect(h.scanMarches).not.toHaveBeenCalled()
  })

  it('secret configuré et présenté : la tâche s’exécute comme avant', async () => {
    process.env.CRON_SECRET = 'secret-des-taches'
    const res = await appeler('Bearer secret-des-taches')
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ success: true, inserted: 0, skipped: 0, deleted: 0 })
    expect(h.suppressions).toBe(1)
    expect(h.scanMarches).toHaveBeenCalledTimes(1)
  })
})
