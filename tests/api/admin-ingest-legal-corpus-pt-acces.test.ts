// Contrôle d'accès de POST /api/admin/ingest-legal-corpus-pt : super_admin au sens de
// isSuperAdmin (rôle app_metadata + e-mail de la liste ADMIN_EMAIL / ADMIN_EMAIL_2), par jeton
// Bearer ou par cookie de session, ou secret d'automatisation x-cron-secret (INTERNAL_API_SECRET).
// isSuperAdmin est le vrai (lib/auth-helpers) ; getAuthUser et la session cookie sont simulés.
// Corpus vide : une requête autorisée répond 200 sans rien insérer.

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { compte, definirListeSuperAdmin, superAdminAutorise, superAdminHorsListe } from './super-admin-test-utils'

const h = vi.hoisted(() => {
  const chaine: Record<string, ReturnType<typeof vi.fn>> = {}
  chaine.select = vi.fn(() => chaine)
  chaine.in = vi.fn(async () => ({ data: [], error: null }))
  return {
    bearer: null as User | null,
    cookie: null as User | null,
    chaine,
    from: vi.fn(() => chaine),
  }
})

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }))
vi.mock('@/lib/auth-helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-helpers')>()),
  getAuthUser: vi.fn(async () => h.bearer),
}))
vi.mock('@/lib/supabase-server-component', () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: h.cookie }, error: null })) },
  })),
}))
vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin: { from: h.from } }))
vi.mock('@/lib/syndic/embed', () => ({ embedBatch: vi.fn(async () => []), formatVectorLiteral: vi.fn(() => '[]') }))
vi.mock('@/lib/syndic/legal-corpus-pt-md', () => ({ decodeCorpusMd: vi.fn(() => '') }))
vi.mock('@/lib/syndic/max-parser', () => ({ parseLegalMarkdown: vi.fn(() => []) }))
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: vi.fn(async () => ({ env: {} })) }))

const SECRET_CI = 'secret-cron'

definirListeSuperAdmin()
vi.stubEnv('INTERNAL_API_SECRET', SECRET_CI)
const { POST } = await import('@/app/api/admin/ingest-legal-corpus-pt/route')

afterAll(() => {
  vi.unstubAllEnvs()
})

function requete(entetes: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost:3000/api/admin/ingest-legal-corpus-pt', {
    method: 'POST',
    headers: entetes,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  h.bearer = null
  h.cookie = null
})

describe('POST /api/admin/ingest-legal-corpus-pt — jeton Bearer', () => {
  it('syndic → 403, aucune lecture du corpus', async () => {
    h.bearer = compte({ email: 'syndic@exemple.test', role: 'syndic' })
    const res = await POST(requete({ Authorization: 'Bearer jeton' }))
    expect(res.status).toBe(403)
    expect(h.from).not.toHaveBeenCalled()
  })

  it('employé de cabinet (syndic_admin) → 403', async () => {
    h.bearer = compte({ email: 'employe@exemple.test', role: 'syndic_admin' })
    const res = await POST(requete({ Authorization: 'Bearer jeton' }))
    expect(res.status).toBe(403)
  })

  it('rôle super_admin avec un e-mail hors liste → 403', async () => {
    h.bearer = superAdminHorsListe()
    const res = await POST(requete({ Authorization: 'Bearer jeton' }))
    expect(res.status).toBe(403)
    expect(h.from).not.toHaveBeenCalled()
  })

  it('super_admin de la liste → 200', async () => {
    h.bearer = superAdminAutorise()
    const res = await POST(requete({ Authorization: 'Bearer jeton' }))
    expect(res.status).toBe(200)
    expect(h.from).toHaveBeenCalledWith('syndic_legal_corpus_pt')
  })
})

describe('POST /api/admin/ingest-legal-corpus-pt — session cookie', () => {
  it('syndic → 403', async () => {
    h.cookie = compte({ email: 'syndic@exemple.test', role: 'syndic' })
    const res = await POST(requete())
    expect(res.status).toBe(403)
  })

  it('rôle super_admin avec un e-mail hors liste → 403', async () => {
    h.cookie = superAdminHorsListe()
    const res = await POST(requete())
    expect(res.status).toBe(403)
  })

  it('super_admin de la liste → 200', async () => {
    h.cookie = superAdminAutorise()
    const res = await POST(requete())
    expect(res.status).toBe(200)
  })
})

describe('POST /api/admin/ingest-legal-corpus-pt — secret d\'automatisation (inchangé)', () => {
  it('x-cron-secret valide → 200', async () => {
    const res = await POST(requete({ 'x-cron-secret': SECRET_CI }))
    expect(res.status).toBe(200)
  })

  it('x-cron-secret invalide → 403', async () => {
    const res = await POST(requete({ 'x-cron-secret': 'mauvais' }))
    expect(res.status).toBe(403)
  })

  it('aucune authentification → 403', async () => {
    const res = await POST(requete())
    expect(res.status).toBe(403)
  })
})
