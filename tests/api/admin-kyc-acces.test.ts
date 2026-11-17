// Contrôle d'accès de GET / PATCH /api/admin/kyc : réservé au super_admin au sens de
// isSuperAdmin (rôle app_metadata + e-mail de la liste ADMIN_EMAIL / ADMIN_EMAIL_2).
// isSuperAdmin est le vrai (lib/auth-helpers) ; seul getAuthUser est simulé.

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'
import {
  EMAIL_SUPER_ADMIN_2,
  compte,
  definirListeSuperAdmin,
  superAdminAutorise,
  superAdminHorsListe,
} from './super-admin-test-utils'

const h = vi.hoisted(() => {
  const resultatListe = { data: [] as unknown[], error: null, count: 0 }
  const resultatMaj = { data: { email: null, first_name: null, last_name: null, company_name: null, kyc_market: 'fr' }, error: null }
  const chaine: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const m of ['select', 'eq', 'order', 'update']) chaine[m] = vi.fn(() => chaine)
  chaine.range = vi.fn(async () => resultatListe)
  chaine.single = vi.fn(async () => resultatMaj)
  return { user: null as User | null, chaine, from: vi.fn(() => chaine) }
})

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }))
vi.mock('@/lib/auth-helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-helpers')>()),
  getAuthUser: vi.fn(async () => h.user),
}))
vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin: { from: h.from } }))

definirListeSuperAdmin()
const { GET, PATCH } = await import('@/app/api/admin/kyc/route')

afterAll(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

const URL_KYC = 'http://localhost:3000/api/admin/kyc'
const ARTISAN_ID = '3f2b8c1e-5d4a-4b6f-9e7d-1a2b3c4d5e6f'

function requeteGet(): NextRequest {
  return new NextRequest(`${URL_KYC}?status=pending`, { headers: { Authorization: 'Bearer jeton' } })
}

function requetePatch(): NextRequest {
  return new NextRequest(URL_KYC, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer jeton', 'content-type': 'application/json' },
    body: JSON.stringify({ artisan_id: ARTISAN_ID, action: 'approve' }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  h.user = null
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')))
})

describe('GET /api/admin/kyc — contrôle d\'accès', () => {
  it('sans session → 401', async () => {
    const res = await GET(requeteGet())
    expect(res.status).toBe(401)
  })

  it('rôle super_admin avec un e-mail hors liste → 403, aucune lecture', async () => {
    h.user = superAdminHorsListe()
    const res = await GET(requeteGet())
    expect(res.status).toBe(403)
    expect(h.from).not.toHaveBeenCalled()
  })

  it('rôle admin → 403, aucune lecture', async () => {
    h.user = compte({ email: EMAIL_SUPER_ADMIN_2, role: 'admin' })
    const res = await GET(requeteGet())
    expect(res.status).toBe(403)
    expect(h.from).not.toHaveBeenCalled()
  })

  it('super_admin de la liste → 200', async () => {
    h.user = superAdminAutorise()
    const res = await GET(requeteGet())
    expect(res.status).toBe(200)
    expect(h.from).toHaveBeenCalledWith('profiles_artisan')
  })

  it('second e-mail de la liste (ADMIN_EMAIL_2), casse ignorée → 200', async () => {
    h.user = compte({ email: EMAIL_SUPER_ADMIN_2.toUpperCase(), role: 'super_admin' })
    const res = await GET(requeteGet())
    expect(res.status).toBe(200)
  })
})

describe('PATCH /api/admin/kyc — contrôle d\'accès', () => {
  it('sans session → 401', async () => {
    const res = await PATCH(requetePatch())
    expect(res.status).toBe(401)
  })

  it('rôle super_admin avec un e-mail hors liste → 403, aucune mise à jour', async () => {
    h.user = superAdminHorsListe()
    const res = await PATCH(requetePatch())
    expect(res.status).toBe(403)
    expect(h.chaine.update).not.toHaveBeenCalled()
  })

  it('rôle admin → 403, aucune mise à jour', async () => {
    h.user = compte({ email: EMAIL_SUPER_ADMIN_2, role: 'admin' })
    const res = await PATCH(requetePatch())
    expect(res.status).toBe(403)
    expect(h.chaine.update).not.toHaveBeenCalled()
  })

  it('super_admin de la liste → 200, statut approuvé', async () => {
    h.user = superAdminAutorise()
    const res = await PATCH(requetePatch())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, status: 'approved' })
    expect(h.chaine.update).toHaveBeenCalledTimes(1)
  })
})
