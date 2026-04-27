// lib/prix-travaux-2026/aides/maprimerenov.ts

import type { MprBareme } from '../types'

/**
 * Plafonds de revenus 2026 MaPrimeRénov (RFR — Revenu Fiscal de Référence).
 * Source: France Rénov' / JORF — barèmes 2026
 * https://france-renov.gouv.fr/aides/maprimerenov
 */
export const MPR_PLAFONDS_REVENUS_2026 = {
  bleu: {
    foyer1: { idf: 23_768, province: 17_173 },
    foyer2: { idf: 34_884, province: 25_115 },
    foyer3: { idf: 41_893, province: 30_206 },
    foyer4: { idf: 48_914, province: 35_285 },
    foyer5plus: { idf: 55_961, province: 40_388 },
    perPersonneSup: { idf: 7_038, province: 5_094 },
  },
  jaune: {
    foyer1: { idf: 28_933, province: 22_015 },
    foyer2: { idf: 42_463, province: 32_197 },
    foyer3: { idf: 51_000, province: 38_719 },
    foyer4: { idf: 59_549, province: 45_234 },
    foyer5plus: { idf: 68_123, province: 51_775 },
    perPersonneSup: { idf: 8_568, province: 6_525 },
  },
  violet: {
    foyer1: { idf: 40_404, province: 30_844 },
    foyer2: { idf: 59_394, province: 45_340 },
    foyer3: { idf: 71_060, province: 54_592 },
    foyer4: { idf: 83_637, province: 64_449 },
    foyer5plus: { idf: 95_758, province: 73_692 },
    perPersonneSup: { idf: 12_124, province: 9_252 },
  },
  rose: {
    /* Au-dessus du plafond violet — forfaits réduits ou nuls selon opération */
  },
} as const

export type DetectionContext = {
  foyerTaille: number
  revenusFiscaux: number
  region: 'idf' | 'province'
}

function getPlafondForFoyer(
  bareme: 'bleu' | 'jaune' | 'violet',
  ctx: DetectionContext
): number {
  const t = ctx.foyerTaille
  const region = ctx.region
  const plafonds = MPR_PLAFONDS_REVENUS_2026[bareme]
  if (t <= 1) return plafonds.foyer1[region]
  if (t === 2) return plafonds.foyer2[region]
  if (t === 3) return plafonds.foyer3[region]
  if (t === 4) return plafonds.foyer4[region]
  // 5 personnes ou plus : foyer5plus + perPersonneSup × (t - 5)
  const base = plafonds.foyer5plus[region]
  const sup = plafonds.perPersonneSup[region] * Math.max(0, t - 5)
  return base + sup
}

export function detectMprBareme(ctx: DetectionContext): MprBareme {
  const r = ctx.revenusFiscaux
  if (r <= getPlafondForFoyer('bleu', ctx)) return 'bleu'
  if (r <= getPlafondForFoyer('jaune', ctx)) return 'jaune'
  if (r <= getPlafondForFoyer('violet', ctx)) return 'violet'
  return 'rose'
}

export function getMprForfait(
  forfaits: { bleu: number; jaune: number; violet: number; rose: number },
  bareme: MprBareme
): number {
  return forfaits[bareme]
}
