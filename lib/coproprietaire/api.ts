// ── Appels du portail copropriétaire vers /api/coproprietaire/* ───────────────
//
// Module sans React ; fetch injectable pour les tests. Aucune fonction ne lève : chaque
// résultat porte `ok` et, en cas d'échec, un code que les écrans traduisent en message.

import type { ChoixVote, EspaceCopro } from '@/lib/coproprietaire/types'

type Fetch = typeof fetch

/**
 * Codes d'échec : ceux de l'accès (lib/coproprietaire/acces.ts) et ceux du transport.
 *   non_authentifie — pas de session ou session expirée (401) ;
 *   role_interdit   — compte d'un autre espace (403) ;
 *   email_non_confirme — adresse du compte non confirmée (403) ;
 *   acces_non_active — fiche trouvée, accès non activé par le syndic (403) ;
 *   fiche_introuvable — aucune fiche à cet e-mail (404) ;
 *   vote_clos / vote_ferme — vote par correspondance clos (date limite) ou assemblée non convoquée (409) ;
 *   trop_de_demandes — limite de débit (429) ; invalide (4xx) ; serveur (5xx) ; reseau.
 */
export type CodeErreurApi =
  | 'non_authentifie' | 'role_interdit' | 'email_non_confirme' | 'acces_non_active' | 'fiche_introuvable'
  | 'vote_clos' | 'vote_ferme'
  | 'trop_de_demandes' | 'invalide' | 'serveur' | 'reseau'

export type ResultatEspace = { ok: true; espace: EspaceCopro } | { ok: false; code: CodeErreurApi }
export type ResultatDocument = { ok: true; url: string } | { ok: false; code: CodeErreurApi }
export type ResultatMessage = { ok: true; id: string; date: string } | { ok: false; code: CodeErreurApi }
export type ResultatVote = { ok: true; choix: ChoixVote; enregistreLe: string } | { ok: false; code: CodeErreurApi }

const CODES_ACCES: ReadonlySet<string> = new Set(['non_authentifie', 'role_interdit', 'email_non_confirme', 'acces_non_active', 'fiche_introuvable', 'vote_clos', 'vote_ferme'])

/** Code d'échec d'une réponse HTTP, d'après son statut et son champ `error`. */
export function codeDepuisReponse(status: number, corps: unknown): CodeErreurApi {
  const erreur = corps && typeof corps === 'object' ? (corps as { error?: unknown }).error : undefined
  if (typeof erreur === 'string' && CODES_ACCES.has(erreur)) return erreur as CodeErreurApi
  if (status === 401) return 'non_authentifie'
  if (status === 403) return 'role_interdit'
  if (status === 404) return 'fiche_introuvable'
  if (status === 429) return 'trop_de_demandes'
  if (status >= 400 && status < 500) return 'invalide'
  return 'serveur'
}

// ── Contexte des actions ─────────────────────────────────────────────────────
// Le serveur résout la fiche affichée avec ?lot= (compte à plusieurs lots) et, pour le super admin de
// démonstration, ?email= : useEspaceCopro pose ce contexte après chaque chargement, et toutes les
// actions (document, message, vote, PDF, assistant) le reprennent — sinon le serveur retomberait sur
// la première fiche du compte.

export interface ContexteApi {
  lot?: string | null
  email?: string | null
}

let contexteCourant: ContexteApi = {}

export function definirContexteApi(contexte: ContexteApi): void {
  contexteCourant = { lot: contexte.lot ?? null, email: contexte.email ?? null }
}

export function contexteApi(): ContexteApi {
  return { ...contexteCourant }
}

/** URL d'action complétée par ?lot=&email= du contexte courant. */
export function avecContexte(url: string, contexte: ContexteApi = contexteCourant): string {
  const parametres = new URLSearchParams()
  if (contexte.lot) parametres.set('lot', contexte.lot)
  if (contexte.email) parametres.set('email', contexte.email)
  const suffixe = parametres.toString()
  return suffixe ? `${url}${url.includes('?') ? '&' : '?'}${suffixe}` : url
}

function entetes(jeton: string, json = false): Record<string, string> {
  return { Authorization: `Bearer ${jeton}`, ...(json ? { 'Content-Type': 'application/json' } : {}) }
}

async function lireJson(res: Response): Promise<unknown> {
  return res.json().catch(() => null)
}

/**
 * Charge l'espace du copropriétaire connecté.
 * `lot` : id de la fiche à afficher (compte à plusieurs lots) ; `email` : super admin seulement.
 */
export async function chargerEspace(
  jeton: string,
  options: { lot?: string | null; email?: string | null; fetchImpl?: Fetch } = {},
): Promise<ResultatEspace> {
  const parametres = new URLSearchParams()
  if (options.lot) parametres.set('lot', options.lot)
  if (options.email) parametres.set('email', options.email)
  const suffixe = parametres.toString() ? `?${parametres}` : ''
  try {
    const res = await (options.fetchImpl ?? fetch)(`/api/coproprietaire/espace${suffixe}`, { headers: entetes(jeton), cache: 'no-store' })
    const corps = await lireJson(res)
    if (!res.ok) return { ok: false, code: codeDepuisReponse(res.status, corps) }
    const espace = corps && typeof corps === 'object' ? (corps as { espace?: EspaceCopro }).espace : undefined
    if (!espace || typeof espace !== 'object' || !espace.profil) return { ok: false, code: 'serveur' }
    return { ok: true, espace }
  } catch (e) {
    console.warn('[copro] chargement de l’espace impossible', e)
    return { ok: false, code: 'reseau' }
  }
}

/** URL signée (10 minutes) d'un document de l'immeuble, demandée au moment de l'ouverture. */
export async function ouvrirDocument(jeton: string, documentId: string, fetchImpl: Fetch = fetch): Promise<ResultatDocument> {
  try {
    const res = await fetchImpl(avecContexte(`/api/coproprietaire/documents/${encodeURIComponent(documentId)}`), { headers: entetes(jeton), cache: 'no-store' })
    const corps = await lireJson(res)
    if (!res.ok) return { ok: false, code: codeDepuisReponse(res.status, corps) }
    const url = corps && typeof corps === 'object' ? (corps as { url?: unknown }).url : undefined
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return { ok: false, code: 'serveur' }
    return { ok: true, url }
  } catch (e) {
    console.warn('[copro] ouverture du document impossible', e)
    return { ok: false, code: 'reseau' }
  }
}

/** Message du copropriétaire dans le fil de l'une de SES demandes. */
export async function envoyerMessageDemande(
  jeton: string,
  signalementId: string,
  texte: string,
  fetchImpl: Fetch = fetch,
): Promise<ResultatMessage> {
  try {
    const res = await fetchImpl(avecContexte('/api/coproprietaire/signalement/message'), {
      method: 'POST', headers: entetes(jeton, true), body: JSON.stringify({ signalementId, texte: texte.trim().slice(0, 5000) }),
    })
    const corps = await lireJson(res)
    if (!res.ok) return { ok: false, code: codeDepuisReponse(res.status, corps) }
    const message = corps && typeof corps === 'object' ? (corps as { message?: { id?: unknown; date?: unknown } }).message : undefined
    return { ok: true, id: typeof message?.id === 'string' ? message.id : '', date: typeof message?.date === 'string' ? message.date : new Date().toISOString() }
  } catch (e) {
    console.warn('[copro] envoi du message impossible', e)
    return { ok: false, code: 'reseau' }
  }
}

/** Vote par correspondance sur une résolution d'une assemblée convoquée (modifiable jusqu'à la date limite). */
export async function voterResolution(
  jeton: string,
  resolutionId: string,
  choix: ChoixVote,
  fetchImpl: Fetch = fetch,
): Promise<ResultatVote> {
  try {
    const res = await fetchImpl(avecContexte('/api/coproprietaire/assemblees/vote'), {
      method: 'POST', headers: entetes(jeton, true), body: JSON.stringify({ resolutionId, vote: choix }),
    })
    const corps = await lireJson(res)
    if (!res.ok) return { ok: false, code: codeDepuisReponse(res.status, corps) }
    const vote = corps && typeof corps === 'object' ? (corps as { vote?: { vote?: unknown; enregistreLe?: unknown } }).vote : undefined
    const enregistre = vote?.vote === 'pour' || vote?.vote === 'contre' || vote?.vote === 'abstention' ? (vote.vote as ChoixVote) : choix
    return { ok: true, choix: enregistre, enregistreLe: typeof vote?.enregistreLe === 'string' ? vote.enregistreLe : new Date().toISOString() }
  } catch (e) {
    console.warn('[copro] vote impossible', e)
    return { ok: false, code: 'reseau' }
  }
}

/** Date limite du vote par correspondance : trois jours francs avant la séance (décret n° 67-223, art. 9 bis). */
export function dateLimiteVote(dateAssemblee: string): Date | null {
  const d = new Date(dateAssemblee)
  if (Number.isNaN(d.getTime())) return null
  d.setDate(d.getDate() - 3)
  return d
}

/** Le vote par correspondance est-il encore ouvert à l'instant `maintenant` ? */
export function voteOuvert(dateAssemblee: string, maintenant: Date = new Date()): boolean {
  const limite = dateLimiteVote(dateAssemblee)
  return limite !== null && maintenant.getTime() <= limite.getTime()
}
