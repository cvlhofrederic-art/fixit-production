import { describe, it, expect } from 'vitest'
import { peintureLines } from '@/lib/prix-travaux-2026/data/peinture'

describe('Peinture — data 2026', () => {
  it('exports exactly 5 lines', () => {
    expect(peintureLines).toHaveLength(5)
  })

  it('every line has metier === peinture', () => {
    peintureLines.forEach(l => expect(l.metier).toBe('peinture'))
  })

  it('every line has unique taskId', () => {
    const ids = peintureLines.map(l => l.taskId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('peinture-murs-interieur-2couches has priceMin between 25 and 30', () => {
    const line = peintureLines.find(l => l.taskId === 'peinture-murs-interieur-2couches')
    expect(line).toBeDefined()
    expect(line!.priceMin).toBeGreaterThanOrEqual(25)
    expect(line!.priceMin).toBeLessThanOrEqual(30)
  })

  it('all lines have spread ≤ 20%', () => {
    peintureLines.forEach(l => {
      const spread = (l.priceMax - l.priceMin) / l.priceMin
      expect(spread, `taskId=${l.taskId}`).toBeLessThanOrEqual(0.201)
    })
  })

  it('all lines have ≥2 sources with ≥1 Tier 1', () => {
    peintureLines.forEach(l => {
      expect(l.sources.length).toBeGreaterThanOrEqual(2)
      expect(l.sources.some(s => s.tier === 1)).toBe(true)
    })
  })
})
