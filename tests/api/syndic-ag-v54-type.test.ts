// tests/api/syndic-ag-v54-type.test.ts
//
// POST /api/syndic/ag-v54 : le type v54 (PT) est traduit pour la colonne type_ag, dont le CHECK
// (migration 005) n'accepte que 'ordinaire' | 'extraordinaire'. L'écriture brute de 'ordinaria'
// faisait échouer toute création d'AG depuis le tableau de bord (500).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => {
  const inserts: Array<Record<string, unknown>> = []
  const requete: Record<string, unknown> = {}
  requete.insert = vi.fn((v: Record<string, unknown>) => { inserts.push(v); return requete })
  requete.select = vi.fn(() => requete)
  requete.single = vi.fn(async () => ({ data: { id: 'ag-1' }, error: null }))
  return { inserts, requete }
})

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => true),
  getClientIP: vi.fn(() => '127.0.0.1'),
  rateLimitResponse: vi.fn(() => Response.json({ error: 'rate' }, { status: 429 })),
}))
vi.mock('@/lib/auth-helpers', () => ({
  getAuthUser: vi.fn(async () => ({ id: 'id-super-admin', app_metadata: { role: 'super_admin' } })),
  isSyndicRole: vi.fn(() => true),
  resolveCabinetId: vi.fn(async () => 'id-super-admin'),
}))
vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin: { from: vi.fn(() => h.requete) } }))

const { POST } = await import('@/app/api/syndic/ag-v54/route')

const creer = (body: Record<string, unknown>) =>
  POST(new NextRequest('https://vitfix.io/api/syndic/ag-v54', {
    method: 'POST',
    headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }))

beforeEach(() => { h.inserts.length = 0 })

describe('POST /api/syndic/ag-v54 — type_ag', () => {
  it.each([
    ['ordinaria', 'ordinaire'],
    ['extraordinaria', 'extraordinaire'],
    ['urgente', 'extraordinaire'],
  ])('tipo « %s » → type_ag « %s »', async (tipo, attendu) => {
    const res = await creer({ titulo: 'AG annuelle Le Prado', tipo })
    expect(res.status).toBe(200)
    expect(h.inserts[0]).toMatchObject({ type_ag: attendu, cabinet_id: 'id-super-admin' })
  })

  it('tipo absent → AG ordinaire', async () => {
    await creer({ titulo: 'AG annuelle Le Prado' })
    expect(h.inserts[0].type_ag).toBe('ordinaire')
  })
})
