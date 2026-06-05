// tests/lib/stats-doc-total.test.ts
//
// Le dashboard Revenus (StatsRevenusSection) affichait des montants à 0 pour les
// vrais comptes : il lisait `total_ttc_cents` / `total_ht_cents`, des colonnes que
// buildPayload/buildData ne persistent JAMAIS (seul le seed démo les pose).
// docRevenueHT recalcule le HT depuis les lignes (source de vérité) et ne retombe
// sur total_ht_cents que pour les données de démo (qui n'ont pas de lignes).

import { describe, it, expect } from 'vitest'
import { docRevenueHT } from '../../lib/stats-doc-total'

describe('docRevenueHT', () => {
  it('calcule le HT depuis les lignes du document (source de vérité)', () => {
    const doc = {
      docType: 'facture',
      lines: [
        { description: 'Pose', qty: 2, priceHT: 100, totalHT: 200 },
        { description: 'Fourniture', qty: 1, priceHT: 50, totalHT: 50 },
      ],
    }
    expect(docRevenueHT(doc)).toBe(250)
  })

  it('agrège toutes les collections (laborLines, materialLines, customTables…)', () => {
    const doc = {
      docType: 'facture',
      laborLines: [{ description: 'MO', qty: 1, priceHT: 300, totalHT: 300 }],
      materialLines: [{ description: 'Tuyau', qty: 1, priceHT: 120, totalHT: 120 }],
      customTables: [{ id: 't1', name: 'Extra', lines: [{ description: 'Forfait', qty: 1, priceHT: 80, totalHT: 80 }] }],
    }
    expect(docRevenueHT(doc)).toBe(500)
  })

  it('fallback sur total_ht_cents quand le doc n a pas de lignes (données démo seedées)', () => {
    expect(docRevenueHT({ docType: 'facture', total_ht_cents: 285000 })).toBe(2850)
  })

  it('privilégie les lignes au total_ht_cents quand les deux existent', () => {
    const doc = { docType: 'facture', total_ht_cents: 999999, lines: [{ description: 'X', qty: 1, priceHT: 100, totalHT: 100 }] }
    expect(docRevenueHT(doc)).toBe(100)
  })

  it('un avoir (lignes négatives) produit un HT négatif → se soustrait du CA', () => {
    const avoir = { docType: 'facture', lines: [{ description: 'Annulation', qty: 1, priceHT: -100, totalHT: -100 }] }
    expect(docRevenueHT(avoir)).toBe(-100)
  })

  it('0 pour null / undefined / objet vide', () => {
    expect(docRevenueHT(null)).toBe(0)
    expect(docRevenueHT(undefined)).toBe(0)
    expect(docRevenueHT({})).toBe(0)
  })
})
