import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const captureMock = vi.fn()
const flushMock = vi.fn().mockResolvedValue(undefined)

vi.mock('posthog-node', () => {
  class FakePostHog {
    apiKey: string
    opts: Record<string, unknown>
    constructor(apiKey: string, opts: Record<string, unknown>) {
      this.apiKey = apiKey
      this.opts = opts
    }
    capture(...args: unknown[]) {
      return captureMock(...args)
    }
    flush(...args: unknown[]) {
      return flushMock(...args)
    }
  }
  return { PostHog: FakePostHog }
})

const ORIGINAL_ENV = { ...process.env }

beforeEach(async () => {
  vi.clearAllMocks()
  vi.resetModules()
  process.env = { ...ORIGINAL_ENV }
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe('lib/posthog/server', () => {
  it('captureServer is a no-op when no key env is present', async () => {
    delete process.env.POSTHOG_API_KEY
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY
    const mod = await import('@/lib/posthog/server')
    await mod.captureServer({ event: 'devis_created', distinctId: 'u1' })
    expect(captureMock).not.toHaveBeenCalled()
  })

  it('captureServer instantiates PostHog Node and forwards', async () => {
    process.env.POSTHOG_API_KEY = 'phc_server'
    const mod = await import('@/lib/posthog/server')
    await mod.captureServer({
      event: 'devis_created',
      distinctId: 'artisan-1',
      properties: { numero: 'D-2026-0001' },
    })
    expect(captureMock).toHaveBeenCalledWith(expect.objectContaining({
      event: 'devis_created',
      distinctId: 'artisan-1',
      properties: { numero: 'D-2026-0001' },
    }))
  })

  it('captureServer falls back to the public key when only that one is set', async () => {
    delete process.env.POSTHOG_API_KEY
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_public'
    const mod = await import('@/lib/posthog/server')
    await mod.captureServer({ event: 'subscription_started', distinctId: 'u1' })
    expect(captureMock).toHaveBeenCalledTimes(1)
  })

  it('captureServer never throws when capture itself fails', async () => {
    process.env.POSTHOG_API_KEY = 'phc_server'
    captureMock.mockImplementationOnce(() => { throw new Error('network down') })
    const mod = await import('@/lib/posthog/server')
    await expect(mod.captureServer({ event: 'devis_created', distinctId: 'u1' })).resolves.toBeUndefined()
  })

  it('flushServer flushes when client exists, no-op otherwise', async () => {
    process.env.POSTHOG_API_KEY = 'phc_server'
    const mod = await import('@/lib/posthog/server')
    await mod.captureServer({ event: 'devis_created', distinctId: 'u1' })
    await mod.flushServer()
    expect(flushMock).toHaveBeenCalledTimes(1)
  })
})
