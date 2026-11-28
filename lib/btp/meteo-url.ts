// ── URL de prévisions Open-Meteo (section Météo chantier, côté BTP) ──────────
// Les coordonnées viennent de la base ou du géocodage : converties en nombre, bornées, puis
// placées en paramètres via URLSearchParams, jamais interpolées dans la chaîne de l'URL
// (Aikido : SSRF, une valeur contenant « & » ou « / » modifiait la requête sortante).

export const OPEN_METEO_FORECAST = 'https://api.open-meteo.com/v1/forecast'

const PARAMETRES_QUOTIDIENS = 'temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,weather_code'

function versNombre(valeur: unknown): number {
  if (typeof valeur === 'number') return valeur
  if (typeof valeur === 'string' && valeur.trim() !== '') return Number(valeur)
  return Number.NaN
}

/** Latitude dans [-90, 90] et longitude dans [-180, 180], toutes deux finies. */
export function coordonneesValides(lat: unknown, lng: unknown): { latitude: number; longitude: number } | null {
  const latitude = versNombre(lat)
  const longitude = versNombre(lng)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null
  return { latitude, longitude }
}

/** URL des prévisions à 7 jours pour un chantier, ou null si les coordonnées sont invalides. */
export function urlPrevisionsMeteo(lat: unknown, lng: unknown): string | null {
  const coords = coordonneesValides(lat, lng)
  if (!coords) return null
  const url = new URL(OPEN_METEO_FORECAST)
  url.searchParams.set('latitude', String(coords.latitude))
  url.searchParams.set('longitude', String(coords.longitude))
  url.searchParams.set('daily', PARAMETRES_QUOTIDIENS)
  url.searchParams.set('timezone', 'auto')
  url.searchParams.set('forecast_days', '7')
  return url.toString()
}
