// ── Tenders Scanner — Scoring ────────────────────────────────────────────────

import type { Tender, ScoreResult } from './types'
import { DEPARTMENTS, BTP_TRADES } from './config'

export interface ScoreParams {
  artisan_city?: string
  artisan_trades?: string[]
  artisan_dept?: string
}

/**
 * Extract department code from a city name or department string.
 * Falls back to checking DEPARTMENTS config.
 */
function getDeptForCity(city: string): string | null {
  // Attempt to find a matching department by checking if any configured
  // department's neighboring_depts or name matches. This is a simplified
  // lookup; in production, pair with a communes database.
  const normalized = city.toLowerCase().trim()
  for (const [code, config] of Object.entries(DEPARTMENTS)) {
    if (config.name.toLowerCase() === normalized) return code
  }
  return null
}

function isNeighboringDept(dept: string, otherDept: string): boolean {
  const config = DEPARTMENTS[dept]
  if (!config) return false
  return config.neighboring_depts.includes(otherDept)
}

/**
 * Proximity score (0-35).
 * Same city = 35, same department = 20, neighboring department = 10, else = 0.
 */
function scoreProximity(tender: Tender, params: ScoreParams): number {
  if (!params.artisan_city && !params.artisan_dept) return 0

  const tenderCity = tender.city.toLowerCase().trim()
  const artisanCity = (params.artisan_city || '').toLowerCase().trim()

  if (artisanCity && tenderCity === artisanCity) return 35

  const artisanDept = params.artisan_dept || getDeptForCity(params.artisan_city || '') || ''
  const tenderDept = tender.department

  if (artisanDept && tenderDept === artisanDept) return 20
  if (artisanDept && isNeighboringDept(artisanDept, tenderDept)) return 10

  return 0
}

/**
 * Recency score (0-25).
 * Based on days since publication.
 */
function scoreRecency(tender: Tender): number {
  if (!tender.publication_date) return 0

  const pubDate = new Date(tender.publication_date)
  const now = new Date()
  const diffMs = now.getTime() - pubDate.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays <= 0) return 25
  if (diffDays <= 3) return 20
  if (diffDays <= 7) return 15
  if (diffDays <= 14) return 10
  if (diffDays <= 30) return 5
  return 0
}

/**
 * Budget score (0-20).
 * Has budget estimate = 15, high budget (>50k) = +5.
 */
function scoreBudget(tender: Tender): number {
  if (tender.estimated_budget == null || tender.estimated_budget <= 0) return 0

  let score = 15
  if (tender.estimated_budget > 50_000) score += 5
  return score
}

/**
 * Trade match score (0-20).
 * Exact trade match = 20, related trade (keyword overlap) = 10, no match = 0.
 */
function scoreTradeMatch(tender: Tender, params: ScoreParams): number {
  if (!params.artisan_trades || params.artisan_trades.length === 0) return 0

  const artisanTradeIds = new Set(params.artisan_trades.map((t) => t.toLowerCase().trim()))

  // Exact trade match
  if (tender.trade && artisanTradeIds.has(tender.trade.toLowerCase().trim())) {
    return 20
  }

  // Check if any artisan trade's keywords appear in the tender's keywords or description
  const tenderKeywords = new Set(
    (tender.trade_keywords || []).map((k) => k.toLowerCase())
  )
  const tenderText = `${tender.title} ${tender.description}`.toLowerCase()

  for (const artisanTradeId of artisanTradeIds) {
    const tradeDef = BTP_TRADES.find(
      (t) => t.id === artisanTradeId || t.label.toLowerCase() === artisanTradeId
    )
    if (!tradeDef) continue

    // Check keyword intersection
    for (const keyword of tradeDef.keywords) {
      if (tenderKeywords.has(keyword) || tenderText.includes(keyword)) {
        return 10
      }
    }
  }

  return 0
}

/**
 * Score a tender for relevance to an artisan.
 *
 * Components (0-100 total):
 *  - proximity  (0-35): geographic match
 *  - recency    (0-25): how recent the publication is
 *  - budget     (0-20): budget availability and size
 *  - trade_match(0-20): trade/keyword relevance
 */
export function scoreTender(tender: Tender, params: ScoreParams): ScoreResult {
  const proximity = scoreProximity(tender, params)
  const recency = scoreRecency(tender)
  const budget = scoreBudget(tender)
  const trade_match = scoreTradeMatch(tender, params)

  const score = proximity + recency + budget + trade_match

  let label: ScoreResult['label']
  if (score >= 70) label = 'high'
  else if (score >= 40) label = 'medium'
  else label = 'low'

  return {
    score,
    label,
    factors: { proximity, recency, budget, trade_match },
  }
}
