import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Vague 3 audit 2026-06-10 : store distribué des confirmations Fixy AI.
// Sans env Upstash, le module utilise le fallback mémoire — c'est ce chemin
// qu'on teste ici (le chemin Redis est le même contrat : set EX + GETDEL).

describe('lib/pending-confirmations (fallback mémoire)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.resetModules()
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  async function loadModule() {
    return await import('@/lib/pending-confirmations')
  }

  it('store puis consume retourne la confirmation', async () => {
    const { storePendingConfirmation, consumePendingConfirmation } = await loadModule()
    await storePendingConfirmation('tok-1', { tool: 'create_devis', params: { a: 1 }, artisanId: 'art-1' })
    const out = await consumePendingConfirmation('tok-1')
    expect(out).toEqual({ tool: 'create_devis', params: { a: 1 }, artisanId: 'art-1' })
  })

  it('consume est à usage unique (2e appel → null)', async () => {
    const { storePendingConfirmation, consumePendingConfirmation } = await loadModule()
    await storePendingConfirmation('tok-2', { tool: 'delete_booking', params: {}, artisanId: 'art-1' })
    expect(await consumePendingConfirmation('tok-2')).not.toBeNull()
    expect(await consumePendingConfirmation('tok-2')).toBeNull()
  })

  it('token inconnu → null', async () => {
    const { consumePendingConfirmation } = await loadModule()
    expect(await consumePendingConfirmation('inconnu')).toBeNull()
  })

  it('token expiré (> 5 min) → null', async () => {
    const { storePendingConfirmation, consumePendingConfirmation } = await loadModule()
    await storePendingConfirmation('tok-3', { tool: 'create_devis', params: {}, artisanId: 'art-1' })
    vi.advanceTimersByTime(5 * 60 * 1000 + 1)
    expect(await consumePendingConfirmation('tok-3')).toBeNull()
  })
})
