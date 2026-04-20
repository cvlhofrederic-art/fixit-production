import type { ContexteRepartition } from './types'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function calculeQuotePartFixes(ctx: ContexteRepartition): number {
  const { mode, charges_fixes_mensuelles, duree_mois } = ctx
  const totalCharges = charges_fixes_mensuelles * duree_mois
  if (mode === 'prorata_ca') {
    if (ctx.ca_total_periode <= 0) return 0
    return round2((ctx.ca_chantier / ctx.ca_total_periode) * totalCharges)
  }
  if (ctx.jours_total_periode <= 0) return 0
  return round2((ctx.jours_chantier / ctx.jours_total_periode) * totalCharges)
}
