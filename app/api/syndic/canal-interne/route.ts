import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSyndicRole } from '@/lib/auth-helpers'

// ── Canal Interne équipe — réutilise la table syndic_messages avec message_type='canal_interne'

// GET /api/syndic/canal-interne — récupérer les messages internes du cabinet
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user || !isSyndicRole(user.user_metadata?.role)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const cabinetId = user.user_metadata?.cabinet_id || user.id

  const { data, error } = await supabaseAdmin
    .from('syndic_messages')
    .select('*')
    .eq('cabinet_id', cabinetId)
    .eq('message_type', 'canal_interne')
    .order('created_at', { ascending: true })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

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
}

// POST /api/syndic/canal-interne — envoyer un message interne
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user || !isSyndicRole(user.user_metadata?.role)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const cabinetId = user.user_metadata?.cabinet_id || user.id
  const body = await request.json()

  if (!body.texte?.trim()) {
    return NextResponse.json({ error: 'texte requis' }, { status: 400 })
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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

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
}

// PATCH /api/syndic/canal-interne — marquer tout comme lu
export async function PATCH(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user || !isSyndicRole(user.user_metadata?.role)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const cabinetId = user.user_metadata?.cabinet_id || user.id

  const { error } = await supabaseAdmin
    .from('syndic_messages')
    .update({ read: true })
    .eq('cabinet_id', cabinetId)
    .eq('message_type', 'canal_interne')
    .eq('read', false)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
