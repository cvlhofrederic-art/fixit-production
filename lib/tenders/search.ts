// ── Tenders Search Engine ────────────────────────────────────────────────────

import type { SearchParams, Tender } from './types'
import { BTP_TRADES } from './config'
import { createClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Search tenders in the `marches` table with filters.
 * Scoped to Bouches-du-Rhône (dept 13), France, open tenders only.
 */
export async function searchTenders(
  params: SearchParams
): Promise<{ tenders: Tender[]; total: number }> {
  const {
    city,
    trade,
    keyword,
    max_days_old,
    min_budget,
    max_budget,
    limit = 50,
    offset = 0,
  } = params

  try {
    let query = supabase
      .from('marches')
      .select('*', { count: 'exact' })
      .eq('pays', 'FR')
      .eq('departement', '13')
      .eq('status', 'open')

    // City filter — case-insensitive partial match
    if (city) {
      query = query.ilike('location_city', `%${city}%`)
    }

    // Trade filter — match trade keywords against title + description
    if (trade) {
      const tradeDef = BTP_TRADES.find(
        (t) => t.id === trade || t.label.toLowerCase() === trade.toLowerCase()
      )
      if (tradeDef) {
        const orConditions = tradeDef.keywords
          .map((kw) => `title.ilike.%${kw}%,description.ilike.%${kw}%`)
          .join(',')
        query = query.or(orConditions)
      } else {
        // Fallback: treat trade param as a raw keyword search
        query = query.or(
          `title.ilike.%${trade}%,description.ilike.%${trade}%`
        )
      }
    }

    // Keyword filter — partial match on title or description
    if (keyword) {
      query = query.or(
        `title.ilike.%${keyword}%,description.ilike.%${keyword}%`
      )
    }

    // Recency filter
    if (max_days_old) {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - max_days_old)
      query = query.gte('date_publication', cutoff.toISOString())
    }

    // Budget filters
    if (min_budget !== undefined) {
      query = query.gte('budget_min', min_budget)
    }
    if (max_budget !== undefined) {
      query = query.lte('montant_estime', max_budget)
    }

    // Pagination and ordering
    query = query
      .order('date_publication', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      logger.error('Tenders search query failed', { error: error.message, params })
      return { tenders: [], total: 0 }
    }

    const tenders: Tender[] = (data ?? []).map(mapRowToTender)

    return { tenders, total: count ?? tenders.length }
  } catch (err) {
    logger.error('Tenders search unexpected error', {
      error: err instanceof Error ? err.message : String(err),
      params,
    })
    return { tenders: [], total: 0 }
  }
}

// ── Row mapper ──────────────────────────────────────────────────────────────

function mapRowToTender(row: Record<string, unknown>): Tender {
  return {
    id: String(row.id ?? ''),
    title: String(row.title ?? row.titre ?? ''),
    city: String(row.location_city ?? row.ville ?? ''),
    source: String(row.source ?? ''),
    source_id: String(row.source_id ?? ''),
    publication_date: String(row.date_publication ?? ''),
    deadline: String(row.date_limite ?? row.deadline ?? ''),
    description: String(row.description ?? ''),
    url: String(row.url ?? ''),
    estimated_budget: row.montant_estime != null ? Number(row.montant_estime) : undefined,
    category: 'BTP',
    trade: row.trade != null ? String(row.trade) : undefined,
    trade_keywords: Array.isArray(row.trade_keywords) ? row.trade_keywords as string[] : undefined,
    department: String(row.departement ?? '13'),
    region: String(row.region ?? 'PACA'),
    buyer: row.acheteur != null ? String(row.acheteur) : undefined,
    procedure_type: row.procedure_type != null ? String(row.procedure_type) : undefined,
    cpv_codes: Array.isArray(row.cpv_codes) ? row.cpv_codes as string[] : undefined,
    lots: Array.isArray(row.lots) ? row.lots as string[] : undefined,
    synced_at: String(row.synced_at ?? row.created_at ?? new Date().toISOString()),
  }
}
