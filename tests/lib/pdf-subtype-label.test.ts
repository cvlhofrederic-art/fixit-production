// tests/lib/pdf-subtype-label.test.ts
//
// Label réglementaire du sous-type facture (acompte/situation/avoir) affiché sous
// le numéro sur le PDF. Bug : au TÉLÉCHARGEMENT depuis la liste, le label acompte
// retombait sur « FACTURE D'ACOMPTE » nu (N°/%/facture parente perdus) car les
// champs n'étaient pas transmis. Ce helper (mirror V3) produit le label complet.

import { describe, it, expect } from 'vitest'
import { buildSubTypeLabel } from '../../lib/pdf/subtype-label'

describe('buildSubTypeLabel', () => {
  it('acompte complet : N° sur Total — % (sur facture parent)', () => {
    expect(buildSubTypeLabel({
      docType: 'facture', factureSubType: 'acompte',
      acompteOrdre: 2, acompteTotal: 3, acomptePourcentage: 30, parentInvoiceNumber: 'FACT-2026-009',
    }, false)).toBe("FACTURE D'ACOMPTE N°2 sur 3 — 30% (sur facture FACT-2026-009)")
  })

  it('acompte sans métadonnées : label nu (rétro-compat)', () => {
    expect(buildSubTypeLabel({ docType: 'facture', factureSubType: 'acompte' }, false))
      .toBe("FACTURE D'ACOMPTE")
  })

  it('avoir : AVOIR sur facture parent', () => {
    expect(buildSubTypeLabel({ docType: 'facture', factureSubType: 'avoir', parentInvoiceNumber: 'FACT-2026-009' }, false))
      .toBe('AVOIR sur facture FACT-2026-009')
  })

  it('situation : N° + avancement %', () => {
    expect(buildSubTypeLabel({ docType: 'facture', factureSubType: 'situation', situationNumber: 4, situationAvancement: 75 }, false))
      .toBe('FACTURE DE SITUATION N° 4 — 75%')
  })

  it('standard / devis / sans sous-type → null', () => {
    expect(buildSubTypeLabel({ docType: 'facture', factureSubType: 'standard' }, false)).toBeNull()
    expect(buildSubTypeLabel({ docType: 'devis', factureSubType: 'acompte' }, false)).toBeNull()
    expect(buildSubTypeLabel({ docType: 'facture' }, false)).toBeNull()
  })

  it('locale PT', () => {
    expect(buildSubTypeLabel({ docType: 'facture', factureSubType: 'acompte', acompteOrdre: 1, acompteTotal: 2, parentInvoiceNumber: 'FACT-2026-001' }, true))
      .toBe('FATURA DE ADIANTAMENTO N.º 1 de 2 (sobre fatura FACT-2026-001)')
  })

  it('locale PT : ni « N° » ni « (AVOIR) », parent orçamento nommé comme tel (28/11/2026)', () => {
    expect(buildSubTypeLabel({ docType: 'facture', factureSubType: 'acompte', acompteOrdre: 1, acompteTotal: 3, parentInvoiceNumber: 'ORC-2026-005' }, true))
      .toBe('FATURA DE ADIANTAMENTO N.º 1 de 3 (sobre orçamento ORC-2026-005)')
    expect(buildSubTypeLabel({ docType: 'facture', factureSubType: 'situation', situationNumber: 2, situationAvancement: 60 }, true))
      .toBe('FATURA DE SITUAÇÃO N.º 2 — 60%')
    expect(buildSubTypeLabel({ docType: 'facture', factureSubType: 'avoir', parentInvoiceNumber: 'FT-2026-001' }, true))
      .toBe('NOTA DE CRÉDITO sobre fatura FT-2026-001')
  })
})
