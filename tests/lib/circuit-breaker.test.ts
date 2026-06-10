import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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

  // ── Régression audit 2026-06-10 ──────────────────────────────────────────
  it('reste fermé sur succès et garde le compteur d\'échecs sous le seuil', async () => {
    const breaker = createCircuitBreaker({ name: 'test4', failureThreshold: 3, resetTimeoutMs: 1000 })
    try { await breaker(async () => { throw new Error('fail') }) } catch {}
    // 1 échec < seuil 3 → toujours fermé, l'appel suivant passe
    const result = await breaker(async () => 'ok')
    expect(result).toBe('ok')
  })

  it('un échec en HALF_OPEN ré-ouvre le breaker', async () => {
    const breaker = createCircuitBreaker({ name: 'test5', failureThreshold: 1, resetTimeoutMs: 100 })
    try { await breaker(async () => { throw new Error('fail') }) } catch {} // → OPEN
    await new Promise(r => setTimeout(r, 150)) // reset → prochain appel HALF_OPEN
    // L'appel test échoue → doit ré-ouvrir
    try { await breaker(async () => { throw new Error('still down') }) } catch {}
    // Immédiatement après, rejet rapide (OPEN)
    await expect(breaker(async () => 'ok')).rejects.toThrow('is OPEN')
  })
})

// ── Backend Redis (état partagé entre isolates) — fix F08 ───────────────────
describe('Circuit Breaker — backend Redis (mocké)', () => {
  const store = new Map<string, unknown>()
  const get = vi.fn(async (k: string) => (store.has(k) ? store.get(k) : null))
  const set = vi.fn(async (k: string, v: unknown) => { store.set(k, v); return 'OK' })

  beforeEach(() => {
    vi.resetModules()
    store.clear()
    get.mockClear()
    set.mockClear()
    process.env.UPSTASH_REDIS_REST_URL = 'https://mock'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'mock'
    vi.doMock('@upstash/redis', () => ({
      Redis: class { get = get; set = set },
    }))
  })
  afterEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
    vi.doUnmock('@upstash/redis')
  })

  it('lit l\'état dans Redis à chaque appel et n\'écrit PAS si rien ne change', async () => {
    const { createCircuitBreaker: make } = await import('@/lib/circuit-breaker')
    const breaker = make({ name: 'redis1', failureThreshold: 3, resetTimeoutMs: 1000 })
    await breaker(async () => 'ok')
    expect(get).toHaveBeenCalledTimes(1)      // 1 lecture par appel
    expect(set).not.toHaveBeenCalled()        // succès déjà CLOSED → pas d'écriture
  })

  it('persiste l\'état OPEN dans Redis (partagé entre isolates)', async () => {
    const { createCircuitBreaker: make } = await import('@/lib/circuit-breaker')
    const breaker = make({ name: 'redis2', failureThreshold: 2, resetTimeoutMs: 5000 })
    for (let i = 0; i < 2; i++) {
      try { await breaker(async () => { throw new Error('fail') }) } catch {}
    }
    const persisted = store.get('fixit:cb:redis2') as { state: string; failures: number }
    expect(persisted.state).toBe('OPEN')
    expect(persisted.failures).toBe(2)
    // Un autre breaker (= autre isolate) lisant la même clé voit OPEN → rejet rapide
    const otherIsolate = make({ name: 'redis2', failureThreshold: 2, resetTimeoutMs: 5000 })
    await expect(otherIsolate(async () => 'ok')).rejects.toThrow('is OPEN')
  })
})
