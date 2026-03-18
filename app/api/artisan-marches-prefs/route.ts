import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { artisanMarchesPrefsSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

// GET /api/artisan-marches-prefs — retourne les préférences marchés de l'artisan
export async function GET(request: NextRequest) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`artisan_marches_prefs_get_${ip}`, 10, 60_000))) return rateLimitResponse()

  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }

  const { data: artisan, error } = await supabaseAdmin
    .from('profiles_artisan')
    .select('marches_opt_in, marches_categories, marches_work_mode, marches_tarif_journalier, marches_tarif_horaire, marches_description')
    .eq('user_id', user.id)
    .single()

  if (error || !artisan) {
    logger.error('[artisan-marches-prefs] GET error', { error: error?.message, userId: user.id })
    return NextResponse.json({ error: 'Profil artisan non trouvé' }, { status: 404 })
  }

  return NextResponse.json(artisan)
}

// POST /api/artisan-marches-prefs — mettre à jour les préférences marchés
export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`artisan_marches_prefs_post_${ip}`, 10, 60_000))) return rateLimitResponse()

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

  const validation = validateBody(artisanMarchesPrefsSchema, body)
  if (!validation.success) {
    return NextResponse.json({ error: 'Données invalides', details: validation.error }, { status: 400 })
  }
  const v = validation.data

  const { error } = await supabaseAdmin
    .from('profiles_artisan')
    .update({
      marches_opt_in: v.marches_opt_in,
      marches_categories: v.marches_categories,
      marches_work_mode: v.marches_work_mode,
      marches_tarif_journalier: v.marches_tarif_journalier ?? null,
      marches_tarif_horaire: v.marches_tarif_horaire ?? null,
      marches_description: v.marches_description ?? null,
    })
    .eq('user_id', user.id)

  if (error) {
    logger.error('[artisan-marches-prefs] POST update error', { error: error.message, userId: user.id })
    return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
