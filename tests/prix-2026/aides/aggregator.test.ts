import { describe, it, expect } from 'vitest'
import { computeAides, getTvaApplicable } from '@/lib/prix-travaux-2026'

describe('Agrégateur aides 2026', () => {
  describe('getTvaApplicable', () => {
    it('rénovation énergétique → 5.5%', () => {
      expect(getTvaApplicable({ category: 'energy-renovation', logementAge: 5 })).toBe(5.5)
    })

    it('rénovation logement >2 ans non-énergétique → 10%', () => {
      expect(getTvaApplicable({ category: 'standard-renovation', logementAge: 5 })).toBe(10)
    })

    it('logement neuf <2 ans → 20%', () => {
      expect(getTvaApplicable({ category: 'standard-renovation', logementAge: 1 })).toBe(20)
    })
  })

  describe('computeAides — agrégation tous dispositifs', () => {
    it('PAC air-eau, foyer 4 pers, revenus modestes (bleu)', () => {
      const result = computeAides({
        eligibles: {
          maPrimeRenov: { forfaits: { bleu: 5000, jaune: 4000, violet: 3000, rose: 0 } },
          cee: { forfaitParUnite: 4500, operationStandard: 'BAR-TH-104' },
          tvaReduite: 5.5,
          ecoPTZ: true,
        },
        prixHT: 11000,
        prixTTC20: 13200, // pour calcul économie TVA
        contexte: {
          foyerTaille: 4,
          revenusFiscaux: 28000,
          region: 'province',
          logementAge: 15,
        },
      })

      expect(result.maPrimeRenov).toBe(5000)
      expect(result.cee).toBe(4500)
      expect(result.tvaEconomie).toBeGreaterThan(0)
      expect(result.total).toBeGreaterThan(9500)
    })

    it('returns 0 if no aides éligibles', () => {
      const result = computeAides({
        eligibles: undefined,
        prixHT: 10000,
        prixTTC20: 12000,
        contexte: { foyerTaille: 1, revenusFiscaux: 50000, region: 'province', logementAge: 10 },
      })
      expect(result.total).toBe(0)
    })
  })
})
