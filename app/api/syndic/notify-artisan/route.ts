import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthUser, isSyndicRole } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Envoie une notification in-app à un artisan ───────────────────────────────
// ⚠️ SÉCURISÉ : auth obligatoire + vérification rôle syndic

export async function POST(request: NextRequest) {
  // ── Auth obligatoire ──────────────────────────────────────────────────────
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }
  if (!isSyndicRole(user) && user.user_metadata?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Accès réservé aux syndics' }, { status: 403 })
  }
  const ip = getClientIP(request)
  if (!checkRateLimit(`notify_artisan_${ip}`, 30, 60_000)) return rateLimitResponse()

  try {
    const {
      artisan_id,
      syndic_id,
      type = 'new_mission',
      title,
      body,
      data_json = {},
    } = await request.json()

    if (!artisan_id || !title) {
      return NextResponse.json({ error: 'artisan_id et title requis' }, { status: 400 })
    }

    // Insérer la notification dans la table artisan_notifications
    const { data, error } = await supabaseAdmin
      .from('artisan_notifications')
      .insert({
        artisan_id,
        type,
        title,
        body: body || '',
        read: false,
        data_json: {
          ...data_json,
          syndic_id,
          sent_at: new Date().toISOString(),
        },
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      // Table n'existe pas encore — retourner succès silencieux
      console.warn('artisan_notifications insert error (table may not exist):', error.message)
      return NextResponse.json({ success: true, warning: 'table_not_ready' })
    }

    return NextResponse.json({ success: true, notification: data })

  } catch (err: any) {
    console.error('notify-artisan error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── Marquer une notification comme lue ───────────────────────────────────────
export async function PATCH(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }
  try {
    const body = await request.json()
    const { notification_id, artisan_id, syndic_id, mark_all_read } = body

    // Marquer toutes les notifs syndic comme lues
    if (mark_all_read && syndic_id) {
      await supabaseAdmin
        .from('syndic_notifications')
        .update({ read: true })
        .eq('syndic_id', syndic_id)
        .eq('read', false)
      return NextResponse.json({ success: true })
    }

    // Marquer une notif artisan spécifique comme lue
    if (!notification_id || !artisan_id) {
      return NextResponse.json({ error: 'notification_id et artisan_id requis' }, { status: 400 })
    }

    await supabaseAdmin
      .from('artisan_notifications')
      .update({ read: true })
      .eq('id', notification_id)
      .eq('artisan_id', artisan_id)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── Récupérer les notifications d'un artisan OU d'un syndic ──────────────────
// ⚠️ SÉCURISÉ : auth obligatoire
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }
  const { searchParams } = new URL(request.url)
  const artisan_id = searchParams.get('artisan_id')
  const syndic_id = searchParams.get('syndic_id')
  const unread_only = searchParams.get('unread_only') === 'true'
  const limit = parseInt(searchParams.get('limit') || '50')

  // Notifications syndic
  if (syndic_id) {
    let query = supabaseAdmin
      .from('syndic_notifications')
      .select('*')
      .eq('syndic_id', syndic_id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (unread_only) query = query.eq('read', false)

    const { data, error } = await query
    if (error) return NextResponse.json({ notifications: [], warning: 'table_not_ready' })
    return NextResponse.json({ notifications: data || [] })
  }

  // Notifications artisan
  if (!artisan_id) {
    return NextResponse.json({ error: 'artisan_id ou syndic_id requis' }, { status: 400 })
  }

  let query = supabaseAdmin
    .from('artisan_notifications')
    .select('*')
    .eq('artisan_id', artisan_id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (unread_only) query = query.eq('read', false)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ notifications: [], warning: 'table_not_ready' })
  }

  return NextResponse.json({ notifications: data || [] })
}
