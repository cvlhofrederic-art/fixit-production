// tests/devis-acompte-scaling.test.ts
//
// Régression incident Aractingi 2026-06-05 (BTP Pro) :
//   « → Acompte » sur une facture BTP de 45 687 € à 30 % produisait un
//   brouillon de 42 012 € (≈ 92 %) au lieu de 13 706 € (30 %).
//
// Cause racine : la mise à l'échelle d'acompte ne couvrait que `lines` +
//   `materialLines`. Pour un devis BTP, le gros du montant vit dans
//   `customTables` (mode « sections » / corps d'état) et `fraisLines`, qui
//   restaient à 100 %. Résultat : 0,30 × (lines+materials) + 100 % × (custom+frais).
//
// Le helper `scaleDocumentLines` doit mettre à l'échelle TOUTES les collections
//   que `computeDocumentTotalHT` additionne, de sorte que :
//     computeDocumentTotalHT(scaleDocumentLines(doc, r)) === r × computeDocumentTotalHT(doc)

import { describe, it, expect } from 'vitest'
import { scaleDocumentLines, computeDocumentTotalHT } from '../lib/devis-totals'

// Reproduction exacte des chiffres prod Aractingi :
//   lines + materials = 5 250 € ; customTables = 40 437 € ; total = 45 687 €
//   Acompte 30 % attendu = 13 706,10 € (et NON 42 012 € = ancien bug 92 %)
const PARENT_ARACTINGI = {
  docNumber: 'FACT-2026-009',
  docType: 'facture' as const,
  lines: [
    { id: 1, description: "Main d'œuvre", qty: 1, unit: 'forfait', priceHT: 5250, tvaRate: 20, totalHT: 5250 },
  ],
  customTables: [
    {
      id: 't1',
      name: 'Gros œuvre',
      lines: [
        { id: 2, description: 'Maçonnerie', qty: 1, unit: 'forfait', priceHT: 40437, tvaRate: 20, totalHT: 40437 },
      ],
    },
  ],
}

describe('scaleDocumentLines — mise à l\'échelle complète d\'un acompte BTP', () => {
  it('produit 30 % du TOTAL réel (13 706 €), PAS 92 % (42 012 €) — inclut customTables', () => {
    const scaled = scaleDocumentLines(PARENT_ARACTINGI, 0.3)
    // Total attendu : 45 687 × 0,30 = 13 706,10
    expect(computeDocumentTotalHT(scaled)).toBeCloseTo(13706.1, 2)
    // Surtout PAS l'ancien bug (custom tables laissées à 100 %)
    expect(computeDocumentTotalHT(scaled)).not.toBeCloseTo(42012, 0)
  })

  it('met à l\'échelle les 4 sources de lignes (lines + materialLines + fraisLines + customTables)', () => {
    const doc = {
      lines: [{ id: 1, description: 'Labor', qty: 1, priceHT: 1000, tvaRate: 20, totalHT: 1000 }],
      materialLines: [{ id: 2, description: 'Matériaux', qty: 1, priceHT: 2000, tvaRate: 20, totalHT: 2000 }],
      fraisLines: [{ id: 3, description: 'Frais', qty: 1, priceHT: 3000, tvaRate: 20, totalHT: 3000 }],
      customTables: [{ id: 't', name: 'Corps d\'état', lines: [{ id: 4, description: 'Poste', qty: 1, priceHT: 4000, tvaRate: 20, totalHT: 4000 }] }],
    }
    // Total parent = 10 000 ; à 50 % → 5 000
    expect(computeDocumentTotalHT(doc)).toBe(10000)
    expect(computeDocumentTotalHT(scaleDocumentLines(doc, 0.5))).toBeCloseTo(5000, 2)
  })

  it('ne mute jamais le document source', () => {
    const before = computeDocumentTotalHT(PARENT_ARACTINGI)
    scaleDocumentLines(PARENT_ARACTINGI, 0.3)
    expect(computeDocumentTotalHT(PARENT_ARACTINGI)).toBe(before)
    expect(PARENT_ARACTINGI.lines[0].totalHT).toBe(5250)
    expect(PARENT_ARACTINGI.customTables[0].lines[0].totalHT).toBe(40437)
  })

  it('préserve qty et tvaRate (l\'échelle ne porte que sur priceHT / totalHT)', () => {
    const scaled = scaleDocumentLines(PARENT_ARACTINGI, 0.3) as typeof PARENT_ARACTINGI
    expect(scaled.lines[0].qty).toBe(1)
    expect(scaled.lines[0].tvaRate).toBe(20)
    expect(scaled.lines[0].priceHT).toBeCloseTo(1575, 2)
    expect(scaled.customTables[0].lines[0].priceHT).toBeCloseTo(12131.1, 2)
  })
})
