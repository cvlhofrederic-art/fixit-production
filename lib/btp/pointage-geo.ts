// Pointage géolocalisé BTP — détection de l'arrivée et du départ d'un chantier, logique pure (ni navigateur ni réseau).
//
// Modèle : le « Pointage terrain » de l'Administrateur judiciaire et l'ancien écran Pointage du Syndic. Le pointage
// démarre quand le téléphone entre dans le rayon d'un chantier et s'arrête quand il en sort, page ouverte.
// La position et la distance restent sur le téléphone : seuls le chantier et l'instant partent au serveur
// (minimisation demandée par la CNIL et la CNPD pour la géolocalisation des salariés).
//
// Différences voulues avec le Syndic : une arrivée doit durer CONFIRMATION_ARRIVEE_MS (passer en voiture devant un
// chantier ne pointe pas) et un départ CONFIRMATION_DEPART_MS au-delà du rayon élargi (les sauts du GPS en bordure de
// zone ne coupent pas le pointage). Tests : tests/lib/btp-pointage-geo.test.ts.

import { haversineDistance } from '@/lib/geo'

/** Rayon appliqué quand le chantier n'en a pas de valable (valeur par défaut de la colonne geo_rayon_m). */
export const RAYON_PAR_DEFAUT_M = 100
/** Bornes du curseur « Rayon pointage GPS » de la fiche chantier. */
export const RAYON_MIN_M = 25
export const RAYON_MAX_M = 500
/** Rayons proposés dans l'écran des affectations, comme dans l'écran Pointage du Syndic. */
export const RAYONS_PROPOSES_M = [50, 100, 150, 200, 300, 500] as const
/** Une lecture moins précise que ce seuil (localisation par le réseau, intérieur d'un bâtiment) est ignorée. */
export const PRECISION_MAX_M = 150
/** Au-delà du rayon, marge minimale avant de considérer que le téléphone a quitté le chantier. */
export const MARGE_SORTIE_M = 30
/** Temps passé dans la zone avant de pointer l'arrivée. */
export const CONFIRMATION_ARRIVEE_MS = 30_000
/** Temps passé hors de la zone élargie avant de pointer le départ. */
export const CONFIRMATION_DEPART_MS = 60_000
/** Une lecture plus ancienne ne décide plus rien (téléphone en veille, GPS coupé). */
export const AGE_MAX_LECTURE_MS = 120_000

export interface ChantierPointable {
  id: string
  titre: string
  latitude: number
  longitude: number
  rayonM: number
}

export interface LecturePosition {
  lat: number
  lng: number
  /** Précision annoncée par le navigateur (mètres), null si inconnue. */
  precisionM: number | null
  /** Instant de la lecture (ms depuis l'époque). */
  horodatage: number
}

export interface EtatDetection {
  /** Chantier du pointage en cours, confirmé par le serveur ; null sans pointage en cours. */
  chantierActifId: string | null
  /** Chantier dans la zone duquel le téléphone est entré, en attente de la confirmation d'arrivée. */
  candidat: { chantierId: string; depuis: number } | null
  /** Première lecture hors de la zone élargie du chantier actif, en attente de la confirmation de départ. */
  horsZoneDepuis: number | null
}

/** `depuis` : instant de l'entrée dans la zone (arrivée) ou de la sortie (départ), à enregistrer comme heure. */
export type DecisionPointage =
  | { type: 'aucune' }
  | { type: 'arrivee'; chantierId: string; distanceM: number; depuis: number }
  | { type: 'depart'; chantierId: string; distanceM: number; depuis: number }

export interface OptionsDetection {
  confirmationArriveeMs?: number
  confirmationDepartMs?: number
}

export const ETAT_DETECTION_INITIAL: EtatDetection = { chantierActifId: null, candidat: null, horsZoneDepuis: null }

const AUCUNE: DecisionPointage = { type: 'aucune' }

/** Rayon d'un chantier borné à [RAYON_MIN_M, RAYON_MAX_M] ; RAYON_PAR_DEFAUT_M s'il n'est pas un nombre positif. */
export function rayonEffectifM(rayon: unknown): number {
  const valeur = typeof rayon === 'string' ? Number(rayon) : rayon
  if (typeof valeur !== 'number' || !Number.isFinite(valeur) || valeur <= 0) return RAYON_PAR_DEFAUT_M
  return Math.min(RAYON_MAX_M, Math.max(RAYON_MIN_M, Math.round(valeur)))
}

/** Coordonnées utilisables : nombres finis, latitude dans [-90, 90], longitude dans [-180, 180], pas le point (0, 0). */
export function coordonneesValides(latitude: unknown, longitude: unknown): boolean {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return false
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return false
  return !(latitude === 0 && longitude === 0)
}

/** Distance à vol d'oiseau entre une position et un chantier, arrondie au mètre. */
export function distanceAuChantierM(position: { lat: number; lng: number }, chantier: ChantierPointable): number {
  return Math.round(haversineDistance(position.lat, position.lng, chantier.latitude, chantier.longitude) * 1000)
}

/** Lecture récente, précise et aux coordonnées valables. */
export function lectureExploitable(lecture: LecturePosition | null, maintenant: number): lecture is LecturePosition {
  if (!lecture || !coordonneesValides(lecture.lat, lecture.lng)) return false
  if (!Number.isFinite(lecture.horodatage) || maintenant - lecture.horodatage > AGE_MAX_LECTURE_MS) return false
  return lecture.precisionM === null || (Number.isFinite(lecture.precisionM) && lecture.precisionM <= PRECISION_MAX_M)
}

/** Chantier le plus proche dont la position est dans le rayon, ou null. */
export function chantierDansLaZone(
  position: { lat: number; lng: number },
  chantiers: readonly ChantierPointable[],
): { chantier: ChantierPointable; distanceM: number } | null {
  let meilleur: { chantier: ChantierPointable; distanceM: number } | null = null
  for (const chantier of chantiers) {
    const distanceM = distanceAuChantierM(position, chantier)
    if (distanceM <= chantier.rayonM && (meilleur === null || distanceM < meilleur.distanceM)) {
      meilleur = { chantier, distanceM }
    }
  }
  return meilleur
}

/**
 * Fait avancer la détection d'une lecture de position (ou d'un battement d'horloge avec la dernière lecture).
 *
 * Sans pointage en cours : le chantier le plus proche dans la zone devient candidat ; l'arrivée est décidée quand il
 * l'est resté `confirmationArriveeMs`. Avec un pointage en cours : le départ est décidé quand le téléphone est resté
 * `confirmationDepartMs` au-delà du rayon + max(MARGE_SORTIE_M, précision). Un chantier actif absent de la liste
 * (sans position GPS, plus affecté) n'est jamais quitté automatiquement : l'employé termine à la main.
 * La décision se répète tant que l'appelant n'a pas mis à jour `chantierActifId` (après la réponse du serveur).
 */
export function evaluerDetection(
  etat: EtatDetection,
  lecture: LecturePosition | null,
  chantiers: readonly ChantierPointable[],
  maintenant: number,
  options: OptionsDetection = {},
): { etat: EtatDetection; decision: DecisionPointage } {
  const confirmationArrivee = options.confirmationArriveeMs ?? CONFIRMATION_ARRIVEE_MS
  const confirmationDepart = options.confirmationDepartMs ?? CONFIRMATION_DEPART_MS
  if (!lectureExploitable(lecture, maintenant)) return { etat, decision: AUCUNE }

  if (etat.chantierActifId !== null) {
    const actif = chantiers.find(c => c.id === etat.chantierActifId)
    if (!actif) return { etat: { ...etat, candidat: null, horsZoneDepuis: null }, decision: AUCUNE }
    const distanceM = distanceAuChantierM(lecture, actif)
    const seuilSortie = actif.rayonM + Math.max(MARGE_SORTIE_M, lecture.precisionM ?? 0)
    if (distanceM <= seuilSortie) return { etat: { ...etat, candidat: null, horsZoneDepuis: null }, decision: AUCUNE }
    const horsZoneDepuis = etat.horsZoneDepuis ?? maintenant
    const suivant: EtatDetection = { ...etat, candidat: null, horsZoneDepuis }
    if (maintenant - horsZoneDepuis >= confirmationDepart) {
      return { etat: suivant, decision: { type: 'depart', chantierId: actif.id, distanceM, depuis: horsZoneDepuis } }
    }
    return { etat: suivant, decision: AUCUNE }
  }

  const proche = chantierDansLaZone(lecture, chantiers)
  if (!proche) return { etat: { ...etat, candidat: null, horsZoneDepuis: null }, decision: AUCUNE }
  const candidat = etat.candidat?.chantierId === proche.chantier.id
    ? etat.candidat
    : { chantierId: proche.chantier.id, depuis: maintenant }
  const suivant: EtatDetection = { ...etat, candidat, horsZoneDepuis: null }
  if (maintenant - candidat.depuis >= confirmationArrivee) {
    return {
      etat: suivant,
      decision: { type: 'arrivee', chantierId: proche.chantier.id, distanceM: proche.distanceM, depuis: candidat.depuis },
    }
  }
  return { etat: suivant, decision: AUCUNE }
}
