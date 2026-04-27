import { describe, it, expect } from 'vitest'
import { electriciteLines } from '@/lib/prix-travaux-2026/data/electricite'

describe('Électricité — data 2026', () => {
  it('exports exactly 5 lines', () => {
    expect(electriciteLines).toHaveLength(5)
  })

  it('every line has metier === electricite', () => {
    electriciteLines.forEach(l => expect(l.metier).toBe('electricite'))
  })

  it('every line has unique taskId', () => {
    const ids = electriciteLines.map(l => l.taskId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('all lines have spread ≤ 20%', () => {
    electriciteLines.forEach(l => {
      const spread = (l.priceMax - l.priceMin) / l.priceMin
      expect(spread, `taskId=${l.taskId}`).toBeLessThanOrEqual(0.201)
    })
  })

  it('all lines have ≥2 sources with ≥1 Tier 1', () => {
    electriciteLines.forEach(l => {
      expect(l.sources.length).toBeGreaterThanOrEqual(2)
      expect(l.sources.some(s => s.tier === 1)).toBe(true)
    })
  })
})
