// ── Appels du navigateur vers /api/aj-signalement/* ───────────────────────────
//
// Module sans React ; fetch injectable pour les tests. Aucune fonction ne lève : chaque résultat
// porte `ok` et, en cas d'échec, un code que les écrans traduisent en message.
//   - envoyerSignalementQr, proposerAdresseQr, chargerSemblablesQr : page publique ouverte par le QR code, sans
//     session (dépôt, adresse proposée d'après la position, signalements déjà faits au même endroit) ;
//   - les autres : tableau de bord (super admin). Le jeton Bearer est ajouté quand il est connu ;
//     sinon les cookies de session suffisent (credentials same-origin), comme dans l'Administrateur judiciaire.

import {
  NUMERO_QR, estStatutOuvertQr,
  type CoproprieteQr, type LangueSignalementQr, type SaisieCoproprieteQr, type SaisieSignalementQr, type SignalementSemblableQr,
  type StatutSignalementQr, type TableauQr,
} from '@/lib/aj-signalement/types'

export const URL_API_QR = '/api/aj-signalement'

/**
 * Codes d'échec : invalide (4xx), introuvable (404 : QR code inconnu ou désactivé), trop_de_demandes (429),
 * non_authentifie (401), interdit (403 : pas super admin), base_absente (503 : migration non appliquée),
 * serveur (5xx), reseau.
 */
export type CodeErreurQr = 'invalide' | 'introuvable' | 'trop_de_demandes' | 'non_authentifie' | 'interdit' | 'base_absente' | 'serveur' | 'reseau'

export type ResultatEnvoiQr =
  | { ok: true; id: string; numero: string; creeLe: string; emailEnvoye: boolean; confirmationEnvoyee: boolean }
  | { ok: false; code: CodeErreurQr }
export type ResultatTableauQr = { ok: true; tableau: TableauQr } | { ok: false; code: CodeErreurQr }
export type ResultatCoproprieteQr = { ok: true; copropriete: CoproprieteQr } | { ok: false; code: CodeErreurQr }
export type ResultatStatutQr = { ok: true; statut: StatutSignalementQr; misAJourLe: string } | { ok: false; code: CodeErreurQr }
export type ResultatAdresseQr = { ok: true; adresse: string | null } | { ok: false; code: CodeErreurQr }
export type ResultatSemblablesQr = { ok: true; semblables: SignalementSemblableQr[] } | { ok: false; code: CodeErreurQr }

type Fetch = typeof fetch

/** Code d'échec d'une réponse HTTP, d'après son statut et son champ `error`. */
export function codeDepuisReponseQr(status: number, corps: unknown): CodeErreurQr {
  const erreur = corps && typeof corps === 'object' ? (corps as { error?: unknown }).error : undefined
  if (erreur === 'base_absente') return 'base_absente'
  if (status === 401) return 'non_authentifie'
  if (status === 403) return 'interdit'
  if (status === 404) return 'introuvable'
  if (status === 429) return 'trop_de_demandes'
  if (status >= 400 && status < 500) return 'invalide'
  return 'serveur'
}

function entetes(jeton: string | null | undefined, json: boolean): Record<string, string> {
  const e: Record<string, string> = {}
  if (json) e['Content-Type'] = 'application/json'
  if (jeton) e.Authorization = `Bearer ${jeton}`
  return e
}

async function appeler(
  fetchImpl: Fetch, url: string, init: RequestInit,
): Promise<{ ok: true; corps: unknown } | { ok: false; code: CodeErreurQr }> {
  let res: Response
  try {
    res = await fetchImpl(url, { cache: 'no-store', credentials: 'same-origin', ...init })
  } catch (e) {
    console.warn('[aj-signalement] appel impossible', e)
    return { ok: false, code: 'reseau' }
  }
  const corps: unknown = await res.json().catch(() => null)
  if (!res.ok) return { ok: false, code: codeDepuisReponseQr(res.status, corps) }
  return { ok: true, corps }
}

const chaine = (v: unknown): string => (typeof v === 'string' ? v : '')

/** Dépôt public d'un signalement (après scan du QR code). */
export async function envoyerSignalementQr(saisie: SaisieSignalementQr, fetchImpl: Fetch = fetch): Promise<ResultatEnvoiQr> {
  const r = await appeler(fetchImpl, `${URL_API_QR}/signalements`, {
    method: 'POST', headers: entetes(null, true), body: JSON.stringify(saisie),
  })
  if (!r.ok) return r
  const s = (r.corps as { signalement?: Record<string, unknown> } | null)?.signalement
  if (!s || typeof s.id !== 'string') return { ok: false, code: 'serveur' }
  return {
    ok: true, id: s.id, numero: chaine(s.numero), creeLe: chaine(s.creeLe),
    emailEnvoye: s.emailEnvoye === true, confirmationEnvoyee: s.confirmationEnvoyee === true,
  }
}

/**
 * Adresse proposée d'après la position du navigateur (copropriété sans adresse). La position part dans le corps du
 * POST, jamais dans l'URL ; le serveur ne la conserve pas. adresse null : rien trouvé à cet endroit.
 */
export async function proposerAdresseQr(jeton: string, latitude: number, longitude: number, fetchImpl: Fetch = fetch): Promise<ResultatAdresseQr> {
  const r = await appeler(fetchImpl, `${URL_API_QR}/adresse`, {
    method: 'POST', headers: entetes(null, true), body: JSON.stringify({ jeton, latitude, longitude }),
  })
  if (!r.ok) return r
  const adresse = (r.corps as { adresse?: unknown } | null)?.adresse
  return { ok: true, adresse: typeof adresse === 'string' && adresse.trim() ? adresse.trim() : null }
}

/** Jour d'une fiche semblable : AAAA-MM-JJ, jamais l'heure du dépôt. */
const JOUR_QR = /^\d{4}-\d{2}-\d{2}$/

/** Fiche reçue du serveur, gardée seulement si elle a la forme attendue (date = jour seul). */
function semblableDepuisCorps(valeur: unknown): SignalementSemblableQr | null {
  if (!valeur || typeof valeur !== 'object') return null
  const v = valeur as Record<string, unknown>
  if (typeof v.numero !== 'string' || !NUMERO_QR.test(v.numero) || !estStatutOuvertQr(v.statut)) return null
  if (typeof v.typeIntervention !== 'string' || typeof v.zone !== 'string' || typeof v.creeLe !== 'string' || !JOUR_QR.test(v.creeLe)) return null
  return { numero: v.numero, typeIntervention: v.typeIntervention, zone: v.zone, creeLe: v.creeLe, statut: v.statut }
}

/** Signalements déjà faits au même endroit (même copropriété, bâtiment et zone des parties communes). */
export async function chargerSemblablesQr(
  recherche: { jeton: string; batiment: string; zone: string; langue: LangueSignalementQr }, fetchImpl: Fetch = fetch,
): Promise<ResultatSemblablesQr> {
  const parametres = new URLSearchParams({ jeton: recherche.jeton, batiment: recherche.batiment, zone: recherche.zone, langue: recherche.langue })
  const r = await appeler(fetchImpl, `${URL_API_QR}/similaires?${parametres.toString()}`, { method: 'GET' })
  if (!r.ok) return r
  const liste = (r.corps as { semblables?: unknown } | null)?.semblables
  const semblables = Array.isArray(liste) ? liste.map(semblableDepuisCorps).filter((s): s is SignalementSemblableQr => s !== null) : []
  return { ok: true, semblables }
}

/** Copropriétés (avec leur QR code) et signalements reçus — super admin. */
export async function chargerTableauQr(jeton: string | null, fetchImpl: Fetch = fetch): Promise<ResultatTableauQr> {
  const r = await appeler(fetchImpl, `${URL_API_QR}/tableau`, { method: 'GET', headers: entetes(jeton, false) })
  if (!r.ok) return r
  const tableau = (r.corps as { tableau?: TableauQr } | null)?.tableau
  if (!tableau || !Array.isArray(tableau.coproprietes) || !Array.isArray(tableau.signalements)) return { ok: false, code: 'serveur' }
  return { ok: true, tableau }
}

export async function creerCoproprieteQr(saisie: SaisieCoproprieteQr, jeton: string | null, fetchImpl: Fetch = fetch): Promise<ResultatCoproprieteQr> {
  const r = await appeler(fetchImpl, `${URL_API_QR}/coproprietes`, {
    method: 'POST', headers: entetes(jeton, true), body: JSON.stringify(saisie),
  })
  if (!r.ok) return r
  const copropriete = (r.corps as { copropriete?: CoproprieteQr } | null)?.copropriete
  return copropriete?.id ? { ok: true, copropriete } : { ok: false, code: 'serveur' }
}

export interface ModificationCoproprieteQr extends Partial<SaisieCoproprieteQr> {
  actif?: boolean
  /** Tire un nouveau jeton : l'ancien QR code ne répond plus (404). */
  regenererJeton?: boolean
}

export async function modifierCoproprieteQr(
  id: string, modification: ModificationCoproprieteQr, jeton: string | null, fetchImpl: Fetch = fetch,
): Promise<ResultatCoproprieteQr> {
  const r = await appeler(fetchImpl, `${URL_API_QR}/coproprietes/${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: entetes(jeton, true), body: JSON.stringify(modification),
  })
  if (!r.ok) return r
  const copropriete = (r.corps as { copropriete?: CoproprieteQr } | null)?.copropriete
  return copropriete?.id ? { ok: true, copropriete } : { ok: false, code: 'serveur' }
}

export async function changerStatutSignalementQr(
  id: string, statut: StatutSignalementQr, jeton: string | null, fetchImpl: Fetch = fetch,
): Promise<ResultatStatutQr> {
  const r = await appeler(fetchImpl, `${URL_API_QR}/signalements/${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: entetes(jeton, true), body: JSON.stringify({ statut }),
  })
  if (!r.ok) return r
  const s = (r.corps as { signalement?: { statut?: unknown; misAJourLe?: unknown } } | null)?.signalement
  return { ok: true, statut: (chaine(s?.statut) || statut) as StatutSignalementQr, misAJourLe: chaine(s?.misAJourLe) }
}
