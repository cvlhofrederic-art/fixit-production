import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { createBookingSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { sendEmail, templateBookingCreated } from '@/lib/email'

// GET: Fetch future bookings for an artisan (public — only slot data, no personal info)
export async function GET(request: NextRequest) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`bookings_get_${ip}`, 60, 60_000))) return rateLimitResponse()

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
    logger.error('Failed to fetch bookings', { module: 'api/bookings', artisanId }, error as Error)
    return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 })
  }

  const response = NextResponse.json({ data })
  response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
  return response
}

// POST: Create a new booking
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`bookings_post_${ip}`, 20, 60_000))) return rateLimitResponse()

    const body = await request.json()
    const validation = validateBody(createBookingSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
    const { artisan_id, service_id, booking_date, booking_time, duration_minutes, address, notes, price_ht, price_ttc, status } = validation.data
    const dur = duration_minutes

    // ── Fetch artisan profile + ensure client profile (parallel) ──────
    const [{ data: artisanProfile }, { data: existingProfile }] = await Promise.all([
      supabaseAdmin.from('profiles_artisan').select('user_id, company_name').eq('id', artisan_id).single(),
      supabaseAdmin.from('profiles_client').select('id').eq('id', user.id).single(),
    ])

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

    let isAutoAccept = false
    if (service_id) {
      const { data: svc } = await supabaseAdmin
        .from('services')
        .select('validation_auto, delai_minimum_heures')
        .eq('id', service_id)
        .single()
      isAutoAccept = svc?.validation_auto === true

      // Enforce minimum delay
      const delai = svc?.delai_minimum_heures || 0
      if (delai > 0) {
        const slotTs = new Date(`${booking_date}T${booking_time}:00`).getTime()
        const minTs = Date.now() + delai * 60 * 60 * 1000
        if (slotTs < minTs) {
          return NextResponse.json(
            { error: `Ce créneau ne respecte pas le délai minimum de ${delai}h avant intervention.` },
            { status: 400 }
          )
        }
      }
    }

    // ── Build insert data ──────────────────────────────────────────────
    const insertData: Record<string, unknown> = {
      artisan_id,
      client_id: user.id,
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

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      logger.error('Error creating booking:', error)
      return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 })
    }

    // ── Notify artisan of new booking ─────────────────────────────────
    try {
      if (!artisanProfile?.user_id) {
        logger.warn(`[bookings] ⚠️ Cannot notify artisan: artisan_id=${artisan_id} has no user_id or profile not found`)
      }
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

        // Format date for notification (locale-aware)
        const dateObj = new Date(booking_date + 'T12:00:00')
        const artisanCountry = artisanProfile?.company_name ? 'fr-FR' : 'fr-FR'
        const dateFormatted = dateObj.toLocaleDateString(artisanCountry, { weekday: 'long', day: 'numeric', month: 'long' })
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

        // Send email to artisan
        const { data: artisanAuthData } = await supabaseAdmin.auth.admin.getUserById(artisanProfile.user_id)
        if (artisanAuthData?.user?.email) {
          const emailData = templateBookingCreated({
            artisanName: artisanProfile.company_name || 'Artisan',
            clientName,
            serviceName,
            bookingDate: dateFormatted,
            bookingTime: timeFormatted,
            address: address || undefined,
          })
          sendEmail({ to: artisanAuthData.user.email, ...emailData }).catch(e =>
            logger.warn('[bookings] Email send failed:', { error: String(e) })
          )
        }
      }
    } catch (notifErr) {
      // Don't fail booking creation if notification fails
      logger.error('Error sending artisan notification:', notifErr)
    }

    return NextResponse.json({ data })
  } catch (e: unknown) {
    logger.error('Server error creating booking:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
