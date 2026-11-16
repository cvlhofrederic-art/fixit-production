// Position GPS d'une adresse de chantier (fiche chantier, écran Pointage › Affectations).
//
// France : Base Adresse Nationale (api-adresse.data.gouv.fr), puis OpenStreetMap (Nominatim) si elle ne trouve rien.
// Portugal : Nominatim limité au Portugal — la BAN ne connaît que la France et rendait, pour une adresse portugaise,
// le résultat français le plus ressemblant (chantier placé en France : le pointage automatique ne se déclenchait pas).
// Les deux services sont autorisés par la CSP (lib/securite/csp.ts, connect-src).

const DELAI_MS = 3000

export interface PositionAdresse {
  latitude: number
  longitude: number
}

function positionValide(latitude: unknown, longitude: unknown): PositionAdresse | null {
  const lat = typeof latitude === 'string' ? Number.parseFloat(latitude) : latitude
  const lng = typeof longitude === 'string' ? Number.parseFloat(longitude) : longitude
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { latitude: lat, longitude: lng }
}

async function parBaseAdresseNationale(adresse: string): Promise<PositionAdresse | null> {
  const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(adresse)}&limit=1`, {
    signal: AbortSignal.timeout(DELAI_MS),
  })
  if (!res.ok) return null
  const data = await res.json() as { features?: Array<{ geometry?: { coordinates?: [number, number] } }> }
  const coordonnees = data.features?.[0]?.geometry?.coordinates
  return coordonnees ? positionValide(coordonnees[1], coordonnees[0]) : null
}

async function parNominatim(adresse: string, pays: 'fr' | 'pt'): Promise<PositionAdresse | null> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(adresse)}&format=json&limit=1&countrycodes=${pays}`,
    { signal: AbortSignal.timeout(DELAI_MS) },
  )
  if (!res.ok) return null
  const data = await res.json() as Array<{ lat?: string; lon?: string }>
  return data.length > 0 ? positionValide(data[0].lat, data[0].lon) : null
}

/** Position de l'adresse, ou null (introuvable, service injoignable ou trop lent). Ne lève jamais. */
export async function geocoderAdresse(adresse: string, pays: 'FR' | 'PT'): Promise<PositionAdresse | null> {
  const texte = adresse.trim()
  if (!texte) return null
  try {
    if (pays === 'PT') return await parNominatim(texte, 'pt')
    return (await parBaseAdresseNationale(texte)) ?? (await parNominatim(texte, 'fr'))
  } catch (erreur) {
    console.warn('[btp] géocodage de l’adresse impossible :', erreur instanceof Error ? erreur.message : erreur)
    return null
  }
}
