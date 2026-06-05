// tests/lib/acompte-prefill.test.ts
//
// buildAcomptePrefill — construit le brouillon d'une facture d'acompte à partir
// d'un parent (FACTURE ou DEVIS). Met à l'échelle TOUTES les lignes au % (TVA
// conservées), pose factureSubType='acompte' + métadonnées (ordre/total/%/lien).
// Source unique partagée par FacturesSection (→ Acompte) et DevisSection
// (Facturer → Acompte).

import { describe, it, expect } from 'vitest'
import { buildAcomptePrefill } from '../../lib/acompte-prefill'
import { computeDocumentTotalHT } from '../../lib/devis-totals'

const PARENT_FACTURE = {
  id: 'fac-1', docNumber: 'FACT-2026-009', docType: 'facture', docTitle: 'Rénovation',
  lines: [{ id: 1, description: 'MO', qty: 1, priceHT: 5250, tvaRate: 20, totalHT: 5250 }],
  customTables: [{ id: 't', name: 'Gros œuvre', lines: [
    { id: 2, description: 'Maçonnerie', qty: 1, priceHT: 40437, tvaRate: 10, totalHT: 40437 },
  ] }],
}

const PARENT_DEVIS = {
  id: 'dev-1', docNumber: 'DEV-2026-009', docType: 'devis', docTitle: 'Rénovation appartement',
  lines: [{ id: 1, description: 'MO', qty: 1, priceHT: 10000, tvaRate: 20, totalHT: 10000 }],
}

describe('buildAcomptePrefill', () => {
  it('depuis une FACTURE : acompte 50 % scalé (22 843,50 €), métadonnées posées', () => {
    const a = buildAcomptePrefill(PARENT_FACTURE, { percentage: 50, ordre: 1, total: 3, declencheur: 'À la signature' })
    expect(a.docType).toBe('facture')
    expect(a.factureSubType).toBe('acompte')
    expect(a.acomptePourcentage).toBe(50)
    expect(a.acompteOrdre).toBe(1)
    expect(a.acompteTotal).toBe(3)
    expect(a.docNumber).toBe('')            // numéro tiré à l'émission
    expect(a.status).toBe('brouillon')
    expect(a.parentInvoiceNumber).toBe('FACT-2026-009')
    expect(computeDocumentTotalHT(a as Parameters<typeof computeDocumentTotalHT>[0])).toBeCloseTo(22843.5, 1)
  })

  it('depuis un DEVIS : référence le devis source (sourceDevisNumber)', () => {
    const a = buildAcomptePrefill(PARENT_DEVIS, { percentage: 30, ordre: 1, total: 3, declencheur: 'À la signature' })
    expect(a.docType).toBe('facture')
    expect(a.factureSubType).toBe('acompte')
    expect(a.sourceDevisNumber).toBe('DEV-2026-009')
    expect(a.parentInvoiceNumber).toBe('DEV-2026-009')
    // 30 % de 10 000 = 3 000
    expect(computeDocumentTotalHT(a as Parameters<typeof computeDocumentTotalHT>[0])).toBeCloseTo(3000, 2)
  })

  it('ne mute pas le parent', () => {
    buildAcomptePrefill(PARENT_FACTURE, { percentage: 50, ordre: 1, total: 2, declencheur: 'x' })
    expect(PARENT_FACTURE.lines[0].totalHT).toBe(5250)
    expect(PARENT_FACTURE.customTables[0].lines[0].totalHT).toBe(40437)
  })
})
