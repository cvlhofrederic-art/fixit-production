import { describe, it, expect } from 'vitest'

describe('/api/email-agent/webhook', () => {
  it('module loads', async () => {
    const mod = await import('@/app/api/email-agent/webhook/route')
    expect(typeof mod.POST).toBe('function')
  })

  it.todo('rejette si x-gmail-webhook-token absent → 401')
  it.todo('rejette si body.message.data invalide → 400')
  it.todo('retourne ignored si aucun syndic pour cet email')
  it.todo('déclenche poll si syndic trouvé')
})
