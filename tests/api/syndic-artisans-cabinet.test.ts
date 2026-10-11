// tests/api/syndic-artisans-cabinet.test.ts
//
// GET /api/syndic/artisans : la liste est filtrée sur le cabinet de l'utilisateur, super admin compris.
// Le tableau de bord v54 traite le super admin comme un syndic (cabinet = son id) : sans ce filtre, l'écran
// « Prestataires » afficherait en démo les artisans (nom, téléphone, e-mail) de tous les cabinets.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => {
  const filtres: Array<[string, unknown]> = []
  const requete: Record<string, unknown> = {}
  for (const m of ['select', 'order', 'limit', 'in', 'is']) requete[m] = vi.fn(() => requete)
  requete.eq = vi.fn((col: string, val: unknown) => { filtres.push([col, val]); return requete })
  requete.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(ok)
  return { filtres, requete, superAdmin: true }
})

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => true),
  getClientIP: vi.fn(() => '127.0.0.1'),
  rateLimitResponse: vi.fn(() => Response.json({ error: 'rate' }, { status: 429 })),
}))
vi.mock('@/lib/auth-helpers', () => ({
  getAuthUser: vi.fn(async () => ({ id: 'id-super-admin', email: 'admin@exemple.fr', app_metadata: { role: 'super_admin' } })),
  isSyndicRole: vi.fn(() => true),
  isSuperAdmin: vi.fn(() => h.superAdmin),
  resolveCabinetId: vi.fn(async () => 'id-super-admin'),
}))
vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin: { from: vi.fn(() => h.requete) } }))

const { GET } = await import('@/app/api/syndic/artisans/route')
const appeler = (url: string) => GET(new NextRequest(url, { headers: { Authorization: 'Bearer tok' } }))

describe('GET /api/syndic/artisans — périmètre du cabinet', () => {
  beforeEach(() => { h.filtres.length = 0; h.superAdmin = true })

  it('super admin : liste limitée à son propre cabinet', async () => {
    const res = await appeler('https://vitfix.io/api/syndic/artisans')
    expect(res.status).toBe(200)
    expect(h.filtres).toContainEqual(['cabinet_id', 'id-super-admin'])
  })

  it('super admin : vue de tous les cabinets seulement sur demande explicite (?tous=1)', async () => {
    await appeler('https://vitfix.io/api/syndic/artisans?tous=1')
    expect(h.filtres.find(([col]) => col === 'cabinet_id')).toBeUndefined()
  })

  it('syndic : ?tous=1 ignoré, toujours filtré sur son cabinet', async () => {
    h.superAdmin = false
    await appeler('https://vitfix.io/api/syndic/artisans?tous=1')
    expect(h.filtres).toContainEqual(['cabinet_id', 'id-super-admin'])
  })
})
