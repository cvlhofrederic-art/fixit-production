import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSuperAdmin } from '@/lib/auth-helpers'
import { logger } from '@/lib/logger'

/**
 * Route d'initialisation de la table syndic_team_members
 * SÉCURISÉE : nécessite authentification super_admin (app_metadata)
 */
export async function POST(request: NextRequest) {
  // ── Auth : super_admin uniquement (vérifié via app_metadata, non forgeable) ──
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }
  if (!isSuperAdmin(user)) {
    return NextResponse.json({ error: 'Accès réservé aux super_admin' }, { status: 403 })
  }

  const body = await request.json().catch(err => { logger.warn('[admin/init-team-table] Failed to parse request body:', err); return {}; })
  const { cabinet_id, user_id, email, full_name, role: memberRole } = body

  if (!cabinet_id || !email) {
    return NextResponse.json({ error: 'cabinet_id et email requis' }, { status: 400 })
  }

  const { data: insertData, error: insertError } = await supabaseAdmin
    .from('syndic_team_members')
    .upsert({
      cabinet_id,
      user_id: user_id || null,
      email,
      full_name: full_name || '',
      role: memberRole || 'syndic_tech',
      accepted_at: new Date().toISOString(),
      is_active: true,
    }, { onConflict: 'email' })
    .select()

  return NextResponse.json({
    success: !insertError,
    member_inserted: !insertError,
    member_data: insertData,
    error: insertError?.message,
  })
}
