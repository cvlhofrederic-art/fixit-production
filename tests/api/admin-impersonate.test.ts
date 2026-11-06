// Contrôle d'accès de POST /api/admin/impersonate (« vue en tant que » du super_admin).
// Réservé au super_admin au sens de isSuperAdmin : rôle réel super_admin (app_metadata.role,
// ou _original_role pendant une vue d'emprunt) ET e-mail de la liste ADMIN_EMAIL / ADMIN_EMAIL_2.
// Les helpers d'auth sont les vrais (lib/auth-helpers) ; seul getAuthUser est simulé.

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'
import {
  EMAIL_HORS_LISTE,
  EMAIL_SUPER_ADMIN,
  ID_COMPTE,
  compte,
  definirListeSuperAdmin,
  superAdminAutorise,
  superAdminHorsListe,
} from './super-admin-test-utils'

const h = vi.hoisted(() => ({
  user: null as User | null,
  updateUserById: vi.fn(async () => ({ data: {}, error: null })),
}))

vi.mock('@/lib/auth-helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-helpers')>()),
  getAuthUser: vi.fn(async () => h.user),
}))
vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: { auth: { admin: { updateUserById: h.updateUserById } } },
}))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => true),
  getClientIP: vi.fn(() => '127.0.0.1'),
  rateLimitResponse: vi.fn(() => Response.json({ error: 'rate' }, { status: 429 })),
}))

definirListeSuperAdmin()
const { POST } = await import('@/app/api/admin/impersonate/route')

afterAll(() => {
  vi.unstubAllEnvs()
})

function requete(role: string): NextRequest {
  return new NextRequest('http://localhost:3000/api/admin/impersonate', {
    method: 'POST',
    headers: { Authorization: 'Bearer jeton', 'content-type': 'application/json' },
    body: JSON.stringify({ role }),
  })
}

/** Compte en « vue en tant que » : rôle d'emprunt, rôle réel dans _original_role. */
function enVueEmprunt(email: string): User {
  return compte({
    id: ID_COMPTE,
    email,
    role: 'syndic',
    appMetadata: { _admin_override: true, _original_role: 'super_admin' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  h.user = null
})

describe('POST /api/admin/impersonate — entrée en vue d\'emprunt', () => {
  it('sans session → 401', async () => {
    const res = await POST(requete('artisan'))
    expect(res.status).toBe(401)
  })

  it('rôle super_admin avec un e-mail hors liste → 403, aucune écriture', async () => {
    h.user = superAdminHorsListe(ID_COMPTE)
    const res = await POST(requete('artisan'))
    expect(res.status).toBe(403)
    expect(h.updateUserById).not.toHaveBeenCalled()
  })

  it('compte non super_admin → 403', async () => {
    h.user = compte({ id: ID_COMPTE, email: EMAIL_SUPER_ADMIN, role: 'syndic' })
    const res = await POST(requete('artisan'))
    expect(res.status).toBe(403)
    expect(h.updateUserById).not.toHaveBeenCalled()
  })

  it('super_admin de la liste → 200, rôle d\'emprunt écrit sur son propre compte', async () => {
    h.user = superAdminAutorise(ID_COMPTE)
    const res = await POST(requete('artisan'))
    expect(res.status).toBe(200)
    expect(h.updateUserById).toHaveBeenCalledWith(ID_COMPTE, {
      app_metadata: { role: 'artisan', _admin_override: true, _original_role: 'super_admin' },
    })
  })
})

describe('POST /api/admin/impersonate — pendant une vue d\'emprunt', () => {
  it('e-mail de la liste → retour au rôle super_admin (200)', async () => {
    h.user = enVueEmprunt(EMAIL_SUPER_ADMIN)
    const res = await POST(requete('super_admin'))
    expect(res.status).toBe(200)
    expect(h.updateUserById).toHaveBeenCalledWith(ID_COMPTE, { app_metadata: { role: 'super_admin' } })
  })

  it('e-mail de la liste → changement de rôle d\'emprunt (200)', async () => {
    h.user = enVueEmprunt(EMAIL_SUPER_ADMIN)
    const res = await POST(requete('coproprio'))
    expect(res.status).toBe(200)
  })

  it('e-mail hors liste → 403, aucune écriture', async () => {
    h.user = enVueEmprunt(EMAIL_HORS_LISTE)
    const res = await POST(requete('pro_societe'))
    expect(res.status).toBe(403)
    expect(h.updateUserById).not.toHaveBeenCalled()
  })
})
