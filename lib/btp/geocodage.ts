// Position GPS d'une adresse de chantier (fiche chantier, Météo chantiers, écran Pointage › Affectations).
//
// France : Base Adresse Nationale (api-adresse.data.gouv.fr), puis OpenStreetMap (Nominatim) si elle ne trouve rien.
// Portugal : Nominatim limité au Portugal — la BAN ne connaît que la France et rendait, pour une adresse portugaise,
// le résultat français le plus ressemblant (chantier placé en France : le pointage automatique ne se déclenchait pas).
// `precise` : le résultat est un numéro ou une rue. Sinon c'est le centre d'une commune ou d'un quartier, assez bon
// pour la météo mais pas pour déclencher un pointage dans un rayon de 100 m : on ne l'enregistre pas dans la fiche.
// Les deux services sont autorisés par la CSP (lib/securite/csp.ts, connect-src).

const DELAI_MS = 3000
/** BAN : en dessous de ce score, le résultat ne correspond pas vraiment à l'adresse saisie. */
const SCORE_MIN_BAN = 0.5
/** Nominatim : rang 26 = rue, 28 à 30 = numéro, bâtiment ; en dessous, quartier, commune, région. */
const RANG_MIN_NOMINATIM = 26

export interface PositionAdresse {
  latitude: number
  longitude: number
  precise: boolean
}

function position(latitude: unknown, longitude: unknown, precise: boolean): PositionAdresse | null {
  const lat = typeof latitude === 'string' ? Number.parseFloat(latitude) : latitude
  const lng = typeof longitude === 'string' ? Number.parseFloat(longitude) : longitude
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { latitude: lat, longitude: lng, precise }
}

interface ReponseBan {
  features?: Array<{ geometry?: { coordinates?: [number, number] }; properties?: { type?: string; score?: number } }>
}

async function parBaseAdresseNationale(adresse: string): Promise<PositionAdresse | null> {
  const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(adresse)}&limit=1`, {
    signal: AbortSignal.timeout(DELAI_MS),
  })
  if (!res.ok) return null
  const premier = (await res.json() as ReponseBan).features?.[0]
  const coordonnees = premier?.geometry?.coordinates
  if (!coordonnees) return null
  const { type, score } = premier.properties ?? {}
  const precise = (type === 'housenumber' || type === 'street') && typeof score === 'number' && score >= SCORE_MIN_BAN
  return position(coordonnees[1], coordonnees[0], precise)
}

async function parNominatim(adresse: string, pays: 'fr' | 'pt'): Promise<PositionAdresse | null> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(adresse)}&format=jsonv2&limit=1&countrycodes=${pays}`,
    { signal: AbortSignal.timeout(DELAI_MS) },
  )
  if (!res.ok) return null
  const data = await res.json() as Array<{ lat?: string; lon?: string; place_rank?: number }>
  if (data.length === 0) return null
  return position(data[0].lat, data[0].lon, typeof data[0].place_rank === 'number' && data[0].place_rank >= RANG_MIN_NOMINATIM)
}

/** Position de l'adresse, ou null (introuvable, service injoignable ou trop lent). Ne lève jamais. */
export async function geocoderAdresse(adresse: string, pays: 'FR' | 'PT'): Promise<PositionAdresse | null> {
  const texte = adresse.trim()
  if (!texte) return null
  try {
    if (pays === 'PT') return await parNominatim(texte, 'pt')
    const ban = await parBaseAdresseNationale(texte)
    if (ban?.precise) return ban
    // BAN imprécise ou muette : Nominatim peut connaître l'adresse exacte ; sinon on garde la meilleure réponse.
    const osm = await parNominatim(texte, 'fr')
    return osm?.precise ? osm : (ban ?? osm)
  } catch (erreur) {
    console.warn('[btp] géocodage de l’adresse impossible :', erreur instanceof Error ? erreur.message : erreur)
    return null
  }
}

/** Adresse complète d'un chantier (rue, code postal, ville), pour géocoder plus finement que la seule ville. */
export function adresseComplete(chantier: { adresse?: string | null; codePostal?: string | null; ville?: string | null }): string {
  return [chantier.adresse, chantier.codePostal, chantier.ville].map(p => (p ?? '').trim()).filter(Boolean).join(' ')
}

/** Lien OpenStreetMap vers une position, pour que le gérant vérifie d'un coup d'œil où est placé le chantier. */
export function lienCarte(latitude: number, longitude: number): string {
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=18/${latitude}/${longitude}`
}
