/**
 * Lien « mot de passe oublié » reçu par e-mail, valable sur n'importe quel appareil (constat du 09/11/2026 : demande
 * faite sur le PC, lien ouvert sur le téléphone, « lien expiré » et aucun mot de passe choisi). Modèle d'e-mail
 * Supabase et ordre de bascule : docs/auth-liens-email.md.
 *
 * Pourquoi : nos clients @supabase/ssr sont en flux PKCE. Le lien par défaut ({{ .ConfirmationURL }}) passe par
 * GoTrue, qui consomme le jeton puis renvoie sur le site avec ?code=…. Ce code ne s'échange qu'avec le vérificateur
 * PKCE, gardé en cookie dans le navigateur qui a fait la demande : ailleurs, le SDK ne le reconnaît même pas comme un
 * retour d'authentification (_isPKCECallback exige le vérificateur) et l'ignore ; aucune session, « lien expiré ».
 *
 * Le parcours, sans jamais ouvrir de session dans le navigateur :
 * 1. GET /auth/confirm/?token_hash=…&type=recovery (app/(commun)/auth/confirm/route.ts) : ne consomme pas le jeton
 *    (une messagerie ou un antivirus qui ouvre le lien ne le grille pas), le range dans un cookie httpOnly réservé à
 *    /api/auth/, renvoie vers /{fr|pt}/auth/update-password/?lien=1 ;
 * 2. la page affiche le formulaire ; à l'envoi, POST /api/auth/update-password vérifie le jeton (verifyOtp) et change
 *    le mot de passe côté serveur, puis l'utilisateur se connecte avec son nouveau mot de passe.
 * Ouvrir une session à partir du seul lien permettrait de connecter quelqu'un au compte d'un autre (lien piégé avec
 * le jeton d'un compte de l'attaquant), et Providers remonterait alors son stockage local vers ce compte.
 */
import { premiereLangueValide } from '@/lib/i18n/config'

/**
 * Types de lien acceptés et page d'arrivée de chacun. Liste fermée : un autre type (signup, email, invite,
 * magiclink…) n'a pas de parcours ici et finit sur la page de connexion.
 */
const PAGES_ARRIVEE = {
  recovery: '/auth/update-password',
} as const

export type TypeLienEmail = keyof typeof PAGES_ARRIVEE

const TYPES_ACCEPTES = Object.keys(PAGES_ARRIVEE) as TypeLienEmail[]

/** Cookie qui garde le jeton entre le clic sur le lien et l'envoi du formulaire. */
export const COOKIE_LIEN_MDP = 'vitfix_reinit_mdp'
/** Envoyé seulement à POST /api/auth/update-password (jamais aux pages ni au JavaScript). */
export const CHEMIN_COOKIE_LIEN_MDP = '/api/auth/'
/** Même durée que les liens de Supabase (« Email OTP expiration », 3 600 s relevées le 09/11/2026). */
export const DUREE_COOKIE_LIEN_MDP_S = 3600

/** Paramètre de la page d'arrivée : un jeton attend dans le cookie, formulaire à afficher sans session. */
export const PARAMETRE_LIEN = 'lien'
/** Paramètre ?erreur= de la page d'arrivée quand le lien est refusé (jeton absent, malformé, type inconnu). */
export const ERREUR_LIEN_INVALIDE = 'lien-invalide'

/** Réponses d'erreur de POST /api/auth/update-password, lues par la page. */
export type ErreurNouveauMotDePasse =
  | 'requete-invalide'
  | 'mot-de-passe-faible'
  | 'lien-invalide'
  | 'meme-mot-de-passe'
  | 'mot-de-passe-refuse'
  | 'trop-de-tentatives'
  | 'reessayer'

/** Type du lien lu dans l'URL, ou null s'il n'est pas dans la liste fermée (comparaison exacte, sans prototype). */
export function typeLienEmail(valeur: string | null): TypeLienEmail | null {
  return TYPES_ACCEPTES.find((type) => type === valeur) ?? null
}

/**
 * Jeton tel que GoTrue l'écrit ({{ .TokenHash }} : empreinte hexadécimale, préfixée « pkce_ » en flux PKCE). Bornes
 * larges pour ne pas dépendre du format exact, jeu de caractères strict : la valeur part telle quelle dans un cookie.
 */
export function jetonLienValide(jeton: string | null): jeton is string {
  return jeton !== null && /^[A-Za-z0-9_-]{20,200}$/.test(jeton)
}

/**
 * Règle du mot de passe, identique à celle du formulaire (8 caractères au moins, une majuscule, une minuscule, un
 * chiffre), plus la limite de 72 caractères de GoTrue : vérifiée AVANT de consommer le jeton.
 */
export function motDePasseConforme(motDePasse: string): boolean {
  return motDePasse.length >= 8 && motDePasse.length <= 72
    && /[A-Z]/.test(motDePasse) && /[a-z]/.test(motDePasse) && /\d/.test(motDePasse)
}

/**
 * Langue de la page d'arrivée. Les pages communes (app/(commun)) ne sont servies que sous /fr et /pt : en, nl et es
 * vont vers /pt, comme les redirections du middleware (localeRedirect). Ordre : langue du chemin (en-tête x-locale,
 * posé par le middleware), puis cookie « locale », sinon fr.
 */
export function langueArrivee(...valeurs: (string | null | undefined)[]): 'fr' | 'pt' {
  const langue = premiereLangueValide(...valeurs)
  return langue === undefined || langue === 'fr' ? 'fr' : 'pt'
}

/**
 * Chemin de la page d'arrivée, langue et barre finale comprises (site en trailingSlash : pas de saut 308 de plus).
 * Jamais tiré de l'URL du lien : aucune redirection ouverte possible.
 */
export function cheminArrivee(type: TypeLienEmail | null, langue: 'fr' | 'pt', accepte: boolean): string {
  const page = type === null ? '/auth/login' : PAGES_ARRIVEE[type]
  const parametre = accepte ? `${PARAMETRE_LIEN}=1` : `erreur=${ERREUR_LIEN_INVALIDE}`
  return `/${langue}${page}/?${parametre}`
}
