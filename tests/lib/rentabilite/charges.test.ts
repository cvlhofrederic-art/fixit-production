import { describe, it, expect, vi } from 'vitest'

// Prevent supabase browser client from hanging the worker
vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn() },
}))

import { calculeChargesSociales, calculeChargesFiscales } from '@/lib/rentabilite/charges'
import type { RefTaux } from '@/lib/rentabilite/types'

// Mock ref_taux matching the 061_seed_ref_taux.sql data
const mockTaux: RefTaux[] = [
  // FR — cotisations sociales
  { id: '1', juridiction: 'FR', type_charge: 'cotisations_sociales', regime: 'auto_entrepreneur', taux: 22, seuil_min: null, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'URSSAF barème 2026 — activité artisanale BTP', description: null },
  { id: '2', juridiction: 'FR', type_charge: 'cotisations_sociales', regime: 'micro_bic', taux: 22, seuil_min: null, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'URSSAF barème 2026', description: null },
  { id: '3', juridiction: 'FR', type_charge: 'cotisations_sociales', regime: 'micro_bnc', taux: 22, seuil_min: null, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'URSSAF barème 2026', description: null },
  { id: '4', juridiction: 'FR', type_charge: 'cotisations_sociales', regime: 'ei', taux: 45, seuil_min: null, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'SSI barème 2026', description: null },
  // FR — charges patronales
  { id: '5', juridiction: 'FR', type_charge: 'charges_patronales', regime: 'sasu', taux: 42, seuil_min: null, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'URSSAF barème employeur 2026', description: null },
  { id: '6', juridiction: 'FR', type_charge: 'charges_patronales', regime: 'eurl_is', taux: 42, seuil_min: null, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'URSSAF barème employeur 2026', description: null },
  { id: '7', juridiction: 'FR', type_charge: 'charges_patronales', regime: 'eurl_ir', taux: 42, seuil_min: null, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'URSSAF barème employeur 2026', description: null },
  { id: '8', juridiction: 'FR', type_charge: 'charges_patronales', regime: 'sarl', taux: 42, seuil_min: null, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'URSSAF barème employeur 2026', description: null },
  { id: '9', juridiction: 'FR', type_charge: 'charges_patronales', regime: 'sas', taux: 42, seuil_min: null, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'URSSAF barème employeur 2026', description: null },
  { id: '10', juridiction: 'FR', type_charge: 'charges_patronales', regime: 'sa_fr', taux: 42, seuil_min: null, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'URSSAF barème employeur 2026', description: null },
  // FR — IS seuil PME brackets
  { id: '11', juridiction: 'FR', type_charge: 'is_seuil_pme', regime: 'all', taux: 15, seuil_min: 0, seuil_max: 42500, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'CGI art. 219 I-b', description: null },
  { id: '12', juridiction: 'FR', type_charge: 'is_seuil_pme', regime: 'all', taux: 25, seuil_min: 42500.01, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'CGI art. 219 I', description: null },
  // PT — cotisations sociales
  { id: '13', juridiction: 'PT', type_charge: 'cotisations_sociales', regime: 'eni', taux: 21.4, seuil_min: null, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'Código dos Regimes Contributivos art. 168', description: null },
  { id: '14', juridiction: 'PT', type_charge: 'cotisations_sociales', regime: 'trabalhador_independente', taux: 21.4, seuil_min: null, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'Código dos Regimes Contributivos art. 168', description: null },
  { id: '15', juridiction: 'PT', type_charge: 'base_incidence', regime: 'trabalhador_independente', taux: 70, seuil_min: null, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'Código dos Regimes Contributivos art. 162', description: null },
  // PT — TSU & FCT (lda)
  { id: '16', juridiction: 'PT', type_charge: 'tsu_patronal', regime: 'lda', taux: 23.75, seuil_min: null, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'Código dos Regimes Contributivos art. 53', description: null },
  { id: '17', juridiction: 'PT', type_charge: 'tsu_salarial', regime: 'lda', taux: 11, seuil_min: null, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'Código dos Regimes Contributivos art. 53', description: null },
  { id: '18', juridiction: 'PT', type_charge: 'fct', regime: 'lda', taux: 1, seuil_min: null, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'Lei 70/2013', description: null },
  // PT — IRC seuil PME brackets
  { id: '19', juridiction: 'PT', type_charge: 'irc_seuil_pme', regime: 'all', taux: 17, seuil_min: 0, seuil_max: 50000, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'CIRC art. 87 n.2', description: null },
  { id: '20', juridiction: 'PT', type_charge: 'irc_seuil_pme', regime: 'all', taux: 21, seuil_min: 50000.01, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'CIRC art. 87 n.1', description: null },
  // PT — derrama municipal
  { id: '21', juridiction: 'PT', type_charge: 'derrama_municipal', regime: 'all', taux: 1.5, seuil_min: null, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'Lei das Finanças Locais', description: null },
  // PT — unipessoal_lda
  { id: '22', juridiction: 'PT', type_charge: 'tsu_patronal', regime: 'unipessoal_lda', taux: 23.75, seuil_min: null, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'Código dos Regimes Contributivos art. 53', description: null },
  { id: '23', juridiction: 'PT', type_charge: 'fct', regime: 'unipessoal_lda', taux: 1, seuil_min: null, seuil_max: null, date_debut_validite: '2026-01-01', date_fin_validite: null, source_reglementaire: 'Lei 70/2013', description: null },
]

const date2026 = new Date('2026-06-01')

describe('calculeChargesSociales', () => {
  it('auto-entrepreneur FR: 22% of CA 20000 = 4400', () => {
    const result = calculeChargesSociales({
      allTaux: mockTaux,
      juridiction: 'FR',
      formeJuridique: 'auto_entrepreneur',
      ca: 20000,
      masseSalariale: 0,
      beneficeBrut: 0,
      date: date2026,
    })
    expect(result.montant).toBe(4400)
    expect(result.taux_appliques).toHaveLength(1)
    expect(result.taux_appliques[0].taux).toBe(22)
  })

  it('EI FR: 45% of bénéfice 7200 = 3240', () => {
    const result = calculeChargesSociales({
      allTaux: mockTaux,
      juridiction: 'FR',
      formeJuridique: 'ei',
      ca: 10000,
      masseSalariale: 0,
      beneficeBrut: 7200,
      date: date2026,
    })
    expect(result.montant).toBe(3240)
    expect(result.taux_appliques[0].taux).toBe(45)
  })

  it('SASU FR: 42% of masse salariale 2800 = 1176', () => {
    const result = calculeChargesSociales({
      allTaux: mockTaux,
      juridiction: 'FR',
      formeJuridique: 'sasu',
      ca: 20000,
      masseSalariale: 2800,
      beneficeBrut: 7200,
      date: date2026,
    })
    expect(result.montant).toBe(1176)
    expect(result.taux_appliques[0].taux).toBe(42)
  })

  it('Lda PT: (23.75% + 1%) of masse salariale 1800 = 445.50', () => {
    const result = calculeChargesSociales({
      allTaux: mockTaux,
      juridiction: 'PT',
      formeJuridique: 'lda',
      ca: 15000,
      masseSalariale: 1800,
      beneficeBrut: 0,
      date: date2026,
    })
    // 23.75% + 1% = 24.75% of 1800 = 445.50
    expect(result.montant).toBe(445.5)
    expect(result.taux_appliques).toHaveLength(2)
  })

  it('micro-BNC FR: 22% of CA 10000 = 2200', () => {
    const result = calculeChargesSociales({
      allTaux: mockTaux, juridiction: 'FR', formeJuridique: 'micro_bnc',
      ca: 10000, masseSalariale: 0, beneficeBrut: 0, date: date2026,
    })
    expect(result.montant).toBe(2200)
  })

  it('Unipessoal Lda PT: (23.75% + 1%) of 2000 = 495', () => {
    const result = calculeChargesSociales({
      allTaux: mockTaux, juridiction: 'PT', formeJuridique: 'unipessoal_lda',
      ca: 20000, masseSalariale: 2000, beneficeBrut: 0, date: date2026,
    })
    expect(result.montant).toBe(495)
  })

  it('Trabalhador Independente PT: 21.4% on 70% of 15000 = 2247', () => {
    const result = calculeChargesSociales({
      allTaux: mockTaux,
      juridiction: 'PT',
      formeJuridique: 'trabalhador_independente',
      ca: 15000,
      masseSalariale: 0,
      beneficeBrut: 0,
      date: date2026,
    })
    // 21.4% of (70% of 15000) = 21.4% of 10500 = 2247
    expect(result.montant).toBe(2247)
  })
})

describe('calculeChargesFiscales', () => {
  it('IS auto-entrepreneur = 0', () => {
    const result = calculeChargesFiscales({
      allTaux: mockTaux,
      juridiction: 'FR',
      formeJuridique: 'auto_entrepreneur',
      beneficeAvantImpot: 10000,
      date: date2026,
    })
    expect(result.montant).toBe(0)
  })

  it('IS SASU FR: 15% on 5424 = 813.60', () => {
    const result = calculeChargesFiscales({
      allTaux: mockTaux,
      juridiction: 'FR',
      formeJuridique: 'sasu',
      beneficeAvantImpot: 5424,
      date: date2026,
    })
    expect(result.montant).toBe(813.6)
    expect(result.taux_appliques.some((t) => t.taux === 15)).toBe(true)
  })

  it('IS SASU FR: bracket split at 42500 — above seuil', () => {
    // 15% on 42500 + 25% on 7500 = 6375 + 1875 = 8250
    const result = calculeChargesFiscales({
      allTaux: mockTaux,
      juridiction: 'FR',
      formeJuridique: 'sasu',
      beneficeAvantImpot: 50000,
      date: date2026,
    })
    expect(result.montant).toBe(8250)
  })

  it('IRC Lda PT: 17% + derrama 1.5% on 10000', () => {
    const result = calculeChargesFiscales({
      allTaux: mockTaux,
      juridiction: 'PT',
      formeJuridique: 'lda',
      beneficeAvantImpot: 10000,
      date: date2026,
    })
    // IRC = 17% of 10000 = 1700; derrama = 1.5% of 1700 = 25.50; total = 1725.50
    expect(result.montant).toBe(1725.5)
    expect(result.taux_appliques.some((t) => t.type === 'derrama_municipal')).toBe(true)
  })

  it('IRC Lda PT zero benefice = 0', () => {
    const result = calculeChargesFiscales({
      allTaux: mockTaux,
      juridiction: 'PT',
      formeJuridique: 'lda',
      beneficeAvantImpot: 0,
      date: date2026,
    })
    expect(result.montant).toBe(0)
  })

  it('micro-BNC has no IS', () => {
    const result = calculeChargesFiscales({
      allTaux: mockTaux, juridiction: 'FR', formeJuridique: 'micro_bnc',
      beneficeAvantImpot: 15000, date: date2026,
    })
    expect(result.montant).toBe(0)
  })

  it('IR forms (eurl_ir) have no IS', () => {
    const result = calculeChargesFiscales({
      allTaux: mockTaux,
      juridiction: 'FR',
      formeJuridique: 'eurl_ir',
      beneficeAvantImpot: 20000,
      date: date2026,
    })
    expect(result.montant).toBe(0)
  })
})
