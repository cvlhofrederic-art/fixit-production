import { describe, it, expect } from 'vitest'
import { createCircuitBreaker } from '@/lib/circuit-breaker'

describe('Circuit Breaker', () => {
  it('should start in CLOSED state and allow calls', async () => {
    const breaker = createCircuitBreaker({ name: 'test1', failureThreshold: 3, resetTimeoutMs: 1000 })
    const result = await breaker(async () => 'success')
    expect(result).toBe('success')
  })

  it('should open after reaching failure threshold', async () => {
    const breaker = createCircuitBreaker({ name: 'test2', failureThreshold: 2, resetTimeoutMs: 5000 })

    // Fail twice to open the circuit
    for (let i = 0; i < 2; i++) {
      try { await breaker(async () => { throw new Error('fail') }) } catch {}
    }

    // Third call should be rejected immediately (circuit OPEN)
    await expect(breaker(async () => 'ok')).rejects.toThrow('Circuit breaker [test2] is OPEN')
  })

  it('should transition to HALF_OPEN after reset timeout', async () => {
    const breaker = createCircuitBreaker({ name: 'test3', failureThreshold: 1, resetTimeoutMs: 100 })

    try { await breaker(async () => { throw new Error('fail') }) } catch {}

    // Wait for reset timeout
    await new Promise(r => setTimeout(r, 150))

    // Should allow one call (HALF_OPEN → CLOSED on success)
    const result = await breaker(async () => 'recovered')
    expect(result).toBe('recovered')
  })
})
