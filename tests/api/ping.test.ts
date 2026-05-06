import { describe, it, expect } from 'vitest'

describe('GET /api/ping', () => {
  it('returns 200 with status ok and a numeric ts', async () => {
    const { GET } = await import('@/app/api/ping/route')
    const response = await GET()
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.status).toBe('ok')
    expect(typeof data.ts).toBe('number')
    expect(data.ts).toBeGreaterThan(0)
  })

  it('sets cache-control no-store', async () => {
    const { GET } = await import('@/app/api/ping/route')
    const response = await GET()
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('HEAD returns 200 empty', async () => {
    const { HEAD } = await import('@/app/api/ping/route')
    const response = await HEAD()
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
  })
})
