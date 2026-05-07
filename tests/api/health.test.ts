import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const dbSelect = vi.fn().mockResolvedValue({ data: [{ id: 1 }], error: null })

vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        limit: () => dbSelect(),
      }),
    }),
  },
}))

const getCircuitStateMock = vi.fn().mockReturnValue(null)
vi.mock('@/lib/circuit-breaker', () => ({
  getCircuitState: (name: string) => getCircuitStateMock(name),
}))

const ORIGINAL_ENV = { ...process.env }
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  process.env = { ...ORIGINAL_ENV }
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
  delete process.env.STRIPE_SECRET_KEY
  delete process.env.UPSTASH_REDIS_REST_URL
  delete process.env.UPSTASH_REDIS_REST_TOKEN
  dbSelect.mockResolvedValue({ data: [{ id: 1 }], error: null })
  getCircuitStateMock.mockReturnValue(null)

  fetchMock = vi.fn()
  ;(globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe('GET /api/health', () => {
  it('returns 200 healthy when DB ok and external deps are skipped', async () => {
    const { GET } = await import('@/app/api/health/route')
    const response = await GET()
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.status).toBe('healthy')
    expect(data.checks.database.status).toBe('healthy')
    expect(data.checks.stripe.status).toBe('skipped')
    expect(data.checks.upstash.status).toBe('skipped')
    expect(data.checks.groq.status).toBe('skipped')
  })

  it('returns 503 unhealthy when database query errors', async () => {
    dbSelect.mockResolvedValueOnce({ data: null, error: { message: 'connection refused' } })
    const { GET } = await import('@/app/api/health/route')
    const response = await GET()
    expect(response.status).toBe(503)
    const data = await response.json()
    expect(data.status).toBe('unhealthy')
    expect(data.checks.database.status).toBe('unhealthy')
  })

  it('returns 503 when env vars are missing', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    const { GET } = await import('@/app/api/health/route')
    const response = await GET()
    expect(response.status).toBe(503)
    const data = await response.json()
    expect(data.checks.environment.status).toBe('unhealthy')
  })

  it('returns 207 degraded when groq circuit is OPEN but DB ok', async () => {
    getCircuitStateMock.mockReturnValueOnce({
      state: 'OPEN',
      failures: 5,
      last_success_at: null,
      last_failure_at: new Date().toISOString(),
    })
    const { GET } = await import('@/app/api/health/route')
    const response = await GET()
    expect(response.status).toBe(207)
    const data = await response.json()
    expect(data.status).toBe('degraded')
    expect(data.checks.groq.status).toBe('warn')
  })

  it('runs the Stripe ping when STRIPE_SECRET_KEY is present', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_xx'
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }))
    const { GET } = await import('@/app/api/health/route')
    const response = await GET()
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.checks.stripe.status).toBe('healthy')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.stripe.com/v1/balance',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer sk_test_xx' }),
      })
    )
  })

  it('reports stripe as warn when API returns non-200', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_xx'
    fetchMock.mockResolvedValueOnce(new Response('error', { status: 502 }))
    const { GET } = await import('@/app/api/health/route')
    const response = await GET()
    // Stripe is non-critical so we degrade, not fail.
    expect(response.status).toBe(207)
    const data = await response.json()
    expect(data.checks.stripe.status).toBe('warn')
  })

  it('checks Upstash via REST PING when configured', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://upstash.test'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test_token'
    fetchMock.mockResolvedValueOnce(new Response('{"result":"PONG"}', { status: 200 }))
    const { GET } = await import('@/app/api/health/route')
    const response = await GET()
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.checks.upstash.status).toBe('healthy')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://upstash.test/PING',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test_token' }),
      })
    )
  })
})
