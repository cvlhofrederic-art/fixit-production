// ── Public Procurement Platforms Scanner ─────────────────────────────────────
// Fetches OPEN (non-attributed) tenders from:
// - marchespublics.gouv.fr
// - e-marchespublics.com (marches-publics.info)
// - DECP augmenté API (data.economie.gouv.fr)

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

function getDeptConfig(department: string) {
  const config = DEPARTMENTS[department]
  if (!config) {
    throw new Error(`Unknown department: ${department}`)
  }
  return config
}

async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = SCANNER_CONFIG.retry_count
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(),
    SCANNER_CONFIG.request_timeout_ms
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
      logger.warn(`[platforms] 5xx from ${url}, retrying (${retries} left)`)
      await new Promise((r) => setTimeout(r, SCANNER_CONFIG.retry_delay_ms))
      return fetchWithRetry(url, options, retries - 1)
    }

    return response
  } catch (err) {
    clearTimeout(timeout)
    if (retries > 0) {
      logger.warn(`[platforms] fetch error for ${url}, retrying (${retries} left)`)
      await new Promise((r) => setTimeout(r, SCANNER_CONFIG.retry_delay_ms))
      return fetchWithRetry(url, options, retries - 1)
    }
    throw err
  }
}

// ── marchespublics.gouv.fr ──────────────────────────────────────────────────

export async function scanMPS(department: string): Promise<Tender[]> {
  const deptConfig = getDeptConfig(department)
  const url = `https://www.marchespublics.gouv.fr/app/consultation/search?dtypeConsultation=0&department=${department}`

  logger.info(`[platforms:MPS] Scanning department ${department}`)

  try {
    const response = await fetchWithRetry(url)
    if (!response.ok) {
      logger.error(`[platforms:MPS] HTTP ${response.status} for dept ${department}`)
      return []
    }

    const html = await response.text()
    const tenders: Tender[] = []

    // Match consultation blocks in the search results HTML
    const entryPattern =
      /<div[^>]*class="[^"]*consultation[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi
    const titlePattern = /<a[^>]*href="([^"]*)"[^>]*>\s*([\s\S]*?)\s*<\/a>/i
    const datePattern =
      /(?:date\s*limite|clôture|cloture)[^<]*?(\d{2}[/.-]\d{2}[/.-]\d{4})/i
    const buyerPattern =
      /(?:acheteur|pouvoir\s*adjudicateur|organisme)[^<]*?<[^>]*>\s*([^<]+)/i
    const refPattern = /(?:référence|ref|n°)[^<]*?(\w[\w\-/]+)/i

    let entryMatch: RegExpExecArray | null
    while ((entryMatch = entryPattern.exec(html)) !== null) {
      const block = entryMatch[1]

      const titleMatch = titlePattern.exec(block)
      if (!titleMatch) continue

      const link = titleMatch[1]
      const title = titleMatch[2].replace(/<[^>]*>/g, '').trim()

      if (!title) continue

      const dateMatch = datePattern.exec(block)
      const buyerMatch = buyerPattern.exec(block)
      const refMatch = refPattern.exec(block)

      const deadline = dateMatch
        ? dateMatch[1].replace(/(\d{2})[/.-](\d{2})[/.-](\d{4})/, '$3-$2-$1')
        : ''

      const fullUrl = link.startsWith('http')
        ? link
        : `https://www.marchespublics.gouv.fr${link}`

      const sourceId = refMatch ? refMatch[1] : generateId('mps', title)

      tenders.push({
        id: generateId('mps', `${department}_${sourceId}`),
        title,
        city: '',
        source: 'marchespublics.gouv.fr',
        source_id: sourceId,
        publication_date: nowISO().split('T')[0],
        deadline,
        description: title,
        url: fullUrl,
        category: 'BTP',
        department: deptConfig.code,
        region: deptConfig.region,
        buyer: buyerMatch ? buyerMatch[1].trim() : undefined,
        synced_at: nowISO(),
      })
    }

    logger.info(`[platforms:MPS] Found ${tenders.length} tenders in dept ${department}`)
    return tenders
  } catch (err) {
    logger.error(`[platforms:MPS] Failed for dept ${department}`, { error: err })
    return []
  }
}

// ── e-marchespublics.com ────────────────────────────────────────────────────

export async function scanEMarches(department: string): Promise<Tender[]> {
  const deptConfig = getDeptConfig(department)
  const url = `https://www.marches-publics.info/avis/recherche-avis.php?dept=${department}&type=AO`

  logger.info(`[platforms:EMarches] Scanning department ${department}`)

  try {
    const response = await fetchWithRetry(url)
    if (!response.ok) {
      logger.error(
        `[platforms:EMarches] HTTP ${response.status} for dept ${department}`
      )
      return []
    }

    const html = await response.text()
    const tenders: Tender[] = []

    // Match table rows or avis blocks
    const rowPattern =
      /<tr[^>]*>([\s\S]*?)<\/tr>/gi
    const linkPattern = /<a[^>]*href="([^"]*)"[^>]*>\s*([\s\S]*?)\s*<\/a>/i
    const datePattern = /(\d{2}[/.-]\d{2}[/.-]\d{4})/g
    const buyerPattern =
      /<td[^>]*class="[^"]*organisme[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/td>/i

    let rowMatch: RegExpExecArray | null
    while ((rowMatch = rowPattern.exec(html)) !== null) {
      const row = rowMatch[1]

      const linkMatch = linkPattern.exec(row)
      if (!linkMatch) continue

      const link = linkMatch[1]
      const title = linkMatch[2].replace(/<[^>]*>/g, '').trim()

      if (!title || title.length < 10) continue

      // Extract dates from row (first = publication, second = deadline)
      const dates: string[] = []
      let dateMatch: RegExpExecArray | null
      while ((dateMatch = datePattern.exec(row)) !== null) {
        dates.push(dateMatch[1])
      }

      const publicationDate = dates[0]
        ? dates[0].replace(/(\d{2})[/.-](\d{2})[/.-](\d{4})/, '$3-$2-$1')
        : nowISO().split('T')[0]

      const deadline = dates[1]
        ? dates[1].replace(/(\d{2})[/.-](\d{2})[/.-](\d{4})/, '$3-$2-$1')
        : ''

      const buyerMatch = buyerPattern.exec(row)
      const buyer = buyerMatch
        ? buyerMatch[1].replace(/<[^>]*>/g, '').trim()
        : undefined

      const fullUrl = link.startsWith('http')
        ? link
        : `https://www.marches-publics.info${link}`

      const sourceId = generateId('em', link)

      tenders.push({
        id: generateId('emarches', `${department}_${link}`),
        title,
        city: '',
        source: 'e-marchespublics.com',
        source_id: sourceId,
        publication_date: publicationDate,
        deadline,
        description: title,
        url: fullUrl,
        category: 'BTP',
        department: deptConfig.code,
        region: deptConfig.region,
        buyer,
        synced_at: nowISO(),
      })
    }

    logger.info(
      `[platforms:EMarches] Found ${tenders.length} tenders in dept ${department}`
    )
    return tenders
  } catch (err) {
    logger.error(`[platforms:EMarches] Failed for dept ${department}`, {
      error: err,
    })
    return []
  }
}

// ── DECP augmenté API (OPEN tenders only) ───────────────────────────────────

export async function scanDECPOpen(
  department: string,
  daysBack = SCANNER_CONFIG.boamp_days_back
): Promise<Tender[]> {
  const deptConfig = getDeptConfig(department)
  const since = new Date(Date.now() - daysBack * 86400000)
    .toISOString()
    .split('T')[0]

  const whereClause = [
    `codedepartementexecution='${department}'`,
    `nature='Marché'`,
    `datepublicationdonnees>='${since}'`,
  ].join(' AND ')

  const selectFields = [
    'id',
    'objetmarche',
    'codecpv',
    'lieuexecutionnom',
    'montant',
    'nomacheteur',
    'nature',
    'datepublicationdonnees',
    'datelimitereponse',
    'codedepartementexecution',
  ].join(',')

  const params = new URLSearchParams({
    where: whereClause,
    select: selectFields,
    limit: '100',
    order_by: 'datepublicationdonnees DESC',
  })

  const url = `https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/decp_augmente/records?${params}`

  logger.info(`[platforms:DECP] Scanning department ${department}, last ${daysBack} days`)

  try {
    const response = await fetchWithRetry(url, {
      headers: { Accept: 'application/json' },
    })

    if (!response.ok) {
      logger.error(`[platforms:DECP] HTTP ${response.status} for dept ${department}`)
      return []
    }

    const data = await response.json()
    const records: Array<Record<string, unknown>> = data.results || data.records || []
    const tenders: Tender[] = []

    for (const record of records) {
      const fields =
        (record.fields as Record<string, unknown>) || record

      const title = String(fields.objetmarche || '')
      const cpv = String(fields.codecpv || '')

      // Skip attributed tenders
      const titleLower = title.toLowerCase()
      if (titleLower.includes('[attribué]') || titleLower.includes('attribué')) {
        continue
      }

      // Filter CPV prefix 45 (construction)
      if (cpv && !cpv.startsWith('45')) {
        continue
      }

      const decpId = String(fields.id || '')
      const montant = fields.montant ? Number(fields.montant) : undefined
      const publicationDate = String(fields.datepublicationdonnees || '').split('T')[0]
      const deadline = String(fields.datelimitereponse || '').split('T')[0]
      const lieu = String(fields.lieuexecutionnom || '')
      const acheteur = String(fields.nomacheteur || '')

      const recordUrl = decpId
        ? `https://data.economie.gouv.fr/explore/dataset/decp_augmente/table/?q=${encodeURIComponent(decpId)}`
        : `https://data.economie.gouv.fr/explore/dataset/decp_augmente/table/`

      tenders.push({
        id: generateId('decp', `${department}_${decpId || title}`),
        title,
        city: lieu,
        source: 'DECP augmenté',
        source_id: decpId || generateId('decp_rec', title),
        publication_date: publicationDate || nowISO().split('T')[0],
        deadline: deadline || '',
        description: title,
        url: recordUrl,
        estimated_budget: montant && montant > 0 ? montant : undefined,
        category: 'BTP',
        cpv_codes: cpv ? [cpv] : undefined,
        department: deptConfig.code,
        region: deptConfig.region,
        buyer: acheteur || undefined,
        synced_at: nowISO(),
      })
    }

    logger.info(
      `[platforms:DECP] Found ${tenders.length} open tenders in dept ${department} (filtered from ${records.length} records)`
    )
    return tenders
  } catch (err) {
    logger.error(`[platforms:DECP] Failed for dept ${department}`, { error: err })
    return []
  }
}

// ── Aggregate scanner ───────────────────────────────────────────────────────

export async function scanAllPlatforms(department: string): Promise<Tender[]> {
  logger.info(`[platforms] Starting parallel scan for department ${department}`)
  const start = Date.now()

  const results = await Promise.allSettled([
    scanMPS(department),
    scanEMarches(department),
    scanDECPOpen(department),
  ])

  const tenders: Tender[] = []
  const sources = ['MPS', 'EMarches', 'DECP']

  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    if (result.status === 'fulfilled') {
      tenders.push(...result.value)
    } else {
      logger.error(`[platforms] ${sources[i]} scanner failed`, {
        error: result.reason,
      })
    }
  }

  const duration = Date.now() - start
  logger.info(
    `[platforms] Scan complete: ${tenders.length} tenders from ${sources.length} sources in ${duration}ms`
  )

  return tenders
}
