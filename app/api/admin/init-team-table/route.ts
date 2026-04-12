import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSuperAdmin } from '@/lib/auth-helpers'
import { logger } from '@/lib/logger'
import { adminInitTeamTableSchema, validateBody } from '@/lib/validation'

/**
 * Route d'initialisation de la table syndic_team_members
 * SÉCURISÉE : nécessite authentification super_admin (app_metadata)
 */
export async function POST(request: NextRequest) {
  try {
    // ── Auth : super_admin uniquement (vérifié via app_metadata, non forgeable) ──
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
    }
    if (!isSuperAdmin(user)) {
      return NextResponse.json({ error: 'Accès réservé aux super_admin' }, { status: 403 })
    }

    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch (err) {
      logger.warn('[admin/init-team-table] Failed to parse request body:', err)
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const v = validateBody(adminInitTeamTableSchema, rawBody)
    if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })

    const { cabinet_id, user_id, email, full_name, role: memberRole } = v.data

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

    if (insertError) {
      logger.error('[admin/init-team-table] Upsert error:', insertError)
      return NextResponse.json({ error: 'Erreur lors de la création du membre' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      member_inserted: true,
      member_data: insertData,
    })
  } catch (err) {
    logger.error('[admin/init-team-table/POST] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
