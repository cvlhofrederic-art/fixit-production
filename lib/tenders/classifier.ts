// ── Tenders Scanner — BTP Classifier ────────────────────────────────────────

import type { Tender } from './types'
import {
  BTP_TRADES,
  ALL_BTP_KEYWORDS,
  BTP_INDICATOR_KEYWORDS,
  EXCLUDE_KEYWORDS,
  BTP_CPV_PREFIXES,
} from './config'

/**
 * Lowercase and strip diacritics for accent-insensitive matching.
 */
function normalize(str: string): string {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/**
 * Returns true if title+description text matches BTP keywords
 * and does not match exclusion keywords.
 */
export function isBTP(title: string, description?: string): boolean {
  const text = normalize(`${title} ${description ?? ''}`)

  const excluded = EXCLUDE_KEYWORDS.some(kw => text.includes(normalize(kw)))
  if (excluded) return false

  const hasTradeKeyword = ALL_BTP_KEYWORDS.some(kw => text.includes(normalize(kw)))
  if (hasTradeKeyword) return true

  const hasIndicator = BTP_INDICATOR_KEYWORDS.some(kw => text.includes(normalize(kw)))
  return hasIndicator
}

/**
 * Identifies the best-matching BTP trade from the text.
 * Returns the trade with the most keyword hits, or null if none match.
 */
export function classifyTrade(
  title: string,
  description?: string
): { trade: string; trade_id: string; keywords: string[] } | null {
  const text = normalize(`${title} ${description ?? ''}`)

  let bestMatch: { trade: string; trade_id: string; keywords: string[] } | null = null
  let bestCount = 0

  for (const trade of BTP_TRADES) {
    const matched: string[] = []
    for (const kw of trade.keywords) {
      if (text.includes(normalize(kw))) {
        matched.push(kw)
      }
    }
    if (matched.length > bestCount) {
      bestCount = matched.length
      bestMatch = {
        trade: trade.label,
        trade_id: trade.id,
        keywords: matched,
      }
    }
  }

  return bestMatch
}

/**
 * Classify by CPV code prefix matching against known BTP prefixes.
 * Returns the first matching trade based on the CPV "45" construction prefix,
 * or falls back to a generic BTP classification.
 */
export function classifyByCPV(
  cpvCodes: string[]
): { trade: string; trade_id: string } | null {
  if (!cpvCodes.length) return null

  const hasBTP = cpvCodes.some(code =>
    BTP_CPV_PREFIXES.some(prefix => code.startsWith(prefix))
  )

  if (!hasBTP) return null

  // CPV 45 = construction works, try to narrow by sub-code
  const cpvTradeMap: Record<string, { trade: string; trade_id: string }> = {
    '4521': { trade: 'Gros œuvre', trade_id: 'gros_oeuvre' },
    '4522': { trade: 'Toiture / Couverture', trade_id: 'toiture' },
    '4523': { trade: 'VRD / Voirie', trade_id: 'vrd' },
    '4524': { trade: 'Plomberie', trade_id: 'plomberie' },
    '4525': { trade: 'Rénovation / Réhabilitation', trade_id: 'renovation' },
    '4531': { trade: 'Électricité', trade_id: 'electricite' },
    '4532': { trade: 'Isolation', trade_id: 'isolation' },
    '4533': { trade: 'Plomberie', trade_id: 'plomberie' },
    '4534': { trade: 'Serrurerie / Métallerie', trade_id: 'serrurerie' },
    '4542': { trade: 'Menuiserie', trade_id: 'menuiserie' },
    '4543': { trade: 'Carrelage', trade_id: 'carrelage' },
    '4544': { trade: 'Peinture', trade_id: 'peinture' },
    '4545': { trade: 'Maintenance bâtiment', trade_id: 'maintenance' },
    '4511': { trade: 'Démolition', trade_id: 'demolition' },
    '7711': { trade: 'Espaces verts', trade_id: 'espaces_verts' },
  }

  for (const code of cpvCodes) {
    const prefix4 = code.substring(0, 4)
    if (cpvTradeMap[prefix4]) {
      return cpvTradeMap[prefix4]
    }
  }

  // Has a BTP CPV prefix but no specific sub-code mapping
  return { trade: 'BTP (générique)', trade_id: 'btp_generic' }
}

/**
 * Filters an array of tenders, keeping only BTP-relevant ones.
 * Enriches kept tenders with trade and trade_keywords fields.
 */
export function filterBTP(tenders: Tender[]): Tender[] {
  const results: Tender[] = []

  for (const tender of tenders) {
    if (!isBTP(tender.title, tender.description)) continue

    // Try CPV classification first, then keyword-based
    const cpvMatch = tender.cpv_codes?.length
      ? classifyByCPV(tender.cpv_codes)
      : null

    const tradeMatch = classifyTrade(tender.title, tender.description)

    const enriched: Tender = { ...tender }

    if (tradeMatch) {
      enriched.trade = tradeMatch.trade
      enriched.trade_keywords = tradeMatch.keywords
    } else if (cpvMatch) {
      enriched.trade = cpvMatch.trade
      enriched.trade_keywords = []
    }

    results.push(enriched)
  }

  return results
}
