// lib/prix-travaux-2026/aides/cee.ts

/**
 * Forfaits CEE 2026 — Certificats d'Économie d'Énergie.
 * Source: Ministère de la Transition Écologique — fiches d'opérations standardisées
 * https://www.ecologie.gouv.fr/operations-standardisees-deconomies-denergie
 */
export type CeeContext = {
  forfaitParUnite: number
  operationStandard: string
  qty?: number
}

export function computeCee(ctx: CeeContext): number {
  const qty = ctx.qty ?? 1
  return ctx.forfaitParUnite * qty
}
