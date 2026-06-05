// tests/devis-acompte-tva.test.ts
//
// Garantie « 0 marge d'erreur » sur la TVA d'un acompte (méthode pro 2026) :
// la mise à l'échelle au % NE TOUCHE JAMAIS le taux de TVA d'une ligne — seul
// le montant est × %. Donc la ventilation TVA de l'acompte = MÊMES taux que le
// devis, bases et TVA collectées × %. Vérifie la demande explicite utilisateur.

import { describe, it, expect } from 'vitest'
import { scaleDocumentLines, buildDocumentLines } from '../lib/devis-totals'

// Devis multi-taux (cas BTP réel : travaux 10 %, fournitures 20 %, rénov 5,5 %)
const DEVIS = {
  docNumber: 'FACT-2026-050',
  lines: [
    { id: 1, description: 'Main d\'œuvre rénovation', qty: 1, priceHT: 10000, tvaRate: 10, totalHT: 10000 },
    { id: 2, description: 'Fournitures', qty: 1, priceHT: 4000, tvaRate: 20, totalHT: 4000 },
  ],
  customTables: [
    { id: 't', name: 'Isolation', lines: [
      { id: 3, description: 'Isolation thermique', qty: 1, priceHT: 6000, tvaRate: 5.5, totalHT: 6000 },
    ] },
  ],
}

// Somme TVA par taux sur l'ensemble des lignes d'un document
function tvaByRate(doc: Parameters<typeof buildDocumentLines>[0]): Record<string, number> {
  const acc: Record<string, number> = {}
  for (const l of buildDocumentLines(doc)) {
    const rate = String((l as { tvaRate?: number }).tvaRate ?? 0)
    const ht = (l.totalHT ?? l.total_ht ?? l.total ?? 0) as number
    acc[rate] = Math.round(((acc[rate] || 0) + ht * (Number(rate) / 100)) * 100) / 100
  }
  return acc
}

describe('Acompte — correspondance TVA avec le devis', () => {
  it('acompte 50 % : taux identiques, bases et TVA exactement divisées par 2', () => {
    const acompte = scaleDocumentLines(DEVIS, 0.5) as typeof DEVIS

    // Taux préservés ligne à ligne
    expect(acompte.lines[0].tvaRate).toBe(10)
    expect(acompte.lines[1].tvaRate).toBe(20)
    expect(acompte.customTables[0].lines[0].tvaRate).toBe(5.5)

    // Bases HT = 50 %
    expect(acompte.lines[0].totalHT).toBe(5000)
    expect(acompte.lines[1].totalHT).toBe(2000)
    expect(acompte.customTables[0].lines[0].totalHT).toBe(3000)

    // Ventilation TVA = 50 % de celle du devis, taux par taux
    const parentTva = tvaByRate(DEVIS)        // {10: 1000, 20: 800, 5.5: 330}
    const acompteTva = tvaByRate(acompte)     // {10: 500, 20: 400, 5.5: 165}
    for (const rate of Object.keys(parentTva)) {
      expect(acompteTva[rate]).toBeCloseTo(parentTva[rate] / 2, 2)
    }
  })

  it('acompte 30 % : aucun taux inventé ni perdu', () => {
    const acompte = scaleDocumentLines(DEVIS, 0.3)
    expect(Object.keys(tvaByRate(acompte)).sort()).toEqual(['10', '20', '5.5'])
  })
})
