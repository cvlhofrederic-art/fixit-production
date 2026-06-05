import type { Immeuble } from '@/components/syndic-dashboard/types'

/**
 * Score de saúde 0-100 d'un édifice — heurística transparente, partagée par
 * ModBenchmarking (ranking) et ModPontuacao (notation). Dérivée de données réelles :
 * `100 − pressão orçamental (despesas/orçamento au-delà de 80%) − intervenções`.
 */
export function healthScore(i: Immeuble): number {
  const pct = i.budgetAnnuel > 0 ? (i.depensesAnnee / i.budgetAnnuel) * 100 : 60
  let s = 100
  if (pct > 80) s -= Math.min(45, (pct - 80) * 1.8)
  s -= Math.min(30, (i.nbInterventions || 0) * 2.5)
  return Math.max(10, Math.min(100, Math.round(s)))
}

/** Lettre A→F à partir du score (A ≥ 90 … F < 50). */
export function scoreGrade(score: number): string {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  if (score >= 50) return 'E'
  return 'F'
}

/** Couleur (token v54) associée au score. */
export const gradeColor = (score: number): 'sage' | 'gold' | 'amber' | 'rust' =>
  score >= 80 ? 'sage' : score >= 60 ? 'gold' : score >= 50 ? 'amber' : 'rust'

/** Variante typée pour `<Progress kind>` (qui n'accepte pas 'gold' → undefined). */
export const scoreProgressKind = (score: number): 'sage' | 'amber' | 'rust' | undefined =>
  score >= 85 ? 'sage' : score >= 65 ? undefined : score >= 50 ? 'amber' : 'rust'
