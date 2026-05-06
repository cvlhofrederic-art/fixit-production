import { describe, it, expect, vi, beforeEach } from 'vitest'

const metricsQuery = vi.fn()

const fromMock = vi.fn().mockImplementation((table: string) => {
  if (table === 'subscription_metrics') {
    return {
      select: () => ({
        gte: () => ({
          order: () => metricsQuery(),
        }),
      }),
    }
  }
  throw new Error(`unexpected table ${table}`)
})

vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: { from: fromMock },
}))

const getAuthUserMock = vi.fn()
const isSuperAdminMock = vi.fn()
vi.mock('@/lib/auth-helpers', () => ({
  getAuthUser: (...args: unknown[]) => getAuthUserMock(...args),
  isSuperAdmin: (...args: unknown[]) => isSuperAdminMock(...args),
  unauthorizedResponse: () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
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

function makeRequest(): Request {
  return new Request('http://localhost/api/admin/revenue', { method: 'GET' })
}

describe('GET /api/admin/revenue', () => {
  it('returns 401 when caller is not super-admin', async () => {
    getAuthUserMock.mockResolvedValueOnce({ id: 'u1' })
    isSuperAdminMock.mockReturnValueOnce(false)
    const { GET } = await import('@/app/api/admin/revenue/route')
    const res = await GET(makeRequest() as never)
    expect(res.status).toBe(401)
  })

  it('returns available:false when subscription_metrics table is missing', async () => {
    getAuthUserMock.mockResolvedValueOnce({ id: 'admin' })
    isSuperAdminMock.mockReturnValueOnce(true)
    metricsQuery.mockResolvedValueOnce({ data: null, error: { code: '42P01', message: 'relation does not exist' } })
    const { GET } = await import('@/app/api/admin/revenue/route')
    const res = await GET(makeRequest() as never)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.available).toBe(false)
    expect(body.series).toEqual([])
  })

  it('returns the latest snapshot and series on happy path', async () => {
    getAuthUserMock.mockResolvedValueOnce({ id: 'admin' })
    isSuperAdminMock.mockReturnValueOnce(true)
    const series = [
      { date: '2026-05-06', active_count: 10, mrr_cents: 49000, churn_count: 1, new_count: 2, trial_count: 1, past_due_count: 0, snapshot_at: '2026-05-06T00:00:00Z' },
      { date: '2026-05-05', active_count: 9,  mrr_cents: 44100, churn_count: 0, new_count: 1, trial_count: 1, past_due_count: 0, snapshot_at: '2026-05-05T00:00:00Z' },
    ]
    metricsQuery.mockResolvedValueOnce({ data: series, error: null })
    const { GET } = await import('@/app/api/admin/revenue/route')
    const res = await GET(makeRequest() as never)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.available).toBe(true)
    expect(body.latest.date).toBe('2026-05-06')
    expect(body.series).toHaveLength(2)
  })
})
