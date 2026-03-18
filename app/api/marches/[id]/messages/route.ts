import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { z } from 'zod'

// ── Validation schema ────────────────────────────────────────────────────────
const sendMessageSchema = z.object({
  content: z.string().min(1, 'Message requis').max(5000),
  candidature_id: z.string().uuid('candidature_id doit etre un UUID valide'),
  sender_type: z.enum(['publisher', 'artisan']),
  sender_name: z.string().min(1).max(200),
  access_token: z.string().max(200).optional(),
})

// GET /api/marches/[id]/messages — lister les messages d'un marche
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`marches_messages_get_${ip}`, 30, 60_000))) return rateLimitResponse()

  const { id: marcheId } = await params
  const url = new URL(request.url)
  const token = url.searchParams.get('token')
  const candidatureIdFilter = url.searchParams.get('candidature_id')

  // ── Publisher access via access_token ──────────────────────────────────────
  if (token) {
    const { data: marche } = await supabaseAdmin
      .from('marches')
      .select('id, access_token')
      .eq('id', marcheId)
      .single()

    if (!marche || token !== marche.access_token) {
      return NextResponse.json({ error: 'Token invalide' }, { status: 403 })
    }

    let query = supabaseAdmin
      .from('marches_messages')
      .select('*')
      .eq('marche_id', marcheId)
      .order('created_at', { ascending: true })

    if (candidatureIdFilter) {
      query = query.eq('candidature_id', candidatureIdFilter)
    }

    const { data: messages, error } = await query

    if (error) {
      logger.error('[marches/messages] GET publisher error', { error: error.message, marcheId })
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }

    return NextResponse.json({ messages: messages || [] })
  }

  // ── Artisan access via auth ───────────────────────────────────────────────
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Authentification ou token requis' }, { status: 401 })
  }

  const { data: artisan } = await supabaseAdmin
    .from('profiles_artisan')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!artisan) {
    return NextResponse.json({ error: 'Profil artisan non trouve' }, { status: 403 })
  }

  // Get candidature IDs belonging to this artisan for this marche
  const { data: candidatures } = await supabaseAdmin
    .from('marches_candidatures')
    .select('id')
    .eq('marche_id', marcheId)
    .eq('artisan_id', artisan.id)

  if (!candidatures || candidatures.length === 0) {
    return NextResponse.json({ messages: [] })
  }

  const candidatureIds = candidatures.map(c => c.id)

  let query = supabaseAdmin
    .from('marches_messages')
    .select('*')
    .eq('marche_id', marcheId)
    .in('candidature_id', candidatureIds)
    .order('created_at', { ascending: true })

  if (candidatureIdFilter && candidatureIds.includes(candidatureIdFilter)) {
    query = supabaseAdmin
      .from('marches_messages')
      .select('*')
      .eq('marche_id', marcheId)
      .eq('candidature_id', candidatureIdFilter)
      .order('created_at', { ascending: true })
  }

  const { data: messages, error } = await query

  if (error) {
    logger.error('[marches/messages] GET artisan error', { error: error.message, marcheId })
    return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
  }

  return NextResponse.json({ messages: messages || [] })
}

// POST /api/marches/[id]/messages — envoyer un message
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`marches_messages_post_${ip}`, 20, 60_000))) return rateLimitResponse()

  const { id: marcheId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps de requete invalide' }, { status: 400 })
  }

  const validation = validateBody(sendMessageSchema, body)
  if (!validation.success) {
    return NextResponse.json({ error: 'Donnees invalides', details: validation.error }, { status: 400 })
  }
  const v = validation.data

  // Verify the marche exists
  const { data: marche, error: marcheError } = await supabaseAdmin
    .from('marches')
    .select('id, access_token')
    .eq('id', marcheId)
    .single()

  if (marcheError || !marche) {
    return NextResponse.json({ error: 'Marche non trouve' }, { status: 404 })
  }

  // Verify the candidature exists and belongs to this marche
  const { data: candidature, error: candError } = await supabaseAdmin
    .from('marches_candidatures')
    .select('id, artisan_id, artisan_user_id')
    .eq('id', v.candidature_id)
    .eq('marche_id', marcheId)
    .single()

  if (candError || !candidature) {
    return NextResponse.json({ error: 'Candidature non trouvee' }, { status: 404 })
  }

  // ── Publisher sending ─────────────────────────────────────────────────────
  if (v.sender_type === 'publisher') {
    if (!v.access_token || v.access_token !== marche.access_token) {
      return NextResponse.json({ error: 'Token publisher invalide' }, { status: 403 })
    }
  }

  // ── Artisan sending ───────────────────────────────────────────────────────
  if (v.sender_type === 'artisan') {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
    }

    if (candidature.artisan_user_id !== user.id) {
      return NextResponse.json({ error: 'Cette candidature ne vous appartient pas' }, { status: 403 })
    }
  }

  // Insert the message
  const { data: message, error: insertError } = await supabaseAdmin
    .from('marches_messages')
    .insert({
      marche_id: marcheId,
      candidature_id: v.candidature_id,
      sender_type: v.sender_type,
      sender_name: v.sender_name,
      content: v.content,
    })
    .select()
    .single()

  if (insertError) {
    logger.error('[marches/messages] POST insert error', { error: insertError.message, marcheId })
    return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
  }

  // ── Notifications ─────────────────────────────────────────────────────────
  if (v.sender_type === 'publisher') {
    // Notify the artisan
    await supabaseAdmin
      .from('artisan_notifications')
      .insert({
        artisan_id: candidature.artisan_id,
        user_id: candidature.artisan_user_id,
        type: 'marche_message',
        title: 'Nouveau message sur votre candidature',
        body: v.content.substring(0, 200),
        metadata: { marche_id: marcheId, candidature_id: v.candidature_id },
      })
      .then(null, (err: unknown) => {
        logger.warn('[marches/messages] Failed to create artisan notification', { error: String(err) })
      })
  } else {
    // Artisan sends → increment unread count on marche
    await supabaseAdmin.rpc('increment_counter', {
      table_name: 'marches',
      column_name: 'unread_messages_count',
      row_id: marcheId,
    }).then(null, () => {
      // Fallback: direct update
      return supabaseAdmin
        .from('marches')
        .update({ unread_messages_count: 1 })
        .eq('id', marcheId)
    })
  }

  return NextResponse.json({ message }, { status: 201 })
}
