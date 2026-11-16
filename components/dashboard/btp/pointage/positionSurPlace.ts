// « Placer à ma position actuelle » (onglet Affectations, demande de Frédéric du 16/11/2026) : le gérant, sur le
// chantier, pose le point GPS du chantier là où il se trouve, au lieu du point de l'adresse (numéro de la rue), qui
// peut être à plusieurs dizaines de mètres de l'endroit où travaillent les employés. Indispensable pour un rayon de
// déclenchement de 50 m.
//
// Mesure : surveillance haute précision ; la fenêtre de mesure part de la première lecture (le temps passé sur la
// demande d'autorisation du navigateur ne compte pas) ; la lecture la plus précise est gardée ; la mesure s'arrête
// dès qu'une lecture atteint PRECISION_VISEE_M. Une position moins précise que PRECISION_MAX_PLACEMENT_M est refusée :
// elle décalerait le centre du cercle de déclenchement d'autant. La position mesurée ne sert qu'à placer le chantier ;
// rien d'autre n'est gardé.
// Tests : tests/components/btp-position-sur-place.test.ts et tests/components/btp-pointage-ecran.test.tsx.

import { haversineDistance } from '@/lib/geo'
import { coordonneesValides } from '@/lib/btp/pointage-geo'

/** Précision au-delà de laquelle (en moins bien) le chantier n'est pas placé : la moitié du plus petit rayon proposé. */
export const PRECISION_MAX_PLACEMENT_M = 25
/** Précision qui suffit pour conclure tout de suite. */
export const PRECISION_VISEE_M = 10
/** Fenêtre de mesure, à partir de la première lecture. */
export const DUREE_MESURE_MS = 15_000
/** Attente maximale d'une première lecture (demande d'autorisation, GPS qui démarre). */
export const DUREE_MAX_ATTENTE_MS = 60_000
/** Écart avec la position enregistrée au-delà duquel la confirmation alerte (gérant sans doute pas sur ce chantier). */
export const ECART_ALERTE_M = 1000

export interface MesurePosition {
  latitude: number
  longitude: number
  precisionM: number
}

export type RaisonSansMesure = 'indisponible' | 'refusee' | 'introuvable' | 'imprecise'

export type ResultatMesure =
  | { ok: true; mesure: MesurePosition }
  | { ok: false; raison: RaisonSansMesure; precisionM?: number }

/** Code de l'erreur « autorisation refusée » de l'API de géolocalisation. */
const AUTORISATION_REFUSEE = 1

/** Mesure la position du téléphone pour y placer un chantier. Ne rejette jamais : le résultat dit pourquoi elle manque. */
export function mesurerPositionSurPlace(geo: Geolocation | undefined): Promise<ResultatMesure> {
  if (!geo || typeof geo.watchPosition !== 'function') return Promise.resolve({ ok: false, raison: 'indisponible' })

  return new Promise<ResultatMesure>(resolve => {
    let meilleure: MesurePosition | null = null
    let fini = false
    let surveillance: number | null = null
    let minuteurMesure: ReturnType<typeof setTimeout> | null = null

    const terminer = (resultat: ResultatMesure) => {
      if (fini) return
      fini = true
      clearTimeout(minuteurAttente)
      if (minuteurMesure !== null) clearTimeout(minuteurMesure)
      if (surveillance !== null) geo.clearWatch(surveillance)
      resolve(resultat)
    }
    const conclure = () => {
      if (meilleure === null) terminer({ ok: false, raison: 'introuvable' })
      else if (meilleure.precisionM > PRECISION_MAX_PLACEMENT_M) terminer({ ok: false, raison: 'imprecise', precisionM: meilleure.precisionM })
      else terminer({ ok: true, mesure: meilleure })
    }
    const minuteurAttente = setTimeout(conclure, DUREE_MAX_ATTENTE_MS)

    surveillance = geo.watchPosition(
      position => {
        const { latitude, longitude, accuracy } = position.coords
        if (fini || !coordonneesValides(latitude, longitude) || !Number.isFinite(accuracy) || accuracy < 0) return
        if (meilleure === null || accuracy < meilleure.precisionM) meilleure = { latitude, longitude, precisionM: accuracy }
        minuteurMesure ??= setTimeout(conclure, DUREE_MESURE_MS)
        if (accuracy <= PRECISION_VISEE_M) conclure()
      },
      erreur => {
        // Position indisponible ou délai dépassé pour une lecture : la mesure continue jusqu'à son terme.
        if (erreur.code === AUTORISATION_REFUSEE) terminer({ ok: false, raison: 'refusee' })
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: DUREE_MESURE_MS },
    )
    // Lecture ou refus arrivés pendant l'appel lui-même : la surveillance n'était pas encore connue de terminer().
    if (fini) geo.clearWatch(surveillance)
  })
}

/** Écart en mètres entre la position mesurée et la position enregistrée du chantier ; null si celle-ci manque. */
export function ecartAvecPositionEnregistreeM(mesure: MesurePosition, latitude: unknown, longitude: unknown): number | null {
  if (!coordonneesValides(latitude, longitude)) return null
  return Math.round(haversineDistance(mesure.latitude, mesure.longitude, latitude as number, longitude as number) * 1000)
}

/** Coordonnée enregistrée au millionième de degré (une dizaine de centimètres). */
export function arrondiCoordonnee(valeur: number): number {
  return Math.round(valeur * 1e6) / 1e6
}
