import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

const adminInsert = vi.fn()
const authedInsert = vi.fn()
const authedUpdate = vi.fn()
const adminSelectListing = vi.fn()
const adminInsertNotification = vi.fn()

const adminFromMock = vi.fn().mockImplementation((table: string) => {
  if (table === 'marketplace_listings') {
    return {
      select: () => ({
        eq: () => ({
          single: () => adminSelectListing(),
        }),
      }),
    }
  }
  if (table === 'artisan_notifications') {
    return {
      insert: (payload: unknown) => {
        adminInsertNotification(payload)
        return { then: (cb: () => void) => cb() }
      },
    }
  }
  return { insert: adminInsert }
})

const authedFromMock = vi.fn().mockImplementation((table: string) => {
  if (table === 'marketplace_listings') {
    return {
      insert: (payload: unknown) => ({
        select: () => ({
          single: () => authedInsert(payload),
        }),
      }),
      update: (payload: unknown) => ({
        eq: () => ({
          eq: () => ({
            select: () => ({
              single: () => authedUpdate(payload),
            }),
          }),
        }),
      }),
    }
  }
  if (table === 'marketplace_demandes') {
    return {
      insert: (payload: unknown) => ({
        select: () => ({
          single: () => authedInsert(payload),
        }),
      }),
      update: (payload: unknown) => ({
        eq: () => ({
          eq: () => ({
            select: () => ({
              single: () => authedUpdate(payload),
            }),
          }),
        }),
      }),
    }
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

function jsonRequest(url: string, method: string, body: unknown, token?: string): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  return new Request(url, {
    method,
    body: JSON.stringify(body),
    headers,
  }) as unknown as NextRequest
}

describe('POST /api/marketplace-btp', () => {
  it('returns 401 when Bearer token is absent', async () => {
    const { POST } = await import('@/app/api/marketplace-btp/route')
    const res = await POST(jsonRequest('http://t/api/marketplace-btp', 'POST', { title: 'x' }))
    expect(res.status).toBe(401)
  })

  it('returns 401 when token is invalid', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null }, error: { message: 'invalid' } })
    const { POST } = await import('@/app/api/marketplace-btp/route')
    const res = await POST(jsonRequest('http://t/api/marketplace-btp', 'POST', { title: 'x' }, 'bad'))
    expect(res.status).toBe(401)
  })

  it('returns 400 on invalid Zod payload', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null })
    const { POST } = await import('@/app/api/marketplace-btp/route')
    const res = await POST(jsonRequest('http://t/api/marketplace-btp', 'POST', { foo: 'bar' }, 'jwt'))
    expect(res.status).toBe(400)
  })

  it('insert goes through getAuthedClient (RLS-protected) on happy path', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null })
    authedInsert.mockResolvedValueOnce({ data: { id: 'L1' }, error: null })
    const { POST } = await import('@/app/api/marketplace-btp/route')
    const valid = {
      title: 'Mini-pelle 1.5T',
      categorie: 'mini_engins',
      type_annonce: 'location',
      etat: 'bon',
    }
    const res = await POST(jsonRequest('http://t/api/marketplace-btp', 'POST', valid, 'jwt'))
    expect(res.status).toBe(201)
    const sb = await import('@/lib/supabase-clients')
    expect(sb.getAuthedClient).toHaveBeenCalledWith('jwt')
    expect(authedInsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'u1', title: 'Mini-pelle 1.5T' }))
  })
})

describe('PUT /api/marketplace-btp/[id]', () => {
  it('returns 401 when Bearer token is absent', async () => {
    const { PUT } = await import('@/app/api/marketplace-btp/[id]/route')
    const id = '11111111-1111-4111-8111-111111111111'
    const res = await PUT(
      jsonRequest(`http://t/api/marketplace-btp/${id}`, 'PUT', { title: 'x' }),
      { params: Promise.resolve({ id }) }
    )
    expect(res.status).toBe(401)
  })

  it('returns 400 on invalid UUID', async () => {
    const { PUT } = await import('@/app/api/marketplace-btp/[id]/route')
    const res = await PUT(
      jsonRequest('http://t/api/marketplace-btp/not-a-uuid', 'PUT', { title: 'x' }, 'jwt'),
      { params: Promise.resolve({ id: 'not-a-uuid' }) }
    )
    expect(res.status).toBe(400)
  })

  it('update routes through getAuthedClient (RLS-protected)', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null })
    authedUpdate.mockResolvedValueOnce({ data: { id: 'L1', title: 'New' }, error: null })
    const id = '11111111-1111-4111-8111-111111111111'
    const { PUT } = await import('@/app/api/marketplace-btp/[id]/route')
    const res = await PUT(
      jsonRequest(`http://t/api/marketplace-btp/${id}`, 'PUT', { title: 'New' }, 'jwt'),
      { params: Promise.resolve({ id }) }
    )
    expect(res.status).toBe(200)
    const sb = await import('@/lib/supabase-clients')
    expect(sb.getAuthedClient).toHaveBeenCalledWith('jwt')
  })
})

describe('DELETE /api/marketplace-btp/[id]', () => {
  it('returns 401 when Bearer token is absent', async () => {
    const { DELETE } = await import('@/app/api/marketplace-btp/[id]/route')
    const id = '11111111-1111-4111-8111-111111111111'
    const res = await DELETE(
      jsonRequest(`http://t/api/marketplace-btp/${id}`, 'DELETE', {}),
      { params: Promise.resolve({ id }) }
    )
    expect(res.status).toBe(401)
  })
})

describe('POST /api/marketplace-btp/[id]/demande', () => {
  it('returns 401 when Bearer token is absent', async () => {
    const { POST } = await import('@/app/api/marketplace-btp/[id]/demande/route')
    const id = '11111111-1111-4111-8111-111111111111'
    const res = await POST(
      jsonRequest(`http://t/api/marketplace-btp/${id}/demande`, 'POST', {}),
      { params: Promise.resolve({ id }) }
    )
    expect(res.status).toBe(401)
  })

  it('rejects buyer == seller (cannot apply to your own listing)', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: 'owner' } }, error: null })
    adminSelectListing.mockResolvedValueOnce({ data: { user_id: 'owner', title: 'X', vendeur_nom: 'A' } })
    const id = '11111111-1111-4111-8111-111111111111'
    const { POST } = await import('@/app/api/marketplace-btp/[id]/demande/route')
    const res = await POST(
      jsonRequest(`http://t/api/marketplace-btp/${id}/demande`, 'POST', { type_demande: 'location' }, 'jwt'),
      { params: Promise.resolve({ id }) }
    )
    expect(res.status).toBe(400)
  })

  it('insert demande goes through getAuthedClient on happy path', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: 'buyer' } }, error: null })
    adminSelectListing.mockResolvedValueOnce({ data: { user_id: 'seller', title: 'X', vendeur_nom: 'A' } })
    authedInsert.mockResolvedValueOnce({ data: { id: 'D1' }, error: null })
    const id = '11111111-1111-4111-8111-111111111111'
    const { POST } = await import('@/app/api/marketplace-btp/[id]/demande/route')
    const res = await POST(
      jsonRequest(`http://t/api/marketplace-btp/${id}/demande`, 'POST', { type_demande: 'location' }, 'jwt'),
      { params: Promise.resolve({ id }) }
    )
    expect(res.status).toBe(201)
    const sb = await import('@/lib/supabase-clients')
    expect(sb.getAuthedClient).toHaveBeenCalledWith('jwt')
    expect(authedInsert).toHaveBeenCalledWith(expect.objectContaining({ buyer_user_id: 'buyer', listing_id: id }))
  })
})

describe('PATCH /api/marketplace-btp/[id]/demande', () => {
  it('returns 403 when caller is not the listing owner', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: 'someone-else' } }, error: null })
    adminSelectListing.mockResolvedValueOnce({ data: { user_id: 'real-owner' } })
    const id = '11111111-1111-4111-8111-111111111111'
    const { PATCH } = await import('@/app/api/marketplace-btp/[id]/demande/route')
    const res = await PATCH(
      jsonRequest(`http://t/api/marketplace-btp/${id}/demande`, 'PATCH', { demande_id: 'D1', status: 'accepted' }, 'jwt'),
      { params: Promise.resolve({ id }) }
    )
    expect(res.status).toBe(403)
  })
})
