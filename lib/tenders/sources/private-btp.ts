// ── Private BTP Platforms Scanner ────────────────────────────────────────────
// Scans free private BTP tender/networking platforms:
// - iBâtir (ibatir.fr) — annonces BTP gratuites
// - Allopro.fr — réseau artisans / appels d'offres
// - Progrid.fr — sous-traitance BTP
// - OnceForAll (onceforall.fr) — mise en relation BTP / dossiers chantier

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

async function fetchSafe(
  url: string,
  options: RequestInit = {},
  retries = SCANNER_CONFIG.retry_count,
): Promise<Response | null> {
  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(),
    SCANNER_CONFIG.request_timeout_ms,
  )

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': SCANNER_CONFIG.user_agent,
        Accept: 'text/html,application/json',
        ...options.headers,
      },
    })
    clearTimeout(timeout)

    if (response.status >= 500 && retries > 0) {
      await new Promise((r) => setTimeout(r, SCANNER_CONFIG.retry_delay_ms))
      return fetchSafe(url, options, retries - 1)
    }

    return response.ok ? response : null
  } catch (err) {
    clearTimeout(timeout)
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, SCANNER_CONFIG.retry_delay_ms))
      return fetchSafe(url, options, retries - 1)
    }
    return null
  }
}

/**
 * Extract tenders from generic HTML page (links with titles + optional dates).
 */
function extractFromHTML(
  html: string,
  sourceName: string,
  sourceKey: string,
  baseUrl: string,
  department: string,
  region: string,
): Tender[] {
  const tenders: Tender[] = []

  // Match any link that looks like a tender/annonce/consultation
  const linkPattern =
    /<a[^>]*href="([^"]*(?:annonce|offre|consultation|marche|tender|chantier|projet)[^"]*)"[^>]*>\s*([\s\S]*?)\s*<\/a>/gi
  const datePattern = /(\d{2}[/.-]\d{2}[/.-]\d{4})/

  let match: RegExpExecArray | null
  const seen = new Set<string>()

  while ((match = linkPattern.exec(html)) !== null) {
    const link = match[1]
    const title = match[2].replace(/<[^>]*>/g, '').trim()

    if (!title || title.length < 10) continue
    if (seen.has(link)) continue
    seen.add(link)

    // Skip attributed
    const lower = title.toLowerCase()
    if (lower.includes('attribué') || lower.includes('terminé') || lower.includes('clôturé')) continue

    const fullUrl = link.startsWith('http') ? link : `${baseUrl}${link.startsWith('/') ? '' : '/'}${link}`

    // Try to find a date near the link
    const parentBlock = html.substring(
      Math.max(0, match.index - 200),
      Math.min(html.length, match.index + match[0].length + 200),
    )
    const dateMatch = datePattern.exec(parentBlock)
    const deadline = dateMatch
      ? dateMatch[1].replace(/(\d{2})[/.-](\d{2})[/.-](\d{4})/, '$3-$2-$1')
      : ''

    tenders.push({
      id: generateId(sourceKey, `${department}_${link}`),
      title,
      city: '',
      source: sourceName,
      source_id: generateId(sourceKey, link),
      publication_date: today(),
      deadline,
      description: title,
      url: fullUrl,
      category: 'BTP',
      department,
      region,
      synced_at: nowISO(),
    })
  }

  // Broader fallback: any row/card with a link, filtered by BTP-related context
  if (tenders.length === 0) {
    const rowPattern = /<(?:tr|div|li|article)[^>]*>([\s\S]*?)<\/(?:tr|div|li|article)>/gi
    const anyLinkPattern = /<a[^>]*href="([^"]*)"[^>]*>\s*([\s\S]*?)\s*<\/a>/i
    const btpHints = /travaux|chantier|bâtiment|batiment|construction|rénovation|renovation|maçonnerie|plomberie|électricité|toiture|menuiserie/i

    let rowMatch: RegExpExecArray | null
    while ((rowMatch = rowPattern.exec(html)) !== null) {
      const row = rowMatch[1]
      if (!btpHints.test(row)) continue

      const linkMatch = anyLinkPattern.exec(row)
      if (!linkMatch) continue

      const link = linkMatch[1]
      const title = linkMatch[2].replace(/<[^>]*>/g, '').trim()
      if (!title || title.length < 10 || seen.has(link)) continue
      seen.add(link)

      const lower = title.toLowerCase()
      if (lower.includes('attribué') || lower.includes('terminé')) continue

      const fullUrl = link.startsWith('http') ? link : `${baseUrl}${link.startsWith('/') ? '' : '/'}${link}`

      tenders.push({
        id: generateId(sourceKey, `${department}_fb_${link}`),
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

// ── iBâtir (ibatir.fr) ─────────────────────────────────────────────────────

export async function scanIBatir(department: string): Promise<Tender[]> {
  const deptConfig = DEPARTMENTS[department]
  if (!deptConfig) return []

  // iBâtir lists free BTP ads by department
  const url = `https://www.ibatir.fr/annonces/departement/${department}`

  logger.info(`[private-btp:iBatir] Scanning dept ${department}`)

  try {
    const response = await fetchSafe(url)
    if (!response) {
      logger.warn(`[private-btp:iBatir] No response for dept ${department}`)
      return []
    }

    const html = await response.text()
    const tenders = extractFromHTML(
      html,
      'iBâtir',
      'ibatir',
      'https://www.ibatir.fr',
      deptConfig.code,
      deptConfig.region,
    )

    logger.info(`[private-btp:iBatir] Found ${tenders.length} tenders`)
    return tenders
  } catch (err) {
    logger.error(`[private-btp:iBatir] Failed`, { error: err })
    return []
  }
}

// ── Allopro.fr ──────────────────────────────────────────────────────────────

export async function scanAllopro(department: string): Promise<Tender[]> {
  const deptConfig = DEPARTMENTS[department]
  if (!deptConfig) return []

  const url = `https://www.allopro.fr/appels-offres/departement-${department}`

  logger.info(`[private-btp:Allopro] Scanning dept ${department}`)

  try {
    const response = await fetchSafe(url)
    if (!response) {
      logger.warn(`[private-btp:Allopro] No response for dept ${department}`)
      return []
    }

    const html = await response.text()
    const tenders = extractFromHTML(
      html,
      'Allopro.fr',
      'allopro',
      'https://www.allopro.fr',
      deptConfig.code,
      deptConfig.region,
    )

    logger.info(`[private-btp:Allopro] Found ${tenders.length} tenders`)
    return tenders
  } catch (err) {
    logger.error(`[private-btp:Allopro] Failed`, { error: err })
    return []
  }
}

// ── Progrid.fr ──────────────────────────────────────────────────────────────

export async function scanProgrid(department: string): Promise<Tender[]> {
  const deptConfig = DEPARTMENTS[department]
  if (!deptConfig) return []

  // Progrid: sous-traitance BTP network
  const url = `https://www.progrid.fr/recherche/sous-traitance?dept=${department}&secteur=btp`

  logger.info(`[private-btp:Progrid] Scanning dept ${department}`)

  try {
    const response = await fetchSafe(url)
    if (!response) {
      logger.warn(`[private-btp:Progrid] No response for dept ${department}`)
      return []
    }

    const html = await response.text()
    const tenders = extractFromHTML(
      html,
      'Progrid.fr',
      'progrid',
      'https://www.progrid.fr',
      deptConfig.code,
      deptConfig.region,
    )

    logger.info(`[private-btp:Progrid] Found ${tenders.length} tenders`)
    return tenders
  } catch (err) {
    logger.error(`[private-btp:Progrid] Failed`, { error: err })
    return []
  }
}

// ── OnceForAll (onceforall.fr) ──────────────────────────────────────────────

export async function scanOnceForAll(department: string): Promise<Tender[]> {
  const deptConfig = DEPARTMENTS[department]
  if (!deptConfig) return []

  // OnceForAll: dossiers chantier / mise en relation BTP
  const url = `https://www.onceforall.fr/recherche?departement=${department}&type=chantier`

  logger.info(`[private-btp:OnceForAll] Scanning dept ${department}`)

  try {
    const response = await fetchSafe(url)
    if (!response) {
      logger.warn(`[private-btp:OnceForAll] No response for dept ${department}`)
      return []
    }

    const html = await response.text()
    const tenders = extractFromHTML(
      html,
      'OnceForAll',
      'onceforall',
      'https://www.onceforall.fr',
      deptConfig.code,
      deptConfig.region,
    )

    logger.info(`[private-btp:OnceForAll] Found ${tenders.length} tenders`)
    return tenders
  } catch (err) {
    logger.error(`[private-btp:OnceForAll] Failed`, { error: err })
    return []
  }
}

// ── Aggregate all private BTP scanners ──────────────────────────────────────

export async function scanAllPrivateBTP(department: string): Promise<Tender[]> {
  logger.info(`[private-btp] Starting parallel scan for all private BTP platforms`)
  const start = Date.now()

  const results = await Promise.allSettled([
    scanIBatir(department),
    scanAllopro(department),
    scanProgrid(department),
    scanOnceForAll(department),
  ])

  const tenders: Tender[] = []
  const labels = ['iBatir', 'Allopro', 'Progrid', 'OnceForAll']

  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    if (result.status === 'fulfilled') {
      tenders.push(...result.value)
    } else {
      logger.error(`[private-btp] ${labels[i]} failed`, { error: result.reason })
    }
  }

  const duration = Date.now() - start
  logger.info(
    `[private-btp] Complete: ${tenders.length} tenders from ${labels.length} private platforms in ${duration}ms`,
  )

  return tenders
}
