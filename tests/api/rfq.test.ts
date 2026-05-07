import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

const authedSelect = vi.fn()
const rfqsInsertSingle = vi.fn()
const itemsInsertSelect = vi.fn()
const suppliersSelect = vi.fn()
const offersInsertSelect = vi.fn()

const authedFromMock = vi.fn().mockImplementation((table: string) => {
  if (table === 'rfqs') {
    return {
      select: () => ({
        eq: () => ({
          order: () => authedSelect(),
        }),
      }),
      insert: () => ({
        select: () => ({
          single: () => rfqsInsertSingle(),
        }),
      }),
    }
  }
  if (table === 'rfq_items') {
    return {
      insert: () => ({
        select: () => itemsInsertSelect(),
      }),
    }
  }
  if (table === 'suppliers') {
    return {
      select: () => ({
        eq: () => ({
          eq: () => suppliersSelect(),
        }),
      }),
    }
  }
  if (table === 'offers') {
    return {
      insert: () => ({
        select: () => offersInsertSelect(),
      }),
    }
  }
  throw new Error(`unexpected table ${table}`)
})

const getUserMock = vi.fn()

vi.mock('@/lib/supabase-clients', () => ({
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

const sendRFQMock = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/email-rfq', () => ({
  sendRFQToSuppliers: sendRFQMock,
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
  getClientIP: () => '1.2.3.4',
  rateLimitResponse: () => new Response(JSON.stringify({ error: 'rate' }), { status: 429 }),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

function makeRequest(method: 'GET' | 'POST', body: unknown, token?: string): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const init: RequestInit = { method, headers }
  if (method !== 'GET' && body !== null && body !== undefined) {
    init.body = JSON.stringify(body)
  }
  return new Request('https://test.local/api/rfq', init) as unknown as NextRequest
}

describe('GET /api/rfq', () => {
  it('returns 401 without Bearer token', async () => {
    const { GET } = await import('@/app/api/rfq/route')
    const res = await GET(makeRequest('GET', null))
    expect(res.status).toBe(401)
  })

  it('returns rfqs via getAuthedClient (RLS-protected)', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null })
    authedSelect.mockResolvedValueOnce({ data: [{ id: 'r1' }], error: null })
    const { GET } = await import('@/app/api/rfq/route')
    const res = await GET(makeRequest('GET', null, 'jwt'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.rfqs).toEqual([{ id: 'r1' }])
    const sb = await import('@/lib/supabase-clients')
    expect(sb.getAuthedClient).toHaveBeenCalledWith('jwt')
  })
})

describe('POST /api/rfq', () => {
  it('returns 401 without Bearer token', async () => {
    const { POST } = await import('@/app/api/rfq/route')
    const res = await POST(makeRequest('POST', { title: 'x', country: 'FR', items: [{ product_name: 'a', quantity: 1, unit: 'u' }] }))
    expect(res.status).toBe(401)
  })

  it('returns 400 on invalid Zod body', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null })
    const { POST } = await import('@/app/api/rfq/route')
    const res = await POST(makeRequest('POST', { foo: 'bar' }, 'jwt'))
    expect(res.status).toBe(400)
  })

  it('happy path: creates rfq + items + offers via authedClient', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null })
    rfqsInsertSingle.mockResolvedValueOnce({ data: { id: 'r1' }, error: null })
    itemsInsertSelect.mockResolvedValueOnce({ data: [{ id: 'i1' }], error: null })
    suppliersSelect.mockResolvedValueOnce({ data: [{ id: 's1', name: 'Supp', email: 's@x.com' }], error: null })
    offersInsertSelect.mockResolvedValueOnce({ data: [{ supplier_id: 's1', supplier_name: 'Supp', supplier_email: 's@x.com', token: 't1' }], error: null })
    const valid = { title: 'Test', country: 'FR', items: [{ product_name: 'Bois', quantity: 10, unit: 'm' }] }
    const { POST } = await import('@/app/api/rfq/route')
    const res = await POST(makeRequest('POST', valid, 'jwt'))
    expect(res.status).toBe(201)
    const sb = await import('@/lib/supabase-clients')
    expect(sb.getAuthedClient).toHaveBeenCalledWith('jwt')
    expect(sendRFQMock).toHaveBeenCalled()
  })
})
