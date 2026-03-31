// ── AWS-Achat Scanner — marchespublics.gouv.fr (PLACE) ──────────────────────
// AWS-Achat powers the national procurement portal PLACE (Plateforme des achats de l'État)
// URL pattern: https://www.marches-publics.gouv.fr (same as MPS, aliased)
// This scanner targets the DUME/PLACE API for open procurement notices.

import type { Tender } from '../types'
import { SCANNER_CONFIG, DEPARTMENTS } from '../config'
import { logger } from '@/lib/logger'

const BASE_URL = 'https://www.marches-publics.gouv.fr'

function generateId(raw: string): string {
  let hash = 0
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0
  }
  return `aws_${Math.abs(hash).toString(36)}`
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout = SCANNER_CONFIG.request_timeout_ms,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': SCANNER_CONFIG.user_agent,
        Accept: 'application/json, text/html',
        ...options.headers,
      },
    })
    clearTimeout(timer)
    return res
  } catch (err) {
    clearTimeout(timer)
    throw err
  }
}

/**
 * Scan AWS-Achat / PLACE for open BTP consultations.
 * The platform exposes a search page we can query with department filters.
 */
export async function scanAWSAchat(department: string): Promise<Tender[]> {
  const deptConfig = DEPARTMENTS[department]
  if (!deptConfig) return []

  // PLACE search endpoint with department filter
  const searchUrl = `${BASE_URL}/app/consultation/search?dtypeConsultation=0&department=${department}&nature=travaux`

  logger.info(`[aws-achat] Scanning department ${department}`)

  try {
    const response = await fetchWithTimeout(searchUrl)
    if (!response.ok) {
      logger.error(`[aws-achat] HTTP ${response.status} for dept ${department}`)
      return []
    }

    const html = await response.text()
    const tenders: Tender[] = []

    // Parse consultation blocks from search results
    const entryPattern =
      /<div[^>]*class="[^"]*consultation-item[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi
    const titlePattern = /<a[^>]*href="([^"]*)"[^>]*>\s*([\s\S]*?)\s*<\/a>/i
    const datePattern =
      /(?:date\s*limite|clôture|cloture|échéance)[^<]*?(\d{2}[/.-]\d{2}[/.-]\d{4})/i
    const buyerPattern =
      /(?:acheteur|organisme|entité)[^<]*?<[^>]*>\s*([^<]+)/i
    const refPattern = /(?:référence|ref|n°|dce)[^<]*?([\w][\w\-/]+)/i

    let match: RegExpExecArray | null
    while ((match = entryPattern.exec(html)) !== null) {
      const block = match[1]

      const titleMatch = titlePattern.exec(block)
      if (!titleMatch) continue

      const link = titleMatch[1]
      const title = titleMatch[2].replace(/<[^>]*>/g, '').trim()
      if (!title || title.length < 10) continue

      const dateMatch = datePattern.exec(block)
      const buyerMatch = buyerPattern.exec(block)
      const refMatch = refPattern.exec(block)

      const deadline = dateMatch
        ? dateMatch[1].replace(/(\d{2})[/.-](\d{2})[/.-](\d{4})/, '$3-$2-$1')
        : ''

      const fullUrl = link.startsWith('http') ? link : `${BASE_URL}${link}`
      const sourceId = refMatch ? refMatch[1] : generateId(title)

      tenders.push({
        id: generateId(`${department}_aws_${sourceId}`),
        title,
        city: '',
        source: 'AWS-Achat (PLACE)',
        source_id: sourceId,
        publication_date: new Date().toISOString().split('T')[0],
        deadline,
        description: title,
        url: fullUrl,
        category: 'BTP',
        department: deptConfig.code,
        region: deptConfig.region,
        buyer: buyerMatch ? buyerMatch[1].trim() : undefined,
        synced_at: new Date().toISOString(),
      })
    }

    // Fallback: try the simpler table layout if consultation-item blocks not found
    if (tenders.length === 0) {
      const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
      const linkPattern = /<a[^>]*href="([^"]*consultation[^"]*)"[^>]*>\s*([\s\S]*?)\s*<\/a>/i

      let rowMatch: RegExpExecArray | null
      while ((rowMatch = rowPattern.exec(html)) !== null) {
        const row = rowMatch[1]
        const linkMatch = linkPattern.exec(row)
        if (!linkMatch) continue

        const link = linkMatch[1]
        const title = linkMatch[2].replace(/<[^>]*>/g, '').trim()
        if (!title || title.length < 10) continue

        const fullUrl = link.startsWith('http') ? link : `${BASE_URL}${link}`

        tenders.push({
          id: generateId(`${department}_aws_${link}`),
          title,
          city: '',
          source: 'AWS-Achat (PLACE)',
          source_id: generateId(link),
          publication_date: new Date().toISOString().split('T')[0],
          deadline: '',
          description: title,
          url: fullUrl,
          category: 'BTP',
          department: deptConfig.code,
          region: deptConfig.region,
          synced_at: new Date().toISOString(),
        })
      }
    }

    logger.info(`[aws-achat] Found ${tenders.length} tenders in dept ${department}`)
    return tenders
  } catch (err) {
    logger.error(`[aws-achat] Failed for dept ${department}`, { error: err })
    return []
  }
}
