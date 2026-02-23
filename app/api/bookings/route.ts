import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

// GET: Fetch future bookings for an artisan
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  const ip = getClientIP(request)
  if (!checkRateLimit(`bookings_get_${ip}`, 60, 60_000)) return rateLimitResponse()

  const { searchParams } = new URL(request.url)
  const artisanId = searchParams.get('artisan_id')

  if (!artisanId) {
    return NextResponse.json({ error: 'artisan_id is required' }, { status: 400 })
  }

  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabaseAdmin
    .from('bookings')
    .select('*')
    .eq('artisan_id', artisanId)
    .gte('booking_date', today)
    .in('status', ['confirmed', 'pending'])

  if (error) {
    console.error('Error fetching bookings:', error)
    return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 })
  }

  return NextResponse.json({ data })
}

// POST: Create a new booking
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    const ip = getClientIP(request)
    if (!checkRateLimit(`bookings_post_${ip}`, 20, 60_000)) return rateLimitResponse()

    const body = await request.json()
    const { artisan_id, service_id, booking_date, booking_time, duration_minutes, address, notes, price_ht, price_ttc, status } = body

    if (!artisan_id || !booking_date || !booking_time) {
      return NextResponse.json({ error: 'artisan_id, booking_date, and booking_time are required' }, { status: 400 })
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(booking_date)) {
      return NextResponse.json({ error: 'Invalid booking_date format (YYYY-MM-DD)' }, { status: 400 })
    }

    // Validate time format
    if (!/^\d{2}:\d{2}(:\d{2})?$/.test(booking_time)) {
      return NextResponse.json({ error: 'Invalid booking_time format (HH:MM)' }, { status: 400 })
    }

    // Validate duration
    const dur = duration_minutes || 60
    if (dur < 15 || dur > 480) {
      return NextResponse.json({ error: 'duration_minutes must be between 15 and 480' }, { status: 400 })
    }

    // Validate prices
    if (price_ht !== undefined && price_ht < 0) {
      return NextResponse.json({ error: 'price_ht cannot be negative' }, { status: 400 })
    }
    if (price_ttc !== undefined && price_ttc < 0) {
      return NextResponse.json({ error: 'price_ttc cannot be negative' }, { status: 400 })
    }

    const insertData: Record<string, unknown> = {
      artisan_id,
      booking_date,
      booking_time,
      duration_minutes: dur,
      address: address ? String(address).substring(0, 500) : 'A definir',
      notes: notes ? String(notes).substring(0, 1000) : '',
      price_ht: price_ht || 0,
      price_ttc: price_ttc || 0,
      status: status || 'pending',
    }

    if (service_id) {
      insertData.service_id = service_id
    }

    // Attach client_id from authenticated user
    insertData.client_id = user.id

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('Error creating booking:', error)
      return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (e: unknown) {
    console.error('Server error creating booking:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
