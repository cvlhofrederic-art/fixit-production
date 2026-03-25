// ══════════════════════════════════════════════════════════════════════════════
// GET /api/cron/booking-reminder — Rappel J-1 : envoie un email aux clients
// dont l'intervention est prévue demain (booking_date = demain, status = confirmed)
// Exécuté chaque jour à 18h00 via Vercel Cron
// Auth par CRON_SECRET header
// ══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { sendEmail, templateBookingReminder } from '@/lib/email'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = { sent: 0, errors: 0, skipped: 0 }

  try {
    // Demain au format YYYY-MM-DD
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split('T')[0]

    // Fetch tous les bookings confirmés pour demain
    const { data: bookings, error } = await supabaseAdmin
      .from('bookings')
      .select('id, client_id, artisan_id, booking_date, booking_time, address, service_id, services(name), profiles_artisan:artisan_id(company_name, user_id)')
      .eq('booking_date', tomorrowStr)
      .eq('status', 'confirmed')

    if (error) {
      logger.error('[cron/booking-reminder] Query error:', { error: error.message })
      return NextResponse.json({ error: 'Query failed' }, { status: 500 })
    }

    if (!bookings || bookings.length === 0) {
      return NextResponse.json({ message: 'No bookings tomorrow', results })
    }

    for (const booking of bookings) {
      try {
        // Fetch client email
        const { data: clientAuth } = await supabaseAdmin.auth.admin.getUserById(booking.client_id)
        if (!clientAuth?.user?.email) {
          results.skipped++
          continue
        }

        const artisan = booking.profiles_artisan as any
        const service = booking.services as any
        const dateFmt = new Date(booking.booking_date + 'T12:00:00').toLocaleDateString('fr-FR', {
          weekday: 'long', day: 'numeric', month: 'long'
        })

        // Fetch artisan name
        let artisanName = artisan?.company_name || 'Artisan'
        if (artisan?.user_id) {
          const { data: artisanAuth } = await supabaseAdmin.auth.admin.getUserById(artisan.user_id)
          if (artisanAuth?.user?.user_metadata?.full_name) {
            artisanName = artisanAuth.user.user_metadata.full_name
          }
        }

        const emailData = templateBookingReminder({
          clientName: clientAuth.user.user_metadata?.full_name || clientAuth.user.email.split('@')[0],
          artisanName,
          companyName: artisan?.company_name || 'Artisan',
          serviceName: service?.name || 'Intervention',
          bookingDate: dateFmt,
          bookingTime: booking.booking_time?.substring(0, 5),
          address: booking.address || undefined,
        })

        const result = await sendEmail({ to: clientAuth.user.email, ...emailData })
        if (result.success) {
          results.sent++
        } else {
          results.errors++
          logger.warn('[cron/booking-reminder] Email failed:', { bookingId: booking.id, error: result.error })
        }
      } catch (e) {
        results.errors++
        logger.error('[cron/booking-reminder] Booking error:', { bookingId: booking.id, error: String(e) })
      }
    }

    logger.info('[cron/booking-reminder] Completed', results)
    return NextResponse.json({ message: 'Reminders sent', results })
  } catch (e) {
    logger.error('[cron/booking-reminder] Fatal error:', { error: String(e) })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
