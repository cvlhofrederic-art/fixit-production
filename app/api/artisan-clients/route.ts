import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

// GET /api/artisan-clients?client_id=xxx
//   → Returns user info (name, phone, email) for a single client — used by artisan to pre-fill devis
//
// GET /api/artisan-clients?artisan_id=xxx
//   → Returns all clients for an artisan (unique client_ids from bookings)
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const ip = getClientIP(request)
  if (!checkRateLimit(`artisan_clients_${ip}`, 60, 60_000)) return rateLimitResponse()

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // ── Mode 1: single client lookup for devis pre-fill ──
  // SÉCURITÉ : vérifier que le client a un booking avec l'artisan connecté (anti-IDOR)
  const clientId = request.nextUrl.searchParams.get('client_id')
  if (clientId) {
    try {
      // Récupérer l'artisan_id de l'utilisateur connecté
      const { data: artisanProfile } = await supabaseAdmin
        .from('profiles_artisan')
        .select('id')
        .eq('user_id', user.id)
        .single()
      if (!artisanProfile) {
        return NextResponse.json({ error: 'Profil artisan introuvable' }, { status: 403 })
      }

      // Vérifier que ce client a au moins un booking avec cet artisan
      const { data: booking } = await supabaseAdmin
        .from('bookings')
        .select('id')
        .eq('artisan_id', artisanProfile.id)
        .eq('client_id', clientId)
        .limit(1)
        .single()
      if (!booking) {
        return NextResponse.json({ error: 'Accès refusé : ce client n\'est pas dans vos bookings' }, { status: 403 })
      }

      const { data: { user: clientUser }, error } = await supabaseAdmin.auth.admin.getUserById(clientId)
      if (error || !clientUser) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })

      const meta = clientUser.user_metadata || {}
      return NextResponse.json({
        id: clientUser.id,
        email: clientUser.email || '',
        name: meta.full_name || meta.name || '',
        phone: meta.phone || '',
        address: meta.address || '',
      })
    } catch {
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
  }

  // ── Mode 2: all clients for an artisan (from bookings) ──
  const artisanId = request.nextUrl.searchParams.get('artisan_id')
  if (!artisanId) {
    return NextResponse.json({ error: 'client_id ou artisan_id requis' }, { status: 400 })
  }

  // IDOR check: the connected user must be the artisan
  const { data: artisanRow } = await supabaseAdmin
    .from('profiles_artisan')
    .select('user_id')
    .eq('id', artisanId)
    .single()
  if (!artisanRow || artisanRow.user_id !== user.id) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    // Fetch all bookings for this artisan that have a client_id
    const { data: bookings, error: bookingsError } = await supabaseAdmin
      .from('bookings')
      .select('id, client_id, booking_date, booking_time, status, address, notes, services(name), price_ttc')
      .eq('artisan_id', artisanId)
      .not('client_id', 'is', null)
      .order('booking_date', { ascending: false })

    if (bookingsError) {
      return NextResponse.json({ error: 'Erreur bookings' }, { status: 500 })
    }

    // Group bookings by client_id
    const byClient = new Map<string, any[]>()
    for (const b of bookings || []) {
      if (!b.client_id) continue
      if (!byClient.has(b.client_id)) byClient.set(b.client_id, [])
      byClient.get(b.client_id)!.push(b)
    }

    // Fetch user info for each unique client_id (batch)
    const clients: any[] = []
    for (const [cId, cBookings] of byClient.entries()) {
      try {
        const { data: { user: clientUser } } = await supabaseAdmin.auth.admin.getUserById(cId)
        if (!clientUser) continue
        const meta = clientUser.user_metadata || {}
        const clientBookings = cBookings.map(b => ({
          id: b.id,
          date: b.booking_date,
          service: (b.services as any)?.name || 'Intervention',
          status: b.status,
          address: b.address,
          price: b.price_ttc,
        }))
        clients.push({
          id: cId,
          source: 'auth',
          name: meta.full_name || meta.name || clientUser.email?.split('@')[0] || 'Client',
          email: clientUser.email || '',
          phone: meta.phone || '',
          address: meta.address || '',
          siret: '',
          type: 'particulier',
          bookings: clientBookings,
        })
      } catch {
        // Skip unresolvable client
      }
    }

    return NextResponse.json({ clients })
  } catch (err: any) {
    console.error('[artisan-clients] Erreur:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
