import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

// ── POST /api/wallet-sync — Synchroniser les documents wallet artisan → syndic ──
// Appelé par l'artisan après upload/suppression d'un document wallet
// Met à jour automatiquement les fiches syndic_artisans liées

export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  if (!checkRateLimit(`wallet_sync_${ip}`, 20, 60_000)) return rateLimitResponse()

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
      console.error('[WALLET_SYNC] Fetch error:', fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
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
        // Lier ces records à l'artisan_user_id pour les prochaines syncs
        for (const record of emailRecords) {
          await supabaseAdmin
            .from('syndic_artisans')
            .update({ artisan_user_id: user.id, updated_at: new Date().toISOString() })
            .eq('id', record.id)
        }
        console.info(`[WALLET_SYNC] Linked ${emailRecords.length} records by email ${user.email}`)
      }
    }

    if (records.length === 0) {
      // Pas de cabinet lié — pas d'erreur, juste rien à synchroniser
      return NextResponse.json({ success: true, synced: 0 })
    }

    // Mapper les clés wallet → colonnes syndic_artisans
    const updateFields: Record<string, unknown> = {}

    if (docKey === 'rc_pro') {
      updateFields.rc_pro_valide = !!hasDocument
      updateFields.rc_pro_expiration = hasDocument && expiryDate ? expiryDate : null
    }

    // On pourrait étendre ici pour d'autres documents (assurance décennale, etc.)

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json({ success: true, synced: 0, message: 'Pas de champ syndic à synchroniser pour ce document' })
    }

    // Mettre à jour toutes les fiches liées
    let synced = 0
    for (const record of records) {
      const { error: updateError } = await supabaseAdmin
        .from('syndic_artisans')
        .update({ ...updateFields, updated_at: new Date().toISOString() })
        .eq('id', record.id)

      if (!updateError) synced++
      else console.error(`[WALLET_SYNC] Update error for record ${record.id}:`, updateError)
    }

    return NextResponse.json({ success: true, synced })
  } catch (e: any) {
    console.error('[WALLET_SYNC] Error:', e)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
