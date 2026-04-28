// app/api/simulateur-travaux/token-substitution.ts
//
// Anti-hallucination cryptographique : le LLM utilise des placeholders typés
// dans son stream, ce module les substitue par les vraies valeurs venant du
// computeQuote. Tout chiffre brut suivi de € détecté = chunk skipped + log.

import type { ComputeQuoteResult } from '@/lib/prix-travaux-2026/compute'

// Capture toute séquence numérique (avec séparateurs espace, insécable, point,
// virgule) suivie du symbole €. Couvre "1500 €", "1 500 €", "1.500,50 €",
// "1500€", "12 €". Ne matche pas "2026", "30 m²", "8 kW".
export const RAW_PRICE_PATTERN = /\d+(?:[\s .,]\d+)*\s*€/g
export const PLACEHOLDER_PATTERN = /\{([A-Z_][A-Za-z0-9_-]*)\}/g

export function hasRawPrice(s: string): boolean {
  RAW_PRICE_PATTERN.lastIndex = 0
  return RAW_PRICE_PATTERN.test(s)
}

export function formatEUR(value: number): string {
  // Espace insécable (U+00A0) comme séparateur milliers + avant €
  const rounded = Math.round(value)
  const withSep = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return `${withSep} €`
}

function resolvePlaceholder(key: string, ctx: ComputeQuoteResult): string | null {
  switch (key) {
    case 'TOTAL_MIN': return formatEUR(ctx.totalMin)
    case 'TOTAL_MAX': return formatEUR(ctx.totalMax)
    case 'TOTAL_NET_MIN': return ctx.totalNetMin != null ? formatEUR(ctx.totalNetMin) : null
    case 'TOTAL_NET_MAX': return ctx.totalNetMax != null ? formatEUR(ctx.totalNetMax) : null
    case 'AIDES_TOTAL': return ctx.aidesDeduites ? formatEUR(ctx.aidesDeduites.total) : null
    case 'ARTISAN_RATE_MIN': return ctx.artisanRate ? formatEUR(ctx.artisanRate.min) : null
    case 'ARTISAN_RATE_MAX': return ctx.artisanRate ? formatEUR(ctx.artisanRate.max) : null
    case 'ZONE_NAME': return ctx.zoneDetected
  }

  // LINE_<taskId>_MIN / LINE_<taskId>_MAX
  const lineMatch = /^LINE_(.+)_(MIN|MAX)$/.exec(key)
  if (lineMatch) {
    const taskId = lineMatch[1]
    const bound = lineMatch[2]
    const line = ctx.breakdown.find(b => b.taskId === taskId)
    if (!line) return null
    return formatEUR(bound === 'MIN' ? line.lineMin : line.lineMax)
  }

  // UNIT_<taskId>_MIN / UNIT_<taskId>_MAX
  const unitMatch = /^UNIT_(.+)_(MIN|MAX)$/.exec(key)
  if (unitMatch) {
    const taskId = unitMatch[1]
    const bound = unitMatch[2]
    const line = ctx.breakdown.find(b => b.taskId === taskId)
    if (!line) return null
    return formatEUR(bound === 'MIN' ? line.unitPriceMin : line.unitPriceMax)
  }

  return null
}

export type SubstitutionStats = {
  hallucinationsBlocked: number
  unknownPlaceholders: number
}

export function validateAndSubstitute(
  chunk: string,
  ctx: ComputeQuoteResult,
  stats?: SubstitutionStats
): string {
  if (hasRawPrice(chunk)) {
    if (stats) stats.hallucinationsBlocked++
    return ''
  }
  return chunk.replace(PLACEHOLDER_PATTERN, (match, key: string) => {
    const value = resolvePlaceholder(key, ctx)
    if (value === null) {
      if (stats) stats.unknownPlaceholders++
      return match
    }
    return value
  })
}
