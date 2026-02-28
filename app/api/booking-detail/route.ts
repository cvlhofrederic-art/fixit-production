import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

// GET: Fetch a single booking by ID
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  const ip = getClientIP(request)
  if (!checkRateLimit(`booking_detail_${ip}`, 60, 60_000)) return rateLimitResponse()

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
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching booking detail:', error)
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

  // 3. Vérifier si l'utilisateur est le syndic
  if (!canAccess && data.syndic_id && data.syndic_id === user.id) {
    canAccess = true
  }

  if (!canAccess) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  return NextResponse.json({ data })
}
