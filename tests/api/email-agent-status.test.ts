import { describe, it, expect } from 'vitest'

describe('/api/email-agent/status', () => {
  it('module loads and exports GET', async () => {
    const mod = await import('@/app/api/email-agent/status/route')
    expect(typeof mod.GET).toBe('function')
  })
})
