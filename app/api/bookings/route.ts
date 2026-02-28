import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { createBookingSchema, validateBody } from '@/lib/validation'

// GET: Fetch future bookings for an artisan (public — only slot data, no personal info)
export async function GET(request: NextRequest) {
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
    .select('id, booking_date, booking_time, duration_minutes, status')
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
    const validation = validateBody(createBookingSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
    const { artisan_id, service_id, booking_date, booking_time, duration_minutes, address, notes, price_ht, price_ttc, status } = validation.data
    const dur = duration_minutes

    // ── Fetch artisan profile for notifications ────────────────────────
    const { data: artisanProfile } = await supabaseAdmin
      .from('profiles_artisan')
      .select('user_id, company_name')
      .eq('id', artisan_id)
      .single()

    const isAutoAccept = false

    // ── Build insert data ──────────────────────────────────────────────
    const insertData: Record<string, unknown> = {
      artisan_id,
      booking_date,
      booking_time,
      duration_minutes: dur,
      address: address ? String(address).substring(0, 500) : 'A definir',
      notes: notes ? String(notes).substring(0, 1000) : '',
      price_ht: price_ht || 0,
      price_ttc: price_ttc || 0,
      status: isAutoAccept ? 'confirmed' : (status || 'pending'),
    }

    if (isAutoAccept) {
      insertData.confirmed_at = new Date().toISOString()
    }

    if (service_id) {
      insertData.service_id = service_id
    }

    // Attach client_id from authenticated user
    insertData.client_id = user.id

    // ── Ensure profiles_client exists (FK constraint) ────────────────
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles_client')
      .select('id')
      .eq('id', user.id)
      .single()

    if (!existingProfile) {
      const meta = user.user_metadata || {}
      await supabaseAdmin.from('profiles_client').insert({
        id: user.id,
        first_name: meta.full_name?.split(' ')[0] || null,
        last_name: meta.full_name?.split(' ').slice(1).join(' ') || null,
        phone: meta.phone || null,
        address: meta.address || null,
      })
    }

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('Error creating booking:', error)
      return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 })
    }

    // ── Notify artisan of new booking ─────────────────────────────────
    try {
      if (artisanProfile?.user_id) {
        // Get service name for notification
        let serviceName = 'Intervention'
        if (service_id) {
          const { data: svc } = await supabaseAdmin
            .from('services')
            .select('name')
            .eq('id', service_id)
            .single()
          if (svc?.name) serviceName = svc.name
        }

        // Extract client name from notes
        const clientMatch = (notes || '').match(/Client:\s*([^|]+)/)
        const clientName = clientMatch ? clientMatch[1].trim() : 'Un client'

        // Format date for notification
        const dateObj = new Date(booking_date + 'T00:00:00')
        const dateFormatted = dateObj.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
        const timeFormatted = booking_time.substring(0, 5)

        const notifTitle = isAutoAccept
          ? '✅ RDV auto-confirmé'
          : '📅 Nouveau rendez-vous !'
        const notifBody = isAutoAccept
          ? `${clientName} a réservé "${serviceName}" le ${dateFormatted} à ${timeFormatted}. RDV confirmé automatiquement.`
          : `${clientName} souhaite réserver "${serviceName}" le ${dateFormatted} à ${timeFormatted}. Confirmez ou refusez dans les 48h.`

        await supabaseAdmin
          .from('artisan_notifications')
          .insert({
            artisan_id: artisanProfile.user_id,
            type: 'new_booking',
            title: notifTitle,
            body: notifBody,
            read: false,
            data_json: {
              booking_id: data.id,
              client_name: clientName,
              service_name: serviceName,
              booking_date,
              booking_time: timeFormatted,
              action_required: !isAutoAccept,
              auto_accepted: isAutoAccept,
            },
            created_at: new Date().toISOString(),
          })
      }
    } catch (notifErr) {
      // Don't fail booking creation if notification fails
      console.error('Error sending artisan notification:', notifErr)
    }

    return NextResponse.json({ data })
  } catch (e: unknown) {
    console.error('Server error creating booking:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
