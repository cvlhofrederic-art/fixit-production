import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

// Mapping slug simulateur → catégories dans profiles_artisan
const SLUG_TO_CATEGORIES: Record<string, string[]> = {
  'plombier':              ['plomberie'],
  'electricien':           ['electricite'],
  'serrurier':             ['serrurerie'],
  'peintre':               ['peinture'],
  'couvreur':              ['toiture'],
  'espaces-verts':         ['espaces-verts'],
  'paysagiste':            ['espaces-verts'],
  'carreleur':             ['carrelage'],
  'climatisation':         ['climatisation', 'chauffage'],
  'macon':                 ['maconnerie'],
  'nettoyage-encombrants': ['nettoyage', 'demenagement'],
  'vitrier':               ['vitrerie'],
  'menuisier':             ['menuiserie'],
  'chauffagiste':          ['chauffage'],
}

function normalizeStr(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[-\s]/g, '')
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const city    = searchParams.get('city')    || ''
    const service = searchParams.get('service') || ''
    const limit   = Math.min(parseInt(searchParams.get('limit') || '6'), 12)

    // Push category filter to DB to avoid fetching irrelevant rows
    const targetCats = SLUG_TO_CATEGORIES[service] || []

    let query = supabaseAdmin
      .from('profiles_artisan')
      .select('id, slug, company_name, bio, categories, hourly_rate, rating_avg, rating_count, verified, city, company_city, company_postal_code, profile_photo_url, experience_years, services(name, price_ttc, duration_minutes, active)')
      .eq('active', true)
      .eq('language', 'fr')
      .order('rating_avg', { ascending: false, nullsFirst: false })
      .limit(50)

    if (targetCats.length > 0) {
      query = query.overlaps('categories', targetCats)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ artisans: [] }, { status: 500 })
    }

    let results = data || []

    // ── Filtre par ville ──────────────────────────────────────────────────────
    if (city.trim()) {
      const cityNorm = normalizeStr(city)
      const isMars = cityNorm.includes('marseille')

      results = results.filter((a) => {
        const haystack = normalizeStr([
          a.city || '',
          a.company_city || '',
          a.company_postal_code || '',
          a.bio || '',
        ].join(' '))

        if (isMars) return haystack.includes('marseille')
        // Pour les autres villes, match partiel sur le nom normalisé
        return cityNorm.split(/\s+/).filter(w => w.length >= 3).some(w => haystack.includes(w))
      })
    }

    // ── Formate la réponse ────────────────────────────────────────────────────
    const formatted = results.slice(0, limit).map((a) => {
      const activeServices = (a.services || []).filter((s: any) => s.active !== false)

      // Prix réels depuis les services de l'artisan
      const prices: { name: string; price_ttc: number; duration_minutes: number }[] = activeServices
        .filter((s: any) => s.price_ttc > 0)
        .slice(0, 3)
        .map((s: any) => ({
          name: s.name,
          price_ttc: s.price_ttc,
          duration_minutes: s.duration_minutes || 60,
        }))

      const minPrice = prices.length > 0 ? Math.min(...prices.map(p => p.price_ttc)) : null
      const displayCity = a.company_city || a.city || null

      return {
        id: a.id,
        slug: a.slug,
        company_name: a.company_name,
        categories: a.categories || [],
        hourly_rate: a.hourly_rate,
        rating_avg: a.rating_avg,
        rating_count: a.rating_count,
        verified: a.verified,
        city: displayCity,
        profile_photo_url: a.profile_photo_url,
        experience_years: a.experience_years,
        prices,          // ← services réels avec prix
        min_price: minPrice,
        source: 'registered' as const,
      }
    })

    return NextResponse.json(
      { artisans: formatted },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
    )
  } catch (err) {
    console.error('[simulateur-artisans/GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
