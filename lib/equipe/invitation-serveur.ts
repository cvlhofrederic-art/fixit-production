// lib/equipe/invitation-serveur.ts
//
// Invitations d'équipe côté serveur, communes aux routes pro BTP (/api/pro/team, /api/pro/invite) et
// syndic (/api/syndic/team, /api/syndic/invite) : envoi du lien par e-mail, lecture d'une invitation
// désignée par un lien signé (lien-invitation.ts), acceptation (compte neuf ou compte existant rattaché).

import { supabaseAdmin } from '@/lib/supabase-server'
import { sendEmail } from '@/lib/email'
import { logger } from '@/lib/logger'
import {
  lireJetonDuLien,
  signatureValide,
  compteRattachable,
  MESSAGE_COMPTE_AUTRE_ESPACE,
  type EspaceEquipe,
} from './lien-invitation'

const DUREE_VALIDITE_MS = 7 * 24 * 60 * 60 * 1000 // 7 jours après la création

const ESPACES = {
  pro: { table: 'pro_team_members', colonneEquipe: 'company_id', journal: '[PRO_INVITE]' },
  syndic: { table: 'syndic_team_members', colonneEquipe: 'cabinet_id', journal: '[INVITE]' },
  // AJ Signalement : une ligne par envoi à un gestionnaire ; l'« équipe » signée est la fiche du gestionnaire.
  aj_signalement: { table: 'signalements_qr_invitations', colonneEquipe: 'gestionnaire_id', journal: '[AJ SIGNALEMENT INVITE]' },
} as const satisfies Record<EspaceEquipe, { table: string; colonneEquipe: string; journal: string }>

/** Ligne d'invitation lue en base ; `equipe_id` reprend company_id (pro) ou cabinet_id (syndic). */
export interface LigneInvitation {
  id: string
  email: string
  full_name: string | null
  role: string
  invite_token: string
  accepted_at: string | null
  created_at: string | null
  equipe_id: string
}

export type LectureInvitation =
  | { ok: true; invite: LigneInvitation }
  | { ok: false; status: 404 | 409 | 410; error: string }

/** Réponse à renvoyer telle quelle par la route ; `nouveauCompteId` seulement si un compte a été créé. */
export interface ResultatAcceptation {
  status: number
  corps: Record<string, unknown>
  nouveauCompteId?: string
}

const INVALIDE: LectureInvitation = { ok: false, status: 404, error: 'Invitation invalide ou expirée' }

/**
 * E-mail affiché sur la page d'invitation : deux premiers caractères, puis le domaine (depuis le dernier @).
 * Moins de deux caractères avant le @ : e-mail inchangé.
 */
export function masquerEmail(email: string | null | undefined): string {
  if (!email) return ''
  const arobase = email.lastIndexOf('@')
  return arobase >= 2 ? `${email.slice(0, 2)}***${email.slice(arobase)}` : email
}

/** Envoie l'e-mail d'invitation ; faux si l'envoi a échoué (déjà journalisé). */
export async function envoyerEmailInvitation(
  to: string,
  modele: { subject: string; html: string },
  tags: Array<{ name: string; value: string }>,
  journal: string,
): Promise<boolean> {
  try {
    const resultat = await sendEmail({ to, subject: modele.subject, html: modele.html, tags })
    if (!resultat.success) logger.warn(`${journal} Email invite failed:`, resultat.error)
    return resultat.success
  } catch (err) {
    logger.warn(`${journal} Email invite error:`, err instanceof Error ? err.message : err)
    return false
  }
}

/**
 * Invitation désignée par un lien signé, encore valable. 404 générique si le lien est mal formé, inconnu
 * ou ne correspond plus à la ligne (e-mail, jeton ou équipe modifiés après l'envoi) : le jeton seul, tel
 * qu'il est enregistré en base, ne suffit pas. 409 si déjà acceptée, 410 si expirée.
 */
export async function lireInvitationValide(espace: EspaceEquipe, token: string): Promise<LectureInvitation> {
  const lien = lireJetonDuLien(token)
  if (!lien) return INVALIDE

  const { table, colonneEquipe } = ESPACES[espace]
  const { data, error } = await supabaseAdmin.from(table).select('*').eq('invite_token', lien.jeton).maybeSingle()
  if (error || !data) return INVALIDE

  const invite: LigneInvitation = { ...data, equipe_id: data[colonneEquipe] }
  if (!(await signatureValide(espace, lien.signature, invite))) return INVALIDE
  if (invite.accepted_at) return { ok: false, status: 409, error: 'Invitation déjà utilisée' }
  if (invite.created_at && Date.now() - new Date(invite.created_at).getTime() > DUREE_VALIDITE_MS) {
    return { ok: false, status: 410, error: 'Invitation expirée. Demandez une nouvelle invitation.' }
  }
  return { ok: true, invite }
}

type Rattachement = { statut: 'rattache'; userId: string } | { statut: 'introuvable' | 'autre_espace' | 'erreur' }

/** Compte existant de l'e-mail invité, rattaché à l'équipe s'il le peut (compteRattachable). */
async function rattacherCompteExistant(
  espace: EspaceEquipe,
  email: string,
  metadonnees: Record<string, unknown>,
): Promise<Rattachement> {
  const { journal } = ESPACES[espace]

  // Recherche paginée, pour ne pas charger tous les comptes en mémoire
  let existant: { id: string } | null = null
  const parPage = 100
  let page = 1
  while (!existant) {
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: parPage })
    if (error || !users || users.length === 0) break
    existant = users.find(u => u.email === email) || null
    if (users.length < parPage) break // dernière page
    page++
  }
  if (!existant) return { statut: 'introuvable' }

  const { data: complet, error: lectureError } = await supabaseAdmin.auth.admin.getUserById(existant.id)
  if (lectureError || !complet?.user) {
    logger.error(`${journal} Lecture du compte existant impossible:`, lectureError)
    return { statut: 'erreur' }
  }
  const appMetadata = complet.user.app_metadata || {}

  // Un compte d'un autre espace (artisan, client, gérant, cabinet, admin…) n'est jamais converti.
  if (!compteRattachable(espace, appMetadata)) return { statut: 'autre_espace' }

  // Rôle et équipe dans app_metadata (server-only)
  const { error: majError } = await supabaseAdmin.auth.admin.updateUserById(existant.id, {
    app_metadata: { ...appMetadata, ...metadonnees },
  })
  if (majError) {
    logger.error(`${journal} Liaison du compte existant impossible:`, majError)
    return { statut: 'erreur' }
  }
  return { statut: 'rattache', userId: existant.id }
}

/**
 * Accepte une invitation lue par lireInvitationValide : crée le compte de l'e-mail invité avec le mot de
 * passe choisi (le lien n'a été remis qu'à cette boîte mail), ou rattache son compte existant, puis marque
 * l'invitation acceptée. `metadonnees` : app_metadata donné par l'équipe (rôle, équipe).
 */
export async function accepterInvitation(
  espace: EspaceEquipe,
  invite: LigneInvitation,
  password: string,
  metadonnees: Record<string, unknown>,
): Promise<ResultatAcceptation> {
  const { table, journal } = ESPACES[espace]
  const marquerAcceptee = (userId: string) => supabaseAdmin
    .from(table)
    .update({ user_id: userId, accepted_at: new Date().toISOString(), invite_token: null })
    .eq('id', invite.id)

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: invite.email,
    password,
    email_confirm: true,
    app_metadata: metadonnees,
    user_metadata: { full_name: invite.full_name },
  })

  if (authError) {
    // Le compte existe déjà : on le rattache s'il le peut
    const rattachement = authError.message?.includes('already')
      ? await rattacherCompteExistant(espace, invite.email, metadonnees)
      : { statut: 'introuvable' as const }
    if (rattachement.statut === 'autre_espace') return { status: 409, corps: { error: MESSAGE_COMPTE_AUTRE_ESPACE } }
    if (rattachement.statut === 'erreur') return { status: 500, corps: { error: 'Erreur lors de la liaison du compte' } }
    if (rattachement.statut === 'rattache') {
      await marquerAcceptee(rattachement.userId)
      return { status: 200, corps: { success: true, message: 'Compte lié avec succès. Vous pouvez maintenant vous connecter.' } }
    }
    logger.error(`${journal} Auth error:`, authError)
    return { status: 500, corps: { error: 'Erreur lors de la création du compte' } }
  }

  const nouveau = authData.user
  if (!nouveau) return { status: 500, corps: { error: 'Erreur lors de la création du compte' } }

  const { error: updateError } = await marquerAcceptee(nouveau.id)
  if (updateError) {
    logger.error(`${journal} Update error:`, updateError)
    // Compte créé mais invitation non marquée acceptée : erreur partielle, à vérifier par l'équipe
    return {
      status: 207,
      corps: {
        success: false,
        message: 'Le compte a été créé mais l\'invitation n\'a pas pu être validée. Contactez le support.',
        email: invite.email,
      },
    }
  }

  return {
    status: 200,
    corps: { success: true, message: 'Compte créé avec succès. Vous pouvez maintenant vous connecter.', email: invite.email },
    nouveauCompteId: nouveau.id,
  }
}
