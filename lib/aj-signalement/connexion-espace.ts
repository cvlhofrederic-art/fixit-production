// ── Page de connexion professionnelle de l'espace « AJ Signalement » (partie pure) ──────────────
//
// Demande de Hugo du 11/11/2026 : « il faut taper professionnel avec le mail et mot de passe pour se connecter ». La page
// /fr/aj-signalement/connexion/ ne montre qu'un e-mail et un mot de passe (ni Particulier / Artisan / Pro, ni Google) ;
// la page de connexion générale de VitFix ne change pas.
// - Contexte de la page : nom affiché et adresse de l'espace par langue. Sérialisable (une page serveur le passe au
//   composant client) ; l'espace de chaque cabinet (vitfix.io/<client>/connexion, PR 2) passera le sien, sans rien
//   changer au composant.
// - Validation de la saisie avant tout appel ; classement des erreurs de Supabase en trois messages qui ne disent
//   jamais si l'adresse existe ; résumé d'erreur pour le journal, sans e-mail ni mot de passe.
// Textes en français, à /fr/ comme à /pt/ : tout l'espace est en français (outil de l'administrateur).

import { isAuthError } from '@supabase/supabase-js'
import { TEXTES_ESPACE_QR, cheminEspaceQr, type LangueEspaceQr } from '@/lib/aj-signalement/acces-espace'
import { EMAIL_VALIDE_QR } from '@/lib/aj-signalement/formulaire'

export interface ContexteConnexionQr {
  /** Nom affiché au-dessus du titre : « AJ Signalement » ; en PR 2, le nom du cabinet. */
  nom: string
  /** Adresse de l'espace d'arrivée selon la langue de la page ; en PR 2, l'adresse /<client>/ du cabinet. */
  espace: Readonly<Record<LangueEspaceQr, string>>
}

/** Espace global du super admin (/fr/aj-signalement/, /pt/aj-signalement/). */
export const CONTEXTE_CONNEXION_GLOBAL_QR: ContexteConnexionQr = {
  nom: TEXTES_ESPACE_QR.nom,
  espace: { fr: cheminEspaceQr('fr'), pt: cheminEspaceQr('pt') },
}

/** « Mot de passe oublié ? » : parcours existant de VitFix (lien par e-mail), dans la langue de la page. */
export const cheminMotDePasseOublieQr = (langue: LangueEspaceQr): string => `/${langue}/auth/reset-password/`

export const TEXTES_CONNEXION_QR = {
  titre: 'Connexion professionnelle',
  titreOnglet: `Connexion professionnelle — ${TEXTES_ESPACE_QR.nom}`,
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
} as const

// ── Saisie ───────────────────────────────────────────────────────────────────

export interface ErreursSaisieConnexionQr {
  email?: string
  motDePasse?: string
}

export type SaisieConnexionQr =
  | { ok: true; email: string; motDePasse: string }
  | { ok: false; erreurs: ErreursSaisieConnexionQr }

/** E-mail rogné, requis, de forme x@y.zz ; mot de passe requis, jamais rogné (il est envoyé tel que saisi). */
export function validerSaisieConnexionQr(emailSaisi: string, motDePasse: string): SaisieConnexionQr {
  const email = emailSaisi.trim()
  const e = TEXTES_CONNEXION_QR.erreurs
  const erreurs: ErreursSaisieConnexionQr = {}
  if (!email) erreurs.email = e.emailVide
  else if (!EMAIL_VALIDE_QR.test(email)) erreurs.email = e.emailInvalide
  if (!motDePasse) erreurs.motDePasse = e.motDePasseVide
  return erreurs.email || erreurs.motDePasse ? { ok: false, erreurs } : { ok: true, email, motDePasse }
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
