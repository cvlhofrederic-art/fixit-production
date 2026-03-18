import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { logger } from '@/lib/logger'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

// GET /api/marches/[id] — détail d'un appel d'offres
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`marches_detail_${ip}`, 30, 60_000))) return rateLimitResponse()

  const { id } = await params
  const url = new URL(request.url)
  const token = url.searchParams.get('token')

  const { data: marche, error } = await supabaseAdmin
    .from('marches')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !marche) {
    return NextResponse.json({ error: 'Marché non trouvé' }, { status: 404 })
  }

  // Vue publique : masquer le access_token et les infos sensibles
  const publicMarche = { ...marche }
  delete publicMarche.access_token
  delete publicMarche.publisher_email
  delete publicMarche.publisher_phone

  // Si le token correspond, c'est le publisher → inclure les candidatures
  if (token && token === marche.access_token) {
    const { data: candidatures } = await supabaseAdmin
      .from('marches_candidatures')
      .select('*')
      .eq('marche_id', id)
      .order('created_at', { ascending: false })

    return NextResponse.json({
      marche: { ...marche },
      candidatures: candidatures || [],
      is_publisher: true,
    })
  }

  const response = NextResponse.json({ marche: publicMarche })
  response.headers.set('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=120')
  return response
}

// PATCH /api/marches/[id] — modifier le statut (publisher uniquement)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`marches_patch_${ip}`, 10, 60_000))) return rateLimitResponse()

  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
  }

  // Vérifier l'identité du publisher : via access_token OU via auth user
  const { data: marche, error: fetchError } = await supabaseAdmin
    .from('marches')
    .select('access_token, publisher_user_id')
    .eq('id', id)
    .single()

  if (fetchError || !marche) {
    return NextResponse.json({ error: 'Marché non trouvé' }, { status: 404 })
  }

  let authorized = false

  // Méthode 1 : access_token dans le body
  if (body.access_token && body.access_token === marche.access_token) {
    authorized = true
  }

  // Méthode 2 : utilisateur authentifié = publisher
  if (!authorized) {
    const user = await getAuthUser(request)
    if (user && marche.publisher_user_id && user.id === marche.publisher_user_id) {
      authorized = true
    }
  }

  if (!authorized) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  // Seules certaines mises à jour sont permises
  const status = body.status
  if (!status || !['closed', 'cancelled'].includes(status as string)) {
    return NextResponse.json({ error: 'Statut invalide. Valeurs acceptées : closed, cancelled' }, { status: 400 })
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('marches')
    .update({ status: status as string })
    .eq('id', id)
    .select()
    .single()

  if (updateError) {
    logger.error('[marches] PATCH update error', { error: updateError.message, id })
    return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
  }

  return NextResponse.json({ marche: updated })
}
