import { describe, it, expect } from 'vitest'
import { couvertureLines } from '@/lib/prix-travaux-2026/data/couverture'

describe('Couverture — data 2026', () => {
  it('exports exactly 5 lines', () => {
    expect(couvertureLines).toHaveLength(5)
  })
  it('every line has metier === couverture', () => {
    couvertureLines.forEach(l => expect(l.metier).toBe('couverture'))
  })
  it('every line has unique taskId', () => {
    const ids = couvertureLines.map(l => l.taskId)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('all lines have spread ≤ 20%', () => {
    couvertureLines.forEach(l => {
      const spread = (l.priceMax - l.priceMin) / l.priceMin
      expect(spread, `taskId=${l.taskId}`).toBeLessThanOrEqual(0.201)
    })
  })
  it('all lines have ≥2 sources with ≥1 Tier 1', () => {
    couvertureLines.forEach(l => {
      expect(l.sources.length).toBeGreaterThanOrEqual(2)
      expect(l.sources.some(s => s.tier === 1)).toBe(true)
    })
  })
})
