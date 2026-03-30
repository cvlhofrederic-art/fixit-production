/**
 * Profitability Service — BTP Pro Analytics
 *
 * Calculates per-chantier and global profitability.
 * Pure functions, no React.
 */

import type {
  ChantierContext,
  ChantierCosts,
  ChantierProfitability,
  GlobalProfitability,
} from './pipeline-types'

// ════════════════════════════════════════════
//  PER-CHANTIER PROFITABILITY
// ════════════════════════════════════════════

export function calculateChantierProfitability(
  ctx: ChantierContext,
  costs: ChantierCosts
): ChantierProfitability {
  const ca = costs.ca_reel || ctx.montant_facture || ctx.budget
  const coutTotal = costs.cout_total
  const beneficeBrut = ca - coutTotal
  const margePct = ca > 0 ? (beneficeBrut / ca) * 100 : 0

  // Jours prévus vs pointés
  const d0 = new Date(ctx.date_debut)
  const d1 = new Date(ctx.date_fin)
  const diffMs = d1.getTime() - d0.getTime()
  const joursPrevu = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
  const joursPointes = costs.nb_jours_pointes || 1
  const retardJours = Math.max(0, joursPointes - joursPrevu)

  // Bénéfice par homme-jour
  const totalHommeJours = costs.nb_ouvriers * joursPointes
  const beneficeParHommeJour = totalHommeJours > 0 ? beneficeBrut / totalHommeJours : 0

  // Perte par jour de retard (pénalité contractuelle + coût main d'oeuvre/jour)
  const coutMOJour = joursPointes > 0 ? costs.cout_main_oeuvre_total / joursPointes : 0
  const perteParJourRetard = ctx.penalite_retard_jour + coutMOJour

  // Score 0-10
  const score = calculateScore(margePct, retardJours, joursPrevu)

  // Status
  const status: ChantierProfitability['status'] =
    margePct >= 10 ? 'profit' : margePct >= 0 ? 'warning' : 'loss'

  return {
    chantier_id: ctx.id,
    titre: ctx.titre,
    ca,
    cout_total: coutTotal,
    benefice_brut: Math.round(beneficeBrut),
    marge_pct: Math.round(margePct * 10) / 10,
    benefice_par_homme_jour: Math.round(beneficeParHommeJour),
    perte_par_jour_retard: Math.round(perteParJourRetard),
    score: Math.round(score * 10) / 10,
    status,
    jours_prevu: joursPrevu,
    jours_pointes: joursPointes,
    retard_jours: retardJours,
  }
}

/**
 * Score 0-10 based on margin + schedule adherence
 * Margin weight: 60%, Schedule weight: 40%
 */
function calculateScore(margePct: number, retardJours: number, joursPrevu: number): number {
  // Margin score: 0-10 mapped from -20% to +30%
  const marginScore = Math.min(10, Math.max(0, ((margePct + 20) / 50) * 10))

  // Schedule score: 10 for on time, -2 per day of delay (relative to planned)
  const retardRatio = joursPrevu > 0 ? retardJours / joursPrevu : 0
  const scheduleScore = Math.max(0, 10 - retardRatio * 20)

  return marginScore * 0.6 + scheduleScore * 0.4
}

// ════════════════════════════════════════════
//  GLOBAL PROFITABILITY
// ════════════════════════════════════════════

export interface GlobalProfitabilityInput {
  chantiers: ChantierProfitability[]
  frais_fixes_mensuel: number
  salaire_patron_charge: number
  amortissements: number
  taux_is: number
  nb_mois: number // période analysée
}

export function calculateGlobalProfitability(input: GlobalProfitabilityInput): GlobalProfitability {
  const {
    chantiers,
    frais_fixes_mensuel,
    salaire_patron_charge,
    amortissements,
    taux_is,
    nb_mois,
  } = input

  const totalCA = chantiers.reduce((s, c) => s + c.ca, 0)
  const totalCoutChantiers = chantiers.reduce((s, c) => s + c.cout_total, 0)
  const fraisFixesPeriode = frais_fixes_mensuel * nb_mois
  const salairePatronPeriode = salaire_patron_charge * nb_mois
  const amortPeriode = amortissements * nb_mois

  const beneficeBrut =
    totalCA - totalCoutChantiers - fraisFixesPeriode - salairePatronPeriode - amortPeriode

  const impots = beneficeBrut > 0 ? calculateIS(beneficeBrut, taux_is) : 0
  const beneficeNet = beneficeBrut - impots
  const margeGlobale = totalCA > 0 ? (beneficeNet / totalCA) * 100 : 0

  return {
    total_ca: Math.round(totalCA),
    total_cout_chantiers: Math.round(totalCoutChantiers),
    frais_fixes_mensuel: Math.round(fraisFixesPeriode),
    salaire_patron_charge: Math.round(salairePatronPeriode),
    amortissements: Math.round(amortPeriode),
    benefice_brut: Math.round(beneficeBrut),
    impots: Math.round(impots),
    benefice_net: Math.round(beneficeNet),
    marge_globale_pct: Math.round(margeGlobale * 10) / 10,
    nb_chantiers: chantiers.length,
    nb_mois,
  }
}

/**
 * FR IS brackets: 15% up to 42,500€, 25% above (for eligible companies)
 * Simplified: uses flat rate if taux_is != 0.25
 */
function calculateIS(benefice: number, tauxIS: number): number {
  if (benefice <= 0) return 0

  // FR standard brackets (only applies for tauxIS = 0.25)
  if (tauxIS === 0.25) {
    const trancheReduite = Math.min(benefice, 42500) * 0.15
    const trancheNormale = Math.max(0, benefice - 42500) * 0.25
    return Math.round(trancheReduite + trancheNormale)
  }

  // PT IRC or flat rate
  return Math.round(benefice * tauxIS)
}
