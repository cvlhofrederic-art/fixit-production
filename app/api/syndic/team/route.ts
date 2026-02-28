import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSyndicRole } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

// ── GET /api/syndic/team ──────────────────────────────────────────────────────
// Retourne tous les membres de l'équipe du cabinet connecté
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user || !isSyndicRole(user)) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  const ip = getClientIP(request)
  if (!checkRateLimit(`team_get_${ip}`, 30, 60_000)) return rateLimitResponse()

  // Trouver le cabinet_id : si admin → son propre id, si employé → son cabinet_id
  const cabinetId = user.user_metadata?.cabinet_id || user.id

  const { data, error } = await supabaseAdmin
    .from('syndic_team_members')
    .select('id, email, full_name, role, invite_token, invite_sent_at, accepted_at, is_active, created_at')
    .eq('cabinet_id', cabinetId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[TEAM] GET error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }

  return NextResponse.json({ members: data || [] })
}

// ── POST /api/syndic/team ─────────────────────────────────────────────────────
// Crée un nouveau membre (invitation)
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user || !isSyndicRole(user)) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  // Seuls les admins peuvent inviter
  const role = user.user_metadata?.role || ''
  if (role !== 'syndic' && role !== 'syndic_admin') {
    return NextResponse.json({ error: 'Droits insuffisants (admin requis)' }, { status: 403 })
  }

  const ip = getClientIP(request)
  if (!checkRateLimit(`team_post_${ip}`, 10, 60_000)) return rateLimitResponse()

  const body = await request.json()
  const { email, full_name, memberRole } = body

  if (!email || !full_name || !memberRole) {
    return NextResponse.json({ error: 'email, full_name et role sont requis' }, { status: 400 })
  }

  const validRoles = ['syndic_admin', 'syndic_tech', 'syndic_secretaire', 'syndic_gestionnaire', 'syndic_comptable']
  if (!validRoles.includes(memberRole)) {
    return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 })
  }

  const cabinetId = user.id // L'invitant est toujours le compte maître

  // Vérifier que ce membre n'existe pas déjà
  const { data: existing } = await supabaseAdmin
    .from('syndic_team_members')
    .select('id')
    .eq('cabinet_id', cabinetId)
    .eq('email', email.toLowerCase().trim())
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Cet email est déjà membre de votre équipe' }, { status: 409 })
  }

  // Générer le token d'invitation
  const inviteToken = Math.random().toString(36).substring(2) + Date.now().toString(36) + Math.random().toString(36).substring(2)

  const { data, error } = await supabaseAdmin
    .from('syndic_team_members')
    .insert({
      cabinet_id: cabinetId,
      email: email.toLowerCase().trim(),
      full_name: full_name.trim(),
      role: memberRole,
      invite_token: inviteToken,
      invite_sent_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    console.error('[TEAM] POST error:', error)
    return NextResponse.json({ error: 'Erreur lors de la création du membre' }, { status: 500 })
  }

  // URL d'invitation
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const inviteUrl = `${appUrl}/syndic/invite?token=${inviteToken}`

  return NextResponse.json({
    member: data,
    invite_url: inviteUrl,
    message: `Invitation créée pour ${email}. Partagez ce lien : ${inviteUrl}`,
  })
}

// ── PATCH /api/syndic/team ────────────────────────────────────────────────────
// Modifier un membre (rôle, statut actif)
export async function PATCH(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user || !isSyndicRole(user)) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  const userRole = user.user_metadata?.role || ''
  if (userRole !== 'syndic' && userRole !== 'syndic_admin') {
    return NextResponse.json({ error: 'Droits insuffisants (admin requis)' }, { status: 403 })
  }

  const ip = getClientIP(request)
  if (!checkRateLimit(`team_patch_${ip}`, 20, 60_000)) return rateLimitResponse()

  const body = await request.json()
  const { member_id, role, is_active } = body

  if (!member_id) {
    return NextResponse.json({ error: 'member_id requis' }, { status: 400 })
  }

  const cabinetId = user.id

  // Vérifier que ce membre appartient bien à ce cabinet
  const { data: existing } = await supabaseAdmin
    .from('syndic_team_members')
    .select('id')
    .eq('id', member_id)
    .eq('cabinet_id', cabinetId)
    .maybeSingle()

  if (!existing) {
    return NextResponse.json({ error: 'Membre introuvable' }, { status: 404 })
  }

  const updates: Record<string, unknown> = {}
  if (role !== undefined) {
    const validRoles = ['syndic_admin', 'syndic_tech', 'syndic_secretaire', 'syndic_gestionnaire', 'syndic_comptable']
    if (!validRoles.includes(role)) return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 })
    updates.role = role
  }
  if (is_active !== undefined) updates.is_active = Boolean(is_active)

  const { data, error } = await supabaseAdmin
    .from('syndic_team_members')
    .update(updates)
    .eq('id', member_id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Erreur mise à jour' }, { status: 500 })
  }

  // Si rôle modifié et membre a un compte, mettre à jour son user_metadata
  if (role && data.user_id) {
    try {
      await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
        user_metadata: { role, cabinet_id: cabinetId },
      })
    } catch (e) {
      console.error('[TEAM] Failed to update user_metadata:', e)
    }
  }

  return NextResponse.json({ member: data })
}

// ── DELETE /api/syndic/team ───────────────────────────────────────────────────
// Supprimer un membre
export async function DELETE(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user || !isSyndicRole(user)) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  const userRole = user.user_metadata?.role || ''
  if (userRole !== 'syndic' && userRole !== 'syndic_admin') {
    return NextResponse.json({ error: 'Droits insuffisants (admin requis)' }, { status: 403 })
  }

  const ip = getClientIP(request)
  if (!checkRateLimit(`team_delete_${ip}`, 10, 60_000)) return rateLimitResponse()

  const { searchParams } = new URL(request.url)
  const memberId = searchParams.get('member_id')
  if (!memberId) return NextResponse.json({ error: 'member_id requis' }, { status: 400 })

  const cabinetId = user.id

  const { error } = await supabaseAdmin
    .from('syndic_team_members')
    .delete()
    .eq('id', memberId)
    .eq('cabinet_id', cabinetId)

  if (error) {
    return NextResponse.json({ error: 'Erreur suppression' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
