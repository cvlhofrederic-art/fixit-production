/**
 * Tax Simulation — BTP Pro Analytics
 *
 * FR: IS (15%/25% brackets) + TVA
 * PT: IRC (17%/21% brackets) + IVA
 * Pure functions, no React.
 */

import type { Country } from '@/lib/config/companyTypes'
import type { TaxProjection } from './pipeline-types'

// ════════════════════════════════════════════
//  MAIN TAX SIMULATOR
// ════════════════════════════════════════════

export interface TaxSimulationInput {
  country: Country
  regime: string                  // 'is', 'ir', 'irc', 'irs' etc.
  benefice_imposable: number      // Profit before tax

  // TVA/IVA
  ca_total_ht: number             // CA HT for TVA calculation
  tva_taux: number                // 0.20 for FR, 0.23 for PT
  total_achats_ht: number         // Purchases HT (for TVA deductible)

  // FR specific
  is_eligible_taux_reduit?: boolean  // PME with CA < 10M€ and benefice < 42500€ for 15%

  // For IR comparison (FR TNS bosses)
  salaire_patron_net?: number     // Net salary drawn by boss (for IR calculation)
}

export function simulateTax(input: TaxSimulationInput): TaxProjection {
  const { country, regime, benefice_imposable } = input

  if (country === 'FR') {
    return simulateFR(input)
  }
  return simulatePT(input)
}

// ════════════════════════════════════════════
//  FRANCE — IS + TVA
// ════════════════════════════════════════════

function simulateFR(input: TaxSimulationInput): TaxProjection {
  const { benefice_imposable, ca_total_ht, tva_taux, total_achats_ht, salaire_patron_net } = input
  const b = Math.max(0, benefice_imposable)

  // IS brackets
  const eligible = input.is_eligible_taux_reduit !== false // default true for small BTP
  let isTrancheReduite = 0
  let isTrancheNormale = 0
  let isTotal = 0

  if (eligible && b > 0) {
    isTrancheReduite = Math.min(b, 42500) * 0.15
    isTrancheNormale = Math.max(0, b - 42500) * 0.25
    isTotal = Math.round(isTrancheReduite + isTrancheNormale)
  } else if (b > 0) {
    isTotal = Math.round(b * 0.25)
    isTrancheNormale = isTotal
  }

  const tauxEffectif = b > 0 ? isTotal / b : 0

  // TVA
  const tvaCollectee = Math.round(ca_total_ht * tva_taux)
  const tvaDeductible = Math.round(total_achats_ht * tva_taux)
  const tvaAPayer = Math.max(0, tvaCollectee - tvaDeductible)

  // Bénéfice après impôts
  const beneficeApresImpots = Math.round(b - isTotal)

  // IR alternative (for TNS boss comparison)
  let irAlternative: number | undefined
  let recommendation: 'is' | 'ir' | 'neutral' | undefined

  if (salaire_patron_net && salaire_patron_net > 0) {
    // Simplified IR calculation on total income
    const revenuImposable = benefice_imposable // In IR regime, all profit = taxable income
    irAlternative = calculateIRFrance(revenuImposable)

    if (isTotal < irAlternative * 0.85) recommendation = 'is'
    else if (irAlternative < isTotal * 0.85) recommendation = 'ir'
    else recommendation = 'neutral'
  }

  return {
    country: 'FR',
    regime: 'IS',
    benefice_imposable: Math.round(b),
    is_tranche_reduite: Math.round(isTrancheReduite),
    is_tranche_normale: Math.round(isTrancheNormale),
    is_total: isTotal,
    taux_effectif: Math.round(tauxEffectif * 1000) / 10, // as %
    tva_collectee: tvaCollectee,
    tva_deductible: tvaDeductible,
    tva_a_payer: tvaAPayer,
    benefice_apres_impots: beneficeApresImpots,
    ir_alternative: irAlternative ? Math.round(irAlternative) : undefined,
    recommendation,
  }
}

/**
 * Simplified French IR calculation (barème 2025)
 * Progressive brackets: 0%, 11%, 30%, 41%, 45%
 */
function calculateIRFrance(revenuNet: number): number {
  if (revenuNet <= 0) return 0

  // Abattement 10% (salarié/TNS)
  const imposable = revenuNet * 0.9

  const brackets = [
    { limit: 11294, rate: 0 },
    { limit: 28797, rate: 0.11 },
    { limit: 82341, rate: 0.30 },
    { limit: 177106, rate: 0.41 },
    { limit: Infinity, rate: 0.45 },
  ]

  let tax = 0
  let prev = 0
  for (const b of brackets) {
    if (imposable <= prev) break
    const taxable = Math.min(imposable, b.limit) - prev
    tax += taxable * b.rate
    prev = b.limit
  }

  return tax
}

// ════════════════════════════════════════════
//  PORTUGAL — IRC + IVA
// ════════════════════════════════════════════

function simulatePT(input: TaxSimulationInput): TaxProjection {
  const { benefice_imposable, ca_total_ht, tva_taux, total_achats_ht } = input
  const b = Math.max(0, benefice_imposable)

  // IRC brackets (PME)
  // 17% up to 50,000€ (taxa reduzida para PME)
  // 21% above (taxa normal)
  let isTotal = 0
  let isTrancheReduite = 0
  let isTrancheNormale = 0

  if (b > 0) {
    isTrancheReduite = Math.min(b, 50000) * 0.17
    isTrancheNormale = Math.max(0, b - 50000) * 0.21
    isTotal = Math.round(isTrancheReduite + isTrancheNormale)
  }

  const tauxEffectif = b > 0 ? isTotal / b : 0

  // IVA (TVA portugaise)
  const tvaCollectee = Math.round(ca_total_ht * (tva_taux || 0.23))
  const tvaDeductible = Math.round(total_achats_ht * (tva_taux || 0.23))
  const tvaAPayer = Math.max(0, tvaCollectee - tvaDeductible)

  const beneficeApresImpots = Math.round(b - isTotal)

  return {
    country: 'PT',
    regime: 'IRC',
    benefice_imposable: Math.round(b),
    is_tranche_reduite: Math.round(isTrancheReduite),
    is_tranche_normale: Math.round(isTrancheNormale),
    is_total: isTotal,
    taux_effectif: Math.round(tauxEffectif * 1000) / 10,
    tva_collectee: tvaCollectee,
    tva_deductible: tvaDeductible,
    tva_a_payer: tvaAPayer,
    benefice_apres_impots: beneficeApresImpots,
  }
}
