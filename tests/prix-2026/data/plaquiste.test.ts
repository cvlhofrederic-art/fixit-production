import { describe, it, expect } from 'vitest'
import { plaquisteLines } from '@/lib/prix-travaux-2026/data/plaquiste'

describe('Plaquiste — data 2026', () => {
  it('exports exactly 5 lines', () => {
    expect(plaquisteLines).toHaveLength(5)
  })

  it('lines tagged ITE-like (doublage thermique, rampants) have aidesEligibles', () => {
    const isolationLines = plaquisteLines.filter(l =>
      l.taskId.includes('thermique') || l.taskId.includes('rampants')
    )
    expect(isolationLines.length).toBeGreaterThan(0)
    isolationLines.forEach(l => {
      expect(l.aidesEligibles).toBeDefined()
      expect(l.aidesEligibles?.maPrimeRenov || l.aidesEligibles?.cee).toBeTruthy()
    })
  })

  it('all lines have spread ≤ 20%', () => {
    plaquisteLines.forEach(l => {
      const spread = (l.priceMax - l.priceMin) / l.priceMin
      expect(spread).toBeLessThanOrEqual(0.201)
    })
  })

  it('all lines have ≥2 sources with ≥1 Tier 1', () => {
    plaquisteLines.forEach(l => {
      expect(l.sources.length).toBeGreaterThanOrEqual(2)
      expect(l.sources.some(s => s.tier === 1)).toBe(true)
    })
  })
})
