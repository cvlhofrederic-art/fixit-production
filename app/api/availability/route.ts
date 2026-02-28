import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

// GET: Fetch availability for an artisan (public — nécessaire pour la réservation)
export async function GET(request: NextRequest) {
  const ip = getClientIP(request)
  if (!checkRateLimit(`availability_get_${ip}`, 30, 60_000)) return rateLimitResponse()

  const { searchParams } = new URL(request.url)
  const artisanId = searchParams.get('artisan_id')

  if (!artisanId) {
    return NextResponse.json({ error: 'artisan_id is required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('availability')
    .select('*')
    .eq('artisan_id', artisanId)
    .order('day_of_week')

  if (error) {
    console.error('Error fetching availability:', error)
    return NextResponse.json({ error: 'Failed to fetch availability' }, { status: 500 })
  }

  return NextResponse.json({ data })
}

// POST: Toggle day availability (create or toggle is_available)
// ⚠️ SÉCURISÉ : auth obligatoire + vérification ownership artisan
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }
  const ip = getClientIP(request)
  if (!checkRateLimit(`availability_post_${ip}`, 30, 60_000)) return rateLimitResponse()

  try {
    const body = await request.json()
    const { artisan_id, day_of_week } = body

    if (!artisan_id || day_of_week === undefined) {
      return NextResponse.json({ error: 'artisan_id and day_of_week are required' }, { status: 400 })
    }

    // SÉCURITÉ : vérifier que l'utilisateur est propriétaire de cet artisan
    const { data: artisanProfile } = await supabaseAdmin
      .from('profiles_artisan')
      .select('user_id')
      .eq('id', artisan_id)
      .single()
    if (!artisanProfile || artisanProfile.user_id !== user.id) {
      return NextResponse.json({ error: 'Accès refusé : vous n\'êtes pas le propriétaire de ce profil' }, { status: 403 })
    }

    // Validate day_of_week is 0-6
    if (typeof day_of_week !== 'number' || day_of_week < 0 || day_of_week > 6) {
      return NextResponse.json({ error: 'day_of_week must be a number between 0 and 6' }, { status: 400 })
    }

    // Check if row exists
    const { data: existing } = await supabaseAdmin
      .from('availability')
      .select('*')
      .eq('artisan_id', artisan_id)
      .eq('day_of_week', day_of_week)
      .single()

    if (existing) {
      // Toggle is_available
      const newVal = !existing.is_available
      const { data, error } = await supabaseAdmin
        .from('availability')
        .update({ is_available: newVal })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) {
        console.error('Error toggling availability:', error)
        return NextResponse.json({ error: 'Failed to toggle availability' }, { status: 500 })
      }
      return NextResponse.json({ data, action: 'toggled' })
    } else {
      // Insert new row
      const { data, error } = await supabaseAdmin
        .from('availability')
        .insert({
          artisan_id,
          day_of_week,
          start_time: '08:00',
          end_time: '17:00',
          is_available: true,
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating availability:', error)
        return NextResponse.json({ error: 'Failed to create availability' }, { status: 500 })
      }
      return NextResponse.json({ data, action: 'created' })
    }
  } catch (e: unknown) {
    console.error('Server error in availability POST:', e)
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
  if (!checkRateLimit(`availability_put_${ip}`, 30, 60_000)) return rateLimitResponse()

  try {
    const body = await request.json()
    const { availability_id, field, value } = body

    if (!availability_id || !field || !value) {
      return NextResponse.json({ error: 'availability_id, field, and value are required' }, { status: 400 })
    }

    if (!['start_time', 'end_time'].includes(field)) {
      return NextResponse.json({ error: 'field must be start_time or end_time' }, { status: 400 })
    }

    // Validate time format HH:MM
    if (!/^\d{2}:\d{2}$/.test(value)) {
      return NextResponse.json({ error: 'value must be a valid time format (HH:MM)' }, { status: 400 })
    }

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
      console.error('Error updating availability:', error)
      return NextResponse.json({ error: 'Failed to update availability' }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (e: unknown) {
    console.error('Server error in availability PUT:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
