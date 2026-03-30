import { NextResponse, type NextRequest } from 'next/server'
import { scanMarches } from '@/lib/marches-scanner'
import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

export const maxDuration = 60

// ── GET /api/cron/scan-marches — Cron daily scan (Vercel Cron) ──────────────
// Schedule: every day at 6:00 AM (configured in vercel.json)
// Scans BOAMP + TED + BASE.gov, stores new marches in Supabase

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (Vercel sends CRON_SECRET header)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logger.info('[cron/scan-marches] Starting daily scan...')

    // Scan last 2 days to catch anything missed
    // Include common BTP metiers for keyword filtering on BOAMP
    const btpMetiers = ['couvreur', 'electricien', 'plombier', 'macon', 'peintre', 'menuisier', 'chauffagiste', 'renovation']
    const result = await scanMarches({ country: 'both', daysBack: 2, metiers: btpMetiers })

    let inserted = 0
    let skipped = 0

    // Store new marches in Supabase
    for (const marche of result.marches) {
      // Check if already exists (by sourceId)
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

      // Map source category to our category system
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
      sources: result.meta.sources,
    }

    logger.info(`[cron/scan-marches] Done: ${inserted} inserted, ${skipped} skipped, ${result.meta.totalScanned} scanned`)

    return NextResponse.json({ success: true, ...summary })
  } catch (err) {
    logger.error('[cron/scan-marches] Error:', err)
    return NextResponse.json({ error: 'Scan failed' }, { status: 500 })
  }
}
