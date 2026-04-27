import { describe, it, expect } from 'vitest'
import { maconnerieLines } from '@/lib/prix-travaux-2026/data/maconnerie'

describe('Maçonnerie — data 2026', () => {
  it('exports exactly 5 lines', () => {
    expect(maconnerieLines).toHaveLength(5)
  })
  it('every line has metier === maconnerie', () => {
    maconnerieLines.forEach(l => expect(l.metier).toBe('maconnerie'))
  })
  it('every line has unique taskId', () => {
    const ids = maconnerieLines.map(l => l.taskId)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('all lines have spread ≤ 20%', () => {
    maconnerieLines.forEach(l => {
      const spread = (l.priceMax - l.priceMin) / l.priceMin
      expect(spread, `taskId=${l.taskId}`).toBeLessThanOrEqual(0.201)
    })
  })
  it('all lines have ≥2 sources with ≥1 Tier 1', () => {
    maconnerieLines.forEach(l => {
      expect(l.sources.length).toBeGreaterThanOrEqual(2)
      expect(l.sources.some(s => s.tier === 1)).toBe(true)
    })
  })
})
