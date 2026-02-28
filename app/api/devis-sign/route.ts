import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

/**
 * POST /api/devis-sign
 * Client signe un devis reçu dans la messagerie
 * Body: { booking_id, message_id, signer_name }
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }
  const ip = getClientIP(request)
  if (!checkRateLimit(`devis_sign_${ip}`, 10, 60_000)) return rateLimitResponse()

  try {
    const body = await request.json()
    const { booking_id, message_id, signer_name } = body

    if (!booking_id || !message_id || !signer_name?.trim()) {
      return NextResponse.json(
        { error: 'booking_id, message_id et signer_name sont requis' },
        { status: 400 }
      )
    }

    // Vérifier que l'utilisateur est le client du booking
    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('client_id, artisan_id, notes')
      .eq('id', booking_id)
      .single()

    if (!booking) {
      return NextResponse.json({ error: 'Réservation introuvable' }, { status: 404 })
    }
    if (booking.client_id !== user.id) {
      return NextResponse.json({ error: 'Seul le client peut signer le devis' }, { status: 403 })
    }

    // Récupérer le message devis_sent
    const { data: devisMsg } = await supabaseAdmin
      .from('booking_messages')
      .select('*')
      .eq('id', message_id)
      .eq('booking_id', booking_id)
      .single()

    if (!devisMsg || devisMsg.type !== 'devis_sent') {
      return NextResponse.json({ error: 'Message devis introuvable ou déjà signé' }, { status: 404 })
    }

    // Vérifier si déjà signé
    if (devisMsg.metadata?.signed) {
      return NextResponse.json({ error: 'Ce devis a déjà été signé' }, { status: 400 })
    }

    const signedAt = new Date().toISOString()
    const docNumber = devisMsg.metadata?.docNumber || 'N/A'
    const totalStr = devisMsg.metadata?.totalStr || ''

    // 1. Mettre à jour le message original (marquer comme signé)
    await supabaseAdmin
      .from('booking_messages')
      .update({
        metadata: {
          ...devisMsg.metadata,
          signed: true,
          signed_at: signedAt,
          signer_name: signer_name.trim(),
        },
      })
      .eq('id', message_id)

    // 2. Insérer un message devis_signed côté client
    const clientName = user.user_metadata?.full_name || user.email?.split('@')[0] || signer_name
    const { data: signedMsg, error: insertError } = await supabaseAdmin
      .from('booking_messages')
      .insert({
        booking_id,
        sender_id: user.id,
        sender_role: 'client',
        sender_name: clientName,
        content: `✅ Devis N°${docNumber} signé électroniquement par ${signer_name.trim()}`,
        type: 'devis_signed',
        metadata: {
          ...devisMsg.metadata,
          signed: true,
          signed_at: signedAt,
          signer_name: signer_name.trim(),
        },
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting devis_signed message:', insertError)
      return NextResponse.json({ error: 'Erreur lors de la signature' }, { status: 500 })
    }

    // 3. Notifier l'artisan
    try {
      const { data: artisanProfile } = await supabaseAdmin
        .from('profiles_artisan')
        .select('user_id')
        .eq('id', booking.artisan_id)
        .single()

      if (artisanProfile?.user_id) {
        await supabaseAdmin
          .from('artisan_notifications')
          .insert({
            artisan_id: artisanProfile.user_id,
            type: 'devis_signed',
            title: '✅ Devis signé !',
            body: `${clientName} a signé le devis N°${docNumber} (${totalStr})`,
            read: false,
            data_json: { booking_id, message_id: signedMsg.id, metadata: signedMsg.metadata },
            created_at: new Date().toISOString(),
          })
      }
    } catch (notifErr) {
      console.error('Error sending signature notification:', notifErr)
    }

    return NextResponse.json({ success: true, data: signedMsg })
  } catch (e: unknown) {
    console.error('Server error in devis-sign:', e)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
