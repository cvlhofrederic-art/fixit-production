/**
 * Pipeline Types — shared interfaces between all analytics services
 * Payroll → Duration → Profitability → Market → Smart Pricing → Quote → Tax → KPI
 */

import type { Country } from '@/lib/config/companyTypes'
import type { PayrollBreakdown } from '@/lib/payroll/engine'

// ════════════════════════════════════════════
//  CHANTIER CONTEXT
// ════════════════════════════════════════════

export interface ChantierContext {
  id: string
  titre: string
  client: string
  budget: number
  montant_facture: number
  acompte_recu: number
  date_debut: string
  date_fin: string
  statut: string
  marge_prevue_pct: number
  tva_taux: number
  penalite_retard_jour: number
  surface_m2?: number
  task_type?: string
}

export interface ChantierCosts {
  chantier_id: string
  total_heures: number
  nb_ouvriers: number
  nb_jours_pointes: number
  cout_main_oeuvre_brut: number
  cout_charges_patronales: number
  cout_indemnites: number
  cout_main_oeuvre_total: number
  total_materiaux: number
  total_autres: number
  total_depenses: number
  cout_total: number
  ca_reel: number
  detail_ouvriers: WorkerDetail[]
}

export interface WorkerDetail {
  membre_id: string
  nom: string
  heures: number
  cout_horaire: number
  cout_total: number
}

// ════════════════════════════════════════════
//  PROFITABILITY OUTPUT
// ════════════════════════════════════════════

export interface ChantierProfitability {
  chantier_id: string
  titre: string
  ca: number
  cout_total: number
  benefice_brut: number
  marge_pct: number
  benefice_par_homme_jour: number
  perte_par_jour_retard: number
  score: number                     // 0-10
  status: 'profit' | 'warning' | 'loss'
  jours_prevu: number
  jours_pointes: number
  retard_jours: number
}

export interface GlobalProfitability {
  total_ca: number
  total_cout_chantiers: number
  frais_fixes_mensuel: number
  salaire_patron_charge: number
  amortissements: number
  benefice_brut: number
  impots: number
  benefice_net: number
  marge_globale_pct: number
  nb_chantiers: number
  nb_mois: number
}

// ════════════════════════════════════════════
//  DURATION ESTIMATOR OUTPUT
// ════════════════════════════════════════════

export interface DurationEstimate {
  task_type: string
  surface_m2: number
  nb_workers: number
  productivity_rate: number         // m²/day/worker
  duration_days: number
  duration_hours: number
  total_worker_days: number
  confidence: 'high' | 'medium' | 'low'
}

// ════════════════════════════════════════════
//  MARKET PRICING OUTPUT
// ════════════════════════════════════════════

export interface MarketComparison {
  trade: string
  your_rate_hour: number
  market_min: number
  market_avg: number
  market_max: number
  percentile: number                // 0-100 where you sit
  strategy: 'increase' | 'reduce' | 'ok'
  country: Country
}

// ════════════════════════════════════════════
//  SMART PRICING OUTPUT
// ════════════════════════════════════════════

export interface PricingRecommendation {
  daily_cost: number
  overhead_per_day: number
  target_margin: number
  market_min: number
  market_max: number
  optimal_price_day: number
  optimal_price_hour: number
  price_corridor: {
    min_competitive: number
    recommended: number
    premium: number
  }
  strategy: 'increase' | 'reduce' | 'ok'
}

// ════════════════════════════════════════════
//  TAX SIMULATION OUTPUT
// ════════════════════════════════════════════

export interface TaxProjection {
  country: Country
  regime: string
  benefice_imposable: number
  // FR IS brackets
  is_tranche_reduite?: number       // 15% up to 42500€
  is_tranche_normale?: number       // 25% above
  is_total: number
  taux_effectif: number
  // TVA
  tva_collectee: number
  tva_deductible: number
  tva_a_payer: number
  // Net
  benefice_apres_impots: number
  // Comparison
  ir_alternative?: number           // What IR would cost (TNS bosses)
  recommendation?: 'is' | 'ir' | 'neutral'
}

// ════════════════════════════════════════════
//  QUOTE GENERATOR OUTPUT
// ════════════════════════════════════════════

export interface QuoteLine {
  description: string
  unite: string                     // m², ml, h, j, f, lot
  quantite: number
  prix_unitaire_ht: number
  tva_rate: number
  montant_ht: number
  category: 'main_oeuvre' | 'materiaux' | 'fournitures' | 'sous_traitance' | 'divers'
}

export interface GeneratedQuote {
  lines: QuoteLine[]
  total_ht: number
  total_tva: number
  total_ttc: number
  marge_prevue_pct: number
  duration_estimate?: DurationEstimate
  pricing_source: 'engine' | 'market' | 'custom'
}

// ════════════════════════════════════════════
//  KPI DASHBOARD OUTPUT
// ════════════════════════════════════════════

export type KPIStatus = 'profit' | 'warning' | 'loss'

export interface KPICard {
  key: string
  label_fr: string
  label_pt: string
  value: number
  formatted: string
  unit?: string
  status?: KPIStatus
  trend?: number                    // % change vs previous period
}

export interface KPIDashboard {
  // Financial
  revenue: KPICard
  costs: KPICard
  profit: KPICard
  profit_after_tax: KPICard
  margin_rate: KPICard
  global_status: KPIStatus

  // Operational
  nb_chantiers: KPICard
  avg_score: KPICard
  utilization_rate: KPICard         // heures pointees / heures dispo
  revenue_per_employee: KPICard

  // Alerts
  alerts: KPIAlert[]
}

export interface KPIAlert {
  type: 'error' | 'warning' | 'info'
  message_fr: string
  message_pt: string
}
