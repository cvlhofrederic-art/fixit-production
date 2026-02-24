import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSyndicRole } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

// ── GET /api/syndic/messages?artisan_id=xxx — Canal de communication ──────────
export async function GET(request: NextRequest) {
  const ip = getClientIP(request)
  if (!checkRateLimit(`syndic_msg_get_${ip}`, 60, 60_000)) return rateLimitResponse()

  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const artisanId = searchParams.get('artisan_id') // user_id de l'artisan
  const missionId = searchParams.get('mission_id')

  const cabinetId = user.user_metadata?.cabinet_id || user.id
  const isSyndic = isSyndicRole(user.user_metadata?.role)
  const isArtisan = user.user_metadata?.role === 'artisan'

  if (!isSyndic && !isArtisan) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  let query = supabaseAdmin
    .from('syndic_messages')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(100)

  if (isSyndic && artisanId) {
    query = query.eq('cabinet_id', cabinetId).eq('artisan_user_id', artisanId)
  } else if (isArtisan) {
    // L'artisan voit ses messages avec tous ses cabinets liés
    query = query.eq('artisan_user_id', user.id)
  }

  if (missionId) {
    query = query.eq('mission_id', missionId)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Marquer comme lu
  if (data && data.length > 0) {
    const unreadIds = data
      .filter(m => !m.read_at && m.sender_id !== user.id)
      .map(m => m.id)
    if (unreadIds.length > 0) {
      await supabaseAdmin
        .from('syndic_messages')
        .update({ read_at: new Date().toISOString() })
        .in('id', unreadIds)
    }
  }

  return NextResponse.json({ messages: data || [] })
}

// ── POST /api/syndic/messages — Envoyer un message ───────────────────────────
export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  if (!checkRateLimit(`syndic_msg_post_${ip}`, 30, 60_000)) return rateLimitResponse()

  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const isSyndic = isSyndicRole(user.user_metadata?.role)
  const isArtisan = user.user_metadata?.role === 'artisan'

  if (!isSyndic && !isArtisan) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  const body = await request.json()
  const { content, artisan_user_id, cabinet_id, mission_id, type } = body

  if (!content?.trim()) {
    return NextResponse.json({ error: 'Message vide' }, { status: 400 })
  }

  const cabinetId = isSyndic ? (user.user_metadata?.cabinet_id || user.id) : cabinet_id
  const artisanUserId = isSyndic ? artisan_user_id : user.id

  if (!cabinetId || !artisanUserId) {
    return NextResponse.json({ error: 'cabinet_id et artisan_user_id requis' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('syndic_messages')
    .insert({
      cabinet_id: cabinetId,
      artisan_user_id: artisanUserId,
      sender_id: user.id,
      sender_role: isSyndic ? 'syndic' : 'artisan',
      sender_name: user.user_metadata?.full_name || user.email || 'Inconnu',
      content: content.trim(),
      mission_id: mission_id || null,
      message_type: type || 'text', // text | rapport | proof_of_work | devis
      created_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    console.error('[MESSAGES POST]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Notifier l'autre partie (via syndic_notifications existant) — fire and forget
  supabaseAdmin.from('syndic_notifications').insert({
    syndic_id: cabinetId,
    artisan_id: artisanUserId,
    type: 'message',
    title: isSyndic ? 'Nouveau message du syndic' : 'Nouveau message de l\'artisan',
    message: content.trim().substring(0, 100),
    read: false,
    created_at: new Date().toISOString(),
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  })

  return NextResponse.json({ success: true, message: data })
}
