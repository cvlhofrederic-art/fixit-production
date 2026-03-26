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
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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

    for (const msg of messages) {
      try {
        const meta = msg.metadata as Record<string, any> || {}

        // Skip if already signed
        if (meta.signed === true) { results.skipped++; continue }

        // Check if a devis_signed message exists for this booking
        const { data: signedMsg } = await supabaseAdmin
          .from('booking_messages')
          .select('id')
          .eq('booking_id', msg.booking_id)
          .eq('type', 'devis_signed')
          .maybeSingle()

        if (signedMsg) { results.skipped++; continue }

        // Check if we already sent a reminder for this devis (avoid spam)
        // Use a simple check: if created_at is older than 6 days, skip (only remind once at J+3)
        const sixDaysAgo = new Date()
        sixDaysAgo.setDate(sixDaysAgo.getDate() - 6)
        if (new Date(msg.created_at) < sixDaysAgo) { results.skipped++; continue }

        // Fetch booking + client
        const { data: booking } = await supabaseAdmin
          .from('bookings')
          .select('client_id, artisan_id, profiles_artisan:artisan_id(company_name, user_id)')
          .eq('id', msg.booking_id)
          .single()

        if (!booking?.client_id) { results.skipped++; continue }

        const { data: clientAuth } = await supabaseAdmin.auth.admin.getUserById(booking.client_id)
        if (!clientAuth?.user?.email) { results.skipped++; continue }

        const artisan = booking.profiles_artisan as any
        let artisanName = artisan?.company_name || 'Artisan'
        if (artisan?.user_id) {
          const { data: artisanAuth } = await supabaseAdmin.auth.admin.getUserById(artisan.user_id)
          if (artisanAuth?.user?.user_metadata?.full_name) artisanName = artisanAuth.user.user_metadata.full_name
        }

        const emailData = templateDevisReminder({
          clientName: clientAuth.user.user_metadata?.full_name || clientAuth.user.email.split('@')[0],
          artisanName,
          companyName: artisan?.company_name || 'Artisan',
          docNumber: meta.docNumber || '---',
          totalStr: meta.totalStr || '---',
        })

        const result = await sendEmail({ to: clientAuth.user.email, ...emailData })
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
