import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSuperAdmin } from '@/lib/auth-helpers'
import { logger } from '@/lib/logger'
import { adminInitTeamTableSchema, validateBody } from '@/lib/validation'
import { estRoleEquipeSyndic } from '@/lib/syndic/equipe-contraintes'

/** Colonnes de l'unicité (cabinet_id, email) de la table (UNICITE_EMAIL_PAR_CABINET, migration 20261115) : cible de l'upsert. */
const CIBLE_UPSERT = 'cabinet_id,email'

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

    const { cabinet_id, user_id, email, full_name, role } = v.data
    const memberRole = role || 'syndic_tech'
    if (!estRoleEquipeSyndic(memberRole)) {
      return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 })
    }

    // Une adresse par cabinet (unicité (cabinet_id, email), migration 20261115) : l'upsert vise ce couple, l'e-mail
    // en minuscules comme dans POST /api/syndic/team. L'ancienne cible, l'e-mail seul, ne correspondait à aucune
    // unicité de la production : l'upsert échouait toujours (42P10). ignoreDuplicates (ON CONFLICT DO NOTHING) : une
    // ligne existante n'est jamais réécrite (compte rattaché, nom, rôle, membre désactivé), seule une adresse nouvelle
    // dans le cabinet est ajoutée.
    const { data: insertData, error: insertError } = await supabaseAdmin
      .from('syndic_team_members')
      .upsert({
        cabinet_id,
        user_id: user_id || null,
        email: email.toLowerCase(),
        full_name: full_name || '',
        role: memberRole,
        accepted_at: new Date().toISOString(),
        is_active: true,
      }, { onConflict: CIBLE_UPSERT, ignoreDuplicates: true })
      .select()

    if (insertError) {
      logger.error('[admin/init-team-table] Upsert error:', insertError)
      return NextResponse.json({ error: 'Erreur lors de la création du membre' }, { status: 500 })
    }
    if (!insertData || insertData.length === 0) {
      return NextResponse.json({ error: 'Cet email est déjà membre de cette équipe' }, { status: 409 })
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
