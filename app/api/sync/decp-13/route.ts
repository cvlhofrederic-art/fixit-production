import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import {
  type SyncedMarche, upsertMarches, startSyncJob, finishSyncJob, failSyncJob, fetchWithRetry,
} from '@/lib/marches-sync'

export const maxDuration = 60

// ── DECP augmenté — Marchés publics attribués dept 13 (Bouches-du-Rhône) ────
// Source: data.economie.gouv.fr — Licence Ouverte 2.0
// CPV 45* = construction / BTP
const DECP_ENDPOINT = 'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/decp_augmente/records'

export async function POST(request: NextRequest) {
  // Auth: cron secret or service role
  const authHeader = request.headers.get('authorization')
  const cronSecret = request.headers.get('x-cron-secret')
  if (cronSecret !== process.env.CRON_SECRET && !authHeader?.includes(process.env.SUPABASE_SERVICE_ROLE_KEY || '___')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const jobId = await startSyncJob(supabase, 'decp', '13-paca')

  try {
    const marches: SyncedMarche[] = []
    let offset = 0
    const limit = 100
    const maxPages = 5 // Max 500 records per sync

    while (offset < limit * maxPages) {
      const url = `${DECP_ENDPOINT}?where=cpv like "45%" AND lieu_exec_departement="13"&order_by=datemaj desc&limit=${limit}&offset=${offset}`
      const res = await fetchWithRetry(url)

      if (!res.ok) {
        logger.warn(`[sync:decp-13] API error ${res.status} at offset ${offset}`)
        break
      }

      const json = await res.json()
      const records = json.results || json.records || []
      if (records.length === 0) break

      for (const r of records) {
        const fields = r.fields || r
        const objet = fields.objet || fields.objetmarche || ''
        const cpv = fields.cpv || ''
        const montant = parseFloat(fields.montant) || null
        const commune = fields.lieu_exec_nom_commune || fields.lieu_exec_nom || ''
        const dept = fields.lieu_exec_departement || '13'
        const acheteur = fields.entite_nom || fields.nomacheteur || ''
        const dateStr = fields.datemaj || fields.datepublicationdonnees || ''
        const id = fields.id || fields.uid || `decp-${objet.slice(0, 30)}-${dateStr}`

        if (!objet || objet.length < 10) continue

        marches.push({
          source: 'decp',
          source_id: String(id),
          url_source: `https://data.economie.gouv.fr/explore/dataset/decp_augmente/`,
          title: objet.slice(0, 500),
          description: `${objet}\nAcheteur: ${acheteur}\nCPV: ${cpv}\nMontant: ${montant ? montant.toLocaleString('fr-FR') + ' \u20ac' : 'NC'}`,
          category: mapCpvToCategory(cpv),
          cpv_codes: cpv ? [cpv] : [],
          pays: 'FR',
          zone_test: '13-paca',
          location_city: commune || 'Bouches-du-Rh\u00f4ne',
          departement: dept,
          budget_min: montant || undefined,
          montant_estime: montant || undefined,
          acheteur,
          date_publication: dateStr || new Date().toISOString(),
          procedure_type: fields.type_procedure || fields.nature || 'march\u00e9_public',
          langue: 'fr',
          status: 'open',
          urgency: 'normal',
        })
      }

      offset += limit
      if (records.length < limit) break
    }

    const result = await upsertMarches(supabase, marches, 'decp')
    await finishSyncJob(supabase, jobId, { source: 'decp', zone: '13-paca', ...result })

    return NextResponse.json({
      success: true,
      ...result,
      total_fetched: marches.length,
    })
  } catch (err: unknown) {
    logger.error('[sync:decp-13] Fatal error:', err)
    const errMsg = err instanceof Error ? err.message : 'Internal error'
    await failSyncJob(supabase, jobId, errMsg)
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}

function mapCpvToCategory(cpv: string): string {
  if (!cpv) return 'travaux'
  if (cpv.startsWith('4526')) return 'couverture'
  if (cpv.startsWith('4531')) return '\u00e9lectricit\u00e9'
  if (cpv.startsWith('4533')) return 'plomberie'
  if (cpv.startsWith('4544')) return 'peinture'
  if (cpv.startsWith('4542')) return 'menuiserie'
  if (cpv.startsWith('4543')) return 'carrelage'
  if (cpv.startsWith('4532')) return 'isolation'
  if (cpv.startsWith('4545')) return 'r\u00e9novation'
  if (cpv.startsWith('4534')) return 'serrurerie'
  if (cpv.startsWith('4533')) return 'chauffage'
  return 'travaux'
}

// Vercel cron sends GET — delegate to POST handler
export async function GET(request: NextRequest) {
  return POST(request)
}
