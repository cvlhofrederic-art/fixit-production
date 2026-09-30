/** Position GPS en degrés décimaux. */
export interface PositionGps {
  lat: number
  lng: number
}

/** Distance à vol d'oiseau (formule de haversine, rayon terrestre 6 371 km), arrondie au mètre. */
export const distanceHaversineMetres = (depart: PositionGps, arrivee: PositionGps): number => {
  const enRadians = (degres: number) => (degres * Math.PI) / 180,
    ecartLatitude = enRadians(arrivee.lat - depart.lat),
    ecartLongitude = enRadians(arrivee.lng - depart.lng),
    h =
      Math.sin(ecartLatitude / 2) ** 2 +
      Math.cos(enRadians(depart.lat)) * Math.cos(enRadians(arrivee.lat)) * Math.sin(ecartLongitude / 2) ** 2
  return Math.round(2 * 6371e3 * Math.asin(Math.sqrt(h)))
}
