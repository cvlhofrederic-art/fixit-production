// ── Public Procurement Platforms Scanner ─────────────────────────────────────
// 8 sites vérifiés fonctionnels pour marchés BTP dept 13 :
// 1. boamp.fr → boamp.ts (séparé)
// 2. e-marchespublics.com → ici
// 3. francemarches.com → ici
// 4. marchesonline.com → ici (compte gratuit requis)
// 5. bailleurs-sociaux.marches-publics.info → ici (HLM)
// 6-8. regional-paca.ts (AMP, Région Sud, Dept13)

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

// ── e-marchespublics.com — 337 AO vérifié ──────────────────────────────────

export async function scanEMarches(department: string): Promise<Tender[]> {
  const deptConfig = getDeptConfig(department)
  // URL vérifiée : e-marchespublics.com/appel-offre/bouches-du-rhône
  const deptSlug: Record<string, string> = {
    '13': 'bouches-du-rh%C3%B4ne',
  }
  const slug = deptSlug[department] || department
  const url = `https://www.e-marchespublics.com/appel-offre/${slug}`

  logger.info(`[platforms:EMarches] Scanning department ${department}`)

  try {
    const response = await fetchWithRetry(url)
    if (!response.ok) {
      logger.error(`[platforms:EMarches] HTTP ${response.status} for dept ${department}`)
      return []
    }

    const html = await response.text()
    const tenders: Tender[] = []

    // Match table rows or avis blocks
    const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
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

      // Skip attribués
      const titleLower = title.toLowerCase()
      if (titleLower.includes('attribué') || titleLower.includes('[attribue]')) continue

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
        : `https://www.e-marchespublics.com${link}`

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

    logger.info(`[platforms:EMarches] Found ${tenders.length} tenders in dept ${department}`)
    return tenders
  } catch (err) {
    logger.error(`[platforms:EMarches] Failed for dept ${department}`, { error: err })
    return []
  }
}

// ── francemarches.com — 596 AO vérifié ──────────────────────────────────────

export async function scanFranceMarches(department: string): Promise<Tender[]> {
  const deptConfig = getDeptConfig(department)
  const deptSlug: Record<string, string> = {
    '13': 'bouches-du-rhone',
  }
  const slug = deptSlug[department] || department
  const url = `https://www.francemarches.com/appels-offre/${slug}`

  logger.info(`[platforms:FranceMarches] Scanning department ${department}`)

  try {
    const response = await fetchWithRetry(url)
    if (!response.ok) {
      logger.error(`[platforms:FranceMarches] HTTP ${response.status} for dept ${department}`)
      return []
    }

    const html = await response.text()
    const tenders: Tender[] = []

    // francemarches.com uses card/list layout
    const rowPattern = /<(?:tr|div|article|li)[^>]*>([\s\S]*?)<\/(?:tr|div|article|li)>/gi
    const linkPattern = /<a[^>]*href="([^"]*)"[^>]*>\s*([\s\S]*?)\s*<\/a>/i
    const datePattern = /(\d{2}[/.-]\d{2}[/.-]\d{4})/g
    const buyerPattern =
      /(?:acheteur|organisme|entité|commanditaire|pouvoir adjudicateur)[^<]*?(?:<[^>]*>)?\s*([^<]{3,80})/i
    const budgetPattern = /(\d[\d\s]*)\s*€/

    let rowMatch: RegExpExecArray | null
    while ((rowMatch = rowPattern.exec(html)) !== null) {
      const row = rowMatch[1]

      const linkMatch = linkPattern.exec(row)
      if (!linkMatch) continue

      const link = linkMatch[1]
      const title = linkMatch[2].replace(/<[^>]*>/g, '').trim()
      if (!title || title.length < 10) continue

      const titleLower = title.toLowerCase()
      if (titleLower.includes('attribué') || titleLower.includes('terminé')) continue

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
      const buyer = buyerMatch ? buyerMatch[1].replace(/<[^>]*>/g, '').trim() : undefined

      const budgetMatch = budgetPattern.exec(row)
      const budget = budgetMatch
        ? parseInt(budgetMatch[1].replace(/\s/g, ''), 10) || undefined
        : undefined

      const fullUrl = link.startsWith('http')
        ? link
        : `https://www.francemarches.com${link}`

      tenders.push({
        id: generateId('fm', `${department}_${link}`),
        title,
        city: '',
        source: 'francemarches.com',
        source_id: generateId('fm', link),
        publication_date: publicationDate,
        deadline,
        description: title,
        url: fullUrl,
        estimated_budget: budget,
        category: 'BTP',
        department: deptConfig.code,
        region: deptConfig.region,
        buyer,
        synced_at: nowISO(),
      })
    }

    logger.info(`[platforms:FranceMarches] Found ${tenders.length} tenders in dept ${department}`)
    return tenders
  } catch (err) {
    logger.error(`[platforms:FranceMarches] Failed for dept ${department}`, { error: err })
    return []
  }
}

// ── marchesonline.com — compte gratuit, login requis ────────────────────────

export async function scanMarchesOnline(department: string): Promise<Tender[]> {
  const deptConfig = getDeptConfig(department)
  const deptSlug: Record<string, string> = {
    '13': 'bouches-du-rhone-D13',
  }
  const slug = deptSlug[department] || `D${department}`
  const url = `https://www.marchesonline.com/appels-offres/departement/${slug}`

  logger.info(`[platforms:MarchesOnline] Scanning department ${department}`)

  try {
    const response = await fetchWithRetry(url)
    if (!response.ok) {
      // Expected: 403 or redirect to login — site requires free account
      logger.warn(`[platforms:MarchesOnline] HTTP ${response.status} — login may be required`)
      return []
    }

    const html = await response.text()

    // Check if we got a login page instead of results
    if (html.includes('Connexion') && html.includes('mot de passe') && !html.includes('appel-offre')) {
      logger.info(`[platforms:MarchesOnline] Login page detected — skipping (requires account)`)
      return []
    }

    const tenders: Tender[] = []

    const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
    const linkPattern = /<a[^>]*href="([^"]*)"[^>]*>\s*([\s\S]*?)\s*<\/a>/i
    const datePattern = /(\d{2}[/.-]\d{2}[/.-]\d{4})/g

    let rowMatch: RegExpExecArray | null
    while ((rowMatch = rowPattern.exec(html)) !== null) {
      const row = rowMatch[1]

      const linkMatch = linkPattern.exec(row)
      if (!linkMatch) continue

      const link = linkMatch[1]
      const title = linkMatch[2].replace(/<[^>]*>/g, '').trim()
      if (!title || title.length < 10) continue

      const titleLower = title.toLowerCase()
      if (titleLower.includes('attribué')) continue

      const dates: string[] = []
      let dateMatch: RegExpExecArray | null
      while ((dateMatch = datePattern.exec(row)) !== null) {
        dates.push(dateMatch[1])
      }

      const deadline = dates[0]
        ? dates[0].replace(/(\d{2})[/.-](\d{2})[/.-](\d{4})/, '$3-$2-$1')
        : ''

      const fullUrl = link.startsWith('http')
        ? link
        : `https://www.marchesonline.com${link}`

      tenders.push({
        id: generateId('mol', `${department}_${link}`),
        title,
        city: '',
        source: 'marchesonline.com',
        source_id: generateId('mol', link),
        publication_date: nowISO().split('T')[0],
        deadline,
        description: title,
        url: fullUrl,
        category: 'BTP',
        department: deptConfig.code,
        region: deptConfig.region,
        synced_at: nowISO(),
      })
    }

    logger.info(`[platforms:MarchesOnline] Found ${tenders.length} tenders in dept ${department}`)
    return tenders
  } catch (err) {
    logger.error(`[platforms:MarchesOnline] Failed for dept ${department}`, { error: err })
    return []
  }
}

// ── bailleurs-sociaux.marches-publics.info — HLM vérifié ────────────────────

export async function scanBailleursSociaux(department: string): Promise<Tender[]> {
  const deptConfig = getDeptConfig(department)
  const url = `https://bailleurs-sociaux.marches-publics.info/?type=ao&dept=${department}`

  logger.info(`[platforms:HLM] Scanning bailleurs-sociaux.marches-publics.info for dept ${department}`)

  try {
    const response = await fetchWithRetry(url)
    if (!response.ok) {
      logger.error(`[platforms:HLM] HTTP ${response.status} for dept ${department}`)
      return []
    }

    const html = await response.text()
    const tenders: Tender[] = []

    const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
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

      const titleLower = title.toLowerCase()
      if (titleLower.includes('attribué') || titleLower.includes('[attribue]')) continue

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
        : `https://bailleurs-sociaux.marches-publics.info${link}`

      tenders.push({
        id: generateId('hlm', `${department}_${link}`),
        title,
        city: '',
        source: 'Bailleurs sociaux (HLM)',
        source_id: generateId('hlm', link),
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

    logger.info(`[platforms:HLM] Found ${tenders.length} tenders in dept ${department}`)
    return tenders
  } catch (err) {
    logger.error(`[platforms:HLM] Failed for dept ${department}`, { error: err })
    return []
  }
}

// ── achatpublic.com — plateforme de dématérialisation collectivités ─────────

export async function scanAchatPublic(department: string): Promise<Tender[]> {
  const deptConfig = getDeptConfig(department)

  // URL vérifiée : recherche consultations par département
  const url = `https://www.achatpublic.com/sdm/ent2/gen/rechercheCsl.action?dept=${department}`

  logger.info(`[platforms:AchatPublic] Scanning department ${department}`)

  try {
    const response = await fetchWithRetry(url)
    if (!response.ok) {
      logger.error(`[platforms:AchatPublic] HTTP ${response.status} for dept ${department}`)
      return []
    }

    const html = await response.text()
    const tenders: Tender[] = []

    // achatpublic.com uses table rows for consultation listings
    const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
    const linkPattern = /<a[^>]*href="([^"]*)"[^>]*>\s*([\s\S]*?)\s*<\/a>/i
    const datePattern = /(\d{2}[/.-]\d{2}[/.-]\d{4})/g
    const buyerPattern =
      /(?:acheteur|organisme|entité|pouvoir\s*adjudicateur|collectivité)[^<]*?(?:<[^>]*>)?\s*([^<]{3,80})/i

    let rowMatch: RegExpExecArray | null
    while ((rowMatch = rowPattern.exec(html)) !== null) {
      const row = rowMatch[1]

      const linkMatch = linkPattern.exec(row)
      if (!linkMatch) continue

      const link = linkMatch[1]
      const title = linkMatch[2].replace(/<[^>]*>/g, '').trim()
      if (!title || title.length < 10) continue

      const titleLower = title.toLowerCase()
      if (titleLower.includes('attribué') || titleLower.includes('[attribue]')) continue

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
        : `https://www.achatpublic.com${link}`

      tenders.push({
        id: generateId('ap', `${department}_${link}`),
        title,
        city: '',
        source: 'achatpublic.com',
        source_id: generateId('ap', link),
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

    // Fallback: card/div layout
    if (tenders.length === 0) {
      const cardPattern =
        /<(?:div|article|li)[^>]*class="[^"]*(?:consultation|avis|marche|result|annonce)[^"]*"[^>]*>([\s\S]*?)(?:<\/(?:div|article|li)>){1,3}/gi

      let cardMatch: RegExpExecArray | null
      while ((cardMatch = cardPattern.exec(html)) !== null) {
        const block = cardMatch[1]
        const linkMatch = linkPattern.exec(block)
        if (!linkMatch) continue

        const link = linkMatch[1]
        const title = linkMatch[2].replace(/<[^>]*>/g, '').trim()
        if (!title || title.length < 10) continue

        const titleLower = title.toLowerCase()
        if (titleLower.includes('attribué')) continue

        const fullUrl = link.startsWith('http')
          ? link
          : `https://www.achatpublic.com${link}`

        tenders.push({
          id: generateId('ap', `${department}_card_${link}`),
          title,
          city: '',
          source: 'achatpublic.com',
          source_id: generateId('ap', link),
          publication_date: nowISO().split('T')[0],
          deadline: '',
          description: title,
          url: fullUrl,
          category: 'BTP',
          department: deptConfig.code,
          region: deptConfig.region,
          synced_at: nowISO(),
        })
      }
    }

    logger.info(`[platforms:AchatPublic] Found ${tenders.length} tenders in dept ${department}`)
    return tenders
  } catch (err) {
    logger.error(`[platforms:AchatPublic] Failed for dept ${department}`, { error: err })
    return []
  }
}

// ── Aggregate scanner ───────────────────────────────────────────────────────

export async function scanAllPlatforms(department: string): Promise<Tender[]> {
  logger.info(`[platforms] Starting parallel scan for department ${department}`)
  const start = Date.now()

  const results = await Promise.allSettled([
    scanEMarches(department),
    scanFranceMarches(department),
    scanMarchesOnline(department),
    scanBailleursSociaux(department),
    scanAchatPublic(department),
  ])

  const tenders: Tender[] = []
  const sources = ['EMarches', 'FranceMarches', 'MarchesOnline', 'BailleursSociaux', 'AchatPublic']

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
