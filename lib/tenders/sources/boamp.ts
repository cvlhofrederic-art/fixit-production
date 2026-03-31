// ── BOAMP Scanner — Fetch open BTP tenders from official BOAMP API ──────────

import type { Tender } from '../types'
import { SCANNER_CONFIG, DEPARTMENTS, BTP_INDICATOR_KEYWORDS } from '../config'
import { logger } from '@/lib/logger'

const BOAMP_API = 'https://www.boamp.fr/api/explore/v2.1/catalog/datasets/boamp/records'

const SELECT_FIELDS = [
  'idweb',
  'objet',
  'dateparution',
  'datelimitereponse',
  'nomacheteur',
  'code_departement',
  'url_avis',
  'nature_libelle',
  'famille_libelle',
].join(',')

const PAGE_SIZE = 100
const MAX_PAGES = 5

interface BOAMPRecord {
  idweb?: string
  objet?: string
  dateparution?: string
  datelimitereponse?: string
  nomacheteur?: string
  code_departement?: string
  url_avis?: string
  nature_libelle?: string
  famille_libelle?: string
}

interface BOAMPResponse {
  total_count?: number
  results?: BOAMPRecord[]
}

function formatDateForQuery(date: Date): string {
  return date.toISOString().split('T')[0]
}

function buildWhereClause(dept: string, dateStr: string): string {
  const deptFilter = `(code_departement:'${dept}' OR code_departement LIKE '${dept}%')`
  const dateFilter = `dateparution>=date'${dateStr}'`

  // Limit to 8 keywords to avoid URL length issues
  const keywords = BTP_INDICATOR_KEYWORDS.slice(0, 8)
  const keywordClauses = keywords.map(kw => `objet LIKE '%${kw}%'`)
  const keywordFilter = `(${keywordClauses.join(' OR ')})`

  return `${dateFilter} AND ${deptFilter} AND ${keywordFilter}`
}

async function fetchWithRetry(url: string, attempt = 0): Promise<Response> {
  const { retry_count, retry_delay_ms, request_timeout_ms } = SCANNER_CONFIG

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), request_timeout_ms)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': SCANNER_CONFIG.user_agent,
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`BOAMP API returned ${response.status}: ${response.statusText}`)
    }

    return response
  } catch (error) {
    if (attempt < retry_count) {
      const delay = retry_delay_ms * Math.pow(2, attempt)
      logger.warn(`[BOAMP] Request failed (attempt ${attempt + 1}/${retry_count + 1}), retrying in ${delay}ms`, {
        url: url.substring(0, 120),
        error: error instanceof Error ? error.message : String(error),
      })
      await new Promise(resolve => setTimeout(resolve, delay))
      return fetchWithRetry(url, attempt + 1)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

function mapRecordToTender(record: BOAMPRecord, department: string, region: string): Tender {
  const idweb = record.idweb ?? ''
  const now = new Date().toISOString()

  // Extract city from buyer name or fall back to department code
  const city = record.nomacheteur
    ? extractCityFromBuyer(record.nomacheteur, record.code_departement ?? department)
    : `Dept. ${record.code_departement ?? department}`

  return {
    id: `boamp-${idweb}`,
    title: record.objet ?? '',
    city,
    source: 'boamp',
    source_id: idweb,
    publication_date: record.dateparution ?? '',
    deadline: record.datelimitereponse ?? '',
    description: record.objet ?? '',
    url: record.url_avis || `https://www.boamp.fr/avis/detail/${idweb}`,
    category: 'BTP',
    department,
    region,
    buyer: record.nomacheteur ?? undefined,
    procedure_type: record.nature_libelle ?? undefined,
    synced_at: now,
  }
}

function extractCityFromBuyer(buyer: string, deptCode: string): string {
  // Common patterns: "Ville de Marseille", "Commune de Aix-en-Provence", "Mairie de ..."
  const patterns = [
    /(?:ville|commune|mairie|métropole|communauté)\s+(?:de|d'|du)\s+(.+)/i,
    /(.+?)(?:\s*-\s*direction|\s*-\s*service)/i,
  ]

  for (const pattern of patterns) {
    const match = buyer.match(pattern)
    if (match?.[1]) {
      return match[1].trim()
    }
  }

  return `Dept. ${deptCode}`
}

export async function scanBOAMP(department: string, daysBack?: number): Promise<Tender[]> {
  const deptConfig = DEPARTMENTS[department]
  if (!deptConfig) {
    logger.warn(`[BOAMP] Unknown department: ${department}`)
    return []
  }

  const effectiveDaysBack = daysBack ?? SCANNER_CONFIG.boamp_days_back
  const sinceDate = new Date()
  sinceDate.setDate(sinceDate.getDate() - effectiveDaysBack)
  const dateStr = formatDateForQuery(sinceDate)

  const where = buildWhereClause(department, dateStr)
  const allTenders: Tender[] = []

  logger.info(`[BOAMP] Scanning department ${department} (${deptConfig.name}), since ${dateStr}`)

  for (let page = 0; page < MAX_PAGES; page++) {
    const offset = page * PAGE_SIZE

    const params = new URLSearchParams({
      select: SELECT_FIELDS,
      where,
      limit: String(PAGE_SIZE),
      offset: String(offset),
      order_by: 'dateparution DESC',
    })

    const url = `${BOAMP_API}?${params.toString()}`

    try {
      const response = await fetchWithRetry(url)
      const data: BOAMPResponse = await response.json()
      const records = data.results ?? []

      if (records.length === 0) {
        logger.info(`[BOAMP] No more results at page ${page + 1}`)
        break
      }

      const tenders = records.map(r => mapRecordToTender(r, department, deptConfig.region))
      allTenders.push(...tenders)

      logger.info(`[BOAMP] Page ${page + 1}: fetched ${records.length} records (total: ${allTenders.length})`)

      // Stop if we got fewer than a full page
      if (records.length < PAGE_SIZE) {
        break
      }

      // Respect rate limiting between pages
      if (page < MAX_PAGES - 1) {
        await new Promise(resolve => setTimeout(resolve, SCANNER_CONFIG.request_delay_ms))
      }
    } catch (error) {
      logger.error(`[BOAMP] Failed to fetch page ${page + 1} for dept ${department}`, {
        error: error instanceof Error ? error.message : String(error),
      })
      break
    }
  }

  logger.info(`[BOAMP] Scan complete for dept ${department}: ${allTenders.length} tenders found`)

  return allTenders
}
