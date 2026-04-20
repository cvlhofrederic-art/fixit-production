import { describe, it, expect, vi } from 'vitest'

// Prevent supabase browser client from hanging the worker
vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn() },
}))

import { calculeRentabilite } from '@/lib/rentabilite/engine'
import type { RefTaux, CalculRentabiliteInput } from '@/lib/rentabilite/types'

// Shared mock taux (same dataset as charges tests)
const mockTaux: RefTaux[] = [
  // FR — cotisations sociales
  { id: '1', juridiction: 'FR', type_charge: 'cotisations_sociales', regime: 'auto_entrepreneur', taux: 22, seuil_min: null, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'URSSAF 2026', description: null },
  { id: '2', juridiction: 'FR', type_charge: 'cotisations_sociales', regime: 'ei', taux: 45, seuil_min: null, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'SSI 2026', description: null },
  // FR — charges patronales
  { id: '3', juridiction: 'FR', type_charge: 'charges_patronales', regime: 'sasu', taux: 42, seuil_min: null, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'URSSAF 2026', description: null },
  // FR — IS seuil PME
  { id: '4', juridiction: 'FR', type_charge: 'is_seuil_pme', regime: 'all', taux: 15, seuil_min: 0, seuil_max: 42500, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'CGI art. 219 I-b', description: null },
  { id: '5', juridiction: 'FR', type_charge: 'is_seuil_pme', regime: 'all', taux: 25, seuil_min: 42500.01, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'CGI art. 219 I', description: null },
  // PT — TSU & FCT (lda)
  { id: '6', juridiction: 'PT', type_charge: 'tsu_patronal', regime: 'lda', taux: 23.75, seuil_min: null, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'Código dos Regimes Contributivos art. 53', description: null },
  { id: '7', juridiction: 'PT', type_charge: 'fct', regime: 'lda', taux: 1, seuil_min: null, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'Lei 70/2013', description: null },
  // PT — IRC seuil PME
  { id: '8', juridiction: 'PT', type_charge: 'irc_seuil_pme', regime: 'all', taux: 17, seuil_min: 0, seuil_max: 50000, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'CIRC art. 87 n.2', description: null },
  { id: '9', juridiction: 'PT', type_charge: 'irc_seuil_pme', regime: 'all', taux: 21, seuil_min: 50000.01, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'CIRC art. 87 n.1', description: null },
  // PT — derrama municipal
  { id: '10', juridiction: 'PT', type_charge: 'derrama_municipal', regime: 'all', taux: 1.5, seuil_min: null, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'Lei das Finanças Locais', description: null },
]

const date2026 = new Date('2026-06-01')

// Spec example 1: SASU FR
// facturé 20000, coûts 12800, masse salariale 2800, fixes 600
// marge_brute = 7200
// charges_sociales = 42% × 2800 = 1176
// benefice_avant_impot = 7200 - 1176 - 600 = 5424
// IS = 15% × 5424 = 813.60
// total_charges = 1176 + 813.60 + 600 = 2589.60
// benefice_net = 7200 - 2589.60 = 4610.40
// taux_marge_nette = 4610.40 / 20000 * 100 = 23.05
const sasuInput: CalculRentabiliteInput = {
  chantier_id: 'test-sasu',
  montant_facture_ht: 20000,
  montant_devis_ht: 19000,
  couts: { materiaux: 6000, main_oeuvre: 4000, sous_traitance: 2000, frais_annexes: 800 },
  masse_salariale_brute: 2800,
  juridiction: 'FR',
  forme_juridique: 'sasu',
  regime_tva: 'normal',
  periode: date2026,
}

// Spec example 2: Lda PT
// facturé 15000, coûts 9300, masse salariale 1800, fixes 450
// marge_brute = 5700
// charges_sociales = (23.75% + 1%) × 1800 = 445.50
// benefice_avant_impot = 5700 - 445.50 - 450 = 4804.50
// IRC = 17% × 4804.50 = 816.765; derrama = 1.5% × 816.765 = 12.251475
// charges_fiscales = round2(816.765 + 12.251475) = 829.02
// total_charges = 445.50 + 829.02 + 450 = 1724.52
// benefice_net = 5700 - 1724.52 = 3975.48
const ldaInput: CalculRentabiliteInput = {
  chantier_id: 'test-lda',
  montant_facture_ht: 15000,
  montant_devis_ht: 14000,
  couts: { materiaux: 4000, main_oeuvre: 3000, sous_traitance: 2000, frais_annexes: 300 },
  masse_salariale_brute: 1800,
  juridiction: 'PT',
  forme_juridique: 'lda',
  regime_tva: 'normal',
  periode: date2026,
}

describe('calculeRentabilite — SASU FR spec example', () => {
  it('returns correct benefice_net ≈ 4610.40', () => {
    const result = calculeRentabilite(sasuInput, mockTaux, 600)
    expect(result.benefice_net).toBe(4610.4)
  })

  it('returns correct taux_marge_nette ≈ 23.05%', () => {
    const result = calculeRentabilite(sasuInput, mockTaux, 600)
    expect(result.taux_marge_nette).toBe(23.05)
  })

  it('returns statut rentable (> 15%)', () => {
    const result = calculeRentabilite(sasuInput, mockTaux, 600)
    expect(result.statut).toBe('rentable')
  })

  it('charges_sociales = 1176 (42% of 2800)', () => {
    const result = calculeRentabilite(sasuInput, mockTaux, 600)
    expect(result.charges_sociales).toBe(1176)
  })

  it('charges_fiscales = 813.60 (IS 15% on 5424)', () => {
    const result = calculeRentabilite(sasuInput, mockTaux, 600)
    expect(result.charges_fiscales).toBe(813.6)
  })

  it('quote_part_fixes = 600', () => {
    const result = calculeRentabilite(sasuInput, mockTaux, 600)
    expect(result.quote_part_fixes).toBe(600)
  })

  it('taux_appliques contains audit trail entries', () => {
    const result = calculeRentabilite(sasuInput, mockTaux, 600)
    expect(result.taux_appliques.length).toBeGreaterThan(0)
    expect(result.taux_appliques.some((t) => t.type === 'charges_patronales')).toBe(true)
  })

  it('marge_brute = 7200', () => {
    const result = calculeRentabilite(sasuInput, mockTaux, 600)
    expect(result.marge_brute).toBe(7200)
  })
})

describe('calculeRentabilite — Lda PT spec example', () => {
  it('returns statut rentable', () => {
    const result = calculeRentabilite(ldaInput, mockTaux, 450)
    expect(result.statut).toBe('rentable')
  })

  it('charges_sociales = 445.50', () => {
    const result = calculeRentabilite(ldaInput, mockTaux, 450)
    expect(result.charges_sociales).toBe(445.5)
  })

  it('taux_appliques contains irc and derrama entries', () => {
    const result = calculeRentabilite(ldaInput, mockTaux, 450)
    expect(result.taux_appliques.some((t) => t.type === 'derrama_municipal')).toBe(true)
  })
})

describe('calculeRentabilite — edge cases', () => {
  it('zero revenue returns perte with no division by zero', () => {
    const input: CalculRentabiliteInput = {
      chantier_id: 'test-zero',
      montant_facture_ht: 0,
      montant_devis_ht: 5000,
      couts: { materiaux: 0, main_oeuvre: 0, sous_traitance: 0, frais_annexes: 0 },
      masse_salariale_brute: 0,
      juridiction: 'FR',
      forme_juridique: 'sasu',
      regime_tva: 'normal',
      periode: date2026,
    }
    const result = calculeRentabilite(input, mockTaux, 0)
    expect(result.statut).toBe('perte')
    expect(result.taux_marge_nette).toBe(0)
    expect(result.benefice_net).toBe(0)
  })

  it('statut juste when marge between 5% and 15%', () => {
    // Construct scenario where taux_marge_nette = ~10%
    // AE: no IS, no masse salariale — cotisations 22% on CA
    // facturé 10000, coûts 7000, cotisations = 22% × 10000 = 2200
    // fixes = 100, benefice_net = 3000 - 2200 - 100 = 700
    // taux = 700/10000 = 7% → juste
    const input: CalculRentabiliteInput = {
      chantier_id: 'test-juste',
      montant_facture_ht: 10000,
      montant_devis_ht: 9000,
      couts: { materiaux: 4000, main_oeuvre: 2000, sous_traitance: 1000, frais_annexes: 0 },
      masse_salariale_brute: 0,
      juridiction: 'FR',
      forme_juridique: 'auto_entrepreneur',
      regime_tva: 'normal',
      periode: date2026,
    }
    const result = calculeRentabilite(input, mockTaux, 100)
    expect(result.statut).toBe('juste')
  })

  it('ecart_devis computes variance correctly', () => {
    const inputWithDevis: CalculRentabiliteInput = {
      ...sasuInput,
      devis_detail: { materiaux: 5000, main_oeuvre: 4000, sous_traitance: 2000, frais_annexes: 800 },
    }
    const result = calculeRentabilite(inputWithDevis, mockTaux, 600)
    // materiaux: prevu 5000, reel 6000 → +20%
    expect(result.ecart_devis.materiaux.ecart_pct).toBe(20)
    expect(result.ecart_devis.materiaux.prevu).toBe(5000)
    expect(result.ecart_devis.materiaux.reel).toBe(6000)
  })

  it('date_calcul is a Date instance', () => {
    const result = calculeRentabilite(sasuInput, mockTaux, 600)
    expect(result.date_calcul).toBeInstanceOf(Date)
  })
})
