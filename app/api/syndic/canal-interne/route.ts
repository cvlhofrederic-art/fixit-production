import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { canalInterneSchema, validateBody } from '@/lib/validation'

// ── Canal Interne équipe — réutilise la table syndic_messages avec message_type='canal_interne'

// GET /api/syndic/canal-interne — récupérer les messages internes du cabinet
export async function GET(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`canal_interne_get_${ip}`, 60, 60_000))) return rateLimitResponse()

    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)

    const { data, error } = await supabaseAdmin
      .from('syndic_messages')
      .select('id, sender_role, content, mission_id, read, created_at')
      .eq('cabinet_id', cabinetId)
      .eq('message_type', 'canal_interne')
      .order('created_at', { ascending: true })
      .limit(200)

    if (error) return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })

    const messages = (data || []).map(m => ({
      id: m.id,
      auteur: m.sender_role?.split('|')[0] || 'Équipe',
      auteurRole: m.sender_role?.split('|')[1] || '',
      texte: m.content || '',
      heure: new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      lu: m.read ?? false,
      sujet: m.mission_id || '',
      createdAt: m.created_at,
    }))

    return NextResponse.json({ messages })
  } catch (err) {
    console.error('[syndic/canal-interne/GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/syndic/canal-interne — envoyer un message interne
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`canal_interne_post_${ip}`, 20, 60_000))) return rateLimitResponse()

    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    const body = await request.json()

    const validationResult = validateBody(canalInterneSchema, body)
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Donn\u00e9es invalides', details: validationResult.error }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('syndic_messages')
      .insert({
        cabinet_id: cabinetId,
        sender_id: user.id,
        // sender_role stores "nom|role" pour reconstruire l'identité
        sender_role: `${body.auteur || user.user_metadata?.full_name || 'Équipe'}|${body.auteurRole || user.user_metadata?.role || ''}`,
        content: body.texte,
        message_type: 'canal_interne',
        artisan_user_id: null,
        mission_id: body.sujet || null,
        read: false,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })

    return NextResponse.json({
      message: {
        id: data.id,
        auteur: body.auteur,
        auteurRole: body.auteurRole,
        texte: body.texte,
        heure: new Date(data.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        lu: false,
        sujet: body.sujet || '',
        createdAt: data.created_at,
      }
    })
  } catch (err) {
    console.error('[syndic/canal-interne/POST] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/syndic/canal-interne — marquer tout comme lu
export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)

    const { error } = await supabaseAdmin
      .from('syndic_messages')
      .update({ read: true })
      .eq('cabinet_id', cabinetId)
      .eq('message_type', 'canal_interne')
      .eq('read', false)

    if (error) return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[syndic/canal-interne/PATCH] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
