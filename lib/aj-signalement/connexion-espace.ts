// ── Page de connexion professionnelle de l'espace « AJ Signalement » (partie pure) ──────────────
//
// Demande de Hugo du 11/11/2026 : « il faut taper professionnel avec le mail et mot de passe pour se connecter ». La page
// /fr/aj-signalement/connexion/ ne montre qu'un e-mail et un mot de passe (ni Particulier / Artisan / Pro, ni Google) ;
// la page de connexion générale de VitFix ne change pas.
// - Contexte de la page : nom affiché et adresse de l'espace par langue. Sérialisable (une page serveur le passe au
//   composant client). Depuis la PR 2 (lot 4), la page de chaque cabinet (vitfix.io/<identifiant>/connexion/) passe le
//   sien avec l'identifiant du cabinet, transmis à la décision d'accès (destinationConnexionEspaceQr) : seul un
//   gestionnaire de CE cabinet y entre ; le super admin est renvoyé vers son espace global ; un gestionnaire d'un autre
//   cabinet reçoit le message neutre.
// - Validation de la saisie avant tout appel ; classement des erreurs de Supabase en trois messages qui ne disent
//   jamais si l'adresse existe ; résumé d'erreur pour le journal, sans e-mail ni mot de passe.
// - « Mot de passe oublié » dans la page (relecture du 11/11/2026) : la page commune /auth/reset-password/ ramenait
//   le professionnel vers la connexion générale (Particulier / Artisan / Pro, Google). Le lien se demande ici, par la
//   route existante de VitFix ; sa réponse est classée en quatre cas, le message « envoyé » est neutre.
// Textes en français, à /fr/ comme à /pt/ : tout l'espace est en français (outil de l'administrateur).

import { isAuthError } from '@supabase/supabase-js'
import { TEXTES_ESPACE_QR, cheminEspaceQr, type LangueEspaceQr } from '@/lib/aj-signalement/acces-espace'
import { cheminSuiviCabinetQr } from '@/lib/aj-signalement/chemin-cabinet'
import { EMAIL_VALIDE_QR } from '@/lib/aj-signalement/formulaire'

export interface ContexteConnexionQr {
  /** Nom affiché au-dessus du titre : « AJ Signalement », ou le nom du cabinet (PR 2). */
  nom: string
  /** Adresse de l'espace d'arrivée selon la langue de la page ; pour un cabinet, /<identifiant>/suivi/ dans les deux. */
  espace: Readonly<Record<LangueEspaceQr, string>>
  /** Cabinet de la page (PR 2, lot 4) : sa présence change la décision d'accès (gestionnaire de CE cabinet seul). */
  cabinet?: Readonly<{ identifiant: string }>
}

/** Espace global du super admin (/fr/aj-signalement/, /pt/aj-signalement/). */
export const CONTEXTE_CONNEXION_GLOBAL_QR: ContexteConnexionQr = {
  nom: TEXTES_ESPACE_QR.nom,
  espace: { fr: cheminEspaceQr('fr'), pt: cheminEspaceQr('pt') },
}

/**
 * Page de connexion d'un cabinet (vitfix.io/<identifiant>/connexion/, PR 2) : nom du cabinet, son espace de suivi (sans
 * langue : l'espace est en français pour tout cabinet) et son identifiant pour la décision d'accès.
 */
export function contexteConnexionCabinetQr(cabinet: Readonly<{ identifiant: string; nom: string }>): ContexteConnexionQr {
  const suivi = cheminSuiviCabinetQr(cabinet.identifiant)
  return { nom: cabinet.nom, espace: { fr: suivi, pt: suivi }, cabinet: { identifiant: cabinet.identifiant } }
}

/** Titre d'onglet de la page de connexion : « Connexion professionnelle — <nom de l'espace ou du cabinet> ». */
export const titreOngletConnexionQr = (nom: string): string => `Connexion professionnelle — ${nom}`

/**
 * « Mot de passe oublié » : route existante de VitFix (3 demandes par 5 minutes et par IP). Elle envoie l'e-mail de
 * Supabase avec le lien vers la page commune /auth/update-password/ (limite connue : après le nouveau mot de passe,
 * cette page renvoie vers la connexion générale ; PR 2).
 */
export const ROUTE_LIEN_MOT_DE_PASSE_QR = '/api/auth/reset-password'

export const TEXTES_CONNEXION_QR = {
  titre: 'Connexion professionnelle',
  titreOnglet: titreOngletConnexionQr(TEXTES_ESPACE_QR.nom),
  aide: 'Espace réservé aux professionnels. Connectez-vous avec votre adresse e-mail et votre mot de passe.',
  email: 'Adresse e-mail professionnelle',
  motDePasse: 'Mot de passe',
  afficherMotDePasse: 'Afficher le mot de passe',
  masquerMotDePasse: 'Masquer le mot de passe',
  seConnecter: 'Se connecter',
  connexionEnCours: 'Connexion…',
  motDePasseOublie: 'Mot de passe oublié ?',
  sansAcces: TEXTES_ESPACE_QR.sansAcces,
  autreCompte: 'Connectez-vous avec un autre compte.',
  erreurs: {
    emailVide: 'Indiquez votre adresse e-mail.',
    emailInvalide: 'Adresse e-mail invalide.',
    motDePasseVide: 'Indiquez votre mot de passe.',
    identifiants: 'E-mail ou mot de passe incorrect.',
    tentatives: 'Trop de tentatives. Réessayez dans quelques minutes.',
    indisponible: 'Connexion impossible pour le moment. Réessayez dans un instant.',
  },
  oubli: {
    titre: 'Mot de passe oublié',
    aide: 'Indiquez votre adresse e-mail professionnelle : vous recevrez un lien pour choisir un nouveau mot de passe.',
    envoyer: 'Envoyer le lien',
    envoiEnCours: 'Envoi…',
    /** Même texte que l'adresse ait un compte ou non (la route répond pareil) : rien n'est révélé. */
    envoye: 'Si un compte existe avec cette adresse, vous recevrez dans quelques minutes un lien pour choisir un nouveau mot de passe.',
    retour: 'Retour à la connexion professionnelle',
    erreurs: {
      tentatives: 'Trop de demandes. Réessayez dans quelques minutes.',
      indisponible: 'Envoi impossible pour le moment. Réessayez dans un instant.',
    },
  },
} as const

// ── Saisie ───────────────────────────────────────────────────────────────────

export interface ErreursSaisieConnexionQr {
  email?: string
  motDePasse?: string
}

export type SaisieConnexionQr =
  | { ok: true; email: string; motDePasse: string }
  | { ok: false; erreurs: ErreursSaisieConnexionQr }

/** Message d'erreur d'un e-mail déjà rogné (requis, de forme x@y.zz), ou undefined s'il est valable. */
function erreurEmailQr(email: string): string | undefined {
  if (!email) return TEXTES_CONNEXION_QR.erreurs.emailVide
  return EMAIL_VALIDE_QR.test(email) ? undefined : TEXTES_CONNEXION_QR.erreurs.emailInvalide
}

/** E-mail rogné, requis, de forme x@y.zz ; mot de passe requis, jamais rogné (il est envoyé tel que saisi). */
export function validerSaisieConnexionQr(emailSaisi: string, motDePasse: string): SaisieConnexionQr {
  const email = emailSaisi.trim()
  const erreurs: ErreursSaisieConnexionQr = {}
  const erreurEmail = erreurEmailQr(email)
  if (erreurEmail) erreurs.email = erreurEmail
  if (!motDePasse) erreurs.motDePasse = TEXTES_CONNEXION_QR.erreurs.motDePasseVide
  return erreurs.email || erreurs.motDePasse ? { ok: false, erreurs } : { ok: true, email, motDePasse }
}

/** E-mail seul (« Mot de passe oublié ») : mêmes règles et mêmes messages que la connexion. */
export function validerEmailConnexionQr(emailSaisi: string): { ok: true; email: string } | { ok: false; erreur: string } {
  const email = emailSaisi.trim()
  const erreur = erreurEmailQr(email)
  return erreur ? { ok: false, erreur } : { ok: true, email }
}

// ── « Mot de passe oublié » : réponse de la route ────────────────────────────

/** envoye : message neutre ; email : adresse refusée par le serveur (Zod) ; tentatives : 429 ; indisponible : le reste. */
export type ResultatLienMotDePasseQr = 'envoye' | 'email' | 'tentatives' | 'indisponible'

/** Statut HTTP de POST /api/auth/reset-password → cas affiché (le message d'erreur du serveur n'est jamais montré). */
export function classerReponseLienMotDePasseQr(statut: number): ResultatLienMotDePasseQr {
  if (statut >= 200 && statut < 300) return 'envoye'
  if (statut === 400) return 'email'
  if (statut === 429) return 'tentatives'
  return 'indisponible'
}

// ── Erreurs de connexion ─────────────────────────────────────────────────────

export type ErreurConnexionQr = keyof Pick<typeof TEXTES_CONNEXION_QR.erreurs, 'identifiants' | 'tentatives' | 'indisponible'>

/**
 * Erreur de signInWithPassword (renvoyée ou levée) : 429 → « tentatives » (limite de Supabase Auth, côté serveur) ;
 * autre 4xx → « identifiants » (même texte pour tout : rien ne dit si l'adresse existe) ; serveur, réseau
 * (AuthRetryableFetchError : statut 0 ou 502-504) ou exception → « indisponible », pour qu'un professionnel ne
 * retape pas un bon mot de passe en usant la limite.
 */
export function classerErreurConnexionQr(erreur: unknown): ErreurConnexionQr {
  const statut = isAuthError(erreur) ? erreur.status : undefined
  if (statut === 429) return 'tentatives'
  if (statut !== undefined && statut >= 400 && statut < 500) return 'identifiants'
  return 'indisponible'
}

/** Résumé pour le journal : nom et statut de l'erreur seulement, jamais son message (ni e-mail ni mot de passe). */
export function resumeErreurConnexionQr(erreur: unknown): string {
  if (!(erreur instanceof Error)) return 'erreur inconnue'
  const statut = isAuthError(erreur) ? erreur.status : undefined
  return statut === undefined ? erreur.name : `${erreur.name} ${statut}`
}
