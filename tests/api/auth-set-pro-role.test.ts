// Contrôle d'accès de POST /api/auth/set-pro-role.
// - self-set : pro_societe uniquement, et seulement sans rôle préexistant ;
// - tout le reste (rôle dormant, compte d'un tiers) : super_admin au sens de isSuperAdmin
//   (rôle app_metadata + e-mail de la liste ADMIN_EMAIL / ADMIN_EMAIL_2).
// isSuperAdmin est le vrai (lib/auth-helpers) ; seule la lecture du jeton est simulée.

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'
import {
  ID_AUTRE_COMPTE,
  ID_COMPTE,
  compte,
  definirListeSuperAdmin,
  superAdminAutorise,
  superAdminHorsListe,
} from './super-admin-test-utils'

const h = vi.hoisted(() => ({
  appelant: null as User | null,
  getUserById: vi.fn(async () => ({ data: { user: { app_metadata: {} } }, error: null })),
  updateUserById: vi.fn(async () => ({ data: {}, error: null })),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: h.appelant }, error: h.appelant ? null : { message: 'jeton' } })) },
  })),
}))
vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: { auth: { admin: { getUserById: h.getUserById, updateUserById: h.updateUserById } } },
}))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => true),
  getClientIP: vi.fn(() => '127.0.0.1'),
  rateLimitResponse: vi.fn(() => Response.json({ error: 'rate' }, { status: 429 })),
}))

definirListeSuperAdmin()
const { POST } = await import('@/app/api/auth/set-pro-role/route')

afterAll(() => {
  vi.unstubAllEnvs()
})

function requete(corps: { user_id: string; role: string; org_type?: string }): NextRequest {
  return new NextRequest('http://localhost:3000/api/auth/set-pro-role', {
    method: 'POST',
    headers: { Authorization: 'Bearer jeton', 'content-type': 'application/json' },
    body: JSON.stringify({ org_type: 'societe', ...corps }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  h.appelant = null
})

describe('POST /api/auth/set-pro-role — attribution à un autre compte', () => {
  it('rôle super_admin avec un e-mail hors liste → 403, aucune écriture', async () => {
    h.appelant = superAdminHorsListe(ID_COMPTE)
    const res = await POST(requete({ user_id: ID_AUTRE_COMPTE, role: 'pro_conciergerie' }))
    expect(res.status).toBe(403)
    expect(h.updateUserById).not.toHaveBeenCalled()
  })

  it('rôle super_admin avec un e-mail hors liste, pro_societe sur un tiers → 403', async () => {
    h.appelant = superAdminHorsListe(ID_COMPTE)
    const res = await POST(requete({ user_id: ID_AUTRE_COMPTE, role: 'pro_societe' }))
    expect(res.status).toBe(403)
    expect(h.updateUserById).not.toHaveBeenCalled()
  })

  it('super_admin de la liste → 200, rôle écrit sur le compte cible', async () => {
    h.appelant = superAdminAutorise(ID_COMPTE)
    const res = await POST(requete({ user_id: ID_AUTRE_COMPTE, role: 'pro_conciergerie' }))
    expect(res.status).toBe(200)
    expect(h.updateUserById).toHaveBeenCalledWith(ID_AUTRE_COMPTE, {
      app_metadata: { role: 'pro_conciergerie', org_type: 'societe' },
    })
  })
})

describe('POST /api/auth/set-pro-role — self-set (inchangé)', () => {
  it('sans jeton valide → 401', async () => {
    const res = await POST(requete({ user_id: ID_COMPTE, role: 'pro_societe' }))
    expect(res.status).toBe(401)
  })

  it('compte sans rôle → pro_societe sur lui-même autorisé (200)', async () => {
    h.appelant = compte({ id: ID_COMPTE, email: 'gerant@exemple.test' })
    const res = await POST(requete({ user_id: ID_COMPTE, role: 'pro_societe' }))
    expect(res.status).toBe(200)
    expect(h.updateUserById).toHaveBeenCalledTimes(1)
  })

  it('compte sans rôle → rôle dormant sur lui-même refusé (403)', async () => {
    h.appelant = compte({ id: ID_COMPTE, email: 'gerant@exemple.test' })
    const res = await POST(requete({ user_id: ID_COMPTE, role: 'pro_gestionnaire' }))
    expect(res.status).toBe(403)
    expect(h.updateUserById).not.toHaveBeenCalled()
  })

  it('compte qui a déjà un rôle → 403', async () => {
    h.appelant = compte({ id: ID_COMPTE, email: 'artisan@exemple.test', role: 'artisan' })
    const res = await POST(requete({ user_id: ID_COMPTE, role: 'pro_societe' }))
    expect(res.status).toBe(403)
    expect(h.updateUserById).not.toHaveBeenCalled()
  })
})
