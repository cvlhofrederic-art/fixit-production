import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock stripe — must use function() not arrow for constructor
vi.mock('stripe', () => {
  const mockStripe = function() {
    return {
      checkout: { sessions: { create: vi.fn() } },
      billingPortal: { sessions: { create: vi.fn() } },
      subscriptions: { retrieve: vi.fn() },
      webhooks: { constructEvent: vi.fn().mockImplementation(function() { throw new Error('Invalid signature') }) },
    }
  }
  return { default: mockStripe }
})

vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }),
  },
}))

vi.mock('@/lib/auth-helpers', () => ({
  getAuthUser: vi.fn().mockResolvedValue(null),
}))

describe('Stripe API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/stripe/subscription', () => {
    it('should return 401 without auth', async () => {
      const { GET } = await import('@/app/api/stripe/subscription/route')
      const request = new Request('http://localhost:3000/api/stripe/subscription')
      const response = await GET(request as never)
      expect(response.status).toBe(401)
    })
  })

  describe('POST /api/stripe/checkout', () => {
    it('should return 401 without auth', async () => {
      const { POST } = await import('@/app/api/stripe/checkout/route')
      const request = new Request('http://localhost:3000/api/stripe/checkout', {
        method: 'POST',
        body: JSON.stringify({ planId: 'artisan_pro' }),
        headers: { 'Content-Type': 'application/json' },
      })
      const response = await POST(request as never)
      expect(response.status).toBe(401)
    })
  })

  describe('POST /api/stripe/portal', () => {
    it('should return 401 without auth', async () => {
      const { POST } = await import('@/app/api/stripe/portal/route')
      const request = new Request('http://localhost:3000/api/stripe/portal', { method: 'POST' })
      const response = await POST(request as never)
      expect(response.status).toBe(401)
    })
  })

  describe('POST /api/stripe/webhook', () => {
    it('should return 400 without stripe signature', async () => {
      const { POST } = await import('@/app/api/stripe/webhook/route')
      const request = new Request('http://localhost:3000/api/stripe/webhook', {
        method: 'POST',
        body: '{}',
      })
      const response = await POST(request as never)
      expect(response.status).toBe(400)
    })
  })
})
