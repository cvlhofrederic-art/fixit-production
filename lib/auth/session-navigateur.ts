/**
 * Lecture de la session Supabase dans le navigateur, sans état sans issue (lot 1 de l'analyse Sentry du
 * 28/10/2026 : AbortError du verrou d'auth, squelette infini et boucle tableau de bord ⇄ connexion).
 *
 * Utilisé par la page de connexion (app/auth/login/page.tsx), les tableaux de bord client et pro, l'en-tête et le
 * jeton d'accès partagé (lib/auth/jeton-acces.ts). Trois verdicts pour getUser(), par un classificateur unique :
 * - « valide » : getUser() a confirmé l'utilisateur auprès de Supabase (JWT vérifié côté serveur) ;
 * - « refusee » : Supabase dit explicitement que la session de ce navigateur est inutilisable — utilisateur nul
 *   sans erreur, AuthSessionMissingError, AuthApiError 401, 403 ou 404. Seul ce verdict autorise l'appelant à
 *   renvoyer vers la connexion ou à fermer la session locale ;
 * - « indisponible » : tout le reste — autres 4xx (400, 422…), 408, 429, 5xx, réseau, délai dépassé, AbortError ou
 *   délai du verrou d'auth, exception. La session n'est NI détruite NI rechargée : une simple lenteur (réseau mobile,
 *   Supabase ralenti, autre onglet qui tient le verrou) ne dit rien de la validité de la session.
 *
 * Un abandon du verrou ou un délai dépassé donne droit à un second essai après 500 ms, puis le verdict est
 * « indisponible » (session inconnue) : jamais de rechargement ni de redirection sur ces erreurs.
 *
 * Ce module ne lit ni n'écrit aucun stockage du navigateur.
 */
import {
  isAuthApiError,
  isAuthSessionMissingError,
  type Session,
  type User,
  type UserResponse,
} from '@supabase/supabase-js'
import { estAbandonDeVerrou } from './verrou-auth'

/**
 * Délai maximal d'une lecture d'auth (getUser, getSession). Il ne prouve rien sur la session (initialisation du
 * client, verrou partagé entre onglets, réseau) : au-delà, le verdict est « indisponible ».
 */
export const DELAI_REPONSE_AUTH_MS = 10_000
/** Attente avant le second essai après un abandon du verrou d'auth ou un délai dépassé. */
export const DELAI_AVANT_NOUVEL_ESSAI_MS = 500

export class DelaiDepasseError extends Error {
  readonly delaiMs: number

  constructor(delaiMs: number) {
    super(`Aucune réponse après ${delaiMs} ms`)
    this.name = 'DelaiDepasseError'
    this.delaiMs = delaiMs
  }
}

/** Rejette avec DelaiDepasseError si la promesse n'est pas réglée dans le délai. */
export function avecDelai<T>(promesse: Promise<T>, delaiMs: number): Promise<T> {
  return new Promise<T>((resoudre, rejeter) => {
    const minuteur = setTimeout(() => rejeter(new DelaiDepasseError(delaiMs)), delaiMs)
    promesse.then(
      (valeur) => {
        clearTimeout(minuteur)
        resoudre(valeur)
      },
      (erreur: unknown) => {
        clearTimeout(minuteur)
        rejeter(erreur)
      },
    )
  })
}

export type VerificationSession =
  | { statut: 'valide'; user: User }
  | { statut: 'refusee'; motif: 'absente' | 'authentification'; erreur?: unknown }
  | { statut: 'indisponible'; erreur: unknown }

/**
 * Statuts par lesquels Supabase refuse explicitement le jeton ou l'utilisateur : 401 (jeton absent ou invalide),
 * 403 (jeton refusé, utilisateur du JWT inexistant), 404 (utilisateur supprimé). Tout autre statut est « indisponible ».
 */
const STATUTS_REFUS_DE_SESSION = new Set([401, 403, 404])

/** Erreur renvoyée par auth-js : true seulement si Supabase refuse explicitement la session. */
function estRefusDeSession(erreur: unknown): boolean {
  if (isAuthSessionMissingError(erreur)) return true
  return isAuthApiError(erreur) && STATUTS_REFUS_DE_SESSION.has(erreur.status)
}

/** Classificateur unique d'une réponse de getUser(). Pur : ne lève pas, n'appelle rien. */
export function classerSession(reponse: UserResponse): VerificationSession {
  const user = reponse.data?.user ?? null
  if (user) return { statut: 'valide', user }
  const erreur: unknown = reponse.error
  if (!erreur) return { statut: 'refusee', motif: 'absente' }
  if (isAuthSessionMissingError(erreur)) return { statut: 'refusee', motif: 'absente', erreur }
  if (estRefusDeSession(erreur)) return { statut: 'refusee', motif: 'authentification', erreur }
  return { statut: 'indisponible', erreur }
}

/** Un abandon du verrou d'auth ou un délai dépassé mérite un second essai ; une autre erreur, non. */
export function meriteNouvelEssai(erreur: unknown): boolean {
  return erreur instanceof DelaiDepasseError || estAbandonDeVerrou(erreur)
}

export type Attente = (ms: number) => Promise<void>

const attendre: Attente = (ms) => new Promise((resoudre) => setTimeout(resoudre, ms))

export interface OptionsLecture {
  delaiMs?: number
  attente?: Attente
}

async function avecNouvelEssai<T>(operation: () => Promise<T>, options: OptionsLecture): Promise<T> {
  const delaiMs = options.delaiMs ?? DELAI_REPONSE_AUTH_MS
  const attente = options.attente ?? attendre
  try {
    return await avecDelai(operation(), delaiMs)
  } catch (erreur) {
    if (!meriteNouvelEssai(erreur)) throw erreur
    await attente(DELAI_AVANT_NOUVEL_ESSAI_MS)
    return await avecDelai(operation(), delaiMs)
  }
}

export interface AuthGetUser {
  getUser(): Promise<UserResponse>
}

/**
 * Valide la session auprès de Supabase (getUser), avec délai maximal et un second essai sur abandon du verrou.
 * Ne lève jamais : une exception vaut « indisponible », et une lenteur ne détruit jamais la session.
 */
export async function verifierSessionNavigateur(auth: AuthGetUser, options: OptionsLecture = {}): Promise<VerificationSession> {
  try {
    return classerSession(await avecNouvelEssai(() => auth.getUser(), options))
  } catch (erreur) {
    return { statut: 'indisponible', erreur }
  }
}

export interface ReponseSession {
  data: { session: Session | null }
  error: unknown
}

export interface AuthGetSession {
  getSession(): Promise<ReponseSession>
}

export interface LectureSession {
  /** Session locale (cookies), ou null si absente ou inconnue. */
  session: Session | null
  /** true : impossible de savoir (verrou abandonné, délai, réseau) ; l'appelant ne doit ni rediriger ni recharger. */
  indisponible: boolean
  erreur?: unknown
}

/**
 * Lit la session locale (getSession) avec délai maximal et un second essai sur abandon du verrou. Ne lève jamais.
 * Une erreur d'authentification explicite (jeton de rafraîchissement refusé, session absente) vaut « pas de
 * session » ; toute autre erreur vaut « indisponible ».
 */
export async function lireSessionSure(auth: AuthGetSession, options: OptionsLecture = {}): Promise<LectureSession> {
  try {
    const { data, error } = await avecNouvelEssai(() => auth.getSession(), options)
    if (error && !isAuthApiError(error) && !isAuthSessionMissingError(error)) {
      return { session: null, indisponible: true, erreur: error }
    }
    return { session: data?.session ?? null, indisponible: false, erreur: error ?? undefined }
  } catch (erreur) {
    return { session: null, indisponible: true, erreur }
  }
}
