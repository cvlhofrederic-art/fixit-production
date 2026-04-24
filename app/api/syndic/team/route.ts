import { randomHex } from '@/lib/crypto-compat'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, getUserRole, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { sendEmail, templateTeamInvite } from '@/lib/email'
import { logger } from '@/lib/logger'
import { validateBody, syndicTeamInviteSchema } from '@/lib/validation'

// ── GET /api/syndic/team ──────────────────────────────────────────────────────
// Retourne tous les membres de l'équipe du cabinet connecté
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user || !isSyndicRole(user)) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`team_get_${ip}`, 30, 60_000))) return rateLimitResponse()

  // Trouver le cabinet_id : si admin → son propre id, si employé → son cabinet_id
  const cabinetId = await resolveCabinetId(user, supabaseAdmin)

  const { data, error } = await supabaseAdmin
    .from('syndic_team_members')
    .select('id, email, full_name, role, invite_sent_at, accepted_at, is_active, created_at, custom_modules')
    .eq('cabinet_id', cabinetId)
    .order('created_at', { ascending: true })

  if (error) {
    logger.error('[TEAM] GET error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }

  // Sécurité : ne pas exposer les invite_token dans la réponse GET
  // Le token est uniquement retourné lors du POST (création)
  const response = NextResponse.json({ members: data || [] })
  response.headers.set('Cache-Control', 'private, max-age=0, s-maxage=60, stale-while-revalidate=120')
  return response
}

// ── POST /api/syndic/team ─────────────────────────────────────────────────────
// Crée un nouveau membre (invitation) avec modules personnalisés optionnels
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user || !isSyndicRole(user)) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  // Seuls les admins peuvent inviter
  const role = getUserRole(user)
  if (role !== 'syndic' && role !== 'syndic_admin') {
    return NextResponse.json({ error: 'Droits insuffisants (admin requis)' }, { status: 403 })
  }

  const ip = getClientIP(request)
  if (!(await checkRateLimit(`team_post_${ip}`, 10, 60_000))) return rateLimitResponse()

  const body = await request.json()
  const validation = validateBody(syndicTeamInviteSchema, body)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }
  const { email, full_name, memberRole, customModules } = validation.data

  const validRoles = ['syndic_admin', 'syndic_tech', 'syndic_secretaire', 'syndic_gestionnaire', 'syndic_comptable', 'syndic_juriste']
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
  const inviteToken = randomHex(24)

  // Préparer l'insertion avec custom_modules optionnels
  const insertData: Record<string, unknown> = {
    cabinet_id: cabinetId,
    email: email.toLowerCase().trim(),
    full_name: full_name.trim(),
    role: memberRole,
    invite_token: inviteToken,
    invite_sent_at: new Date().toISOString(),
  }
  // Si des modules personnalisés sont fournis, les stocker
  if (Array.isArray(customModules) && customModules.length > 0) {
    insertData.custom_modules = customModules
  }

  const { data, error } = await supabaseAdmin
    .from('syndic_team_members')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    logger.error('[TEAM] POST error:', error)
    return NextResponse.json({ error: 'Erreur lors de la création du membre' }, { status: 500 })
  }

  // URL d'invitation
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const inviteUrl = `${appUrl}/syndic/invite?token=${inviteToken}`

  // ── Envoyer l'email d'invitation automatiquement ──────────────────
  const cabinetName = user.user_metadata?.cabinet_name || user.user_metadata?.full_name || 'Cabinet'
  const roleLabels: Record<string, string> = {
    syndic_admin: 'Administrateur',
    syndic_tech: 'Technicien',
    syndic_secretaire: 'Secrétaire',
    syndic_gestionnaire: 'Gestionnaire',
    syndic_comptable: 'Comptable',
    syndic_juriste: 'Juriste',
  }
  const roleName = roleLabels[memberRole] || memberRole

  const emailTemplate = templateTeamInvite({
    memberName: full_name,
    roleName,
    cabinetName,
    inviteUrl,
  })

  let emailSent = false
  try {
    const emailResult = await sendEmail({
      to: email.toLowerCase().trim(),
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      tags: [
        { name: 'template', value: 'team_invite' },
        { name: 'cabinet_id', value: user.id },
      ],
    })
    emailSent = emailResult.success
    if (!emailResult.success) {
      logger.warn('[TEAM] Email invite failed:', emailResult.error)
    }
  } catch (emailErr: unknown) {
    logger.warn('[TEAM] Email invite error:', emailErr instanceof Error ? emailErr.message : emailErr)
  }

  return NextResponse.json({
    member: data,
    invite_url: inviteUrl,
    email_sent: emailSent,
    message: emailSent
      ? `Invitation envoyée par email à ${email}`
      : `Invitation créée pour ${email}. Partagez ce lien : ${inviteUrl}`,
  })
}

// ── PATCH /api/syndic/team ────────────────────────────────────────────────────
// Modifier un membre (rôle, statut actif, modules personnalisés)
export async function PATCH(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user || !isSyndicRole(user)) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  const userRole = getUserRole(user)
  if (userRole !== 'syndic' && userRole !== 'syndic_admin') {
    return NextResponse.json({ error: 'Droits insuffisants (admin requis)' }, { status: 403 })
  }

  const ip = getClientIP(request)
  if (!(await checkRateLimit(`team_patch_${ip}`, 20, 60_000))) return rateLimitResponse()

  const body = await request.json()
  const { member_id, role, is_active, customModules } = body

  if (!member_id) {
    return NextResponse.json({ error: 'member_id requis' }, { status: 400 })
  }

  const cabinetId = await resolveCabinetId(user, supabaseAdmin)

  // Vérifier que ce membre appartient bien à ce cabinet
  const { data: existing } = await supabaseAdmin
    .from('syndic_team_members')
    .select('id, user_id')
    .eq('id', member_id)
    .eq('cabinet_id', cabinetId)
    .maybeSingle()

  if (!existing) {
    return NextResponse.json({ error: 'Membre introuvable' }, { status: 404 })
  }

  const updates: Record<string, unknown> = {}
  if (role !== undefined) {
    const validRoles = ['syndic_admin', 'syndic_tech', 'syndic_secretaire', 'syndic_gestionnaire', 'syndic_comptable', 'syndic_juriste']
    if (!validRoles.includes(role)) return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 })
    updates.role = role
  }
  if (is_active !== undefined) updates.is_active = Boolean(is_active)
  // custom_modules : tableau de pages ou null pour réinitialiser aux défauts du rôle
  if (customModules !== undefined) {
    updates.custom_modules = customModules === null ? null : (Array.isArray(customModules) ? customModules : null)
  }

  const { data, error } = await supabaseAdmin
    .from('syndic_team_members')
    .update(updates)
    .eq('id', member_id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Erreur mise à jour' }, { status: 500 })
  }

  // Si rôle modifié et membre a un compte, écrire dans app_metadata (server-only)
  if (role && existing.user_id) {
    try {
      const { data: target } = await supabaseAdmin.auth.admin.getUserById(existing.user_id)
      await supabaseAdmin.auth.admin.updateUserById(existing.user_id, {
        app_metadata: { ...(target?.user?.app_metadata || {}), role, cabinet_id: cabinetId },
      })
    } catch (e) {
      logger.error('[TEAM] Failed to update app_metadata:', e)
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
  const userRole = getUserRole(user)
  if (userRole !== 'syndic' && userRole !== 'syndic_admin') {
    return NextResponse.json({ error: 'Droits insuffisants (admin requis)' }, { status: 403 })
  }

  const ip = getClientIP(request)
  if (!(await checkRateLimit(`team_delete_${ip}`, 10, 60_000))) return rateLimitResponse()

  const { searchParams } = new URL(request.url)
  const memberId = searchParams.get('member_id')
  if (!memberId) return NextResponse.json({ error: 'member_id requis' }, { status: 400 })

  const cabinetId = await resolveCabinetId(user, supabaseAdmin)

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
