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
    it('PAC air-eau, foyer 4 pers, revenus modestes (bleu) — total déterministe 11 095 €', () => {
      const result = computeAides({
        eligibles: {
          maPrimeRenov: { forfaits: { bleu: 5000, jaune: 4000, violet: 3000, rose: 0 } },
          cee: { forfaitParUnite: 4500, operationStandard: 'BAR-TH-104' },
          tvaReduite: 5.5,
          ecoPTZ: true,
        },
        prixHT: 11000,
        contexte: {
          foyerTaille: 4,
          revenusFiscaux: 28000,
          region: 'province',
          logementAge: 15,
        },
      })

      // mpr 5000 (bleu) + cee 4500 + tva économie round(11000*0.20 - 11000*0.055) = 1595
      // total = 5000 + 4500 + 1595 = 11095
      expect(result.maPrimeRenov).toBe(5000)
      expect(result.cee).toBe(4500)
      expect(result.tvaEconomie).toBe(1595)
      expect(result.total).toBe(11095)
      expect(result.ecoPTZ).toEqual({ eligible: true, montantMax: 50000 })
    })

    it('returns 0 if no aides éligibles', () => {
      const result = computeAides({
        eligibles: undefined,
        prixHT: 10000,
        contexte: { foyerTaille: 1, revenusFiscaux: 50000, region: 'province', logementAge: 10 },
      })
      expect(result.total).toBe(0)
    })
  })
})
