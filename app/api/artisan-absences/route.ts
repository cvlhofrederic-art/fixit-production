import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

// GET: Fetch absences for an artisan (public — needed for client booking availability check)
export async function GET(request: NextRequest) {
  const ip = getClientIP(request)
  if (!checkRateLimit(`absences_get_${ip}`, 30, 60_000)) return rateLimitResponse()

  const { searchParams } = new URL(request.url)
  const artisanId = searchParams.get('artisan_id')

  if (!artisanId) {
    return NextResponse.json({ error: 'artisan_id is required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('artisan_absences')
    .select('*')
    .eq('artisan_id', artisanId)
    .order('start_date')

  if (error) {
    console.error('Error fetching absences:', error)
    return NextResponse.json({ error: 'Failed to fetch absences' }, { status: 500 })
  }

  return NextResponse.json({ data })
}

// POST: Create a new absence period
// ⚠️ SÉCURISÉ : auth obligatoire + vérification ownership artisan
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }
  const ip = getClientIP(request)
  if (!checkRateLimit(`absences_post_${ip}`, 20, 60_000)) return rateLimitResponse()

  try {
    const body = await request.json()
    const { artisan_id, start_date, end_date, reason, label, source } = body

    if (!artisan_id || !start_date || !end_date) {
      return NextResponse.json({ error: 'artisan_id, start_date, and end_date are required' }, { status: 400 })
    }

    // Validate date format YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(start_date) || !dateRegex.test(end_date)) {
      return NextResponse.json({ error: 'Dates must be in YYYY-MM-DD format' }, { status: 400 })
    }

    // Validate end_date >= start_date
    if (end_date < start_date) {
      return NextResponse.json({ error: 'end_date must be >= start_date' }, { status: 400 })
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

    const { data, error } = await supabaseAdmin
      .from('artisan_absences')
      .insert({
        artisan_id,
        start_date,
        end_date,
        reason: reason || '',
        label: label || '',
        source: source || 'manual',
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating absence:', error)
      return NextResponse.json({ error: 'Failed to create absence' }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (e: unknown) {
    console.error('Server error in absences POST:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// DELETE: Remove an absence period
// ⚠️ SÉCURISÉ : auth obligatoire + vérification ownership via absence row → artisan → user_id
export async function DELETE(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }
  const ip = getClientIP(request)
  if (!checkRateLimit(`absences_delete_${ip}`, 20, 60_000)) return rateLimitResponse()

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  try {
    // Récupérer la row absence → artisan_id
    const { data: absenceRow } = await supabaseAdmin
      .from('artisan_absences')
      .select('artisan_id')
      .eq('id', id)
      .single()
    if (!absenceRow) {
      return NextResponse.json({ error: 'Absence introuvable' }, { status: 404 })
    }

    // SÉCURITÉ : vérifier ownership artisan
    const { data: artisanProfile } = await supabaseAdmin
      .from('profiles_artisan')
      .select('user_id')
      .eq('id', absenceRow.artisan_id)
      .single()
    if (!artisanProfile || artisanProfile.user_id !== user.id) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const { error } = await supabaseAdmin
      .from('artisan_absences')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting absence:', error)
      return NextResponse.json({ error: 'Failed to delete absence' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    console.error('Server error in absences DELETE:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
