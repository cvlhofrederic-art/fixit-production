// ── Tenders Scanner — Main orchestrator ─────────────────────────────────────

import type { Tender, ScanResult } from './types'
import { SCANNER_CONFIG, DEPARTMENTS } from './config'
import { loadCommunes, resolveWebsites } from './communes'
import { scanBOAMP } from './sources/boamp'
import { scanAllMairies } from './sources/mairies'
import { scanAllPlatforms } from './sources/platforms'
import { filterBTP } from './classifier'
import { deduplicateTenders } from './dedup'
import { logger } from '@/lib/logger'
import { type SyncedMarche, upsertMarches } from '@/lib/marches-sync'
import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile } from 'fs/promises'
import path from 'path'

// ── Supabase admin client ───────────────────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// ── Helpers ─────────────────────────────────────────────────────────────────

function dataDir(): string {
  return path.join(process.cwd(), 'data')
}

function dataFilePath(department: string): string {
  return path.join(dataDir(), `tenders-${department}.json`)
}

function tenderToSyncedMarche(tender: Tender): SyncedMarche {
  return {
    source: tender.source,
    source_id: tender.source_id,
    url_source: tender.url,
    title: tender.title,
    description: tender.description,
    category: 'travaux',
    pays: 'FR',
    zone_test: '13-paca',
    location_city: tender.city,
    departement: tender.department,
    acheteur: tender.buyer,
    date_publication: tender.publication_date,
    deadline: tender.deadline,
    procedure_type: tender.procedure_type,
    langue: 'fr',
    status: 'open',
    urgency: 'normal',
    budget_min: tender.estimated_budget,
    montant_estime: tender.estimated_budget,
  }
}

// ── Main entry point ────────────────────────────────────────────────────────

export async function scanDepartment(department: string): Promise<ScanResult> {
  const start = Date.now()
  const errors: string[] = []

  const deptConfig = DEPARTMENTS[department]
  if (!deptConfig) {
    throw new Error(`Unknown department: ${department}. Available: ${Object.keys(DEPARTMENTS).join(', ')}`)
  }

  logger.info(`[scanner] Starting scan for department ${department} (${deptConfig.name})`)

  // 1. Load communes
  let communes = await loadCommunes(department)
  logger.info(`[scanner] Loaded ${communes.length} communes for dept ${department}`)

  // 2. Resolve websites (only for communes missing one)
  const unresolved = communes.filter(c => !c.website_status)
  if (unresolved.length > 0) {
    logger.info(`[scanner] Resolving websites for ${unresolved.length} communes`)
    communes = await resolveWebsites(communes)
  }

  const communesWithSite = communes.filter(c => c.website_status === 'found')

  // 3. Run all sources in parallel
  const sourceResults: Record<string, Tender[]> = {}

  const [boampResult, mairiesResult, platformsResult] = await Promise.allSettled([
    scanBOAMP(department, SCANNER_CONFIG.boamp_days_back),
    scanAllMairies(communesWithSite),
    scanAllPlatforms(department),
  ])

  if (boampResult.status === 'fulfilled') {
    sourceResults.boamp = boampResult.value
    logger.info(`[scanner] BOAMP: ${boampResult.value.length} tenders`)
  } else {
    errors.push(`BOAMP: ${boampResult.reason}`)
    sourceResults.boamp = []
    logger.error(`[scanner] BOAMP failed:`, boampResult.reason)
  }

  if (mairiesResult.status === 'fulfilled') {
    sourceResults.mairies = mairiesResult.value
    logger.info(`[scanner] Mairies: ${mairiesResult.value.length} tenders`)
  } else {
    errors.push(`Mairies: ${mairiesResult.reason}`)
    sourceResults.mairies = []
    logger.error(`[scanner] Mairies failed:`, mairiesResult.reason)
  }

  if (platformsResult.status === 'fulfilled') {
    sourceResults.platforms = platformsResult.value
    logger.info(`[scanner] Platforms: ${platformsResult.value.length} tenders`)
  } else {
    errors.push(`Platforms: ${platformsResult.reason}`)
    sourceResults.platforms = []
    logger.error(`[scanner] Platforms failed:`, platformsResult.reason)
  }

  // 4. Merge all results
  const allTenders = Object.values(sourceResults).flat()
  const totalRaw = allTenders.length

  // 5. Filter BTP
  const btpTenders = filterBTP(allTenders)

  // 6. Deduplicate
  const dedupedTenders = deduplicateTenders(btpTenders)

  // 7. Build ScanResult
  const sources: Record<string, number> = {}
  for (const [key, tenders] of Object.entries(sourceResults)) {
    sources[key] = tenders.length
  }

  const result: ScanResult = {
    tenders: dedupedTenders,
    meta: {
      department,
      communes_scanned: communes.length,
      communes_with_site: communesWithSite.length,
      sources,
      total_raw: totalRaw,
      total_after_filter: btpTenders.length,
      total_after_dedup: dedupedTenders.length,
      duration_ms: Date.now() - start,
      scanned_at: new Date().toISOString(),
      errors,
    },
  }

  logger.info(
    `[scanner] Dept ${department} done: ${totalRaw} raw → ${btpTenders.length} BTP → ${dedupedTenders.length} deduped (${result.meta.duration_ms}ms)`,
  )

  // 8. Store results
  await storeTenders(department, result)

  // 9. Return
  return result
}

// ── Storage ─────────────────────────────────────────────────────────────────

export async function storeTenders(department: string, result: ScanResult): Promise<void> {
  const { tenders } = result

  // Upsert into Supabase
  if (tenders.length > 0) {
    const syncedMarches = tenders.map(tenderToSyncedMarche)
    const upsertResult = await upsertMarches(supabase, syncedMarches, `scanner-${department}`)
    logger.info(
      `[scanner] Supabase upsert for dept ${department}: ${upsertResult.inserts} inserts, ${upsertResult.updates} updates, ${upsertResult.errors} errors`,
    )
  }

  // Write local backup
  try {
    const dir = dataDir()
    const { mkdir } = await import('fs/promises')
    await mkdir(dir, { recursive: true })

    const filePath = dataFilePath(department)
    const payload = {
      department,
      updated_at: new Date().toISOString(),
      count: tenders.length,
      tenders,
    }
    await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8')
    logger.info(`[scanner] Local backup written to ${filePath} (${tenders.length} tenders)`)
  } catch (err) {
    logger.error(`[scanner] Failed to write local backup for dept ${department}:`, err)
  }
}

export async function loadStoredTenders(department: string): Promise<Tender[]> {
  const filePath = dataFilePath(department)

  try {
    const raw = await readFile(filePath, 'utf-8')
    const data = JSON.parse(raw) as { tenders: Tender[] }

    if (!Array.isArray(data.tenders)) return []

    // Filter out tenders older than retention period
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - SCANNER_CONFIG.tender_retention_days)
    const cutoffISO = cutoff.toISOString()

    return data.tenders.filter(t => t.publication_date >= cutoffISO)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return [] // No stored data yet
    }
    logger.error(`[scanner] Failed to load stored tenders for dept ${department}:`, err)
    return []
  }
}
