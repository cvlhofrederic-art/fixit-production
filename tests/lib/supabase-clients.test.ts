import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const ORIGINAL_ENV = { ...process.env }

const createClientMock = vi.fn().mockReturnValue({ tag: 'fake-client' })
const getUserMock = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => {
    createClientMock(...args)
    return {
      auth: { getUser: getUserMock },
    }
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  process.env = { ...ORIGINAL_ENV }
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe('lib/supabase-clients', () => {
  it('getAdminClient throws when service-role key is missing', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    const { getAdminClient } = await import('@/lib/supabase-clients')
    expect(() => getAdminClient()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/)
  })

  it('getAdminClient creates a client with the service-role key', async () => {
    const { getAdminClient } = await import('@/lib/supabase-clients')
    getAdminClient()
    expect(createClientMock).toHaveBeenCalledWith('https://example.supabase.co', 'service-key')
  })

  it('getAnonClient throws when anon key is missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const { getAnonClient } = await import('@/lib/supabase-clients')
    expect(() => getAnonClient()).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/)
  })

  it('getAnonClient creates a client with the anon key', async () => {
    const { getAnonClient } = await import('@/lib/supabase-clients')
    getAnonClient()
    expect(createClientMock).toHaveBeenCalledWith('https://example.supabase.co', 'anon-key')
  })

  it('getBearerToken returns null when header is absent', async () => {
    const { getBearerToken } = await import('@/lib/supabase-clients')
    const req = { headers: { get: () => null } } as unknown as import('next/server').NextRequest
    expect(getBearerToken(req)).toBeNull()
  })

  it('getBearerToken parses "Bearer <token>" case-insensitively', async () => {
    const { getBearerToken } = await import('@/lib/supabase-clients')
    const req = { headers: { get: () => 'bearer abc.def' } } as unknown as import('next/server').NextRequest
    expect(getBearerToken(req)).toBe('abc.def')
  })

  it('getBearerToken returns null on empty bearer payload', async () => {
    const { getBearerToken } = await import('@/lib/supabase-clients')
    const req = { headers: { get: () => 'Bearer ' } } as unknown as import('next/server').NextRequest
    expect(getBearerToken(req)).toBeNull()
  })

  it('authenticateRequest returns null when no Bearer header', async () => {
    const { authenticateRequest } = await import('@/lib/supabase-clients')
    const req = { headers: { get: () => null } } as unknown as import('next/server').NextRequest
    expect(await authenticateRequest(req)).toBeNull()
  })

  it('authenticateRequest returns the user on valid token', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null })
    const { authenticateRequest } = await import('@/lib/supabase-clients')
    const req = { headers: { get: () => 'Bearer good-token' } } as unknown as import('next/server').NextRequest
    const user = await authenticateRequest(req)
    expect(user).toEqual({ id: 'u1' })
    expect(getUserMock).toHaveBeenCalledWith('good-token')
  })

  it('authenticateRequest returns null when getUser errors', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null }, error: { message: 'invalid' } })
    const { authenticateRequest } = await import('@/lib/supabase-clients')
    const req = { headers: { get: () => 'Bearer bad-token' } } as unknown as import('next/server').NextRequest
    expect(await authenticateRequest(req)).toBeNull()
  })

  it('getAuthedClient throws on empty token', async () => {
    const { getAuthedClient } = await import('@/lib/supabase-clients')
    expect(() => getAuthedClient('')).toThrow(/without a token/)
  })

  it('getAuthedClient passes Bearer header to createClient', async () => {
    const { getAuthedClient } = await import('@/lib/supabase-clients')
    getAuthedClient('jwt.value')
    expect(createClientMock).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'anon-key',
      expect.objectContaining({
        global: expect.objectContaining({
          headers: { Authorization: 'Bearer jwt.value' },
        }),
        auth: expect.objectContaining({ persistSession: false, autoRefreshToken: false }),
      })
    )
  })

  it('getAuthedClient throws when anon key is missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const { getAuthedClient } = await import('@/lib/supabase-clients')
    expect(() => getAuthedClient('jwt.value')).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/)
  })
})
