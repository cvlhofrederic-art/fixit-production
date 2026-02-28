import { describe, it, expect } from 'vitest'
import { checkRateLimit } from '@/lib/rate-limit'

describe('Rate Limiting', () => {
  it('should allow requests within limit', () => {
    const id = `test_${Date.now()}_1`
    expect(checkRateLimit(id, 5, 60000)).toBe(true)
    expect(checkRateLimit(id, 5, 60000)).toBe(true)
    expect(checkRateLimit(id, 5, 60000)).toBe(true)
  })

  it('should block requests exceeding limit', () => {
    const id = `test_${Date.now()}_2`
    for (let i = 0; i < 3; i++) checkRateLimit(id, 3, 60000)
    expect(checkRateLimit(id, 3, 60000)).toBe(false)
  })

  it('should use different windows per identifier', () => {
    const id1 = `test_${Date.now()}_3a`
    const id2 = `test_${Date.now()}_3b`
    for (let i = 0; i < 3; i++) checkRateLimit(id1, 3, 60000)
    expect(checkRateLimit(id1, 3, 60000)).toBe(false)
    expect(checkRateLimit(id2, 3, 60000)).toBe(true)
  })
})
