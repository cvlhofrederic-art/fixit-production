/**
 * Payroll Engine — BTP Pro (FR + PT)
 *
 * Pure calculation functions. No React, no side effects.
 * Always branches by country first. Uses config values only.
 */

import {
  type Country,
  type CompanyTypeConfig,
  type BTPExtraCosts,
  resolveCompanyType,
} from '@/lib/config/companyTypes'

// ════════════════════════════════════════════
//  TYPES
// ════════════════════════════════════════════

export interface PayrollInput {
  country: Country
  company_type: string
  net_salary: number                  // Mensuel net
  heures_hebdo?: number               // Défaut: 35
  panier_repas_jour?: number          // Indemnité repas/jour
  indemnite_trajet_jour?: number      // Indemnité trajet/jour
  prime_mensuelle?: number
  overrides?: {
    employee_charge_rate?: number     // Fraction (0.22, pas 22)
    employer_charge_rate?: number
    btp_extra_costs?: Partial<BTPExtraCosts>
  }
}

export interface BTPCostLine {
  key: string
  label_fr: string
  label_pt: string
  rate: number                        // Fraction
  amount: number                      // Montant en €
}

export interface PayrollBreakdown {
  // Salaire
  net_salary: number
  gross_salary: number
  employee_charges: number
  employee_charge_rate: number

  // Charges patronales (hors BTP extras)
  employer_charges: number
  employer_charge_rate: number

  // BTP extras (congés payés, intempéries, etc.)
  btp_lines: BTPCostLine[]
  btp_total: number

  // Indemnités
  panier_repas_jour: number
  indemnite_trajet_jour: number
  indemnites_jour: number             // panier + trajet
  prime_mensuelle: number

  // Coûts totaux
  total_employer_cost_mensuel: number // brut + charges patronales + BTP extras + prime
  total_with_indemnites_jour: number  // coût/jour incluant indemnités
  cost_per_hour: number
  cost_per_day: number
  cost_per_month: number              // ~21.67 jours
  cost_per_year: number

  // Config utilisée
  config_key: string
  country: Country
}

export interface BossPayrollInput {
  country: Country
  company_type: string
  salary: number
  salary_type: 'net' | 'brut'
  override_charge_rate?: number
}

export interface BossPayrollResult {
  net: number
  gross: number
  charges: number
  charge_rate: number
  total_cost: number
  is_tns: boolean
}

// ════════════════════════════════════════════
//  UTILS
// ════════════════════════════════════════════

/** Brut = Net / (1 - employee_charge_rate) */
export function grossFromNet(net: number, employeeChargeRate: number): number {
  if (employeeChargeRate >= 1) return net
  return Math.round(net / (1 - employeeChargeRate))
}

/** Net = Brut × (1 - employee_charge_rate) */
export function netFromGross(gross: number, employeeChargeRate: number): number {
  return Math.round(gross * (1 - employeeChargeRate))
}

/** Coût horaire = montant mensuel / heures mensuelles */
export function hourlyFromMonthly(monthly: number, heuresHebdo: number): number {
  const heuresMois = heuresHebdo * 52 / 12 // 35h → 151.67
  return heuresMois > 0 ? Math.round(monthly / heuresMois * 100) / 100 : 0
}

/** Montant mensuel = coût horaire × heures mensuelles */
export function monthlyFromHourly(hourly: number, heuresHebdo: number): number {
  const heuresMois = heuresHebdo * 52 / 12
  return Math.round(hourly * heuresMois)
}

// ════════════════════════════════════════════
//  MAIN ENGINE
// ════════════════════════════════════════════

export function calculateEmployeeCost(input: PayrollInput): PayrollBreakdown {
  const { net_salary, overrides } = input
  const heures = input.heures_hebdo ?? 35
  const panierJour = input.panier_repas_jour ?? 0
  const trajetJour = input.indemnite_trajet_jour ?? 0
  const prime = input.prime_mensuelle ?? 0

  // Resolve config
  const config = resolveCompanyType(input.company_type, input.country)

  // Merge overrides
  const empRate = overrides?.employee_charge_rate ?? config.employee_charge_rate
  const emplRate = overrides?.employer_charge_rate ?? config.employer_charge_rate
  const btpOverrides = overrides?.btp_extra_costs ?? {}

  // Core calculation
  const gross = grossFromNet(net_salary, empRate)
  const employeeCharges = gross - net_salary
  const employerCharges = Math.round(gross * emplRate)

  // BTP extra costs — branch by country
  const btpLines: BTPCostLine[] = []

  if (config.country === 'FR') {
    const ccpRate = btpOverrides.caisse_conges_payes_pct ?? config.btp_extra_costs.caisse_conges_payes_pct ?? 0
    const intRate = btpOverrides.intemperies_pct ?? config.btp_extra_costs.intemperies_pct ?? 0
    const prevRate = btpOverrides.prevoyance_pct ?? config.btp_extra_costs.prevoyance_pct ?? 0
    const oppRate = btpOverrides.oppbtp_pct ?? config.btp_extra_costs.oppbtp_pct ?? 0

    if (ccpRate > 0) btpLines.push({ key: 'conges_payes', label_fr: 'Caisse congés payés BTP', label_pt: 'Caixa férias BTP', rate: ccpRate, amount: Math.round(gross * ccpRate) })
    if (intRate > 0) btpLines.push({ key: 'intemperies', label_fr: 'Intempéries BTP', label_pt: 'Intempéries BTP', rate: intRate, amount: Math.round(gross * intRate) })
    if (prevRate > 0) btpLines.push({ key: 'prevoyance', label_fr: 'Prévoyance BTP', label_pt: 'Previdência BTP', rate: prevRate, amount: Math.round(gross * prevRate) })
    if (oppRate > 0) btpLines.push({ key: 'oppbtp', label_fr: 'OPPBTP', label_pt: 'OPPBTP', rate: oppRate, amount: Math.round(gross * oppRate) })
  }

  if (config.country === 'PT') {
    const insRate = btpOverrides.insurance_accidents_pct ?? config.btp_extra_costs.insurance_accidents_pct ?? 0
    const fctRate = btpOverrides.fct_pct ?? config.btp_extra_costs.fct_pct ?? 0
    const fgctRate = btpOverrides.fgct_pct ?? config.btp_extra_costs.fgct_pct ?? 0

    if (insRate > 0) btpLines.push({ key: 'insurance', label_fr: 'Assurance accidents travail', label_pt: 'Seguro acidentes trabalho', rate: insRate, amount: Math.round(gross * insRate) })
    if (fctRate > 0) btpLines.push({ key: 'fct', label_fr: 'FCT (Fundo Compensação)', label_pt: 'FCT (Fundo de Compensação do Trabalho)', rate: fctRate, amount: Math.round(gross * fctRate) })
    if (fgctRate > 0) btpLines.push({ key: 'fgct', label_fr: 'FGCT (Garantie)', label_pt: 'FGCT (Fundo de Garantia)', rate: fgctRate, amount: Math.round(gross * fgctRate) })
  }

  const btpTotal = btpLines.reduce((s, l) => s + l.amount, 0)

  // Totaux
  const totalEmployerMensuel = gross + employerCharges + btpTotal + prime
  const indemnitesJour = panierJour + trajetJour
  const heuresJour = heures / 5
  const costPerHour = hourlyFromMonthly(totalEmployerMensuel, heures)
  const costPerDay = Math.round((costPerHour * heuresJour + indemnitesJour) * 100) / 100
  const costPerMonth = Math.round(costPerDay * 21.67)
  const costPerYear = costPerMonth * 12

  return {
    net_salary,
    gross_salary: gross,
    employee_charges: employeeCharges,
    employee_charge_rate: empRate,
    employer_charges: employerCharges,
    employer_charge_rate: emplRate,
    btp_lines: btpLines,
    btp_total: btpTotal,
    panier_repas_jour: panierJour,
    indemnite_trajet_jour: trajetJour,
    indemnites_jour: indemnitesJour,
    prime_mensuelle: prime,
    total_employer_cost_mensuel: totalEmployerMensuel,
    total_with_indemnites_jour: costPerDay,
    cost_per_hour: costPerHour,
    cost_per_day: costPerDay,
    cost_per_month: costPerMonth,
    cost_per_year: costPerYear,
    config_key: config.key,
    country: config.country,
  }
}

// ════════════════════════════════════════════
//  BOSS COST CALCULATION
// ════════════════════════════════════════════

export function calculateBossCost(input: BossPayrollInput): BossPayrollResult {
  const config = resolveCompanyType(input.company_type, input.country)
  const chargeRate = input.override_charge_rate ?? config.boss_charge_rate

  let net: number, gross: number, charges: number

  if (config.boss_is_tns) {
    // TNS: charges calculées sur le revenu net
    // Net = ce qu'il se verse. Charges = net × taux. Total = net + charges.
    if (input.salary_type === 'net') {
      net = input.salary
      charges = Math.round(net * chargeRate)
      gross = net + charges
    } else {
      gross = input.salary
      net = Math.round(gross / (1 + chargeRate))
      charges = gross - net
    }
  } else {
    // Assimilé salarié: fiche de paie classique
    if (input.salary_type === 'net') {
      net = input.salary
      gross = grossFromNet(net, config.employee_charge_rate)
      charges = Math.round(gross * chargeRate)
    } else {
      gross = input.salary
      net = netFromGross(gross, config.employee_charge_rate)
      charges = Math.round(gross * chargeRate)
    }
  }

  return {
    net,
    gross,
    charges,
    charge_rate: chargeRate,
    total_cost: gross + charges,
    is_tns: config.boss_is_tns,
  }
}

// ════════════════════════════════════════════
//  VALIDATION HELPERS
// ════════════════════════════════════════════

export interface PayrollWarning {
  type: 'error' | 'warning'
  message_fr: string
  message_pt: string
}

export function validatePayroll(breakdown: PayrollBreakdown): PayrollWarning[] {
  const warnings: PayrollWarning[] = []

  if (breakdown.country === 'FR') {
    if (breakdown.gross_salary > 0 && breakdown.gross_salary < 1747) {
      warnings.push({ type: 'warning', message_fr: 'Salaire brut en dessous du SMIC 2025 (1 747€)', message_pt: 'Salário bruto abaixo do SMIC 2025 (1 747€)' })
    }
    if (breakdown.cost_per_hour > 0 && breakdown.net_salary > 0) {
      const tauxHBrut = hourlyFromMonthly(breakdown.gross_salary, 35)
      if (tauxHBrut < 11.88) {
        warnings.push({ type: 'warning', message_fr: 'Taux horaire brut en dessous du SMIC horaire (11,88€)', message_pt: 'Taxa horária bruta abaixo do SMIC horário (11,88€)' })
      }
    }
  }

  if (breakdown.country === 'PT') {
    if (breakdown.gross_salary > 0 && breakdown.gross_salary < 870) {
      warnings.push({ type: 'warning', message_fr: 'Salaire brut en dessous du salaire minimum PT 2025 (870€)', message_pt: 'Salário bruto abaixo do salário mínimo 2025 (870€)' })
    }
  }

  if (breakdown.net_salary > 0 && breakdown.gross_salary > 0 && breakdown.net_salary >= breakdown.gross_salary) {
    warnings.push({ type: 'error', message_fr: 'Le net ne peut pas être ≥ au brut', message_pt: 'O líquido não pode ser ≥ ao bruto' })
  }

  return warnings
}
