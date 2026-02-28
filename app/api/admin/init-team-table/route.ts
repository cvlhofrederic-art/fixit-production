import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'

/**
 * Route d'initialisation de la table syndic_team_members
 * SÉCURISÉE : nécessite authentification super_admin
 */
export async function POST(request: NextRequest) {
  // ── Auth : super_admin uniquement ─────────────────────────────────────────
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }
  if (user.user_metadata?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Accès réservé aux super_admin' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
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
