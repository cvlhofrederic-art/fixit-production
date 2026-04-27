// lib/prix-travaux-2026/validate.ts

import { PRIX_2026 } from '@/lib/prix-travaux-2026'
import type { ComputeQuoteResult } from './compute'

const ALLOWED_GAMME_COEFS = [0.90, 1.00, 1.15]
const ALLOWED_ETAT_COEFS = [1.00, 1.10, 1.25]

export type ValidateQuoteResult = {
  ok: boolean
  reasons?: string[]
}

export function validateQuote(r: ComputeQuoteResult): ValidateQuoteResult {
  const reasons: string[] = []

  if (r.totalMin > r.totalMax) reasons.push('totalMin > totalMax')
  if (r.spreadPercent > 0.22) reasons.push(`spread ${(r.spreadPercent * 100).toFixed(1)}% > 22%`)

  if (r.zoneCoef < 0.90 || r.zoneCoef > 1.40) reasons.push(`zoneCoef ${r.zoneCoef} hors [0.90, 1.40]`)
  if (!ALLOWED_GAMME_COEFS.includes(r.gammeCoef)) reasons.push(`gammeCoef ${r.gammeCoef} non autorisé`)
  if (!ALLOWED_ETAT_COEFS.includes(r.etatCoef)) reasons.push(`etatCoef ${r.etatCoef} non autorisé`)

  const knownTaskIds = new Set(PRIX_2026.map(l => l.taskId))
  for (const b of r.breakdown) {
    if (!knownTaskIds.has(b.taskId)) reasons.push(`unknown taskId: ${b.taskId}`)
  }

  if (r.mode === 'normal') {
    if (r.sources.length === 0) reasons.push('mode normal sans sources')
    if (r.breakdown.length === 0) reasons.push('mode normal sans breakdown')
  } else if (r.mode === 'out-of-catalog') {
    if (!r.artisanRate) reasons.push('mode out-of-catalog sans artisanRate')
    if (r.breakdown.length > 0) reasons.push('mode out-of-catalog avec breakdown non vide')
  } else {
    reasons.push(`mode inconnu: ${r.mode}`)
  }

  return reasons.length === 0 ? { ok: true } : { ok: false, reasons }
}
