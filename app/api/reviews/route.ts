import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateBody } from '@/lib/validation'

const createReviewSchema = z.object({
  booking_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional().default(''),
})

// GET /api/reviews?artisan_id=xxx — liste publique des avis d'un artisan
export async function GET(request: NextRequest) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`reviews_get_${ip}`, 30, 60_000))) return rateLimitResponse()

  const { searchParams } = new URL(request.url)
  const artisanId = searchParams.get('artisan_id')
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')))

  if (!artisanId) {
    return NextResponse.json({ error: 'artisan_id requis' }, { status: 400 })
  }

  const { data: reviews, error, count } = await supabaseAdmin
    .from('booking_reviews')
    .select('id, rating, comment, created_at, client_id', { count: 'exact' })
    .eq('artisan_id', artisanId)
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (error) {
    logger.error('[reviews] GET error:', { error: error.message })
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }

  // Fetch client names (anonymized: first name only)
  const clientIds = [...new Set((reviews || []).map(r => r.client_id))]
  let clientNames = new Map<string, string>()

  if (clientIds.length > 0) {
    const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000, page: 1 })
    if (authData?.users) {
      for (const u of authData.users) {
        if (clientIds.includes(u.id)) {
          const fullName = u.user_metadata?.full_name || u.email?.split('@')[0] || 'Client'
          const firstName = fullName.split(' ')[0]
          clientNames.set(u.id, firstName)
        }
      }
    }
  }

  const formatted = (reviews || []).map(r => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment || '',
    created_at: r.created_at,
    client_name: clientNames.get(r.client_id) || 'Client',
  }))

  const total = count || 0
  const response = NextResponse.json({
    reviews: formatted,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  })
  response.headers.set('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=600')
  return response
}

// POST /api/reviews — soumettre un avis
export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`reviews_post_${ip}`, 5, 60_000))) return rateLimitResponse()

  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
  }

  const validation = validateBody(createReviewSchema, body)
  if (!validation.success) {
    return NextResponse.json({ error: 'Données invalides', details: validation.error }, { status: 400 })
  }
  const { booking_id, rating, comment } = validation.data

  try {
    // Vérifier que le booking existe et appartient au client
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('id, client_id, artisan_id, status')
      .eq('id', booking_id)
      .single()

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking non trouvé' }, { status: 404 })
    }

    if (booking.client_id !== user.id) {
      return NextResponse.json({ error: 'Ce booking ne vous appartient pas' }, { status: 403 })
    }

    if (booking.status !== 'completed') {
      return NextResponse.json({ error: 'Le booking doit être terminé pour laisser un avis' }, { status: 400 })
    }

    // Vérifier pas de doublon
    const { data: existing } = await supabaseAdmin
      .from('booking_reviews')
      .select('id')
      .eq('booking_id', booking_id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'Vous avez déjà laissé un avis pour ce booking' }, { status: 409 })
    }

    // Insérer l'avis
    const { error: insertError } = await supabaseAdmin
      .from('booking_reviews')
      .insert({
        booking_id,
        client_id: user.id,
        artisan_id: booking.artisan_id,
        rating,
        comment: comment || '',
      })

    if (insertError) {
      logger.error('[reviews] INSERT error:', { error: insertError.message })
      return NextResponse.json({ error: 'Erreur lors de la soumission' }, { status: 500 })
    }

    // Mettre à jour rating_avg et rating_count sur profiles_artisan
    const { data: artisan } = await supabaseAdmin
      .from('profiles_artisan')
      .select('rating_avg, rating_count')
      .eq('id', booking.artisan_id)
      .single()

    if (artisan) {
      const oldAvg = artisan.rating_avg || 0
      const oldCount = artisan.rating_count || 0
      const newCount = oldCount + 1
      const newAvg = Math.round(((oldAvg * oldCount + rating) / newCount) * 10) / 10

      await supabaseAdmin
        .from('profiles_artisan')
        .update({ rating_avg: newAvg, rating_count: newCount })
        .eq('id', booking.artisan_id)
    }

    logger.info('[reviews] Review submitted', { booking_id, artisan_id: booking.artisan_id, rating })

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    logger.error('[reviews] Error:', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}
