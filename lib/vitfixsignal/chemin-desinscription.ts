// ── Vitfix Signal — diffusion : adresses des routes publiques de désinscription (PR 3, lot 6) ─────────────────────
//
// Cahier PR 3 § 4.1 (D-P1 à D-P5b), § 8.2 (CSRF), décision F3 : le POST « un clic » de l'en-tête List-Unsubscribe-Post
// (RFC 8058) est envoyé par la messagerie de la personne ; un service qui l'envoie depuis une page web porte un Origin
// étranger (ou « null »), que le contrôle d'Origin du middleware refuserait (403) : l'opposition serait perdue. Ce SEUL
// POST, pour un jeton au format exact, en est exempté ; son effet est borné par le jeton signé (une opposition,
// idempotente) et la route vérifie la signature avant tout. Tout autre POST, PATCH, PUT ou DELETE sur /api/ reste soumis
// au contrôle.
//
// Module pur, sans dépendance serveur : importé par le middleware (edge) et les tests.

import { ANCIEN_PREFIXE_API_QR } from '@/lib/vitfixsignal/ancien-nom'
import { FORMAT_JETON_DIFFUSION_QR } from '@/lib/vitfixsignal/diffusion-lien'

/** Préfixe des routes publiques de désinscription (D-P1 à D-P5b). */
export const CHEMIN_API_DESINSCRIPTION_QR = '/api/vitfixsignal/desinscription'

/**
 * Préfixes de l'adresse un clic (en-tête List-Unsubscribe, lib/vitfixsignal/diffusion-lien.ts) : l'adresse actuelle et
 * celle des messages envoyés avant le renommage du produit, réécrite vers la même route par next.config.ts (transition :
 * lib/vitfixsignal/ancien-nom.ts, bloc B). Le middleware voit le chemin d'ORIGINE : il doit reconnaître les deux.
 */
const PREFIXES_UN_CLIC: readonly string[] = [
  `${CHEMIN_API_DESINSCRIPTION_QR}/un-clic/`,
  `${ANCIEN_PREFIXE_API_QR}/desinscription/un-clic/`,
]

/**
 * Requête exemptée du contrôle d'Origin : POST sur /api/vitfixsignal/desinscription/un-clic/<jeton> (ou sur la même
 * adresse sous l'ancien préfixe des routes), jeton au format exact (32 hex, un point, 64 hex), barre finale facultative.
 * Sensible à la casse, aucun sous-chemin.
 */
export function estPostUnClicDesinscriptionQr(methode: string, pathname: string): boolean {
  if (methode !== 'POST') return false
  const prefixe = PREFIXES_UN_CLIC.find((p) => pathname.startsWith(p))
  if (prefixe === undefined) return false
  const reste = pathname.slice(prefixe.length)
  const jeton = reste.endsWith('/') ? reste.slice(0, -1) : reste
  return FORMAT_JETON_DIFFUSION_QR.test(jeton)
}
