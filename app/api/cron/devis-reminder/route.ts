// ══════════════════════════════════════════════════════════════════════════════
// GET /api/cron/devis-reminder — Relance J+3 : devis non signés
// Envoie un email aux clients qui ont reçu un devis il y a 3+ jours sans signer
// Exécuté chaque jour à 10h00 via Vercel Cron
// Auth par CRON_SECRET header
// ══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { sendEmail, templateDevisReminder } from '@/lib/email'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  // Guard explicite : sans CRON_SECRET défini côté Worker, un appel
  // « Authorization: Bearer undefined » passerait la comparaison brute.
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = { sent: 0, errors: 0, skipped: 0 }

  try {
    // Devis envoyés il y a 3+ jours
    const threeDaysAgo = new Date()
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
    const cutoff = threeDaysAgo.toISOString()

    // Fetch devis_sent messages older than 3 days
    const { data: messages, error } = await supabaseAdmin
      .from('booking_messages')
      .select('id, booking_id, sender_id, metadata, created_at')
      .eq('type', 'devis_sent')
      .lte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      logger.error('[cron/devis-reminder] Query error:', { error: error.message })
      return NextResponse.json({ error: 'Query failed' }, { status: 500 })
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({ message: 'No pending devis', results })
    }

    // TSQ-08 : batcher les lookups AVANT la boucle (évitait ~4 round-trips par devis)
    const bookingIds = [...new Set(messages.map(m => m.booking_id))]

    // 1 seul SELECT : tous les devis_signed des bookings concernés
    const { data: signedMsgs, error: signedError } = await supabaseAdmin
      .from('booking_messages')
      .select('booking_id')
      .eq('type', 'devis_signed')
      .in('booking_id', bookingIds)

    if (signedError) {
      logger.error('[cron/devis-reminder] Signed query error:', { error: signedError.message })
      return NextResponse.json({ error: 'Query failed' }, { status: 500 })
    }
    const signedBookingIds = new Set((signedMsgs || []).map(m => m.booking_id))

    // 1 seul SELECT : tous les bookings + artisan associé
    const { data: bookingRows, error: bookingsError } = await supabaseAdmin
      .from('bookings')
      .select('id, client_id, artisan_id, profiles_artisan:artisan_id(company_name, user_id)')
      .in('id', bookingIds)

    if (bookingsError) {
      logger.error('[cron/devis-reminder] Bookings query error:', { error: bookingsError.message })
      return NextResponse.json({ error: 'Query failed' }, { status: 500 })
    }
    const bookingMap = new Map((bookingRows || []).map(b => [b.id, b]))

    // getUserById reste par-utilisateur (API auth) mais dédupliqué (client + artisan)
    type AuthUser = NonNullable<Awaited<ReturnType<typeof supabaseAdmin.auth.admin.getUserById>>['data']['user']>
    const userCache = new Map<string, AuthUser | null>()
    const getUserCached = async (userId: string): Promise<AuthUser | null> => {
      const cached = userCache.get(userId)
      if (cached !== undefined) return cached
      const { data } = await supabaseAdmin.auth.admin.getUserById(userId)
      const user = data?.user ?? null
      userCache.set(userId, user)
      return user
    }

    for (const msg of messages) {
      try {
        // Lecture jsonb → métier (champs posés par l'envoi du devis)
        const meta = (msg.metadata ?? {}) as { signed?: boolean; docNumber?: string; totalStr?: string }

        // Skip if already signed
        if (meta.signed === true) { results.skipped++; continue }

        // Check if a devis_signed message exists for this booking (lookup batché)
        if (signedBookingIds.has(msg.booking_id)) { results.skipped++; continue }

        // Check if we already sent a reminder for this devis (avoid spam)
        // Use a simple check: if created_at is older than 6 days, skip (only remind once at J+3)
        const sixDaysAgo = new Date()
        sixDaysAgo.setDate(sixDaysAgo.getDate() - 6)
        if (!msg.created_at || new Date(msg.created_at) < sixDaysAgo) { results.skipped++; continue }

        // Booking + client (lookup batché)
        const booking = bookingMap.get(msg.booking_id)
        if (!booking?.client_id) { results.skipped++; continue }

        const clientUser = await getUserCached(booking.client_id)
        if (!clientUser?.email) { results.skipped++; continue }

        const artisan = booking.profiles_artisan
        let artisanName = artisan?.company_name || 'Artisan'
        if (artisan?.user_id) {
          const artisanUser = await getUserCached(artisan.user_id)
          if (artisanUser?.user_metadata?.full_name) artisanName = artisanUser.user_metadata.full_name
        }

        const emailData = templateDevisReminder({
          clientName: clientUser.user_metadata?.full_name || clientUser.email.split('@')[0],
          artisanName,
          companyName: artisan?.company_name || 'Artisan',
          docNumber: meta.docNumber || '---',
          totalStr: meta.totalStr || '---',
          locale: clientUser.user_metadata?.locale === 'pt' ? 'pt' : 'fr',
        })

        const result = await sendEmail({ to: clientUser.email, ...emailData })
        if (result.success) results.sent++
        else { results.errors++; logger.warn('[cron/devis-reminder] Email failed:', { msgId: msg.id, error: result.error }) }
      } catch (e) {
        results.errors++
        logger.error('[cron/devis-reminder] Error:', { msgId: msg.id, error: String(e) })
      }
    }

    logger.info('[cron/devis-reminder] Completed', results)
    return NextResponse.json({ message: 'Reminders sent', results })
  } catch (e) {
    logger.error('[cron/devis-reminder] Fatal:', { error: String(e) })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
