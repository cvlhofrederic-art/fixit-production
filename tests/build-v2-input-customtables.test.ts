// tests/build-v2-input-customtables.test.ts — Vérifie que buildV2Input intègre
// correctement les customTables (parité BTP V3 portée sur form artisan V2).
//
// Critères couverts :
//  - Les lignes customTables sont flattenées dans `lignes` avec marker section
//    `custom_<tableId>`
//  - Le mode_affichage bascule en 'sections' dès qu'au moins 1 table custom
//    a au moins 1 ligne valide
//  - customSectionLabels mappe `custom_<id>` → table.name
//  - totalNet inclut les lignes customTables (impact sur acomptes)
//  - Tables vides ou avec descriptions vides ignorées (pas de section fantôme)

import { describe, it, expect } from 'vitest'
import { buildV2Input, type BuildV2InputParams } from '@/lib/pdf/build-v2-input'

function makeBaseParams(overrides: Partial<BuildV2InputParams> = {}): BuildV2InputParams {
  return {
    logoUrl: null,
    companyName: 'Test EI',
    companySiret: '12345678901234',
    companyAddress: '1 rue test',
    companyPhone: '0600000000',
    companyEmail: 'test@example.com',
    insuranceName: null,
    insuranceNumber: null,
    insuranceCoverage: null,
    insuranceType: null,
    tvaEnabled: false,
    paymentMode: 'Virement',
    paymentCondition: '',
    clientName: 'Client',
    clientSiret: null,
    clientAddress: null,
    clientPhone: null,
    clientEmail: null,
    interventionAddress: null,
    interventionBatiment: null,
    interventionEtage: null,
    interventionEspacesCommuns: null,
    interventionExterieur: null,
    docType: 'devis',
    docNumber: 'DEV-001',
    docTitle: 'Test',
    docDate: '2026-01-01',
    docValidity: 30,
    executionDelay: '3 jours',
    prestationDate: '',
    lines: [
      { id: 1, description: 'Main d\'oeuvre', qty: 1, unit: 'h', priceHT: 100, tvaRate: 0, totalHT: 100 },
    ],
    acomptesEnabled: false,
    acomptes: [],
    notes: '',
    mediatorName: '',
    mediatorUrl: '',
    isHorsEtablissement: false,
    ...overrides,
  }
}

describe('buildV2Input — customTables (parité BTP V3)', () => {
  it('sans customTables : mode_affichage=bloc, pas de customSectionLabels', () => {
    const out = buildV2Input(makeBaseParams())
    expect(out.mode_affichage).toBe('bloc')
    expect(out.customSectionLabels).toBeUndefined()
    expect(out.lignes).toHaveLength(1)
    expect(out.lignes[0].section).toBeNull()
  })

  it('avec 1 customTable non vide : mode_affichage=sections, lignes flattenées avec marker', () => {
    const out = buildV2Input(makeBaseParams({
      customTables: [{
        id: 'tbl_abc',
        name: 'DEPENSES PARC COROT',
        category: 'labor',
        lines: [
          { id: 10, description: 'Forfait complémentaire', qty: 1, unit: 'f', priceHT: 3069.97, tvaRate: 0, totalHT: 3069.97 },
        ],
      }],
    }))
    expect(out.mode_affichage).toBe('sections')
    expect(out.lignes).toHaveLength(2)
    // Ligne principale : section='labor' (mode sections)
    expect(out.lignes[0].section).toBe('labor')
    expect(out.lignes[0].designation).toBe("Main d'oeuvre")
    // Ligne custom : section='custom_<id>'
    expect(out.lignes[1].section).toBe('custom_tbl_abc')
    expect(out.lignes[1].designation).toBe('Forfait complémentaire')
    expect(out.lignes[1].total).toBe(3069.97)
    // Label custom mappé
    expect(out.customSectionLabels).toEqual({ 'custom_tbl_abc': 'DEPENSES PARC COROT' })
  })

  it('plusieurs customTables : chaque table a son propre label', () => {
    const out = buildV2Input(makeBaseParams({
      customTables: [
        { id: 't1', name: 'Sous-traitance plomberie', category: 'labor', lines: [{ id: 1, description: 'Réseau eau', qty: 1, unit: 'f', priceHT: 500, tvaRate: 0, totalHT: 500 }] },
        { id: 't2', name: 'Bennes & déchets', category: 'frais', lines: [{ id: 2, description: 'Location benne', qty: 2, unit: 'u', priceHT: 200, tvaRate: 0, totalHT: 400 }] },
      ],
    }))
    expect(out.lignes).toHaveLength(3)
    expect(out.customSectionLabels).toEqual({
      'custom_t1': 'Sous-traitance plomberie',
      'custom_t2': 'Bennes & déchets',
    })
  })

  it('tables custom vides (toutes les lignes sans description) : ignorées', () => {
    const out = buildV2Input(makeBaseParams({
      customTables: [
        { id: 't_empty', name: 'Table vide', lines: [{ id: 99, description: '   ', qty: 1, unit: 'u', priceHT: 100, tvaRate: 0, totalHT: 100 }] },
      ],
    }))
    // Pas de section custom → reste en bloc
    expect(out.mode_affichage).toBe('bloc')
    expect(out.customSectionLabels).toBeUndefined()
    expect(out.lignes).toHaveLength(1)
  })

  it('totalNet inclut les lignes customTables (impact acomptes)', () => {
    const out = buildV2Input(makeBaseParams({
      acomptesEnabled: true,
      acomptes: [
        { id: 'a1', ordre: 1, label: 'Signature', pourcentage: 50, declencheur: 'À la signature' },
        { id: 'a2', ordre: 2, label: 'Solde', pourcentage: 50, declencheur: 'À la livraison' },
      ],
      lines: [
        { id: 1, description: 'Pose', qty: 30, unit: 'm3', priceHT: 65, tvaRate: 0, totalHT: 1950 },
        { id: 2, description: 'Dépose', qty: 4.7, unit: 't', priceHT: 950, tvaRate: 0, totalHT: 4465 },
      ],
      customTables: [
        { id: 'tbl_extra', name: 'Intervention compl.', category: 'labor', lines: [
          { id: 10, description: 'Forfait', qty: 1, unit: 'f', priceHT: 3069.97, tvaRate: 0, totalHT: 3069.97 },
        ] },
      ],
    }))
    // 1950 + 4465 + 3069.97 = 9484.97 → 50% = ~4742.48 (round2 BOFiP)
    // Le dernier acompte absorbe le résidu — somme exacte = totalNet
    const sumAcomptes = out.acomptes!.reduce((s, a) => s + a.montant, 0)
    expect(sumAcomptes).toBeCloseTo(9484.97, 2)
    // Acompte 1 = ~50% du total, tolérance large (round2 BOFiP peut donner 4742.48 ou 4742.49)
    expect(out.acomptes![0].montant).toBeGreaterThanOrEqual(4742)
    expect(out.acomptes![0].montant).toBeLessThanOrEqual(4743)
  })

  it('garde lineDetail/etapes per-line pour les lignes customTables', () => {
    const out = buildV2Input(makeBaseParams({
      customTables: [{
        id: 't1', name: 'Test', lines: [{
          id: 10, description: 'Ligne avec étapes', qty: 1, unit: 'u', priceHT: 100, tvaRate: 0, totalHT: 100,
          etapes: [
            { id: 'e1', ordre: 2, designation: 'Étape 2' },
            { id: 'e2', ordre: 1, designation: 'Étape 1' },
          ],
        }],
      }],
    }))
    const customLine = out.lignes[1]
    expect(customLine.etapes).toHaveLength(2)
    // Triées par ordre
    expect(customLine.etapes![0].designation).toBe('Étape 1')
    expect(customLine.etapes![1].designation).toBe('Étape 2')
  })
})

describe('buildV2Input — métadonnées acompte/avoir (label PDF complet)', () => {
  it('transmet acompteOrdre/Total/Pourcentage/parentInvoiceNumber dans devis{}', () => {
    const out = buildV2Input(makeBaseParams({
      docType: 'facture',
      factureSubType: 'acompte',
      acompteOrdre: 2,
      acompteTotal: 3,
      acomptePourcentage: 30,
      parentInvoiceNumber: 'FACT-2026-009',
    }))
    expect(out.devis.factureSubType).toBe('acompte')
    expect(out.devis.acompteOrdre).toBe(2)
    expect(out.devis.acompteTotal).toBe(3)
    expect(out.devis.acomptePourcentage).toBe(30)
    expect(out.devis.parentInvoiceNumber).toBe('FACT-2026-009')
  })

  it('transmet avoirMotif + parentInvoiceNumber pour un avoir', () => {
    const out = buildV2Input(makeBaseParams({
      docType: 'facture',
      factureSubType: 'avoir',
      parentInvoiceNumber: 'FACT-2026-009',
      avoirMotif: 'Erreur de facturation',
    }))
    expect(out.devis.factureSubType).toBe('avoir')
    expect(out.devis.parentInvoiceNumber).toBe('FACT-2026-009')
    expect(out.devis.avoirMotif).toBe('Erreur de facturation')
  })
})
