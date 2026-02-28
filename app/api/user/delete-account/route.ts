import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

// DELETE /api/user/delete-account
// RGPD Art. 17 — Droit à l'effacement
// Supprime toutes les données personnelles de l'utilisateur connecté
export async function DELETE(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }

  const ip = getClientIP(request)
  if (!checkRateLimit(`delete_account_${ip}`, 3, 60_000)) return rateLimitResponse()

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const userId = user.id
  const errors: string[] = []

  try {
    // 1. Supprimer les messages de booking (anonymiser)
    const { error: msgErr } = await supabaseAdmin
      .from('booking_messages')
      .delete()
      .eq('sender_id', userId)
    if (msgErr) errors.push(`booking_messages: ${msgErr.message}`)

    // 2. Supprimer les bookings (en tant que client)
    const { error: bookErr } = await supabaseAdmin
      .from('bookings')
      .delete()
      .eq('client_id', userId)
    if (bookErr) errors.push(`bookings: ${bookErr.message}`)

    // 3. Supprimer le profil artisan si existe
    const { error: artErr } = await supabaseAdmin
      .from('profiles_artisan')
      .delete()
      .eq('user_id', userId)
    if (artErr) errors.push(`profiles_artisan: ${artErr.message}`)

    // 4. Supprimer les services artisan
    const { data: artisan } = await supabaseAdmin
      .from('profiles_artisan')
      .select('id')
      .eq('user_id', userId)
      .single()
    if (artisan) {
      await supabaseAdmin.from('services').delete().eq('artisan_id', artisan.id)
    }

    // 5. Supprimer les tokens OAuth syndic
    const { error: oauthErr } = await supabaseAdmin
      .from('syndic_oauth_tokens')
      .delete()
      .eq('syndic_id', userId)
    if (oauthErr) errors.push(`syndic_oauth_tokens: ${oauthErr.message}`)

    // 6. Supprimer les emails analysés syndic
    const { error: emailErr } = await supabaseAdmin
      .from('syndic_emails_analysed')
      .delete()
      .eq('syndic_id', userId)
    if (emailErr) errors.push(`syndic_emails_analysed: ${emailErr.message}`)

    // 7. Supprimer l'utilisateur auth (cascade les RLS-linked data)
    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (authErr) errors.push(`auth.users: ${authErr.message}`)

    if (errors.length > 0) {
      return NextResponse.json({
        success: false,
        message: 'Suppression partielle — certaines tables ont échoué',
        errors,
      }, { status: 207 })
    }

    return NextResponse.json({
      success: true,
      message: 'Toutes vos données personnelles ont été supprimées conformément au RGPD Art. 17',
      deleted_at: new Date().toISOString(),
    })

  } catch (err: any) {
    console.error('[DELETE-ACCOUNT] Erreur:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
