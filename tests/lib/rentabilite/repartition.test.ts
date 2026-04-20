import { describe, it, expect } from 'vitest'
import { calculeQuotePartFixes } from '@/lib/rentabilite/repartition'

describe('calculeQuotePartFixes', () => {
  it('prorata CA: 20000/80000 × 1355 × 1 = 338.75', () => {
    const result = calculeQuotePartFixes({
      mode: 'prorata_ca',
      ca_chantier: 20000,
      ca_total_periode: 80000,
      jours_chantier: 0,
      jours_total_periode: 0,
      charges_fixes_mensuelles: 1355,
      duree_mois: 1,
    })
    expect(result).toBe(338.75)
  })

  it('prorata temps: 15/22 × 1355 × 1 = 923.86', () => {
    const result = calculeQuotePartFixes({
      mode: 'prorata_temps',
      ca_chantier: 0,
      ca_total_periode: 0,
      jours_chantier: 15,
      jours_total_periode: 22,
      charges_fixes_mensuelles: 1355,
      duree_mois: 1,
    })
    // 15/22 * 1355 = 923.863... → 923.86
    expect(result).toBe(923.86)
  })

  it('multi-month: 20000/100000 × 1355 × 3 = 813', () => {
    const result = calculeQuotePartFixes({
      mode: 'prorata_ca',
      ca_chantier: 20000,
      ca_total_periode: 100000,
      jours_chantier: 0,
      jours_total_periode: 0,
      charges_fixes_mensuelles: 1355,
      duree_mois: 3,
    })
    expect(result).toBe(813)
  })

  it('zero CA total returns 0', () => {
    const result = calculeQuotePartFixes({
      mode: 'prorata_ca',
      ca_chantier: 5000,
      ca_total_periode: 0,
      jours_chantier: 0,
      jours_total_periode: 0,
      charges_fixes_mensuelles: 1355,
      duree_mois: 1,
    })
    expect(result).toBe(0)
  })

  it('zero jours total returns 0 in prorata_temps mode', () => {
    const result = calculeQuotePartFixes({
      mode: 'prorata_temps',
      ca_chantier: 0,
      ca_total_periode: 0,
      jours_chantier: 5,
      jours_total_periode: 0,
      charges_fixes_mensuelles: 1355,
      duree_mois: 1,
    })
    expect(result).toBe(0)
  })
})
