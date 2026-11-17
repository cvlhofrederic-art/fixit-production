// Accès d'un super_admin à la boîte d'un autre cabinet via /api/email-agent/poll (POST ciblé
// et GET) : réservé au super_admin au sens de isSuperAdmin (rôle app_metadata + e-mail de la
// liste ADMIN_EMAIL / ADMIN_EMAIL_2). isSyndicRole, resolveCabinetId et isSuperAdmin sont les
// vrais (lib/auth-helpers) ; seul getAuthUser est simulé.
//
// Échafaudage des mocks : ./email-agent-test-utils.ts ; comptes : ./super-admin-test-utils.ts.

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'
import {
  callPollPOST,
  makeAlfredoClassifyMock,
  makeAlfredoContextMock,
  makeAlfredoDraftMock,
  makeAlfredoPipelineMock,
  makeLoggerMock,
  makeLoggerSpies,
  makeOauthTokensMock,
  makeSanitizeContextMock,
  makeSupabaseAdminMock,
  makeTokensChain,
} from './email-agent-test-utils'
import {
  ID_AUTRE_COMPTE,
  ID_COMPTE,
  compte,
  definirListeSuperAdmin,
  superAdminAutorise,
  superAdminHorsListe,
} from './super-admin-test-utils'

const h = vi.hoisted(() => ({ user: null as User | null }))

vi.mock('@/lib/auth-helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-helpers')>()),
  getAuthUser: vi.fn(async () => h.user),
}))

// syndic_oauth_tokens (POST) : aucun jeton → la boucle passe au syndic suivant sans appel réseau.
// syndic_emails_analysed (GET) : chaîne attendue (select → eq → order → limit), liste vide.
const tokens = makeTokensChain()
const emails = (() => {
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.order = vi.fn(() => chain)
  chain.limit = vi.fn(() => chain)
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve)
  return chain
})()
vi.mock('@/lib/supabase-server', () =>
  makeSupabaseAdminMock((table: string) => (table === 'syndic_emails_analysed' ? emails : tokens.chain)),
)

vi.mock('@/lib/oauth/tokens', () => makeOauthTokensMock())
vi.mock('@/lib/syndic/alfredo-pipeline', () => makeAlfredoPipelineMock())
vi.mock('@/lib/syndic/alfredo-load-client-context', () => makeAlfredoContextMock())
vi.mock('@/lib/syndic/alfredo-classify', () => makeAlfredoClassifyMock())
vi.mock('@/lib/syndic/alfredo-draft', () => makeAlfredoDraftMock())
vi.mock('@/lib/ai/sanitize-context', () => makeSanitizeContextMock())

const logger = makeLoggerSpies()
vi.mock('@/lib/logger', () => makeLoggerMock(logger))

definirListeSuperAdmin()
const { GET } = await import('@/app/api/email-agent/poll/route')

afterAll(() => {
  vi.unstubAllEnvs()
})

// Le cabinet visé n'est pas celui du compte connecté (resolveCabinetId → son propre id).
const CABINET_VISE = ID_AUTRE_COMPTE

function requetePost(): Request {
  return new Request('http://localhost:3000/api/email-agent/poll', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ syndic_id: CABINET_VISE }),
  })
}

function requeteGet(): NextRequest {
  return new NextRequest(`http://localhost:3000/api/email-agent/poll?syndic_id=${CABINET_VISE}`)
}

beforeEach(() => {
  vi.clearAllMocks()
  h.user = null
  tokens.single.mockResolvedValue({ data: null, error: null })
})

describe('POST /api/email-agent/poll — cabinet d\'un tiers', () => {
  it('rôle super_admin avec un e-mail hors liste → 403, aucune lecture de jetons', async () => {
    h.user = superAdminHorsListe(ID_COMPTE)
    const res = await callPollPOST(requetePost())
    expect(res.status).toBe(403)
    expect(tokens.single).not.toHaveBeenCalled()
  })

  it('syndic d\'un autre cabinet → 403', async () => {
    h.user = compte({ id: ID_COMPTE, email: 'syndic@exemple.test', role: 'syndic' })
    const res = await callPollPOST(requetePost())
    expect(res.status).toBe(403)
  })

  it('super_admin de la liste → 200, scopé au cabinet transmis', async () => {
    h.user = superAdminAutorise(ID_COMPTE)
    const res = await callPollPOST(requetePost())
    expect(res.status).toBe(200)
    expect(tokens.chain.eq).toHaveBeenCalledWith('syndic_id', CABINET_VISE)
  })
})

describe('GET /api/email-agent/poll — cabinet d\'un tiers', () => {
  it('rôle super_admin avec un e-mail hors liste → 403, aucune lecture d\'e-mails', async () => {
    h.user = superAdminHorsListe(ID_COMPTE)
    const res = await GET(requeteGet())
    expect(res.status).toBe(403)
    expect(emails.select).not.toHaveBeenCalled()
  })

  it('syndic d\'un autre cabinet → 403', async () => {
    h.user = compte({ id: ID_COMPTE, email: 'syndic@exemple.test', role: 'syndic' })
    const res = await GET(requeteGet())
    expect(res.status).toBe(403)
  })

  it('super_admin de la liste → 200', async () => {
    h.user = superAdminAutorise(ID_COMPTE)
    const res = await GET(requeteGet())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ emails: [] })
    expect(emails.eq).toHaveBeenCalledWith('syndic_id', CABINET_VISE)
  })

  it('syndic sur son propre cabinet → 200 (inchangé)', async () => {
    h.user = compte({ id: CABINET_VISE, email: 'syndic@exemple.test', role: 'syndic' })
    const res = await GET(requeteGet())
    expect(res.status).toBe(200)
  })
})
