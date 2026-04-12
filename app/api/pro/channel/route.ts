import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { validateBody, proChannelPostSchema } from '@/lib/validation'
import { logger } from '@/lib/logger'

const PRO_ROLES = ['artisan', 'pro_societe', 'pro_conciergerie', 'pro_gestionnaire']

// GET /api/pro/channel?contact_id=xxx
export async function GET(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`pro_ch_get_${ip}`, 60, 60_000))) return rateLimitResponse()

    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const role = user.user_metadata?.role || ''
    if (!PRO_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const contactId = searchParams.get('contact_id')

    // Valider format UUID si contactId fourni
    const VALID_UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
    if (contactId && !VALID_UUID.test(contactId)) {
      return NextResponse.json({ error: 'contact_id invalide' }, { status: 400 })
    }

    // Cherche les messages entre user.id et contactId dans la table syndic_messages
    // On réutilise la table syndic_messages avec cabinet_id = pro user_id
    let query = supabaseAdmin
      .from('syndic_messages')
      .select('id, cabinet_id, artisan_user_id, sender_id, sender_role, sender_name, content, message_type, type, metadata, mission_id, read_at, created_at')
      .order('created_at', { ascending: true })
      .limit(200)

    if (contactId) {
      query = query.or(
        `and(cabinet_id.eq.${user.id},artisan_user_id.eq.${contactId}),and(cabinet_id.eq.${contactId},artisan_user_id.eq.${user.id})`
      )
    } else {
      query = query.or(`cabinet_id.eq.${user.id},artisan_user_id.eq.${user.id}`)
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })

    // Marquer comme lu
    if (data && data.length > 0) {
      const unreadIds = data.filter(m => !m.read_at && m.sender_id !== user.id).map(m => m.id)
      if (unreadIds.length > 0) {
        await supabaseAdmin.from('syndic_messages').update({ read_at: new Date().toISOString() }).in('id', unreadIds)
      }
    }

    return NextResponse.json({ messages: data || [] })
  } catch (err) {
    logger.error('[pro/channel/GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/pro/channel
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`pro_ch_post_${ip}`, 30, 60_000))) return rateLimitResponse()

    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const role = user.user_metadata?.role || ''
    if (!PRO_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    const body = await request.json()
    const validation = validateBody(proChannelPostSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
    const { content, contact_id, type = 'text', metadata = {} } = validation.data

    if (!content?.trim() && type === 'text') {
      return NextResponse.json({ error: 'Contenu requis' }, { status: 400 })
    }

    const msgData = {
      cabinet_id: user.id,
      artisan_user_id: contact_id || user.id,
      sender_id: user.id,
      sender_role: role,
      sender_name: user.user_metadata?.company_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Pro',
      content: content?.trim() || '',
      type,
      metadata: JSON.stringify(metadata),
      created_at: new Date().toISOString(),
    }

    const { data, error } = await supabaseAdmin.from('syndic_messages').insert(msgData).select().single()
    if (error) return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })

    return NextResponse.json({ message: data })
  } catch (err) {
    logger.error('[pro/channel/POST] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
