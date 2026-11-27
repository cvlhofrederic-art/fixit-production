// Position GPS d'une adresse de chantier (fiche chantier, Météo chantiers, écran Pointage › Affectations).
//
// France : Base Adresse Nationale (api-adresse.data.gouv.fr), filtrée par le code postal quand il est connu ; si elle
// n'est pas assez sûre d'elle, une seconde fois avec la rue seule (numéro et voie, sans résidence, bâtiment ni étage :
// rueSansComplements), puis OpenStreetMap (Nominatim) si elle ne trouve toujours rien de précis. Portugal : Nominatim
// limité au Portugal — la BAN ne connaît que la France et rendait, pour une adresse portugaise, le résultat français le
// plus ressemblant.
// `precise` : le résultat est le numéro ou la rue saisis, dans la commune saisie. Il faut donc une rue dans l'adresse,
// un code postal ou une ville pour vérifier la commune du résultat (sans ville, la voie rendue doit être la seule de ce
// nom dans le code postal, qui couvre souvent plusieurs communes), une BAN sûre d'elle (score) et, en France, une
// réponse qui concorde avec la saisie (accordAvecLaSaisie) : un numéro de rue saisi doit être rendu dans la voie saisie,
// ni le centre de la rue ni une voie voisine au nom ressemblant ; sans numéro de rue saisi, un numéro trouvé ailleurs
// dans l'adresse (« Étage 2 ») n'est pas celui du chantier. Sinon c'est le centre d'une commune ou d'une rue, une rue
// homonyme dans une autre commune ou une rue voisine : assez bon pour la météo, pas pour déclencher un pointage dans un
// rayon de 100 m — on ne l'enregistre pas dans la fiche.
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
/**
 * Voies d'une commune lues pour vérifier qu'un nom n'y désigne qu'une voie (seuleVoieCompatible) : le plus que la BAN
 * accepte. Une page pleine peut en avoir coupé (« moulin » dans le 22400 : 23 voies, le Moulin de Cravia de Noyal en 22e) :
 * elle ne prouve rien (relecture du 26/11/2026).
 */
const LIMITE_VOIES_HOMONYMES = 50

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
  /** Code INSEE de la commune de la réponse de la BAN, saisie vérifiée, pour n'en lire que les voies (voiesNommees). */
  codeCommune?: string
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
  if (pays === 'FR') rue = rueLisible(rue)
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

/**
 * Saisie française rendue lisible : accents composés (texte copié d'un PDF, en NFD, où « à » tient en deux caractères) et
 * complément collé à son numéro séparé (« Lot12 » → « Lot 12 », « Lots12 à 14 ») ; sixième relecture du 27/11/2026.
 */
function rueLisible(rue: string): string {
  return rue.normalize('NFC').split(' ').map(mot => {
    const colle = /^(\p{L}{2,})(\d{1,4})$/u.exec(mot)
    return colle && estUnMotDeComplement(colle[1], motComplement(colle[1])) ? `${colle[1]} ${colle[2]}` : mot
  }).join(' ')
}

/** Numéro de rue en un mot : « 10 », « 12B », « 4bis ». */
const NUMERO = /^(\d{1,4})(bis|ter|quater|quinquies|[a-d])?$/iu
/** Indice écrit à part (« 4 bis », « 12 B »). */
const INDICE_NUMERO = /^(?:bis|ter|quater|quinquies|[a-d])$/iu
/**
 * Plage d'un immeuble écrite d'un bloc (« 10-12 », « 10–12 », « 10/12 ») : la BAN rend l'un ou l'autre numéro (relevé du
 * 26/11/2026).
 */
const PLAGE_NUMEROS = /^(\d{1,4})[-–—/](\d{1,4})$/u
/**
 * « n° », « nº », « no », « nr », « n. », « num. », « numéro » écrits devant le numéro, et leurs pluriels (« lots nos 12 à
 * 14 », « n°s », « numéros ») ; collé au numéro : « N°10 ».
 */
const PREFIXE_NUMERO = /^(?:n[°º.]?|no\.?|nr\.?|num(?:[ée]ro|\.)?|n[°º]s|nos|num[ée]ros)$/iu
const PREFIXE_COLLE = /^n[°º](?=\d)/iu
const SEPARATEURS_PLAGE = new Set(['-', '–', '—', '/', '&', 'à', 'au', 'et'])
/** Ponctuation seule entre un complément et son numéro (« Lot : 12 », « Lot n ° 12 », « Lot / 12 », « Bât # 3 »). */
const PONCTUATION = /^[:#./°º\-–—]+$/u
/**
 * Locaux numérotés d'un immeuble ou d'un lotissement, en toutes lettres ou abrégés (« Logt 12 », « Pte 3 », « Pav. 3 »,
 * « Cellule 3 », « Tranche 2 », relecture du 26/11/2026) : leur numéro n'est pas celui de la rue.
 */
const LOCAUX = [
  'logement', 'logements', 'log', 'logt', 'logts', 'lgt', 'lgts', 'lgmt', 'lgmts', 'ap', 'apt', 'apts', 'app', 'appt', 'appts',
  'appart', 'apart', 'appartement', 'appartements', 'porte', 'pte', 'chambre', 'chbre', 'pavillon', 'pavillons', 'pav',
  'cellule', 'cellules', 'local', 'locaux', 'box', 'boxes', 'garage', 'garages', 'tranche', 'ilot', 'ilots', 'hall', 'cage',
  // Quatrième relecture du 26/11/2026 : commerces, hébergements, phases et parties d'un lotissement ou d'une copropriété.
  'magasin', 'boutique', 'stand', 'bungalow', 'mobil', 'mobil home', 'mobilhome', 'home', 'duplex', 'triplex', 'salle',
  'unite', 'module', 'phase', 'copropriete',
]
/**
 * Parties numérotées d'une zone ou d'un lotissement (« Zone 3 », « Secteur B », « Terrain 12 ») : leur numéro n'est pas celui
 * de la rue ; mais « Zone Artisanale du Bosc » (Mudaison), « Zone Industrielle » ou « Terrain d'Aviation » sont des voies
 * numérotées de la BAN (cinquième relecture du 26/11/2026).
 */
const ZONES = new Set(['zone', 'secteur', 'terrain'])
/** Zone suivie d'un numéro ou d'une lettre seule (« Zone 3 », « Zone B ») : un complément, pas une voie. */
const zoneNumerotee = (mots: readonly string[]) => ZONES.has(normaliserLieu(mots[0] ?? '')) && /^(?:\d{1,4}|\p{L})$/u.test(mots[1] ?? '')
/** Premier mot d'un complément qui suit parfois un numéro (« 2 étage », « 3 bât. B ») : ce numéro n'est pas celui de la rue. */
const MOTS_COMPLEMENT = new Set([...LOCAUX, 'etage', 'bat', 'batiment', 'escalier', 'esc', 'bloc', 'lot', 'niveau', 'case', 'bp', 'cs', 'n', 'bis', 'ter', 'quater'])
/**
 * Mot qui fait d'un numéro celui d'un complément (« Bât 3 », « Lot 12 », « Étage 2 », « Ét. 2 », « Local commercial 3 »,
 * « km 5 »), pas celui de la rue, même séparé de lui par un « n° » ou une ponctuation (« Lot n° 12 », « Lot : 12 »).
 */
const MOTS_AVANT_NUMERO = new Set([
  ...LOCAUX, ...ZONES, 'bat', 'bt', 'bats', 'batiment', 'batiments', 'lot', 'lots', 'lotissement', 'villa', 'villas', 'maison', 'maisons',
  'chalet', 'studio', 'escalier', 'esc', 'bloc', 'niveau', 'niv', 'etage', 'etg', 'et', 'residence', 'res', 'immeuble', 'imm',
  'bp', 'cs', 'case', 'commercial', 'commerce', 'cave', 'caves', 'parking', 'emplacement', 'atelier', 'bureau', 'bureaux',
  'hangar', 'entrepot', 'entree', 'tour', 'parcelle', 'cedex', 'km', 'pk',
])
/** Étages : un étage déjà numéroté (« 2e étage », « 1er ét. ») ne prend pas le numéro qui le suit (« 2e étage 10 rue X »). */
const ETAGES = new Set(['etage', 'etg', 'et', 'niveau', 'niv'])
/**
 * Référence cadastrale écrite avant le numéro, dans le même morceau (« section B n° 10 », « cadastré AB 12 », « Référence
 * cadastrale AB 12 ») : pas une rue.
 */
const MARQUEURS_CADASTRE = new Set([
  'cadastre', 'cadastres', 'cadastree', 'cadastrees', 'cadastral', 'cadastrale', 'cadastrales', 'cadastraux', 'cad',
  'section', 'parcelle', 'parcelles',
])
/** Abréviations courantes des types de voie et des titres, pour comparer la voie saisie à celle de la BAN ou d'OSM. */
const ABREVIATIONS_VOIE: Record<string, string> = {
  r: 'rue', av: 'avenue', ave: 'avenue', bd: 'boulevard', bld: 'boulevard', bvd: 'boulevard', ch: 'chemin', chem: 'chemin',
  imp: 'impasse', pl: 'place', rte: 'route', all: 'allee', fg: 'faubourg', fbg: 'faubourg', sq: 'square', crs: 'cours',
  pass: 'passage', prom: 'promenade', trav: 'traverse', mte: 'montee', esp: 'esplanade', grande: 'grand', gde: 'grand',
  // Titres abrégés dans les noms de voie (« av. du Gal Leclerc », « bd du Mal Juin »).
  gal: 'general', gen: 'general', mal: 'marechal', pdt: 'president', dr: 'docteur', cdt: 'commandant', lt: 'lieutenant',
  cne: 'capitaine', prof: 'professeur', mgr: 'monseigneur',
}
/** Types de voie (en toutes lettres) : en tête de la voie, ils ne font pas partie de son nom (« Villa Seurat », « Allées de Tourny »). */
const TYPES_VOIE = new Set([
  'rue', 'avenue', 'boulevard', 'chemin', 'impasse', 'place', 'route', 'allee', 'allees', 'cours', 'quai', 'square', 'passage',
  'traverse', 'montee', 'esplanade', 'promenade', 'faubourg', 'corniche', 'sentier', 'ruelle', 'chaussee', 'carrefour',
  'parvis', 'rampe', 'descente', 'galerie', 'digue', 'mail', 'cite', 'villa', 'rond', 'voie',
])
/**
 * Types de voie qu'une saisie confond couramment (« 15 av Jean Jaurès » pour le boulevard) ; « allée » et « allées » sont un
 * même type. Jamais une impasse, une allée, un square, un chemin, une villa ou une cité : une voie neuve de lotissement
 * peut manquer à la BAN à côté d'une voie homonyme, et ce sont aussi des noms de résidence (le 12 « Square » ou « Villa Les
 * Mimosas » n'est pas le 12 allée des Mimosas, relevés du 26/11/2026 à Carry-le-Rouet).
 */
const TYPES_CONFONDUS = new Set(['rue', 'avenue', 'boulevard', 'cours'])
const typesConfondus = (a: string, b: string) =>
  (TYPES_CONFONDUS.has(a) && TYPES_CONFONDUS.has(b)) || (a.startsWith('allee') && b.startsWith('allee'))
const ARTICLES = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'l', 'd'])
/**
 * Premier mot d'un complément collé à la voie (« rue X Bât B », « … Résidence Le Parc », « … Logt 12 », « … chez M.
 * Martin ») : la voie s'arrête avant, si un mot le suit (« rue de la Vieille Porte », « rue du Lot » restent entières).
 */
const DEBUT_COMPLEMENT = new Set([
  ...LOCAUX, 'bat', 'batiment', 'esc', 'escalier', 'bloc', 'niveau', 'bp', 'cs', 'residence', 'res', 'immeuble', 'imm', 'lot',
  'lotissement', 'villa', 'rez', 'chez', 'zac', 'zi', 'za', 'quartier', 'domaine',
])
/** Compléments qui se suffisent, même en dernier mot (« … 2e étage », « … Cedex », « … RDC »). */
const COMPLEMENT_FINAL = new Set(['etage', 'cedex', 'rdc'])
/**
 * Qualificatifs qui distinguent deux voies (« rue du Pont » ≠ « rue du Petit Pont », deux voies du 08200 relevées le
 * 25/11/2026) : un tel mot ne peut pas manquer d'un côté (voir memeVoie). « grande » est déjà ramené à « grand ».
 */
const QUALIFICATIFS = new Set([
  'petit', 'petite', 'petits', 'petites', 'grand', 'grands', 'grandes', 'vieux', 'vieil', 'vieille', 'vieilles',
  'haut', 'haute', 'hauts', 'hautes', 'bas', 'basse', 'basses', 'neuf', 'neuve', 'neuves', 'nouveau', 'nouvel', 'nouvelle',
  'nouvelles', 'ancien', 'ancienne', 'anciens', 'anciennes', 'prolonge', 'prolongee', 'nord', 'sud', 'est', 'ouest',
  'superieur', 'superieure', 'inferieur', 'inferieure',
])
/** Ordinal (« 2e », « 1er ») : retiré seulement devant un complément (« 2e étage ») ; « avenue du 1er Mai » garde le sien. */
const ORDINAL = /^\d{1,3}(?:e|er|ere|eme|nd|nde)$/
/** Désignations sans nom propre : la BAN écrit « Lieu-dit les Granges », « Hameau de Bénazeth ». */
const DESIGNATIONS: ReadonlyArray<readonly string[]> = [['lieu', 'dit'], ['hameau']]

/** Mots comparables d'une voie : normalisés, abréviations en toutes lettres, sans articles ni parenthèse (« (Bât B) »). */
function motsVoie(voie: string): string[] {
  return normaliserLieu(voie.split('(')[0]).split(' ').filter(Boolean)
    .map(mot => ABREVIATIONS_VOIE[mot] ?? mot).filter(mot => !ARTICLES.has(mot))
}

/**
 * Sans « lieu-dit » ni « hameau » en tête, ni « route » devant « départementale » ou « nationale » ; et, si `voieGenerique`,
 * sans le « Voie » que la BAN met devant une voie sans type (« Voie la canebiere »).
 */
function sansDesignation(mots: string[], voieGenerique: boolean): string[] {
  const designation = DESIGNATIONS.find(d => mots.length > d.length && d.every((mot, i) => mots[i] === mot))
  if (designation) return mots.slice(designation.length)
  if (mots[0] === 'route' && (mots[1] === 'departementale' || mots[1] === 'nationale')) return mots.slice(1)
  return voieGenerique && mots[0] === 'voie' && mots.length > 1 ? mots.slice(1) : mots
}

const finitPar = (mots: readonly string[], fin: readonly string[]) =>
  mots.length > fin.length && fin.every((mot, i) => mots[mots.length - fin.length + i] === mot)

/**
 * Formes de la voie saisie : entière ; coupée avant un complément collé (« rue de la République Bât B ») ; sans le pays
 * ni la ville recopiés à la fin (`villes` : celle saisie, celle de la réponse, qui couvre « Marseille 6e »). Les formes sont toutes essayées :
 * « avenue de France » ou « route d'Aubagne » à Aubagne restent entières.
 */
function formesSaisie(voie: string, villes: readonly unknown[]): string[][] {
  const mots = motsVoie(voie)
  const formes = [mots]
  const complement = mots.findIndex((mot, i) => COMPLEMENT_FINAL.has(mot) || ((DEBUT_COMPLEMENT.has(mot) || ZONES.has(mot)) && i < mots.length - 1))
  if (complement > 0) formes.push(mots.slice(0, complement > 1 && ORDINAL.test(mots[complement - 1]) ? complement - 1 : complement))
  const finales = villes.filter((v): v is string => typeof v === 'string').map(motsVoie).filter(v => v.length > 0)
  for (const forme of [...formes]) {
    const sansPays = forme.at(-1) === 'france' ? forme.slice(0, -1) : forme
    if (sansPays !== forme) formes.push(sansPays)
    for (const ville of finales.filter(v => finitPar(sansPays, v))) formes.push(sansPays.slice(0, -ville.length))
  }
  return formes.map(forme => sansDesignation(forme, false)).filter(forme => forme.length > 0)
}

/**
 * Mots d'une voie rendue par la BAN, parenthèse comprise : dans une commune nouvelle, « Place de l'Église (Andrezé) » et
 * « Place de l'Église (La Chapelle-du-Genêt) » sont deux places à 5 km l'une de l'autre (49600, relevé du 26/11/2026).
 */
const motsVoieRendue = (voie: string) => motsVoie(voie.replaceAll(/[()]/g, ' '))

const parentheseDe = (voie: string) => /\(([^()]*)\)/.exec(voie)?.[1]

/**
 * Formes de la voie rendue par la BAN ou OSM : avec et sans le « Voie » de la BAN, sans « Lieu-dit » ni « Hameau ». La
 * parenthèse d'une commune nouvelle fait partie du nom, sauf si elle nomme la ville saisie ou la parenthèse écrite dans la
 * saisie (`nomsSaisis` : « Andrezé », « place de l'Église (Andrezé) »).
 */
function formesRendues(voie: string, ...nomsSaisis: Array<string | undefined>): string[][] {
  const parenthese = parentheseDe(voie)
  const nommeLaVille = parenthese !== undefined && nomsSaisis.some(nom => nom && normaliserLieu(nom) === normaliserLieu(parenthese))
  const mots = nommeLaVille ? motsVoie(voie) : motsVoieRendue(voie)
  return [sansDesignation(mots, false), sansDesignation(mots, true)].filter(forme => forme.length > 0)
}

/** Voie comparable d'un mot à l'autre (parenthèse comprise), pour reconnaître la même voie parmi celles d'une commune. */
const cleVoie = (voie: string) => sansDesignation(motsVoieRendue(voie), false).join(' ')

/**
 * Mots de `long` en plus de `court` quand `court` s'y lit dans l'ordre (« avenue foch » dans « avenue marechal foch » :
 * [marechal]) ; null sinon.
 */
function motsInseres(court: readonly string[], long: readonly string[]): string[] | null {
  const inseres: string[] = []
  let lus = 0
  for (const mot of long) {
    if (mot === court[lus]) lus += 1
    else inseres.push(mot)
  }
  return lus === court.length ? inseres : null
}

/** Mot qui distingue deux voies et ne peut pas manquer d'un côté : un qualificatif, ou un nombre (« avenue du 8 Mai 1945 »). */
const motDistinctif = (mot: string) => QUALIFICATIFS.has(mot) || /\d/.test(mot)

/**
 * Même voie : mêmes mots, ou bien la plus courte se lit dans l'autre, avec le même premier mot (le type de voie) et le
 * même dernier, et sans qualificatif ni nombre en plus (« avenue Foch » = « avenue du Maréchal Foch » ; « place de
 * l'Église » ≠ « place de l'Église de Cossé », « allée des Acacias » ≠ « allée des Buis », « Le Clos » ≠ « rue du Clos »,
 * « rue du Pont » ≠ « rue du Petit Pont »).
 */
function memeVoie(a: readonly string[], b: readonly string[]): boolean {
  if (a.join(' ') === b.join(' ')) return true
  const [court, long] = a.length <= b.length ? [a, b] : [b, a]
  if (court[0] !== long[0] || court.at(-1) !== long.at(-1)) return false
  const inseres = motsInseres(court, long)
  return inseres !== null && !inseres.some(motDistinctif)
}

/**
 * Même voie à une écriture près, admise seulement si la commune n'a qu'une voie de ce nom (seuleVoieCompatible) : type de
 * voie oublié (« 10 République » = « Rue de la République »), si `typeOublie` (voie saisie au nom nu : nomNu), autre type
 * couramment confondu (« 15 av Jean Jaurès » = « Boulevard Jean Jaurès » à Aubagne), nom officiel plus long (« rue de la
 * Paix » = « Rue de la Paix Marcel Paul » à Marseille), sans qualificatif ni nombre en plus. Relevés de la BAN des 25 et
 * 26/11/2026.
 */
function voieVoisine(saisie: readonly string[], rendue: readonly string[], typeOublie = false): boolean {
  const typeSaisi = TYPES_VOIE.has(saisie[0])
  const typeRendu = TYPES_VOIE.has(rendue[0])
  if (!typeSaisi) return typeOublie && typeRendu && rendue.length > 1 && memeVoie(saisie, rendue.slice(1))
  if (!typeRendu || saisie.length < 2 || rendue.length < 2) return false
  if (saisie[0] !== rendue[0]) return typesConfondus(saisie[0], rendue[0]) && memeVoie(saisie.slice(1), rendue.slice(1))
  return rendue.length > saisie.length && saisie.every((mot, i) => rendue[i] === mot)
    && !rendue.slice(saisie.length).some(motDistinctif)
}

/**
 * Voie saisie sans article ni désignation en tête : « République » a pu perdre son type ; « Les Mimosas », « Hameau des
 * Mimosas » ou « lieu-dit Les Mimosas » sont des noms de lieu, souvent d'un lotissement, pas l'allée des Mimosas (relecture
 * du 26/11/2026 à Carry-le-Rouet).
 */
const nomNu = (voie: string) => !['lieu', 'hameau', ...ARTICLES].includes(premierMot(voie, false))

const cleNumero = (numero: string) => numero.toLowerCase().replaceAll(' ', '')

/**
 * Lecture d'une adresse : numéro de rue tel qu'écrit, numéros admis dans la réponse (les deux bornes d'une plage
 * « 10-12 »), voie, et « numéro voie » sans les compléments (texte de la seconde recherche).
 */
export interface RueSeule {
  numero: string
  numeros: string[]
  voie: string
  texte: string
}

interface NumeroLu {
  numero: string
  numeros: string[]
  /** Indice du premier mot après le numéro. */
  fin: number
}

/** Numéro de rue écrit à partir du mot `debut` (« 10 », « n° 10 », « 4 bis », « 12B », « 10-12 », « 10 à 12 »), ou null. */
function lireNumero(mots: readonly string[], debut: number): NumeroLu | null {
  let i = debut
  if (mots[i] !== undefined && PREFIXE_NUMERO.test(mots[i])) i += 1
  const mot = mots[i]?.replace(PREFIXE_COLLE, '')
  if (!mot) return null
  const plage = PLAGE_NUMEROS.exec(mot)
  if (plage) return { numero: mot, numeros: [plage[1], plage[2]], fin: i + 1 }
  const lu = NUMERO.exec(mot)
  if (!lu) return null
  const ecrit = [mot]
  i += 1
  if (!lu[2] && mots[i] !== undefined && INDICE_NUMERO.test(mots[i])) {
    ecrit.push(mots[i])
    i += 1
  }
  const numeros = [cleNumero(ecrit.join(''))]
  const second = mots[i] !== undefined && SEPARATEURS_PLAGE.has(mots[i].toLowerCase()) && mots[i + 1] !== undefined
    ? NUMERO.exec(mots[i + 1]) : null
  if (second) {
    ecrit.push(mots[i], mots[i + 1])
    numeros.push(cleNumero(mots[i + 1]))
    i += 2
  }
  return { numero: ecrit.join(' '), numeros, fin: i }
}

/** Premier mot d'un texte, normalisé ; `abreviations` : en toutes lettres (« av. » → avenue). */
function premierMot(texte: string, abreviations = true): string {
  const mot = normaliserLieu(texte).split(' ')[0] ?? ''
  return abreviations ? ABREVIATIONS_VOIE[mot] ?? mot : mot
}

const aDesLettres = (texte: string) => /\p{L}{3,}/u.test(texte)
/** Voie écrite après un numéro : un nom, pas un complément (« 2 étage », « 3 bât. B », « 3 bis »). */
const voieApresNumero = (voie: string) => aDesLettres(voie) && !MOTS_COMPLEMENT.has(premierMot(voie, false)) && !zoneNumerotee(voie.split(' '))
/** Morceau qui commence par un type de voie (« rue X », « av. Y »). */
const commenceParUnTypeDeVoie = (mots: readonly string[]) => mots.length > 1 && TYPES_VOIE.has(premierMot(mots[0]))
/**
 * Morceau qui est une voie nommée (« rue Paradis »), pas un complément qui commence par un type de voie (« Allée B »,
 * « Villa 3 », « Place 14 » : cinquième relecture du 26/11/2026).
 */
const estUneVoieNommee = (mots: readonly string[]) =>
  commenceParUnTypeDeVoie(mots) && !estUnComplement(mots) && aDesLettres(texte(mots.slice(1)))
/** Morceau qui commence par un type de voie, un lieu-dit ou un hameau (« rue X », « Lieu-dit Les Granges »). */
const commenceParUneVoie = (mots: readonly string[]) =>
  commenceParUnTypeDeVoie(mots) || (mots.length > 1 && (premierMot(mots[0]) === 'lieu' || premierMot(mots[0]) === 'hameau'))
/** Mot comparable à MOTS_AVANT_NUMERO : normalisé, sans article élidé (« l'étage ») ni « : » ou « # » collés (« Lot: »). */
const motComplement = (mot: string | undefined) => normaliserLieu(mot ?? '').replace(/^[ld] (?=\S)/u, '').replace(/[:#]+$/u, '')
/** Mot qui sépare un complément de son numéro : « n° » (« n°: » compris) ou ponctuation seule. */
const entreComplementEtNumero = (mot: string) => PREFIXE_NUMERO.test(mot.replace(/[:#]+$/u, '')) || PONCTUATION.test(mot)
/** Complément de la liste, au singulier ou au pluriel (« parkings », « niveaux »), ou mot abrégé (« Empl. 12 »). */
const estUnMotDeComplement = (ecrit: string, mot: string) =>
  MOTS_AVANT_NUMERO.has(mot) || MOTS_AVANT_NUMERO.has(mot.replace(/(?<=\p{L}{3})[sx]$/u, '')) || /\p{L}{2,}\.$/u.test(ecrit)
/**
 * Liaison entre deux numéros d'une suite (« lots 12 à 14 », « 12 et 14 », « 12 ou 14 », « 12 + 14 », « 12 jusqu'au 14 »,
 * « 12 jusqu'à 14 », « jusque »).
 */
const LIAISONS = new Set([
  ...SEPARATEURS_PLAGE, 'a', 'ou', '+', "jusqu'au", 'jusqu’au', "jusqu'aux", 'jusqu’aux', "jusqu'à", 'jusqu’à', "jusqu'a", 'jusqu’a',
  'jusque', 'jusqu',
])
/** Liaison, apostrophe finale comprise (« jusqu' au 14 », une espace tapée après l'apostrophe). */
const estUneLiaison = (mot: string) => LIAISONS.has(mot.toLowerCase().replace(/['’]$/u, ''))
/** Borne d'une suite : un numéro ou une plage d'un bloc, « n° » collé compris (« 12 », « 4bis », « n°14 », « 12-14 »). */
const estUneBorne = (mot: string | undefined) => {
  const nu = mot?.replace(PREFIXE_COLLE, '')
  return nu !== undefined && (NUMERO.test(nu) || PLAGE_NUMEROS.test(nu))
}
/** Prépositions d'une plage (« lots du 12 au 14 »). */
const PREPOSITIONS_DE_PLAGE = new Set(['du', 'de', 'des'])
/** Désignations d'un bâtiment entier : « Immeuble du 10-12 rue X » est l'immeuble des n° 10 à 12 de la rue. */
const IMMEUBLES = new Set(['immeuble', 'imm', 'residence', 'res', 'copropriete'])
/** Compléments au singulier qui finissent par s ou x (« Box 3, 12 rue X », « Rés 2000, 12 rue X »). */
const SINGULIERS_EN_SX = new Set(['box', 'duplex', 'triplex', 'res', 'cs'])

/**
 * Numéro qui précède celui du mot `i` dans une suite (« lots 12 à 14 », « box 3 / 4 », « lots 12 13 14 », « lots 12 bis à
 * 14 », « lots 12- 14 »), au-delà des « n° », ponctuations, liaisons et indices ; `juxtapose` : sans liaison ni ponctuation
 * entre eux. Null si ce n'est pas un numéro.
 */
function numeroPrecedent(mots: readonly string[], i: number): { indice: number; juxtapose: boolean } | null {
  let j = i - 1
  let juxtapose = true
  while (j >= 0 && (entreComplementEtNumero(mots[j]) || estUneLiaison(mots[j]) || INDICE_NUMERO.test(mots[j]))) {
    const neutre = PREFIXE_NUMERO.test(mots[j].replace(/[:#]+$/u, '')) || INDICE_NUMERO.test(mots[j])
    if (estUneLiaison(mots[j]) || !neutre) juxtapose = false
    j -= 1
  }
  const borne = mots[j]?.replace(/[-–—/]$/u, '')
  return estUneBorne(borne) ? { indice: j, juxtapose: juxtapose && borne === mots[j] } : null
}

/**
 * Le numéro du mot `i` ouvre-t-il une plage ou une suite, écrite comme numeroPrecedent la lit (« 12 au 14 », « 12 a 14 »,
 * « n° 12 au n° 14 », « 12 jusqu'au 14 », « 12-14 », « 12- 14 ») ?
 */
function ouvreUnePlage(mots: readonly string[], i: number): boolean {
  let k = PREFIXE_NUMERO.test(mots[i] ?? '') ? i + 1 : i
  const premier = (mots[k] ?? '').replace(PREFIXE_COLLE, '')
  if (PLAGE_NUMEROS.test(premier) || /^\d{1,4}[-–—/]$/u.test(premier)) return true
  if (!NUMERO.test(premier)) return false
  let lie = false
  for (k += 1; k < mots.length && (entreComplementEtNumero(mots[k]) || estUneLiaison(mots[k]) || INDICE_NUMERO.test(mots[k])); k += 1) {
    lie ||= estUneLiaison(mots[k])
  }
  return lie && estUneBorne(mots[k]?.replace(/[-–—/]$/u, ''))
}

/**
 * Indice du mot qui précède le numéro du mot `i`, au-delà des « n° » et ponctuations, et de la préposition d'une plage
 * (« lots du 12 au 14 », « lots du 12 a 14 » : « lots » ; « Bâtiment du 12 rue X » : « du » ; « Immeuble du 10-12 rue X » :
 * « du », c'est la plage de la rue) ; -1 au début du morceau. `enSuite` : la plage continue dans le morceau suivant (« Lots
 * du 12 - 14 rue X »).
 */
function motAvantLeNumero(mots: readonly string[], i: number, enSuite = false): number {
  let j = i - 1
  while (j >= 0 && entreComplementEtNumero(mots[j])) j -= 1
  if (!PREPOSITIONS_DE_PLAGE.has(motComplement(mots[j])) || !(enSuite || ouvreUnePlage(mots, i))) return j
  const avant = motAvantLeNumero(mots, j)
  return IMMEUBLES.has(motComplement(mots[avant])) ? j : avant
}

/**
 * Le mot qui précède la suite de numéros finissant au mot `i` est-il au pluriel (« lots », « bâtiments », « locaux ») ?
 * `tete` : au début du morceau, la suite continue celle des morceaux d'avant (continueUneSuite).
 */
function suiteAuPluriel(mots: readonly string[], i: number, tete = false, enSuite = false): boolean {
  let debut = i
  for (let precedent = numeroPrecedent(mots, debut); precedent; precedent = numeroPrecedent(mots, debut)) debut = precedent.indice
  const j = motAvantLeNumero(mots, debut, enSuite)
  if (j < 0) return tete
  const mot = motComplement(mots[j])
  return /[sx]$/u.test(mot) && !SINGULIERS_EN_SX.has(mot)
}

/**
 * Le numéro du mot `i` est-il celui d'un complément ? Le mot qui le précède, au-delà d'un « n° » ou d'une ponctuation
 * (« Lot n° 12 », « Lot n°: 12 », « Lot : 12 »), est un complément (« Bât », « Lot », « Étage », « Lgt », « km ») ou un mot
 * abrégé (« Empl. 12 ») ; sauf un étage déjà numéroté (« 2e étage 10 rue X », « 2e ét. 10 ») et, `apresLaVoie`, un mot du
 * nom de la voie précédé d'un article (« rue de la Tour 5 », « rue du Lot 8 ») : au milieu d'un morceau, « Terrain du lot 12
 * rue X » est le lot 12 (relecture du 26/11/2026). Ou une référence cadastrale le précède dans le morceau (« section B
 * n° 10 », « cadastré AB 12 »). Un numéro qui suit un autre numéro est jugé comme lui (« lots 12 à 14 », « Bât 3 & 4 »,
 * « lots 12 13 14 » : quatrième relecture du 26/11/2026) ; juxtaposé, seulement après un complément au pluriel (« Lot 5
 * 12 rue X » : le 12 est celui de la rue). `tete` : le morceau continue une suite de numéros de complément (continueUneSuite),
 * et ses premiers numéros en sont (« Lots 12, 13 et 14 rue X »).
 */
function precedeParUnComplement(mots: readonly string[], i: number, apresLaVoie = false, tete = false, enSuite = false): boolean {
  if (mots.slice(0, i).some(mot => MARQUEURS_CADASTRE.has(motComplement(mot)))) return true
  const precedent = numeroPrecedent(mots, i)
  if (precedent) {
    return precedeParUnComplement(mots, precedent.indice, apresLaVoie, tete)
      && (!precedent.juxtapose || suiteAuPluriel(mots, precedent.indice, tete))
  }
  const j = motAvantLeNumero(mots, i, enSuite)
  if (j < 0) return tete
  const mot = motComplement(mots[j])
  const avant = motComplement(mots[j - 1])
  const etageNumerote = ETAGES.has(mot) && ORDINAL.test(avant)
  return estUnMotDeComplement(mots[j], mot) && !etageNumerote && !(apresLaVoie && ARTICLES.has(avant))
}

/**
 * Le morceau `k`, qui commence par un numéro, continue-t-il une suite de numéros d'un complément écrite avant lui (« Lots
 * 12, 13, 14 rue Paradis », « Lots 12 - 14 rue Paradis », « Lots 12 à 14, 16 et 18 rue Paradis ») ? Au singulier,
 * seulement s'il ouvre lui-même une énumération (« Lot 12, 13 et 14 rue Paradis », « Lot 12, 13, 14 rue Paradis ») : sinon
 * son numéro est celui de la rue (« Lot 5, 12 rue des Lilas »).
 */
function continueUneSuite(morceaux: Morceaux, k: number): boolean {
  const avant = morceaux[k - 1]
  if (!avant) return false
  // Un indice détaché ou une plage d'un bloc finit aussi une suite (« Lots 12 bis, 14 », « Lots 12-14, 16 rue X »).
  const fin = avant.length - (avant.length > 1 && INDICE_NUMERO.test(avant.at(-1) ?? '') ? 2 : 1)
  if (!estUneBorne(avant[fin])) return false
  const tete = continueUneSuite(morceaux, k - 1)
  if (fin === 0) return tete
  // La plage continue dans ce morceau si son numéro prolonge la suite (« Lots du 12 - 14 rue X ») ; pas après une année
  // (« Logements de 1975, 12 rue X » : septième relecture du 27/11/2026).
  const suivant = lireNumero(morceaux[k], 0)
  const enSuite = suivant !== null && Number.parseInt(suivant.numeros[0], 10) > Number.parseInt(avant[fin].replace(PREFIXE_COLLE, ''), 10)
  return precedeParUnComplement(avant, fin, false, tete, enSuite) && (suiteAuPluriel(avant, fin, tete, enSuite) || ouvreUneEnumeration(morceaux, k))
}

/** Le morceau `k` commence-t-il par une énumération (« 13 et 14 rue X », « 13, 14 rue X ») plutôt que par un seul numéro ? */
function ouvreUneEnumeration(morceaux: Morceaux, k: number): boolean {
  const numero = lireNumero(morceaux[k], 0)
  if (!numero) return false
  return numero.numeros.length > 1 || (numero.fin === morceaux[k].length && lireNumero(morceaux[k + 1] ?? [], 0) !== null)
}

/**
 * Rue lue ; `ecrit` : la partie de l'adresse où elle a été lue, telle qu'écrite (sans elle : des compléments) ; `morceaux` :
 * ses morceaux ; `apres` : numéro écrit après la voie (« rue X 12 ») ; `autreVoie` : un autre morceau de l'adresse
 * commence par un type de voie (« Villa Les Mimosas n° 12, chemin des Vignes » : la voie est le chemin).
 */
interface Lecture {
  rue: RueSeule
  ecrit: string
  morceaux: number[]
  apres: boolean
  autreVoie: boolean
}

const lecture = (numero: NumeroLu, voie: string, ecrit: string, morceaux: number[], apres = false): Lecture => ({
  rue: { numero: numero.numero, numeros: numero.numeros, voie, texte: `${numero.numero} ${voie}` },
  ecrit,
  morceaux,
  apres,
  autreVoie: false,
})

/** Morceaux d'une adresse aux blancs réduits, séparés par une virgule, un point-virgule ou un tiret entre espaces. */
const morceauxAdresse = (rue: string) =>
  rue.replaceAll(/\s+/g, ' ').split(/[,;]| [-–—] /u).map(morceau => morceau.trim()).filter(Boolean)

/**
 * Numéro et voie saisis, dans cet ordre de préférence :
 * 1. un morceau (entre virgules, points-virgules ou tirets) qui commence par le numéro (« 3 Allée des Acacias »,
 *    « Résidence Le Parc, 10 rue X », « N° 10 rue X », « 10-12 rue X »), ou un numéro seul suivi de la voie (« 10, rue X ») ;
 * 2. un numéro au milieu d'un morceau, entre un nom et un type de voie (« Résidence Les Pins 10 rue X ») : le dernier ;
 * 3. un numéro après la voie (« rue X, 12 », « rue X 12 »).
 * Jamais le numéro d'un complément (« Bât 3, avenue du Prado », « Lot 12 rue X », « Étage 2, rue Paradis »). Null sans
 * numéro de rue reconnaissable : une réponse de la BAN qui porte un numéro n'est alors pas celle du chantier.
 */
export function numeroEtVoieSaisis(rue: string): RueSeule | null {
  return lireAdresse(rue)?.rue ?? null
}

type Morceaux = ReadonlyArray<readonly string[]>
const texte = (mots: readonly string[] | undefined) => mots?.join(' ') ?? ''

/**
 * Lecture de l'adresse ; au-delà de LONGUEUR_MAX_RECHERCHE caractères (que la BAN ne lit pas), aucune : pas de numéro de
 * rue, donc rien de précis (une suite de centaines de numéros coûtait des secondes, cinquième relecture du 26/11/2026).
 */
function lireAdresse(rue: string): Lecture | null {
  if (rue.length > LONGUEUR_MAX_RECHERCHE) return null
  const morceaux: Morceaux = morceauxAdresse(rueLisible(rue)).map(morceau => morceau.split(' '))
  const lue = numeroDevant(morceaux) ?? numeroAuMilieu(morceaux) ?? numeroApres(morceaux)
  if (!lue) return null
  const autreVoie = morceaux.some((mots, k) => !lue.morceaux.includes(k) && commenceParUneVoie(mots))
  // Une zone lue comme voie, une voie écrite à côté (« 2, Zone Industrielle, rue Gay Lussac » : le 2 rue Gay Lussac est à
  // 425 m du 2 Zone Industrielle, sixième relecture du 27/11/2026) : ambigu, aucune lecture.
  if (autreVoie && ZONES.has(premierMot(lue.rue.voie, false))) return null
  return { ...lue, autreVoie }
}

/** Morceau qui finit par le numéro d'un complément (« rue Paradis lot 12 », « rue Paradis Bât 3 »). */
const finitParUnComplement = (mots: readonly string[]) => estUneBorne(mots.at(-1)) && precedeParUnComplement(mots, mots.length - 1, true)

/**
 * 1. Morceau qui commence par le numéro (« 10 rue X »), ou numéro seul suivi de la voie (« 10, rue X ») ; pas la suite des
 * numéros de lots écrits avant lui (continueUneSuite).
 */
function numeroDevant(morceaux: Morceaux): Lecture | null {
  for (const [k, mots] of morceaux.entries()) {
    const numero = continueUneSuite(morceaux, k) ? null : lireNumero(mots, 0)
    if (!numero) continue
    const trouve = numero.fin < mots.length ? voieDuMorceau(numero, mots, k) : voieDesMorceauxSuivants(numero, morceaux, k)
    if (trouve) return trouve
  }
  return null
}

function voieDuMorceau(numero: NumeroLu, mots: readonly string[], k: number): Lecture | null {
  const voie = texte(mots.slice(numero.fin))
  return voieApresNumero(voie) ? lecture(numero, voie, texte(mots), [k]) : null
}

/** Morceau d'un complément sans voie (« Bât B », « Résidence Les Pins », « 2e étage ») : sauté après un numéro seul. */
function estUnComplement(mots: readonly string[]): boolean {
  const premier = premierMot(texte(mots), false)
  const second = motComplement(mots[1])
  return DEBUT_COMPLEMENT.has(premier) || MOTS_COMPLEMENT.has(premier) || COMPLEMENT_FINAL.has(premier) || zoneNumerotee(mots)
    || (ORDINAL.test(premier) && (COMPLEMENT_FINAL.has(second) || ETAGES.has(second)))
}

/**
 * Numéro seul dans son morceau : la voie est le morceau suivant, après le second numéro d'une plage (« 10 - 12 rue X »,
 * « 10, 12 rue X ») ; les compléments écrits entre les deux sont sautés (« 12, 2e étage, rue Paradis », « 12, Résidence
 * Les Pins, rue Paradis »), sauf la voie collée à l'un d'eux (« 12, 2e étage rue Saint-Ferréol »).
 */
function voieDesMorceauxSuivants(numero: NumeroLu, morceaux: Morceaux, k: number): Lecture | null {
  const suite = morceaux[k + 1] ?? []
  const second = lireNumero(suite, 0)
  if (second !== null && second.fin < suite.length) {
    const voie = texte(suite.slice(second.fin))
    const plage = { numero: `${numero.numero}-${second.numero}`, numeros: [...numero.numeros, ...second.numeros], fin: numero.fin }
    return voieApresNumero(voie) ? lecture(plage, voie, `${texte(morceaux[k])} ${texte(suite)}`, [k, k + 1]) : null
  }
  for (let indice = k + 1; indice < morceaux.length; indice += 1) {
    const voie = voieDuMorceauSuivant(morceaux[indice], morceaux.slice(indice + 1).some(estUneVoieNommee))
    if (voie !== null) return voieApresNumero(voie) ? lecture(numero, voie, `${texte(morceaux[k])} ${voie}`, [k, indice]) : null
  }
  return null
}

/**
 * Voie d'un morceau qui suit un numéro seul : le morceau entier ; d'un complément (« Bât B », « 2e étage »), seulement la
 * voie collée à lui (« Bât B rue Paradis »), et si aucun morceau suivant n'est une voie nommée (« 12, Résidence Villa
 * Médicis, rue Paradis » : la rue Paradis ; « 12, Résidence Le Parc rue Paradis, Allée B » : aussi) ; un type de voie précédé
 * d'un article est un nom (« Résidence Les Allées du Parc »). Null : morceau à sauter.
 */
function voieDuMorceauSuivant(mots: readonly string[], voieEnSuite: boolean): string | null {
  if (!estUnComplement(mots)) return texte(mots)
  if (voieEnSuite) return null
  for (let p = 1; p < mots.length; p += 1) {
    if (suiviDUneVoie(mots, p) && !ARTICLES.has(motComplement(mots[p - 1]))) return texte(mots.slice(p))
  }
  return null
}

/**
 * 2. Numéro au milieu d'un morceau, entre un nom et un type de voie (« Résidence Les Pins 10 rue X ») : le dernier trouvé.
 * La lecture reprend après chaque numéro lu, pour ne pas relire la seconde borne d'une plage (« … 10 à 12 rue X »).
 */
function numeroAuMilieu(morceaux: Morceaux): Lecture | null {
  for (const [k, mots] of morceaux.entries()) {
    let trouve: Lecture | null = null
    const tete = continueUneSuite(morceaux, k)
    let i = 1
    while (i < mots.length) {
      const numero = precedeParUnComplement(mots, i, false, tete) ? null : lireNumero(mots, i)
      if (numero && suiviDUneVoie(mots, numero.fin)) trouve = lecture(numero, texte(mots.slice(numero.fin)), texte(mots.slice(i)), [k])
      i = numero ? numero.fin : i + 1
    }
    if (trouve) return trouve
  }
  return null
}

/** Un type de voie au mot `fin`, et au moins un mot après lui (« Les 4 Cours » est un nom de résidence). */
const suiviDUneVoie = (mots: readonly string[], fin: number) => fin < mots.length - 1 && TYPES_VOIE.has(premierMot(mots[fin]))

/**
 * 3. Numéro après la voie : seul dans le morceau suivant (« rue X, 12 », d'abord : « avenue du 8 Mai 1945, 8 » est le 8),
 * ou à la fin du sien (« rue X 12 »).
 */
function numeroApres(morceaux: Morceaux): Lecture | null {
  for (const [k, mots] of morceaux.entries()) {
    // Pas après un numéro de complément (« rue Paradis lot 12, 13, 14 », « rue Paradis Bât 3, 12 » : sixième relecture).
    const voie = k > 0 && commenceParUneVoie(morceaux[k - 1]) && !finitParUnComplement(morceaux[k - 1]) ? morceaux[k - 1] : null
    const seul = voie ? lireNumero(mots, 0) : null
    if (voie && seul?.fin === mots.length) return lecture(seul, texte(voie), `${texte(voie)} ${texte(mots)}`, [k - 1, k], true)
  }
  for (const [k, mots] of morceaux.entries()) {
    const final = commenceParUneVoie(mots) ? numeroFinal(mots, k) : null
    if (final) return final
  }
  return null
}

/** Numéro qui termine un morceau commençant par une voie (« rue de la République 10 », « … n° 10 »). */
function numeroFinal(mots: readonly string[], k: number): Lecture | null {
  for (let j = 2; j < mots.length; j += 1) {
    const numero = precedeParUnComplement(mots, j, true) ? null : lireNumero(mots, j)
    if (numero?.fin === mots.length) return lecture(numero, texte(mots.slice(0, j)), texte(mots), [k], true)
  }
  return null
}

/**
 * La rue seule, sans le nom de résidence, d'immeuble, de bâtiment ni l'étage écrits autour (adresse importée d'un devis) :
 * la BAN trouve bien le numéro mais baisse alors son score sous le seuil (« Immeuble Le Méditerranée, 3 avenue du Prado » :
 * 0,52 contre 0,97 sans le nom de l'immeuble, relevé du 25/11/2026). Null sans numéro de rue (numeroEtVoieSaisis) ou sans
 * complément autour de la rue : « rue X 12 » ou « Route Départementale 96 » ne sont pas réécrits.
 */
export function rueSansComplements(rue: string): RueSeule | null {
  const lue = lireAdresse(rue)
  return lue && aDesComplements(lue, rue) ? lue.rue : null
}

/** L'adresse a-t-elle des mots autour de la partie lue (séparateurs mis à part) ? */
const aDesComplements = (lue: Lecture, rue: string) => normaliserLieu(lue.ecrit) !== normaliserLieu(morceauxAdresse(rue).join(' '))

/** Ce que la BAN (ou OSM) dit de son résultat, comparé à la saisie. */
interface ReponseComparee {
  type?: unknown
  housenumber?: unknown
  street?: unknown
}

/**
 * « oui » ; « non » ; voie voisine, à confirmer par seuleVoieCompatible ; ou même voie à la parenthèse d'une commune
 * déléguée près, à confirmer par seuleVoieDeCeNom.
 */
type Accord = 'oui' | 'non' | 'voie-voisine' | 'commune-deleguee'

/** Mots d'une voie comparables à un numéro : « n° » retiré (« Chemin vicinal n°5 » → 5), indices collés (« 4bis »). */
const nombresDuNom = (voie: string) => motsVoieRendue(voie).map(mot => cleNumero(mot.replace(PREFIXE_COLLE, '')))

/**
 * Le numéro lu après la voie fait-il partie du nom de la voie rendue (« Route départementale 940 », « avenue du 8 Mai
 * 1945 », « chemin vicinal n°5 » saisies sans numéro) ? Alors la saisie n'a pas de numéro de rue. Écrit devant la voie, il
 * reste un numéro de rue (« 8 route départementale » n'est pas la Route Départementale 8).
 */
function numeroDuNom(lue: RueSeule, street: unknown): boolean {
  const contientLeNumero = (voie: string) => nombresDuNom(voie).some(mot => lue.numeros.includes(mot))
  return typeof street === 'string' && contientLeNumero(street) && !contientLeNumero(lue.voie)
}

/**
 * Sans numéro de rue lu : un nombre de la saisie, même collé à un mot (« Bât B2 »), que la voie rendue n'explique pas peut
 * être un numéro écrit d'une façon non lue (« 45+47 route des Camoins ») ; le centre de la rue n'est alors pas précis
 * (« 45–47 », non lu avant le 26/11, mettait le point à 270 m). Les ordinaux (« 2e étage ») et les nombres du nom de la voie
 * (« avenue du 8 Mai 1945 ») sont expliqués.
 */
function nombreInexplique(rue: string, street: unknown): boolean {
  const duNom = typeof street === 'string' ? nombresDuNom(street) : []
  return normaliserLieu(rue).split(' ').map(mot => cleNumero(mot.replace(PREFIXE_COLLE, '')))
    .some(mot => /\d/.test(mot) && !ORDINAL.test(mot) && !duNom.includes(mot))
}

/**
 * La réponse concorde-t-elle avec la saisie ? Numéro de rue saisi : ce numéro, dans la voie saisie (« 3 Allée des
 * Acacias » → « 3 Allée des Buis », 0,64 ; « 4 Cours » → « 4 Cours Julien », relevés du 25/11/2026), jamais le centre de
 * la rue (« 12 avenue du Prado » 13008 : la BAN ne connaît pas ce 12 et rend l'avenue, longue de plusieurs kilomètres,
 * relevé du 26/11/2026). Sans numéro de rue saisi : une rue entière, comme avant, mais pas un numéro pris ailleurs dans
 * l'adresse (« Étage 2, rue Paradis » → n° 2, 0,73, relevé du 26/11/2026), ni le centre de la rue si un nombre de la
 * saisie reste inexpliqué. `villesReponse` : villes de la réponse, tolérées comme la ville saisie à la fin de la rue.
 */
function accordAvecLaSaisie(lue: Lecture | null, adresse: AdresseDecomposee, villesReponse: readonly unknown[], reponse: ReponseComparee): Accord {
  const { type, housenumber, street } = reponse
  const saisie = lue && !(lue.apres && numeroDuNom(lue.rue, street)) ? lue.rue : null
  if (!saisie) return type === 'housenumber' || nombreInexplique(adresse.rue, street) ? 'non' : 'oui'
  if (type !== 'housenumber' || typeof housenumber !== 'string' || typeof street !== 'string') return 'non'
  if (!saisie.numeros.includes(cleNumero(housenumber))) return 'non'
  const formes = formesSaisie(saisie.voie, [adresse.ville, ...villesReponse])
  const concorde = (rendues: string[][], regle: (a: readonly string[], b: readonly string[]) => boolean) =>
    formes.some(forme => rendues.some(rendue => regle(forme, rendue)))
  const voisine = (a: readonly string[], b: readonly string[]) => voieVoisine(a, b, nomNu(saisie.voie))
  const avecParenthese = formesRendues(street, adresse.ville, parentheseDe(saisie.voie))
  const sansParenthese = formesSansParenthese(street)
  if (concorde(avecParenthese, memeVoie)) return 'oui'
  if (concorde(sansParenthese, memeVoie)) return 'commune-deleguee'
  return concorde(avecParenthese, voisine) || concorde(sansParenthese, voisine) ? 'voie-voisine' : 'non'
}

/** Formes d'une voie rendue sans la parenthèse d'une commune déléguée (« Place de l'Église (Andrezé) » → place eglise). */
function formesSansParenthese(voie: string): string[][] {
  const mots = motsVoie(voie)
  return [sansDesignation(mots, false), sansDesignation(mots, true)].filter(forme => forme.length > 0)
}

/** Adresse avec une vraie rue (au moins un mot de trois lettres) : seule une telle adresse peut donner une position précise. */
function aUneRue(adresse: AdresseDecomposee): boolean {
  return aDesLettres(adresse.rue)
}

/**
 * Le résultat est-il dans la commune saisie ? Code postal identique (au Portugal, ses quatre premiers chiffres) s'il est
 * connu, et alors la ville saisie doit commencer comme l'une de celles du résultat (« Marseille 8e » = « Marseille ») ;
 * sans code postal, nom de commune identique. Sans l'un ni l'autre, impossible de vérifier : non. Sans ville, toute commune
 * du code postal passe ici : en France, la BAN vérifie ensuite que la voie est seule de son nom (communeSure).
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

/** Filtre de la BAN sur le code postal saisi, s'il est complet. */
const filtreCodePostal = (adresse: AdresseDecomposee) => /^\d{5}$/.test(adresse.codePostal) ? `&postcode=${adresse.codePostal}` : ''

interface ProprietesBan {
  type?: string
  score?: number
  postcode?: string
  city?: string
  /** Code INSEE de la commune (d'un arrondissement à Paris, Lyon et Marseille). */
  citycode?: string
  /** Commune déléguée d'une commune nouvelle (« Andrezé » dans Beaupréau-en-Mauges). */
  oldcity?: string
  housenumber?: string
  street?: string
  name?: string
  /** Identifiant BAN : « 13206_4930 » pour une voie (code INSEE, puis code de la voie dans la commune). */
  id?: string
}

interface ReponseBan {
  features?: Array<{ geometry?: { coordinates?: [number, number] }; properties?: ProprietesBan }>
}

/** Score BAN suffisant pour ce type de résultat (numéro ou rue ; jamais une commune, un lieu-dit). */
function scoreBanSuffisant(type: unknown, score: unknown): boolean {
  if (typeof score !== 'number') return false
  if (type === 'housenumber') return score >= SCORE_MIN_NUMERO
  return type === 'street' && score >= SCORE_MIN_RUE
}

/**
 * Voie lue dans la BAN : son nom, sa commune (déléguée comprise), son code postal et son code de voie, pour ne compter qu'une
 * fois un doublon de la BAN (pas deux voies homonymes de deux arrondissements de Marseille, cinquième relecture du
 * 26/11/2026 ; mais une seule avenue Jules Cantini, coupée entre le 6e et le 8e sous le même code 4930, sixième relecture).
 */
interface VoieLue {
  nom: string
  commune: string
  codePostal: string
  code: string
}

/** Commune d'une voie ou d'une réponse de la BAN, déléguée comprise (« beaupreau en mauges andreze »). */
const cleCommune = (city: unknown, oldcity: unknown) => normaliserLieu([city, oldcity].filter(nom => typeof nom === 'string').join(' '))

/** Voies de la commune déjà demandées à la BAN pendant un géocodage (même recherche pour la première et la seconde réponse). */
type VoiesDemandees = Map<string, Promise<VoieLue[] | null>>

/**
 * Voies de la commune saisie que la BAN rend pour `url` (type=street) ; null en cas de panne, ou sur une page pleine (des
 * voies ont pu être coupées).
 */
async function voiesDeLaCommune(url: string, adresse: AdresseDecomposee): Promise<VoieLue[] | null> {
  const page = await pageDeLaBan(url, 'des voies de la commune')
  return page === null ? null : page
    .filter(voie => voie.type === 'street' && memeCommune(adresse, 'FR', voie.postcode, [voie.city, voie.oldcity]))
    .flatMap(voie => {
      const nom = voie.name ?? voie.street
      // Code de voie propre à la commune (les codes bas se répètent d'une commune à l'autre) ; à Paris, Lyon et Marseille,
      // propre à la commune entière (« 13206_4930 » et « 13208_4930 » : la même avenue Jules Cantini).
      const [, insee, codeVoie] = /^([^_]+)_([^_]+)$/u.exec(voie.id ?? '') ?? []
      const code = insee && codeVoie ? `${communeEntiere(insee)}_${codeVoie}` : ''
      return typeof nom === 'string' ? [{ nom, commune: cleCommune(voie.city, voie.oldcity), codePostal: voie.postcode ?? '', code }] : []
    })
}

/** Résultats d'une recherche de la BAN ; null en cas de panne, ou sur une page pleine (des résultats ont pu être coupés). */
async function pageDeLaBan(url: string, verification: string): Promise<ProprietesBan[] | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(DELAI_MS) })
    if (!res.ok) return null
    const trouvees = (await res.json() as ReponseBan).features ?? []
    return trouvees.length >= LIMITE_VOIES_HOMONYMES ? null : trouvees.map(trouvee => trouvee.properties ?? {})
  } catch (erreur) {
    console.warn(`[btp] vérification ${verification} impossible :`, erreur instanceof Error ? erreur.message : erreur)
    return null
  }
}

/**
 * Une voie voisine (voieVoisine) n'est admise que si la commune n'a qu'une voie qui répond à la saisie : son nom contient,
 * dans l'ordre, celui qui est saisi sans son type, quels que soient le type et les mots en plus, ou les règles du module la
 * tiennent pour la voie saisie (« Rue Leclerc » pour « rue du Général Leclerc », 75014, quatrième relecture du 26/11/2026).
 * « 10 République » dans le 13001 (la seule rue de la République) oui ; « 10 Alésia » dans le 75014 (rue et villa d'Alésia,
 * deux n° 10 à 824 m), « 2 Le Clos » à Auriol (rue, chemin, clos…) ou « place de l'Église » dans le 49120 (trois places)
 * non (relevés du 26/11/2026). Une panne ou une réponse illisible vaut non.
 */
async function seuleVoieCompatible(adresse: AdresseDecomposee, lue: RueSeule, villesReponse: readonly unknown[], street: string, demandees: VoiesDemandees): Promise<boolean> {
  const formes = formesSaisie(lue.voie, [adresse.ville, ...villesReponse])
  const rendues = [...formesRendues(street, adresse.ville), ...formesSansParenthese(street)]
  const typeOublie = nomNu(lue.voie)
  const forme = formes.find(f => rendues.some(rendue => voieVoisine(f, rendue, typeOublie)))
  if (!forme) return false
  const nom = nomSansType(forme)
  const repond = (rendue: readonly string[]) =>
    motsInseres(nom, rendue) !== null || formes.some(f => memeVoie(f, rendue) || voieVoisine(f, rendue, typeOublie))
  const homonymes = (await voiesDistinctes(adresse, nom, demandees))?.filter(nomVoie => formesRendues(nomVoie, adresse.ville).some(repond))
  return homonymes?.length === 1 && cleVoie(homonymes[0]) === cleVoie(street)
}

/**
 * Voies distinctes de la commune pour un nom : les doublons de la BAN (même nom, parenthèse comprise, même commune : « Place
 * de l'église saint martin (Noyant) » deux fois, à 25 m) ne comptent qu'une fois (relevé du 26/11/2026 à Noyant-Villages) ;
 * sans ville saisie, la rue du même nom de deux communes du code postal compte deux fois.
 */
async function voiesDistinctes(adresse: AdresseDecomposee, nom: readonly string[], demandees: VoiesDemandees): Promise<string[] | null> {
  const voies = await voiesNommees(adresse, nom, demandees)
  if (voies === null) return null
  const distinctes: VoieLue[] = []
  for (const voie of voies) if (!distinctes.some(gardee => memeVoieDeLaBan(gardee, voie))) distinctes.push(voie)
  return distinctes.map(voie => voie.nom)
}

/** Même voie de la BAN : même nom et même commune, et même code postal ou même code de voie. */
const memeVoieDeLaBan = (a: VoieLue, b: VoieLue) => cleVoie(a.nom) === cleVoie(b.nom) && a.commune === b.commune
  && (a.codePostal === b.codePostal || (a.code !== '' && a.code === b.code))

/**
 * Voies de la commune qui portent le nom `forme`, parenthèse retirée (`memes`), ou le prolongent dans le même type
 * (`prolongees` : « Place de l'Église de la Jumellière » pour « place de l'Église ») ; null en cas de panne.
 */
async function homonymesDe(adresse: AdresseDecomposee, forme: readonly string[], demandees: VoiesDemandees): Promise<{ memes: string[]; prolongees: string[] } | null> {
  const voies = await voiesDistinctes(adresse, nomSansType(forme), demandees)
  if (voies === null) return null
  return {
    memes: voies.filter(nomVoie => formesSansParenthese(nomVoie).some(rendue => memeVoie(forme, rendue))),
    prolongees: voies.filter(nomVoie => formesRendues(nomVoie).some(rendue => rendue[0] === forme[0] && voieVoisine(forme, rendue))),
  }
}

/**
 * Réponse de la BAN qui ne diffère de la saisie que par la parenthèse d'une commune déléguée : admise si c'est la seule voie
 * de ce nom dans la commune (« 1 place de l'église Saint Martin », Noyant-Villages, oui ; « 1 place de l'Église », 49600
 * Beaupréau-en-Mauges, trois places, non).
 */
async function seuleVoieDeCeNom(adresse: AdresseDecomposee, street: string, demandees: VoiesDemandees): Promise<boolean> {
  const forme = formesSansParenthese(street)[0]
  const homonymes = forme ? await homonymesDe(adresse, forme, demandees) : null
  return homonymes?.memes.length === 1 && cleVoie(homonymes.memes[0]) === cleVoie(street)
}

const nomSansType = (forme: readonly string[]) => TYPES_VOIE.has(forme[0]) ? forme.slice(1) : [...forme]

/** Filtre de la BAN sur la commune de la réponse (code INSEE : « 22160 », « 2A004 »). */
const filtreCommune = (adresse: AdresseDecomposee) => /^[\dAB]{5}$/u.test(adresse.codeCommune ?? '') ? `&citycode=${adresse.codeCommune}` : ''

/**
 * Paris, Lyon et Marseille : la BAN donne le code d'un arrondissement (751xx, 6938x, 132xx), celui qu'elle a choisi pour sa
 * réponse ; les voies se cherchent dans toute la commune (« 10 Saint-Martin », Paris, sans code postal : neuf voies Saint-
 * Martin, quatrième relecture du 26/11/2026). Avec un code postal, son filtre garde l'arrondissement.
 */
const COMMUNES_A_ARRONDISSEMENTS: ReadonlyArray<readonly [string, string]> = [['751', '75056'], ['6938', '69123'], ['132', '13055']]
const communeEntiere = (code: string | undefined) => COMMUNES_A_ARRONDISSEMENTS.find(([prefixe]) => code?.startsWith(prefixe))?.[1] ?? code

/**
 * Voies de la commune saisie dont la BAN rapproche le nom de `nom` (type=street) : filtrées par le code postal et par la
 * commune de la réponse (codeCommune), ou ville ajoutée à la recherche sans l'un ni l'autre. Cherchées par le dernier mot du
 * nom : une voie que memeVoie tient pour la même (« Rue Leclerc » pour « rue du Général Leclerc ») a ce mot, pas forcément
 * tous les autres ; par le nom entier s'il finit par un nombre, que la BAN lirait comme un numéro (« 19 mars 1962 » : six
 * communes du 31620, cinquième relecture du 26/11/2026). Un mot très courant (« ville ») remplit plus souvent la page : refus,
 * voulu. Demandées une fois par géocodage ; null si le nom est trop court, en panne ou sur une page pleine.
 */
function voiesNommees(adresse: AdresseDecomposee, nom: readonly string[], demandees: VoiesDemandees): Promise<VoieLue[] | null> {
  const filtre = `${filtreCodePostal(adresse)}${filtreCommune(adresse)}`
  const dernier = nom.at(-1) ?? ''
  const motCle = dernier.length >= 3 && !/\d/u.test(dernier) ? dernier : nom.join(' ')
  const recherche = filtre ? motCle : `${motCle} ${adresse.ville}`.trim()
  if (motCle.length < 3) return Promise.resolve(null)
  const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(recherche)}&type=street&limit=${LIMITE_VOIES_HOMONYMES}${filtre}`
  const demande = demandees.get(url) ?? voiesDeLaCommune(url, adresse)
  demandees.set(url, demande)
  return demande
}

/**
 * La commune a-t-elle plusieurs voies du nom que rend OSM ? Il rend alors l'une d'elles sans dire laquelle : « 1 place de
 * l'Église », 49600 Beaupréau-en-Mauges (trois places entre parenthèses : Andrezé, La Chapelle-du-Genêt, St
 * Philbert-en-Mauges, à 3 à 5 km l'une de l'autre) ; « place de l'Église », 49120 Chemillé-en-Anjou (trois places à suffixe :
 * « de la Jumellière », « de Cossé », « de Sainte-Christine », jusqu'à 13,7 km) ; relevés du 26/11/2026. Ambiguë : plusieurs
 * voies de ce nom, ou aucune de ce nom exact et plusieurs qui le prolongent, ou une autre voie que la saisie désigne aussi
 * (« rue Leclerc », 61500 sans ville : rue du Général Leclerc à Sées, rue de la Division Leclerc à Saint-Gervais-du-Perron,
 * 7,2 km ; cinquième relecture du 26/11/2026). Une voie que la BAN ne connaît pas n'est pas ambiguë ; une panne vaut oui.
 */
async function voieAmbigue(adresse: AdresseDecomposee, rendue: string, saisie: SaisieComparee, demandees: VoiesDemandees): Promise<boolean> {
  const forme = formesSansParenthese(rendue)[0]
  if (!forme) return false
  const homonymes = await homonymesDe(adresse, forme, demandees)
  if (homonymes === null) return true
  if (homonymes.memes.length > 1 || (homonymes.memes.length === 0 && homonymes.prolongees.length > 1)) return true
  return autreVoieDesignee(adresse, saisie, rendue, demandees)
}

/** Voie saisie et villes de la réponse, retirées de sa fin (« 12 rue Leclerc France », « … Sées »). */
interface SaisieComparee {
  voie: string
  villes: readonly unknown[]
}

/**
 * Une voie de la commune autre que `rendue`, que la voie saisie désigne aussi (memeVoie) ? Cherchée par la forme de la
 * saisie qui désigne la voie rendue (« 12 rue Leclerc France » : par « leclerc », pas « france » ; sixième relecture du
 * 27/11/2026). Une panne vaut oui.
 */
async function autreVoieDesignee(adresse: AdresseDecomposee, saisie: SaisieComparee, rendue: string, demandees: VoiesDemandees): Promise<boolean> {
  const formes = formesSaisie(saisie.voie, [adresse.ville, ...saisie.villes])
  const rendues = formesSansParenthese(rendue)
  const forme = formes.find(f => rendues.some(r => memeVoie(f, r))) ?? formes[0]
  if (!forme) return false
  const voies = await voiesDistinctes(adresse, nomSansType(forme), demandees)
  if (voies === null) return true
  const designee = (nomVoie: string) => formesSansParenthese(nomVoie).some(voie => formes.some(forme => memeVoie(forme, voie)))
  return voies.some(nomVoie => cleVoie(nomVoie) !== cleVoie(rendue) && designee(nomVoie))
}

/**
 * Sans ville saisie, le code postal peut couvrir plusieurs communes (22400 : quinze, dont cinq ont une rue de l'Église ; pour
 * « 5 rue de l'Église », la BAN rend celle de Lamballe-Armor, relevé du 26/11/2026) : la voie rendue doit figurer parmi les
 * voies du code postal, et toutes les voies de ce nom être dans sa commune, déléguée comprise (« chemin de la Source » et
 * « Chemin Campagne la Source », toutes deux à Auriol, oui). Parenthèse de la réponse recopiée (« place de l'Église
 * (Andrezé) ») : seule cette voie compte.
 */
async function communeSure(adresse: AdresseDecomposee, saisie: string, reponse: ProprietesBan, demandees: VoiesDemandees): Promise<boolean> {
  if (adresse.ville) return true
  const { street, city, oldcity } = reponse
  const forme = typeof street === 'string' ? formesSansParenthese(street)[0] : undefined
  if (typeof street !== 'string' || !forme) return false
  const parenthese = parentheseDe(street)
  const recopiee = parenthese !== undefined && normaliserLieu(parenthese) === normaliserLieu(parentheseDe(adresse.rue) ?? '')
  // Une voie que la saisie désigne compte aussi (« 12 rue de Gaulle » : rue du Général de Gaulle ici, rue Charles de Gaulle
  // dans l'autre commune ; cinquième relecture du 26/11/2026).
  const formes = formesSaisie(saisie, [city, oldcity])
  const memeNom = (nomVoie: string) => recopiee
    ? cleVoie(nomVoie) === cleVoie(street)
    : formesSansParenthese(nomVoie).some(rendue => memeVoie(forme, rendue) || formes.some(f => memeVoie(f, rendue)))
  const homonymes = (await voiesNommees(adresse, nomSansType(forme), demandees))?.filter(voie => memeNom(voie.nom)) ?? []
  const commune = cleCommune(city, oldcity)
  return homonymes.some(voie => voie.commune === commune && cleVoie(voie.nom) === cleVoie(street))
    && homonymes.every(voie => voie.commune === commune)
}

/** Voie voisine (sauf si l'adresse écrit sa voie dans un autre morceau) ou commune déléguée : à confirmer par la BAN. */
function accordConfirme(accord: Accord, adresse: AdresseDecomposee, lue: Lecture, villes: readonly unknown[], street: string, demandees: VoiesDemandees): boolean | Promise<boolean> {
  if (accord === 'commune-deleguee') return seuleVoieDeCeNom(adresse, street, demandees)
  return accord === 'voie-voisine' && !lue.autreVoie && seuleVoieCompatible(adresse, lue.rue, villes, street, demandees)
}

/**
 * `lue` : numéro et voie lus dans la saisie (numeroEtVoieSaisis), ou null sans numéro de rue ; la réponse doit concorder
 * avec eux (accordAvecLaSaisie). Seconde recherche, avec la rue extraite d'une adresse à compléments : `lue` est cette rue,
 * et seul un numéro est admis (`numeroExige`, comme avant le 26/11 : « 5 Chemin rural », texte que la saisie « Chemin rural
 * n° 5 » n'a pas écrit, ne fait pas passer la rue entière au-dessus de son seuil). La commune déléguée d'une commune nouvelle
 * (`oldcity`) vaut ville de la réponse.
 */
async function parBaseAdresseNationale(adresse: AdresseDecomposee, lue: Lecture | null, demandees: VoiesDemandees, numeroExige = false): Promise<PositionAdresse | null> {
  const recherche = texteRecherche(adresse)
  if (recherche.length < 3) return null
  const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(recherche)}&limit=1${filtreCodePostal(adresse)}`, {
    signal: AbortSignal.timeout(DELAI_MS),
  })
  if (!res.ok) return null
  const premier = (await res.json() as ReponseBan).features?.[0]
  const coordonnees = premier?.geometry?.coordinates
  if (!coordonnees) return null
  const { type, score, postcode, city, oldcity, citycode, housenumber, street } = premier.properties ?? {}
  const villes = [city, oldcity]
  // La ville saisie vérifiée (memeCommune), les voies de même nom se cherchent dans la commune de la réponse.
  const commune = adresse.ville ? { ...adresse, codeCommune: communeEntiere(citycode) } : adresse
  let precise = aUneRue(adresse) && scoreBanSuffisant(type, score) && memeCommune(adresse, 'FR', postcode, villes)
    && (!numeroExige || type === 'housenumber')
  if (precise) {
    const accord = accordAvecLaSaisie(lue, adresse, villes, { type, housenumber, street })
    precise = accord === 'oui' || (lue !== null && typeof street === 'string' && await accordConfirme(accord, commune, lue, villes, street, demandees))
    precise = precise && await communeSure(adresse, voieSaisie(lue, adresse.rue, street), { street, city, oldcity }, demandees)
      && await villeSure(adresse, city, demandees)
  }
  return position(coordonnees[1], coordonnees[0], precise)
}

/**
 * La voie saisie telle que la juge accordAvecLaSaisie : celle de la lecture, ou toute la rue si la saisie n'a pas de numéro
 * de rue (y compris quand le nombre lu après la voie est celui de son nom : « avenue du 8 Mai 1945 »).
 */
const voieSaisie = (lue: Lecture | null, rue: string, street: unknown) =>
  lue && !(lue.apres && numeroDuNom(lue.rue, street)) ? lue.rue.voie : rue

/**
 * Ville saisie sans code postal : elle doit désigner une seule commune (douze communes « Sainte-Colombe » : « 1 place de
 * l'Église » était précis en Seine-et-Marne, le même n° 1 existe en Ille-et-Vilaine et dans le Lot ; sixième relecture du
 * 27/11/2026). Reconnue comme commune déléguée (oldcity), aucune commune ne doit porter ce nom. Une panne ou une page pleine
 * vaut non, voulu : « Saint-Étienne » (cinquante communes « Saint-Étienne-… ») et les noms de moins de trois lettres que la
 * BAN refuse de chercher (« Eu ») demandent alors le code postal.
 */
async function villeSure(adresse: AdresseDecomposee, city: unknown, demandees: VoiesDemandees): Promise<boolean> {
  if (adresse.codePostal || !adresse.ville) return true
  const ville = normaliserLieu(adresse.ville)
  const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(adresse.ville)}&type=municipality&limit=${LIMITE_VOIES_HOMONYMES}`
  const demande = demandees.get(url) ?? communesDeCeNom(url)
  demandees.set(url, demande)
  const communes = await demande
  if (communes === null) return false
  const homonymes = communes.filter(commune => commune.nom === ville).length
  return homonymes === (normaliserLieu(typeof city === 'string' ? city : '') === ville ? 1 : 0)
}

/** Communes que la BAN rend pour `url` (type=municipality), nom normalisé ; null en cas de panne ou sur une page pleine. */
async function communesDeCeNom(url: string): Promise<VoieLue[] | null> {
  const page = await pageDeLaBan(url, 'des communes homonymes')
  return page === null ? null : page
    .filter(commune => commune.type === 'municipality')
    .map(commune => ({ nom: normaliserLieu(commune.name ?? commune.city ?? ''), commune: '', codePostal: commune.postcode ?? '', code: '' }))
}

interface ReponseNominatim {
  lat?: string
  lon?: string
  place_rank?: number
  address?: Record<string, string | undefined>
}

/**
 * `comparaison` (France) : réponse jugée sur la saisie comme celle de la BAN, sans voie voisine (« 4 Cours » : OSM rendait
 * le 4 Cours Gouffé, une autre voie, le 25/11/2026), ni voie que la commune a en plusieurs exemplaires (voieAmbigue). Au
 * Portugal, pas de comparaison (règles de voie non vérifiées).
 */
async function parNominatim(adresse: AdresseDecomposee, pays: Pays, comparaison?: { lue: Lecture | null; demandees: VoiesDemandees }): Promise<PositionAdresse | null> {
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
  const villes = [lieu.city, lieu.town, lieu.village, municipaliteAdmise(adresse, pays) ? lieu.municipality : undefined, lieu.hamlet, lieu.suburb]
  const street = lieu.road ?? lieu.pedestrian ?? lieu.square
  const precise = aUneRue(adresse)
    && typeof premier.place_rank === 'number' && premier.place_rank >= RANG_MIN_NOMINATIM
    && memeCommune(adresse, pays, lieu.postcode, villes)
    && (!comparaison || accordAvecLaSaisie(comparaison.lue, adresse, villes, {
      type: lieu.house_number ? 'housenumber' : 'street',
      housenumber: lieu.house_number,
      street,
    }) === 'oui')
  const ambigue = precise && comparaison !== undefined && typeof street === 'string'
    && await voieAmbigue(adresse, street, { voie: voieSaisie(comparaison.lue, adresse.rue, street), villes }, comparaison.demandees)
  // Ville seule : comme pour la BAN, une seule commune de ce nom (septième relecture du 27/11/2026, Valence).
  const homonyme = precise && comparaison !== undefined && !ambigue
    && !(await villeSure(adresse, [lieu.city, lieu.town, lieu.village].find(v => memeNomDeVille(v, adresse.ville)), comparaison.demandees))
  return position(premier.lat, premier.lon, precise && !ambigue && !homonyme)
}

/**
 * OSM écrit dans `municipality` la commune nouvelle d'une commune déléguée (« Beaupréau-en-Mauges » pour Andrezé), mais
 * aussi l'arrondissement (« Valence » pour Bourg-lès-Valence, « Dieppe » pour Eu) : en France, il ne vaut ville qu'avec
 * un code postal, qui fixe la commune (« 1 place de la Liberté », Valence sans code postal, était précis à Bourg-lès-Valence,
 * à 790 m ; septième relecture du 27/11/2026).
 */
const municipaliteAdmise = (adresse: AdresseDecomposee, pays: Pays) => pays === 'PT' || adresse.codePostal !== ''
const memeNomDeVille = (nom: unknown, ville: string) => typeof nom === 'string' && normaliserLieu(nom) === normaliserLieu(ville)

/**
 * Position de l'adresse, ou null (introuvable, service injoignable ou trop lent). Ne lève jamais. Une position
 * imprécise (`precise: false`) peut servir à la météo, jamais au pointage.
 */
export async function geocoderAdresse(entree: AdresseChantier, pays: Pays): Promise<PositionAdresse | null> {
  const adresse = decomposerAdresse(entree, pays)
  if (!adresse.rue && !adresse.codePostal && !adresse.ville) return null
  try {
    if (pays === 'PT') return await parNominatim(adresse, 'PT')
    // Numéro et voie saisis : la réponse doit les porter, pas le centre de la rue ni une voie voisine au nom ressemblant.
    const lue = lireAdresse(adresse.rue)
    const demandees: VoiesDemandees = new Map()
    const ban = await parBaseAdresseNationale(adresse, lue, demandees)
    if (ban?.precise) return ban
    // Résidence, bâtiment ou étage autour de la rue : la BAN est moins sûre d'elle ; on lui redemande la rue seule, jugée
    // sur les mêmes règles (seuil, même code postal et même ville) et sur le numéro et la voie extraits. De même pour un
    // numéro écrit après la voie : « cours Mirabeau, 10 » rend le cours entier, « 10 cours Mirabeau » le n° 10 (relevé du
    // 26/11/2026). Une panne de cette seconde recherche ne perd ni la première réponse ni le secours Nominatim.
    const rueSeule = lue && (lue.apres || aDesComplements(lue, adresse.rue)) ? lue : null
    const banRue = rueSeule
      ? await parBaseAdresseNationale({ ...adresse, rue: rueSeule.rue.texte }, rueSeule, demandees, true).catch((erreur: unknown) => {
        console.warn('[btp] seconde recherche de l’adresse impossible :', erreur instanceof Error ? erreur.message : erreur)
        return null
      })
      : null
    if (banRue?.precise) return banRue
    // BAN imprécise ou muette : Nominatim peut connaître l'adresse exacte ; sinon on garde la meilleure réponse.
    const osm = await parNominatim(adresse, 'FR', { lue, demandees })
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
