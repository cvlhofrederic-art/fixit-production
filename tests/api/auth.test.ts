import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase
const mockResetPassword = vi.fn().mockResolvedValue({ error: null })
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn().mockReturnValue({
    auth: {
      resetPasswordForEmail: mockResetPassword,
    },
  }),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: vi.fn().mockReturnValue([]),
    set: vi.fn(),
  }),
}))

describe('POST /api/auth/reset-password', () => {
  beforeEach(() => {
    mockResetPassword.mockClear()
  })

  it('should return 400 when email is missing', async () => {
    const { POST } = await import('@/app/api/auth/reset-password/route')
    const request = new Request('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await POST(request as never)
    expect(response.status).toBe(400)
  })

  it('should return 200 with valid email', async () => {
    const { POST } = await import('@/app/api/auth/reset-password/route')
    const request = new Request('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await POST(request as never)
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.message).toBeDefined()
  })
})
