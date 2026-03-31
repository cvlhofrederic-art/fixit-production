import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'
import {
  type SyncedMarche, upsertMarches, startSyncJob, finishSyncJob, failSyncJob, fetchWithRetry,
} from '@/lib/marches-sync'

export const maxDuration = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// ── Sitadel / Permis de construire dept 13 ──────────────────────────────────
// Marchés privés indirects : un permis accordé = chantier à venir
// Source: data.gouv.fr open data + API Ministère Logement
const SITADEL_DATASETS = [
  'https://www.data.gouv.fr/api/1/datasets/?q=sitadel+permis+construire&page_size=10',
  'https://data.statistiques.developpement-durable.gouv.fr/dido/api/v1/datafiles?millesime=latest&withColumnDescription=false',
]

// Mapping type de permis → description lisible
const PERMIS_TYPES: Record<string, string> = {
  'PC': 'Permis de construire',
  'PA': "Permis d'am\u00e9nager",
  'PD': 'Permis de d\u00e9molir',
  'DP': 'D\u00e9claration pr\u00e9alable',
}

export async function POST(request: NextRequest) {
  const cronSecret = request.headers.get('x-cron-secret')
  const authHeader = request.headers.get('authorization')
  if (cronSecret !== process.env.CRON_SECRET && !authHeader?.includes(process.env.SUPABASE_SERVICE_ROLE_KEY || '___')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const jobId = await startSyncJob(supabase, 'sitadel', '13-paca')

  try {
    const marches: SyncedMarche[] = []

    // Try data.gouv.fr API for Sitadel datasets
    for (const endpoint of SITADEL_DATASETS) {
      try {
        const res = await fetchWithRetry(endpoint, {}, { retries: 1, delayMs: 2000 })
        if (!res.ok) continue

        const json = await res.json()
        const datasets = json.data || json.results || []

        for (const ds of datasets) {
          // Find JSON/CSV resources for dept 13
          const resources = (ds.resources || []).filter((r: any) =>
            (r.format === 'json' || r.format === 'csv') &&
            (r.title || '').toLowerCase().includes('13')
          )

          for (const resource of resources.slice(0, 2)) {
            try {
              const dataRes = await fetchWithRetry(resource.url, {}, { retries: 1 })
              if (!dataRes.ok) continue

              const contentType = dataRes.headers.get('content-type') || ''
              if (contentType.includes('json')) {
                const data = await dataRes.json()
                const records = Array.isArray(data) ? data : data.data || data.records || []
                for (const record of records) {
                  const marche = parsePermisRecord(record)
                  if (marche) marches.push(marche)
                }
              }
              // CSV parsing would go here for production
            } catch (err) {
              logger.warn(`[sync:sitadel-13] Resource parse error:`, err)
            }
            await new Promise(r => setTimeout(r, 3000))
          }
        }
      } catch (err) {
        logger.warn(`[sync:sitadel-13] Endpoint error:`, err)
      }
    }

    // Generate synthetic permis entries from open data if API didn't yield much
    // In production, this would connect to the actual Sitadel API
    if (marches.length < 5) {
      logger.info('[sync:sitadel-13] Few results from API — Sitadel API may require direct access')
    }

    const result = await upsertMarches(supabase, marches, 'sitadel')
    await finishSyncJob(supabase, jobId, { source: 'sitadel', zone: '13-paca', ...result })

    return NextResponse.json({ success: true, ...result, total_fetched: marches.length })
  } catch (err: any) {
    logger.error('[sync:sitadel-13] Fatal error:', err)
    await failSyncJob(supabase, jobId, err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

function parsePermisRecord(record: any): SyncedMarche | null {
  const fields = record.fields || record
  const dept = fields.dep || fields.departement || fields.code_departement || ''
  if (dept !== '13' && !String(dept).startsWith('13')) return null

  const typePermis = fields.type_permis || fields.type || 'PC'
  const commune = fields.commune || fields.nom_commune || fields.libelle_commune || ''
  const surface = parseFloat(fields.surface_totale || fields.surface || '0')
  const typeProjet = fields.type_projet || fields.nature_projet || fields.destination || 'Construction'
  const dateAccord = fields.date_accord || fields.date_decision || fields.date || ''

  if (!commune) return null

  const title = `Chantier ${typeProjet} \u2014 ${commune} (${surface > 0 ? surface + 'm\u00b2' : 'surface NC'})`
  const permisLabel = PERMIS_TYPES[typePermis] || typePermis

  // Estimated start: 6 months after permit approval
  let estimatedStart = ''
  if (dateAccord) {
    const d = new Date(dateAccord)
    d.setMonth(d.getMonth() + 6)
    estimatedStart = d.toISOString().split('T')[0]
  }

  return {
    source: 'sitadel',
    source_id: `sitadel-${dept}-${commune.slice(0, 20)}-${dateAccord || Date.now()}`,
    url_source: 'https://www.statistiques.developpement-durable.gouv.fr/construction-de-logements-resultats-a-fin-decembre-2024-france-entiere',
    title,
    description: `${permisLabel} accord\u00e9 \u00e0 ${commune} (d\u00e9pt. 13)\nSurface: ${surface > 0 ? surface + ' m\u00b2' : 'NC'}\nType: ${typeProjet}\nD\u00e9but travaux estim\u00e9: ${estimatedStart || '6 mois apr\u00e8s accord'}`,
    category: 'travaux',
    pays: 'FR',
    zone_test: '13-paca',
    location_city: commune,
    departement: '13',
    date_publication: dateAccord || new Date().toISOString(),
    deadline: estimatedStart || undefined,
    procedure_type: 'permis_construire',
    langue: 'fr',
    status: 'open',
    urgency: 'normal',
  }
}

// Vercel cron sends GET — delegate to POST handler
export async function GET(request: NextRequest) {
  return POST(request)
}
