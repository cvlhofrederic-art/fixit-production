// ── Geolocation utilities ────────────────────────────────────────────────────
// Haversine distance calculation + reverse geocoding for FR and PT

/**
 * Calculate distance in km between two GPS coordinates (Haversine formula)
 */
export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6371 // Earth radius in km
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180)
}

/**
 * Detect country from GPS coordinates (rough bounding boxes)
 * Returns 'FR' for France (including DOM-TOM), 'PT' for Portugal, null otherwise
 */
export function detectCountryFromCoords(lat: number, lng: number): 'FR' | 'PT' | null {
  // Portugal continental
  if (lat >= 36.9 && lat <= 42.2 && lng >= -9.6 && lng <= -6.1) return 'PT'
  // Azores
  if (lat >= 36.5 && lat <= 40.0 && lng >= -31.5 && lng <= -24.5) return 'PT'
  // Madeira
  if (lat >= 32.0 && lat <= 33.5 && lng >= -17.5 && lng <= -15.5) return 'PT'
  // France métropolitaine
  if (lat >= 41.0 && lat <= 51.5 && lng >= -5.5 && lng <= 10.0) return 'FR'
  // DOM-TOM (Guadeloupe, Martinique, Guyane, Réunion, Mayotte)
  if (lat >= 15.5 && lat <= 16.6 && lng >= -62.0 && lng <= -60.5) return 'FR' // Guadeloupe
  if (lat >= 14.2 && lat <= 15.0 && lng >= -61.5 && lng <= -60.5) return 'FR' // Martinique
  if (lat >= 2.0 && lat <= 6.0 && lng >= -55.0 && lng <= -51.0) return 'FR'  // Guyane
  if (lat >= -21.5 && lat <= -20.5 && lng >= 55.0 && lng <= 56.0) return 'FR' // Réunion
  return null
}

interface ReverseGeocodeResult {
  city: string
  postcode: string
  label: string
  country: 'FR' | 'PT'
}

/**
 * Reverse geocode coordinates to city name.
 * Uses api-adresse.data.gouv.fr for France, Nominatim for Portugal.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult | null> {
  const country = detectCountryFromCoords(lat, lng)

  if (country === 'FR') {
    return reverseGeocodeFR(lat, lng)
  }

  if (country === 'PT') {
    return reverseGeocodePT(lat, lng)
  }

  // Try both, France first (more specific API)
  const fr = await reverseGeocodeFR(lat, lng)
  if (fr) return fr
  return reverseGeocodePT(lat, lng)
}

async function reverseGeocodeFR(lat: number, lng: number): Promise<ReverseGeocodeResult | null> {
  try {
    const res = await fetch(
      `https://api-adresse.data.gouv.fr/reverse/?lon=${lng}&lat=${lat}`,
      { signal: AbortSignal.timeout(5000) },
    )
    if (!res.ok) return null
    const data = await res.json()
    const feature = data?.features?.[0]
    if (!feature) return null
    const city = feature.properties?.city || feature.properties?.municipality || ''
    const postcode = feature.properties?.postcode || ''
    return {
      city,
      postcode,
      label: city ? `${city} (${postcode})` : postcode,
      country: 'FR',
    }
  } catch {
    return null
  }
}

async function reverseGeocodePT(lat: number, lng: number): Promise<ReverseGeocodeResult | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=pt&countrycodes=pt`,
      {
        headers: { 'User-Agent': 'Vitfix/1.0' },
        signal: AbortSignal.timeout(5000),
      },
    )
    if (!res.ok) return null
    const data = await res.json()
    const city = data?.address?.city || data?.address?.town || data?.address?.village || ''
    const postcode = data?.address?.postcode || ''
    return {
      city,
      postcode,
      label: city ? `${city} (${postcode})` : postcode,
      country: 'PT',
    }
  } catch {
    return null
  }
}

/**
 * Format distance for display
 */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  if (km < 10) return `${km.toFixed(1)} km`
  return `${Math.round(km)} km`
}
