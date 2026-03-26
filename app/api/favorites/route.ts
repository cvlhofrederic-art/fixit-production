import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

// GET /api/favorites — liste des artisans favoris du client
export async function GET(request: NextRequest) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`favorites_get_${ip}`, 30, 60_000))) return rateLimitResponse()

  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('client_favorites')
    .select('artisan_id, created_at, profiles_artisan:artisan_id(id, company_name, rating_avg, rating_count, city, categories)')
    .eq('client_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    logger.error('[favorites] GET error:', { error: error.message })
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }

  return NextResponse.json({ favorites: data || [] })
}

// POST /api/favorites — ajouter un artisan aux favoris
export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`favorites_post_${ip}`, 20, 60_000))) return rateLimitResponse()

  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })

  let body: { artisan_id?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Corps invalide' }, { status: 400 }) }

  if (!body.artisan_id) return NextResponse.json({ error: 'artisan_id requis' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('client_favorites')
    .upsert({ client_id: user.id, artisan_id: body.artisan_id }, { onConflict: 'client_id,artisan_id' })

  if (error) {
    logger.error('[favorites] POST error:', { error: error.message })
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }

  return NextResponse.json({ success: true }, { status: 201 })
}

// DELETE /api/favorites — retirer un artisan des favoris
export async function DELETE(request: NextRequest) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`favorites_del_${ip}`, 20, 60_000))) return rateLimitResponse()

  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const artisanId = searchParams.get('artisan_id')
  if (!artisanId) return NextResponse.json({ error: 'artisan_id requis' }, { status: 400 })

  await supabaseAdmin
    .from('client_favorites')
    .delete()
    .eq('client_id', user.id)
    .eq('artisan_id', artisanId)

  return NextResponse.json({ success: true })
}
