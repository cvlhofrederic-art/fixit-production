// ── Tenders Scanner — Deduplication ─────────────────────────────────────────

import type { Tender } from './types'

/**
 * Strip accents, lowercase, remove non-alphanumeric chars, collapse whitespace.
 */
export function normalizeForDedup(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Jaccard similarity on word sets. Returns 0-1.
 */
function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(a.split(' ').filter(Boolean))
  const setB = new Set(b.split(' ').filter(Boolean))

  if (setA.size === 0 && setB.size === 0) return 1

  let intersection = 0
  for (const word of setA) {
    if (setB.has(word)) intersection++
  }

  const union = setA.size + setB.size - intersection
  return union === 0 ? 0 : intersection / union
}

/**
 * Extract YYYY-MM-DD from an ISO date string for day-level comparison.
 */
function sameDay(a: string, b: string): boolean {
  if (!a || !b) return false
  return a.slice(0, 10) === b.slice(0, 10)
}

/**
 * Compute a "richness" score to pick the best duplicate.
 * Higher = more data available.
 */
function richness(t: Tender): number {
  let score = 0
  score += (t.description || '').length
  if (t.estimated_budget != null && t.estimated_budget > 0) score += 500
  if (t.url) score += 200
  if (t.buyer) score += 100
  if (t.cpv_codes && t.cpv_codes.length > 0) score += 100
  if (t.lots && t.lots.length > 0) score += 100
  if (t.procedure_type) score += 50
  if (t.trade) score += 50
  if (t.trade_keywords && t.trade_keywords.length > 0) score += 50
  return score
}

const SIMILARITY_THRESHOLD = 0.85

/**
 * Remove duplicate tenders across all sources.
 *
 * Two tenders are considered duplicates when:
 *  - Their normalized titles have >85% Jaccard similarity
 *  - Same city (normalized)
 *  - Same deadline day (if both have one)
 *
 * When a duplicate is found, the tender with more data (longer description,
 * has budget, has URL) is kept.
 */
export function deduplicateTenders(tenders: Tender[]): Tender[] {
  if (tenders.length <= 1) return tenders

  // Pre-compute normalized values for each tender
  const entries = tenders.map((t) => ({
    tender: t,
    normTitle: normalizeForDedup(t.title),
    normCity: normalizeForDedup(t.city),
    score: richness(t),
  }))

  const kept: typeof entries = []

  for (const entry of entries) {
    let isDuplicate = false

    for (let i = 0; i < kept.length; i++) {
      const existing = kept[i]

      // Cities must match
      if (entry.normCity !== existing.normCity) continue

      // Deadlines must match (same day) if both are present
      if (entry.tender.deadline && existing.tender.deadline) {
        if (!sameDay(entry.tender.deadline, existing.tender.deadline)) continue
      }

      // Title similarity check
      const similarity = jaccardSimilarity(entry.normTitle, existing.normTitle)
      if (similarity >= SIMILARITY_THRESHOLD) {
        // Replace if the new entry has richer data
        if (entry.score > existing.score) {
          kept[i] = entry
        }
        isDuplicate = true
        break
      }
    }

    if (!isDuplicate) {
      kept.push(entry)
    }
  }

  return kept.map((e) => e.tender)
}
