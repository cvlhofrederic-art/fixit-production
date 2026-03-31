// ── Tenders Scanner — Type definitions ──────────────────────────────────────

export interface Commune {
  name: string
  code_insee: string
  postal_codes: string[]
  department: string
  region: string
  population?: number
  website?: string
  website_status?: 'found' | 'not_found' | 'error'
  marches_page?: string
}

export interface Tender {
  id: string
  title: string
  city: string
  source: string
  source_id: string
  publication_date: string
  deadline: string
  description: string
  url: string
  estimated_budget?: number
  category: 'BTP'
  trade?: string
  trade_keywords?: string[]
  department: string
  region: string
  buyer?: string
  procedure_type?: string
  cpv_codes?: string[]
  lots?: string[]
  synced_at: string
}

export interface ScanResult {
  tenders: Tender[]
  meta: {
    department: string
    communes_scanned: number
    communes_with_site: number
    sources: Record<string, number>
    total_raw: number
    total_after_filter: number
    total_after_dedup: number
    duration_ms: number
    scanned_at: string
    errors: string[]
  }
}

export interface SearchParams {
  city?: string
  trade?: string
  keyword?: string
  max_days_old?: number
  min_budget?: number
  max_budget?: number
  limit?: number
  offset?: number
}

export interface ScoreResult {
  score: number
  label: 'high' | 'medium' | 'low'
  factors: {
    proximity: number
    recency: number
    budget: number
    trade_match: number
  }
}

export interface DepartmentConfig {
  code: string
  name: string
  region: string
  region_code: string
  neighboring_depts: string[]
}

export interface AlertRule {
  artisan_id: string
  trades: string[]
  cities: string[]
  min_budget?: number
  max_budget?: number
  notify_email?: boolean
  notify_push?: boolean
}
