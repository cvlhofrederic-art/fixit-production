// « Placer à ma position actuelle » (onglet Affectations, demande de Frédéric du 16/11/2026) : le gérant, sur le
// chantier, pose le point GPS du chantier là où il se trouve, au lieu du point de l'adresse (numéro de la rue), qui
// peut être à plusieurs dizaines de mètres de l'endroit où travaillent les employés. Indispensable pour un rayon de
// déclenchement de 50 m.
//
// Mesure : surveillance haute précision. La fenêtre de mesure (DUREE_MESURE_MS) s'ouvre à la première lecture assez
// précise : ni le temps de la demande d'autorisation ni une première position par antenne (GPS à froid) ne la
// consomment ; une fois ouverte, le plafond DUREE_MAX_ATTENTE_MS ne la coupe plus. La lecture la plus précise est
// gardée ; la mesure s'arrête dès qu'une lecture atteint PRECISION_VISEE_M. Sans lecture assez précise au bout de
// DUREE_MAX_ATTENTE_MS, refus avec la meilleure précision obtenue. Une position moins précise que
// PRECISION_MAX_PLACEMENT_M décalerait d'autant le centre du cercle de déclenchement. La position mesurée ne sert qu'à
// placer le chantier ; rien d'autre n'est gardé.
// Tests : tests/components/btp-position-sur-place.test.ts et tests/components/btp-pointage-ecran.test.tsx.

import { haversineDistance } from '@/lib/geo'
import { coordonneesValides } from '@/lib/btp/pointage-geo'

/** Précision au-delà de laquelle (en moins bien) le chantier n'est pas placé : la moitié du plus petit rayon proposé. */
export const PRECISION_MAX_PLACEMENT_M = 25
/** Précision qui suffit pour conclure tout de suite. */
export const PRECISION_VISEE_M = 10
/** Fenêtre de mesure, à partir de la première lecture assez précise. */
export const DUREE_MESURE_MS = 15_000
/** Attente maximale d'une première lecture assez précise (autorisation, GPS qui démarre). */
export const DUREE_MAX_ATTENTE_MS = 60_000
/** Écart avec le repère du chantier au-delà duquel la confirmation alerte (gérant sans doute pas sur ce chantier). */
export const ECART_ALERTE_M = 1000
/** Au-delà, la lecture vient d'une localisation approximative accordée au navigateur, pas d'un GPS gêné. */
export const PRECISION_APPROXIMATIVE_M = 1000

export interface MesurePosition {
  latitude: number
  longitude: number
  precisionM: number
}

export type RaisonSansMesure = 'indisponible' | 'refusee' | 'introuvable' | 'imprecise' | 'annulee'

export type ResultatMesure =
  | { ok: true; mesure: MesurePosition }
  | { ok: false; raison: RaisonSansMesure; precisionM?: number }

/** Écart entre la position mesurée et le repère du chantier : sa position enregistrée, sinon son adresse géocodée. */
export interface EcartPlacement {
  metres: number
  reference: 'position' | 'adresse'
}

/** Code de l'erreur « autorisation refusée » de l'API de géolocalisation. */
const AUTORISATION_REFUSEE = 1

interface Mesure {
  geo: Geolocation
  resoudre: (resultat: ResultatMesure) => void
  meilleure: MesurePosition | null
  fini: boolean
  surveillance: number | null
  minuteurAttente: ReturnType<typeof setTimeout> | null
  minuteurMesure: ReturnType<typeof setTimeout> | null
  signal: AbortSignal | undefined
  surAbandon: () => void
}

function terminer(m: Mesure, resultat: ResultatMesure): void {
  if (m.fini) return
  m.fini = true
  if (m.minuteurAttente !== null) clearTimeout(m.minuteurAttente)
  if (m.minuteurMesure !== null) clearTimeout(m.minuteurMesure)
  if (m.surveillance !== null) m.geo.clearWatch(m.surveillance)
  m.signal?.removeEventListener('abort', m.surAbandon)
  m.resoudre(resultat)
}

function conclure(m: Mesure): void {
  const meilleure = m.meilleure
  if (meilleure === null) terminer(m, { ok: false, raison: 'introuvable' })
  else if (meilleure.precisionM > PRECISION_MAX_PLACEMENT_M) terminer(m, { ok: false, raison: 'imprecise', precisionM: meilleure.precisionM })
  else terminer(m, { ok: true, mesure: meilleure })
}

/** Lecture exploitable : coordonnées valables (ni (0, 0) ni hors bornes) et précision annoncée positive. */
function lectureExploitable(position: GeolocationPosition): MesurePosition | null {
  const { latitude, longitude, accuracy } = position.coords
  if (!coordonneesValides(latitude, longitude) || !Number.isFinite(accuracy) || accuracy < 0) return null
  return { latitude, longitude, precisionM: accuracy }
}

function recevoirLecture(m: Mesure, position: GeolocationPosition): void {
  const lecture = lectureExploitable(position)
  if (m.fini || lecture === null) return
  if (m.meilleure === null || lecture.precisionM < m.meilleure.precisionM) m.meilleure = lecture
  if (m.minuteurMesure === null && lecture.precisionM <= PRECISION_MAX_PLACEMENT_M) {
    if (m.minuteurAttente !== null) clearTimeout(m.minuteurAttente)
    m.minuteurAttente = null
    m.minuteurMesure = setTimeout(() => conclure(m), DUREE_MESURE_MS)
  }
  if (lecture.precisionM <= PRECISION_VISEE_M) conclure(m)
}

function recevoirErreur(m: Mesure, erreur: GeolocationPositionError): void {
  // Position indisponible ou délai dépassé pour une lecture : la mesure continue jusqu'à son terme.
  if (erreur.code === AUTORISATION_REFUSEE) terminer(m, { ok: false, raison: 'refusee' })
}

/**
 * Mesure la position du téléphone pour y placer un chantier. Ne rejette jamais : le résultat dit pourquoi elle manque.
 * `signal` arrête la mesure (onglet quitté) : résultat « annulee », surveillance coupée.
 */
export function mesurerPositionSurPlace(geo: Geolocation | undefined, signal?: AbortSignal): Promise<ResultatMesure> {
  if (!geo || typeof geo.watchPosition !== 'function') return Promise.resolve({ ok: false, raison: 'indisponible' })
  if (signal?.aborted) return Promise.resolve({ ok: false, raison: 'annulee' })

  return new Promise<ResultatMesure>(resoudre => {
    const m: Mesure = {
      geo, resoudre, signal,
      meilleure: null, fini: false, surveillance: null, minuteurAttente: null, minuteurMesure: null,
      surAbandon: () => terminer(m, { ok: false, raison: 'annulee' }),
    }
    m.minuteurAttente = setTimeout(() => conclure(m), DUREE_MAX_ATTENTE_MS)
    signal?.addEventListener('abort', m.surAbandon, { once: true })
    m.surveillance = geo.watchPosition(
      position => recevoirLecture(m, position),
      erreur => recevoirErreur(m, erreur),
      { enableHighAccuracy: true, maximumAge: 0, timeout: DUREE_MESURE_MS },
    )
    // Lecture ou refus arrivés pendant l'appel lui-même : la surveillance n'était pas encore connue de terminer().
    if (m.fini) geo.clearWatch(m.surveillance)
  })
}

/** Écart en mètres entre la position mesurée et un point ; null si ce point n'est pas une position valable. */
export function ecartAvecPositionEnregistreeM(mesure: MesurePosition, latitude: unknown, longitude: unknown): number | null {
  if (!coordonneesValides(latitude, longitude)) return null
  return Math.round(haversineDistance(mesure.latitude, mesure.longitude, latitude as number, longitude as number) * 1000)
}

/** Coordonnée enregistrée au millionième de degré (une dizaine de centimètres). */
export function arrondiCoordonnee(valeur: number): number {
  return Math.round(valeur * 1e6) / 1e6
}
