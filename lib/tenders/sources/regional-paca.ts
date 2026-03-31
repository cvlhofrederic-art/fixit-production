// ── Regional PACA Platforms Scanner ──────────────────────────────────────────
// Scans regional procurement platforms specific to PACA / Bouches-du-Rhône:
// - paca.marches-publics.info (Profil acheteur régional)
// - marches.ampmetropole.fr (Métropole Aix-Marseille-Provence)
// - achat.maregionsud.fr (Région Sud / Provence-Alpes-Côte d'Azur)
// - marches.departement13.fr (Conseil Départemental des Bouches-du-Rhône)

import type { Tender } from '../types'
import { SCANNER_CONFIG, DEPARTMENTS } from '../config'
import { logger } from '@/lib/logger'

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateId(source: string, raw: string): string {
  let hash = 0
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0
  }
  return `${source}_${Math.abs(hash).toString(36)}`
}

function nowISO(): string {
  return new Date().toISOString()
}

function today(): string {
  return nowISO().split('T')[0]
}

async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = SCANNER_CONFIG.retry_count,
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(),
    SCANNER_CONFIG.request_timeout_ms,
  )

  const fetchOptions: RequestInit = {
    ...options,
    signal: controller.signal,
    headers: {
      'User-Agent': SCANNER_CONFIG.user_agent,
      Accept: 'text/html,application/json',
      ...options.headers,
    },
  }

  try {
    const response = await fetch(url, fetchOptions)
    clearTimeout(timeout)

    if (response.status >= 500 && retries > 0) {
      logger.warn(`[regional-paca] 5xx from ${url}, retrying (${retries} left)`)
      await new Promise((r) => setTimeout(r, SCANNER_CONFIG.retry_delay_ms))
      return fetchWithRetry(url, options, retries - 1)
    }

    return response
  } catch (err) {
    clearTimeout(timeout)
    if (retries > 0) {
      logger.warn(`[regional-paca] fetch error for ${url}, retrying (${retries} left)`)
      await new Promise((r) => setTimeout(r, SCANNER_CONFIG.retry_delay_ms))
      return fetchWithRetry(url, options, retries - 1)
    }
    throw err
  }
}

/**
 * Generic HTML parser for procurement search result pages.
 * Most regional platforms share similar HTML structures (table or card layout).
 */
function parseProcurementHTML(
  html: string,
  sourceName: string,
  sourceKey: string,
  baseUrl: string,
  department: string,
  region: string,
): Tender[] {
  const tenders: Tender[] = []

  // Strategy 1: table rows with links
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  const linkPattern = /<a[^>]*href="([^"]*)"[^>]*>\s*([\s\S]*?)\s*<\/a>/i
  const datePattern = /(\d{2}[/.-]\d{2}[/.-]\d{4})/g
  const buyerPattern =
    /(?:acheteur|organisme|entité|collectivité|maître\s*d'ouvrage)[^<]*?(?:<[^>]*>)?\s*([^<]{3,80})/i

  let rowMatch: RegExpExecArray | null
  while ((rowMatch = rowPattern.exec(html)) !== null) {
    const row = rowMatch[1]

    const linkMatch = linkPattern.exec(row)
    if (!linkMatch) continue

    const link = linkMatch[1]
    const title = linkMatch[2].replace(/<[^>]*>/g, '').trim()

    if (!title || title.length < 10) continue

    // Skip obviously non-BTP rows (fournitures, services IT, etc.)
    const titleLower = title.toLowerCase()
    if (titleLower.includes('attribué') || titleLower.includes('[attribue]')) continue

    // Extract dates
    const dates: string[] = []
    let dateMatch: RegExpExecArray | null
    const dateRegex = /(\d{2}[/.-]\d{2}[/.-]\d{4})/g
    while ((dateMatch = dateRegex.exec(row)) !== null) {
      dates.push(dateMatch[1])
    }

    const publicationDate = dates[0]
      ? dates[0].replace(/(\d{2})[/.-](\d{2})[/.-](\d{4})/, '$3-$2-$1')
      : today()
    const deadline = dates[1]
      ? dates[1].replace(/(\d{2})[/.-](\d{2})[/.-](\d{4})/, '$3-$2-$1')
      : ''

    const buyerMatch = buyerPattern.exec(row)
    const buyer = buyerMatch
      ? buyerMatch[1].replace(/<[^>]*>/g, '').trim()
      : undefined

    const fullUrl = link.startsWith('http') ? link : `${baseUrl}${link.startsWith('/') ? '' : '/'}${link}`
    const sourceId = generateId(sourceKey, link)

    tenders.push({
      id: generateId(sourceKey, `${department}_${link}`),
      title,
      city: '',
      source: sourceName,
      source_id: sourceId,
      publication_date: publicationDate,
      deadline,
      description: title,
      url: fullUrl,
      category: 'BTP',
      department,
      region,
      buyer,
      synced_at: nowISO(),
    })
  }

  // Strategy 2: div-based card layout (if table parsing found nothing)
  if (tenders.length === 0) {
    const cardPattern =
      /<(?:div|article|li)[^>]*class="[^"]*(?:consultation|avis|marche|result)[^"]*"[^>]*>([\s\S]*?)(?:<\/(?:div|article|li)>){1,3}/gi

    let cardMatch: RegExpExecArray | null
    while ((cardMatch = cardPattern.exec(html)) !== null) {
      const block = cardMatch[1]
      const linkMatch = linkPattern.exec(block)
      if (!linkMatch) continue

      const link = linkMatch[1]
      const title = linkMatch[2].replace(/<[^>]*>/g, '').trim()
      if (!title || title.length < 10) continue

      const titleLower = title.toLowerCase()
      if (titleLower.includes('attribué') || titleLower.includes('[attribue]')) continue

      const fullUrl = link.startsWith('http') ? link : `${baseUrl}${link.startsWith('/') ? '' : '/'}${link}`

      tenders.push({
        id: generateId(sourceKey, `${department}_card_${link}`),
        title,
        city: '',
        source: sourceName,
        source_id: generateId(sourceKey, link),
        publication_date: today(),
        deadline: '',
        description: title,
        url: fullUrl,
        category: 'BTP',
        department,
        region,
        synced_at: nowISO(),
      })
    }
  }

  return tenders
}

// ── paca.marches-publics.info ───────────────────────────────────────────────

export async function scanPACAMarches(department: string): Promise<Tender[]> {
  const deptConfig = DEPARTMENTS[department]
  if (!deptConfig) return []

  const url = `https://paca.marches-publics.info/?type=ao&dept=${department}`

  logger.info(`[regional-paca:PACA] Scanning paca.marches-publics.info for dept ${department}`)

  try {
    const response = await fetchWithRetry(url)
    if (!response.ok) {
      logger.error(`[regional-paca:PACA] HTTP ${response.status}`)
      return []
    }

    const html = await response.text()
    const tenders = parseProcurementHTML(
      html,
      'paca.marches-publics.info',
      'paca_mp',
      'https://paca.marches-publics.info',
      deptConfig.code,
      deptConfig.region,
    )

    logger.info(`[regional-paca:PACA] Found ${tenders.length} tenders`)
    return tenders
  } catch (err) {
    logger.error(`[regional-paca:PACA] Failed`, { error: err })
    return []
  }
}

// ── marches.ampmetropole.fr ─────────────────────────────────────────────────

export async function scanAMPMetropole(): Promise<Tender[]> {
  // Métropole Aix-Marseille-Provence — always dept 13
  const deptConfig = DEPARTMENTS['13']
  if (!deptConfig) return []

  const url = 'https://marches.ampmetropole.fr/entreprise/consultation-list'

  logger.info(`[regional-paca:AMP] Scanning marches.ampmetropole.fr`)

  try {
    const response = await fetchWithRetry(url)
    if (!response.ok) {
      logger.error(`[regional-paca:AMP] HTTP ${response.status}`)
      return []
    }

    const html = await response.text()
    const tenders = parseProcurementHTML(
      html,
      'Métropole Aix-Marseille-Provence',
      'amp_metro',
      'https://marches.ampmetropole.fr',
      '13',
      deptConfig.region,
    )

    logger.info(`[regional-paca:AMP] Found ${tenders.length} tenders`)
    return tenders
  } catch (err) {
    logger.error(`[regional-paca:AMP] Failed`, { error: err })
    return []
  }
}

// ── achat.maregionsud.fr ────────────────────────────────────────────────────

export async function scanRegionSud(): Promise<Tender[]> {
  const deptConfig = DEPARTMENTS['13']
  if (!deptConfig) return []

  // Région Sud procurement portal
  const url = 'https://achat.maregionsud.fr/entreprise/consultation-list'

  logger.info(`[regional-paca:RegionSud] Scanning achat.maregionsud.fr`)

  try {
    const response = await fetchWithRetry(url)
    if (!response.ok) {
      logger.error(`[regional-paca:RegionSud] HTTP ${response.status}`)
      return []
    }

    const html = await response.text()
    const tenders = parseProcurementHTML(
      html,
      'Région Sud PACA',
      'region_sud',
      'https://achat.maregionsud.fr',
      '13',
      'PACA',
    )

    logger.info(`[regional-paca:RegionSud] Found ${tenders.length} tenders`)
    return tenders
  } catch (err) {
    logger.error(`[regional-paca:RegionSud] Failed`, { error: err })
    return []
  }
}

// ── marches.departement13.fr ────────────────────────────────────────────────

export async function scanDepartement13(): Promise<Tender[]> {
  const deptConfig = DEPARTMENTS['13']
  if (!deptConfig) return []

  const url = 'https://marches.departement13.fr/entreprise/consultation-list'

  logger.info(`[regional-paca:Dept13] Scanning marches.departement13.fr`)

  try {
    const response = await fetchWithRetry(url)
    if (!response.ok) {
      logger.error(`[regional-paca:Dept13] HTTP ${response.status}`)
      return []
    }

    const html = await response.text()
    const tenders = parseProcurementHTML(
      html,
      'Département Bouches-du-Rhône',
      'dept13',
      'https://marches.departement13.fr',
      '13',
      'PACA',
    )

    logger.info(`[regional-paca:Dept13] Found ${tenders.length} tenders`)
    return tenders
  } catch (err) {
    logger.error(`[regional-paca:Dept13] Failed`, { error: err })
    return []
  }
}

// ── Aggregate all regional PACA scanners ────────────────────────────────────

export async function scanAllRegionalPACA(department: string): Promise<Tender[]> {
  logger.info(`[regional-paca] Starting parallel scan for all PACA regional platforms`)
  const start = Date.now()

  // Only the PACA platform is department-generic; the others are 13-specific
  const scanners: Promise<Tender[]>[] = [scanPACAMarches(department)]

  // Add 13-specific scanners only when scanning dept 13
  if (department === '13') {
    scanners.push(scanAMPMetropole())
    scanners.push(scanRegionSud())
    scanners.push(scanDepartement13())
  }

  const results = await Promise.allSettled(scanners)
  const tenders: Tender[] = []
  const labels = ['PACA', 'AMP', 'RegionSud', 'Dept13'].slice(0, scanners.length)

  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    if (result.status === 'fulfilled') {
      tenders.push(...result.value)
    } else {
      logger.error(`[regional-paca] ${labels[i]} failed`, { error: result.reason })
    }
  }

  const duration = Date.now() - start
  logger.info(
    `[regional-paca] Complete: ${tenders.length} tenders from ${scanners.length} regional platforms in ${duration}ms`,
  )

  return tenders
}
