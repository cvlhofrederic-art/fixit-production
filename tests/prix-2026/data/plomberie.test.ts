import { describe, it, expect } from 'vitest'
import { plomberieLines } from '@/lib/prix-travaux-2026/data/plomberie'

describe('Plomberie — data 2026', () => {
  it('exports exactly 5 lines', () => {
    expect(plomberieLines).toHaveLength(5)
  })

  it('every line has metier === plomberie', () => {
    plomberieLines.forEach(l => expect(l.metier).toBe('plomberie'))
  })

  it('every line has unique taskId', () => {
    const ids = plomberieLines.map(l => l.taskId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('all lines have spread ≤ 20%', () => {
    plomberieLines.forEach(l => {
      const spread = (l.priceMax - l.priceMin) / l.priceMin
      expect(spread, `taskId=${l.taskId}`).toBeLessThanOrEqual(0.201)
    })
  })

  it('all lines have ≥2 sources with ≥1 Tier 1', () => {
    plomberieLines.forEach(l => {
      expect(l.sources.length).toBeGreaterThanOrEqual(2)
      expect(l.sources.some(s => s.tier === 1)).toBe(true)
    })
  })
})
