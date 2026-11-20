// Pointage BTP « téléphone en poche » (appli Vitfix Pro ; demande de Frédéric du 17/11/2026, « Fait tout ») : le
// géorepérage du système (@capgo/background-geolocation) détecte l'entrée et la sortie de la zone d'un chantier, même
// appli fermée, et le code natif de l'appli envoie l'événement à POST /api/btp/pointage/evenement avec le jeton de ce
// téléphone. Seuls le chantier (identifiant de la zone), le sens (entrée ou sortie) et l'heure de détection partent ;
// jamais la position du téléphone.
//
// Règles pures (ni réseau ni base) ; les routes les appliquent. Tests : tests/lib/btp-pointage-arriere-plan.test.ts.

import { z } from 'zod'

/** Âge maximal d'un événement reçu : la file du téléphone le garde 7 jours, mais un passage de la veille ne pointe plus. */
export const AGE_MAX_EVENEMENT_MS = 12 * 3_600_000
/** Entrée puis sortie en moins de ce temps : un passage (voiture, livraison), pas une présence sur le chantier. */
export const PASSAGE_BREF_MS = 3 * 60_000
/**
 * Rayon minimal d'une zone surveillée par le système : en dessous, elle se déclenche mal (Google conseille 100 à
 * 150 m, l'iPhone signale vers 200 m). Le rayon du chantier (50 m possible) ne vaut que pour la page ouverte.
 */
export const RAYON_MIN_ZONE_SYSTEME_M = 150
/** Nombre maximal de zones qu'un iPhone surveille pour une appli (Android : 100). */
export const ZONES_MAX = 20

/** Événement envoyé par le code natif du module (GeofenceTransitionEvent) ; les autres champs sont ignorés. */
export const evenementSchema = z.object({
  identifier: z.string().uuid(),
  transition: z.enum(['enter', 'exit']),
  time: z.number().optional(),
})
export type EvenementZone = z.infer<typeof evenementSchema>

/**
 * Instant de l'événement : l'heure de détection donnée par le téléphone (sa file d'envoi peut la livrer bien plus
 * tard). Sans heure, ou heure future (horloge du téléphone en avance), celle de réception. null (événement ignoré) si
 * elle n'est pas un nombre fini ou si elle est plus vieille que AGE_MAX_EVENEMENT_MS.
 */
export function instantEvenement(time: number | undefined, maintenant: number): number | null {
  if (time === undefined) return maintenant
  if (!Number.isFinite(time) || maintenant - time > AGE_MAX_EVENEMENT_MS) return null
  return Math.min(maintenant, Math.round(time))
}

/** Au-delà de ce délai entre la détection et la réception, une arrivée porte une note pour le gérant. */
export const RETARD_NOTE_MS = 15 * 60_000

/**
 * Note d'une arrivée reçue longtemps après sa détection (téléphone sans réseau, envoi retenu) : le gérant voit l'écart
 * et vérifie, une heure d'arrivée ancienne pouvant aussi être forgée. null jusqu'à RETARD_NOTE_MS.
 */
export function noteArriveeTardive(instant: number, maintenant: number): string | null {
  const retard = maintenant - instant
  if (retard <= RETARD_NOTE_MS) return null
  return `Arrivée reçue ${Math.round(retard / 60_000)} min après sa détection par le téléphone (envoi retardé) : à vérifier.`
}

/** Jeton d'un téléphone : 32 octets aléatoires en base64url. Jamais conservé tel quel côté serveur. */
export function nouveauJeton(): string {
  const octets = new Uint8Array(32)
  crypto.getRandomValues(octets)
  let binaire = ''
  for (const octet of octets) binaire += String.fromCodePoint(octet)
  return btoa(binaire).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

/** Empreinte SHA-256 (hexadécimal) d'un jeton : seule forme conservée en base. */
export async function empreinteJeton(jeton: string): Promise<string> {
  const condensat = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(jeton))
  return Array.from(new Uint8Array(condensat), octet => octet.toString(16).padStart(2, '0')).join('')
}

/** Jeton porté par l'en-tête Authorization (« Bearer … », base64url de 32 à 128 caractères), sinon null. */
export function jetonDeLEnTete(entete: string | null): string | null {
  const trouve = /^Bearer\s+([\w-]{32,128})$/.exec(entete?.trim() ?? '')
  return trouve ? trouve[1] : null
}

/** Rayon de la zone du système pour un chantier : celui du chantier, jamais sous RAYON_MIN_ZONE_SYSTEME_M. */
export function rayonZoneSysteme(rayonChantierM: number): number {
  return Math.max(RAYON_MIN_ZONE_SYSTEME_M, Math.round(rayonChantierM))
}
