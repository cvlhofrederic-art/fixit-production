// ── Scanner de marchés publics — BOAMP + TED + BASE.gov ─────────────────────
// Fetch, normalise et stocke les marchés depuis les APIs publiques officielles.
// Pas de scraping (fragile sur serverless) — uniquement des APIs JSON/XML ouvertes.

import { logger } from './logger'
import { METIER_CPV_MAP, findMetiersByText, findMetiersByCPV } from './marches-cpv-mapping'
import { scoreMarche, type ScoringInput, type ScoringPrefs, type ScoringResult } from './marches-scorer'

export interface ScannedMarche {
  source: 'boamp' | 'ted' | 'base_gov'
  sourceId: string
  sourceUrl: string
  title: string
  description: string
  cpvCodes: string[]
  buyer: string
  location: string
  country: 'FR' | 'PT'
  budgetMin?: number
  budgetMax?: number
  deadline?: string
  publishedAt: string
  category?: string
  lotNumber?: string
  procedureType?: string
}

export interface EnrichedMarche extends ScannedMarche {
  scoring?: ScoringResult
  aiSummary?: string
}

// ── Département lookup pour filtrage géo ────────────────────────────────────
const CITY_TO_DEPT: Record<string, string> = {
  'marseille': '13', 'aix-en-provence': '13', 'aubagne': '13', 'la ciotat': '13',
  'arles': '13', 'martigues': '13', 'salon-de-provence': '13', 'istres': '13',
  'toulon': '83', 'nice': '06', 'cannes': '06', 'antibes': '06', 'avignon': '84',
  'paris': '75', 'lyon': '69', 'toulouse': '31', 'bordeaux': '33', 'lille': '59',
  'nantes': '44', 'strasbourg': '67', 'montpellier': '34', 'rennes': '35',
  'grenoble': '38', 'saint-étienne': '42', 'nanterre': '92', 'créteil': '94',
  'bobigny': '93', 'versailles': '78', 'evry': '91', 'cergy': '95', 'melun': '77',
}

/** Build BOAMP keyword filter from metier keywords */
function buildBoampKeywordFilter(metiers: string[]): string {
  const allKeywords: string[] = []
  for (const metier of metiers) {
    const mapping = METIER_CPV_MAP[metier]
    if (mapping) {
      allKeywords.push(...mapping.keywords)
    }
  }
  // Deduplicate and take top 15 (API URL length limit)
  const unique = [...new Set(allKeywords)].slice(0, 15)
  if (unique.length === 0) return ''
  return unique.map(kw => `objet LIKE '%${kw}%'`).join(' OR ')
}

// ══════════════════════════════════════════════════════════════════════════════
// BOAMP — Bulletin Officiel des Annonces de Marchés Publics (France)
// API : https://www.boamp.fr/api/explore/v2.1/catalog/datasets/boamp/records
// 1.65M+ avis, mise à jour quotidienne, données temps réel
// ══════════════════════════════════════════════════════════════════════════════

async function fetchBOAMP(daysBack: number = 2, metiers: string[] = [], location?: string): Promise<ScannedMarche[]> {
  const results: ScannedMarche[] = []

  try {
    const dateFrom = new Date()
    dateFrom.setDate(dateFrom.getDate() - daysBack)
    const dateStr = dateFrom.toISOString().split('T')[0]

    // Build WHERE clause
    const whereParts: string[] = []

    // Date filter (dateparution is a proper date type, requires date'' syntax)
    whereParts.push(`dateparution>=date'${dateStr}'`)

    // Keyword filter from metiers
    const kwFilter = buildBoampKeywordFilter(metiers)
    if (kwFilter) {
      whereParts.push(`(${kwFilter})`)
    }

    // Geo filter by département code
    if (location) {
      const dept = CITY_TO_DEPT[location.toLowerCase()]
      if (dept) {
        whereParts.push(`code_departement:'${dept}'`)
      }
    }

    const whereClause = whereParts.join(' AND ')
    const selectFields = 'idweb,objet,dateparution,datelimitereponse,nomacheteur,code_departement,url_avis,nature_libelle,famille_libelle'

    const url = `https://www.boamp.fr/api/explore/v2.1/catalog/datasets/boamp/records?where=${encodeURIComponent(whereClause)}&order_by=dateparution desc&limit=100&select=${selectFields}`

    logger.info(`[scanner] BOAMP query: ${whereClause}`)

    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(20000),
    })

    if (!res.ok) {
      logger.warn(`[scanner] BOAMP API returned ${res.status}`)
      // Retry without keyword filter (broader search)
      if (kwFilter) {
        logger.info('[scanner] BOAMP: retrying without keyword filter...')
        return fetchBOAMP(daysBack, [], location)
      }
      return results
    }

    const data = await res.json()
    const records = data.results || []

    for (const r of records) {
      if (!r.objet) continue

      // Parse code_departement (array field)
      const depts = Array.isArray(r.code_departement)
        ? r.code_departement
        : r.code_departement ? [String(r.code_departement)] : []

      const locationStr = depts.length > 0
        ? `Dept. ${depts.join(', ')}`
        : 'France'

      results.push({
        source: 'boamp',
        sourceId: `boamp-${r.idweb || Math.random().toString(36).slice(2)}`,
        sourceUrl: r.url_avis || (r.idweb ? `https://www.boamp.fr/pages/avis/?q=idweb:${r.idweb}` : 'https://www.boamp.fr'),
        title: String(r.objet || '').slice(0, 500),
        description: String(r.objet || ''),
        cpvCodes: [], // BOAMP uses descripteur_code (internal), not CPV
        buyer: String(r.nomacheteur || 'Non précisé'),
        location: locationStr,
        country: 'FR',
        deadline: r.datelimitereponse || undefined,
        publishedAt: r.dateparution || new Date().toISOString(),
        procedureType: r.nature_libelle || undefined,
        category: r.famille_libelle || undefined,
      })
    }

    logger.info(`[scanner] BOAMP: ${results.length} marchés récupérés (total_count: ${data.total_count || '?'})`)
  } catch (err) {
    logger.error('[scanner] BOAMP fetch error:', err)
  }

  return results
}

// ══════════════════════════════════════════════════════════════════════════════
// TED — Tenders Electronic Daily (Europe)
// Uses ted.europa.eu search API for FR/PT construction tenders
// ══════════════════════════════════════════════════════════════════════════════

async function fetchTED(daysBack: number = 2, country: 'FR' | 'PT' = 'FR', metiers: string[] = []): Promise<ScannedMarche[]> {
  const results: ScannedMarche[] = []

  try {
    const dateFrom = new Date()
    dateFrom.setDate(dateFrom.getDate() - daysBack)
    const dateStr = dateFrom.toISOString().split('T')[0]

    const countryCode = country === 'FR' ? 'FRA' : 'PRT'

    // Build CPV filter from metiers (TED uses real CPV codes)
    let cpvFilter = ''
    if (metiers.length > 0) {
      const cpvCodes: string[] = []
      for (const m of metiers) {
        const mapping = METIER_CPV_MAP[m]
        if (mapping) cpvCodes.push(...mapping.cpv.map(c => c.substring(0, 5)))
      }
      const uniqueCpv = [...new Set(cpvCodes)].slice(0, 10)
      if (uniqueCpv.length > 0) {
        cpvFilter = ` AND (${uniqueCpv.map(c => `cpv=${c}*`).join(' OR ')})`
      }
    }

    // TED search endpoint (public, no registration needed for basic search)
    const query = encodeURIComponent(`PD>=${dateStr} AND TD=3 AND CY=${countryCode}${cpvFilter}`)
    const url = `https://ted.europa.eu/api/v3.0/notices/search?query=${query}&pageSize=50&pageNum=1&scope=3`

    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      logger.warn(`[scanner] TED API returned ${res.status} for ${country}`)
      return results
    }

    const data = await res.json()
    const notices = data.notices || data.results || data.hits || []

    if (Array.isArray(notices)) {
      for (const n of notices) {
        const title = n.title || n['title-official-language'] || n.TI || ''
        if (!title) continue

        const noticeId = n.id || n['notice-identifier'] || n.docNumber || ''

        results.push({
          source: 'ted',
          sourceId: `ted-${noticeId || Math.random().toString(36).slice(2)}`,
          sourceUrl: noticeId
            ? `https://ted.europa.eu/en/notice/-/detail/${noticeId}`
            : 'https://ted.europa.eu',
          title: String(title).slice(0, 500),
          description: String(n.summary || n.description || title),
          cpvCodes: n.cpvCode ? (Array.isArray(n.cpvCode) ? n.cpvCode : [String(n.cpvCode)]) : [],
          buyer: String(n.buyerName || n['buyer-name'] || n.AA || 'Non précisé'),
          location: String(n.town || n.TW || (country === 'FR' ? 'France' : 'Portugal')),
          country,
          budgetMin: n.totalValue ? Number(n.totalValue) : undefined,
          deadline: n.deadlineDate || n['deadline-receipt-tenders'] || undefined,
          publishedAt: n.publicationDate || n.PD || new Date().toISOString(),
          procedureType: n.procedureType || n.PR || undefined,
        })
      }
    }

    logger.info(`[scanner] TED ${country}: ${results.length} marchés récupérés`)
  } catch (err) {
    logger.error(`[scanner] TED ${country} fetch error:`, err)
  }

  return results
}

// ══════════════════════════════════════════════════════════════════════════════
// BASE.gov — Contratação Pública Portugal
// API : https://www.base.gov.pt/Base4/pt/pesquisa/
// ══════════════════════════════════════════════════════════════════════════════

async function fetchBASEGov(daysBack: number = 2, metiers: string[] = []): Promise<ScannedMarche[]> {
  const results: ScannedMarche[] = []

  try {
    const dateFrom = new Date()
    dateFrom.setDate(dateFrom.getDate() - daysBack)
    const dateStr = dateFrom.toISOString().split('T')[0]

    // Build keyword search from PT keywords
    let searchQuery = ''
    if (metiers.length > 0) {
      const ptKeywords: string[] = []
      for (const m of metiers) {
        const mapping = METIER_CPV_MAP[m]
        if (mapping) ptKeywords.push(...mapping.keywordsPt.slice(0, 3))
      }
      searchQuery = ptKeywords.slice(0, 5).join(' ')
    }

    // BASE.gov search API
    const params = new URLSearchParams({
      type: 'contratos',
      desdedatapublicacao: dateStr,
      query: searchQuery,
      paginacao: '50',
    })
    const url = `https://www.base.gov.pt/Base4/pt/resultados/?${params.toString()}`

    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json, text/html',
        'User-Agent': 'Vitfix-Scanner/1.0',
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      logger.warn(`[scanner] BASE.gov returned ${res.status}`)
      return results
    }

    // BASE.gov may return HTML or JSON depending on endpoint
    const contentType = res.headers.get('content-type') || ''
    if (!contentType.includes('json')) {
      logger.info('[scanner] BASE.gov returned HTML (not JSON API), skipping parse')
      return results
    }

    const data = await res.json()
    const items = data.items || data.results || (Array.isArray(data) ? data : [])

    for (const item of items) {
      if (!item.objectoBrief && !item.descricao) continue

      results.push({
        source: 'base_gov',
        sourceId: `basegov-${item.id || Math.random().toString(36).slice(2)}`,
        sourceUrl: item.id
          ? `https://www.base.gov.pt/Base4/pt/detalhe/?type=contratos&id=${item.id}`
          : 'https://www.base.gov.pt',
        title: String(item.objectoBrief || item.descricao || '').slice(0, 500),
        description: String(item.objectoBrief || item.descricao || ''),
        cpvCodes: item.cpv ? String(item.cpv).split(',').map((c: string) => c.trim()) : [],
        buyer: String(item.adjudicante || item.entidade || 'Non précisé'),
        location: String(item.localExecucao || 'Portugal'),
        country: 'PT',
        budgetMin: item.precoContratual ? Number(item.precoContratual) : undefined,
        deadline: item.dataFimContrato || undefined,
        publishedAt: item.dataCelebracaoContrato || new Date().toISOString(),
        procedureType: item.tipoProcedimento || undefined,
      })
    }

    logger.info(`[scanner] BASE.gov: ${results.length} marchés récupérés`)
  } catch (err) {
    logger.error('[scanner] BASE.gov fetch error:', err)
  }

  return results
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN SCANNER — Orchestre tout
// ══════════════════════════════════════════════════════════════════════════════

export interface ScanOptions {
  country?: 'FR' | 'PT' | 'both'
  daysBack?: number
  metiers?: string[]
  location?: string
  budgetMin?: number
  budgetMax?: number
}

export interface ScanResult {
  marches: EnrichedMarche[]
  meta: {
    totalScanned: number
    totalFiltered: number
    sources: { boamp: number; ted: number; base_gov: number }
    scannedAt: string
    daysBack: number
  }
}

export async function scanMarches(options: ScanOptions = {}): Promise<ScanResult> {
  const {
    country = 'both',
    daysBack = 2,
    metiers = [],
    location,
    budgetMin,
    budgetMax,
  } = options

  logger.info(`[scanner] Starting scan: country=${country}, daysBack=${daysBack}, metiers=${metiers.join(',')}`)

  // Fetch from all sources in parallel (pass metiers + location for server-side filtering)
  const promises: Promise<ScannedMarche[]>[] = []

  if (country === 'FR' || country === 'both') {
    promises.push(fetchBOAMP(daysBack, metiers, location))
    promises.push(fetchTED(daysBack, 'FR', metiers))
  }
  if (country === 'PT' || country === 'both') {
    promises.push(fetchBASEGov(daysBack, metiers))
    promises.push(fetchTED(daysBack, 'PT', metiers))
  }

  const rawResults = await Promise.allSettled(promises)
  const allMarches: ScannedMarche[] = []
  const sourceCounts = { boamp: 0, ted: 0, base_gov: 0 }

  for (const result of rawResults) {
    if (result.status === 'fulfilled') {
      for (const m of result.value) {
        allMarches.push(m)
        sourceCounts[m.source]++
      }
    }
  }

  logger.info(`[scanner] Total scanned: ${allMarches.length} (BOAMP: ${sourceCounts.boamp}, TED: ${sourceCounts.ted}, BASE.gov: ${sourceCounts.base_gov})`)

  // Deduplicate by title similarity
  const deduplicated = deduplicateMarches(allMarches)

  // Score if metiers provided
  let enriched: EnrichedMarche[]

  if (metiers.length > 0) {
    const prefs: ScoringPrefs = { metiers, location, budgetMin, budgetMax }

    enriched = deduplicated.map(m => {
      const input: ScoringInput = {
        title: m.title,
        description: m.description,
        cpvCodes: m.cpvCodes,
        location: m.location,
        budget: m.budgetMin,
        country: m.country,
      }
      const scoring = scoreMarche(input, prefs)
      return { ...m, scoring }
    })
      // Threshold 20 (not 40) because BOAMP results already keyword-filtered server-side
      // and BOAMP doesn't expose CPV codes so CPV score is always 0
      .filter(m => m.scoring!.scoreTotal >= 20)
      .sort((a, b) => (b.scoring?.scoreTotal || 0) - (a.scoring?.scoreTotal || 0))
  } else {
    // No filtering, return all with basic text-based scoring
    enriched = deduplicated.map(m => {
      const textMatches = findMetiersByText(`${m.title} ${m.description}`, m.country)
      const cpvMatches = m.cpvCodes.flatMap(c => findMetiersByCPV(c))
      const allMatches = [...new Set([...textMatches.map(t => t.metier), ...cpvMatches])]

      return {
        ...m,
        scoring: {
          scoreTotal: textMatches.length > 0 ? Math.round(textMatches[0].score * 0.5 + 30) : 30,
          scoreCPV: cpvMatches.length > 0 ? 20 : 0,
          scoreKeywords: textMatches.length > 0 ? Math.round(textMatches[0].score * 0.3) : 0,
          scoreGeo: 8,
          scoreBudget: 8,
          matchedMetiers: allMatches,
          priority: 'medium' as const,
          recommendation: 'review' as const,
        },
      }
    })
  }

  return {
    marches: enriched,
    meta: {
      totalScanned: allMarches.length,
      totalFiltered: enriched.length,
      sources: sourceCounts,
      scannedAt: new Date().toISOString(),
      daysBack,
    },
  }
}

// ── Dedup by title similarity ───────────────────────────────────────────────
function deduplicateMarches(marches: ScannedMarche[]): ScannedMarche[] {
  const seen = new Map<string, ScannedMarche>()

  for (const m of marches) {
    // Normalize title for comparison
    const key = m.title.toLowerCase().replace(/[^a-zàâäéèêëïîôùûüÿçœæ0-9]/g, '').slice(0, 80)
    if (!seen.has(key)) {
      seen.set(key, m)
    }
  }

  return [...seen.values()]
}
