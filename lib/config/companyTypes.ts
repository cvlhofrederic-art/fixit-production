/**
 * Company Types Configuration — FR & PT BTP
 *
 * Sources:
 * FR: URSSAF 2025, Caisse des congés payés BTP, OPPBTP
 * PT: Segurança Social 2025, ACT, FCT/FGCT
 *
 * Taux = fractions (0.22 = 22%)
 */

export type Country = 'FR' | 'PT'

export interface BTPExtraCosts {
  // FR BTP
  caisse_conges_payes_pct?: number  // Caisse congés payés BTP (~19.80% du brut)
  intemperies_pct?: number          // Caisse intempéries BTP (~0.68%)
  prevoyance_pct?: number           // Prévoyance BTP PRO (~1.50%)
  oppbtp_pct?: number               // OPPBTP formation/sécurité (~0.11%)
  // PT BTP
  insurance_accidents_pct?: number  // Seguro acidentes trabalho (~2%)
  fct_pct?: number                  // Fundo Compensação Trabalho (1%)
  fgct_pct?: number                 // Fundo Garantia Compensação (0.075%)
}

export interface CompanyTypeConfig {
  key: string
  label_fr: string
  label_pt: string
  country: Country
  net_to_gross_ratio: number        // Net × ratio ≈ Brut
  employee_charge_rate: number      // Part salariale (fraction)
  employer_charge_rate: number      // Part patronale hors BTP extras (fraction)
  btp_extra_costs: BTPExtraCosts
  default_taux_is: number           // Taux IS par défaut
  boss_is_tns: boolean              // TNS (gérant majoritaire) vs assimilé salarié
  boss_charge_rate: number          // Taux charges du dirigeant
}

// ════════════════════════════════════════════
//  FRANCE — Types de sociétés BTP
// ════════════════════════════════════════════

const FR_BTP_EXTRAS: BTPExtraCosts = {
  caisse_conges_payes_pct: 0.1980,
  intemperies_pct: 0.0068,
  prevoyance_pct: 0.0150,
  oppbtp_pct: 0.0011,
}

export const FR_COMPANY_TYPES: CompanyTypeConfig[] = [
  {
    key: 'sarl',
    label_fr: 'SARL',
    label_pt: 'SARL (França)',
    country: 'FR',
    net_to_gross_ratio: 1.282,
    employee_charge_rate: 0.22,
    employer_charge_rate: 0.45,
    btp_extra_costs: FR_BTP_EXTRAS,
    default_taux_is: 0.25,
    boss_is_tns: true,               // Gérant majoritaire = TNS
    boss_charge_rate: 0.45,          // SSI (ex RSI)
  },
  {
    key: 'eurl',
    label_fr: 'EURL',
    label_pt: 'EURL (França)',
    country: 'FR',
    net_to_gross_ratio: 1.282,
    employee_charge_rate: 0.22,
    employer_charge_rate: 0.45,
    btp_extra_costs: FR_BTP_EXTRAS,
    default_taux_is: 0.25,
    boss_is_tns: true,
    boss_charge_rate: 0.45,
  },
  {
    key: 'sas',
    label_fr: 'SAS',
    label_pt: 'SAS (França)',
    country: 'FR',
    net_to_gross_ratio: 1.282,
    employee_charge_rate: 0.22,
    employer_charge_rate: 0.50,       // Assimilé salarié = charges patronales + haut
    btp_extra_costs: FR_BTP_EXTRAS,
    default_taux_is: 0.25,
    boss_is_tns: false,               // Président = assimilé salarié
    boss_charge_rate: 0.82,           // Charges globales assimilé salarié (~82% du net)
  },
  {
    key: 'sasu',
    label_fr: 'SASU',
    label_pt: 'SASU (França)',
    country: 'FR',
    net_to_gross_ratio: 1.282,
    employee_charge_rate: 0.22,
    employer_charge_rate: 0.50,
    btp_extra_costs: FR_BTP_EXTRAS,
    default_taux_is: 0.25,
    boss_is_tns: false,
    boss_charge_rate: 0.82,
  },
  {
    key: 'sa',
    label_fr: 'SA',
    label_pt: 'SA (França)',
    country: 'FR',
    net_to_gross_ratio: 1.282,
    employee_charge_rate: 0.22,
    employer_charge_rate: 0.50,
    btp_extra_costs: FR_BTP_EXTRAS,
    default_taux_is: 0.25,
    boss_is_tns: false,
    boss_charge_rate: 0.82,
  },
  {
    key: 'snc',
    label_fr: 'SNC',
    label_pt: 'SNC (França)',
    country: 'FR',
    net_to_gross_ratio: 1.282,
    employee_charge_rate: 0.22,
    employer_charge_rate: 0.45,
    btp_extra_costs: FR_BTP_EXTRAS,
    default_taux_is: 0,               // SNC = IR par défaut
    boss_is_tns: true,
    boss_charge_rate: 0.45,
  },
  {
    key: 'scs',
    label_fr: 'SCS',
    label_pt: 'SCS (França)',
    country: 'FR',
    net_to_gross_ratio: 1.282,
    employee_charge_rate: 0.22,
    employer_charge_rate: 0.45,
    btp_extra_costs: FR_BTP_EXTRAS,
    default_taux_is: 0,
    boss_is_tns: true,
    boss_charge_rate: 0.45,
  },
  {
    key: 'sca',
    label_fr: 'SCA',
    label_pt: 'SCA (França)',
    country: 'FR',
    net_to_gross_ratio: 1.282,
    employee_charge_rate: 0.22,
    employer_charge_rate: 0.50,
    btp_extra_costs: FR_BTP_EXTRAS,
    default_taux_is: 0.25,
    boss_is_tns: false,
    boss_charge_rate: 0.82,
  },
  {
    key: 'scop',
    label_fr: 'SCOP',
    label_pt: 'SCOP (França)',
    country: 'FR',
    net_to_gross_ratio: 1.282,
    employee_charge_rate: 0.22,
    employer_charge_rate: 0.45,
    btp_extra_costs: FR_BTP_EXTRAS,
    default_taux_is: 0.25,
    boss_is_tns: false,
    boss_charge_rate: 0.60,
  },
]

// ════════════════════════════════════════════
//  PORTUGAL — Types de sociétés BTP
// ════════════════════════════════════════════

const PT_BTP_EXTRAS: BTPExtraCosts = {
  insurance_accidents_pct: 0.02,      // Seguro acidentes trabalho (construction = ~2%)
  fct_pct: 0.01,                      // Fundo Compensação Trabalho
  fgct_pct: 0.00075,                  // Fundo Garantia Compensação Trabalho
}

export const PT_COMPANY_TYPES: CompanyTypeConfig[] = [
  {
    key: 'lda',
    label_fr: 'LDA (Sociedade por Quotas)',
    label_pt: 'Sociedade por Quotas (Lda.)',
    country: 'PT',
    net_to_gross_ratio: 1.124,
    employee_charge_rate: 0.11,       // TSU salarial
    employer_charge_rate: 0.2375,     // TSU patronal
    btp_extra_costs: PT_BTP_EXTRAS,
    default_taux_is: 0.21,            // IRC
    boss_is_tns: false,               // Gerente = MOE (Membro Órgão Estatutário)
    boss_charge_rate: 0.2375,
  },
  {
    key: 'lda_unipessoal',
    label_fr: 'LDA Unipessoal',
    label_pt: 'Sociedade Unipessoal por Quotas',
    country: 'PT',
    net_to_gross_ratio: 1.124,
    employee_charge_rate: 0.11,
    employer_charge_rate: 0.2375,
    btp_extra_costs: PT_BTP_EXTRAS,
    default_taux_is: 0.21,
    boss_is_tns: false,
    boss_charge_rate: 0.2375,
  },
  {
    key: 'sa_pt',
    label_fr: 'SA (Portugal)',
    label_pt: 'Sociedade Anónima (SA)',
    country: 'PT',
    net_to_gross_ratio: 1.124,
    employee_charge_rate: 0.11,
    employer_charge_rate: 0.2375,
    btp_extra_costs: PT_BTP_EXTRAS,
    default_taux_is: 0.21,
    boss_is_tns: false,
    boss_charge_rate: 0.2375,
  },
  {
    key: 'eni',
    label_fr: 'ENI (Empresário em Nome Individual)',
    label_pt: 'Empresário em Nome Individual (ENI)',
    country: 'PT',
    net_to_gross_ratio: 1.124,
    employee_charge_rate: 0.11,
    employer_charge_rate: 0.2375,
    btp_extra_costs: PT_BTP_EXTRAS,
    default_taux_is: 0,               // IRS, pas IRC
    boss_is_tns: true,                // Indépendant
    boss_charge_rate: 0.2141,         // Trabalhador independente: 21.41%
  },
  {
    key: 'eirl_pt',
    label_fr: 'EIRL (Portugal)',
    label_pt: 'Estabelecimento Individual de Responsabilidade Limitada',
    country: 'PT',
    net_to_gross_ratio: 1.124,
    employee_charge_rate: 0.11,
    employer_charge_rate: 0.2375,
    btp_extra_costs: PT_BTP_EXTRAS,
    default_taux_is: 0.21,
    boss_is_tns: true,
    boss_charge_rate: 0.2141,
  },
  {
    key: 'snc_pt',
    label_fr: 'SNC (Portugal)',
    label_pt: 'Sociedade em Nome Coletivo',
    country: 'PT',
    net_to_gross_ratio: 1.124,
    employee_charge_rate: 0.11,
    employer_charge_rate: 0.2375,
    btp_extra_costs: PT_BTP_EXTRAS,
    default_taux_is: 0.21,
    boss_is_tns: false,
    boss_charge_rate: 0.2375,
  },
  {
    key: 'comandita',
    label_fr: 'Sociedade em Comandita',
    label_pt: 'Sociedade em Comandita',
    country: 'PT',
    net_to_gross_ratio: 1.124,
    employee_charge_rate: 0.11,
    employer_charge_rate: 0.2375,
    btp_extra_costs: PT_BTP_EXTRAS,
    default_taux_is: 0.21,
    boss_is_tns: false,
    boss_charge_rate: 0.2375,
  },
  {
    key: 'cooperativa',
    label_fr: 'Coopérative (Portugal)',
    label_pt: 'Cooperativa',
    country: 'PT',
    net_to_gross_ratio: 1.124,
    employee_charge_rate: 0.11,
    employer_charge_rate: 0.2375,
    btp_extra_costs: PT_BTP_EXTRAS,
    default_taux_is: 0.21,
    boss_is_tns: false,
    boss_charge_rate: 0.2375,
  },
]

// ════════════════════════════════════════════
//  EXPORTS
// ════════════════════════════════════════════

const ALL_TYPES = [...FR_COMPANY_TYPES, ...PT_COMPANY_TYPES]

/** Flat lookup by key */
export const COMPANY_TYPES: Record<string, CompanyTypeConfig> = Object.fromEntries(
  ALL_TYPES.map(t => [t.key, t])
)

/** Get all company types for a country */
export function getCompanyTypesByCountry(country: Country): CompanyTypeConfig[] {
  return country === 'FR' ? FR_COMPANY_TYPES : PT_COMPANY_TYPES
}

/** Get default company type for a country */
export function getDefaultCompanyType(country: Country): CompanyTypeConfig {
  return country === 'FR' ? FR_COMPANY_TYPES[0] : PT_COMPANY_TYPES[0]
}

/** Resolve a company type config, with fallback to country default */
export function resolveCompanyType(key: string | undefined, country: Country): CompanyTypeConfig {
  if (key && COMPANY_TYPES[key] && COMPANY_TYPES[key].country === country) {
    return COMPANY_TYPES[key]
  }
  // Fallback: try to match by key regardless of country mismatch
  if (key && COMPANY_TYPES[key]) {
    return COMPANY_TYPES[key]
  }
  return getDefaultCompanyType(country)
}
