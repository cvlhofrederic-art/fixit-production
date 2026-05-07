import { describe, it, expect, vi, beforeEach } from 'vitest'

const circuitStateMock = vi.fn()
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    debug: vi.fn(),
    api: vi.fn(),
    withTenant: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
    withTiming: async <T,>(_n: string, fn: () => Promise<T>) => fn(),
    circuitState: (...args: unknown[]) => circuitStateMock(...args),
  },
}))

import { createCircuitBreaker } from '@/lib/circuit-breaker'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Circuit Breaker — execution semantics', () => {
  it('should start in CLOSED state and allow calls', async () => {
    const breaker = createCircuitBreaker({ name: 'test1', failureThreshold: 3, resetTimeoutMs: 1000 })
    const result = await breaker(async () => 'success')
    expect(result).toBe('success')
  })

  it('should open after reaching failure threshold', async () => {
    const breaker = createCircuitBreaker({ name: 'test2', failureThreshold: 2, resetTimeoutMs: 5000 })

    // Fail twice to open the circuit
    for (let i = 0; i < 2; i++) {
      try { await breaker(async () => { throw new Error('fail') }) } catch { /* expected */ }
    }

    // Third call should be rejected immediately (circuit OPEN)
    await expect(breaker(async () => 'ok')).rejects.toThrow('Circuit breaker [test2] is OPEN')
  })

  it('should transition to HALF_OPEN after reset timeout', async () => {
    const breaker = createCircuitBreaker({ name: 'test3', failureThreshold: 1, resetTimeoutMs: 100 })

    try { await breaker(async () => { throw new Error('fail') }) } catch { /* expected */ }

    // Wait for reset timeout
    await new Promise(r => setTimeout(r, 150))

    // Should allow one call (HALF_OPEN → CLOSED on success)
    const result = await breaker(async () => 'recovered')
    expect(result).toBe('recovered')
  })
})

describe('Circuit Breaker — observability (logger.circuitState)', () => {
  it('does not call circuitState when the breaker stays CLOSED across successful runs', async () => {
    const breaker = createCircuitBreaker({ name: 'obs-stable', failureThreshold: 5, resetTimeoutMs: 1000 })
    await breaker(async () => 'ok')
    await breaker(async () => 'ok')
    await breaker(async () => 'ok')
    expect(circuitStateMock).not.toHaveBeenCalled()
  })

  it('emits circuitState(OPEN) once when the threshold is reached', async () => {
    const breaker = createCircuitBreaker({ name: 'obs-open', failureThreshold: 2, resetTimeoutMs: 5000 })
    for (let i = 0; i < 2; i++) {
      try { await breaker(async () => { throw new Error('fail') }) } catch { /* expected */ }
    }
    expect(circuitStateMock).toHaveBeenCalledWith('obs-open', 'OPEN')
    // Subsequent failures do not re-emit OPEN.
    try { await breaker(async () => { throw new Error('fail') }) } catch { /* expected */ }
    const openCalls = circuitStateMock.mock.calls.filter((c) => c[1] === 'OPEN')
    expect(openCalls).toHaveLength(1)
  })

  it('emits HALF_OPEN then CLOSED on recovery', async () => {
    const breaker = createCircuitBreaker({ name: 'obs-recover', failureThreshold: 1, resetTimeoutMs: 50 })
    try { await breaker(async () => { throw new Error('fail') }) } catch { /* expected */ }
    expect(circuitStateMock).toHaveBeenCalledWith('obs-recover', 'OPEN')

    await new Promise((r) => setTimeout(r, 80))
    await breaker(async () => 'ok')

    const states = circuitStateMock.mock.calls.map((c) => c[1])
    expect(states).toContain('HALF_OPEN')
    expect(states).toContain('CLOSED')
    // Order: OPEN → HALF_OPEN → CLOSED
    expect(states.indexOf('HALF_OPEN')).toBeGreaterThan(states.indexOf('OPEN'))
    expect(states.indexOf('CLOSED')).toBeGreaterThan(states.indexOf('HALF_OPEN'))
  })
})
