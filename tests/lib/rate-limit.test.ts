import { describe, it, expect } from 'vitest'
import { checkRateLimit } from '@/lib/rate-limit'

describe('Rate Limiting', () => {
  it('should allow requests within limit', async () => {
    const id = `test_${Date.now()}_1`
    expect(await checkRateLimit(id, 5, 60000)).toBe(true)
    expect(await checkRateLimit(id, 5, 60000)).toBe(true)
    expect(await checkRateLimit(id, 5, 60000)).toBe(true)
  })

  it('should block requests exceeding limit', async () => {
    const id = `test_${Date.now()}_2`
    for (let i = 0; i < 3; i++) await checkRateLimit(id, 3, 60000)
    expect(await checkRateLimit(id, 3, 60000)).toBe(false)
  })

  it('should use different windows per identifier', async () => {
    const id1 = `test_${Date.now()}_3a`
    const id2 = `test_${Date.now()}_3b`
    for (let i = 0; i < 3; i++) await checkRateLimit(id1, 3, 60000)
    expect(await checkRateLimit(id1, 3, 60000)).toBe(false)
    expect(await checkRateLimit(id2, 3, 60000)).toBe(true)
  })
})
