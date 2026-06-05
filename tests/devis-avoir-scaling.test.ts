// tests/devis-avoir-scaling.test.ts
//
// Bug frère de l'acompte (PR #396) — bouton « → Avoir » du BTP Pro :
//   buildAvoirPrefill ne négativait (× -1) que `lines` + `materialLines`.
//   `customTables` (corps d'état) et `fraisLines` restaient POSITIFS via
//   `...parent` → l'avoir ne soldait pas la facture (total ≈ +custom au lieu
//   de -total). Un avoir BTP affichait donc un montant faux, voire positif.
//
// `negateDocumentLines(doc)` = `scaleDocumentLines(doc, -1)` doit négativer
//   TOUTES les collections sommées par computeDocumentTotalHT :
//     computeDocumentTotalHT(negateDocumentLines(doc)) === -computeDocumentTotalHT(doc)

import { describe, it, expect } from 'vitest'
import { negateDocumentLines, computeDocumentTotalHT } from '../lib/devis-totals'

// Facture BTP : lines = 5 250 € ; customTables = 40 437 € ; total = 45 687 €
const FACTURE_BTP = {
  docNumber: 'FACT-2026-009',
  docType: 'facture' as const,
  lines: [
    { id: 1, description: "Main d'œuvre", qty: 1, unit: 'forfait', priceHT: 5250, tvaRate: 20, totalHT: 5250 },
  ],
  customTables: [
    { id: 't1', name: 'Gros œuvre', lines: [
      { id: 2, description: 'Maçonnerie', qty: 1, unit: 'forfait', priceHT: 40437, tvaRate: 20, totalHT: 40437 },
    ] },
  ],
}

describe('negateDocumentLines — avoir BTP négative TOUT le document', () => {
  it('total avoir = -total complet (-45 687 €), customTables incluses', () => {
    const avoir = negateDocumentLines(FACTURE_BTP)
    expect(computeDocumentTotalHT(avoir)).toBeCloseTo(-45687, 2)
    // Ancien bug : -lines + (+customTables) = -5 250 + 40 437 = +35 187 (positif !)
    expect(computeDocumentTotalHT(avoir)).not.toBeCloseTo(35187, 0)
  })

  it('négative les lignes des customTables (pas seulement lines)', () => {
    const avoir = negateDocumentLines(FACTURE_BTP) as typeof FACTURE_BTP
    expect(avoir.lines[0].totalHT).toBe(-5250)
    expect(avoir.customTables[0].lines[0].totalHT).toBe(-40437)
    expect(avoir.customTables[0].lines[0].priceHT).toBe(-40437)
  })

  it('ne mute jamais le document source', () => {
    negateDocumentLines(FACTURE_BTP)
    expect(FACTURE_BTP.lines[0].totalHT).toBe(5250)
    expect(FACTURE_BTP.customTables[0].lines[0].totalHT).toBe(40437)
  })
})
