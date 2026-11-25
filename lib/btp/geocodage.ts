// Position GPS d'une adresse de chantier (fiche chantier, Météo chantiers, écran Pointage › Affectations).
//
// France : Base Adresse Nationale (api-adresse.data.gouv.fr), filtrée par le code postal quand il est connu ; si elle
// n'est pas assez sûre d'elle, une seconde fois avec la rue seule (sans résidence, bâtiment ni étage : rueSansComplements ;
// précise seulement sur le numéro et la voie saisis), puis OpenStreetMap (Nominatim) si elle ne trouve toujours rien de précis. Portugal : Nominatim limité au Portugal — la BAN ne
// connaît que la France et rendait, pour une adresse portugaise, le résultat français le plus ressemblant.
// `precise` : le résultat est le numéro ou la rue saisis, dans la commune saisie. Il faut donc une rue dans l'adresse,
// un code postal ou une ville pour vérifier la commune du résultat, et une BAN sûre d'elle (score). Sinon c'est le
// centre d'une commune, une rue homonyme dans une autre commune ou une rue voisine au nom ressemblant : assez bon pour
// la météo, pas pour déclencher un pointage dans un rayon de 100 m — on ne l'enregistre pas dans la fiche.
// Les deux services sont autorisés par la CSP (lib/securite/csp.ts, connect-src). Nominatim demande au plus une
// requête par seconde et des résultats mis en cache : les appels viennent d'un geste du gérant (bouton GPS, Localiser),
// et la page Météo garde ses résultats (MeteoChantierSection). Tests : tests/lib/btp-geocodage.test.ts.

const DELAI_MS = 3000
/** BAN : score minimal d'un numéro (il existe, dans une rue au nom proche, dans la commune saisie). */
const SCORE_MIN_NUMERO = 0.6
/** BAN : score minimal d'une rue sans numéro (en dessous : rue voisine au nom ressemblant, lieu-dit, lotissement). */
const SCORE_MIN_RUE = 0.8
/** Nominatim : rang 26 = rue, 28 à 30 = numéro, bâtiment ; en dessous, quartier, commune, région. */
const RANG_MIN_NOMINATIM = 26
/** La BAN refuse une recherche de plus de 200 caractères. */
const LONGUEUR_MAX_RECHERCHE = 200

export type Pays = 'FR' | 'PT'

export interface PositionAdresse {
  latitude: number
  longitude: number
  precise: boolean
}

/** Adresse telle que saisie : `adresse` peut contenir aussi le code postal et la ville (adresse d'un devis importé). */
export interface AdresseChantier {
  adresse?: string | null
  codePostal?: string | null
  ville?: string | null
}

interface AdresseDecomposee {
  rue: string
  codePostal: string
  ville: string
}

/** Code postal écrit dans l'adresse ; au Portugal, seulement la forme complète (« 1974 » peut être une année : 25 de Abril). */
const CODE_POSTAL: Record<Pays, RegExp> = { FR: /\b\d{5}\b/, PT: /\b\d{4}-\d{3}\b/ }

/** Nom de lieu comparable : sans accents ni casse, tirets et apostrophes en espaces, « St » et « Ste » en toutes lettres. */
export function normaliserLieu(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[-'’,.]/g, ' ')
    .replace(/\bste\b/g, 'sainte')
    .replace(/\bst\b/g, 'saint')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Rue, code postal et ville ; un code postal écrit dans l'adresse (et la ville qui le suit) en est extrait. */
export function decomposerAdresse(entree: AdresseChantier, pays: Pays): AdresseDecomposee {
  let rue = (entree.adresse ?? '').trim()
  let codePostal = (entree.codePostal ?? '').trim()
  let ville = (entree.ville ?? '').trim()
  const trouve = CODE_POSTAL[pays].exec(rue)
  if (trouve) {
    const suite = rue.slice(trouve.index + trouve[0].length).replace(/^[\s,]+/, '').trim()
    if (!codePostal) codePostal = trouve[0]
    if (!ville) ville = suite
    rue = rue.slice(0, trouve.index).replace(/[\s,]+$/, '').trim()
  }
  // La ville recopiée dans le champ de la rue n'est pas une rue.
  if (normaliserLieu(rue) === normaliserLieu(ville)) rue = ''
  return { rue, codePostal, ville }
}

/** Numéro de rue (« 10 », « 4 bis », « 12B ») suivi d'un nom, en tête d'un morceau d'adresse aux blancs réduits. */
const NUMERO_PUIS_NOM = /^(\d{1,4}(?: ?(?:bis|ter|quater|[a-d]))?) (\p{L}.*)$/iu
/** Premier mot d'un complément qui suit parfois un numéro (« 2 étage », « 3 bât. B ») : ce numéro n'est pas celui de la rue. */
const MOTS_COMPLEMENT = new Set(['etage', 'apt', 'app', 'appt', 'appartement', 'porte', 'bat', 'batiment', 'escalier', 'esc', 'bloc', 'lot', 'niveau', 'villa', 'case', 'bp', 'cs', 'n', 'bis', 'ter', 'quater'])
/** Abréviations courantes des types de voie, pour comparer la voie saisie à celle de la BAN. */
const ABREVIATIONS_VOIE: Record<string, string> = {
  r: 'rue', av: 'avenue', ave: 'avenue', bd: 'boulevard', bld: 'boulevard', bvd: 'boulevard', ch: 'chemin', chem: 'chemin',
  imp: 'impasse', pl: 'place', rte: 'route', all: 'allee', fg: 'faubourg', fbg: 'faubourg', sq: 'square', crs: 'cours',
  pass: 'passage', prom: 'promenade', trav: 'traverse', mte: 'montee', esp: 'esplanade',
}
const ARTICLES = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'l', 'd'])

/** Voie comparable : nom de lieu normalisé, abréviations en toutes lettres, sans articles (« Av. du Prado » = « Avenue du Prado »). */
const cleVoie = (voie: string) =>
  normaliserLieu(voie).split(' ').map(mot => ABREVIATIONS_VOIE[mot] ?? mot).filter(mot => !ARTICLES.has(mot)).join(' ')
const cleNumero = (numero: string) => numero.toLowerCase().replaceAll(' ', '')

/** Rue extraite d'une adresse à compléments : son numéro, sa voie, et le morceau tel qu'écrit (texte de la recherche). */
export interface RueSeule {
  numero: string
  voie: string
  texte: string
}

/**
 * La rue seule, sans le nom de résidence, d'immeuble, de bâtiment ni l'étage écrits autour (adresse importée d'un devis) :
 * la BAN trouve bien le numéro mais baisse alors son score sous le seuil (« Immeuble Le Méditerranée, 3 avenue du Prado » :
 * 0,52 contre 0,97 sans le nom de l'immeuble, relevé du 25/11/2026). Seulement un morceau (entre virgules, points-virgules
 * ou tirets) qui commence par le numéro : « Bât 3, avenue du Prado » ou « Lot 12, rue X » n'ont pas de numéro de rue, et
 * leur 3 ou leur 12 ne doit pas en devenir un. Null si l'adresse n'a qu'un morceau ou aucun morceau de ce genre.
 */
export function rueSansComplements(rue: string): RueSeule | null {
  const morceaux = rue.replaceAll(/\s+/g, ' ').split(/[,;]| - /).map(morceau => morceau.trim()).filter(Boolean)
  if (morceaux.length < 2) return null
  for (const morceau of morceaux) {
    const trouve = NUMERO_PUIS_NOM.exec(morceau)
    if (!trouve) continue
    const [, numero, voie] = trouve
    const premierMot = normaliserLieu(voie).split(' ')[0]
    if (!MOTS_COMPLEMENT.has(premierMot) && /\p{L}{3,}/u.test(voie)) return { numero, voie, texte: morceau }
  }
  return null
}

/** La BAN a-t-elle rendu exactement le numéro et la voie extraits (et pas un numéro voisin, une autre rue) ? */
function memeNumeroEtVoie(attendu: RueSeule, type: unknown, numero: unknown, voie: unknown): boolean {
  return type === 'housenumber'
    && typeof numero === 'string' && cleNumero(numero) === cleNumero(attendu.numero)
    && typeof voie === 'string' && cleVoie(voie) === cleVoie(attendu.voie)
}

/** Adresse avec une vraie rue (au moins un mot de trois lettres) : seule une telle adresse peut donner une position précise. */
function aUneRue(adresse: AdresseDecomposee): boolean {
  return /\p{L}{3,}/u.test(adresse.rue)
}

/**
 * Le résultat est-il dans la commune saisie ? Code postal identique (au Portugal, ses quatre premiers chiffres) s'il est
 * connu, et alors la ville saisie doit commencer comme l'une de celles du résultat (« Marseille 8e » = « Marseille ») ;
 * sans code postal, nom de commune identique. Sans l'un ni l'autre, impossible de vérifier : non.
 */
function memeCommune(attendu: AdresseDecomposee, pays: Pays, codePostal: unknown, villes: readonly unknown[]): boolean {
  const noms = villes.filter((v): v is string => typeof v === 'string' && v.trim() !== '').map(normaliserLieu)
  const ville = normaliserLieu(attendu.ville)
  if (attendu.codePostal) {
    const prefixe = pays === 'PT' ? attendu.codePostal.slice(0, 4) : attendu.codePostal
    if (typeof codePostal !== 'string' || !codePostal.trim().startsWith(prefixe)) return false
    return !ville || noms.some(nom => nom === ville || ville.startsWith(`${nom} `) || nom.startsWith(`${ville} `))
  }
  return ville !== '' && noms.includes(ville)
}

function position(latitude: unknown, longitude: unknown, precise: boolean): PositionAdresse | null {
  const lat = typeof latitude === 'string' ? Number.parseFloat(latitude) : latitude
  const lng = typeof longitude === 'string' ? Number.parseFloat(longitude) : longitude
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { latitude: lat, longitude: lng, precise }
}

const texteRecherche = (adresse: AdresseDecomposee) =>
  [adresse.rue, adresse.codePostal, adresse.ville].filter(Boolean).join(' ').slice(0, LONGUEUR_MAX_RECHERCHE)

interface ReponseBan {
  features?: Array<{
    geometry?: { coordinates?: [number, number] }
    properties?: { type?: string; score?: number; postcode?: string; city?: string; housenumber?: string; street?: string }
  }>
}

/** Score BAN suffisant pour ce type de résultat (numéro ou rue ; jamais une commune, un lieu-dit). */
function scoreBanSuffisant(type: unknown, score: unknown): boolean {
  if (typeof score !== 'number') return false
  if (type === 'housenumber') return score >= SCORE_MIN_NUMERO
  return type === 'street' && score >= SCORE_MIN_RUE
}

/**
 * `rueSeule` : seconde recherche, avec la rue extraite d'une adresse à compléments. Elle n'est précise que si la BAN
 * rend ce numéro dans cette voie : pas une rue entière (son centre n'est pas le bâtiment ou le lot que le gérant a
 * saisi), ni un numéro voisin ou une autre voie au nom ressemblant.
 */
async function parBaseAdresseNationale(adresse: AdresseDecomposee, rueSeule?: RueSeule): Promise<PositionAdresse | null> {
  const recherche = texteRecherche(adresse)
  if (recherche.length < 3) return null
  const filtre = /^\d{5}$/.test(adresse.codePostal) ? `&postcode=${adresse.codePostal}` : ''
  const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(recherche)}&limit=1${filtre}`, {
    signal: AbortSignal.timeout(DELAI_MS),
  })
  if (!res.ok) return null
  const premier = (await res.json() as ReponseBan).features?.[0]
  const coordonnees = premier?.geometry?.coordinates
  if (!coordonnees) return null
  const { type, score, postcode, city, housenumber, street } = premier.properties ?? {}
  const precise = aUneRue(adresse) && scoreBanSuffisant(type, score) && memeCommune(adresse, 'FR', postcode, [city])
    && (!rueSeule || memeNumeroEtVoie(rueSeule, type, housenumber, street))
  return position(coordonnees[1], coordonnees[0], precise)
}

interface ReponseNominatim {
  lat?: string
  lon?: string
  place_rank?: number
  address?: Record<string, string | undefined>
}

async function parNominatim(adresse: AdresseDecomposee, pays: Pays): Promise<PositionAdresse | null> {
  const recherche = texteRecherche(adresse)
  if (!recherche) return null
  const code = pays === 'PT' ? 'pt' : 'fr'
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(recherche)}&format=jsonv2&addressdetails=1&limit=1&countrycodes=${code}&accept-language=${code}`,
    { signal: AbortSignal.timeout(DELAI_MS) },
  )
  if (!res.ok) return null
  const premier = (await res.json() as ReponseNominatim[])[0]
  if (!premier) return null
  const lieu = premier.address ?? {}
  const villes = [lieu.city, lieu.town, lieu.village, lieu.municipality, lieu.hamlet, lieu.suburb]
  const precise = aUneRue(adresse)
    && typeof premier.place_rank === 'number' && premier.place_rank >= RANG_MIN_NOMINATIM
    && memeCommune(adresse, pays, lieu.postcode, villes)
  return position(premier.lat, premier.lon, precise)
}

/**
 * Position de l'adresse, ou null (introuvable, service injoignable ou trop lent). Ne lève jamais. Une position
 * imprécise (`precise: false`) peut servir à la météo, jamais au pointage.
 */
export async function geocoderAdresse(entree: AdresseChantier, pays: Pays): Promise<PositionAdresse | null> {
  const adresse = decomposerAdresse(entree, pays)
  if (!adresse.rue && !adresse.codePostal && !adresse.ville) return null
  try {
    if (pays === 'PT') return await parNominatim(adresse, 'PT')
    const ban = await parBaseAdresseNationale(adresse)
    if (ban?.precise) return ban
    // Résidence, bâtiment ou étage autour de la rue : la BAN est moins sûre d'elle ; on lui redemande la rue seule, jugée
    // sur les mêmes règles (seuil, même code postal et même ville) et sur le numéro et la voie extraits. Une panne de cette
    // seconde recherche ne perd ni la première réponse ni le secours Nominatim.
    const rueSeule = rueSansComplements(adresse.rue)
    const banRue = rueSeule
      ? await parBaseAdresseNationale({ ...adresse, rue: rueSeule.texte }, rueSeule).catch((erreur: unknown) => {
        console.warn('[btp] seconde recherche de l’adresse impossible :', erreur instanceof Error ? erreur.message : erreur)
        return null
      })
      : null
    if (banRue?.precise) return banRue
    // BAN imprécise ou muette : Nominatim peut connaître l'adresse exacte ; sinon on garde la meilleure réponse.
    const osm = await parNominatim(adresse, 'FR')
    return osm?.precise ? osm : (ban ?? banRue ?? osm)
  } catch (erreur) {
    console.warn('[btp] géocodage de l’adresse impossible :', erreur instanceof Error ? erreur.message : erreur)
    return null
  }
}

/** Adresse complète d'un chantier (rue, code postal, ville), pour l'afficher. */
export function adresseComplete(chantier: AdresseChantier): string {
  return [chantier.adresse, chantier.codePostal, chantier.ville].map(p => (p ?? '').trim()).filter(Boolean).join(' ')
}

/** Lien OpenStreetMap vers une position, pour que le gérant vérifie d'un coup d'œil où est placé le chantier. */
export function lienCarte(latitude: number, longitude: number): string {
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=18/${latitude}/${longitude}`
}
