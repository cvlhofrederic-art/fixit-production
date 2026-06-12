import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, getUserRole, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { canalInterneSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'

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
    if (!cabinetId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    // ⚠️ Schéma live : syndic_messages n'a PAS de colonne `read` (boolean) mais
    // `read_at` (timestamptz nullable). lu = read_at non null.
    const { data, error } = await supabaseAdmin
      .from('syndic_messages')
      .select('id, sender_role, content, mission_id, read_at, created_at')
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
      lu: m.read_at !== null,
      sujet: m.mission_id || '',
      createdAt: m.created_at,
    }))

    return NextResponse.json({ messages })
  } catch (err) {
    logger.error('[syndic/canal-interne/GET] Unexpected error:', err)
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
    if (!cabinetId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
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
        sender_role: `${body.auteur || user.user_metadata?.full_name || 'Équipe'}|${body.auteurRole || getUserRole(user)}`,
        content: body.texte,
        message_type: 'canal_interne',
        // ⚠️ Colonne NOT NULL en live alors que le canal interne n'a pas d'artisan :
        // on stocke l'expéditeur. Les lectures canal-interne filtrent uniquement
        // sur cabinet_id + message_type, jamais sur artisan_user_id.
        artisan_user_id: user.id,
        mission_id: body.sujet || null,
        read_at: null, // non lu — la colonne live est read_at (timestamptz), pas read (boolean)
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
    logger.error('[syndic/canal-interne/POST] Unexpected error:', err)
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
    if (!cabinetId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    // Marquer lu = poser read_at (timestamptz live) sur les messages non lus (read_at IS NULL)
    const { error } = await supabaseAdmin
      .from('syndic_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('cabinet_id', cabinetId)
      .eq('message_type', 'canal_interne')
      .is('read_at', null)

    if (error) return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    logger.error('[syndic/canal-interne/PATCH] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
