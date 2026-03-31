// ── Mairie Website Scanner — Scrapes municipal websites for BTP tenders ──────

import type { Commune, Tender } from '../types'
import { SCANNER_CONFIG, MARCHES_PAGE_KEYWORDS } from '../config'
import { logger } from '@/lib/logger'
import { checkRobotsTxt } from '@/lib/marches-sync'

// ── Regex patterns for tender extraction ─────────────────────────────────────

const TENDER_LINK_RE =
  /<a[^>]*href="([^"]*)"[^>]*>([^<]*(?:march|appel|consultation|travaux|MAPA)[^<]*)<\/a>/gi

const TENDER_HEADING_RE =
  /<h[2-4][^>]*>([^<]*(?:march|appel|consultation|travaux)[^<]*)<\/h[2-4]>/gi

const TENDER_LIST_RE =
  /<li[^>]*>([^<]*(?:march|appel|consultation|travaux)[^<]*)<\/li>/gi

const TENDER_TABLE_RE =
  /<td[^>]*>([^<]*(?:march|appel|consultation|travaux)[^<]*)<\/td>/gi

const DATE_RE = /(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/
const BUDGET_RE = /(\d[\d\s]*[\d])\s*€/

// ── Helpers ──────────────────────────────────────────────────────────────────

function hashString(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    hash = ((hash << 5) - hash + ch) | 0
  }
  return Math.abs(hash).toString(36)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function resolveUrl(base: string, href: string): string {
  try {
    return new URL(href, base).toString()
  } catch {
    return href
  }
}

function parseDeadline(text: string): string | null {
  const match = text.match(DATE_RE)
  if (!match) return null
  const raw = match[1]
  const parts = raw.split(/[\/-]/)
  if (parts.length !== 3) return null

  const day = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10)
  let year = parseInt(parts[2], 10)
  if (year < 100) year += 2000

  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function parseBudget(text: string): number | null {
  const match = text.match(BUDGET_RE)
  if (!match) return null
  const cleaned = match[1].replace(/\s/g, '')
  const value = parseInt(cleaned, 10)
  return isNaN(value) ? null : value
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(
      () => controller.abort(),
      SCANNER_CONFIG.request_timeout_ms
    )

    const res = await fetch(url, {
      headers: {
        'User-Agent': SCANNER_CONFIG.user_agent,
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!res.ok) return null

    const contentType = res.headers.get('content-type') || ''
    if (!contentType.includes('text/html') && !contentType.includes('xhtml')) {
      return null
    }

    return await res.text()
  } catch {
    return null
  }
}

// ── Link discovery ───────────────────────────────────────────────────────────

function findMarchesLinks(html: string, baseUrl: string): string[] {
  const links: string[] = []
  const linkRe = /<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null

  while ((match = linkRe.exec(html)) !== null) {
    const href = match[1]
    const text = match[2].replace(/<[^>]*>/g, '').toLowerCase()
    const hrefLower = href.toLowerCase()

    const isMatch = MARCHES_PAGE_KEYWORDS.some(
      (kw) => hrefLower.includes(kw) || text.includes(kw)
    )

    if (isMatch) {
      const resolved = resolveUrl(baseUrl, href)
      if (resolved !== baseUrl && !links.includes(resolved)) {
        links.push(resolved)
      }
    }
  }

  return links.slice(0, SCANNER_CONFIG.max_pages_per_site)
}

// ── False positive filter — reject info pages, news, arrêtés, etc. ───────────

// Titles that match these patterns are NOT real tenders — they're info pages
const FALSE_POSITIVE_PATTERNS = [
  /^infos?\s+travaux/i,
  /^points?\s+travaux/i,
  /^flash\s+travaux/i,
  /^arr[êe]t[ée]s?\s+(municipaux|travaux|pr[ée]fectoral)/i,
  /^coupure\s+d[''e]/i,
  /^r[èe]glementation/i,
  /^d[ée]marches?\s+(en ligne|&|et|administratives)/i,
  /^formulaires?\s+/i,
  /^urbanisme/i,
  /^cadastre/i,
  /^allo\s+/i,
  /^rappel\s*:/i,
  /^danger/i,
  /en\s+transition/i,
  /^t[ée]l[ée]charger\s+le\s+tableau/i,
  /travaux\s+(programm|r[ée]alis|en\s+cours\s+d[''e]|à partir|depuis|prévus)/i,
  /l[''']acc[èe]s\s+(au|à|sera)/i,
  /r[èe]glementation\s+d/i,
  /à\s+l[''']ensemble\s+des\s+annonces/i,
  /march[ée]s\s+publics\s+(et\s+travaux|de\s+la\s+municipalit)/i,
  /MARCHES_DE_TRAVAUX_DE_/i,
  /travaux\s+et\s+am[ée]nagements$/i,
  /d[ée]but\s+des\s+travaux\s+sur/i,
  /voir\s+la\s+liste\s+des\s+march/i,
  /portail\s+march/i,
  /t[ée]l[ée]chargement\s+du\s+dossier/i,
]

// A real marché must have at least ONE of these signals in title or context
const REAL_TENDER_SIGNALS = [
  /march[ée]\s+(de\s+travaux|public|adapt|proc[ée]dure|fourniture)/i,
  /appel\s+(d[''e]\s*offre|à\s+candidature|à\s+concurrence)/i,
  /consultation\s+(en\s+cours|des\s+entreprises|publique|n[°o])/i,
  /lot\s+\d/i,                    // "Lot 1", "Lot 03"
  /mapa/i,                         // Marché à procédure adaptée
  /dce|dossier\s+de\s+consultation/i,
  /proc[ée]dure\s+(adapt|ouverte|restreinte|n[ée]goci)/i,
  /date\s+limite/i,
  /remise\s+des\s+(offres|candidatures|plis)/i,
  /avis\s+d[''e]\s*(march|attribution|appel)/i,
  /montant|budget|estimation/i,
  /r[ée]f[ée]rence\s*:\s*\d/i,
  /\d[\d\s]*€/,                    // Budget amount
  /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/, // Date (deadline)
]

function isRealTender(title: string, context: string): boolean {
  const titleClean = title.replace(/&#\w+;/g, ' ').replace(/<[^>]*>/g, '')

  // Reject known false positive patterns
  for (const pattern of FALSE_POSITIVE_PATTERNS) {
    if (pattern.test(titleClean)) return false
  }

  // Title too short and generic = noise ("Travaux", "Marchés Publics")
  if (titleClean.replace(/\s/g, '').length < 20) return false

  // Must have at least one real tender signal in title OR context
  const combined = `${titleClean} ${context}`.replace(/&#\w+;/g, ' ')
  for (const signal of REAL_TENDER_SIGNALS) {
    if (signal.test(combined)) return true
  }

  return false
}

// ── Tender extraction from HTML ──────────────────────────────────────────────

interface RawEntry {
  title: string
  href?: string
  context: string // surrounding text for date/budget extraction
}

function extractRawEntries(html: string): RawEntry[] {
  const entries: RawEntry[] = []
  const seen = new Set<string>()
  let match: RegExpExecArray | null

  // Links with tender keywords
  TENDER_LINK_RE.lastIndex = 0
  while ((match = TENDER_LINK_RE.exec(html)) !== null) {
    const title = match[2].trim()
    const key = title.toLowerCase()
    if (!seen.has(key) && title.length > 5) {
      seen.add(key)
      const start = Math.max(0, match.index - 200)
      const end = Math.min(html.length, match.index + match[0].length + 200)
      entries.push({
        title,
        href: match[1],
        context: html.slice(start, end),
      })
    }
  }

  // Headings
  TENDER_HEADING_RE.lastIndex = 0
  while ((match = TENDER_HEADING_RE.exec(html)) !== null) {
    const title = match[1].trim()
    const key = title.toLowerCase()
    if (!seen.has(key) && title.length > 5) {
      seen.add(key)
      const start = Math.max(0, match.index - 200)
      const end = Math.min(html.length, match.index + match[0].length + 500)
      entries.push({
        title,
        context: html.slice(start, end),
      })
    }
  }

  // List items
  TENDER_LIST_RE.lastIndex = 0
  while ((match = TENDER_LIST_RE.exec(html)) !== null) {
    const title = match[1].trim()
    const key = title.toLowerCase()
    if (!seen.has(key) && title.length > 10) {
      seen.add(key)
      const start = Math.max(0, match.index - 200)
      const end = Math.min(html.length, match.index + match[0].length + 200)
      entries.push({
        title,
        context: html.slice(start, end),
      })
    }
  }

  // Table cells
  TENDER_TABLE_RE.lastIndex = 0
  while ((match = TENDER_TABLE_RE.exec(html)) !== null) {
    const title = match[1].trim()
    const key = title.toLowerCase()
    if (!seen.has(key) && title.length > 10) {
      seen.add(key)
      const start = Math.max(0, match.index - 300)
      const end = Math.min(html.length, match.index + match[0].length + 300)
      entries.push({
        title,
        context: html.slice(start, end),
      })
    }
  }

  // Filter: only keep entries that look like real tenders
  return entries.filter(e => isRealTender(e.title, e.context))
}

function mapEntryToTender(
  entry: RawEntry,
  commune: Commune,
  pageUrl: string
): Tender {
  const now = new Date().toISOString()
  const deadline = parseDeadline(entry.context)
  const budget = parseBudget(entry.context)
  const url = entry.href ? resolveUrl(pageUrl, entry.href) : pageUrl
  const id = `mairie-${commune.code_insee}-${hashString(entry.title)}`

  return {
    id,
    title: entry.title,
    city: commune.name,
    source: `mairie-${commune.name}`,
    source_id: id,
    publication_date: now.split('T')[0],
    deadline: deadline || '',
    description: entry.title,
    url,
    estimated_budget: budget ?? undefined,
    category: 'BTP',
    department: commune.department,
    region: commune.region,
    buyer: `Mairie de ${commune.name}`,
    synced_at: now,
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Scans a single commune's website for BTP tender pages.
 * Fetches the homepage, discovers marches/appels pages, extracts entries.
 */
export async function scanCityWebsite(commune: Commune): Promise<Tender[]> {
  if (!commune.website) return []

  const baseUrl = commune.website.replace(/\/+$/, '')

  // Respect robots.txt
  const urlObj = new URL(baseUrl)
  const allowed = await checkRobotsTxt(urlObj.origin, urlObj.pathname)
  if (!allowed) {
    logger.info(`[mairies] Blocked by robots.txt: ${baseUrl}`)
    return []
  }

  logger.info(`[mairies] Scanning ${commune.name} — ${baseUrl}`)

  // Fetch homepage
  const homepageHtml = await fetchPage(baseUrl)
  if (!homepageHtml) {
    logger.warn(`[mairies] Failed to fetch homepage: ${baseUrl}`)
    return []
  }

  // Find links to marches/tender pages
  const marchesLinks = findMarchesLinks(homepageHtml, baseUrl)
  logger.info(
    `[mairies] ${commune.name}: found ${marchesLinks.length} marches page(s)`
  )

  const tenders: Tender[] = []
  const pagesToScan: Array<{ url: string; html: string }> = []

  // If marches links found, fetch them; otherwise scan the homepage directly
  if (marchesLinks.length > 0) {
    for (const link of marchesLinks) {
      await sleep(SCANNER_CONFIG.request_delay_ms)

      const linkAllowed = await checkRobotsTxt(
        new URL(link).origin,
        new URL(link).pathname
      )
      if (!linkAllowed) continue

      const pageHtml = await fetchPage(link)
      if (pageHtml) {
        pagesToScan.push({ url: link, html: pageHtml })
      }
    }
  } else {
    // Scan homepage for inline tender listings
    pagesToScan.push({ url: baseUrl, html: homepageHtml })
  }

  // Extract tenders from collected pages
  for (const page of pagesToScan) {
    const entries = extractRawEntries(page.html)
    for (const entry of entries) {
      tenders.push(mapEntryToTender(entry, commune, page.url))
    }
  }

  logger.info(
    `[mairies] ${commune.name}: extracted ${tenders.length} tender(s)`
  )
  return tenders
}

/**
 * Scans all communes that have a website, with concurrency limiting.
 */
export async function scanAllMairies(
  communes: Commune[]
): Promise<Tender[]> {
  const withWebsite = communes.filter((c) => c.website)
  logger.info(
    `[mairies] Starting scan — ${withWebsite.length}/${communes.length} communes have websites`
  )

  const allTenders: Tender[] = []
  const concurrency = SCANNER_CONFIG.max_concurrent_requests

  // Process in batches of `concurrency`
  for (let i = 0; i < withWebsite.length; i += concurrency) {
    const batch = withWebsite.slice(i, i + concurrency)
    const batchNum = Math.floor(i / concurrency) + 1
    const totalBatches = Math.ceil(withWebsite.length / concurrency)

    logger.info(
      `[mairies] Batch ${batchNum}/${totalBatches} — ${batch.map((c) => c.name).join(', ')}`
    )

    const results = await Promise.allSettled(
      batch.map((commune) => scanCityWebsite(commune))
    )

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allTenders.push(...result.value)
      }
      // Rejected promises are already logged inside scanCityWebsite
    }

    // Delay between batches to avoid hammering
    if (i + concurrency < withWebsite.length) {
      await sleep(SCANNER_CONFIG.request_delay_ms)
    }
  }

  logger.info(`[mairies] Scan complete — ${allTenders.length} tender(s) total`)
  return allTenders
}
