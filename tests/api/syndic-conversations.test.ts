import { describe, it, expect } from 'vitest'

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000'

describe('/api/syndic/conversations', () => {
  it.skip('GET refuse anonyme avec 401 (requires running server)', async () => {
    const res = await fetch(`${BASE}/api/syndic/conversations`)
    expect(res.status).toBe(401)
  })

  it.skip('POST avec body invalide retourne 400 ou 401', async () => {
    const res = await fetch(`${BASE}/api/syndic/conversations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ agent_id: 'invalid' }),
    })
    expect([400, 401]).toContain(res.status)
  })

  it('module loads sans erreur', async () => {
    const mod = await import('@/app/api/syndic/conversations/route')
    expect(typeof mod.GET).toBe('function')
    expect(typeof mod.POST).toBe('function')
  })

  it('module [id] loads', async () => {
    const mod = await import('@/app/api/syndic/conversations/[id]/route')
    expect(typeof mod.GET).toBe('function')
    expect(typeof mod.PATCH).toBe('function')
    expect(typeof mod.DELETE).toBe('function')
  })

  it('module messages loads', async () => {
    const mod = await import('@/app/api/syndic/conversations/[id]/messages/route')
    expect(typeof mod.GET).toBe('function')
    expect(typeof mod.POST).toBe('function')
  })
})
