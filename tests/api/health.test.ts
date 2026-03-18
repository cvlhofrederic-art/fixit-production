import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase before importing the route
vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data: [{ id: 1 }], error: null }),
      }),
    }),
  },
}))

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.resetModules()
    // Set required env vars for health check
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
  })

  it('should return 200 with health status', async () => {
    const { GET } = await import('@/app/api/health/route')
    const response = await GET()
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data).toHaveProperty('status')
    expect(data.status).toBe('healthy')
  })

  it('should return checks object', async () => {
    const { GET } = await import('@/app/api/health/route')
    const response = await GET()
    const data = await response.json()
    expect(data).toHaveProperty('checks')
    expect(data.checks).toHaveProperty('database')
    expect(data.checks).toHaveProperty('environment')
  })

  it('should return version and uptime', async () => {
    const { GET } = await import('@/app/api/health/route')
    const response = await GET()
    const data = await response.json()
    expect(data).toHaveProperty('timestamp')
    expect(data).toHaveProperty('uptime_seconds')
    expect(data).toHaveProperty('version')
  })
})
