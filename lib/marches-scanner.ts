// ── Scanner de marchés publics — BOAMP + TED + BASE.gov ─────────────────────
// Fetch, normalise et stocke les marchés depuis les APIs publiques officielles.
// Pas de scraping (fragile sur serverless) — uniquement des APIs JSON/XML ouvertes.

import { logger } from './logger'
import { findMetiersByText, findMetiersByCPV } from './marches-cpv-mapping'
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

// ══════════════════════════════════════════════════════════════════════════════
// BOAMP — Bulletin Officiel des Annonces de Marchés Publics (France)
// API : https://boamp.fr/pages/donnees-essentielles/
// ══════════════════════════════════════════════════════════════════════════════

async function fetchBOAMP(daysBack: number = 2): Promise<ScannedMarche[]> {
  const results: ScannedMarche[] = []

  try {
    // BOAMP open data API — avis de marchés publiés
    const dateFrom = new Date()
    dateFrom.setDate(dateFrom.getDate() - daysBack)
    const dateStr = dateFrom.toISOString().split('T')[0]

    // Use BOAMP DECP (Données Essentielles de la Commande Publique) API
    const url = `https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/decp_augmente/records?where=datePublicationDonnees>='${dateStr}'&order_by=datePublicationDonnees desc&limit=100&select=id,objet,codeCPV,lieuExecution_nom,dateNotification,montant,acheteur_nom,nature`

    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      logger.warn(`[scanner] BOAMP API returned ${res.status}`)
      return results
    }

    const data = await res.json()
    const records = data.results || data.records || []

    for (const r of records) {
      const fields = r.fields || r
      if (!fields.objet) continue

      results.push({
        source: 'boamp',
        sourceId: `boamp-${fields.id || fields.uid || Math.random().toString(36).slice(2)}`,
        sourceUrl: fields.id
          ? `https://www.boamp.fr/avis/detail/${fields.id}`
          : 'https://www.boamp.fr',
        title: String(fields.objet || '').slice(0, 500),
        description: String(fields.objet || ''),
        cpvCodes: fields.codeCPV ? String(fields.codeCPV).split(',').map((c: string) => c.trim().replace(/-.*/,'')) : [],
        buyer: String(fields.acheteur_nom || fields.acheteurNom || 'Non précisé'),
        location: String(fields.lieuExecution_nom || fields.lieuExecutionNom || 'France'),
        country: 'FR',
        budgetMin: fields.montant ? Number(fields.montant) : undefined,
        deadline: fields.dateNotification || undefined,
        publishedAt: fields.datePublicationDonnees || new Date().toISOString(),
        procedureType: fields.nature || undefined,
      })
    }

    logger.info(`[scanner] BOAMP: ${results.length} marchés récupérés`)
  } catch (err) {
    logger.error('[scanner] BOAMP fetch error:', err)
  }

  return results
}

// ══════════════════════════════════════════════════════════════════════════════
// TED — Tenders Electronic Daily (Europe)
// API : https://ted.europa.eu/en/simap/api
// ══════════════════════════════════════════════════════════════════════════════

async function fetchTED(daysBack: number = 2, country: 'FR' | 'PT' = 'FR'): Promise<ScannedMarche[]> {
  const results: ScannedMarche[] = []

  try {
    const dateFrom = new Date()
    dateFrom.setDate(dateFrom.getDate() - daysBack)
    const dateStr = dateFrom.toISOString().split('T')[0]

    const countryCode = country === 'FR' ? 'FRA' : 'PRT'
    // TED open data API (CSV/JSON)
    const url = `https://ted.europa.eu/api/v3.0/notices/search?query=TD=[3] AND CY=[${countryCode}]&fields=title-official-language,summary,cpv-code,town,buyer-name,deadline-receipt-tenders,total-value-currency-eur,notice-identifier&page=1&limit=50&scope=3&sortField=publication-date&sortOrder=desc`

    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      // TED API may require registration or have different endpoints
      // Fallback: use TED open data CSV endpoint
      logger.warn(`[scanner] TED API returned ${res.status}, trying alternate endpoint`)
      return await fetchTEDFallback(daysBack, country)
    }

    const data = await res.json()
    const notices = data.notices || data.results || []

    for (const n of notices) {
      results.push({
        source: 'ted',
        sourceId: `ted-${n['notice-identifier'] || n.id || Math.random().toString(36).slice(2)}`,
        sourceUrl: n['notice-identifier']
          ? `https://ted.europa.eu/en/notice/-/detail/${n['notice-identifier']}`
          : 'https://ted.europa.eu',
        title: String(n['title-official-language'] || n.title || '').slice(0, 500),
        description: String(n.summary || n['title-official-language'] || ''),
        cpvCodes: n['cpv-code'] ? [String(n['cpv-code']).replace(/-.*/,'')] : [],
        buyer: String(n['buyer-name'] || 'Non précisé'),
        location: String(n.town || country === 'FR' ? 'France' : 'Portugal'),
        country,
        budgetMin: n['total-value-currency-eur'] ? Number(n['total-value-currency-eur']) : undefined,
        deadline: n['deadline-receipt-tenders'] || undefined,
        publishedAt: n['publication-date'] || new Date().toISOString(),
        procedureType: n['procedure-type'] || undefined,
      })
    }

    logger.info(`[scanner] TED ${country}: ${results.length} marchés récupérés`)
  } catch (err) {
    logger.error(`[scanner] TED ${country} fetch error:`, err)
  }

  return results
}

// TED fallback — uses the open data portal
async function fetchTEDFallback(daysBack: number, country: 'FR' | 'PT'): Promise<ScannedMarche[]> {
  const results: ScannedMarche[] = []

  try {
    const dateFrom = new Date()
    dateFrom.setDate(dateFrom.getDate() - daysBack)
    const dateStr = dateFrom.toISOString().split('T')[0]

    const countryCode = country === 'FR' ? 'FR' : 'PT'
    // Use data.europa.eu SPARQL/search endpoint
    const url = `https://data.europa.eu/api/hub/search/datasets?q=ted+${countryCode}+procurement&limit=20&sort=modified+desc`

    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      logger.warn(`[scanner] TED fallback returned ${res.status}`)
      return results
    }

    // This endpoint returns dataset metadata, not individual tenders
    // In production, use TED eSender API with registration
    logger.info(`[scanner] TED fallback: API requires registration for full access`)
  } catch (err) {
    logger.error('[scanner] TED fallback error:', err)
  }

  return results
}

// ══════════════════════════════════════════════════════════════════════════════
// BASE.gov — Contratação Pública Portugal
// https://www.base.gov.pt/base4
// ══════════════════════════════════════════════════════════════════════════════

async function fetchBASEGov(daysBack: number = 2): Promise<ScannedMarche[]> {
  const results: ScannedMarche[] = []

  try {
    const dateFrom = new Date()
    dateFrom.setDate(dateFrom.getDate() - daysBack)
    const dateStr = dateFrom.toISOString().split('T')[0]

    // BASE.gov open data API
    const url = `https://www.base.gov.pt/Base4/pt/resultados/?tipo=anuncios&desdedatapublicacao=${dateStr}&paginacao=50&ordenacao=datapublicacao desc`

    const res = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Vitfix-Scanner/1.0' },
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      // BASE.gov may require different endpoint
      logger.warn(`[scanner] BASE.gov returned ${res.status}`)
      return results
    }

    const data = await res.json()
    const items = data.items || data.results || data || []

    if (Array.isArray(items)) {
      for (const item of items) {
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

  // Fetch from all sources in parallel
  const promises: Promise<ScannedMarche[]>[] = []

  if (country === 'FR' || country === 'both') {
    promises.push(fetchBOAMP(daysBack))
    promises.push(fetchTED(daysBack, 'FR'))
  }
  if (country === 'PT' || country === 'both') {
    promises.push(fetchBASEGov(daysBack))
    promises.push(fetchTED(daysBack, 'PT'))
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
      .filter(m => m.scoring!.scoreTotal >= 40)
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
