import { describe, it, expect } from 'vitest'
import {
  COEFFICIENTS_ZONE_2026,
  COEFFICIENTS_GAMME_2026,
  COEFFICIENTS_ETAT_2026,
} from '@/lib/prix-travaux-2026'

describe('Coefficients 2026', () => {
  describe('Zones régionales', () => {
    it('contains exactly 9 zones', () => {
      expect(COEFFICIENTS_ZONE_2026).toHaveLength(9)
    })

    it('Paris coefficient is 1.30', () => {
      const paris = COEFFICIENTS_ZONE_2026.find(z => z.code === 'IDF-PARIS')
      expect(paris?.multiplier).toBe(1.30)
    })

    it('PACA includes department 13 (Bouches-du-Rhône)', () => {
      const paca = COEFFICIENTS_ZONE_2026.find(z => z.code === 'PACA')
      expect(paca?.departements).toContain('13')
    })

    it('all zones have a source citation and lastVerified', () => {
      COEFFICIENTS_ZONE_2026.forEach(z => {
        expect(z.source.length).toBeGreaterThan(0)
        expect(z.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      })
    })

    it('STANDARD-FRANCE has multiplier 1.00 as baseline', () => {
      const std = COEFFICIENTS_ZONE_2026.find(z => z.code === 'STANDARD-FRANCE')
      expect(std?.multiplier).toBe(1.00)
    })
  })

  describe('Gamme', () => {
    it('contains 3 levels with multipliers 0.90 / 1.00 / 1.15', () => {
      expect(COEFFICIENTS_GAMME_2026).toHaveLength(3)
      const multipliers = COEFFICIENTS_GAMME_2026.map(g => g.multiplier).sort()
      expect(multipliers).toEqual([0.90, 1.00, 1.15])
    })
  })

  describe('Etat', () => {
    it('contains 3 levels with multipliers 1.00 / 1.10 / 1.25', () => {
      expect(COEFFICIENTS_ETAT_2026).toHaveLength(3)
      const multipliers = COEFFICIENTS_ETAT_2026.map(e => e.multiplier).sort()
      expect(multipliers).toEqual([1.00, 1.10, 1.25])
    })
  })
})
