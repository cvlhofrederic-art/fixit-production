import { describe, it, expect, vi, beforeEach } from 'vitest'

const breadcrumbMock = vi.fn()
const captureMessageMock = vi.fn()

vi.mock('@sentry/nextjs', () => ({
  addBreadcrumb: (...args: unknown[]) => breadcrumbMock(...args),
  captureMessage: (...args: unknown[]) => captureMessageMock(...args),
  captureException: vi.fn(),
  withScope: (cb: (scope: { setLevel: () => void; setTag: () => void; setUser: () => void; setExtras: () => void }) => void) => {
    cb({ setLevel: vi.fn(), setTag: vi.fn(), setUser: vi.fn(), setExtras: vi.fn() })
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('logger.withTiming', () => {
  it('logs latency and adds a Sentry breadcrumb on success', async () => {
    const { logger } = await import('@/lib/logger')
    const result = await logger.withTiming('api/devis/sync', async () => 42)
    expect(result).toBe(42)
    expect(breadcrumbMock).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'timing',
        message: 'api/devis/sync',
        data: expect.objectContaining({ latency_ms: expect.any(Number) }),
      })
    )
  })

  it('rethrows the original error and warns', async () => {
    const { logger } = await import('@/lib/logger')
    await expect(
      logger.withTiming('api/scan', async () => {
        throw new Error('boamp 503')
      })
    ).rejects.toThrow('boamp 503')
  })

  it('passes through the inner Promise resolution value', async () => {
    const { logger } = await import('@/lib/logger')
    const obj = { id: 'x' }
    const result = await logger.withTiming('lookup', async () => obj)
    expect(result).toBe(obj)
  })
})

describe('logger.circuitState', () => {
  it('captures a Sentry message tagged with circuit + state on OPEN', async () => {
    const { logger } = await import('@/lib/logger')
    logger.circuitState('groq', 'OPEN')
    expect(captureMessageMock).toHaveBeenCalledWith(
      'circuit groq OPEN',
      expect.objectContaining({ level: 'warning' })
    )
  })

  it('uses level=info on CLOSED transitions', async () => {
    const { logger } = await import('@/lib/logger')
    logger.circuitState('groq', 'CLOSED')
    expect(captureMessageMock).toHaveBeenCalledWith(
      'circuit groq CLOSED',
      expect.objectContaining({ level: 'info' })
    )
  })
})
