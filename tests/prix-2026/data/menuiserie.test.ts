import { describe, it, expect } from 'vitest'
import { menuiserieLines } from '@/lib/prix-travaux-2026/data/menuiserie'

describe('Menuiserie — data 2026', () => {
  it('exports exactly 5 lines', () => {
    expect(menuiserieLines).toHaveLength(5)
  })

  it('fenêtres double vitrage have aidesEligibles (MPR + CEE)', () => {
    const fenetres = menuiserieLines.filter(l => l.taskId.includes('fenetre'))
    expect(fenetres.length).toBeGreaterThan(0)
    fenetres.forEach(l => {
      expect(l.aidesEligibles?.maPrimeRenov || l.aidesEligibles?.cee).toBeTruthy()
    })
  })

  it('all lines have spread ≤ 20%', () => {
    menuiserieLines.forEach(l => {
      const spread = (l.priceMax - l.priceMin) / l.priceMin
      expect(spread).toBeLessThanOrEqual(0.201)
    })
  })

  it('all lines have ≥2 sources with ≥1 Tier 1', () => {
    menuiserieLines.forEach(l => {
      expect(l.sources.length).toBeGreaterThanOrEqual(2)
      expect(l.sources.some(s => s.tier === 1)).toBe(true)
    })
  })
})
