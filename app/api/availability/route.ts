import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { validateBody, availabilityToggleSchema, availabilityUpdateSchema } from '@/lib/validation'

// GET: Fetch availability for an artisan (public — nécessaire pour la réservation)
export async function GET(request: NextRequest) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`availability_get_${ip}`, 30, 60_000))) return rateLimitResponse()

  const { searchParams } = new URL(request.url)
  const artisanId = searchParams.get('artisan_id')

  if (!artisanId) {
    return NextResponse.json({ error: 'artisan_id is required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('availability')
    .select('id, artisan_id, day_of_week, start_time, end_time, is_available')
    .eq('artisan_id', artisanId)
    .order('day_of_week')

  if (error) {
    logger.error('Error fetching availability:', error)
    return NextResponse.json({ error: 'Failed to fetch availability' }, { status: 500 })
  }

  const response = NextResponse.json({ data })
  response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')
  return response
}

// POST: Toggle day availability (create or toggle is_available)
// ⚠️ SÉCURISÉ : auth obligatoire + vérification ownership artisan
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`availability_post_${ip}`, 30, 60_000))) return rateLimitResponse()

  try {
    const body = await request.json()
    const v = validateBody(availabilityToggleSchema, body)
    if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })
    const { artisan_id, day_of_week, is_available, start_time, end_time } = v.data

    // SÉCURITÉ : vérifier que l'utilisateur est propriétaire de cet artisan
    const { data: artisanProfile } = await supabaseAdmin
      .from('profiles_artisan')
      .select('user_id')
      .eq('id', artisan_id)
      .single()
    if (!artisanProfile || artisanProfile.user_id !== user.id) {
      return NextResponse.json({ error: 'Accès refusé : vous n\'êtes pas le propriétaire de ce profil' }, { status: 403 })
    }

    // Check if row exists
    const { data: existing } = await supabaseAdmin
      .from('availability')
      .select('id, artisan_id, day_of_week, is_available, start_time, end_time')
      .eq('artisan_id', artisan_id)
      .eq('day_of_week', day_of_week)
      .single()

    if (existing) {
      // Si is_available fourni → idempotent (état explicite). Sinon → toggle (rétrocompat).
      const updates: Record<string, unknown> = {
        is_available: typeof is_available === 'boolean' ? is_available : !existing.is_available,
      }
      if (start_time) updates.start_time = start_time
      if (end_time) updates.end_time = end_time

      const { data, error } = await supabaseAdmin
        .from('availability')
        .update(updates)
        .eq('id', existing.id)
        .select()
        .single()

      if (error) {
        logger.error('Error updating availability:', error)
        return NextResponse.json({ error: 'Failed to update availability' }, { status: 500 })
      }
      return NextResponse.json({ data, action: typeof is_available === 'boolean' ? 'set' : 'toggled' })
    } else {
      // Insert new row — utiliser is_available fourni si présent, sinon true par défaut
      const { data, error } = await supabaseAdmin
        .from('availability')
        .insert({
          artisan_id,
          day_of_week,
          start_time: start_time || '08:00',
          end_time: end_time || '17:00',
          is_available: typeof is_available === 'boolean' ? is_available : true,
        })
        .select()
        .single()

      if (error) {
        logger.error('Error creating availability:', error)
        return NextResponse.json({ error: 'Failed to create availability' }, { status: 500 })
      }
      return NextResponse.json({ data, action: 'created' })
    }
  } catch (e: unknown) {
    logger.error('Server error in availability POST:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// PUT: Update availability time for a specific day
// ⚠️ SÉCURISÉ : auth obligatoire + vérification ownership via availability row
export async function PUT(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`availability_put_${ip}`, 30, 60_000))) return rateLimitResponse()

  try {
    const body = await request.json()
    const v = validateBody(availabilityUpdateSchema, body)
    if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })
    const { availability_id, field, value } = v.data

    // SÉCURITÉ : vérifier ownership — récupérer la row availability → artisan → user_id
    const { data: availRow } = await supabaseAdmin
      .from('availability')
      .select('artisan_id')
      .eq('id', availability_id)
      .single()
    if (!availRow) {
      return NextResponse.json({ error: 'Créneau introuvable' }, { status: 404 })
    }
    const { data: artisanProfile } = await supabaseAdmin
      .from('profiles_artisan')
      .select('user_id')
      .eq('id', availRow.artisan_id)
      .single()
    if (!artisanProfile || artisanProfile.user_id !== user.id) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    // Use explicit update instead of dynamic field
    const updateData = field === 'start_time' ? { start_time: value } : { end_time: value }

    const { data, error } = await supabaseAdmin
      .from('availability')
      .update(updateData)
      .eq('id', availability_id)
      .select()
      .single()

    if (error) {
      logger.error('Error updating availability:', error)
      return NextResponse.json({ error: 'Failed to update availability' }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (e: unknown) {
    logger.error('Server error in availability PUT:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
