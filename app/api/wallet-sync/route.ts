import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

// ── POST /api/wallet-sync — Synchroniser les documents wallet artisan → syndic ──
// Appelé par l'artisan après upload/suppression d'un document wallet
// Met à jour automatiquement les fiches syndic_artisans liées

export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`wallet_sync_${ip}`, 20, 60_000))) return rateLimitResponse()

  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { docKey, hasDocument, expiryDate } = body

    if (!docKey) {
      return NextResponse.json({ error: 'docKey requis' }, { status: 400 })
    }

    // Trouver toutes les fiches syndic_artisans liées à cet artisan (par user_id)
    const { data: linkedRecords, error: fetchError } = await supabaseAdmin
      .from('syndic_artisans')
      .select('id, cabinet_id')
      .eq('artisan_user_id', user.id)

    if (fetchError) {
      logger.error('[WALLET_SYNC] Fetch error:', fetchError)
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }

    // Si aucun résultat par user_id, essayer par email (rattrapage pour artisans non liés)
    let records = linkedRecords || []
    if (records.length === 0 && user.email) {
      const { data: emailRecords } = await supabaseAdmin
        .from('syndic_artisans')
        .select('id, cabinet_id')
        .eq('email', user.email)

      if (emailRecords && emailRecords.length > 0) {
        records = emailRecords
        // Lier ces records à l'artisan_user_id pour les prochaines syncs (batch)
        const emailRecordIds = emailRecords.map(r => r.id)
        await supabaseAdmin
          .from('syndic_artisans')
          .update({ artisan_user_id: user.id, updated_at: new Date().toISOString() })
          .in('id', emailRecordIds)
        // Records linked by email for future syncs
      }
    }

    if (records.length === 0) {
      // Pas de cabinet lié — pas d'erreur, juste rien à synchroniser
      return NextResponse.json({ success: true, synced: 0 })
    }

    // Mapper les clés wallet → colonnes syndic_artisans
    const updateFields: Record<string, unknown> = {}

    if (docKey === 'rc_pro' || docKey === 'assurance_pro') {
      updateFields.rc_pro_valide = !!hasDocument
      updateFields.rc_pro_expiration = hasDocument && expiryDate ? expiryDate : null
    }

    // Assurance décennale (clés : 'decennale' depuis mobile, 'assurance_decennale' depuis desktop)
    if (docKey === 'decennale' || docKey === 'assurance_decennale') {
      updateFields.assurance_decennale_valide = !!hasDocument
      updateFields.assurance_decennale_expiration = hasDocument && expiryDate ? expiryDate : null
    }

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json({ success: true, synced: 0, message: 'Pas de champ syndic à synchroniser pour ce document' })
    }

    // Mettre à jour toutes les fiches liées en une seule requête batch
    const recordIds = records.map(r => r.id)
    const { error: updateError } = await supabaseAdmin
      .from('syndic_artisans')
      .update({ ...updateFields, updated_at: new Date().toISOString() })
      .in('id', recordIds)

    if (updateError) {
      logger.error('[WALLET_SYNC] Batch update error:', updateError)
      return NextResponse.json({ error: 'Erreur de synchronisation' }, { status: 500 })
    }

    return NextResponse.json({ success: true, synced: recordIds.length })
  } catch (error: unknown) {
    logger.error('[WALLET_SYNC] Error:', error)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
