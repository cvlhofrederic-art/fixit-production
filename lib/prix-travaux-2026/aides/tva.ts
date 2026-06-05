// lib/prix-travaux-2026/aides/tva.ts

import type { TvaRate } from '../types'

export type TvaContext = {
  category: 'energy-renovation' | 'standard-renovation' | 'new-build'
  logementAge: number
}

/**
 * Détermine la TVA applicable selon les règles fiscales françaises 2026.
 * - 5.5% : rénovation énergétique (logement >2 ans, opération éligible)
 * - 10% : rénovation standard (logement >2 ans)
 * - 20% : neuf, ou rénov logement <2 ans
 *
 * Source: BOFIP-Impôts BOI-TVA-LIQ-30-20-90 (TVA réduite travaux immobiliers).
 */
export function getTvaApplicable(ctx: TvaContext): TvaRate {
  if (ctx.logementAge < 2) return 20
  if (ctx.category === 'energy-renovation') return 5.5
  if (ctx.category === 'standard-renovation') return 10
  return 20
}

/**
 * Calcule l'économie TVA en passant de 20% au taux réduit applicable.
 */
export function computeTvaEconomie(prixHT: number, tvaApplicable: TvaRate): number {
  if (tvaApplicable === 20) return 0
  const ttcStandard = prixHT * 1.20
  const ttcReduit = prixHT * (1 + tvaApplicable / 100)
  return Math.round(ttcStandard - ttcReduit)
}
