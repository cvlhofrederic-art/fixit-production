/**
 * Vérification de la session Supabase dans le navigateur, sans état sans issue.
 *
 * Utilisé par la page de connexion (app/auth/login/page.tsx) et le tableau de bord client
 * (app/client/dashboard/page.tsx), qui classent ainsi une même réponse de getUser() de la même façon. Avant ce
 * module, un getUser() qui levait ou ne répondait pas laissait le squelette affiché indéfiniment, et une session
 * refusée par Supabase restait dans les cookies : la page de connexion renvoyait alors vers le tableau de bord.
 *
 * Trois verdicts, par un classificateur unique (classerSession), le plus restrictif :
 * - « valide » : getUser() a confirmé l'utilisateur auprès de Supabase (JWT vérifié côté serveur) ;
 * - « refusee » : Supabase dit explicitement que la session de ce navigateur est inutilisable — utilisateur nul
 *   sans erreur, AuthSessionMissingError, AuthApiError 401, 403 ou 404. Seul ce verdict autorise l'appelant à
 *   fermer la session (signOut local, POST /api/auth/logout/) ;
 * - « indisponible » : tout le reste — autres 4xx (400, 422…), 408, 429, 5xx, réseau, délai dépassé, AbortError
 *   ou délai du verrou navigateur, exception. La session n'est PAS détruite : le délai de getUser() compte
 *   l'initialisation du client, l'attente du verrou partagé entre onglets et l'aller-retour réseau, donc une simple
 *   lenteur (réseau mobile, Supabase ralenti, autre onglet) ne dit rien de la validité de la session.
 *
 * Ce module ne lit ni n'écrit aucun stockage du navigateur (localStorage, sessionStorage) : la déconnexion
 * serveur ne supprime que les cookies sb-* de la session Supabase.
 */
import {
  isAuthApiError,
  isAuthSessionMissingError,
  type User,
  type UserResponse,
} from '@supabase/supabase-js'

/**
 * Délai maximal d'une opération d'authentification (getUser, signOut), pour ne jamais rester bloqué. Il ne prouve
 * rien sur la session (initialisation, verrou partagé entre onglets, réseau) : getUser au-delà vaut « indisponible ».
 */
export const DELAI_REPONSE_AUTH_MS = 10_000
/** Délai maximal du POST /api/auth/logout, pour que la navigation ait toujours lieu. */
export const DELAI_DECONNEXION_SERVEUR_MS = 5_000

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

/**
 * Classificateur unique d'une réponse de getUser(), partagé par la page de connexion et le tableau de bord client.
 * Pur : ne lève pas, n'appelle rien.
 */
export function classerSession(reponse: UserResponse): VerificationSession {
  const user = reponse.data?.user ?? null
  if (user) return { statut: 'valide', user }
  const erreur: unknown = reponse.error
  if (!erreur) return { statut: 'refusee', motif: 'absente' }
  if (isAuthSessionMissingError(erreur)) return { statut: 'refusee', motif: 'absente', erreur }
  if (estRefusDeSession(erreur)) return { statut: 'refusee', motif: 'authentification', erreur }
  return { statut: 'indisponible', erreur }
}

/**
 * Valide la session auprès de Supabase (getUser), avec délai maximal. Ne lève jamais.
 * Une exception (réseau, AbortError ou délai du verrou navigateur) ou un délai dépassé vaut « indisponible » :
 * une lenteur ne détruit jamais la session.
 */
export async function verifierSessionNavigateur(
  auth: { getUser(): Promise<UserResponse> },
  delaiMs: number = DELAI_REPONSE_AUTH_MS,
): Promise<VerificationSession> {
  try {
    return classerSession(await avecDelai(auth.getUser(), delaiMs))
  } catch (erreur) {
    return { statut: 'indisponible', erreur }
  }
}

/**
 * Supprime la session Supabase côté serveur (cookies sb-* uniquement) via POST /api/auth/logout/.
 * Réservé à une session « refusee » ou à l'échec d'une déconnexion demandée par l'utilisateur.
 * Délai maximal de 5 s ; ne lève jamais : l'appelant navigue ensuite quoi qu'il arrive.
 * keepalive : la requête aboutit même si une navigation déjà lancée (événement SIGNED_OUT) décharge la page ;
 * barre finale (trailingSlash: true) : sans elle, la requête devrait suivre une 308 après le déchargement.
 */
export async function deconnecterSessionServeur(locale: string): Promise<boolean> {
  const controleur = new AbortController()
  const minuteur = setTimeout(() => controleur.abort(), DELAI_DECONNEXION_SERVEUR_MS)
  try {
    const reponse = await fetch('/api/auth/logout/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ locale }),
      credentials: 'same-origin',
      cache: 'no-store',
      keepalive: true,
      signal: controleur.signal,
    })
    if (!reponse.ok) console.error('[auth] déconnexion serveur refusée, statut', reponse.status)
    return reponse.ok
  } catch (erreur) {
    console.error('[auth] déconnexion serveur impossible :', erreur)
    return false
  } finally {
    clearTimeout(minuteur)
  }
}
