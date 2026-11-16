// Pointage géolocalisé BTP — détection de l'arrivée et du départ d'un chantier, logique pure (ni navigateur ni réseau).
//
// Modèle : le « Pointage terrain » de l'Administrateur judiciaire et l'ancien écran Pointage du Syndic. Le pointage
// démarre quand le téléphone entre dans le rayon d'un chantier et s'arrête quand il en sort, page ouverte.
// La position et la distance restent sur le téléphone : seuls le chantier et l'instant partent au serveur
// (minimisation demandée par la CNIL et la CNPD pour la géolocalisation des salariés).
//
// Différences voulues avec le Syndic : une arrivée doit durer CONFIRMATION_ARRIVEE_MS (passer en voiture devant un
// chantier ne pointe pas) et un départ CONFIRMATION_DEPART_MS au-delà du rayon élargi (les sauts du GPS en bordure de
// zone ne coupent pas le pointage). Un départ n'est pointé tout seul que s'il a été vu : après une coupure du suivi
// (page fermée, téléphone en veille), l'heure de sortie est inconnue et l'employé termine à la main. Après la fin d'un
// pointage, pas de nouvelle arrivée automatique sur ce chantier tant que le téléphone n'en est pas sorti.
// Tests : tests/lib/btp-pointage-geo.test.ts.

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
/** Temps passé hors de la zone élargie, vu par le téléphone, avant de pointer le départ. */
export const CONFIRMATION_DEPART_MS = 60_000
/**
 * Une lecture plus ancienne ne décide plus rien (téléphone en veille, GPS coupé) ; c'est aussi le plus long trou de
 * suivi toléré pour dater une sortie de chantier (l'heure retenue peut alors avoir jusqu'à ce retard).
 */
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
  /** Chantier du pointage automatique en cours, confirmé par le serveur ; null sans pointage automatique en cours. */
  chantierActifId: string | null
  /** Chantier dans la zone duquel le téléphone est entré, en attente de la confirmation d'arrivée. */
  candidat: { chantierId: string; depuis: number } | null
  /** Première lecture au-delà de la zone élargie du chantier actif, en attente de la confirmation de départ. */
  horsZoneDepuis: number | null
  /** Dernier instant où le téléphone a été vu hors de la zone depuis `horsZoneDepuis` (prolongé en suivi continu). */
  vuHorsZone: number | null
  /**
   * Dernier instant où le téléphone a été vu dans la zone élargie du chantier actif ; null si ce téléphone ne l'a pas vu
   * sur place (pointage commencé ailleurs, page rouverte sans trace).
   */
  derniereDansZone: number | null
  /**
   * Hors de la zone sans pouvoir dater la sortie (suivi coupé plus de AGE_MAX_LECTURE_MS, ou aucune présence connue) :
   * pas de départ automatique, l'écran demande de terminer le pointage à la main.
   */
  sortieSansTrace: boolean
  /**
   * Chantier dont le pointage vient de se terminer : pas de nouvelle arrivée automatique sur lui tant que le téléphone
   * n'a pas été vu hors de sa zone élargie (sinon une pause prise sur place repointerait l'arrivée 30 s plus tard).
   */
  chantierBloque: string | null
}

/** `depuis` : instant de l'entrée dans la zone (arrivée) ou de la sortie (départ), à enregistrer comme heure. */
export type DecisionPointage =
  | { type: 'aucune' }
  | { type: 'arrivee'; chantierId: string; distanceM: number; depuis: number }
  | { type: 'depart'; chantierId: string; distanceM: number; depuis: number }

export interface OptionsDetection {
  confirmationArriveeMs?: number
  confirmationDepartMs?: number
  /**
   * Vrai quand le téléphone est suivi sans coupure depuis la dernière position reçue (page visible, battements
   * réguliers) : sans nouvelle position, il n'a pas bougé, et ce qu'il a vu (sur place ou dehors) se prolonge jusqu'à
   * maintenant. Faux après une mise en veille : l'ancienne position ne prouve plus rien.
   */
  suiviContinu?: boolean
}

export const ETAT_DETECTION_INITIAL: EtatDetection = {
  chantierActifId: null,
  candidat: null,
  horsZoneDepuis: null,
  vuHorsZone: null,
  derniereDansZone: null,
  sortieSansTrace: false,
  chantierBloque: null,
}

/**
 * État après un changement du pointage en cours (serveur, arrivée confirmée, départ) : plus de candidat ni de sortie.
 * La présence n'a de sens qu'avec un pointage automatique en cours, le chantier bloqué que sans.
 */
export function etatPourPointage(
  chantierActifId: string | null,
  derniereDansZone: number | null = null,
  chantierBloque: string | null = null,
): EtatDetection {
  return {
    ...ETAT_DETECTION_INITIAL,
    chantierActifId,
    derniereDansZone: chantierActifId ? derniereDansZone : null,
    chantierBloque: chantierActifId ? null : chantierBloque,
  }
}

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

/** Seuil de sortie d'un chantier pour cette lecture : rayon + max(MARGE_SORTIE_M, précision annoncée). */
function seuilSortieM(chantier: ChantierPointable, lecture: LecturePosition): number {
  return chantier.rayonM + Math.max(MARGE_SORTIE_M, lecture.precisionM ?? 0)
}

/** Lecture précise, aux coordonnées et à l'horodatage valables (quel que soit son âge). */
function lecturePrecise(lecture: LecturePosition | null): lecture is LecturePosition {
  if (!lecture || !coordonneesValides(lecture.lat, lecture.lng) || !Number.isFinite(lecture.horodatage)) return false
  return lecture.precisionM === null || (Number.isFinite(lecture.precisionM) && lecture.precisionM <= PRECISION_MAX_M)
}

/** Lecture récente, précise et aux coordonnées valables. */
export function lectureExploitable(lecture: LecturePosition | null, maintenant: number): lecture is LecturePosition {
  return lecturePrecise(lecture) && maintenant - lecture.horodatage <= AGE_MAX_LECTURE_MS
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

/** Chantier toujours bloqué après cette lecture : plus aucun dès que le téléphone est vu hors de sa zone élargie. */
function chantierEncoreBloque(bloque: string | null, lecture: LecturePosition, chantiers: readonly ChantierPointable[]): string | null {
  if (bloque === null) return null
  const chantier = chantiers.find(c => c.id === bloque)
  // Chantier plus affecté ou sans position : plus rien à bloquer.
  if (!chantier || distanceAuChantierM(lecture, chantier) > seuilSortieM(chantier, lecture)) return null
  return bloque
}

/** Pointage automatique en cours : suit la présence sur le chantier et décide du départ (voir evaluerDetection). */
function evaluerDepart(
  etat: EtatDetection,
  lecture: LecturePosition | null,
  chantiers: readonly ChantierPointable[],
  maintenant: number,
  confirmationDepart: number,
  suiviContinu: boolean,
): { etat: EtatDetection; decision: DecisionPointage } {
  // Une position ancienne reste la dernière connue tant que le suivi n'a pas été coupé.
  const utilisable = suiviContinu ? lecturePrecise(lecture) : lectureExploitable(lecture, maintenant)
  if (!utilisable || lecture === null) return { etat, decision: AUCUNE }
  const actif = chantiers.find(c => c.id === etat.chantierActifId)
  if (!actif) return { etat: { ...etat, candidat: null, horsZoneDepuis: null, vuHorsZone: null, sortieSansTrace: false }, decision: AUCUNE }
  const distanceM = distanceAuChantierM(lecture, actif)
  // Instant jusqu'auquel la lecture renseigne : maintenant en suivi continu, sinon celui de la mesure. Jamais en
  // arrière : une vieille position relue après une coupure ne raccourcit pas ce qui est déjà connu.
  const vue = suiviContinu ? Math.max(maintenant, lecture.horodatage) : lecture.horodatage
  if (distanceM <= seuilSortieM(actif, lecture)) {
    const derniereDansZone = Math.max(etat.derniereDansZone ?? vue, vue)
    return {
      etat: { ...etat, candidat: null, horsZoneDepuis: null, vuHorsZone: null, derniereDansZone, sortieSansTrace: false },
      decision: AUCUNE,
    }
  }
  // Hors de la zone élargie. La sortie n'est datée que si le téléphone a été suivi sans trou de plus de
  // AGE_MAX_LECTURE_MS depuis sa dernière présence sur place, puis pendant toute la confirmation : sinon on ignore à
  // quelle heure l'employé est parti (et s'il est revenu entre-temps), et c'est à lui de terminer le pointage. Le
  // signal dure jusqu'à son retour sur place : la dernière présence ne bouge plus, l'écart ne fait que grandir.
  const precedente = etat.horsZoneDepuis === null ? etat.derniereDansZone : etat.vuHorsZone
  if (precedente === null || lecture.horodatage - precedente > AGE_MAX_LECTURE_MS) {
    return { etat: { ...etat, candidat: null, horsZoneDepuis: null, vuHorsZone: null, sortieSansTrace: true }, decision: AUCUNE }
  }
  const horsZoneDepuis = etat.horsZoneDepuis ?? lecture.horodatage
  const vuHorsZone = Math.max(etat.vuHorsZone ?? vue, vue)
  const suivant: EtatDetection = { ...etat, candidat: null, horsZoneDepuis, vuHorsZone, sortieSansTrace: false }
  if (vuHorsZone - horsZoneDepuis >= confirmationDepart) {
    return { etat: suivant, decision: { type: 'depart', chantierId: actif.id, distanceM, depuis: horsZoneDepuis } }
  }
  return { etat: suivant, decision: AUCUNE }
}

/**
 * Fait avancer la détection d'une lecture de position (ou d'un battement d'horloge avec la dernière lecture).
 *
 * Sans pointage automatique en cours : le chantier le plus proche dans la zone (hors chantier bloqué) devient candidat ;
 * l'arrivée est décidée quand il l'est resté `confirmationArriveeMs`. Avec un pointage automatique en cours : le départ
 * est décidé quand le téléphone a été vu `confirmationDepartMs` au-delà du rayon + max(MARGE_SORTIE_M, précision), et
 * daté de la première lecture dehors. Si le suivi a été coupé plus de AGE_MAX_LECTURE_MS (veille) entre la dernière
 * présence sur place et la sortie, ou pendant la confirmation, ou si aucune présence n'est connue, le départ n'est pas
 * pointé (`sortieSansTrace`) : l'employé termine à la main. Un chantier actif absent de la liste (sans position GPS,
 * plus affecté) n'est jamais quitté automatiquement.
 * La décision se répète tant que l'appelant n'a pas mis à jour `chantierActifId` (après la réponse du serveur).
 */
export function evaluerDetection(
  etat: EtatDetection,
  lecture: LecturePosition | null,
  chantiers: readonly ChantierPointable[],
  maintenant: number,
  options: OptionsDetection = {},
): { etat: EtatDetection; decision: DecisionPointage } {
  if (etat.chantierActifId !== null) {
    return evaluerDepart(etat, lecture, chantiers, maintenant, options.confirmationDepartMs ?? CONFIRMATION_DEPART_MS, options.suiviContinu === true)
  }

  // Arrivée : seulement sur une position récente.
  if (!lectureExploitable(lecture, maintenant)) return { etat, decision: AUCUNE }
  const confirmationArrivee = options.confirmationArriveeMs ?? CONFIRMATION_ARRIVEE_MS
  const chantierBloque = chantierEncoreBloque(etat.chantierBloque, lecture, chantiers)
  const proche = chantierDansLaZone(lecture, chantierBloque === null ? chantiers : chantiers.filter(c => c.id !== chantierBloque))
  if (!proche) {
    return { etat: { ...etat, candidat: null, horsZoneDepuis: null, vuHorsZone: null, sortieSansTrace: false, chantierBloque }, decision: AUCUNE }
  }
  const candidat = etat.candidat?.chantierId === proche.chantier.id
    ? etat.candidat
    : { chantierId: proche.chantier.id, depuis: maintenant }
  const suivant: EtatDetection = { ...etat, candidat, horsZoneDepuis: null, vuHorsZone: null, chantierBloque }
  if (maintenant - candidat.depuis >= confirmationArrivee) {
    return {
      etat: suivant,
      decision: { type: 'arrivee', chantierId: proche.chantier.id, distanceM: proche.distanceM, depuis: candidat.depuis },
    }
  }
  return { etat: suivant, decision: AUCUNE }
}
