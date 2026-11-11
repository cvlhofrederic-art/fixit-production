// ── AJ Signalement, côté serveur : accès de chaque gestionnaire à l'espace de SON cabinet (PR 2, lot 3) ──────────
//
// Demandes de Hugo du 10 et du 11/11/2026 (SPEC § 2.3.2, § 6 ; plan PR 2 § 2.2-2.3) : chaque gestionnaire a un compte
// VitFix professionnel, ouvert par une invitation signée envoyée par e-mail (lien vitfix.io/<identifiant>/invitation/
// #<jeton>, jeton après le « # »). Le rôle serveur gestionnaire_signalement et le repère de routage
// (app_metadata.aj_signalement_cabinet, aucun droit) sont fixés ICI, jamais lus dans la ligne d'envoi ni dans le corps.
// Un compte existant n'est jamais converti : seul un compte qui porte déjà le rôle des gestionnaires est rattaché
// (compteRattachable de lib/equipe) ; tout autre compte reçoit un refus neutre (409 compte_autre_espace), l'envoi est
// refusé et le super admin prévenu sans nom ni adresse. La liaison compte ↔ fiche est faite par le trigger de la
// 20261112 ; elle est RELUE après coup (lib/equipe ignore l'erreur de marquerAcceptee d'un compte rattaché) : s'il
// manque quoi que ce soit, 207 liaison_incomplete.
//
// Règle de sûreté (fusion avant les migrations) : la fiche est relue avec user_id (20261112) AVANT tout effet ; colonne
// absente → 503 base_absente, journalisé une fois ; sans la 20261111, aucun envoi n'existe (lib/equipe : 404). L'envoi
// passe par signalements_qr_envoyer_acces (20261112) : fonction absente → 503. Aucune donnée personnelle au journal
// serveur (identifiants et codes seulement).

import type { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import { corpsVideQrSchema, validateBody } from '@/lib/validation'
import { accepterInvitation, lireInvitationValide, type LigneInvitation } from '@/lib/equipe/invitation-serveur'
import { nouvelleInvitation } from '@/lib/equipe/lien-invitation'
import { CHEMIN_ESPACE_QR } from '@/lib/aj-signalement/acces-espace'
import { urlInvitationAccesQr } from '@/lib/aj-signalement/chemin-cabinet'
import {
  ALERTE_ADRESSE_CONTESTEE_QR, ALERTE_LIAISON_INCOMPLETE_QR, ALERTE_REFUS_AUTRE_ESPACE_QR, envoyerAccesGestionnaireQr,
  envoyerAlerteAdministrateurQr,
} from '@/lib/aj-signalement/email'
import { emailCanoniqueQr, nomCourtQr } from '@/lib/aj-signalement/gestionnaires'
import { CLE_REPERE_CABINET_QR, ROLE_GESTIONNAIRE_QR } from '@/lib/aj-signalement/types'
import {
  TABLE_GESTIONNAIRES_QR, TABLE_INVITATIONS_QR, codeDepuisErreurSqlQr, journaliserQr, journaliserRepliAccesQr, lireCabinetQr,
  reponseErreur, reponseErreurSqlQr, structureAbsenteQr, type ErreurBase,
} from '@/lib/aj-signalement/serveur'
import { COLONNES_FICHE_QR, lienDuCabinetQr, origineLiensQr, type LigneFicheQr } from '@/lib/aj-signalement/serveur-gestion'

const CONTEXTE = '[AJ SIGNALEMENT]'

/** Échec d'une opération : code public et statut HTTP (la route répond { error: code }). */
export interface EchecAccesQr { ok: false; code: string; status: number }

const echec = (code: string, status: number): EchecAccesQr => ({ ok: false, code, status })

/**
 * Erreur de la base sur une opération d'accès : structure absente (migration 20261111 ou 20261112 non appliquée) →
 * 503 base_absente, journalisé une fois par opération ; sinon la traduction commune (codeDepuisErreurSqlQr), journalisée
 * avec son seul code si elle est un 5xx.
 */
export function echecBaseAccesQr(erreur: ErreurBase, operation: string, ids: Record<string, string> = {}): EchecAccesQr {
  if (structureAbsenteQr(erreur)) {
    journaliserRepliAccesQr(operation, erreur)
    return echec('base_absente', 503)
  }
  const { code, status } = codeDepuisErreurSqlQr(erreur)
  if (status >= 500) logger.error(`${CONTEXTE} ${operation} refusée par la base`, { code: erreur.code, ...ids })
  return echec(code, status)
}

/** Même règle, en réponse de route. */
export function reponseBaseAccesQr(erreur: ErreurBase, operation: string, ids: Record<string, string> = {}): NextResponse {
  if (structureAbsenteQr(erreur)) {
    journaliserRepliAccesQr(operation, erreur)
    return reponseErreur('base_absente', 503)
  }
  return reponseErreurSqlQr(erreur, operation, ids)
}

/** Adresses de l'administrateur (ADMIN_EMAIL, ADMIN_EMAIL_2) : jamais un compte de gestionnaire (même règle qu'en PR 1). */
const adressesReserveesQr = (env: Record<string, string | undefined> = process.env): string[] =>
  [env.ADMIN_EMAIL, env.ADMIN_EMAIL_2].map(emailCanoniqueQr).filter((a): a is string => a !== null)

/** Lien vers la page profil d'une fiche dans l'espace du super admin (alertes, sans nom ni adresse). */
const lienFicheQr = (gestionnaireId: string): string => `${origineLiensQr()}${CHEMIN_ESPACE_QR}#gestionnaire/${gestionnaireId}`

/**
 * Alerte au super admin (ADMIN_EMAIL, ADMIN_EMAIL_2) : texte fixe et lien vers la page profil de la fiche, jamais un nom
 * ni une adresse. Un envoi impossible est journalisé (identifiant de la fiche seulement), jamais levé.
 */
export async function alerterAdministrateurQr(alerte: { objet: string; texte: string }, gestionnaireId: string, sujet: string): Promise<void> {
  const bilan = await envoyerAlerteAdministrateurQr({ ...alerte, lien: lienFicheQr(gestionnaireId) })
  if (bilan.total === 0 || bilan.refuses > 0) {
    logger.warn(`${CONTEXTE} alerte « ${sujet} » non envoyée au super admin`, { gestionnaire: gestionnaireId, refuses: bilan.refuses, total: bilan.total })
  }
}

// ── Envoi d'un accès (P2-R1, P2-R1b) ─────────────────────────────────────────

export type ResultatEnvoiAccesQr = { ok: true; emailEnvoye: boolean } | EchecAccesQr

/**
 * Ouvre l'accès d'une fiche (super admin) : fiche active à adresse, hors adresses de l'administrateur (409
 * adresse_reservee), non contestée (409 adresse_contestee) ; signature du lien AVANT toute écriture ; puis
 * signalements_qr_envoyer_acces (fiche verrouillée et relue : a_reverifier, adresse_contestee, deja_ouvert ; envois
 * d'accès en attente invalidés ; nouvel envoi inséré) ; puis l'e-mail, invite_sent_at et le journal
 * gestionnaire.acces_envoye, seulement si l'e-mail est parti. L'adresse n'a pas à être confirmée (l'acceptation prouve
 * la boîte, point 7.4). Le lien n'est jamais rendu.
 */
export async function envoyerAccesFicheQr(fiche: LigneFicheQr, acteurId: string): Promise<ResultatEnvoiAccesQr> {
  if (fiche.actif !== true || !fiche.email || fiche.pseudonymise_le) return echec('a_reverifier', 409)
  if (adressesReserveesQr().includes(fiche.email)) return echec('adresse_reservee', 409)
  if (fiche.adresse_contestee_le) return echec('adresse_contestee', 409)
  const cabinet = await lireCabinetQr({ id: fiche.cabinet_id })
  if (!cabinet.ok) return echecBaseAccesQr(cabinet.erreur, 'envoi d’un accès : cabinet', { gestionnaire: fiche.id })
  if (!cabinet.cabinet?.identifiant) return echec('a_reverifier', 409)

  // Signature d'abord (échoue sans clé, avant toute écriture), puis l'envoi en une transaction.
  const invitation = await nouvelleInvitation('aj_signalement', fiche.email, fiche.id)
  const { data, error } = await supabaseAdmin.rpc('signalements_qr_envoyer_acces', {
    p_gestionnaire: fiche.id,
    p_invitation: { id: invitation.id, invite_token: invitation.invite_token, email: fiche.email },
    p_acteur: acteurId,
  })
  if (error) return echecBaseAccesQr(error, 'envoi d’un accès', { gestionnaire: fiche.id })
  if (data !== true) return echec('a_reverifier', 409)

  const parti = await envoyerAccesGestionnaireQr({
    email: fiche.email, nomCourt: nomCourtQr(fiche.nom), cabinet: cabinet.cabinet.nom ?? '',
    lien: urlInvitationAccesQr(cabinet.cabinet.identifiant, invitation.jetonLien, origineLiensQr()),
  })
  if (!parti) {
    logger.warn(`${CONTEXTE} e-mail d’accès non envoyé`, { gestionnaire: fiche.id })
    return { ok: true, emailEnvoye: false }
  }
  const date = await supabaseAdmin.from(TABLE_INVITATIONS_QR).update({ invite_sent_at: new Date().toISOString() }).eq('id', invitation.id)
  if (date.error) logger.warn(`${CONTEXTE} date d’envoi d’un accès non enregistrée`, { code: date.error.code, gestionnaire: fiche.id })
  await journaliserQr({ action: 'gestionnaire.acces_envoye', cabinetId: fiche.cabinet_id, acteurId, gestionnaireId: fiche.id })
  return { ok: true, emailEnvoye: true }
}

// ── Relecture d'un lien d'accès (P2-R2, P2-R3, P2-R3b) ───────────────────────

/** Fiche relue pour un lien d'accès : colonnes de la PR 1 et le compte relié (user_id, migration 20261112). */
const COLONNES_FICHE_LIEN_ACCES_QR = `${COLONNES_FICHE_QR}, user_id`

export interface LigneFicheLienAccesQr extends LigneFicheQr { user_id: string | null }

export interface LienAccesQr {
  ok: true
  envoiId: string
  invite: LigneInvitation
  fiche: LigneFicheLienAccesQr
  cabinet: { id: string; nom: string; identifiant: string }
}

export type RelectureLienAccesQr = LienAccesQr | EchecAccesQr

const INTROUVABLE: EchecAccesQr = echec('introuvable', 404)
const chaine = (v: unknown): string => (typeof v === 'string' ? v : '')

/**
 * Relecture d'un lien d'accès, SANS effet : signature (lib/equipe), envoi d'objet « acces » sans refus, fiche active,
 * non pseudonymisée, non contestée, à l'adresse de l'envoi, et cabinet de la fiche = cabinet du chemin. Tout autre cas :
 * le même 404 générique. Expiré 410 et déjà utilisé 409 (deja_ouvert) seulement sous le chemin du cabinet de la fiche ;
 * fiche déjà reliée à un compte : 409 deja_ouvert (« Mot de passe oublié »). Colonne user_id absente → 503.
 */
export async function relireLienAccesQr(token: string, identifiantCabinet: string): Promise<RelectureLienAccesQr> {
  const lecture = await lireInvitationValide('aj_signalement', token)
  if (!lecture.ok) {
    if (lecture.status !== 409 && lecture.status !== 410) return INTROUVABLE
    if (!(await lienDuCabinetQr(token, identifiantCabinet, 'acces'))) return INTROUVABLE
    return lecture.status === 409 ? echec('deja_ouvert', 409) : echec('expire', 410)
  }
  const envoi = lecture.invite as LigneInvitation & { objet?: unknown; refus?: unknown }
  if (envoi.objet !== 'acces' || envoi.refus) return INTROUVABLE
  const lue = await supabaseAdmin.from(TABLE_GESTIONNAIRES_QR).select(COLONNES_FICHE_LIEN_ACCES_QR).eq('id', envoi.equipe_id).maybeSingle()
  if (lue.error) return echecBaseAccesQr(lue.error, 'fiche d’un lien d’accès', { envoi: envoi.id })
  const f = (lue.data as LigneFicheLienAccesQr | null) ?? null
  if (!f || f.actif !== true || f.pseudonymise_le || f.adresse_contestee_le || !f.email || f.email !== envoi.email) return INTROUVABLE
  const cabinet = await lireCabinetQr({ id: f.cabinet_id })
  if (!cabinet.ok) return echecBaseAccesQr(cabinet.erreur, 'cabinet d’un lien d’accès', { gestionnaire: f.id })
  if (!cabinet.cabinet || cabinet.cabinet.identifiant !== identifiantCabinet) return INTROUVABLE
  if (f.user_id) return echec('deja_ouvert', 409)
  return {
    ok: true, envoiId: envoi.id, invite: lecture.invite, fiche: f,
    cabinet: { id: cabinet.cabinet.id, nom: chaine(cabinet.cabinet.nom), identifiant: chaine(cabinet.cabinet.identifiant) },
  }
}

// ── Acceptation (P2-R3) ──────────────────────────────────────────────────────

export interface ReponseAccesQr { status: number; corps: Record<string, unknown> }

/** app_metadata posé à l'acceptation : fixé par le code (rôle + repère de routage, aucun droit par lui-même). */
export const metadonneesAccesQr = (identifiantCabinet: string): Record<string, unknown> => ({
  role: ROLE_GESTIONNAIRE_QR,
  [CLE_REPERE_CABINET_QR]: identifiantCabinet,
})

/** Refus neutre : l'adresse est celle d'un compte d'un autre espace (jamais converti). Le lien ne sert plus. */
async function refuserAutreEspaceQr(lien: LienAccesQr): Promise<ReponseAccesQr> {
  const { error } = await supabaseAdmin.from(TABLE_INVITATIONS_QR).update({ refus: 'compte_autre_espace', invite_token: null })
    .eq('id', lien.envoiId).is('accepted_at', null)
  if (error) logger.warn(`${CONTEXTE} refus d’un accès non enregistré sur l’envoi`, { code: error.code, gestionnaire: lien.fiche.id })
  await journaliserQr({
    action: 'gestionnaire.refus_autre_espace', cabinetId: lien.fiche.cabinet_id, profil: 'gestionnaire',
    acteurGestionnaireId: lien.fiche.id, gestionnaireId: lien.fiche.id,
  })
  await alerterAdministrateurQr(ALERTE_REFUS_AUTRE_ESPACE_QR, lien.fiche.id, 'accès refusé (autre espace)')
  return { status: 409, corps: { error: 'compte_autre_espace' } }
}

/** Compte créé ou rattaché, mais la liaison à la fiche manque : 207, journal serveur (identifiants), alerte. */
async function liaisonIncompleteQr(lien: LienAccesQr, raison: string): Promise<ReponseAccesQr> {
  logger.error(`${CONTEXTE} accès accepté mais compte non relié à la fiche`, { gestionnaire: lien.fiche.id, envoi: lien.envoiId, raison })
  await alerterAdministrateurQr(ALERTE_LIAISON_INCOMPLETE_QR, lien.fiche.id, 'liaison incomplète')
  return { status: 207, corps: { error: 'liaison_incomplete' } }
}

/**
 * Contrôle après coup (sans toucher lib/equipe) : l'envoi est accepté avec un compte, la fiche est reliée à CE compte
 * et son accès est daté. `compteCree` : le compte que createUser vient de créer (doit être celui de l'envoi). Rend le
 * compte relié.
 */
async function liaisonFaiteQr(lien: LienAccesQr, compteCree: string | undefined): Promise<{ ok: true; userId: string } | { ok: false; raison: string }> {
  const [envoi, fiche] = await Promise.all([
    supabaseAdmin.from(TABLE_INVITATIONS_QR).select('user_id, accepted_at').eq('id', lien.envoiId).maybeSingle(),
    supabaseAdmin.from(TABLE_GESTIONNAIRES_QR).select('user_id, acces_ouvert_le').eq('id', lien.fiche.id).maybeSingle(),
  ])
  if (envoi.error || fiche.error) return { ok: false, raison: `relecture impossible (${envoi.error?.code ?? fiche.error?.code ?? ''})` }
  const e = envoi.data as { user_id?: unknown; accepted_at?: unknown } | null
  const f = fiche.data as { user_id?: unknown; acces_ouvert_le?: unknown } | null
  if (!e?.accepted_at || typeof e.user_id !== 'string') return { ok: false, raison: 'envoi non marqué' }
  if (compteCree && e.user_id !== compteCree) return { ok: false, raison: 'envoi relié à un autre compte' }
  if (f?.user_id !== e.user_id || !f?.acces_ouvert_le) return { ok: false, raison: 'fiche non reliée' }
  return { ok: true, userId: e.user_id }
}

/**
 * Compte EXISTANT rattaché (il porte déjà le rôle des gestionnaires ; le lien, remis à sa seule boîte, la prouve comme
 * « Mot de passe oublié ») et que le trigger vient de relier à cette fiche active : le mot de passe choisi sur la page
 * devient le sien, et sa connexion est débloquée (relecture 5 du lot 6 ; sinon « Accès ouvert. Connectez-vous. » serait
 * faux). Appelé APRÈS la liaison : jamais sur un compte que la base a refusé de relier. Faux : refusé par Supabase Auth
 * (politique du mot de passe, panne) — le compte garde son mot de passe ; journal serveur sans adresse ni mot de passe.
 */
async function appliquerMotDePasseQr(userId: string, password: string, lien: LienAccesQr): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password, ban_duration: 'none' })
    if (!error) return true
    logger.error(`${CONTEXTE} mot de passe d’un compte rattaché non appliqué`, { gestionnaire: lien.fiche.id, code: error.code ?? null, statut: error.status ?? null })
  } catch (e: unknown) {
    logger.error(`${CONTEXTE} mot de passe d’un compte rattaché non appliqué`, { gestionnaire: lien.fiche.id, message: e instanceof Error ? e.name : 'inconnue' })
  }
  return false
}

/**
 * Acceptation d'un lien relu par relireLienAccesQr : accepterInvitation (lib/equipe) avec le rôle et le repère fixés
 * ici — compte neuf (adresse confirmée, la boîte est prouvée par le lien) ou compte qui porte déjà le rôle (rattaché, qui
 * reçoit le mot de passe choisi : appliquerMotDePasseQr) ; tout autre compte : refus neutre 409. Mot de passe refusé
 * par la politique de Supabase Auth (weak_password) : 422 invalide, rien n'est créé et le lien reste valable (l'écran dit
 * d'en choisir un autre). Puis contrôle après coup : 200 { acces: 'ouvert' } (`compte: 'existant'` si le mot de passe
 * d'un compte rattaché n'a pas pu être appliqué) ou 207 liaison_incomplete.
 * Aucune session n'est ouverte ici : le gestionnaire se connecte ensuite sur la page de connexion de son cabinet.
 */
export async function accepterAccesQr(lien: LienAccesQr, password: string): Promise<ReponseAccesQr> {
  const resultat = await accepterInvitation('aj_signalement', lien.invite, password, metadonneesAccesQr(lien.cabinet.identifiant))
  if (resultat.status === 409) return refuserAutreEspaceQr(lien)
  if (resultat.status === 207) return liaisonIncompleteQr(lien, 'envoi non marqué (compte créé)')
  // Relecture 4 du lot 6 : la politique du projet (longueur, caractères, mot de passe connu) n'est pas celle de
  // motDePasseConforme ; « le service ne répond pas » ferait réessayer le même mot de passe sans fin.
  if (resultat.codeAuth === 'weak_password') return { status: 422, corps: { error: 'invalide' } }
  if (resultat.status !== 200) {
    logger.error(`${CONTEXTE} acceptation d’un accès impossible`, { gestionnaire: lien.fiche.id, statut: resultat.status })
    return { status: 500, corps: { error: 'serveur' } }
  }
  const controle = await liaisonFaiteQr(lien, resultat.nouveauCompteId)
  if (!controle.ok) return liaisonIncompleteQr(lien, controle.raison)
  if (!resultat.nouveauCompteId && !(await appliquerMotDePasseQr(controle.userId, password, lien))) {
    return { status: 200, corps: { acces: 'ouvert', compte: 'existant' } }
  }
  return { status: 200, corps: { acces: 'ouvert' } }
}

// ── « Ce n'est pas moi » (P2-R3b) ────────────────────────────────────────────

/**
 * Contestation depuis un lien d'accès relu : signalements_qr_contester_adresse (corps élargi de la 20261112 : envoi
 * d'accès admis, fiche sans compte relié) fige la fiche et rend tous ses liens caducs ; le super admin est prévenu sans
 * nom ni adresse (l'échec de l'alerte n'annule pas la contestation). Refusée en SQL (course) : le même 404.
 */
export async function contesterLienAccesQr(lien: LienAccesQr): Promise<ReponseAccesQr> {
  const { data, error } = await supabaseAdmin.rpc('signalements_qr_contester_adresse', { p_invitation: lien.envoiId })
  if (error) {
    const e = echecBaseAccesQr(error, 'contestation d’un accès', { gestionnaire: lien.fiche.id })
    return { status: e.status, corps: { error: e.code } }
  }
  if (data !== true) return { status: 404, corps: { error: 'introuvable' } }
  await alerterAdministrateurQr(ALERTE_ADRESSE_CONTESTEE_QR, lien.fiche.id, 'adresse contestée (accès)')
  return { status: 200, corps: { contestee: true } }
}

// ── Limite par lien ──────────────────────────────────────────────────────────

/** Empreinte SHA-256 du jeton d'un lien (clé de limite par lien) : le jeton n'est jamais gardé en clair. */
export async function empreinteJetonQr(token: string): Promise<string> {
  const octets = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))
  return Array.from(octets, (o) => o.toString(16).padStart(2, '0')).join('')
}

// ── Corps vide des routes d'action du super admin (P2-R1, P2-R6) ─────────────

/** Corps facultatif d'une action sans paramètre : absent, ou un objet vide (toute clé : 400, détail Zod). */
export async function lireCorpsVideQr(request: NextRequest): Promise<{ ok: true } | { ok: false; details: string }> {
  const texte = await request.text()
  if (texte.trim() === '') return { ok: true }
  let lu: unknown
  try {
    lu = JSON.parse(texte)
  } catch {
    return { ok: false, details: 'corps : JSON invalide' }
  }
  const validation = validateBody(corpsVideQrSchema, lu)
  return validation.success ? { ok: true } : { ok: false, details: validation.error }
}
