import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import {
  type SyncedMarche, upsertMarches, startSyncJob, finishSyncJob, failSyncJob,
  fetchWithRetry, checkRobotsTxt,
} from '@/lib/marches-sync'

export const maxDuration = 60

// ── Licen\u00e7as de Obras — C\u00e2mara Municipal do Porto ───────────────────────────
// Permis de construire Porto (open data)
// \u00c9quivalent Sitadel en France
const OPENDATA_PORTO_BASE = 'https://opendata.cm-porto.pt'

export async function POST(request: NextRequest) {
  const cronSecret = request.headers.get('x-cron-secret')
  const authHeader = request.headers.get('authorization')
  if (cronSecret !== process.env.CRON_SECRET && !authHeader?.includes(process.env.SUPABASE_SERVICE_ROLE_KEY || '___')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const jobId = await startSyncJob(supabase, 'cm-porto', 'porto-pt')

  try {
    const marches: SyncedMarche[] = []

    // Try Porto Open Data API
    const searchTerms = ['licen\u00e7as+obras', 'alvar\u00e1s+obras', 'obras+constru\u00e7\u00e3o']

    for (const term of searchTerms) {
      try {
        // Porto Open Data uses CKAN-style API
        const apiUrl = `${OPENDATA_PORTO_BASE}/api/3/action/package_search?q=${term}&rows=20`
        const res = await fetchWithRetry(apiUrl, {}, { retries: 1, delayMs: 3000 })

        if (!res.ok) {
          // Try alternative endpoint format
          const altUrl = `${OPENDATA_PORTO_BASE}/api/1/datasets/?q=${term}&page_size=10`
          const altRes = await fetchWithRetry(altUrl, {}, { retries: 1, delayMs: 3000 })
          if (altRes.ok) {
            const altJson = await altRes.json()
            const datasets = altJson.data || altJson.results || []
            for (const ds of datasets) {
              const resources = (ds.resources || []).filter((r: Record<string, unknown>) =>
                r.format === 'json' || r.format === 'csv' || r.format === 'geojson'
              )
              for (const resource of resources.slice(0, 2)) {
                const parsed = await fetchAndParseResource(resource.url)
                marches.push(...parsed)
                await new Promise(r => setTimeout(r, 3000))
              }
            }
          }
          continue
        }

        const json = await res.json()
        const datasets = json.result?.results || json.results || []

        for (const ds of datasets) {
          const resources = (ds.resources || []).filter((r: Record<string, unknown>) =>
            (r.format as string | undefined)?.toLowerCase() === 'json' ||
            (r.format as string | undefined)?.toLowerCase() === 'csv' ||
            (r.format as string | undefined)?.toLowerCase() === 'geojson'
          )

          for (const resource of resources.slice(0, 2)) {
            try {
              const parsed = await fetchAndParseResource(resource.url)
              marches.push(...parsed)
            } catch (err) {
              logger.warn(`[sync:obras-porto] Resource parse error:`, err)
            }
            await new Promise(r => setTimeout(r, 3000))
          }
        }

        await new Promise(r => setTimeout(r, 3000))
      } catch (err) {
        logger.warn(`[sync:obras-porto] Search error for "${term}":`, err)
      }
    }

    // Also check if cm-porto.pt has a direct marchés page
    try {
      const allowed = await checkRobotsTxt('https://www.cm-porto.pt', '/concursos')
      if (allowed) {
        const pageRes = await fetchWithRetry('https://www.cm-porto.pt/concursos-publicos', {}, { retries: 1 })
        if (pageRes.ok) {
          const html = await pageRes.text()
          const parsed = parsePortoMarchesHtml(html)
          marches.push(...parsed)
        }
      }
    } catch {
      // Non-blocking
    }

    // Deduplicate
    const seen = new Set<string>()
    const unique = marches.filter(m => {
      if (seen.has(m.source_id)) return false
      seen.add(m.source_id)
      return true
    })

    const result = await upsertMarches(supabase, unique, 'cm-porto')
    await finishSyncJob(supabase, jobId, { source: 'cm-porto', zone: 'porto-pt', ...result })

    return NextResponse.json({ success: true, ...result, total_fetched: unique.length })
  } catch (err: unknown) {
    logger.error('[sync:obras-porto] Fatal error:', err)
    const errMsg = err instanceof Error ? err.message : 'Internal error'
    await failSyncJob(supabase, jobId, errMsg)
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}

async function fetchAndParseResource(url: string): Promise<SyncedMarche[]> {
  const marches: SyncedMarche[] = []
  const res = await fetchWithRetry(url, {}, { retries: 1, delayMs: 2000 })
  if (!res.ok) return marches

  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('json')) return marches // Skip CSV for now

  const data = await res.json()
  const records = Array.isArray(data) ? data :
    data.features || data.records || data.data || data.results || []

  for (const record of records) {
    const fields = record.properties || record.fields || record
    const descricao = fields.descricao || fields.descri\u00e7\u00e3o || fields.titulo || fields.objeto || ''
    if (!descricao || descricao.length < 5) continue

    const tipoObra = fields.tipo_obra || fields.tipo || ''
    const local = fields.local || fields.morada || fields.endereco || fields.freguesia || ''
    const area = parseFloat(fields.area_total_m2 || fields.area || '0')

    const title = area > 0
      ? `${descricao} \u2014 ${local || 'Porto'} (${area}m\u00b2)`
      : `${descricao} \u2014 ${local || 'Porto'}`

    marches.push({
      source: 'cm-porto',
      source_id: `cm-porto-${fields.id || Buffer.from(descricao.slice(0, 40)).toString('base64').slice(0, 20)}`,
      url_source: `${OPENDATA_PORTO_BASE}`,
      title: title.slice(0, 500),
      description: `Licen\u00e7a de obras \u2014 Porto\n${descricao}\nTipo: ${tipoObra || 'NC'}\nLocal: ${local || 'Porto'}${area > 0 ? `\n\u00c1rea: ${area}m\u00b2` : ''}`,
      category: mapTipoObraToCategory(tipoObra),
      pays: 'PT',
      zone_test: 'porto-pt',
      location_city: 'Porto',
      district: 'Porto',
      concelho: 'Porto',
      date_publication: fields.data || fields.data_licenca || new Date().toISOString(),
      procedure_type: 'licenca_obras',
      langue: 'pt',
      status: 'open',
      urgency: 'normal',
    })
  }

  return marches
}

function parsePortoMarchesHtml(html: string): SyncedMarche[] {
  const marches: SyncedMarche[] = []
  const cleanHtml = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')

  const patterns = [
    /<a[^>]*href="([^"]*)"[^>]*>([^<]*(?:obra|constru|concurso|empreitada)[^<]*)<\/a>/gi,
    /<h[2-4][^>]*>([^<]*(?:obra|constru|concurso|empreitada)[^<]*)<\/h[2-4]>/gi,
  ]

  for (const pattern of patterns) {
    const matches = cleanHtml.matchAll(pattern)
    for (const match of matches) {
      const text = (match[2] || match[1] || '').trim()
      if (!text || text.length < 15) continue

      marches.push({
        source: 'cm-porto',
        source_id: `cm-porto-html-${Buffer.from(text.slice(0, 40)).toString('base64').slice(0, 20)}`,
        url_source: 'https://www.cm-porto.pt/concursos-publicos',
        title: text.slice(0, 500),
        description: `Concurso p\u00fablico \u2014 C\u00e2mara Municipal do Porto\n${text}`,
        category: 'travaux',
        pays: 'PT',
        zone_test: 'porto-pt',
        location_city: 'Porto',
        district: 'Porto',
        concelho: 'Porto',
        date_publication: new Date().toISOString(),
        procedure_type: 'concurso_publico',
        langue: 'pt',
        status: 'open',
        urgency: 'normal',
      })
    }
  }

  return marches
}

function mapTipoObraToCategory(tipo: string): string {
  const t = (tipo || '').toLowerCase()
  if (t.includes('reabilita') || t.includes('renova')) return 'r\u00e9novation'
  if (t.includes('constru')) return 'construction'
  if (t.includes('demoli')) return 'd\u00e9molition'
  if (t.includes('amplia')) return 'extension'
  return 'travaux'
}

// Vercel cron sends GET — delegate to POST handler
export async function GET(request: NextRequest) {
  return POST(request)
}
