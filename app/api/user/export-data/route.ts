import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

// GET /api/user/export-data
// RGPD Art. 20 — Droit à la portabilité des données
// Retourne toutes les données personnelles de l'utilisateur en JSON
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }

  const ip = getClientIP(request)
  if (!checkRateLimit(`export_data_${ip}`, 5, 60_000)) return rateLimitResponse()

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const userId = user.id

  try {
    // 1. Données utilisateur (auth)
    const userData = {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      user_metadata: user.user_metadata,
    }

    // 2. Profil artisan
    const { data: artisanProfile } = await supabaseAdmin
      .from('profiles_artisan')
      .select('*')
      .eq('user_id', userId)
      .single()

    // 3. Services artisan
    let services: any[] = []
    if (artisanProfile) {
      const { data } = await supabaseAdmin
        .from('services')
        .select('*')
        .eq('artisan_id', artisanProfile.id)
      services = data || []
    }

    // 4. Bookings (en tant que client)
    const { data: clientBookings } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('client_id', userId)

    // 5. Bookings (en tant qu'artisan)
    let artisanBookings: any[] = []
    if (artisanProfile) {
      const { data } = await supabaseAdmin
        .from('bookings')
        .select('*')
        .eq('artisan_id', artisanProfile.id)
      artisanBookings = data || []
    }

    // 6. Messages de booking
    const { data: messages } = await supabaseAdmin
      .from('booking_messages')
      .select('*')
      .eq('sender_id', userId)

    // 7. Emails analysés syndic
    const { data: syndicEmails } = await supabaseAdmin
      .from('syndic_emails_analysed')
      .select('*')
      .eq('syndic_id', userId)

    const exportData = {
      exported_at: new Date().toISOString(),
      rgpd_article: 'Art. 20 — Droit à la portabilité',
      user: userData,
      artisan_profile: artisanProfile || null,
      services,
      bookings_as_client: clientBookings || [],
      bookings_as_artisan: artisanBookings,
      messages: messages || [],
      syndic_emails: syndicEmails || [],
    }

    return new Response(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="vitfix-export-${userId.slice(0, 8)}-${Date.now()}.json"`,
      },
    })

  } catch (err: any) {
    console.error('[EXPORT-DATA] Erreur:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
