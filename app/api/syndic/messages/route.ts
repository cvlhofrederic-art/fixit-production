import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, getUserRole, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { syndicMessageSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'

// ── GET /api/syndic/messages?artisan_id=xxx — Canal de communication ──────────
export async function GET(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`syndic_msg_get_${ip}`, 60, 60_000))) return rateLimitResponse()

    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const artisanId = searchParams.get('artisan_id') // user_id de l'artisan
    const missionId = searchParams.get('mission_id')

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    const isSyndic = isSyndicRole(user)
    const isArtisan = getUserRole(user) === 'artisan'

    if (!isSyndic && !isArtisan) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    let query = supabaseAdmin
      .from('syndic_messages')
      .select('id, cabinet_id, artisan_user_id, sender_id, sender_role, sender_name, content, message_type, mission_id, read_at, read, created_at')
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
    if (error) return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })

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
  } catch (err) {
    logger.error('[syndic/messages/GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── POST /api/syndic/messages — Envoyer un message ───────────────────────────
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`syndic_msg_post_${ip}`, 30, 60_000))) return rateLimitResponse()

    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const isSyndic = isSyndicRole(user)
    const isArtisan = getUserRole(user) === 'artisan'

    if (!isSyndic && !isArtisan) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    const body = await request.json()
    const msgValidation = validateBody(syndicMessageSchema, body)
    if (!msgValidation.success) {
      return NextResponse.json({ error: 'Donn\u00e9es invalides', details: msgValidation.error }, { status: 400 })
    }
    const { content, artisan_user_id, cabinet_id, mission_id, type } = msgValidation.data

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Message vide' }, { status: 400 })
    }

    const cabinetId = isSyndic ? await resolveCabinetId(user, supabaseAdmin) : cabinet_id
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
      logger.error('[MESSAGES POST]', error)
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }

    // Notifier l'autre partie — fire and forget
    if (isSyndic) {
      // Syndic envoie → notifier l'artisan
      void supabaseAdmin.from('artisan_notifications').insert({
        artisan_id: artisanUserId,
        type: 'message',
        title: 'Nouveau message du syndic',
        body: content.trim().substring(0, 100),
        read: false,
        data_json: { cabinet_id: cabinetId, sender_id: user.id },
        created_at: new Date().toISOString(),
      })
    } else {
      // Artisan envoie → notifier le syndic
      void supabaseAdmin.from('syndic_notifications').insert({
        syndic_id: cabinetId,
        type: 'message',
        title: 'Nouveau message de l\'artisan',
        body: content.trim().substring(0, 100),
        read: false,
        data_json: { artisan_id: artisanUserId, sender_id: user.id },
        created_at: new Date().toISOString(),
      })
    }

    return NextResponse.json({ success: true, message: data })
  } catch (err) {
    logger.error('[syndic/messages/POST] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
