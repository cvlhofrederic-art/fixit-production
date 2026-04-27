import { describe, it, expect } from 'vitest'
import {
  detectMprBareme,
  getMprForfait,
  MPR_PLAFONDS_REVENUS_2026,
} from '@/lib/prix-travaux-2026'

describe('MaPrimeRénov 2026', () => {
  describe('detectMprBareme — détection tranche revenus', () => {
    it('foyer 4 pers, 25 000 € → bleu', () => {
      expect(detectMprBareme({ foyerTaille: 4, revenusFiscaux: 25_000, region: 'province' })).toBe('bleu')
    })

    it('foyer 4 pers, 40 000 € → jaune', () => {
      expect(detectMprBareme({ foyerTaille: 4, revenusFiscaux: 40_000, region: 'province' })).toBe('jaune')
    })

    it('foyer 4 pers, 60 000 € → violet', () => {
      expect(detectMprBareme({ foyerTaille: 4, revenusFiscaux: 60_000, region: 'province' })).toBe('violet')
    })

    it('foyer 4 pers, 100 000 € → rose', () => {
      expect(detectMprBareme({ foyerTaille: 4, revenusFiscaux: 100_000, region: 'province' })).toBe('rose')
    })

    it('IDF a des plafonds plus élevés', () => {
      expect(detectMprBareme({ foyerTaille: 4, revenusFiscaux: 35_000, region: 'idf' })).toBe('bleu')
    })

    it('foyer 4 province à exactement le plafond bleu (35 285 €) → bleu', () => {
      expect(detectMprBareme({ foyerTaille: 4, revenusFiscaux: 35_285, region: 'province' })).toBe('bleu')
    })

    it('foyer 4 province à plafond bleu + 1€ (35 286 €) → jaune', () => {
      expect(detectMprBareme({ foyerTaille: 4, revenusFiscaux: 35_286, region: 'province' })).toBe('jaune')
    })

    it('foyer 7 pers province ajoute 2× perPersonneSup au foyer5plus', () => {
      // bleu foyer5plus province = 40 388 ; perPersonneSup = 5 094
      // plafond foyer 7 = 40 388 + 2×5 094 = 50 576
      expect(detectMprBareme({ foyerTaille: 7, revenusFiscaux: 50_576, region: 'province' })).toBe('bleu')
      expect(detectMprBareme({ foyerTaille: 7, revenusFiscaux: 50_577, region: 'province' })).toBe('jaune')
    })
  })

  describe('getMprForfait — montant aide', () => {
    it('PAC air-eau bleu = 5 000 €', () => {
      const forfaits = { bleu: 5000, jaune: 4000, violet: 3000, rose: 0 }
      expect(getMprForfait(forfaits, 'bleu')).toBe(5000)
    })

    it('rose (haut revenus) = 0 €', () => {
      const forfaits = { bleu: 5000, jaune: 4000, violet: 3000, rose: 0 }
      expect(getMprForfait(forfaits, 'rose')).toBe(0)
    })
  })

  describe('Plafonds revenus', () => {
    it('expose les plafonds pour 2026', () => {
      expect(MPR_PLAFONDS_REVENUS_2026.bleu.foyer4.province).toBeGreaterThan(20_000)
      expect(MPR_PLAFONDS_REVENUS_2026.jaune.foyer4.province).toBeGreaterThan(MPR_PLAFONDS_REVENUS_2026.bleu.foyer4.province)
    })
  })
})
