import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

// GET: Fetch a single booking by ID
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`booking_detail_${ip}`, 60, 60_000))) return rateLimitResponse()

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    // Validate UUID format to prevent invalid queries
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: 'Invalid booking ID format' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select('id, artisan_id, client_id, service_id, booking_date, booking_time, duration_minutes, status, notes, address, price_ttc, price_ht, created_at')
      .eq('id', id)
      .single()

    if (error) {
      logger.error('Error fetching booking detail:', error)
      return NextResponse.json({ error: 'Failed to fetch booking' }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // IDOR check : seul l'artisan, le client ou le syndic concerné peut voir ce booking
    // Note : artisan_id = profil artisan (pas user.id), donc on doit vérifier via profiles_artisan
    let canAccess = false

    // 1. Vérifier si l'utilisateur est le client
    if (data.client_id === user.id) {
      canAccess = true
    }

    // 2. Vérifier si l'utilisateur est l'artisan (artisan_id = profil ID, pas user.id)
    if (!canAccess) {
      const { data: artisanProfile } = await supabaseAdmin
        .from('profiles_artisan')
        .select('id')
        .eq('user_id', user.id)
        .eq('id', data.artisan_id)
        .single()
      if (artisanProfile) canAccess = true
    }

    // 3. Vérifier si l'utilisateur est un syndic qui a assigné cette mission
    // Les missions syndic ont client_id = user.id du syndic (cf. assign-mission)
    // et les notes commencent par "[Mission Syndic]"
    if (!canAccess && data.client_id === user.id && data.notes?.includes('[Mission Syndic]')) {
      canAccess = true
    }

    if (!canAccess) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const response = NextResponse.json({ data })
    response.headers.set('Cache-Control', 'private, max-age=0, s-maxage=120, stale-while-revalidate=300')
    return response
  } catch (err) {
    logger.error('[booking-detail/GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
