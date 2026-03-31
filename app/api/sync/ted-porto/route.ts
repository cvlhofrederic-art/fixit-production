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

// ── TED (Tenders Electronic Daily) — Gros march\u00e9s UE publi\u00e9s pour Porto ──────
// NUTS PT11 = Norte (Porto + Braga + Viana + Vila Real + Bragança)
// CPV 45* = construction
const TED_ENDPOINT = 'https://ted.europa.eu/api/v3.0/notices/search'

export async function POST(request: NextRequest) {
  const cronSecret = request.headers.get('x-cron-secret')
  const authHeader = request.headers.get('authorization')
  if (cronSecret !== process.env.CRON_SECRET && !authHeader?.includes(process.env.SUPABASE_SERVICE_ROLE_KEY || '___')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const jobId = await startSyncJob(supabase, 'ted-eu', 'porto-pt')

  try {
    const marches: SyncedMarche[] = []

    // TED API v3 search — filter by NUTS PT11 + CPV 45
    const sixMonthsAgo = new Date(Date.now() - 180 * 86400000).toISOString().split('T')[0].replace(/-/g, '')

    const queries = [
      `?q=CPV%3D45*%20AND%20TD%3D3&scope=2&PD%3E${sixMonthsAgo}&RC=PT-11&sortField=PD&sortOrder=desc&limit=100`,
      `?q=construction+porto&scope=2&PD%3E${sixMonthsAgo}&RC=PT&sortField=PD&sortOrder=desc&limit=50`,
    ]

    for (const query of queries) {
      try {
        const url = `${TED_ENDPOINT}${query}`
        const res = await fetchWithRetry(url, {}, { retries: 1, delayMs: 2000 })

        if (!res.ok) {
          logger.warn(`[sync:ted-porto] TED API ${res.status}`)
          continue
        }

        const json = await res.json()
        const notices = json.notices || json.results || json.data || []

        for (const notice of notices) {
          const marche = parseTedNotice(notice)
          if (marche) marches.push(marche)
        }

        await new Promise(r => setTimeout(r, 2000))
      } catch (err) {
        logger.warn('[sync:ted-porto] Query error:', err)
      }
    }

    // Also try TED search via alternative format
    try {
      const altUrl = `https://ted.europa.eu/api/v3.0/notices/search?q=obras+constru%C3%A7%C3%A3o&nuts=PT11&cpv=45&limit=50`
      const altRes = await fetchWithRetry(altUrl, {}, { retries: 1 })
      if (altRes.ok) {
        const altJson = await altRes.json()
        const altNotices = altJson.notices || altJson.results || []
        for (const notice of altNotices) {
          const marche = parseTedNotice(notice)
          if (marche) marches.push(marche)
        }
      }
    } catch {
      // Non-blocking alternative query
    }

    // Deduplicate
    const seen = new Set<string>()
    const unique = marches.filter(m => {
      if (seen.has(m.source_id)) return false
      seen.add(m.source_id)
      return true
    })

    const result = await upsertMarches(supabase, unique, 'ted-eu')
    await finishSyncJob(supabase, jobId, { source: 'ted-eu', zone: 'porto-pt', ...result })

    return NextResponse.json({ success: true, ...result, total_fetched: unique.length })
  } catch (err: any) {
    logger.error('[sync:ted-porto] Fatal error:', err)
    await failSyncJob(supabase, jobId, err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

function parseTedNotice(notice: any): SyncedMarche | null {
  const title = notice.title || notice.TI || notice.officialTitle || ''
  const titleText = typeof title === 'object' ? (title.pt || title.en || title.fr || Object.values(title)[0] || '') : String(title)
  if (!titleText || titleText.length < 5) return null

  const cpv = notice.cpvCode || notice.cpv || notice.CPV || ''
  const cpvCodes = Array.isArray(cpv) ? cpv : cpv ? [String(cpv)] : []

  // Extract location
  const nuts = notice.nuts || notice.NUTS || ''
  const location = notice.performancePlace || notice.town || notice.city || ''
  const isPortoArea = String(nuts).includes('PT11') ||
    String(location).toLowerCase().includes('porto') ||
    String(notice.country || '').toLowerCase() === 'pt'

  if (!isPortoArea) return null

  const value = parseFloat(notice.estimatedValue || notice.VA || notice.totalValue || '0') || undefined
  const noticeId = notice.noticeId || notice.docId || notice.ND || `ted-${titleText.slice(0, 30)}`

  return {
    source: 'ted-eu',
    source_id: String(noticeId),
    url_source: `https://ted.europa.eu/notice/-/${noticeId}`,
    title: titleText.slice(0, 500),
    description: `${titleText}\nCPV: ${cpvCodes.join(', ')}\nNUTS: ${nuts}`,
    category: 'travaux',
    cpv_codes: cpvCodes,
    pays: 'PT',
    zone_test: 'porto-pt',
    location_city: String(location || 'Porto'),
    district: 'Porto',
    budget_min: value,
    montant_estime: value,
    acheteur: notice.buyerName || notice.CA || notice.organisationName || '',
    date_publication: notice.publicationDate || notice.PD || new Date().toISOString(),
    procedure_type: notice.procedureType || notice.PR || 'european',
    langue: 'pt',
    status: 'open',
    urgency: 'normal',
    deadline: notice.deadlineDate || notice.DT || undefined,
  }
}

// Vercel cron sends GET — delegate to POST handler
export async function GET(request: NextRequest) {
  return POST(request)
}
