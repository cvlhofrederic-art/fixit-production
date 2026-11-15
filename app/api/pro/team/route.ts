import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isProSocieteRole, isProGerant, resolveCompanyId } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { templateProTeamInvite } from '@/lib/email'
import { logger } from '@/lib/logger'
import { validateBody, proTeamInviteSchema } from '@/lib/validation'
import { ROLE_LABELS, isValidProTeamRole } from '@/lib/permissions'
import type { ProTeamRole } from '@/lib/permissions'
import { nouvelleInvitation, sansJetonInvitation } from '@/lib/equipe/lien-invitation'
import { envoyerEmailInvitation } from '@/lib/equipe/invitation-serveur'

// ── GET /api/pro/team ────────────────────────────────────────────────────────
// List team members for the authenticated company
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user || !isProSocieteRole(user)) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const ip = getClientIP(request)
  if (!(await checkRateLimit(`pro_team_get_${ip}`, 30, 60_000))) return rateLimitResponse()

  const companyId = await resolveCompanyId(user, supabaseAdmin)

  // Self-healing : si le gérant n'apparaît pas comme membre (cas des sociétés
  // inscrites avant l'auto-init au signup), on l'ajoute idempotamment ici.
  // Évite que l'écran "Comptes utilisateurs" affiche "0/20" pour le gérant lui-même.
  if (isProGerant(user) && user.email && companyId === user.id) {
    const { data: gerantRow } = await supabaseAdmin
      .from('pro_team_members')
      .select('id')
      .eq('company_id', companyId)
      .eq('email', user.email.toLowerCase().trim())
      .maybeSingle()
    if (!gerantRow) {
      const meta = (user.user_metadata || {}) as Record<string, unknown>
      const fullName = (meta.full_name as string)
        || [meta.prenom, meta.nom].filter(Boolean).join(' ')
        || (user.email.split('@')[0] || 'Gérant')
      await supabaseAdmin.from('pro_team_members').insert({
        company_id: companyId,
        user_id: user.id,
        email: user.email.toLowerCase().trim(),
        full_name: fullName,
        phone: (meta.phone as string) || '',
        role: 'GERANT',
        assigned_chantiers: [],
        invite_token: null,
        invite_sent_at: null,
        accepted_at: new Date().toISOString(),
        is_active: true,
      })
    }
  }

  const { data, error } = await supabaseAdmin
    .from('pro_team_members')
    .select('id, email, full_name, phone, role, assigned_chantiers, invite_sent_at, accepted_at, last_login_at, is_active, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true })

  if (error) {
    logger.error('[PRO_TEAM] GET error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }

  // Fetch permission overrides for each member
  const memberIds = (data || []).map(m => m.id)
  let overridesMap: Record<string, { module_id: string; access_level: string }[]> = {}

  if (memberIds.length > 0) {
    const { data: overrides } = await supabaseAdmin
      .from('pro_role_permissions')
      .select('member_id, module_id, access_level')
      .in('member_id', memberIds)

    if (overrides) {
      overridesMap = overrides.reduce((acc, ov) => {
        if (!acc[ov.member_id]) acc[ov.member_id] = []
        acc[ov.member_id].push({ module_id: ov.module_id, access_level: ov.access_level })
        return acc
      }, {} as Record<string, { module_id: string; access_level: string }[]>)
    }
  }

  const members = (data || []).map(m => ({
    ...m,
    permission_overrides: overridesMap[m.id] || [],
  }))

  const response = NextResponse.json({ members })
  response.headers.set('Cache-Control', 'private, max-age=0, s-maxage=30, stale-while-revalidate=60')
  return response
}

// ── POST /api/pro/team ───────────────────────────────────────────────────────
// Invite a new team member (gérant only)
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user || !isProSocieteRole(user)) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  if (!isProGerant(user)) {
    return NextResponse.json({ error: 'Droits insuffisants (gérant requis)' }, { status: 403 })
  }

  const ip = getClientIP(request)
  if (!(await checkRateLimit(`pro_team_post_${ip}`, 10, 60_000))) return rateLimitResponse()

  const body = await request.json()
  const validation = validateBody(proTeamInviteSchema, body)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const { email, full_name, phone, memberRole, assigned_chantiers, permissionOverrides } = validation.data

  if (!isValidProTeamRole(memberRole)) {
    return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 })
  }

  const companyId = user.id // Gérant = company owner
  const emailInvite = email.toLowerCase().trim()

  // Check if member already exists
  const { data: existing } = await supabaseAdmin
    .from('pro_team_members')
    .select('id')
    .eq('company_id', companyId)
    .eq('email', emailInvite)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Cet email est déjà membre de votre équipe' }, { status: 409 })
  }

  // Invitation et lien signé, envoyé seulement par e-mail et jamais renvoyé à l'invitant
  // (lib/equipe/lien-invitation.ts). Signé avant l'insertion : sans clé de signature, rien n'est écrit.
  let invitation: Awaited<ReturnType<typeof nouvelleInvitation>>
  try {
    invitation = await nouvelleInvitation('pro', emailInvite, companyId, memberRole)
  } catch (err) {
    logger.error('[PRO_TEAM] POST signature error:', err)
    return NextResponse.json({ error: 'Erreur lors de la création du membre' }, { status: 500 })
  }

  const insertData: Record<string, unknown> = {
    id: invitation.id,
    company_id: companyId,
    email: emailInvite,
    full_name: full_name.trim(),
    phone: phone?.trim() || '',
    role: memberRole,
    assigned_chantiers: assigned_chantiers || [],
    invite_token: invitation.invite_token,
    invite_sent_at: new Date().toISOString(),
  }

  const { data: member, error } = await supabaseAdmin
    .from('pro_team_members')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    logger.error('[PRO_TEAM] POST insert error:', error)
    return NextResponse.json({ error: 'Erreur lors de la création du membre' }, { status: 500 })
  }

  // Insert permission overrides if provided
  if (Array.isArray(permissionOverrides) && permissionOverrides.length > 0 && member) {
    const overrideRows = permissionOverrides.map(ov => ({
      company_id: companyId,
      member_id: member.id,
      module_id: ov.module_id,
      access_level: ov.access_level,
    }))
    await supabaseAdmin.from('pro_role_permissions').insert(overrideRows)
  }

  // Audit log
  await supabaseAdmin.from('pro_team_audit_log').insert({
    company_id: companyId,
    actor_id: user.id,
    action: 'invite',
    target_member_id: member?.id,
    details: { email, role: memberRole },
  })

  // Build invitation URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const inviteUrl = `${appUrl}/pro/invite?token=${invitation.jetonLien}`

  // Send invitation email
  const companyName = user.user_metadata?.company_name || user.user_metadata?.full_name || 'Entreprise'
  const locale = user.user_metadata?.locale || 'fr'
  const isPt = locale === 'pt'
  const roleName = isPt ? ROLE_LABELS[memberRole as ProTeamRole].pt : ROLE_LABELS[memberRole as ProTeamRole].fr

  const emailTemplate = templateProTeamInvite({
    memberName: full_name,
    roleName,
    companyName,
    inviteUrl,
    locale,
  })

  const emailSent = await envoyerEmailInvitation(emailInvite, emailTemplate, [
    { name: 'template', value: 'pro_team_invite' },
    { name: 'company_id', value: user.id },
  ], '[PRO_TEAM]')

  // Ni le lien ni le jeton ne sont renvoyés : seule la boîte mail invitée reçoit le lien.
  return NextResponse.json({
    member: member ? sansJetonInvitation(member) : member,
    email_sent: emailSent,
    message: emailSent
      ? `Invitation envoyée par email à ${emailInvite}`
      : `L'invitation pour ${emailInvite} est créée, mais l'e-mail n'a pas pu être envoyé. Vérifiez l'adresse puis renvoyez l'invitation.`,
  })
}

/**
 * Le compte visé a-t-il été rattaché à CETTE société par une invitation, et à aucune autre depuis ? Lu dans son
 * app_metadata, que seul le serveur écrit : désormais à l'acceptation d'une invitation seulement
 * (lib/equipe/invitation-serveur.ts, POST /api/pro/invite ; avant ce correctif, ce PATCH l'écrivait aussi) : rôle
 * pro_societe, company_id égal à cette société, rôle d'équipe autre que GERANT. Un gérant (d'ici ou d'ailleurs), un
 * sous-compte d'une autre société et les comptes des autres espaces ne le sont pas. Un ancien membre retiré de l'équipe
 * (DELETE ne touche pas son compte) le reste, mais après la fermeture des écritures directes une nouvelle ligne pour
 * lui ne naît que d'une invitation qu'il accepte. Une ligne de pro_team_members ne prouve rien : elle a pu être posée
 * hors de l'application pour le compte d'un autre (R36).
 */
function compteMembreDeLaSociete(appMetadata: Record<string, unknown>, companyId: string | null): boolean {
  const roleEquipe = appMetadata.pro_team_role
  return !!companyId && appMetadata.role === 'pro_societe' && appMetadata.company_id === companyId
    && typeof roleEquipe === 'string' && roleEquipe !== '' && roleEquipe !== 'GERANT'
}

const MESSAGE_COMPTE_HORS_SOCIETE =
  "Ce compte n'est pas rattaché à votre société : son rôle ne peut pas être modifié ici."

// ── PATCH /api/pro/team ──────────────────────────────────────────────────────
// Update member role, status, chantiers, or permissions (gérant only)
export async function PATCH(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user || !isProSocieteRole(user)) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  if (!isProGerant(user)) {
    return NextResponse.json({ error: 'Droits insuffisants (gérant requis)' }, { status: 403 })
  }

  const ip = getClientIP(request)
  if (!(await checkRateLimit(`pro_team_patch_${ip}`, 20, 60_000))) return rateLimitResponse()

  const body = await request.json()
  const { member_id, role, is_active, assigned_chantiers, permissions } = body

  if (!member_id) {
    return NextResponse.json({ error: 'member_id requis' }, { status: 400 })
  }

  const companyId = await resolveCompanyId(user, supabaseAdmin)

  // Verify member belongs to this company
  const { data: existing } = await supabaseAdmin
    .from('pro_team_members')
    .select('id, user_id, role, invite_token')
    .eq('id', member_id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!existing) {
    return NextResponse.json({ error: 'Membre introuvable' }, { status: 404 })
  }

  // Invitation en cours (lien envoyé, jeton encore en base) : son rôle est signé dans ce lien
  // (lib/equipe/lien-invitation.ts), le changer le rendrait inutilisable. Pour un autre rôle : supprimer
  // l'invitation puis inviter à nouveau. Les lignes sans invitation (gérant, ajout direct) ne sont pas concernées ; un
  // rôle invalide reçoit plus bas son 400 habituel.
  if (role !== undefined && isValidProTeamRole(role) && existing.invite_token) {
    return NextResponse.json({
      error: "Invitation en attente : son rôle ne peut plus être modifié. Supprimez l'invitation puis invitez à nouveau avec le bon rôle.",
    }, { status: 409 })
  }

  // Cannot demote GERANT
  if (existing.role === 'GERANT' && role && role !== 'GERANT') {
    return NextResponse.json({ error: 'Impossible de modifier le rôle du gérant' }, { status: 403 })
  }

  const updates: Record<string, unknown> = {}
  if (role !== undefined) {
    if (!isValidProTeamRole(role)) return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 })
    updates.role = role
  }
  if (is_active !== undefined) updates.is_active = Boolean(is_active)
  if (assigned_chantiers !== undefined) updates.assigned_chantiers = assigned_chantiers

  // Rôle d'un compte déjà lié : il fixe aussi ses droits (app_metadata.pro_team_role, lu par isProGerant). Le compte
  // visé est vérifié AVANT la moindre écriture (R36). La ligne du gérant lui-même (user_id = la société) ne garde que
  // GERANT (contrôle ci-dessus) : rien n'est à écrire dans son compte.
  let cible: { id: string; appMetadata: Record<string, unknown> } | null = null
  if (updates.role !== undefined && existing.user_id && existing.user_id !== companyId) {
    const { data: compte, error: lectureCompte } = await supabaseAdmin.auth.admin.getUserById(existing.user_id)
    // Compte supprimé (la suppression de compte ne retire pas les lignes d'équipe BTP) : il n'est membre de rien,
    // comme un compte hors de la société.
    const compteSupprime = !compte?.user
      && (!lectureCompte || lectureCompte.status === 404 || lectureCompte.code === 'user_not_found')
    if (!compte?.user && !compteSupprime) {
      logger.error('[PRO_TEAM] PATCH : lecture du compte visé impossible', { member_id }, lectureCompte)
      return NextResponse.json({ error: 'Erreur mise à jour' }, { status: 500 })
    }
    const appMetadata: Record<string, unknown> = compte?.user?.app_metadata ?? {}
    if (compteSupprime || !compteMembreDeLaSociete(appMetadata, companyId)) {
      logger.warn('[PRO_TEAM] PATCH : compte visé hors de cette société, rôle non modifié', { member_id })
      return NextResponse.json({ error: MESSAGE_COMPTE_HORS_SOCIETE }, { status: 403 })
    }
    cible = { id: existing.user_id, appMetadata }
  }

  if (Object.keys(updates).length > 0) {
    const { data, error } = await supabaseAdmin
      .from('pro_team_members')
      .update(updates)
      .eq('id', member_id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Erreur mise à jour' }, { status: 500 })
    }

    // Rôle modifié d'un sous-compte vérifié ci-dessus : app_metadata (server-only) reçoit le seul pro_team_role ;
    // company_id reste le sien, cette société : le PATCH ne rattache jamais un compte à une société. Le statut
    // (is_active) n'écrit plus app_metadata : pour un membre de la société, y reposer company_id ne changeait rien ;
    // pour le compte d'un autre, c'était la faille (R36).
    // ⚠️ SÉCURITÉ : pro_team_role DOIT vivre dans app_metadata (non forgeable côté
    // client) car isProGerant() s'appuie dessus pour l'authz. Ne JAMAIS l'écrire dans
    // user_metadata (modifiable via supabase.auth.updateUser).
    let roleNonApplique = false
    if (cible) {
      try {
        const { error: ecriture } = await supabaseAdmin.auth.admin.updateUserById(cible.id, {
          app_metadata: { ...cible.appMetadata, pro_team_role: updates.role },
        })
        if (ecriture) {
          roleNonApplique = true
          logger.error('[PRO_TEAM] Failed to update app_metadata:', { member_id }, ecriture)
        }
      } catch (e) {
        roleNonApplique = true
        logger.error('[PRO_TEAM] Failed to update app_metadata:', { member_id }, e)
      }
    }

    // Audit log
    await supabaseAdmin.from('pro_team_audit_log').insert({
      company_id: companyId,
      actor_id: user.id,
      action: is_active === false ? 'deactivate' : is_active === true ? 'reactivate' : 'update_role',
      target_member_id: member_id,
      details: updates,
    })

    // Update permission overrides if provided
    if (Array.isArray(permissions)) {
      // Delete existing overrides and re-insert
      await supabaseAdmin.from('pro_role_permissions').delete().eq('member_id', member_id)
      if (permissions.length > 0) {
        const overrideRows = permissions.map((ov: { module_id: string; access_level: string }) => ({
          company_id: companyId,
          member_id,
          module_id: ov.module_id,
          access_level: ov.access_level,
        }))
        await supabaseAdmin.from('pro_role_permissions').insert(overrideRows)
      }

      await supabaseAdmin.from('pro_team_audit_log').insert({
        company_id: companyId,
        actor_id: user.id,
        action: 'update_permissions',
        target_member_id: member_id,
        details: { permissions },
      })
    }

    // La ligne porte déjà le nouveau rôle (journalisé), pas le compte, dont app_metadata fixe les droits : le dire,
    // plutôt que répondre 200 (un retrait de droits resterait sans effet). La même demande, relancée, aboutit.
    if (roleNonApplique) {
      return NextResponse.json({ error: "Le rôle n'a pas pu être appliqué au compte du membre. Réessayez." }, { status: 500 })
    }

    return NextResponse.json({ member: data })
  }

  return NextResponse.json({ error: 'Aucune modification' }, { status: 400 })
}

// ── DELETE /api/pro/team ─────────────────────────────────────────────────────
// Remove a team member (gérant only)
export async function DELETE(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user || !isProSocieteRole(user)) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  if (!isProGerant(user)) {
    return NextResponse.json({ error: 'Droits insuffisants (gérant requis)' }, { status: 403 })
  }

  const ip = getClientIP(request)
  if (!(await checkRateLimit(`pro_team_delete_${ip}`, 10, 60_000))) return rateLimitResponse()

  const { searchParams } = new URL(request.url)
  const memberId = searchParams.get('member_id')
  if (!memberId) return NextResponse.json({ error: 'member_id requis' }, { status: 400 })

  const companyId = await resolveCompanyId(user, supabaseAdmin)

  // Prevent deleting the gérant
  const { data: target } = await supabaseAdmin
    .from('pro_team_members')
    .select('role')
    .eq('id', memberId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!target) {
    return NextResponse.json({ error: 'Membre introuvable' }, { status: 404 })
  }
  if (target.role === 'GERANT') {
    return NextResponse.json({ error: 'Impossible de supprimer le gérant' }, { status: 403 })
  }

  // Audit log before deletion
  await supabaseAdmin.from('pro_team_audit_log').insert({
    company_id: companyId,
    actor_id: user.id,
    action: 'delete',
    target_member_id: memberId,
    details: { role: target.role },
  })

  const { error } = await supabaseAdmin
    .from('pro_team_members')
    .delete()
    .eq('id', memberId)
    .eq('company_id', companyId)

  if (error) {
    return NextResponse.json({ error: 'Erreur suppression' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
