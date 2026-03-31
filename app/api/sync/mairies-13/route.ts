import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'
import {
  type SyncedMarche, upsertMarches, startSyncJob, finishSyncJob, failSyncJob,
  fetchWithRetry, checkRobotsTxt,
} from '@/lib/marches-sync'

export const maxDuration = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// ── Scraping mairies dept 13 — MAPA < 40k\u20ac ─────────────────────────────────
// Petits march\u00e9s non r\u00e9f\u00e9renc\u00e9s dans les API officielles
// R\u00e8gles : robots.txt, 3s d\u00e9lai, retry max 2

interface MairieSite {
  name: string
  baseUrl: string
  path: string
}

const MAIRIES: MairieSite[] = [
  { name: 'Marseille', baseUrl: 'https://www.marseille.fr', path: '/les-marches-publics' },
  { name: 'Aix-en-Provence', baseUrl: 'https://www.aixenprovence.fr', path: '/marches-publics' },
  { name: 'Istres', baseUrl: 'https://www.istres.fr', path: '/marches-publics' },
  { name: 'Marignane', baseUrl: 'https://www.ville-marignane.fr', path: '/marches-publics' },
  { name: 'Salon-de-Provence', baseUrl: 'https://www.salondeprovence.fr', path: '/marches-publics' },
  { name: 'Aubagne', baseUrl: 'https://www.aubagne.fr', path: '/marches-publics' },
]

// BTP-related keywords to identify relevant marchés
const BTP_KEYWORDS = [
  'travaux', 'r\u00e9novation', 'construction', 'r\u00e9habilitation', 'am\u00e9nagement',
  'voirie', 'assainissement', 'toiture', '\u00e9lectricit\u00e9', 'plomberie',
  'peinture', 'menuiserie', 'carrelage', 'isolation', 'chauffage',
  'fa\u00e7ade', 'ravalement', 'ma\u00e7onnerie', 'serrurerie', 'couverture',
  'b\u00e2timent', 'ouvrage', 'chantier', 'g\u00e9nie civil',
]

export async function POST(request: NextRequest) {
  const cronSecret = request.headers.get('x-cron-secret')
  const authHeader = request.headers.get('authorization')
  if (cronSecret !== process.env.CRON_SECRET && !authHeader?.includes(process.env.SUPABASE_SERVICE_ROLE_KEY || '___')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const jobId = await startSyncJob(supabase, 'mairie-13', '13-paca')

  try {
    const allMarches: SyncedMarche[] = []
    const errors: string[] = []

    for (const mairie of MAIRIES) {
      try {
        // Check robots.txt first
        const allowed = await checkRobotsTxt(mairie.baseUrl, mairie.path)
        if (!allowed) {
          logger.info(`[sync:mairies-13] ${mairie.name}: robots.txt disallows ${mairie.path}, skipping`)
          errors.push(`${mairie.name}: robots.txt interdit`)
          continue
        }

        // Fetch the marchés page
        const url = `${mairie.baseUrl}${mairie.path}`
        const res = await fetchWithRetry(url, {}, { retries: 2, delayMs: 3000 })

        if (!res.ok) {
          logger.warn(`[sync:mairies-13] ${mairie.name}: HTTP ${res.status}`)
          errors.push(`${mairie.name}: HTTP ${res.status}`)
          await new Promise(r => setTimeout(r, 3000))
          continue
        }

        const html = await res.text()
        const marches = parseMarieHtml(html, mairie)
        allMarches.push(...marches)

        logger.info(`[sync:mairies-13] ${mairie.name}: ${marches.length} march\u00e9s BTP trouv\u00e9s`)

        // Respectful delay between mairie sites
        await new Promise(r => setTimeout(r, 3000))
      } catch (err: any) {
        logger.warn(`[sync:mairies-13] ${mairie.name} error:`, err.message)
        errors.push(`${mairie.name}: ${err.message}`)
      }
    }

    const result = await upsertMarches(supabase, allMarches, 'mairie-13')
    const details = errors.length > 0 ? `Errors: ${errors.join('; ')}` : undefined

    await finishSyncJob(supabase, jobId, {
      source: 'mairie-13', zone: '13-paca',
      ...result,
      details,
    })

    return NextResponse.json({
      success: true,
      ...result,
      total_fetched: allMarches.length,
      mairies_scanned: MAIRIES.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err: any) {
    logger.error('[sync:mairies-13] Fatal error:', err)
    await failSyncJob(supabase, jobId, err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

function parseMarieHtml(html: string, mairie: MairieSite): SyncedMarche[] {
  const marches: SyncedMarche[] = []

  // Strategy: extract text blocks that contain marché-related keywords
  // Look for common HTML patterns: <h2>, <h3>, <a>, <li> containing marché info

  // Remove scripts and styles
  const cleanHtml = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')

  // Extract potential marché titles from headings and links
  const patterns = [
    // Links with marché text
    /<a[^>]*href="([^"]*)"[^>]*>([^<]*(?:march|appel|consultation|travaux|MAPA)[^<]*)<\/a>/gi,
    // Headings
    /<h[2-4][^>]*>([^<]*(?:march|appel|consultation|travaux|MAPA)[^<]*)<\/h[2-4]>/gi,
    // List items
    /<li[^>]*>([^<]*(?:march|appel|consultation|travaux|MAPA)[^<]*)<\/li>/gi,
  ]

  for (const pattern of patterns) {
    const matches = cleanHtml.matchAll(pattern)
    for (const match of matches) {
      const linkHref = match[1] && match[1].startsWith('/') ? `${mairie.baseUrl}${match[1]}` : match[1] || ''
      const text = (match[2] || match[1] || '').trim()

      if (!text || text.length < 15 || text.length > 500) continue

      // Check if BTP-related
      const textLower = text.toLowerCase()
      const isBtp = BTP_KEYWORDS.some(kw => textLower.includes(kw))
      if (!isBtp) continue

      // Try to extract date limit from nearby text
      const dateMatch = text.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/)?.[1]
      let deadline: string | undefined
      if (dateMatch) {
        const parts = dateMatch.split(/[\/\-]/)
        if (parts.length === 3) {
          const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2]
          deadline = `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
        }
      }

      // Extract montant if present
      const montantMatch = text.match(/(\d[\d\s]*[\d])\s*\u20ac/)?.[1]
      const montant = montantMatch ? parseFloat(montantMatch.replace(/\s/g, '')) : undefined

      marches.push({
        source: 'mairie-13',
        source_id: `mairie-${mairie.name.toLowerCase().replace(/\s/g, '-')}-${Buffer.from(text.slice(0, 50)).toString('base64').slice(0, 20)}`,
        url_source: linkHref || `${mairie.baseUrl}${mairie.path}`,
        title: text.slice(0, 500),
        description: `March\u00e9 public ${mairie.name}\n${text}`,
        category: 'travaux',
        pays: 'FR',
        zone_test: '13-paca',
        location_city: mairie.name,
        departement: '13',
        budget_min: montant,
        montant_estime: montant,
        acheteur: `Mairie de ${mairie.name}`,
        date_publication: new Date().toISOString(),
        deadline,
        procedure_type: 'MAPA',
        langue: 'fr',
        status: 'open',
        urgency: deadline ? 'normal' : 'normal',
      })
    }
  }

  return marches
}

// Vercel cron sends GET — delegate to POST handler
export async function GET(request: NextRequest) {
  return POST(request)
}
