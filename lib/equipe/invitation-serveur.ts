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
import { defautsMotDePasseNeuf } from './mot-de-passe-invitation'
import { verifierMotDePasseDuCompte } from './session-invite'

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

/** Motif d'un lien refusé, pour que la page écrive elle-même son message dans la langue de la société. */
export type MotifLienRefuse = 'invalide' | 'deja_utilisee' | 'desactivee' | 'expiree'

export type LectureInvitation =
  | { ok: true; invite: LigneInvitation }
  | { ok: false; status: 404 | 409 | 410; error: string; code: MotifLienRefuse }

/** Réponse à renvoyer telle quelle par la route ; `nouveauCompteId` seulement si un compte a été créé. */
export interface ResultatAcceptation {
  status: number
  corps: Record<string, unknown>
  nouveauCompteId?: string
  /** Compte existant rattaché à l'équipe (acceptation avec connexion seulement), pour le journal de l'équipe. */
  compteRattacheId?: string
  /**
   * Code de l'erreur de Supabase Auth quand le compte n'a pas pu être créé (ex. weak_password : politique du mot de
   * passe du projet) ; jamais dans `corps`. Lu par AJ Signalement (lib/aj-signalement/serveur-acces.ts) ; les routes pro
   * et syndic renvoient `corps` et `status`, inchangés.
   */
  codeAuth?: string
}

const INVALIDE: LectureInvitation = { ok: false, status: 404, error: 'Invitation invalide ou expirée', code: 'invalide' }

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
 * ou ne correspond plus à la ligne (e-mail, jeton, équipe ou rôle modifiés après l'envoi) : le jeton seul, tel
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
  if (invite.accepted_at) return { ok: false, status: 409, error: 'Invitation déjà utilisée', code: 'deja_utilisee' }
  // Invitation désactivée par le gérant (bouton « Désactiver ») : son lien ne rattache plus personne. Avant, il
  // s'acceptait encore, et le compte recevait le rôle et la société dans app_metadata (25/11/2026).
  if ((data as { is_active?: unknown }).is_active === false) {
    return { ok: false, status: 410, error: 'Invitation désactivée. Demandez une nouvelle invitation.', code: 'desactivee' }
  }
  if (invite.created_at && Date.now() - new Date(invite.created_at).getTime() > DUREE_VALIDITE_MS) {
    return { ok: false, status: 410, error: 'Invitation expirée. Demandez une nouvelle invitation.', code: 'expiree' }
  }
  return { ok: true, invite }
}

type Rattachement = { statut: 'rattache'; userId: string } | { statut: 'introuvable' | 'autre_espace' | 'erreur' }

/**
 * Compte Supabase Auth de cette adresse, cherché page par page pour ne pas charger tous les comptes en mémoire.
 * Comparaison sans tenir compte de la casse (Supabase Auth range les adresses en minuscules). « erreur » si la
 * liste n'a pas pu être lue jusqu'au bout : on ne conclut pas alors qu'aucun compte n'existe. Plafond de
 * PAGES_MAX pages (20 000 comptes) : au-delà, « erreur » plutôt qu'une boucle sans fin.
 */
const PAGES_MAX = 200

export async function trouverCompteParEmail(email: string): Promise<{ id: string } | null | 'erreur'> {
  const cherche = email.trim().toLowerCase()
  const parPage = 100
  for (let page = 1; page <= PAGES_MAX; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: parPage })
    if (error) return 'erreur'
    const users = data?.users ?? []
    const trouve = users.find(u => (u.email ?? '').toLowerCase() === cherche)
    if (trouve) return { id: trouve.id }
    if (users.length < parPage) return null // dernière page
  }
  logger.error('[EQUIPE] liste des comptes plus longue que le plafond de recherche', { pages: PAGES_MAX })
  return 'erreur'
}

/** État du compte de l'adresse invitée, lu par la page d'invitation pro pour choisir son formulaire. */
export type EtatCompteInvite = 'aucun' | 'existant' | 'autre_espace' | 'inconnu'

/**
 * « aucun » : l'invité choisira un mot de passe ; « existant » : il tapera celui de son compte, rattaché ensuite ;
 * « autre_espace » : compte d'un autre espace, jamais converti (compteRattachable) ; « inconnu » : lecture en échec.
 */
export async function etatCompteInvite(espace: EspaceEquipe, email: string): Promise<EtatCompteInvite> {
  const compte = await trouverCompteParEmail(email)
  if (compte === 'erreur') return 'inconnu'
  if (!compte) return 'aucun'
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(compte.id)
  if (error || !data?.user) return 'inconnu'
  return compteRattachable(espace, data.user.app_metadata || {}) ? 'existant' : 'autre_espace'
}

/**
 * Compte existant de l'e-mail invité, rattaché à l'équipe s'il le peut (compteRattachable). `compteConnu` : compte
 * déjà trouvé par l'appelant (pas de seconde recherche).
 */
async function rattacherCompteExistant(
  espace: EspaceEquipe,
  email: string,
  metadonnees: Record<string, unknown>,
  compteConnu?: { id: string },
): Promise<Rattachement> {
  const { journal } = ESPACES[espace]

  const existant = compteConnu ?? await trouverCompteParEmail(email)
  if (existant === 'erreur') {
    logger.error(`${journal} Liste des comptes illisible`)
    return { statut: 'erreur' }
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

/** Ligne d'invitation marquée acceptée par ce compte (lien consommé). */
function marquerAcceptee(espace: EspaceEquipe, invite: LigneInvitation, userId: string) {
  return supabaseAdmin
    .from(ESPACES[espace].table)
    .update({ user_id: userId, accepted_at: new Date().toISOString(), invite_token: null })
    .eq('id', invite.id)
}

/**
 * Compte créé pour l'e-mail invité avec ce mot de passe, invitation marquée acceptée. `{ dejaInscrit: true }` si
 * l'adresse a déjà un compte (rien n'est écrit) ; toute autre erreur de Supabase Auth donne la réponse 500.
 */
async function creerCompteInvite(
  espace: EspaceEquipe,
  invite: LigneInvitation,
  password: string,
  metadonnees: Record<string, unknown>,
): Promise<ResultatAcceptation | { dejaInscrit: true }> {
  const { journal } = ESPACES[espace]
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: invite.email,
    password,
    email_confirm: true,
    app_metadata: metadonnees,
    user_metadata: { full_name: invite.full_name },
  })

  if (authError) {
    if (authError.message?.includes('already')) return { dejaInscrit: true }
    logger.error(`${journal} Auth error:`, authError)
    const codeAuth = typeof authError.code === 'string' && authError.code ? authError.code : undefined
    return { status: 500, corps: { error: 'Erreur lors de la création du compte', code: 'erreur' }, ...(codeAuth ? { codeAuth } : {}) }
  }

  const nouveau = authData.user
  if (!nouveau) return { status: 500, corps: { error: 'Erreur lors de la création du compte', code: 'erreur' } }

  const { error: updateError } = await marquerAcceptee(espace, invite, nouveau.id)
  if (updateError) {
    logger.error(`${journal} Update error:`, updateError)
    // Compte créé mais invitation non marquée acceptée : erreur partielle, à vérifier par l'équipe
    return {
      status: 207,
      corps: {
        success: false,
        code: 'non_validee',
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

/** Compte existant de l'e-mail invité rattaché à l'équipe (s'il le peut), puis invitation marquée acceptée. */
async function rattacherEtMarquer(
  espace: EspaceEquipe,
  invite: LigneInvitation,
  metadonnees: Record<string, unknown>,
  compteConnu?: { id: string },
): Promise<ResultatAcceptation> {
  const { journal } = ESPACES[espace]
  const rattachement = await rattacherCompteExistant(espace, invite.email, metadonnees, compteConnu)
  if (rattachement.statut === 'autre_espace') {
    return { status: 409, corps: { error: MESSAGE_COMPTE_AUTRE_ESPACE, code: 'autre_espace' } }
  }
  if (rattachement.statut !== 'rattache') {
    return { status: 500, corps: { error: 'Erreur lors de la liaison du compte', code: 'erreur' } }
  }
  const { error: marquageError } = await marquerAcceptee(espace, invite, rattachement.userId)
  if (marquageError) {
    // Avant le 28/11/2026, cet échec était ignoré : 200 « rattaché » alors que la ligne d'équipe ne portait pas le
    // compte (aucun droit), et une invitation de gérant ne pouvait plus être rejouée (compte déjà marqué GERANT).
    logger.error(`${journal} Update error (compte existant):`, marquageError)
    return {
      status: 207,
      corps: {
        success: false,
        code: 'non_validee',
        message: 'Le compte a été rattaché mais l\'invitation n\'a pas pu être validée. Contactez le support.',
      },
    }
  }
  // Le compte existant garde SON mot de passe : une invitation ne le change jamais.
  return {
    status: 200,
    corps: {
      success: true,
      compte_existant: true,
      message: 'Compte existant rattaché. Connectez-vous avec votre mot de passe habituel : celui saisi ici n\'a pas été enregistré.',
    },
    compteRattacheId: rattachement.userId,
  }
}

/**
 * Accepte une invitation lue par lireInvitationValide : crée le compte de l'e-mail invité avec le mot de
 * passe choisi (le lien n'a été remis qu'à cette boîte mail), ou rattache son compte existant, puis marque
 * l'invitation acceptée. `metadonnees` : app_metadata donné par l'équipe (rôle, équipe).
 * Espaces syndic et AJ Signalement ; l'espace pro passe par accepterInvitationAvecConnexion.
 */
export async function accepterInvitation(
  espace: EspaceEquipe,
  invite: LigneInvitation,
  password: string,
  metadonnees: Record<string, unknown>,
): Promise<ResultatAcceptation> {
  const creation = await creerCompteInvite(espace, invite, password, metadonnees)
  if (!('dejaInscrit' in creation)) return creation
  // Le compte existe déjà : on le rattache s'il le peut
  return rattacherEtMarquer(espace, invite, metadonnees)
}

/**
 * Acceptation d'une invitation pro, comme dans les grands logiciels (28/11/2026) :
 * - adresse sans compte : le mot de passe choisi doit suivre la règle de mot-de-passe-invitation.ts, puis le compte
 *   est créé ;
 * - adresse qui a déjà un compte : un compte d'un autre espace est refusé d'emblée (409, sans essayer le mot de passe :
 *   la réponse ne dit rien de lui) ; sinon le mot de passe tapé doit être CELUI de ce compte (vérifié par une connexion)
 *   avant tout rattachement. Une invitation ne change jamais le mot de passe d'un compte, et le lien seul ne suffit plus
 *   à rattacher un compte existant.
 * La route ouvre ensuite la session de l'invité (session-invite.ts) : il entre directement dans son espace.
 */
export async function accepterInvitationAvecConnexion(
  espace: EspaceEquipe,
  invite: LigneInvitation,
  motDePasse: string,
  metadonnees: Record<string, unknown>,
): Promise<ResultatAcceptation> {
  const { journal } = ESPACES[espace]
  const compte = await trouverCompteParEmail(invite.email)
  if (compte === 'erreur') {
    logger.error(`${journal} Liste des comptes illisible`)
    return { status: 500, corps: { error: 'Erreur lors de la lecture du compte', code: 'erreur' } }
  }

  if (!compte) {
    const defauts = defautsMotDePasseNeuf(motDePasse)
    if (defauts.length > 0) {
      return { status: 400, corps: { error: 'Mot de passe trop faible', code: 'mot_de_passe_faible', defauts } }
    }
    const creation = await creerCompteInvite(espace, invite, motDePasse, metadonnees)
    // Compte apparu entre la lecture et la création : rien n'est rattaché sans la preuve du mot de passe.
    if ('dejaInscrit' in creation) {
      return { status: 409, corps: { error: 'Un compte existe déjà avec cette adresse. Rechargez la page.', code: 'recharger' } }
    }
    return creation
  }

  const { data: lu, error: lectureError } = await supabaseAdmin.auth.admin.getUserById(compte.id)
  if (lectureError || !lu?.user) {
    logger.error(`${journal} Lecture du compte existant impossible:`, lectureError)
    return { status: 500, corps: { error: 'Erreur lors de la lecture du compte', code: 'erreur' } }
  }
  if (!compteRattachable(espace, lu.user.app_metadata || {})) {
    return { status: 409, corps: { error: MESSAGE_COMPTE_AUTRE_ESPACE, code: 'autre_espace' } }
  }

  const verdict = await verifierMotDePasseDuCompte(invite.email, motDePasse)
  if (verdict === 'refuse') {
    return { status: 401, corps: { error: 'Mot de passe incorrect', code: 'mot_de_passe_incorrect' } }
  }
  if (verdict === 'non_confirme') {
    return { status: 403, corps: { error: 'Adresse du compte jamais confirmée', code: 'non_confirme' } }
  }
  if (verdict === 'erreur') {
    return { status: 503, corps: { error: 'Connexion momentanément impossible. Réessayez.', code: 'erreur' } }
  }
  return rattacherEtMarquer(espace, invite, metadonnees, compte)
}
