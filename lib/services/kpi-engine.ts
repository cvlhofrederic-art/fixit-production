/**
 * KPI Engine — BTP Pro Analytics
 *
 * Aggregates all upstream analytics into a unified KPI dashboard.
 * Pipeline: Payroll → Duration → Profitability → Market → Smart Pricing → Quote → Tax → KPI
 * Pure functions, no React.
 */

import type {
  ChantierProfitability,
  GlobalProfitability,
  KPIDashboard,
  KPICard,
  KPIAlert,
  KPIStatus,
  MarketComparison,
  TaxProjection,
} from './pipeline-types'

// ════════════════════════════════════════════
//  MAIN KPI BUILDER
// ════════════════════════════════════════════

export interface KPIInput {
  // From profitability service
  chantierProfitabilities: ChantierProfitability[]
  globalProfitability: GlobalProfitability

  // From tax simulation
  taxProjection?: TaxProjection

  // From market pricing
  marketComparisons?: MarketComparison[]

  // Operational data
  total_heures_pointees: number
  total_heures_disponibles: number  // nb_workers × heures_hebdo × 4.33 × nb_mois
  nb_employees: number

  // Settings
  objectif_marge_pct: number
  devise: string                     // 'EUR', 'BRL', etc.
}

export function buildKPIDashboard(input: KPIInput): KPIDashboard {
  const {
    globalProfitability: gp,
    chantierProfitabilities: chantiers,
    taxProjection,
    total_heures_pointees,
    total_heures_disponibles,
    nb_employees,
    objectif_marge_pct,
    devise,
  } = input

  const symbol = devise === 'EUR' ? '€' : devise

  // ── Financial KPIs ──
  const revenue = makeCard('revenue', 'Chiffre d\'affaires', 'Volume de negócios', gp.total_ca, `${formatMoney(gp.total_ca)}${symbol}`, symbol)
  const costs = makeCard('costs', 'Coûts totaux', 'Custos totais', gp.total_cout_chantiers + gp.frais_fixes_mensuel + gp.salaire_patron_charge + gp.amortissements, `${formatMoney(gp.total_cout_chantiers + gp.frais_fixes_mensuel + gp.salaire_patron_charge + gp.amortissements)}${symbol}`, symbol)
  const profit = makeCard('profit', 'Bénéfice brut', 'Lucro bruto', gp.benefice_brut, `${formatMoney(gp.benefice_brut)}${symbol}`, symbol, statusFromValue(gp.benefice_brut, 0))

  const profitAfterTax = taxProjection
    ? makeCard('profit_after_tax', 'Bénéfice net (après impôts)', 'Lucro líquido (após impostos)', taxProjection.benefice_apres_impots, `${formatMoney(taxProjection.benefice_apres_impots)}${symbol}`, symbol, statusFromValue(taxProjection.benefice_apres_impots, 0))
    : makeCard('profit_after_tax', 'Bénéfice net (après impôts)', 'Lucro líquido (após impostos)', gp.benefice_net, `${formatMoney(gp.benefice_net)}${symbol}`, symbol, statusFromValue(gp.benefice_net, 0))

  const marginRate = makeCard(
    'margin_rate', 'Marge globale', 'Margem global',
    gp.marge_globale_pct,
    `${gp.marge_globale_pct}%`,
    '%',
    gp.marge_globale_pct >= objectif_marge_pct ? 'profit' : gp.marge_globale_pct >= 0 ? 'warning' : 'loss'
  )

  const globalStatus: KPIStatus = gp.marge_globale_pct >= objectif_marge_pct
    ? 'profit'
    : gp.marge_globale_pct >= 0
      ? 'warning'
      : 'loss'

  // ── Operational KPIs ──
  const nbChantiers = makeCard('nb_chantiers', 'Chantiers', 'Obras', gp.nb_chantiers, `${gp.nb_chantiers}`)

  const avgScore = chantiers.length > 0
    ? chantiers.reduce((s, c) => s + c.score, 0) / chantiers.length
    : 0
  const avgScoreCard = makeCard(
    'avg_score', 'Score moyen', 'Pontuação média',
    Math.round(avgScore * 10) / 10,
    `${(Math.round(avgScore * 10) / 10).toFixed(1)}/10`,
    '/10',
    avgScore >= 7 ? 'profit' : avgScore >= 5 ? 'warning' : 'loss'
  )

  const utilizationPct = total_heures_disponibles > 0
    ? Math.round((total_heures_pointees / total_heures_disponibles) * 100)
    : 0
  const utilizationRate = makeCard(
    'utilization_rate', 'Taux d\'occupation', 'Taxa de ocupação',
    utilizationPct,
    `${utilizationPct}%`,
    '%',
    utilizationPct >= 80 ? 'profit' : utilizationPct >= 60 ? 'warning' : 'loss'
  )

  const revPerEmp = nb_employees > 0 ? Math.round(gp.total_ca / nb_employees) : 0
  const revenuePerEmployee = makeCard(
    'revenue_per_employee', 'CA par employé', 'Volume negócios por empregado',
    revPerEmp,
    `${formatMoney(revPerEmp)}${symbol}`,
    symbol
  )

  // ── Alerts ──
  const alerts = generateAlerts(input)

  return {
    revenue,
    costs,
    profit,
    profit_after_tax: profitAfterTax,
    margin_rate: marginRate,
    global_status: globalStatus,
    nb_chantiers: nbChantiers,
    avg_score: avgScoreCard,
    utilization_rate: utilizationRate,
    revenue_per_employee: revenuePerEmployee,
    alerts,
  }
}

// ════════════════════════════════════════════
//  ALERT GENERATION
// ════════════════════════════════════════════

function generateAlerts(input: KPIInput): KPIAlert[] {
  const alerts: KPIAlert[] = []
  const { globalProfitability: gp, chantierProfitabilities: chantiers, marketComparisons, objectif_marge_pct } = input

  // Margin below target
  if (gp.marge_globale_pct < objectif_marge_pct && gp.total_ca > 0) {
    alerts.push({
      type: gp.marge_globale_pct < 0 ? 'error' : 'warning',
      message_fr: `Marge globale (${gp.marge_globale_pct}%) en dessous de l'objectif (${objectif_marge_pct}%)`,
      message_pt: `Margem global (${gp.marge_globale_pct}%) abaixo do objetivo (${objectif_marge_pct}%)`,
    })
  }

  // Chantiers in loss
  const lossingChantiers = chantiers.filter(c => c.status === 'loss')
  if (lossingChantiers.length > 0) {
    alerts.push({
      type: 'error',
      message_fr: `${lossingChantiers.length} chantier(s) en perte`,
      message_pt: `${lossingChantiers.length} obra(s) com prejuízo`,
    })
  }

  // Chantiers with delay
  const delayedChantiers = chantiers.filter(c => c.retard_jours > 0)
  if (delayedChantiers.length > 0) {
    const totalRetard = delayedChantiers.reduce((s, c) => s + c.retard_jours, 0)
    alerts.push({
      type: 'warning',
      message_fr: `${delayedChantiers.length} chantier(s) en retard (${totalRetard} jours cumulés)`,
      message_pt: `${delayedChantiers.length} obra(s) com atraso (${totalRetard} dias acumulados)`,
    })
  }

  // Low utilization
  const utilizationPct = input.total_heures_disponibles > 0
    ? (input.total_heures_pointees / input.total_heures_disponibles) * 100
    : 0
  if (utilizationPct < 60 && input.total_heures_disponibles > 0) {
    alerts.push({
      type: 'warning',
      message_fr: `Taux d'occupation faible (${Math.round(utilizationPct)}%)`,
      message_pt: `Taxa de ocupação baixa (${Math.round(utilizationPct)}%)`,
    })
  }

  // Market pricing alerts
  if (marketComparisons) {
    const underpriced = marketComparisons.filter(m => m.strategy === 'increase')
    if (underpriced.length > 0) {
      alerts.push({
        type: 'info',
        message_fr: `${underpriced.length} corps de métier sous-tarifé(s) par rapport au marché`,
        message_pt: `${underpriced.length} especialidade(s) com preço abaixo do mercado`,
      })
    }
  }

  // No revenue
  if (gp.total_ca === 0 && gp.nb_chantiers === 0) {
    alerts.push({
      type: 'info',
      message_fr: 'Aucun chantier enregistré. Ajoutez vos chantiers pour voir les KPIs.',
      message_pt: 'Nenhuma obra registada. Adicione as suas obras para ver os KPIs.',
    })
  }

  return alerts
}

// ════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════

function makeCard(
  key: string,
  labelFr: string,
  labelPt: string,
  value: number,
  formatted: string,
  unit?: string,
  status?: KPIStatus,
  trend?: number
): KPICard {
  return { key, label_fr: labelFr, label_pt: labelPt, value, formatted, unit, status, trend }
}

function statusFromValue(value: number, threshold: number): KPIStatus {
  if (value > threshold) return 'profit'
  if (value === threshold) return 'warning'
  return 'loss'
}

function formatMoney(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString('fr-FR')
}
