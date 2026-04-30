import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { logger } from '@/lib/logger'
import { validateBody, availabilityServicesSchema } from '@/lib/validation'

// GET: Fetch dayServices config from artisan's bio marker
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const artisanId = searchParams.get('artisan_id')

  if (!artisanId) {
    return NextResponse.json({ error: 'artisan_id is required' }, { status: 400 })
  }

  const { data: artisan, error } = await supabaseAdmin
    .from('profiles_artisan')
    .select('bio')
    .eq('id', artisanId)
    .single()

  if (error) {
    logger.error('Error fetching artisan bio:', error)
    return NextResponse.json({ error: 'Failed to fetch artisan data' }, { status: 500 })
  }

  let dayServices: Record<string, string[]> = {}
  if (artisan?.bio) {
    const match = artisan.bio.match(/<!--DS:(.*?)-->/)
    if (match) {
      try {
        dayServices = JSON.parse(match[1])
      } catch (parseError) {
        logger.error('Failed to parse dayServices JSON:', parseError)
      }
    }
  }

  const response = NextResponse.json({ data: dayServices })
  // ⚠️ Pas de cache CDN partagé — c'est de la donnée utilisateur qui change sur action.
  // Avant : s-maxage=3600 (1h) → après save, le GET au refresh retournait la version cachée.
  // private = chaque user a son propre cache navigateur. no-cache = revalidate à chaque requête.
  response.headers.set('Cache-Control', 'private, no-cache')
  return response
}

// POST: Save dayServices config into artisan's bio marker
export async function POST(request: NextRequest) {
  try {
    // ── Auth: seul l'artisan propriétaire peut modifier sa config ──
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const v = validateBody(availabilityServicesSchema, body)
    if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })
    const { artisan_id, dayServices } = v.data

    // ⚠️ BUG FIX : ne PAS comparer user.id (auth.users) avec artisan_id (profiles_artisan PK).
    // Ce sont deux UUIDs différents ! Récupérer profiles_artisan.user_id et comparer.
    // Pattern identique à app/api/availability/route.ts ligne 53.
    const { data: artisan, error: fetchError } = await supabaseAdmin
      .from('profiles_artisan')
      .select('bio, user_id')
      .eq('id', artisan_id)
      .single()

    if (fetchError) {
      logger.error('Error fetching artisan bio:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch artisan data' }, { status: 500 })
    }

    // Vérifier que l'utilisateur connecté est bien le propriétaire de ce profil artisan
    if (!artisan || artisan.user_id !== user.id) {
      return NextResponse.json({ error: 'Accès refusé : vous n\'êtes pas le propriétaire de ce profil' }, { status: 403 })
    }

    // Clean existing marker and add new one
    const cleanBio = (artisan?.bio || '').replace(/\s*<!--DS:[\s\S]*?-->/, '').trim()
    const hasConfig = Object.values(dayServices as Record<string, string[]>).some(arr => arr.length > 0)
    const marker = hasConfig ? ` <!--DS:${JSON.stringify(dayServices)}-->` : ''
    const newBio = `${cleanBio}${marker}`

    const { error: updateError } = await supabaseAdmin
      .from('profiles_artisan')
      .update({ bio: newBio })
      .eq('id', artisan_id)

    if (updateError) {
      logger.error('Error updating artisan bio:', updateError)
      return NextResponse.json({ error: 'Failed to update artisan data' }, { status: 500 })
    }

    return NextResponse.json({ success: true, bio: newBio })
  } catch (e: unknown) {
    logger.error('Server error in availability-services POST:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
