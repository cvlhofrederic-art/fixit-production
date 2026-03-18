import { vi } from 'vitest'

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
  checkRateLimitAsync: vi.fn().mockResolvedValue(true),
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
  rateLimitResponse: vi.fn().mockReturnValue(
    new Response(JSON.stringify({ error: 'Trop de requêtes' }), { status: 429 })
  ),
}))
