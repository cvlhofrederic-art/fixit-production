import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * POST /api/syndic/decl-encargos — le serveur fait foi pour la date limite :
 * il la calcule depuis la date de la demande (AAAA-MM-JJ validée par Zod) selon le pays
 * reçu ('pt' | 'fr', défaut 'pt') et ignore toute date limite envoyée par le client.
 * PT : terme légal de l'art. 1424.º-A, n.º 2, CC, reporté au premier jour ouvrable s'il tombe
 * un dimanche ou un jour férié (art. 279.º, e) ; FR : délai interne de 10 jours, sans report.
 */

const h = vi.hoisted(() => ({ insert: vi.fn() }))

// Vraie règle, enveloppée dans un espion : on vérifie aussi le pays transmis par la route.
vi.mock('@/lib/syndic/v54/decl-encargos', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/syndic/v54/decl-encargos')>()
  return { ...original, prazoLimiteDeclaracao: vi.fn(original.prazoLimiteDeclaracao) }
})

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn(), addBreadcrumb: vi.fn() }))
vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      insert: (ligne: Record<string, unknown>) => {
        h.insert(ligne)
        return { select: () => ({ single: async () => ({ data: { id: 'de-1', ...ligne }, error: null }) }) }
      },
    })),
  },
}))
vi.mock('@/lib/auth-helpers', () => ({
  getAuthUser: vi.fn(async () => ({ id: 'u-syndic', user_metadata: { role: 'syndic' } })),
  isSyndicRole: vi.fn(() => true),
  resolveCabinetId: vi.fn(async () => 'cab-test'),
}))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => true),
  getClientIP: vi.fn(() => '127.0.0.1'),
  rateLimitResponse: vi.fn(() => Response.json({ error: 'rate' }, { status: 429 })),
}))
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  parsePagination: vi.fn(() => ({ from: 0, to: 49 })),
}))

import { POST } from '@/app/api/syndic/decl-encargos/route'
import { prazoLimiteDeclaracao } from '@/lib/syndic/v54/decl-encargos'

const espionPrazo = vi.mocked(prazoLimiteDeclaracao)

const poster = (corps: Record<string, unknown>) =>
  POST(new NextRequest('http://localhost/api/syndic/decl-encargos', {
    method: 'POST',
    body: JSON.stringify(corps),
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer jeton-test' },
  }))

const BASE = { fracao: 'Apt 5.º D', condomino: 'Maria Costa' }

beforeEach(() => {
  h.insert.mockClear()
  espionPrazo.mockClear()
})

describe('POST /api/syndic/decl-encargos — date limite calculée par le serveur', () => {
  it('sans pays (défaut PT) : terme légal PT, date limite du client ignorée', async () => {
    const res = await poster({ ...BASE, dataPedido: '2026-03-25', prazoLimite: '2099-12-31' })
    expect(res.status).toBe(200)
    expect(h.insert).toHaveBeenCalledTimes(1)
    // 2026-04-04 : samedi, non reporté par l'art. 279.º, e), CC.
    expect(h.insert.mock.calls[0][0]).toMatchObject({ data_pedido: '2026-03-25', prazo_limite: '2026-04-04' })
  })

  it.each([
    ['pt', '2026-10-26'], // terme le dimanche 25/10/2026 → lundi 26 (art. 279.º, e), CC)
    ['fr', '2026-10-25'], // délai interne : 10 jours exactement, sans report
  ])('pays %s : règle du pays appliquée (demande du 15/10/2026 → %s)', async (locale, prazo) => {
    const res = await poster({ ...BASE, dataPedido: '2026-10-15', locale })
    expect(res.status).toBe(200)
    expect(espionPrazo).toHaveBeenCalledTimes(1)
    expect(espionPrazo).toHaveBeenCalledWith('2026-10-15', locale)
    expect(h.insert.mock.calls[0][0]).toMatchObject({ data_pedido: '2026-10-15', prazo_limite: prazo })
  })

  it('sans pays : la règle PT est demandée (défaut), terme du dimanche reporté', async () => {
    const res = await poster({ ...BASE, dataPedido: '2026-10-15' })
    expect(res.status).toBe(200)
    expect(espionPrazo).toHaveBeenCalledWith('2026-10-15', 'pt')
    expect(h.insert.mock.calls[0][0]).toMatchObject({ prazo_limite: '2026-10-26' })
  })

  it('PT et FR divergent pour la même demande (terme PT un jour férié : 08/12/2026)', async () => {
    await poster({ ...BASE, dataPedido: '2026-11-28', locale: 'pt' })
    await poster({ ...BASE, dataPedido: '2026-11-28', locale: 'fr' })
    expect(h.insert.mock.calls.map(c => (c[0] as Record<string, unknown>).prazo_limite)).toEqual(['2026-12-09', '2026-12-08'])
  })

  it.each([
    ['vide', { dataPedido: '' }],
    ['null', { dataPedido: null }],
    ['absente', {}],
  ])('date de la demande %s : ni date de demande ni date limite', async (_cas, date) => {
    const res = await poster({ ...BASE, ...date, prazoLimite: '2026-06-01' })
    expect(res.status).toBe(200)
    expect(h.insert.mock.calls[0][0]).toMatchObject({ data_pedido: null, prazo_limite: null })
  })

  it.each(['2026-02-30', '2026-02-29', 'abc', '25/03/2026', '2026-03-25T10:00:00Z'])('date de la demande invalide (%s) → 400, rien n’est inséré', async (dataPedido) => {
    const res = await poster({ ...BASE, dataPedido })
    expect(res.status).toBe(400)
    expect(h.insert).not.toHaveBeenCalled()
  })

  it.each(['es', 'pt-PT', 'FR', ''])('pays inconnu (%s) → 400, rien n’est inséré', async (locale) => {
    const res = await poster({ ...BASE, dataPedido: '2026-05-01', locale })
    expect(res.status).toBe(400)
    expect(h.insert).not.toHaveBeenCalled()
  })
})
