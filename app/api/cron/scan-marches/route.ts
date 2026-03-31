'use server'
import { NextResponse, type NextRequest } from 'next/server'
import { scanMarches } from '@/lib/marches-scanner'
import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

export const maxDuration = 300

// ── GET /api/cron/scan-marches — Cron weekly scan (Vercel Cron) ──────────────
// Schedule: every Monday at 6:00 AM (configured in vercel.json)
// Scans BOAMP + TED + BASE.gov for ALL corps de métier, stores in Supabase
// Results stay visible until the next weekly cron replaces them

// All corps de métier from the Bourse aux Marchés UI
const ALL_METIERS = [
  // FR keywords
  'plombier', 'plomberie', 'canalisateur',
  'electricien', 'electricite', 'courant fort',
  'peintre', 'peinture', 'ravalement',
  'serrurier', 'serrurerie', 'metallerie',
  'ascenseur', 'elevateur',
  'nettoyage', 'entretien',
  'jardinage', 'espaces verts',
  'etancheite', 'impermeabilisation',
  'macon', 'gros oeuvre', 'construction',
  'climatisation', 'chauffage', 'ventilation',
  'securite', 'alarme', 'surveillance',
  'gaz', 'chauffagiste',
  'couvreur', 'toiture', 'zinguerie',
  'debouchage', 'assainissement',
  'menuisier', 'menuiserie', 'charpente',
  'vitrier', 'vitrerie', 'miroiterie',
  'demenagement', 'transport',
  'renovation', 'refection', 'rehabilitation',
  'isolation', 'thermique', 'acoustique',
]

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (Vercel sends CRON_SECRET header)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logger.info('[cron/scan-marches] Starting weekly scan for all corps de métier...')

    // ── 1. Cleanup old scan results (> 8 days) to avoid stale data ──────────
    const cutoff = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
    const { count: deleted } = await supabaseAdmin
      .from('marches')
      .delete({ count: 'exact' })
      .like('source_type', 'scan_%')
      .lt('created_at', cutoff)
    logger.info(`[cron/scan-marches] Cleaned up ${deleted ?? 0} stale scan results`)

    // ── 2. Scan BOAMP + TED + BASE.gov for all corps de métier ──────────────
    const result = await scanMarches({
      country: 'both',
      daysBack: 7, // full week since last cron
      metiers: ALL_METIERS,
    })

    let inserted = 0
    let skipped = 0

    // ── 3. Upsert new marches in Supabase ───────────────────────────────────
    for (const marche of result.marches) {
      // Skip duplicates by title + publisher
      const { data: existing } = await supabaseAdmin
        .from('marches')
        .select('id')
        .eq('title', marche.title)
        .eq('publisher_name', marche.buyer)
        .limit(1)
        .maybeSingle()

      if (existing) {
        skipped++
        continue
      }

      const category = marche.scoring?.matchedMetiers?.[0] || 'outro'

      const { error: insertErr } = await supabaseAdmin
        .from('marches')
        .insert({
          title: marche.title.slice(0, 500),
          description: `${marche.description}\n\n📊 Score: ${marche.scoring?.scoreTotal || 0}/100 | Source: ${marche.source.toUpperCase()}\n🔗 ${marche.sourceUrl}`,
          category,
          publisher_name: marche.buyer,
          publisher_type: 'entreprise',
          location_city: marche.location,
          budget_min: marche.budgetMin || 0,
          budget_max: marche.budgetMax || marche.budgetMin || 0,
          deadline: marche.deadline || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
          status: 'open',
          urgency: 'normal',
          source_type: `scan_${marche.source}`,
          access_token: `scan-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        })

      if (insertErr) {
        logger.warn(`[cron/scan-marches] Insert error for "${marche.title.slice(0, 50)}":`, insertErr.message)
      } else {
        inserted++
      }
    }

    const summary = {
      scannedAt: result.meta.scannedAt,
      totalScanned: result.meta.totalScanned,
      totalFiltered: result.meta.totalFiltered,
      inserted,
      skipped,
      deleted: deleted ?? 0,
      sources: result.meta.sources,
    }

    logger.info(`[cron/scan-marches] Done: ${inserted} inserted, ${skipped} skipped, ${deleted ?? 0} deleted, ${result.meta.totalScanned} scanned`)

    return NextResponse.json({ success: true, ...summary })
  } catch (err) {
    logger.error('[cron/scan-marches] Error:', err)
    return NextResponse.json({ error: 'Scan failed' }, { status: 500 })
  }
}
