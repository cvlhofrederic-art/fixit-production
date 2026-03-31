// ── Scanner de marchés publics — BOAMP + TED + BASE.gov ─────────────────────
// Fetch, normalise et stocke les marchés depuis les APIs publiques officielles.
// Pas de scraping (fragile sur serverless) — uniquement des APIs JSON/XML ouvertes.

import { logger } from './logger'
import { METIER_CPV_MAP, findMetiersByText, findMetiersByCPV, resolveMetierKeys } from './marches-cpv-mapping'
import { scoreMarche, type ScoringInput, type ScoringPrefs, type ScoringResult } from './marches-scorer'
import { createClient } from '@supabase/supabase-js'

export interface ScannedMarche {
  source: 'boamp' | 'ted' | 'base_gov' | 'marches_online' | 'decp' | 'stored'
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

// Département → départements voisins de la même région (pour augmenter le volume)
const DEPT_REGIONS: Record<string, string[]> = {
  // PACA
  '04': ['04', '05', '06', '13', '83', '84'],
  '05': ['04', '05', '06', '13', '83', '84'],
  '06': ['04', '05', '06', '13', '83', '84'],
  '13': ['04', '05', '06', '13', '83', '84'],
  '83': ['04', '05', '06', '13', '83', '84'],
  '84': ['04', '05', '06', '13', '83', '84'],
  // IDF
  '75': ['75', '77', '78', '91', '92', '93', '94', '95'],
  '77': ['75', '77', '78', '91', '92', '93', '94', '95'],
  '78': ['75', '77', '78', '91', '92', '93', '94', '95'],
  '91': ['75', '77', '78', '91', '92', '93', '94', '95'],
  '92': ['75', '77', '78', '91', '92', '93', '94', '95'],
  '93': ['75', '77', '78', '91', '92', '93', '94', '95'],
  '94': ['75', '77', '78', '91', '92', '93', '94', '95'],
  '95': ['75', '77', '78', '91', '92', '93', '94', '95'],
  // Auvergne-Rhône-Alpes
  '69': ['01', '38', '42', '69', '73', '74'],
  '38': ['01', '38', '42', '69', '73', '74'],
  '42': ['01', '38', '42', '69', '73', '74'],
  // Hauts-de-France
  '59': ['02', '59', '60', '62', '80'],
  '62': ['02', '59', '60', '62', '80'],
  // Occitanie
  '31': ['09', '11', '31', '32', '34', '81', '82'],
  '34': ['09', '11', '31', '32', '34', '81', '82'],
  // Nouvelle-Aquitaine
  '33': ['24', '33', '40', '47', '64'],
  // Bretagne
  '35': ['22', '29', '35', '56'],
  // Pays de la Loire
  '44': ['44', '49', '53', '72', '85'],
  // Grand Est
  '67': ['67', '68', '54', '57', '88'],
}

/** Build BOAMP keyword filter from metier strongKeywords only (high precision) */
function buildBoampKeywordFilter(metiers: string[]): string {
  const allKeywords: string[] = []
  for (const metier of metiers) {
    const mapping = METIER_CPV_MAP[metier]
    if (mapping) {
      // Only use strongKeywords for BOAMP API filter — weak keywords cause false positives
      allKeywords.push(...mapping.strongKeywords)
    }
  }
  // Deduplicate and take top 12 (API URL length limit)
  const unique = [...new Set(allKeywords)].slice(0, 12)
  if (unique.length === 0) return ''
  return unique.map(kw => `objet LIKE '%${kw}%'`).join(' OR ')
}

// ══════════════════════════════════════════════════════════════════════════════
// BOAMP — Bulletin Officiel des Annonces de Marchés Publics (France)
// API : https://www.boamp.fr/api/explore/v2.1/catalog/datasets/boamp/records
// 1.65M+ avis, mise à jour quotidienne, données temps réel
//
// Stratégie : 2 passes
// 1. Recherche ciblée par mots-clés métier dans le titre (objet) — résultats directs
// 2. Recherche large "tous travaux" PACA + scan du champ `donnees` (détail lots)
//    pour trouver les marchés multi-lots avec un lot pertinent au métier
// ══════════════════════════════════════════════════════════════════════════════

/** Extract lot descriptions from BOAMP donnees field (JSON or stringified JSON) */
function extractLotsFromDonnees(donnees: any): { lotNum: string; description: string }[] {
  const lots: { lotNum: string; description: string }[] = []
  if (!donnees) return lots

  const str = typeof donnees === 'string' ? donnees : JSON.stringify(donnees)

  // Pattern 1: "Lot N : description" or "Lot N° X - description"
  const lotPattern = /[Ll]ot\s*(?:n°?\s*)?(\d+)\s*[:\-–]\s*([^"\\]{5,200})/g
  let match: RegExpExecArray | null
  while ((match = lotPattern.exec(str)) !== null) {
    lots.push({ lotNum: match[1], description: match[2].trim() })
  }

  // Pattern 2: "LOT N : description" (uppercase)
  const lotPattern2 = /LOT\s+(\d+)\s*[:\-–]\s*([^"\\]{5,200})/g
  while ((match = lotPattern2.exec(str)) !== null) {
    const exists = lots.some(l => l.lotNum === match![1])
    if (!exists) lots.push({ lotNum: match[1], description: match[2].trim() })
  }

  return lots
}

/** Extract full text from donnees for keyword matching (description, lots, etc.) */
function extractTextFromDonnees(donnees: any): string {
  if (!donnees) return ''
  const str = typeof donnees === 'string' ? donnees : JSON.stringify(donnees)
  // Strip JSON syntax to get raw text content
  return str
    .replace(/[{}\[\]"\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 10000) // Cap at 10k chars to avoid memory issues
}

async function fetchBOAMP(daysBack: number = 2, metiers: string[] = [], location?: string): Promise<ScannedMarche[]> {
  const results: ScannedMarche[] = []
  const seenIds = new Set<string>()

  try {
    const dateFrom = new Date()
    dateFrom.setDate(dateFrom.getDate() - daysBack)
    const dateStr = dateFrom.toISOString().split('T')[0]

    // Build geo filter (shared by both passes)
    let geoFilter = ''
    if (location) {
      const dept = CITY_TO_DEPT[location.toLowerCase()]
      if (dept) {
        const regionDepts = DEPT_REGIONS[dept] || [dept]
        geoFilter = regionDepts.length > 1
          ? `(${regionDepts.map(d => `code_departement:'${d}'`).join(' OR ')})`
          : `code_departement:'${dept}'`
      }
    }

    // ── PASS 1: Keyword-filtered search (fast, targeted) ──────────────────
    const kwFilter = buildBoampKeywordFilter(metiers)
    {
      const whereParts = [`dateparution>=date'${dateStr}'`]
      if (kwFilter) whereParts.push(`(${kwFilter})`)
      if (geoFilter) whereParts.push(geoFilter)

      const selectFields = 'idweb,objet,dateparution,datelimitereponse,nomacheteur,code_departement,url_avis,nature_libelle,famille_libelle'
      const url = `https://www.boamp.fr/api/explore/v2.1/catalog/datasets/boamp/records?where=${encodeURIComponent(whereParts.join(' AND '))}&order_by=dateparution desc&limit=100&select=${selectFields}`

      logger.info(`[scanner] BOAMP pass 1 (keyword): ${whereParts.join(' AND ')}`)

      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(20000),
      })

      if (res.ok) {
        const data = await res.json()
        for (const r of (data.results || [])) {
          if (!r.objet || !r.idweb) continue
          seenIds.add(r.idweb)

          const depts = Array.isArray(r.code_departement) ? r.code_departement : r.code_departement ? [String(r.code_departement)] : []
          results.push({
            source: 'boamp',
            sourceId: `boamp-${r.idweb}`,
            sourceUrl: r.url_avis || `https://www.boamp.fr/pages/avis/?q=idweb:${r.idweb}`,
            title: String(r.objet).slice(0, 500),
            description: String(r.objet),
            cpvCodes: [],
            buyer: String(r.nomacheteur || 'Non précisé'),
            location: depts.length > 0 ? `Dept. ${depts.join(', ')}` : 'France',
            country: 'FR',
            deadline: r.datelimitereponse || undefined,
            publishedAt: r.dateparution || new Date().toISOString(),
            procedureType: r.nature_libelle || undefined,
            category: r.famille_libelle || undefined,
          })
        }
        logger.info(`[scanner] BOAMP pass 1: ${results.length} marchés directs (total_count: ${data.total_count || '?'})`)
      }
    }

    // ── PASS 2: Broad "travaux" search + lot detail scan ──────────────────
    // Fetch ALL travaux marchés in the region, then scan donnees for lot-level matches
    if (metiers.length > 0) {
      const whereParts2 = [
        `dateparution>=date'${dateStr}'`,
        `type_marche:'TRAVAUX'`,
      ]
      if (geoFilter) whereParts2.push(geoFilter)

      // Include donnees field for lot extraction
      const selectFields2 = 'idweb,objet,dateparution,datelimitereponse,nomacheteur,code_departement,url_avis,nature_libelle,donnees'
      const url2 = `https://www.boamp.fr/api/explore/v2.1/catalog/datasets/boamp/records?where=${encodeURIComponent(whereParts2.join(' AND '))}&order_by=dateparution desc&limit=100&select=${selectFields2}`

      logger.info(`[scanner] BOAMP pass 2 (lots detail): type_marche:TRAVAUX + region`)

      const res2 = await fetch(url2, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(25000),
      })

      if (res2.ok) {
        const data2 = await res2.json()
        let lotMatches = 0

        // Build keyword set from all resolved metiers (strong + weak)
        const allKw: string[] = []
        for (const m of metiers) {
          const mapping = METIER_CPV_MAP[m]
          if (mapping) {
            allKw.push(...mapping.strongKeywords, ...mapping.weakKeywords)
          }
        }
        const kwLower = allKw.map(k => k.toLowerCase())

        for (const r of (data2.results || [])) {
          if (!r.idweb || seenIds.has(r.idweb)) continue // Skip already found in pass 1

          const donnees = r.donnees
          const fullText = extractTextFromDonnees(donnees).toLowerCase()

          // Check if any metier keyword appears in the full donnees text
          const matchedKw = kwLower.filter(kw => fullText.includes(kw))
          if (matchedKw.length === 0) continue

          // Extract specific lots
          const lots = extractLotsFromDonnees(donnees)
          const matchedLots = lots.filter(lot => {
            const lotText = lot.description.toLowerCase()
            return kwLower.some(kw => lotText.includes(kw))
          })

          seenIds.add(r.idweb)
          const depts = Array.isArray(r.code_departement) ? r.code_departement : r.code_departement ? [String(r.code_departement)] : []
          const locationStr = depts.length > 0 ? `Dept. ${depts.join(', ')}` : 'France'

          if (matchedLots.length > 0) {
            // Create one result per matched lot for clarity
            for (const lot of matchedLots) {
              lotMatches++
              results.push({
                source: 'boamp',
                sourceId: `boamp-${r.idweb}-lot${lot.lotNum}`,
                sourceUrl: r.url_avis || `https://www.boamp.fr/pages/avis/?q=idweb:${r.idweb}`,
                title: `${String(r.objet).slice(0, 200)} — Lot ${lot.lotNum}: ${lot.description}`.slice(0, 500),
                description: `Lot ${lot.lotNum}: ${lot.description}. Marché: ${String(r.objet)}`,
                cpvCodes: [],
                buyer: String(r.nomacheteur || 'Non précisé'),
                location: locationStr,
                country: 'FR',
                deadline: r.datelimitereponse || undefined,
                publishedAt: r.dateparution || new Date().toISOString(),
                procedureType: r.nature_libelle || undefined,
                lotNumber: lot.lotNum,
              })
            }
          } else {
            // Keywords found in donnees but no specific lot extracted — still relevant
            lotMatches++
            results.push({
              source: 'boamp',
              sourceId: `boamp-${r.idweb}`,
              sourceUrl: r.url_avis || `https://www.boamp.fr/pages/avis/?q=idweb:${r.idweb}`,
              title: String(r.objet).slice(0, 500),
              description: `${String(r.objet)} [Mots-clés métier trouvés dans le détail de l'avis]`,
              cpvCodes: [],
              buyer: String(r.nomacheteur || 'Non précisé'),
              location: locationStr,
              country: 'FR',
              deadline: r.datelimitereponse || undefined,
              publishedAt: r.dateparution || new Date().toISOString(),
              procedureType: r.nature_libelle || undefined,
            })
          }
        }

        logger.info(`[scanner] BOAMP pass 2: ${lotMatches} marchés/lots supplémentaires trouvés via scan détail (sur ${(data2.results || []).length} marchés travaux)`)
      }
    }

    logger.info(`[scanner] BOAMP total: ${results.length} marchés (directs + lots)`)
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
// BOAMP OpenDataSoft — Miroir BOAMP sur plateforme DILA
// API : https://boamp-datadila.opendatasoft.com/api/explore/v2.1
// Complément au BOAMP principal (peut avoir des avis différents)
// ══════════════════════════════════════════════════════════════════════════════

async function fetchBOAMPMirror(daysBack: number = 2, metiers: string[] = [], location?: string): Promise<ScannedMarche[]> {
  const results: ScannedMarche[] = []

  try {
    const dateFrom = new Date()
    dateFrom.setDate(dateFrom.getDate() - daysBack)
    const dateStr = dateFrom.toISOString().split('T')[0]

    // Build keyword search query (q= full-text, more flexible than WHERE LIKE)
    const kwParts: string[] = []
    for (const metier of metiers) {
      const mapping = METIER_CPV_MAP[metier]
      if (mapping) kwParts.push(...mapping.strongKeywords.slice(0, 3))
    }
    const searchQ = [...new Set(kwParts)].slice(0, 6).join(' ')
    if (!searchQ) return results

    const whereParts: string[] = [`dateparution>=date'${dateStr}'`]
    if (location) {
      const dept = CITY_TO_DEPT[location.toLowerCase()]
      if (dept) whereParts.push(`code_departement:'${dept}'`)
    }

    const url = `https://boamp-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/boamp/records?q=${encodeURIComponent(searchQ)}&where=${encodeURIComponent(whereParts.join(' AND '))}&order_by=dateparution desc&limit=50&select=idweb,objet,dateparution,datelimitereponse,nomacheteur,code_departement,url_avis,nature_libelle`

    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      logger.warn(`[scanner] BOAMP Mirror returned ${res.status}`)
      return results
    }

    const data = await res.json()
    for (const r of (data.results || [])) {
      if (!r.objet) continue
      const depts = Array.isArray(r.code_departement) ? r.code_departement : r.code_departement ? [String(r.code_departement)] : []

      results.push({
        source: 'marches_online', // Reuse source type for aggregated non-primary sources
        sourceId: `boamp-ods-${r.idweb || Math.random().toString(36).slice(2)}`,
        sourceUrl: r.url_avis || (r.idweb ? `https://www.boamp.fr/avis/detail/${r.idweb}` : 'https://www.boamp.fr'),
        title: String(r.objet).slice(0, 500),
        description: String(r.objet),
        cpvCodes: [],
        buyer: String(r.nomacheteur || 'Non précisé'),
        location: depts.length > 0 ? `Dept. ${depts.join(', ')}` : 'France',
        country: 'FR',
        deadline: r.datelimitereponse || undefined,
        publishedAt: r.dateparution || new Date().toISOString(),
        procedureType: r.nature_libelle || undefined,
      })
    }

    logger.info(`[scanner] BOAMP Mirror: ${results.length} marchés récupérés`)
  } catch (err) {
    logger.error('[scanner] BOAMP Mirror error:', err)
  }

  return results
}

// ══════════════════════════════════════════════════════════════════════════════
// DECP — Données Essentielles Commande Publique (marchés attribués FR)
// API : https://data.economie.gouv.fr — intelligence concurrentielle
// Montre les marchés récemment attribués = qui gagne quoi, à quel montant
// ══════════════════════════════════════════════════════════════════════════════

async function fetchDECP(metiers: string[] = []): Promise<ScannedMarche[]> {
  const results: ScannedMarche[] = []

  try {
    // Build full-text search from strong keywords
    const kwParts: string[] = []
    for (const metier of metiers) {
      const mapping = METIER_CPV_MAP[metier]
      if (mapping) kwParts.push(...mapping.strongKeywords.slice(0, 3))
    }
    const searchQ = [...new Set(kwParts)].slice(0, 6).join(' ')
    if (!searchQ) return results

    // DECP uses q= for full-text search (WHERE doesn't work on text fields)
    // Order by recent, limit to 50
    const url = `https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/decp_augmente/records?q=${encodeURIComponent(searchQ)}&order_by=datepublicationdonnees desc&limit=50&select=id,objetmarche,codecpv,lieuexecutionnom,montant,nomacheteur,nature,datepublicationdonnees,codedepartementexecution`

    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      logger.warn(`[scanner] DECP API returned ${res.status}`)
      return results
    }

    const data = await res.json()
    for (const r of (data.results || [])) {
      if (!r.objetmarche) continue

      results.push({
        source: 'decp',
        sourceId: `decp-${r.id || Math.random().toString(36).slice(2)}`,
        sourceUrl: 'https://data.economie.gouv.fr/explore/dataset/decp_augmente/',
        title: `[Attribué] ${String(r.objetmarche).slice(0, 480)}`,
        description: String(r.objetmarche),
        cpvCodes: r.codecpv ? [String(r.codecpv).replace(/-.*/, '')] : [],
        buyer: String(r.nomacheteur || 'Non précisé'),
        location: String(r.lieuexecutionnom || (r.codedepartementexecution ? `Dept. ${r.codedepartementexecution}` : 'France')),
        country: 'FR',
        budgetMin: r.montant ? Number(r.montant) : undefined,
        publishedAt: r.datepublicationdonnees || new Date().toISOString(),
        procedureType: r.nature || undefined,
      })
    }

    logger.info(`[scanner] DECP: ${results.length} marchés attribués récupérés`)
  } catch (err) {
    logger.error('[scanner] DECP fetch error:', err)
  }

  return results
}

// ══════════════════════════════════════════════════════════════════════════════
// STORED TENDERS — Marchés stockés en Supabase par le cron hebdomadaire
// Sources : 8 sites vérifiés + mairies (e-marchespublics, francemarches,
// marchesonline, bailleurs-sociaux HLM, AMP Métropole, Région Sud, Dept 13, BOAMP cron)
// ══════════════════════════════════════════════════════════════════════════════

async function fetchStoredMarches(
  daysBack: number = 7,
  _metierKeywords: string[] = [],
  location?: string,
  country: 'FR' | 'PT' = 'FR',
): Promise<ScannedMarche[]> {
  const results: ScannedMarche[] = []

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseKey) {
      logger.warn('[scanner] Supabase env vars missing — skipping stored marches')
      return results
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    const since = new Date()
    since.setDate(since.getDate() - daysBack)
    const sinceStr = since.toISOString().split('T')[0]

    // Build geo filter: expand to regional departments (ex: 13 → all PACA)
    let deptFilter: string[] = []
    if (location) {
      const dept = CITY_TO_DEPT[location.toLowerCase()]
      if (dept) {
        deptFilter = DEPT_REGIONS[dept] || [dept]
      }
    }

    let query = supabase
      .from('marches')
      .select('id, title, description, source, source_id, url_source, location_city, departement, acheteur, date_publication, deadline, budget_min, montant_estime, status, pays')
      .eq('pays', country)
      .eq('status', 'open')
      .gte('date_publication', sinceStr)
      .order('date_publication', { ascending: false })
      .limit(300)

    // Geo filter: use .in() for regional departments instead of single dept
    if (deptFilter.length > 0) {
      query = query.in('departement', deptFilter)
    }

    const { data, error } = await query

    if (error) {
      logger.error('[scanner] Supabase stored marches query error:', error.message)
      return results
    }

    if (!data || data.length === 0) {
      logger.info('[scanner] No stored marches found in Supabase')
      return results
    }

    // Return stored marches with strict false-positive filtering
    // Mairie scraping captures a lot of noise (info pages, arrêtés, etc.)
    const NOISE_PATTERNS = [
      /^infos?\s+travaux/i,
      /^points?\s+travaux/i,
      /^flash\s+travaux/i,
      /^arr[êe]t[ée]s?\s/i,
      /^coupure\s+d/i,
      /^d[ée]marches?\s/i,
      /^formulaires?\s/i,
      /^urbanisme/i,
      /^allo\s+/i,
      /^rappel\s*:/i,
      /en\s+transition/i,
      /^t[ée]l[ée]charger\s+le\s+tableau/i,
      /travaux\s+(programm|r[ée]alis|en\s+cours\s+d|à partir|depuis)/i,
      /l['']acc[èe]s.*sera\s+(coup|ferm)/i,
      /voir\s+la\s+liste\s+des\s+march/i,
      /portail\s+march/i,
      /t[ée]l[ée]chargement\s+du\s+dossier/i,
      /r[èe]glementation\s+d/i,
      /à\s+l[''']ensemble\s+des\s+annonces/i,
      /march[ée]s\s+publics\s+(et\s+travaux|de\s+la\s+municipalit)/i,
      /MARCHES_DE_TRAVAUX_DE_/i,
      /travaux\s+et\s+am[ée]nagements$/i,
      /d[ée]but\s+des\s+travaux\s+sur/i,
    ]

    for (const row of data) {
      const title = row.title || ''
      const desc = row.description || ''
      const text = `${title} ${desc}`.toLowerCase()

      // Skip attribués
      if (text.includes('attribué') || text.includes('[attribue]')) continue

      // Skip generic very short titles (noise from mairies)
      const titleClean = title.replace(/&#\w+;/g, ' ').replace(/<[^>]*>/g, '').trim()
      if (titleClean.length < 20) continue

      // Skip known noise patterns (info pages, arrêtés, links to portals)
      if (NOISE_PATTERNS.some(p => p.test(titleClean))) continue

      const budget = row.budget_min || row.montant_estime || undefined

      results.push({
        source: 'stored',
        sourceId: `stored-${row.id}`,
        sourceUrl: row.url_source || '#',
        title: title.slice(0, 500),
        description: desc || title,
        cpvCodes: [],
        buyer: row.acheteur || 'Non précisé',
        location: row.location_city
          ? `${row.location_city}${row.departement ? ` (${row.departement})` : ''}`
          : row.departement ? `Dept. ${row.departement}` : 'France',
        country,
        budgetMin: budget && budget > 0 ? budget : undefined,
        deadline: row.deadline || undefined,
        publishedAt: row.date_publication || new Date().toISOString(),
      })
    }

    logger.info(`[scanner] Stored marches: ${results.length} retournés sur ${data.length} en base (${daysBack}j, region: ${deptFilter.join(',') || 'all'})`)
  } catch (err) {
    logger.error('[scanner] Stored marches fetch error:', err)
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
    sources: { boamp: number; ted: number; base_gov: number; marches_online: number; decp: number; stored: number }
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

  // Resolve mixed metier identifiers (categoryIds, labels, keys) to canonical keys
  const resolvedMetiers = metiers.length > 0 ? resolveMetierKeys(metiers) : []

  logger.info(`[scanner] Starting scan: country=${country}, daysBack=${daysBack}, metiers=${metiers.join(',')} → resolved=${resolvedMetiers.join(',')}`)

  // Fetch from all sources in parallel (pass resolved metiers + location for server-side filtering)
  const promises: Promise<ScannedMarche[]>[] = []

  // Build keyword list for stored marches filtering
  const allStrongKw: string[] = []
  for (const m of resolvedMetiers) {
    const mapping = METIER_CPV_MAP[m]
    if (mapping) allStrongKw.push(...mapping.strongKeywords, ...mapping.weakKeywords)
  }

  if (country === 'FR' || country === 'both') {
    // APIs temps réel
    promises.push(fetchBOAMP(daysBack, resolvedMetiers, location))
    promises.push(fetchTED(daysBack, 'FR', resolvedMetiers))
    promises.push(fetchBOAMPMirror(daysBack, resolvedMetiers, location))
    // Marchés stockés par le cron (8 sites + mairies)
    promises.push(fetchStoredMarches(Math.max(daysBack, 10), allStrongKw, location, 'FR'))
  }
  if (country === 'PT' || country === 'both') {
    promises.push(fetchBASEGov(daysBack, resolvedMetiers))
    promises.push(fetchTED(daysBack, 'PT', resolvedMetiers))
    promises.push(fetchStoredMarches(Math.max(daysBack, 10), allStrongKw, location, 'PT'))
  }

  const rawResults = await Promise.allSettled(promises)
  const allMarches: ScannedMarche[] = []
  const sourceCounts = { boamp: 0, ted: 0, base_gov: 0, marches_online: 0, decp: 0, stored: 0 }

  for (const result of rawResults) {
    if (result.status === 'fulfilled') {
      for (const m of result.value) {
        allMarches.push(m)
        sourceCounts[m.source]++
      }
    }
  }

  logger.info(`[scanner] Total scanned: ${allMarches.length} (BOAMP: ${sourceCounts.boamp}, TED: ${sourceCounts.ted}, MarchésOnline: ${sourceCounts.marches_online}, DECP: ${sourceCounts.decp}, BASE.gov: ${sourceCounts.base_gov}, Stored: ${sourceCounts.stored})`)

  // Filter out expired/attributed tenders before scoring
  const today = new Date().toISOString().split('T')[0]
  const activeMarches = allMarches.filter(m => {
    const text = `${m.title} ${m.description}`.toLowerCase()
    // Skip attributed/closed tenders
    if (text.includes('attribué') || text.includes('attribue') || text.includes('terminé') || text.includes('clos')) return false
    // Skip tenders with past deadlines
    if (m.deadline && m.deadline < today) return false
    return true
  })

  logger.info(`[scanner] Active tenders: ${activeMarches.length} (filtered ${allMarches.length - activeMarches.length} expired/attributed)`)

  // Deduplicate by title similarity
  const deduplicated = deduplicateMarches(activeMarches)

  // Score if metiers provided
  let enriched: EnrichedMarche[]

  if (resolvedMetiers.length > 0) {
    const prefs: ScoringPrefs = { metiers: resolvedMetiers, location, budgetMin, budgetMax }

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
      // Require at least 1 keyword match (scoreKeywords > 0) — no keyword = not relevant to this trade
      // Then threshold 20 on total score for basic quality
      .filter(m => m.scoring!.scoreKeywords > 0 && m.scoring!.scoreTotal >= 20)
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
