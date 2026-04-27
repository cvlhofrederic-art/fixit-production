import { describe, it, expect } from 'vitest'
import { chauffageLines } from '@/lib/prix-travaux-2026/data/chauffage'

describe('Chauffage — data 2026', () => {
  it('exports exactly 5 lines', () => {
    expect(chauffageLines).toHaveLength(5)
  })
  it('PAC air-eau and chaudière condensation have aidesEligibles with MPR forfaits', () => {
    const aides = chauffageLines.filter(l =>
      l.taskId.includes('pac-air-eau') || l.taskId.includes('chaudiere-condensation')
    )
    expect(aides.length).toBeGreaterThanOrEqual(3)
    aides.forEach(l => {
      expect(l.aidesEligibles?.maPrimeRenov?.forfaits).toBeDefined()
      expect(l.aidesEligibles?.cee).toBeDefined()
    })
  })
  it('PAC air-eau lines have TVA 5.5%', () => {
    const pac = chauffageLines.filter(l => l.taskId.includes('pac-air-eau'))
    pac.forEach(l => expect(l.tva).toBe(5.5))
  })
  it('all lines have spread ≤ 20%', () => {
    chauffageLines.forEach(l => {
      const spread = (l.priceMax - l.priceMin) / l.priceMin
      expect(spread).toBeLessThanOrEqual(0.201)
    })
  })
  it('all lines have ≥2 sources with ≥1 Tier 1', () => {
    chauffageLines.forEach(l => {
      expect(l.sources.length).toBeGreaterThanOrEqual(2)
      expect(l.sources.some(s => s.tier === 1)).toBe(true)
    })
  })
})
