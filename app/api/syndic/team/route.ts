import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, getUserRole, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { templateTeamInvite } from '@/lib/email'
import { logger } from '@/lib/logger'
import { validateBody, syndicTeamInviteSchema } from '@/lib/validation'
import { nouvelleInvitation, sansJetonInvitation } from '@/lib/equipe/lien-invitation'
import { envoyerEmailInvitation } from '@/lib/equipe/invitation-serveur'
import { estRoleEquipeSyndic, UNICITE_EMAIL_PAR_CABINET, type RoleEquipeSyndic } from '@/lib/syndic/equipe-contraintes'

/**
 * Rôles qui administrent l'équipe du cabinet (invitation, modification, suppression).
 * super_admin : accepté comme par isSyndicRole, sur SON cabinet (resolveCabinetId → son id).
 */
const ROLES_ADMIN_EQUIPE: ReadonlySet<string> = new Set(['syndic', 'syndic_admin', 'super_admin'])

const COLONNES_EQUIPE = 'id, email, full_name, role, invite_sent_at, accepted_at, is_active, created_at'

/**
 * Colonne inconnue de la base (Postgres 42703, ou cache de schéma PostgREST PGRST204) :
 * `custom_modules` n'est créée par aucune migration du dépôt.
 */
function colonneAbsente(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return error.code === '42703' || error.code === 'PGRST204' || /column .* does not exist/i.test(error.message ?? '')
}

/**
 * Adresse déjà présente dans le cabinet (Postgres 23505 sur l'unicité (cabinet_id, email), migration 20261115) :
 * deux invitations simultanées de la même adresse passent ensemble la vérification qui précède l'insertion.
 */
function doublonEmailDuCabinet(error: { code?: string; message?: string } | null): boolean {
  return error?.code === '23505' && (error.message ?? '').includes(UNICITE_EMAIL_PAR_CABINET)
}

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

  const lireEquipe = (colonnes: string) => supabaseAdmin
    .from('syndic_team_members')
    .select(colonnes)
    .eq('cabinet_id', cabinetId)
    .order('created_at', { ascending: true })

  let { data, error } = await lireEquipe(`${COLONNES_EQUIPE}, custom_modules`)
  if (colonneAbsente(error)) {
    // Base sans la colonne custom_modules : la liste des membres reste due (modules par défaut du rôle).
    logger.warn('[TEAM] GET : colonne custom_modules absente, lecture sans les modules personnalisés')
    ;({ data, error } = await lireEquipe(COLONNES_EQUIPE))
  }

  if (error) {
    logger.error('[TEAM] GET error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }

  // Sécurité : ne pas exposer les invite_token dans la réponse GET
  // (le lien d'invitation signé part seulement par e-mail, voir POST)
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
  if (!ROLES_ADMIN_EQUIPE.has(role)) {
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

  if (!estRoleEquipeSyndic(memberRole)) {
    return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 })
  }

  const cabinetId = user.id // L'invitant est toujours le compte maître
  const emailInvite = email.toLowerCase().trim()

  // Vérifier que ce membre n'existe pas déjà
  const { data: existing } = await supabaseAdmin
    .from('syndic_team_members')
    .select('id')
    .eq('cabinet_id', cabinetId)
    .eq('email', emailInvite)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Cet email est déjà membre de votre équipe' }, { status: 409 })
  }

  // Générer l'invitation et son lien signé, envoyé seulement par e-mail et jamais renvoyé à l'invitant
  // (lib/equipe/lien-invitation.ts). Signé avant l'insertion : sans clé de signature, rien n'est écrit.
  let invitation: Awaited<ReturnType<typeof nouvelleInvitation>>
  try {
    invitation = await nouvelleInvitation('syndic', emailInvite, cabinetId, memberRole)
  } catch (err) {
    logger.error('[TEAM] POST signature error:', err)
    return NextResponse.json({ error: 'Erreur lors de la création du membre' }, { status: 500 })
  }

  // Préparer l'insertion avec custom_modules optionnels
  const insertData: Record<string, unknown> = {
    id: invitation.id,
    cabinet_id: cabinetId,
    email: emailInvite,
    full_name: full_name.trim(),
    role: memberRole,
    invite_token: invitation.invite_token,
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
    if (doublonEmailDuCabinet(error)) {
      return NextResponse.json({ error: 'Cet email est déjà membre de votre équipe' }, { status: 409 })
    }
    logger.error('[TEAM] POST error:', error)
    return NextResponse.json({ error: 'Erreur lors de la création du membre' }, { status: 500 })
  }

  // URL d'invitation
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const inviteUrl = `${appUrl}/syndic/invite?token=${invitation.jetonLien}`

  // ── Envoyer l'email d'invitation automatiquement ──────────────────
  const cabinetName = user.user_metadata?.cabinet_name || user.user_metadata?.full_name || 'Cabinet'
  const roleLabels: Record<RoleEquipeSyndic, string> = {
    syndic_admin: 'Administrateur',
    syndic_tech: 'Gestionnaire Technique',
    syndic_technicien: 'Technicien',
    syndic_secretaire: 'Secrétaire',
    syndic_gestionnaire: 'Gestionnaire',
    syndic_comptable: 'Comptable',
    syndic_juriste: 'Juriste',
  }
  const roleName = roleLabels[memberRole] || memberRole

  const inviterLocale = user.user_metadata?.locale === 'pt' ? 'pt' : 'fr'
  const emailTemplate = templateTeamInvite({
    memberName: full_name,
    roleName,
    cabinetName,
    inviteUrl,
    locale: inviterLocale,
  })

  const emailSent = await envoyerEmailInvitation(emailInvite, emailTemplate, [
    { name: 'template', value: 'team_invite' },
    { name: 'cabinet_id', value: user.id },
  ], '[TEAM]')

  // Ni le lien ni le jeton ne sont renvoyés : seule la boîte mail invitée reçoit le lien.
  return NextResponse.json({
    member: data ? sansJetonInvitation(data) : data,
    email_sent: emailSent,
    message: emailSent
      ? `Invitation envoyée par email à ${emailInvite}`
      : `L'invitation pour ${emailInvite} est créée, mais l'e-mail n'a pas pu être envoyé. Vérifiez l'adresse, supprimez l'invitation puis invitez à nouveau.`,
  })
}

/**
 * Le compte visé est-il membre de CE cabinet ? Lu dans son app_metadata, que seul le serveur écrit : désormais à
 * l'acceptation d'une invitation seulement (lib/equipe/invitation-serveur.ts ; avant ce correctif, ce PATCH l'écrivait
 * aussi) : rôle syndic_* et cabinet_id égal à ce cabinet. Le titulaire (rôle 'syndic'), un super_admin, un membre d'un
 * autre cabinet et les comptes des autres espaces ne le sont pas. Une ligne de syndic_team_members ne le prouve pas :
 * elle a pu être posée hors de l'application (R36).
 */
function compteMembreDuCabinet(appMetadata: Record<string, unknown>, cabinetId: string | null): boolean {
  const role = appMetadata.role
  return !!cabinetId && typeof role === 'string' && role.startsWith('syndic_') && appMetadata.cabinet_id === cabinetId
}

const MESSAGE_ROLE_INVITATION_EN_ATTENTE =
  "Invitation en attente : son rôle ne peut plus être modifié. Supprimez l'invitation puis invitez à nouveau avec le bon rôle."
const MESSAGE_COMPTE_HORS_CABINET =
  "Ce compte n'est pas rattaché à votre cabinet : son rôle ne peut pas être modifié ici."
const MESSAGE_ROLE_NON_APPLIQUE =
  "Le rôle n'a pas pu être appliqué au compte du membre. Réessayez."

// ── PATCH /api/syndic/team ────────────────────────────────────────────────────
// Modifier un membre (rôle, statut actif, modules personnalisés)
export async function PATCH(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user || !isSyndicRole(user)) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  const userRole = getUserRole(user)
  if (!ROLES_ADMIN_EQUIPE.has(userRole)) {
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
    .select('id, user_id, invite_token')
    .eq('id', member_id)
    .eq('cabinet_id', cabinetId)
    .maybeSingle()

  if (!existing) {
    return NextResponse.json({ error: 'Membre introuvable' }, { status: 404 })
  }

  const updates: Record<string, unknown> = {}
  if (role !== undefined) {
    if (!estRoleEquipeSyndic(role)) return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 })
    updates.role = role
  }
  if (is_active !== undefined) updates.is_active = Boolean(is_active)
  // custom_modules : tableau de pages ou null pour réinitialiser aux défauts du rôle
  if (customModules !== undefined) {
    updates.custom_modules = customModules === null ? null : (Array.isArray(customModules) ? customModules : null)
  }

  // Rôle : il fixe aussi les droits du compte (app_metadata). Tout est vérifié AVANT la moindre écriture (R36).
  let cible: { id: string; appMetadata: Record<string, unknown> } | null = null
  // Invitation en cours (lien envoyé, jeton encore en base) : son rôle est signé dans ce lien
  // (lib/equipe/lien-invitation.ts), le changer le rendrait inutilisable. Une ligne sans compte ni invitation
  // (ajout direct) ne porte aucun lien : son rôle se change sur la ligne seule, comme avant.
  if (updates.role !== undefined && existing.invite_token) {
    return NextResponse.json({ error: MESSAGE_ROLE_INVITATION_EN_ATTENTE }, { status: 409 })
  }
  if (updates.role !== undefined && existing.user_id) {
    const { data: compte, error: lectureCompte } = await supabaseAdmin.auth.admin.getUserById(existing.user_id)
    // Compte supprimé (ligne restée orpheline) : il n'est membre de rien, comme un compte hors du cabinet.
    const compteSupprime = !compte?.user
      && (!lectureCompte || lectureCompte.status === 404 || lectureCompte.code === 'user_not_found')
    if (!compte?.user && !compteSupprime) {
      logger.error('[TEAM] PATCH : lecture du compte visé impossible', { member_id }, lectureCompte)
      return NextResponse.json({ error: 'Erreur mise à jour' }, { status: 500 })
    }
    const appMetadata: Record<string, unknown> = compte?.user?.app_metadata ?? {}
    if (compteSupprime || !compteMembreDuCabinet(appMetadata, cabinetId)) {
      logger.warn('[TEAM] PATCH : compte visé hors de ce cabinet, rôle non modifié', { member_id })
      return NextResponse.json({ error: MESSAGE_COMPTE_HORS_CABINET }, { status: 403 })
    }
    cible = { id: existing.user_id, appMetadata }
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

  // Rôle modifié d'un membre vérifié ci-dessus : app_metadata (server-only) reçoit le seul rôle ; cabinet_id reste
  // le sien, ce cabinet. Le PATCH ne rattache jamais un compte à un cabinet.
  if (cible) {
    let compteAJour = false
    try {
      const { error: ecriture } = await supabaseAdmin.auth.admin.updateUserById(cible.id, {
        app_metadata: { ...cible.appMetadata, role: updates.role },
      })
      if (ecriture) logger.error('[TEAM] Failed to update app_metadata:', { member_id }, ecriture)
      else compteAJour = true
    } catch (e) {
      logger.error('[TEAM] Failed to update app_metadata:', { member_id }, e)
    }
    // La ligne porte déjà le nouveau rôle, pas le compte, dont app_metadata fixe les droits : le dire, plutôt que
    // répondre 200 (un retrait de droits resterait sans effet). La même demande, relancée, aboutit.
    if (!compteAJour) {
      return NextResponse.json({ error: MESSAGE_ROLE_NON_APPLIQUE }, { status: 500 })
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
  if (!ROLES_ADMIN_EQUIPE.has(userRole)) {
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
