/**
 * TaxCalculator — Facade over companyTypes + payroll engine
 *
 * Maps legal form labels (from SIRET API / NIF verification) to
 * companyTypes keys, and exposes all rate/calculation helpers.
 */

import {
  type Country,
  type CompanyTypeConfig,
  resolveCompanyType,
  getCompanyTypesByCountry,
  FR_COMPANY_TYPES,
  PT_COMPANY_TYPES,
} from '@/lib/config/companyTypes'
import {
  calculateEmployeeCost,
  calculateBossCost,
  type PayrollInput,
  type PayrollBreakdown,
  type BossPayrollInput,
  type BossPayrollResult,
} from '@/lib/payroll/engine'

// ════════════════════════════════════════════
//  LEGAL FORM → companyTypes KEY MAPPING
// ════════════════════════════════════════════

/**
 * Map SIRET API legalForm label to companyTypes key.
 * The API returns labels like "SAS", "SARL", "Entrepreneur individuel", etc.
 */
const FR_LABEL_TO_KEY: Record<string, string> = {
  // Exact matches (from api.gouv.fr nature_juridique_label)
  'sas': 'sas',
  'sasu': 'sasu',
  'sarl': 'sarl',
  'eurl': 'eurl',
  'sa': 'sa',
  'snc': 'snc',
  'scs': 'scs',
  'sca': 'sca',
  'scop': 'scop',
  // Full label variants
  'société par actions simplifiée': 'sas',
  'société par actions simplifiée à associé unique': 'sasu',
  'société à responsabilité limitée': 'sarl',
  'entreprise unipersonnelle à responsabilité limitée': 'eurl',
  'société anonyme': 'sa',
  'société en nom collectif': 'snc',
  'société en commandite simple': 'scs',
  'société en commandite par actions': 'sca',
  'société coopérative': 'scop',
  // Nature juridique code prefixes (from INSEE)
  'entrepreneur individuel': 'eurl', // Closest match
  'ei': 'eurl',
}

const PT_LABEL_TO_KEY: Record<string, string> = {
  'lda': 'lda',
  'lda.': 'lda',
  'sociedade por quotas': 'lda',
  'unipessoal lda': 'lda_unipessoal',
  'unipessoal lda.': 'lda_unipessoal',
  'sociedade unipessoal por quotas': 'lda_unipessoal',
  'sociedade unipessoal': 'lda_unipessoal',
  'sa': 'sa_pt',
  'sociedade anónima': 'sa_pt',
  'eni': 'eni',
  'empresário em nome individual': 'eni',
  'eirl': 'eirl_pt',
  'snc': 'snc_pt',
  'sociedade em nome coletivo': 'snc_pt',
  'comandita': 'comandita',
  'sociedade em comandita': 'comandita',
  'cooperativa': 'cooperativa',
}

/**
 * Resolve a legal form label (from SIRET/NIF API) to a companyTypes key.
 * Case-insensitive, tries exact match then fuzzy.
 */
export function mapLegalFormToKey(label: string, country: Country): string | null {
  const lower = label.toLowerCase().trim()
  const map = country === 'FR' ? FR_LABEL_TO_KEY : PT_LABEL_TO_KEY

  // Exact match
  if (map[lower]) return map[lower]

  // Partial match: check if label contains a known key
  for (const [pattern, key] of Object.entries(map)) {
    if (lower.includes(pattern) || pattern.includes(lower)) return key
  }

  return null
}

/**
 * Get available legal structures for a country, formatted for a <select>.
 */
export function getLegalStructureOptions(country: Country): Array<{ key: string; label: string }> {
  const types = getCompanyTypesByCountry(country)
  return types.map(t => ({
    key: t.key,
    label: country === 'FR' ? t.label_fr : t.label_pt,
  }))
}

// ════════════════════════════════════════════
//  TAX CALCULATOR CLASS
// ════════════════════════════════════════════

export class TaxCalculator {
  readonly country: Country
  readonly companyTypeKey: string
  readonly config: CompanyTypeConfig

  constructor(companyTypeKey: string, country: Country) {
    this.country = country
    this.companyTypeKey = companyTypeKey
    this.config = resolveCompanyType(companyTypeKey, country)
  }

  /** Create from a legal form label (SIRET API response) */
  static fromLabel(label: string, country: Country): TaxCalculator {
    const key = mapLegalFormToKey(label, country)
    return new TaxCalculator(key || (country === 'FR' ? 'sarl' : 'lda'), country)
  }

  // ── Rates ──

  get employeeChargeRate(): number { return this.config.employee_charge_rate }
  get employerChargeRate(): number { return this.config.employer_charge_rate }
  get bossChargeRate(): number { return this.config.boss_charge_rate }
  get bossIsTNS(): boolean { return this.config.boss_is_tns }
  get defaultTauxIS(): number { return this.config.default_taux_is }

  /** Total BTP extra cost rate (sum of all BTP-specific contributions) */
  get btpExtraRate(): number {
    const e = this.config.btp_extra_costs
    if (this.country === 'FR') {
      return (e.caisse_conges_payes_pct || 0) + (e.intemperies_pct || 0)
        + (e.prevoyance_pct || 0) + (e.oppbtp_pct || 0)
    }
    return (e.insurance_accidents_pct || 0) + (e.fct_pct || 0) + (e.fgct_pct || 0)
  }

  /** Total employer cost rate (employer charges + BTP extras) */
  get totalEmployerRate(): number {
    return this.employerChargeRate + this.btpExtraRate
  }

  // ── Calculations ──

  /** Full employee cost breakdown */
  employeeCost(input: Omit<PayrollInput, 'country' | 'company_type'>): PayrollBreakdown {
    return calculateEmployeeCost({
      ...input,
      country: this.country,
      company_type: this.companyTypeKey,
    })
  }

  /** Boss/dirigeant cost */
  bossCost(input: Omit<BossPayrollInput, 'country' | 'company_type'>): BossPayrollResult {
    return calculateBossCost({
      ...input,
      country: this.country,
      company_type: this.companyTypeKey,
    })
  }

  /** Quick comparison: how much more/less expensive vs another structure */
  compareWith(otherKey: string): {
    employerDiff: number
    bossDiff: number
    label: string
  } {
    const other = new TaxCalculator(otherKey, this.country)
    return {
      employerDiff: this.totalEmployerRate - other.totalEmployerRate,
      bossDiff: this.bossChargeRate - other.bossChargeRate,
      label: this.country === 'FR' ? other.config.label_fr : other.config.label_pt,
    }
  }

  /** Summary string for display */
  summary(): string {
    const label = this.country === 'FR' ? this.config.label_fr : this.config.label_pt
    const pct = (n: number) => `${(n * 100).toFixed(1)}%`
    return `${label} — Patronal: ${pct(this.employerChargeRate)} + BTP: ${pct(this.btpExtraRate)} = ${pct(this.totalEmployerRate)} | Dirigeant: ${pct(this.bossChargeRate)} (${this.bossIsTNS ? 'TNS' : 'Assimilé salarié'})`
  }
}

// ════════════════════════════════════════════
//  CONVENIENCE EXPORTS
// ════════════════════════════════════════════

export { resolveCompanyType, getCompanyTypesByCountry }
export type { CompanyTypeConfig, Country, PayrollBreakdown, BossPayrollResult }
