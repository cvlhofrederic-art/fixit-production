import { describe, it, expect } from 'vitest'
import { paysagismeLines } from '@/lib/prix-travaux-2026/data/paysagisme'

describe('Paysagisme — data 2026', () => {
  it('exports exactly 5 lines', () => {
    expect(paysagismeLines).toHaveLength(5)
  })
  it('every line has metier === paysagisme', () => {
    paysagismeLines.forEach(l => expect(l.metier).toBe('paysagisme'))
  })
  it('every line has unique taskId', () => {
    const ids = paysagismeLines.map(l => l.taskId)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('all lines have spread ≤ 20%', () => {
    paysagismeLines.forEach(l => {
      const spread = (l.priceMax - l.priceMin) / l.priceMin
      expect(spread, `taskId=${l.taskId}`).toBeLessThanOrEqual(0.201)
    })
  })
  it('all lines have ≥2 sources with ≥1 Tier 1', () => {
    paysagismeLines.forEach(l => {
      expect(l.sources.length).toBeGreaterThanOrEqual(2)
      expect(l.sources.some(s => s.tier === 1)).toBe(true)
    })
  })
})
