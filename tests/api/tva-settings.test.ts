import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

const authedSelectSingle = vi.fn()
const authedUpdate = vi.fn()

const authedFromMock = vi.fn().mockImplementation((table: string) => {
  if (table !== 'profiles_artisan') throw new Error(`unexpected table ${table}`)
  return {
    select: () => ({ eq: () => ({ single: () => authedSelectSingle() }) }),
    update: (payload: unknown) => ({ eq: () => authedUpdate(payload) }),
  }
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

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
  getClientIP: () => '1.2.3.4',
  rateLimitResponse: () => new Response(JSON.stringify({ error: 'rate' }), { status: 429 }),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

function makeRequest(method: 'GET' | 'PATCH', body?: unknown, token?: string): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  return new Request('https://test.local/api/tva/settings', {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }) as unknown as NextRequest
}

describe('GET /api/tva/settings', () => {
  it('returns 401 when Bearer token is absent', async () => {
    const { GET } = await import('@/app/api/tva/settings/route')
    const res = await GET(makeRequest('GET'))
    expect(res.status).toBe(401)
  })

  it('returns the profile fields via getAuthedClient (RLS-protected)', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null })
    authedSelectSingle.mockResolvedValueOnce({
      data: { tva_auto_activate: true, tva_notified_level: null },
      error: null,
    })
    const { GET } = await import('@/app/api/tva/settings/route')
    const res = await GET(makeRequest('GET', undefined, 'jwt'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ tva_auto_activate: true, tva_notified_level: null })
    const sb = await import('@/lib/supabase-clients')
    expect(sb.getAuthedClient).toHaveBeenCalledWith('jwt')
  })

  it('returns 404 when the row is not found (RLS may filter it)', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null })
    authedSelectSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'no rows', code: 'PGRST116' },
    })
    const { GET } = await import('@/app/api/tva/settings/route')
    const res = await GET(makeRequest('GET', undefined, 'jwt'))
    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/tva/settings', () => {
  it('returns 400 on invalid Zod body', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null })
    const { PATCH } = await import('@/app/api/tva/settings/route')
    const res = await PATCH(makeRequest('PATCH', { wrong: 'shape' }, 'jwt'))
    expect(res.status).toBe(400)
  })

  it('updates via getAuthedClient on happy path', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null })
    authedUpdate.mockResolvedValueOnce({ error: null })
    const { PATCH } = await import('@/app/api/tva/settings/route')
    const res = await PATCH(makeRequest('PATCH', { tva_auto_activate: false }, 'jwt'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ success: true, tva_auto_activate: false })
    expect(authedUpdate).toHaveBeenCalledWith({ tva_auto_activate: false })
  })
})
