import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

// ── Spies that the tests configure per-scenario ─────────────────────────────
const adminInsert = vi.fn()
const authedInsert = vi.fn()
const authedUpdate = vi.fn()
const adminSelectListing = vi.fn()
const adminInsertNotification = vi.fn()

// ── Tiny chainable mock helper (flatten deep .select().eq()...().single()) ──
// Returns a node where every chain method (select/eq/...) yields the same node
// and `single` calls the supplied terminal. Bypasses SonarCloud's "do not nest
// functions more than 4 levels" rule by replacing the cascade with one factory.
function makeChain(terminal: () => unknown) {
  const node: Record<string, unknown> = {}
  for (const k of ['select', 'eq']) node[k] = () => node
  node.single = terminal
  return node
}

function adminListingTable() {
  return makeChain(() => adminSelectListing())
}

function authedRowMutationTable() {
  return {
    insert: (payload: unknown) => makeChain(() => authedInsert(payload)),
    update: (payload: unknown) => makeChain(() => authedUpdate(payload)),
  }
}

const adminFromMock = vi.fn().mockImplementation((table: string) => {
  if (table === 'marketplace_listings') return adminListingTable()
  if (table === 'artisan_notifications') {
    return {
      // Real Promise — never a thenable object literal (SonarCloud S4123).
      insert: (payload: unknown) => {
        adminInsertNotification(payload)
        return Promise.resolve({ data: null, error: null })
      },
    }
  }
  return { insert: adminInsert }
})

const authedFromMock = vi.fn().mockImplementation((table: string) => {
  if (table === 'marketplace_listings' || table === 'marketplace_demandes') {
    return authedRowMutationTable()
  }
  return {}
})

const getUserMock = vi.fn()

vi.mock('@/lib/supabase-clients', () => ({
  getAdminClient: () => ({ from: adminFromMock }),
  getAnonClient: () => ({ auth: { getUser: getUserMock } }),
  getAuthedClient: vi.fn(() => ({ from: authedFromMock })),
  authenticateRequest: async (req: NextRequest) => {
    const header = req.headers.get('authorization')
    if (!header) return null
    const token = header.replace(/^Bearer\s+/i, '').trim()
    if (!token) return null
    const { data: { user }, error } = await getUserMock(token)
    return error || !user ? null : user
  },
  getBearerToken: (req: NextRequest) => {
    const h = req.headers.get('authorization')
    if (!h) return null
    const t = h.replace(/^Bearer\s+/i, '').trim()
    return t.length > 0 ? t : null
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
  getClientIP: vi.fn().mockReturnValue('1.2.3.4'),
  rateLimitResponse: () =>
    new Response(JSON.stringify({ error: 'rate limit' }), { status: 429 }),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Request builders (https-only to satisfy SonarCloud S5332) ───────────────
const FAKE_ID = '11111111-1111-4111-8111-111111111111'
const ROOT = 'https://test.local/api/marketplace-btp'

function jsonRequest(url: string, method: string, body: unknown, token?: string): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  return new Request(url, {
    method,
    body: JSON.stringify(body),
    headers,
  }) as unknown as NextRequest
}

const params = (id: string) => ({ params: Promise.resolve({ id }) })

// ── Tests ───────────────────────────────────────────────────────────────────

describe('POST /api/marketplace-btp', () => {
  it('returns 401 when Bearer token is absent', async () => {
    const { POST } = await import('@/app/api/marketplace-btp/route')
    const res = await POST(jsonRequest(ROOT, 'POST', { title: 'x' }))
    expect(res.status).toBe(401)
  })

  it('returns 401 when token is invalid', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null }, error: { message: 'invalid' } })
    const { POST } = await import('@/app/api/marketplace-btp/route')
    const res = await POST(jsonRequest(ROOT, 'POST', { title: 'x' }, 'bad'))
    expect(res.status).toBe(401)
  })

  it('returns 400 on invalid Zod payload', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null })
    const { POST } = await import('@/app/api/marketplace-btp/route')
    const res = await POST(jsonRequest(ROOT, 'POST', { foo: 'bar' }, 'jwt'))
    expect(res.status).toBe(400)
  })

  it('insert goes through getAuthedClient (RLS-protected) on happy path', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null })
    authedInsert.mockResolvedValueOnce({ data: { id: 'L1' }, error: null })
    const valid = {
      title: 'Mini-pelle 1.5T',
      categorie: 'mini_engins',
      type_annonce: 'location',
      etat: 'bon',
    }
    const { POST } = await import('@/app/api/marketplace-btp/route')
    const res = await POST(jsonRequest(ROOT, 'POST', valid, 'jwt'))
    expect(res.status).toBe(201)
    const sb = await import('@/lib/supabase-clients')
    expect(sb.getAuthedClient).toHaveBeenCalledWith('jwt')
    expect(authedInsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'u1', title: 'Mini-pelle 1.5T' }))
  })
})

describe('PUT /api/marketplace-btp/[id]', () => {
  it('returns 401 when Bearer token is absent', async () => {
    const { PUT } = await import('@/app/api/marketplace-btp/[id]/route')
    const res = await PUT(jsonRequest(`${ROOT}/${FAKE_ID}`, 'PUT', { title: 'x' }), params(FAKE_ID))
    expect(res.status).toBe(401)
  })

  it('returns 400 on invalid UUID', async () => {
    const { PUT } = await import('@/app/api/marketplace-btp/[id]/route')
    const res = await PUT(
      jsonRequest(`${ROOT}/not-a-uuid`, 'PUT', { title: 'x' }, 'jwt'),
      params('not-a-uuid')
    )
    expect(res.status).toBe(400)
  })

  it('update routes through getAuthedClient (RLS-protected)', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null })
    authedUpdate.mockResolvedValueOnce({ data: { id: 'L1', title: 'New' }, error: null })
    const { PUT } = await import('@/app/api/marketplace-btp/[id]/route')
    const res = await PUT(jsonRequest(`${ROOT}/${FAKE_ID}`, 'PUT', { title: 'New' }, 'jwt'), params(FAKE_ID))
    expect(res.status).toBe(200)
    const sb = await import('@/lib/supabase-clients')
    expect(sb.getAuthedClient).toHaveBeenCalledWith('jwt')
  })
})

describe('DELETE /api/marketplace-btp/[id]', () => {
  it('returns 401 when Bearer token is absent', async () => {
    const { DELETE } = await import('@/app/api/marketplace-btp/[id]/route')
    const res = await DELETE(jsonRequest(`${ROOT}/${FAKE_ID}`, 'DELETE', {}), params(FAKE_ID))
    expect(res.status).toBe(401)
  })
})

describe('POST /api/marketplace-btp/[id]/demande', () => {
  it('returns 401 when Bearer token is absent', async () => {
    const { POST } = await import('@/app/api/marketplace-btp/[id]/demande/route')
    const res = await POST(jsonRequest(`${ROOT}/${FAKE_ID}/demande`, 'POST', {}), params(FAKE_ID))
    expect(res.status).toBe(401)
  })

  it('rejects buyer == seller (cannot apply to your own listing)', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: 'owner' } }, error: null })
    adminSelectListing.mockResolvedValueOnce({ data: { user_id: 'owner', title: 'X', vendeur_nom: 'A' } })
    const { POST } = await import('@/app/api/marketplace-btp/[id]/demande/route')
    const res = await POST(
      jsonRequest(`${ROOT}/${FAKE_ID}/demande`, 'POST', { type_demande: 'location' }, 'jwt'),
      params(FAKE_ID)
    )
    expect(res.status).toBe(400)
  })

  it('insert demande goes through getAuthedClient on happy path', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: 'buyer' } }, error: null })
    adminSelectListing.mockResolvedValueOnce({ data: { user_id: 'seller', title: 'X', vendeur_nom: 'A' } })
    authedInsert.mockResolvedValueOnce({ data: { id: 'D1' }, error: null })
    const { POST } = await import('@/app/api/marketplace-btp/[id]/demande/route')
    const res = await POST(
      jsonRequest(`${ROOT}/${FAKE_ID}/demande`, 'POST', { type_demande: 'location' }, 'jwt'),
      params(FAKE_ID)
    )
    expect(res.status).toBe(201)
    const sb = await import('@/lib/supabase-clients')
    expect(sb.getAuthedClient).toHaveBeenCalledWith('jwt')
    expect(authedInsert).toHaveBeenCalledWith(expect.objectContaining({ buyer_user_id: 'buyer', listing_id: FAKE_ID }))
  })
})

describe('PATCH /api/marketplace-btp/[id]/demande', () => {
  it('returns 403 when caller is not the listing owner', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: 'someone-else' } }, error: null })
    adminSelectListing.mockResolvedValueOnce({ data: { user_id: 'real-owner' } })
    const { PATCH } = await import('@/app/api/marketplace-btp/[id]/demande/route')
    const res = await PATCH(
      jsonRequest(`${ROOT}/${FAKE_ID}/demande`, 'PATCH', { demande_id: 'D1', status: 'accepted' }, 'jwt'),
      params(FAKE_ID)
    )
    expect(res.status).toBe(403)
  })
})
