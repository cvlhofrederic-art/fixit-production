// tests/build-v2-input-materials.test.ts — Régression PDF V2 artisan :
// les matériaux et les frais annexes DOIVENT apparaître dans `lignes` (donc
// dans le tableau du PDF ET dans le total recalculé par le générateur, qui
// somme input.lignes). Avant le fix, ils n'étaient comptés que pour les
// acomptes → PDF incohérent (lignes ≠ total, sous-facturation). Couvre aussi
// le mapping du pourcentage d'acompte (#14).

import { describe, it, expect } from 'vitest'
import { buildV2Input, type BuildV2InputParams } from '@/lib/pdf/build-v2-input'

function base(overrides: Partial<BuildV2InputParams> = {}): BuildV2InputParams {
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
    lines: [{ id: 1, description: 'Pose', qty: 1, unit: 'h', priceHT: 100, tvaRate: 0, totalHT: 100 }],
    acomptesEnabled: false,
    acomptes: [],
    notes: '',
    mediatorName: '',
    mediatorUrl: '',
    isHorsEtablissement: false,
    ...overrides,
  }
}

const mat = (o: Partial<{ id: number; description: string; qty: number; unit: string; priceHT: number; totalHT: number }> = {}) =>
  ({ id: 2, description: 'Carrelage', qty: 10, unit: 'm2', priceHT: 20, tvaRate: 0, totalHT: 200, ...o })

const frais = (o: Record<string, unknown> = {}) =>
  ({ id: 3, designation: 'Déplacement', categorie: 'deplacement', quantite: 1, unite: 'forfait', prix_unitaire_ht: 50, tva_applicable: 0, total_ht: 50, ...o })

describe('buildV2Input — matériaux & frais annexes rendus dans les lignes', () => {
  it('pousse matériaux + frais dans lignes et bascule en mode sections', () => {
    const out = buildV2Input(base({ materialLines: [mat()] as never, fraisAnnexes: [frais()] as never }))
    expect(out.mode_affichage).toBe('sections')
    const sections = out.lignes.map(l => l.section)
    expect(sections).toContain('materiaux')
    expect(sections).toContain('frais_annexes')
    const m = out.lignes.find(l => l.section === 'materiaux')!
    expect(m.designation).toBe('Carrelage')
    expect(m.quantite).toBe(10)
    expect(m.total).toBe(200)
    const f = out.lignes.find(l => l.section === 'frais_annexes')!
    expect(f.designation).toBe('Déplacement')
    expect(f.total).toBe(50)
    // Un libellé de section "Frais annexes" est fourni au générateur
    expect(out.customSectionLabels?.['frais_annexes']).toBeTruthy()
  })

  it('le total (somme des lignes) inclut matériaux + frais → acomptes corrects', () => {
    const out = buildV2Input(base({
      acomptesEnabled: true,
      acomptes: [
        { id: 'a1', ordre: 1, label: 'Acompte', pourcentage: 30, declencheur: 'À la signature' },
        { id: 'a2', ordre: 2, label: 'Solde', pourcentage: 70, declencheur: 'Fin' },
      ],
      materialLines: [mat({ qty: 1, priceHT: 200, totalHT: 200 })] as never,
      fraisAnnexes: [frais()] as never,
    }))
    // 100 (labor) + 200 (matériau) + 50 (frais) = 350
    const sumLignes = out.lignes.reduce((s, l) => s + l.total, 0)
    expect(sumLignes).toBeCloseTo(350, 2)
    const sumAcomptes = out.acomptes!.reduce((s, a) => s + a.montant, 0)
    expect(sumAcomptes).toBeCloseTo(350, 2)
  })

  it('mappe le pourcentage des acomptes (#14)', () => {
    const out = buildV2Input(base({
      acomptesEnabled: true,
      acomptes: [
        { id: 'a1', ordre: 1, label: 'Acompte', pourcentage: 30, declencheur: 'À la signature' },
        { id: 'a2', ordre: 2, label: 'Solde', pourcentage: 70, declencheur: 'Fin' },
      ],
    }))
    expect(out.acomptes![0].pourcentage).toBe(30)
    expect(out.acomptes![1].pourcentage).toBe(70)
  })

  it('sans matériaux/frais/custom : reste en mode bloc (régression)', () => {
    const out = buildV2Input(base())
    expect(out.mode_affichage).toBe('bloc')
    expect(out.lignes).toHaveLength(1)
    expect(out.lignes[0].section).toBeNull()
  })
})
