// ── AJ Signalement — diffusion : appels de la page publique de désinscription (PR 3, lot 6) ─────────────────────────
//
// Routes D-P1 à D-P4 (cahier PR 3 § 4.1). Module sans React ; fetch injectable pour les tests. Aucune fonction ne lève :
// chaque résultat est { ok: true, … } ou { ok: false, code }. Aucun cookie envoyé (page publique, sans session) ; la
// réponse est relue champ par champ (rien n'est affiché qui ne soit du type attendu).

import type { LangueSignalementQr } from '@/lib/aj-signalement/types'

export const URL_API_DESINSCRIPTION_QR = '/api/aj-signalement/desinscription'

/** Codes d'échec vus par la page. */
export type CodeDesinscriptionQr = 'lien_invalide' | 'lien_expire' | 'non_levable' | 'limite' | 'invalide' | 'serveur' | 'reseau'

export type EchecDesinscriptionQr = { ok: false; code: CodeDesinscriptionQr }

export type LectureDesinscriptionQr =
  | {
    etat: 'valide'; type: 'page' | 'un_clic'; langue: LangueSignalementQr; cabinet: string; copropriete: string
    emailMasque: string | null; oppose: boolean; levable: boolean; politiqueUrl: string | null
  }
  | { etat: 'expire'; type: 'page' | 'un_clic'; langue: LangueSignalementQr; cabinet: string; copropriete: string; politiqueUrl: string | null }
  | { etat: 'ancien'; langue: LangueSignalementQr; cabinet: string | null; contactCabinet: string | null; politiqueUrl: string | null }
  | { etat: 'inconnu'; langue: LangueSignalementQr; contactCabinet: string | null }

type Fetch = typeof fetch

const CODES: readonly CodeDesinscriptionQr[] = ['lien_invalide', 'lien_expire', 'non_levable', 'limite', 'invalide', 'serveur']

function codeDepuisStatut(status: number, corps: unknown): CodeDesinscriptionQr {
  const erreur = typeof corps === 'object' && corps !== null ? (corps as Record<string, unknown>).error : undefined
  if (typeof erreur === 'string' && (CODES as readonly string[]).includes(erreur)) return erreur as CodeDesinscriptionQr
  if (status === 429) return 'limite'
  if (status === 404) return 'lien_invalide'
  if (status === 410) return 'lien_expire'
  if (status === 409) return 'non_levable'
  if (status === 400) return 'invalide'
  return 'serveur'
}

async function poster(fetchImpl: Fetch, chemin: string, corps: unknown): Promise<{ ok: true; corps: unknown } | EchecDesinscriptionQr> {
  let reponse: Response
  try {
    reponse = await fetchImpl(`${URL_API_DESINSCRIPTION_QR}${chemin}`, {
      method: 'POST',
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(corps),
    })
  } catch {
    // Réseau coupé : la page propose de réessayer (le jeton reste en mémoire).
    return { ok: false, code: 'reseau' }
  }
  const lu: unknown = await reponse.json().catch(() => null)
  if (!reponse.ok) return { ok: false, code: codeDepuisStatut(reponse.status, lu) }
  return { ok: true, corps: lu }
}

const texte = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null)
const langue = (v: unknown): LangueSignalementQr => (v === 'pt' ? 'pt' : 'fr')
const type = (v: unknown): 'page' | 'un_clic' => (v === 'page' ? 'page' : 'un_clic')

/** Corps de D-P1 relu champ par champ ; état inconnu si la forme n'est pas reconnue. */
export function lectureDepuisCorpsQr(corps: unknown): LectureDesinscriptionQr | null {
  if (typeof corps !== 'object' || corps === null) return null
  const c = corps as Record<string, unknown>
  switch (c.etat) {
    case 'valide':
      return {
        etat: 'valide', type: type(c.type), langue: langue(c.langue), cabinet: texte(c.cabinet) ?? '', copropriete: texte(c.copropriete) ?? '',
        emailMasque: texte(c.emailMasque), oppose: c.oppose === true, levable: c.levable === true, politiqueUrl: texte(c.politiqueUrl),
      }
    case 'expire':
      return {
        etat: 'expire', type: type(c.type), langue: langue(c.langue), cabinet: texte(c.cabinet) ?? '', copropriete: texte(c.copropriete) ?? '',
        politiqueUrl: texte(c.politiqueUrl),
      }
    case 'ancien':
      return { etat: 'ancien', langue: langue(c.langue), cabinet: texte(c.cabinet), contactCabinet: texte(c.contactCabinet), politiqueUrl: texte(c.politiqueUrl) }
    case 'inconnu':
      return { etat: 'inconnu', langue: langue(c.langue), contactCabinet: texte(c.contactCabinet) }
    default:
      return null
  }
}

/** D-P1 : lecture du lien, sans effet. */
export async function lireLienDesinscriptionQr(
  jeton: string, identifiant: string, fetchImpl: Fetch = fetch,
): Promise<{ ok: true; lecture: LectureDesinscriptionQr } | EchecDesinscriptionQr> {
  const r = await poster(fetchImpl, '/lecture', { jeton, identifiant })
  if (!r.ok) return r
  const lecture = lectureDepuisCorpsQr(r.corps)
  return lecture ? { ok: true, lecture } : { ok: false, code: 'serveur' }
}

/** D-P2 : « Ne plus recevoir les informations sur cet immeuble ». */
export async function opposerDesinscriptionQr(
  jeton: string, identifiant: string, fetchImpl: Fetch = fetch,
): Promise<{ ok: true; levable: boolean } | EchecDesinscriptionQr> {
  const r = await poster(fetchImpl, '', { jeton, identifiant })
  if (!r.ok) return r
  const c = (typeof r.corps === 'object' && r.corps !== null ? r.corps : {}) as Record<string, unknown>
  return c.oppose === true ? { ok: true, levable: c.levable === true } : { ok: false, code: 'serveur' }
}

/** D-P3 : « Recevoir à nouveau ces informations ». */
export async function reprendreDesinscriptionQr(
  jeton: string, identifiant: string, fetchImpl: Fetch = fetch,
): Promise<{ ok: true } | EchecDesinscriptionQr> {
  const r = await poster(fetchImpl, '/reprendre', { jeton, identifiant })
  if (!r.ok) return r
  const c = (typeof r.corps === 'object' && r.corps !== null ? r.corps : {}) as Record<string, unknown>
  return c.oppose === false ? { ok: true } : { ok: false, code: 'serveur' }
}

/** D-P4 : repli d'un lien expiré par l'adresse saisie (réponse identique que l'adresse soit juste ou fausse). */
export async function opposerParAdresseDesinscriptionQr(
  jeton: string, identifiant: string, email: string, fetchImpl: Fetch = fetch,
): Promise<{ ok: true } | EchecDesinscriptionQr> {
  const r = await poster(fetchImpl, '/adresse', { jeton, identifiant, email })
  if (!r.ok) return r
  const c = (typeof r.corps === 'object' && r.corps !== null ? r.corps : {}) as Record<string, unknown>
  return c.ok === true ? { ok: true } : { ok: false, code: 'serveur' }
}
