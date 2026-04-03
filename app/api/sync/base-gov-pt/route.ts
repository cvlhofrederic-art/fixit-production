import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import {
  type SyncedMarche, upsertMarches, startSyncJob, finishSyncJob, failSyncJob, fetchWithRetry,
} from '@/lib/marches-sync'

export const maxDuration = 60

// ── BASE.gov.pt — Contratos p\u00fablicos Portugal (regi\u00e3o Porto) ────────────────
// Fallback: dados.gov.pt open data (sans cl\u00e9 API)
// CPV 45* = construction / BTP
const DADOS_GOV_ENDPOINT = 'https://dados.gov.pt/api/1/datasets/contratos-publicos-portal-base-impic-contratos-de-2012-a-2026/'

// Concelhos de la r\u00e9gion Porto \u00e0 filtrer
const PORTO_CONCELHOS = [
  'porto', 'vila nova de gaia', 'gaia', 'matosinhos', 'maia',
  'gondomar', 'valongo', 'paredes', 'penafiel', 'amarante',
  'marco de canaveses', 'bai\u00e3o', 'resende', 'cinf\u00e3es',
  'felgueiras', 'lousada', 'pa\u00e7os de ferreira', 'santo tirso',
  'trofa', 'p\u00f3voa de varzim', 'vila do conde',
]

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = request.headers.get('x-cron-secret')
  if (cronSecret !== process.env.CRON_SECRET && !authHeader?.includes(process.env.SUPABASE_SERVICE_ROLE_KEY || '___')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const jobId = await startSyncJob(supabase, 'base-gov-pt', 'porto-pt')

  try {
    // Strategy: Use BASE.gov.pt search page (HTML parsing) since API requires key
    // Fallback to dados.gov.pt CSV resources
    const marches: SyncedMarche[] = []

    // Try BASE.gov.pt search API (works without key for basic search)
    const baseUrl = 'https://www.base.gov.pt/Base4/pt/resultados/'
    const searchTerms = ['constru\u00e7\u00e3o', 'obras', 'reabilita\u00e7\u00e3o', 'renova\u00e7\u00e3o', 'edif\u00edcio']

    for (const term of searchTerms) {
      try {
        const url = `https://www.base.gov.pt/Base4/pt/pesquisa/?type=contratos&query=${encodeURIComponent(term)}&distrito=13&sort=-publicationDate`
        const res = await fetchWithRetry(url, {}, { retries: 1, delayMs: 3000 })

        if (!res.ok) {
          logger.warn(`[sync:base-gov-pt] Search failed for "${term}": ${res.status}`)
          continue
        }

        const contentType = res.headers.get('content-type') || ''
        if (contentType.includes('json')) {
          const json = await res.json()
          const items = json.items || json.results || json.data || []
          for (const item of items) {
            const marche = parseBaseGovItem(item)
            if (marche) marches.push(marche)
          }
        } else {
          // HTML response — parse contracts from page
          const html = await res.text()
          const parsed = parseBaseGovHtml(html)
          marches.push(...parsed)
        }

        // Respectful delay between requests
        await new Promise(r => setTimeout(r, 3000))
      } catch (err) {
        logger.warn(`[sync:base-gov-pt] Error for term "${term}":`, err)
      }
    }

    // Also try dados.gov.pt API for recent contracts
    try {
      const dadosUrl = `https://dados.gov.pt/api/1/datasets/?q=contratos+publicos+porto&page_size=20`
      const dadosRes = await fetchWithRetry(dadosUrl)
      if (dadosRes.ok) {
        const dadosJson = await dadosRes.json()
        // Look for downloadable resources with CSV/JSON
        const datasets = dadosJson.data || []
        for (const ds of datasets.slice(0, 3)) {
          const resources = (ds.resources || []).filter((r: Record<string, unknown>) =>
            r.format === 'json' || r.format === 'csv'
          )
          if (resources.length > 0) {
            logger.info(`[sync:base-gov-pt] Found dataset: ${ds.title} (${resources.length} resources)`)
          }
        }
      }
    } catch {
      // Non-blocking — dados.gov.pt is a bonus source
    }

    // Deduplicate by source_id
    const seen = new Set<string>()
    const unique = marches.filter(m => {
      if (seen.has(m.source_id)) return false
      seen.add(m.source_id)
      return true
    })

    const result = await upsertMarches(supabase, unique, 'base-gov-pt')
    await finishSyncJob(supabase, jobId, { source: 'base-gov-pt', zone: 'porto-pt', ...result })

    return NextResponse.json({
      success: true,
      ...result,
      total_fetched: unique.length,
    })
  } catch (err: unknown) {
    logger.error('[sync:base-gov-pt] Fatal error:', err)
    const errMsg = err instanceof Error ? err.message : 'Internal error'
    await failSyncJob(supabase, jobId, errMsg)
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API response with unpredictable shape
function parseBaseGovItem(item: Record<string, any>): SyncedMarche | null {
  const title = item.objeto_contrato || item.objectoBrevesDescricao || item.descricao || ''
  if (!title || title.length < 5) return null

  const concelho = (item.municipio || item.local || '').toLowerCase()
  const isPorto = PORTO_CONCELHOS.some(c => concelho.includes(c)) ||
    (item.distrito || '').toLowerCase().includes('porto')

  if (!isPorto && concelho) return null // Skip non-Porto contracts

  return {
    source: 'base-gov-pt',
    source_id: String(item.id || item.idcontrato || `base-${title.slice(0, 30)}-${item.data_publicacao || Date.now()}`),
    url_source: item.url || `https://www.base.gov.pt/Base4/pt/detalhe/?type=contratos&id=${item.id || ''}`,
    title,
    description: `${title}\nEntidade: ${item.entidade_adjudicante || item.adjudicante || 'NC'}\nCPV: ${item.cpv || 'NC'}`,
    category: 'travaux',
    cpv_codes: item.cpv ? [item.cpv] : [],
    pays: 'PT',
    zone_test: 'porto-pt',
    location_city: capitalizeFirst(concelho) || 'Porto',
    district: 'Porto',
    concelho: capitalizeFirst(concelho),
    montant_estime: parseFloat(item.preco_contrato || item.preco_contratual) || undefined,
    budget_min: parseFloat(item.preco_contrato || item.preco_contratual) || undefined,
    acheteur: item.entidade_adjudicante || item.adjudicante || '',
    date_publication: item.data_publicacao || item.dataCelebracaoContrato || new Date().toISOString(),
    procedure_type: item.tipo_procedimento || 'contrato_publico',
    langue: 'pt',
    status: 'open',
    urgency: 'normal',
  }
}

function parseBaseGovHtml(html: string): SyncedMarche[] {
  const marches: SyncedMarche[] = []

  // Simple regex-based extraction of contract entries from BASE.gov.pt HTML
  // Look for contract blocks (they follow a consistent HTML pattern)
  const titleRegex = /<span[^>]*class="[^"]*titulo[^"]*"[^>]*>([^<]+)<\/span>/gi
  const matches = html.matchAll(titleRegex)

  for (const match of matches) {
    const title = match[1]?.trim()
    if (!title || title.length < 10) continue

    // Check if it's BTP-related
    const btpKeywords = ['constru', 'obras', 'reabilita', 'edific', 'renova', 'canaliza', 'eletric', 'pintura']
    const isBtp = btpKeywords.some(kw => title.toLowerCase().includes(kw))
    if (!isBtp) continue

    marches.push({
      source: 'base-gov-pt',
      source_id: `base-html-${Buffer.from(title.slice(0, 50)).toString('base64').slice(0, 20)}`,
      url_source: 'https://www.base.gov.pt/Base4/pt/resultados/',
      title,
      description: title,
      category: 'travaux',
      pays: 'PT',
      zone_test: 'porto-pt',
      location_city: 'Porto',
      district: 'Porto',
      langue: 'pt',
      status: 'open',
      urgency: 'normal',
      date_publication: new Date().toISOString(),
    })
  }

  return marches
}

function capitalizeFirst(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
}

// Vercel cron sends GET — delegate to POST handler
export async function GET(request: NextRequest) {
  return POST(request)
}
