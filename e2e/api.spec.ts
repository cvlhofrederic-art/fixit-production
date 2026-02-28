import { test, expect } from '@playwright/test'

test.describe('API endpoint smoke tests', () => {
  test('GET /api/health returns 200 or 503 with JSON body', async ({ request }) => {
    const response = await request.get('/api/health')

    // Health endpoint returns 200 when healthy, 503 when degraded
    expect([200, 503]).toContain(response.status())

    const body = await response.json()
    expect(body).toHaveProperty('status')
    expect(body).toHaveProperty('timestamp')
    expect(body).toHaveProperty('checks')
    expect(['healthy', 'degraded']).toContain(body.status)
  })

  test('GET /api/verify-siret without params returns 400', async ({ request }) => {
    const response = await request.get('/api/verify-siret')
    expect(response.status()).toBe(400)

    const body = await response.json()
    expect(body).toHaveProperty('error')
    expect(body.error).toContain('SIRET')
  })

  test('GET /api/verify-siret with invalid SIRET returns error', async ({ request }) => {
    const response = await request.get('/api/verify-siret?siret=invalid')
    const body = await response.json()

    // The API returns 200 with verified: false for format errors
    expect(body).toHaveProperty('verified', false)
    expect(body).toHaveProperty('error')
  })

  test('POST /api/fixy-ai without auth returns 401', async ({ request }) => {
    const response = await request.post('/api/fixy-ai', {
      data: { message: 'test' },
    })
    expect(response.status()).toBe(401)
  })

  test('POST /api/comptable-ai without auth returns 401', async ({ request }) => {
    const response = await request.post('/api/comptable-ai', {
      data: { message: 'test' },
    })
    expect(response.status()).toBe(401)
  })

  test('GET /api/bookings without auth returns 401', async ({ request }) => {
    const response = await request.get('/api/bookings')
    expect(response.status()).toBe(401)
  })
})
