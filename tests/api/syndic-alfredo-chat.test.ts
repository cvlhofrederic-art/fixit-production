import { describe, it, expect } from 'vitest'

describe('/api/syndic/alfredo-chat', () => {
  it('module loads', async () => {
    const mod = await import('@/app/api/syndic/alfredo-chat/route')
    expect(typeof mod.POST).toBe('function')
  })
})
