// ── Marches Sync Engine — shared utilities for all sync sources ─────────────
// Used by app/api/sync/* routes. Each route = one source, all use this lib.

import { logger } from './logger'

export interface SyncedMarche {
  // Identity
  source: string        // 'decp' | 'sitadel' | 'mairie-13' | 'base-gov-pt' | 'ted-eu' | 'cm-porto'
  source_id: string     // Unique ID within that source
  url_source: string    // Link to original announcement

  // Content
  title: string
  description: string
  category: string      // BTP category
  cpv_codes?: string[]

  // Geography
  pays: 'FR' | 'PT'
  zone_test: '13-paca' | 'porto-pt'
  location_city: string
  location_postal?: string
  departement?: string  // FR only (e.g. '13')
  district?: string     // PT only (e.g. 'Porto')
  concelho?: string     // PT only (e.g. 'Vila Nova de Gaia')

  // Financial
  budget_min?: number
  budget_max?: number
  montant_estime?: number

  // Dates
  deadline?: string
  date_publication?: string

  // Meta
  acheteur?: string
  procedure_type?: string  // 'MAPA', 'appel_offres', 'ajuste_direto', 'permis_construire', etc.
  langue: 'fr' | 'pt'
  titre_traduit?: string
  status?: string
  urgency?: string
}

export interface SyncResult {
  source: string
  zone: string
  inserts: number
  updates: number
  errors: number
  skipped: number
  details?: string
}

/**
 * Maps a SyncedMarche to a DB-ready row for upsert into the marches table.
 * Merges new sync fields with required existing schema fields.
 */
export function toMarcheRow(m: SyncedMarche) {
  return {
    // Required existing fields
    title: m.title.slice(0, 500),
    description: (m.description || m.title).slice(0, 5000),
    category: m.category || 'travaux',
    location_city: m.location_city || 'Non précisé',
    location_postal: m.location_postal || '',
    status: m.status || 'open',
    urgency: m.urgency || 'normal',
    deadline: m.deadline || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    budget_min: m.budget_min || m.montant_estime || null,
    budget_max: m.budget_max || null,

    // Publisher fields (auto-filled for synced marchés)
    publisher_name: m.acheteur || 'Source publique',
    publisher_email: `sync@vitfix.io`,
    publisher_type: 'entreprise',
    access_token: crypto.randomUUID(),

    // New sync fields
    source: m.source,
    source_id: m.source_id,
    url_source: m.url_source,
    pays: m.pays,
    zone_test: m.zone_test,
    departement: m.departement,
    district: m.district,
    concelho: m.concelho,
    langue: m.langue,
    titre_traduit: m.titre_traduit,
    cpv_codes: m.cpv_codes || [],
    montant_estime: m.montant_estime,
    acheteur: m.acheteur,
    date_publication: m.date_publication,
    procedure_type: m.procedure_type,
    synced_at: new Date().toISOString(),
  }
}

/**
 * Batch upsert marchés into Supabase with dedup on (source, source_id).
 * Returns insert/update/error counts.
 */
export async function upsertMarches(
  supabase: any,
  marches: SyncedMarche[],
  source: string,
): Promise<{ inserts: number; updates: number; errors: number; skipped: number }> {
  if (marches.length === 0) return { inserts: 0, updates: 0, errors: 0, skipped: 0 }

  const rows = marches.map(toMarcheRow)
  let inserts = 0, updates = 0, errors = 0, skipped = 0

  // Find existing records by source_id to avoid duplicates
  const sourceIds = rows.map(r => r.source_id).filter(Boolean)
  let existingSet = new Set<string>()

  // Query existing in chunks of 100 (PostgREST .in() limit)
  for (let i = 0; i < sourceIds.length; i += 100) {
    const chunk = sourceIds.slice(i, i + 100)
    const { data: existing } = await supabase
      .from('marches')
      .select('source_id')
      .in('source_id', chunk)

    if (existing) {
      for (const e of existing) existingSet.add(e.source_id)
    }
  }

  // Separate new vs existing
  const newRows = rows.filter(r => !existingSet.has(r.source_id))
  const updateRows = rows.filter(r => existingSet.has(r.source_id))

  // INSERT new rows in batches of 50
  for (let i = 0; i < newRows.length; i += 50) {
    const batch = newRows.slice(i, i + 50)
    const { error } = await supabase
      .from('marches')
      .insert(batch)

    if (error) {
      logger.error(`[sync:${source}] Insert batch error:`, error)
      errors += batch.length
    } else {
      inserts += batch.length
    }
  }

  // UPDATE existing rows one by one (source_id match)
  for (const row of updateRows) {
    const { error } = await supabase
      .from('marches')
      .update({
        title: row.title,
        description: row.description,
        status: row.status,
        deadline: row.deadline,
        budget_min: row.budget_min,
        budget_max: row.budget_max,
        montant_estime: row.montant_estime,
        synced_at: row.synced_at,
      })
      .eq('source_id', row.source_id)

    if (error) {
      logger.error(`[sync:${source}] Update error for ${row.source_id}:`, error)
      errors++
    } else {
      updates++
    }
  }

  logger.info(`[sync:${source}] Done: ${inserts} inserts, ${updates} updates, ${errors} errors, ${skipped} skipped`)
  return { inserts, updates, errors, skipped }
}

/**
 * Create a sync_job entry and return its ID. Call finishSyncJob when done.
 */
export async function startSyncJob(supabase: any, source: string, zone: string) {
  const { data } = await supabase
    .from('sync_jobs')
    .insert({ source, zone_test: zone, statut: 'running' })
    .select('id')
    .single()
  return data?.id as string | null
}

export async function finishSyncJob(
  supabase: any,
  jobId: string | null,
  result: SyncResult,
) {
  if (!jobId) return
  await supabase.from('sync_jobs').update({
    statut: result.errors > 0 ? 'partial' : 'success',
    nb_inserts: result.inserts,
    nb_updates: result.updates,
    nb_errors: result.errors,
    nb_skipped: result.skipped,
    error_detail: result.details || null,
    completed_at: new Date().toISOString(),
  }).eq('id', jobId)
}

export async function failSyncJob(supabase: any, jobId: string | null, error: string) {
  if (!jobId) return
  await supabase.from('sync_jobs').update({
    statut: 'failed',
    error_detail: error.slice(0, 2000),
    completed_at: new Date().toISOString(),
  }).eq('id', jobId)
}

/**
 * Respectful fetch with retry + delay for external APIs.
 * User-Agent identifies the bot, respects rate limits.
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  { retries = 2, delayMs = 1000 } = {},
): Promise<Response> {
  const headers = {
    'User-Agent': 'VitfixBot/1.0 (+https://vitfix.io/bot)',
    'Accept': 'application/json',
    ...options.headers,
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { ...options, headers })
      if (res.ok) return res
      if (res.status >= 500 && attempt < retries) {
        await new Promise(r => setTimeout(r, delayMs * (attempt + 1)))
        continue
      }
      return res // Return non-5xx errors as-is
    } catch (err) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, delayMs * (attempt + 1)))
        continue
      }
      throw err
    }
  }
  throw new Error(`Failed after ${retries + 1} attempts: ${url}`)
}

/**
 * Check robots.txt for a domain before scraping.
 * Returns true if scraping is allowed for the given path.
 */
export async function checkRobotsTxt(baseUrl: string, path: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/robots.txt`, {
      headers: { 'User-Agent': 'VitfixBot/1.0 (+https://vitfix.io/bot)' },
    })
    if (!res.ok) return true // No robots.txt = allowed
    const text = await res.text()

    // Simple parser — check for Disallow directives matching our path
    const lines = text.split('\n')
    let inOurBlock = false
    for (const line of lines) {
      const trimmed = line.trim().toLowerCase()
      if (trimmed.startsWith('user-agent:')) {
        const agent = trimmed.split(':')[1]?.trim()
        inOurBlock = agent === '*' || agent === 'vitfixbot'
      }
      if (inOurBlock && trimmed.startsWith('disallow:')) {
        const disallowed = trimmed.split(':')[1]?.trim()
        if (disallowed && path.startsWith(disallowed)) {
          logger.warn(`[robots.txt] ${baseUrl}${path} is disallowed`)
          return false
        }
      }
    }
    return true
  } catch {
    return true // Can't reach robots.txt = assume allowed
  }
}
