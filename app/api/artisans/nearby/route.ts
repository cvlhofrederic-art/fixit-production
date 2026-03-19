import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { haversineDistance } from '@/lib/geo'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// GET /api/artisans/nearby?lat=48.85&lng=2.35&radius=30&country=FR&category=plomberie
export async function GET(request: NextRequest) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`artisans_nearby_${ip}`, 30, 60_000))) {
    return rateLimitResponse()
  }

  const url = new URL(request.url)
  const lat = parseFloat(url.searchParams.get('lat') || '')
  const lng = parseFloat(url.searchParams.get('lng') || '')
  const radius = Math.min(parseFloat(url.searchParams.get('radius') || '30'), 100)
  const country = url.searchParams.get('country') || null
  const category = url.searchParams.get('category') || null

  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json({ error: 'lat and lng are required (valid GPS coordinates)' }, { status: 400 })
  }

  try {
    // Try using RPC function first (faster, server-side distance calc)
    const { data: rpcData, error: rpcError } = await supabaseAdmin
      .rpc('search_artisans_nearby', {
        user_lat: lat,
        user_lng: lng,
        radius_km: radius,
        country_filter: country,
        category_filter: category,
      })

    if (!rpcError && rpcData) {
      return NextResponse.json({
        artisans: rpcData,
        count: rpcData.length,
        search: { lat, lng, radius_km: radius, country },
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      })
    }

    // Fallback: client-side distance calc if RPC function not available
    logger.warn('[artisans/nearby] RPC fallback:', rpcError?.message)

    let query = supabaseAdmin
      .from('profiles_artisan')
      .select('id, user_id, company_name, bio, categories, hourly_rate, rating_avg, rating_count, verified, active, zone_radius_km, company_city, company_postal_code, profile_photo_url, country, latitude, longitude')
      .eq('active', true)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)

    if (country) {
      query = query.eq('country', country)
    }

    const { data: artisans, error } = await query.limit(200)

    if (error) {
      logger.error('[artisans/nearby] Query error:', error)
      return NextResponse.json({ error: 'Erreur de recherche' }, { status: 500 })
    }

    // Calculate distance and filter
    const results = (artisans || [])
      .map(a => ({
        ...a,
        distance_km: haversineDistance(lat, lng, a.latitude!, a.longitude!),
      }))
      .filter(a => a.distance_km <= radius)
      .filter(a => !category || (a.categories || []).includes(category))
      .sort((a, b) => a.distance_km - b.distance_km)
      .slice(0, 50)

    return NextResponse.json({
      artisans: results,
      count: results.length,
      search: { lat, lng, radius_km: radius, country },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    })
  } catch (error) {
    logger.error('[artisans/nearby] Error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
