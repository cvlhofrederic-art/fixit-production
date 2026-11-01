/**
 * Jeton de session de suivi GPS (bucket Storage « tracking », objet {token}.json, écrit et relu en
 * service role). Le seul générateur est l'application mobile (app/(commun)/pro/mobile/page.tsx) :
 *
 *   `TRK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
 *
 * soit « TRK- », l'horodatage en base 36 (8 caractères de 1972 à 2059), « - », puis 1 à 4 caractères
 * en base 36 (Math.random() peut en produire moins de 4). Chiffres et majuscules seulement : aucun
 * « / », « . », « \ » ni encodage possible, le jeton sert de nom d'objet tel quel.
 *
 * L'ancien motif UUID v4 de /api/tracking/[token] ne correspondait à aucun jeton émis (toute lecture
 * répondait 400) ; il est remplacé par ce motif, calqué sur le générateur.
 */
export const TRACKING_TOKEN_PATTERN = /^TRK-[0-9A-Z]{8}-[0-9A-Z]{1,4}$/

export function tokenSuiviValide(value: unknown): value is string {
  return typeof value === 'string' && TRACKING_TOKEN_PATTERN.test(value)
}
