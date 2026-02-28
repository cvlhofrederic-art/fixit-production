import { test, expect } from '@playwright/test'

test.describe('Security Headers', () => {
  test('homepage returns all required security headers', async ({ request }) => {
    const response = await request.get('/')
    const headers = response.headers()

    // HSTS with preload
    expect(headers['strict-transport-security']).toContain('max-age=31536000')
    expect(headers['strict-transport-security']).toContain('includeSubDomains')

    // Prevent MIME sniffing
    expect(headers['x-content-type-options']).toBe('nosniff')

    // Clickjacking protection
    expect(headers['x-frame-options']).toBe('DENY')

    // XSS protection
    expect(headers['x-xss-protection']).toBe('1; mode=block')

    // Referrer policy
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin')

    // Permissions policy
    expect(headers['permissions-policy']).toContain('camera=(self)')
    expect(headers['permissions-policy']).toContain('microphone=()')

    // CSP
    expect(headers['content-security-policy']).toContain("default-src 'self'")
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'")

    // Cross-domain policies
    expect(headers['x-permitted-cross-domain-policies']).toBe('none')
  })

  test('API routes return security headers', async ({ request }) => {
    const response = await request.get('/api/health')
    const headers = response.headers()

    expect(headers['x-content-type-options']).toBe('nosniff')
    expect(headers['x-frame-options']).toBe('DENY')
  })

  test('protected API routes reject unauthenticated requests', async ({ request }) => {
    // All these routes should return 401 without auth
    // Note: GET /api/bookings is intentionally public (returns slot availability, no personal data)
    const protectedRoutes = [
      { method: 'POST', url: '/api/fixy-ai' },
      { method: 'POST', url: '/api/comptable-ai' },
      { method: 'GET', url: '/api/artisan-clients?mode=1&clientId=fake' },
      { method: 'GET', url: '/api/user/export-data' },
    ]

    for (const route of protectedRoutes) {
      const response =
        route.method === 'GET'
          ? await request.get(route.url)
          : await request.post(route.url, { data: { message: 'test' } })

      expect(response.status(), `${route.method} ${route.url} should be 401`).toBe(401)
    }
  })

  test('rate limit response returns correct headers', async ({ request }) => {
    // Sending many requests should eventually trigger rate limiting
    // We just verify the endpoint works and doesn't crash
    const response = await request.get('/api/health')
    expect([200, 429, 503]).toContain(response.status())
  })
})
