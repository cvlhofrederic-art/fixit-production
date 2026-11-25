import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import type { User } from '@supabase/supabase-js'
import {
  getAuthUser, isProSocieteRole, isProGerant, resolveCompanyId, societeDunAutreCompte, estTitulaireSociete,
} from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { templateProTeamInvite } from '@/lib/email'
import { logger } from '@/lib/logger'
import { validateBody, proTeamInviteSchema, proPermissionsUpdateSchema } from '@/lib/validation'
import { ROLE_LABELS, isValidProTeamRole } from '@/lib/permissions'
import type { ProTeamRole } from '@/lib/permissions'
import { nouvelleInvitation, sansJetonInvitation } from '@/lib/equipe/lien-invitation'
import { envoyerEmailInvitation } from '@/lib/equipe/invitation-serveur'
import { texteSurUneLigne } from '@/lib/sanitize'
import { normaliserCategorie, LONGUEUR_MAX_CATEGORIE } from '@/lib/equipe/categorie-professionnelle'

// ── Co-gérant (25/11/2026) ───────────────────────────────────────────────────
// Un gérant invité dans la société d'un autre compte (societeDunAutreCompte) gère l'équipe de CETTE société, jamais
// une « société » à son propre nom : sans ligne d'équipe active, resolveCompanyId retombe sur son identifiant, et
// ses invitations seraient parties dans une équipe fantôme que personne ne voit.
const MESSAGE_SOCIETE_NON_RESOLUE =
  "Votre compte n'est rattaché à aucune société active. Demandez au gérant titulaire de vérifier votre accès."
const MESSAGE_GERANT_RESERVE = 'Seul le gérant titulaire de la société peut créer, modifier ou retirer un gérant.'
const MESSAGE_SA_PROPRE_LIGNE = 'Vous ne pouvez pas modifier vos propres droits ni votre propre accès.'

/** Société gérée par ce gérant (titulaire ou co-gérant) ; null si elle ne se résout pas. */
async function societeDuGerant(user: User): Promise<string | null> {
  const companyId = await resolveCompanyId(user, supabaseAdmin)
  if (!companyId) return null
  if (societeDunAutreCompte(user) && companyId === user.id) return null
  return companyId
}

/** Nom de la société pour l'e-mail d'invitation : celui du compte titulaire, ou la fiche de la société pour un co-gérant. */
async function nomDeLaSociete(user: User, companyId: string): Promise<unknown> {
  if (!societeDunAutreCompte(user)) return user.user_metadata?.company_name || user.user_metadata?.full_name
  const { data } = await supabaseAdmin.from('profiles_artisan').select('company_name').eq('user_id', companyId).limit(1)
  return (data as Array<{ company_name?: string }> | null)?.[0]?.company_name
}

/** Colonnes de la liste de l'équipe (sans le jeton d'invitation) ; job_title s'y ajoute quand la colonne existe. */
const COLONNES_EQUIPE =
  'id, email, full_name, phone, role, assigned_chantiers, invite_sent_at, accepted_at, last_login_at, is_active, created_at'

const MESSAGE_CATEGORIE_REFUSEE =
  `Catégorie professionnelle refusée : texte de ${LONGUEUR_MAX_CATEGORIE} caractères au plus, sans caractère spécial.`

// Chaque invitation fait partir un e-mail depuis l'adresse d'envoi de la plateforme : plafond par compte et par
// 24 heures, en plus de la limite par minute (par adresse Internet). L'écran « Comptes utilisateurs » annonce
// 20 comptes par société : 40 laisse inviter toute une équipe, puis inviter de nouveau chacun, dans la même journée.
const INVITATIONS_MAX_PAR_JOUR = 40
const JOUR_MS = 24 * 60 * 60 * 1000
/** Longueur maximale du nom de société repris dans l'e-mail (celle du champ de la fiche, lib/validation.ts). */
const LONGUEUR_MAX_NOM_SOCIETE = 200

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
  // Titulaire seulement : un co-gérant sans ligne active (companyId retombé sur lui) n'a pas de société à son nom.
  if (estTitulaireSociete(user) && user.email && companyId === user.id) {
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

  const lireEquipe = (colonnes: string) => supabaseAdmin
    .from('pro_team_members')
    .select(colonnes)
    .eq('company_id', companyId)
    .order('created_at', { ascending: true })
  let { data, error } = await lireEquipe(`${COLONNES_EQUIPE}, job_title`)
  // Colonne job_title absente (code déployé avant la migration 20261125) : la liste reste lisible, sans catégorie,
  // plutôt qu'un écran vide pour toutes les sociétés.
  if (error?.code === '42703') {
    logger.warn('[PRO_TEAM] GET : colonne job_title absente, liste lue sans catégorie (migration 20261125 à appliquer)')
    ;({ data, error } = await lireEquipe(COLONNES_EQUIPE))
  }

  if (error) {
    logger.error('[PRO_TEAM] GET error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }

  // Fetch permission overrides for each member
  const membres = (data ?? []) as unknown as Array<Record<string, unknown> & { id: string }>
  const memberIds = membres.map(m => m.id)
  let overridesMap: Record<string, { module_id: string; access_level: string }[]> = {}

  if (memberIds.length > 0) {
    // Bornées à la société : une dérogation d'une autre company_id n'a pas été posée par le serveur (migration
    // 20261125b) et ne doit ni s'afficher ni être réécrite comme légitime par « Enregistrer les permissions ».
    const { data: overrides } = await supabaseAdmin
      .from('pro_role_permissions')
      .select('member_id, module_id, access_level')
      .in('member_id', memberIds)
      .eq('company_id', companyId)

    if (overrides) {
      overridesMap = overrides.reduce((acc, ov) => {
        if (!acc[ov.member_id]) acc[ov.member_id] = []
        acc[ov.member_id].push({ module_id: ov.module_id, access_level: ov.access_level })
        return acc
      }, {} as Record<string, { module_id: string; access_level: string }[]>)
    }
  }

  const members = membres.map(m => ({
    ...m,
    permission_overrides: overridesMap[m.id] || [],
  }))

  const response = NextResponse.json({ members })
  // Jamais resservie depuis le cache du navigateur : avec stale-while-revalidate, Chromium rendait l'ancienne liste
  // juste après une invitation ou une suppression (relecture adverse du 25/11/2026).
  response.headers.set('Cache-Control', 'private, no-store')
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

  const { email, full_name, phone, memberRole, job_title, assigned_chantiers, permissionOverrides } = validation.data

  if (!isValidProTeamRole(memberRole)) {
    return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 })
  }
  const categorie = normaliserCategorie(job_title ?? null)
  if (categorie === undefined) {
    return NextResponse.json({ error: MESSAGE_CATEGORIE_REFUSEE }, { status: 400 })
  }

  if (memberRole === 'GERANT' && !estTitulaireSociete(user)) {
    return NextResponse.json({ error: MESSAGE_GERANT_RESERVE }, { status: 403 })
  }
  // Titulaire : la société, c'est lui ; co-gérant : celle de sa ligne d'équipe active.
  const companyId = await societeDuGerant(user)
  if (!companyId) return NextResponse.json({ error: MESSAGE_SOCIETE_NON_RESOLUE }, { status: 409 })
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

  // Compté après les refus ci-dessus (une demande refusée ne consomme rien) et avant toute écriture.
  if (!(await checkRateLimit(`pro_team_invite_jour_${user.id}`, INVITATIONS_MAX_PAR_JOUR, JOUR_MS))) {
    logger.warn('[PRO_TEAM] plafond d\'invitations des 24 heures atteint', { compte: user.id })
    return NextResponse.json(
      { error: `Limite de ${INVITATIONS_MAX_PAR_JOUR} invitations par 24 heures atteinte. Réessayez demain.` },
      { status: 429 },
    )
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
  if (categorie !== null) insertData.job_title = categorie

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
  // Le nom de la société est renseigné par le compte lui-même : il est ramené à une ligne de longueur bornée avant
  // d'entrer dans l'objet et le corps du message (le gabarit échappe ensuite chaque valeur dans le HTML).
  const companyName = texteSurUneLigne(await nomDeLaSociete(user, companyId), LONGUEUR_MAX_NOM_SOCIETE) || 'Entreprise'
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
    { name: 'company_id', value: companyId },
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
  const { member_id, role, is_active, assigned_chantiers, permissions, job_title } = body

  if (!member_id) {
    return NextResponse.json({ error: 'member_id requis' }, { status: 400 })
  }

  // Dérogations de droits (bouton « Modifier » de Comptes utilisateurs) : validées avant toute lecture ; undefined =
  // non envoyées.
  let derogations: Array<{ module_id: string; access_level: string }> | undefined
  if (permissions !== undefined) {
    const lecture = proPermissionsUpdateSchema.shape.permissions.safeParse(permissions)
    if (!lecture.success) return NextResponse.json({ error: 'Permissions invalides' }, { status: 400 })
    derogations = lecture.data
  }

  const companyId = await societeDuGerant(user)
  if (!companyId) return NextResponse.json({ error: MESSAGE_SOCIETE_NON_RESOLUE }, { status: 409 })

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

  const touchAuxDroits = (role !== undefined && role !== existing.role) || is_active !== undefined || derogations !== undefined
  // Un gérant ne se retire ni ne se restreint lui-même (la catégorie, simple titre, reste modifiable).
  if (existing.user_id === user.id && touchAuxDroits) {
    return NextResponse.json({ error: MESSAGE_SA_PROPRE_LIGNE }, { status: 403 })
  }
  // Les lignes de gérant (titulaire ou co-gérant) et toute promotion au rang de gérant sont réservées au titulaire.
  if (!estTitulaireSociete(user) && (existing.role === 'GERANT' || role === 'GERANT')) {
    return NextResponse.json({ error: MESSAGE_GERANT_RESERVE }, { status: 403 })
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
  // Catégorie professionnelle : simple titre affiché, sans effet sur les droits ni sur le compte du membre. Modifiable
  // aussi pendant une invitation en attente (le lien signé ne porte que le rôle).
  if (job_title !== undefined) {
    const categorie = normaliserCategorie(job_title)
    if (categorie === undefined) return NextResponse.json({ error: MESSAGE_CATEGORIE_REFUSEE }, { status: 400 })
    updates.job_title = categorie
  }
  if (Object.keys(updates).length === 0 && derogations === undefined) {
    return NextResponse.json({ error: 'Aucune modification' }, { status: 400 })
  }

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

  let membre: Record<string, unknown> | null = null
  let roleNonApplique = false
  if (Object.keys(updates).length > 0) {
    const { data, error } = await supabaseAdmin
      .from('pro_team_members')
      .update(updates)
      .eq('id', member_id)
      .select()
      .single()

    if (error) {
      logger.error('[PRO_TEAM] PATCH : mise à jour du membre impossible', { member_id }, error)
      return NextResponse.json({ error: 'Erreur mise à jour' }, { status: 500 })
    }
    membre = data

    // Rôle modifié d'un sous-compte vérifié ci-dessus : app_metadata (server-only) reçoit le seul pro_team_role ;
    // company_id reste le sien, cette société : le PATCH ne rattache jamais un compte à une société. Le statut
    // (is_active) n'écrit plus app_metadata : pour un membre de la société, y reposer company_id ne changeait rien ;
    // pour le compte d'un autre, c'était la faille (R36).
    // ⚠️ SÉCURITÉ : pro_team_role DOIT vivre dans app_metadata (non forgeable côté
    // client) car isProGerant() s'appuie dessus pour l'authz. Ne JAMAIS l'écrire dans
    // user_metadata (modifiable via supabase.auth.updateUser).
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
    const { error: erreurJournal } = await supabaseAdmin.from('pro_team_audit_log').insert({
      company_id: companyId,
      actor_id: user.id,
      action: actionDuJournal(updates),
      target_member_id: member_id,
      details: updates,
    })
    if (erreurJournal) logger.warn('[PRO_TEAM] PATCH : journal de l’équipe non écrit', { member_id, error: erreurJournal.message })
  }

  // Dérogations de droits : enregistrées qu'une autre colonne change ou non. Jusqu'au 25/11/2026 elles n'étaient lues
  // que dans le bloc précédent : « Enregistrer les permissions », qui n'envoie qu'elles, recevait 400 « Aucune
  // modification » et rien n'était enregistré.
  if (derogations !== undefined) {
    if (!(await remplacerDerogations(companyId, member_id, derogations))) {
      return NextResponse.json({ error: 'Erreur mise à jour des permissions' }, { status: 500 })
    }
    await supabaseAdmin.from('pro_team_audit_log').insert({
      company_id: companyId,
      actor_id: user.id,
      action: 'update_permissions',
      target_member_id: member_id,
      details: { permissions: derogations },
    })
  }

  // La ligne porte déjà le nouveau rôle (journalisé), pas le compte, dont app_metadata fixe les droits : le dire,
  // plutôt que répondre 200 (un retrait de droits resterait sans effet). La même demande, relancée, aboutit.
  if (roleNonApplique) {
    return NextResponse.json({ error: "Le rôle n'a pas pu être appliqué au compte du membre. Réessayez." }, { status: 500 })
  }

  return NextResponse.json({ member: membre ? sansJetonInvitation(membre) : null })
}

/** Action inscrite au journal de l'équipe pour une modification de la ligne d'un membre. */
function actionDuJournal(updates: Record<string, unknown>): string {
  if (updates.is_active === false) return 'deactivate'
  if (updates.is_active === true) return 'reactivate'
  if (updates.role !== undefined) return 'update_role'
  return 'update_member'
}

type Derogation = { module_id: string; access_level: string }

/**
 * Remplace les dérogations de droits d'un membre (déjà vérifié comme membre de la société) par celles reçues ; une
 * même ligne de module envoyée deux fois ne garde que la dernière (contrainte unique member_id, module_id). Rend false
 * si la base refuse une écriture. Suppression puis insertion ne sont pas atomiques : si l'insertion échoue, les
 * dérogations lues avant sont remises, pour qu'une panne ne rende pas au salarié les droits par défaut de son rôle
 * (plus larges que ce que le gérant avait réglé).
 */
async function remplacerDerogations(companyId: string | null, memberId: string, derogations: Derogation[]): Promise<boolean> {
  const table = () => supabaseAdmin.from('pro_role_permissions')
  const versLignes = (liste: Derogation[]) =>
    liste.map(({ module_id, access_level }) => ({ company_id: companyId, member_id: memberId, module_id, access_level }))
  const echec = (message: string, erreur: unknown) => {
    logger.error(`[PRO_TEAM] PATCH : ${message}`, { member_id: memberId }, erreur)
    return false
  }

  const { data: anciennes, error: lecture } = await table().select('module_id, access_level').eq('member_id', memberId)
    .eq('company_id', companyId)
  if (lecture) return echec('lecture des dérogations impossible', lecture)
  const { error: suppression } = await table().delete().eq('member_id', memberId)
  if (suppression) return echec('suppression des dérogations impossible', suppression)

  const nouvelles = [...new Map(derogations.map((d) => [d.module_id, d.access_level]))]
    .map(([module_id, access_level]) => ({ module_id, access_level }))
  if (nouvelles.length === 0) return true
  const { error: insertion } = await table().insert(versLignes(nouvelles))
  if (!insertion) return true

  const precedentes = (anciennes ?? []) as Derogation[]
  if (precedentes.length > 0) {
    const { error: remise } = await table().insert(versLignes(precedentes))
    if (remise) logger.error('[PRO_TEAM] PATCH : dérogations précédentes non remises', { member_id: memberId }, remise)
  }
  return echec('enregistrement des dérogations impossible', insertion)
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

  const companyId = await societeDuGerant(user)
  if (!companyId) return NextResponse.json({ error: MESSAGE_SOCIETE_NON_RESOLUE }, { status: 409 })

  const { data: target } = await supabaseAdmin
    .from('pro_team_members')
    .select('role, user_id')
    .eq('id', memberId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!target) {
    return NextResponse.json({ error: 'Membre introuvable' }, { status: 404 })
  }
  // Le titulaire (sa ligne porte l'identifiant de la société) ne se retire jamais.
  if (target.role === 'GERANT' && target.user_id === companyId) {
    return NextResponse.json({ error: 'Impossible de supprimer le gérant' }, { status: 403 })
  }
  // Un co-gérant (ou son invitation) ne se retire que par le titulaire ; un co-gérant ne se retire donc pas lui-même,
  // et le titulaire est arrêté juste au-dessus (seuls des gérants appellent cette route). Ligne retirée, son compte garde
  // company_id dans app_metadata mais n'a plus de ligne active : societeDuGerant et lirePerimetreBtp ne lui donnent
  // alors plus rien.
  if (target.role === 'GERANT' && !estTitulaireSociete(user)) {
    return NextResponse.json({ error: MESSAGE_GERANT_RESERVE }, { status: 403 })
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
