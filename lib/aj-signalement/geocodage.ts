// ── Géocodage inverse : adresse proposée d'après la position d'un déclarant (serveur seulement) ──
//
// Demande de Hugo du 06/11/2026 : quand l'adresse d'une copropriété n'est pas renseignée, la position de la personne
// qui scanne le QR code sert seulement à proposer l'adresse. Le service appelé est celui de l'État :
//
//   https://data.geopf.fr/geocodage/reverse — Géoplateforme de l'IGN, qui reprend l'API Adresse de la Base Adresse
//   Nationale (BAN). Vérifié le 06/11/2026 sur la documentation officielle :
//     - guide : https://cartes.gouv.fr/aide/fr/guides-utilisateur/utiliser-les-services-de-la-geoplateforme/geocodage/
//     - description du service : https://data.geopf.fr/geocodage/getCapabilities (swagger : /geocodage/openapi)
//   L'ancienne adresse api-adresse.data.gouv.fr est dépréciée (« décommissionnée fin janvier 2026 »,
//   https://adresse.data.gouv.fr/outils/api-doc/adresse ; en-têtes sunset et x-api-new-host vers data.geopf.fr) :
//   ne pas l'utiliser ici.
//   Sans clé, 50 requêtes par seconde et par adresse IP (au-delà : 429). Les IP de sortie des Workers Cloudflare
//   sont partagées : un 429 vaut « adresse non trouvée ». Licence Ouverte etalab-2.0, CGU : https://cartes.gouv.fr/cgu/.
//
// La position n'est ni conservée, ni journalisée : arrondie à 5 décimales (environ 1 m) avant l'appel, absente des
// messages du logger, et l'appel sortant est exclu du traçage Sentry (son URL porte lat et lon). Ne lève jamais.

import * as Sentry from '@sentry/nextjs'
import { logger } from '@/lib/logger'

export const URL_GEOCODAGE_INVERSE = 'https://data.geopf.fr/geocodage/reverse'
/** Délai maximal de l'appel : au-delà, pas d'adresse proposée (la page ne bloque jamais). */
export const DELAI_GEOCODAGE_MS = 4000
export const DECIMALES_COORDONNEES_QR = 5
/** Même borne que l'adresse d'une copropriété (coproprieteQrSchema). */
export const LONGUEUR_ADRESSE_PROPOSEE_MAX = 300

const CONTEXTE = '[AJ SIGNALEMENT]'
const FACTEUR = 10 ** DECIMALES_COORDONNEES_QR

/** Coordonnée arrondie à 5 décimales (sans « -0 »). */
export const arrondirCoordonneeQr = (valeur: number): number => Math.round(valeur * FACTEUR) / FACTEUR || 0

const texte = (valeur: unknown): string => (typeof valeur === 'string' ? valeur.replace(/\s+/g, ' ').trim() : '')

/**
 * Libellé d'une adresse de la BAN (properties d'une feature) : « nom code-postal commune » ; « code-postal commune »
 * pour une commune entière. Le label du service n'est repris qu'en dernier recours, coupé à la première virgule : pour
 * une rue ou un lieu-dit, il porte un suffixe « ,Paris 4e Arrondissement ». null si rien n'est exploitable.
 */
export function libelleAdresseBan(properties: unknown): string | null {
  if (!properties || typeof properties !== 'object') return null
  const p = properties as Record<string, unknown>
  const commune = [texte(p.postcode), texte(p.city)].filter(Boolean).join(' ')
  const nom = texte(p.name)
  let libelle = ''
  if (p.type === 'municipality') libelle = commune || nom
  else if (nom && commune) libelle = `${nom} ${commune}`
  if (!libelle) libelle = texte(p.label).split(',')[0].trim()
  return libelle ? libelle.slice(0, LONGUEUR_ADRESSE_PROPOSEE_MAX).trim() : null
}

/** Adresse la plus proche de la position (latitude, longitude) d'après la BAN ; null en cas d'échec, jamais d'exception. */
export async function geocoderInverse(latitude: number, longitude: number, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  const parametres = new URLSearchParams({
    lon: String(arrondirCoordonneeQr(longitude)),
    lat: String(arrondirCoordonneeQr(latitude)),
    index: 'address',
    limit: '1',
  })
  try {
    const reponse = await Sentry.suppressTracing(() => fetchImpl(`${URL_GEOCODAGE_INVERSE}?${parametres.toString()}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(DELAI_GEOCODAGE_MS),
    }))
    if (!reponse.ok) {
      logger.warn(`${CONTEXTE} géocodage inverse indisponible`, { statut: reponse.status })
      return null
    }
    const corps: unknown = await reponse.json().catch(() => null)
    const features = corps && typeof corps === 'object' ? (corps as { features?: unknown }).features : undefined
    if (!Array.isArray(features)) {
      logger.warn(`${CONTEXTE} géocodage inverse : réponse illisible`, { statut: reponse.status })
      return null
    }
    const premiere: unknown = features[0]
    return premiere && typeof premiere === 'object' ? libelleAdresseBan((premiere as { properties?: unknown }).properties) : null
  } catch (e: unknown) {
    // Délai dépassé, réseau coupé : seul le nom de l'erreur est journalisé (son message pourrait citer l'URL, donc la position).
    const nom = e && typeof e === 'object' && typeof (e as { name?: unknown }).name === 'string' ? (e as { name: string }).name : 'inconnue'
    logger.warn(`${CONTEXTE} géocodage inverse indisponible`, { erreur: nom })
    return null
  }
}
