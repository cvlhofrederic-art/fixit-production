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

/** Numéro de rue en un mot : « 10 », « 12B », « 4bis ». */
const NUMERO = /^(\d{1,4})(bis|ter|quater|quinquies|[a-d])?$/iu
/** Indice écrit à part (« 4 bis », « 12 B »). */
const INDICE_NUMERO = /^(?:bis|ter|quater|quinquies|[a-d])$/iu
/**
 * Plage d'un immeuble écrite d'un bloc (« 10-12 », « 10–12 », « 10/12 ») : la BAN rend l'un ou l'autre numéro (relevé du
 * 26/11/2026).
 */
const PLAGE_NUMEROS = /^(\d{1,4})[-–—/](\d{1,4})$/u
/** « n° », « nº », « no », « nr », « n. », « num. », « numéro » écrits devant le numéro ; collé au numéro : « N°10 ». */
const PREFIXE_NUMERO = /^(?:n[°º.]?|no\.?|nr\.?|num(?:[ée]ro|\.)?)$/iu
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
  'cellule', 'cellules', 'local', 'locaux', 'box', 'garage', 'garages', 'tranche', 'ilot', 'ilots', 'hall', 'cage',
]
/** Premier mot d'un complément qui suit parfois un numéro (« 2 étage », « 3 bât. B ») : ce numéro n'est pas celui de la rue. */
const MOTS_COMPLEMENT = new Set([...LOCAUX, 'etage', 'bat', 'batiment', 'escalier', 'esc', 'bloc', 'lot', 'niveau', 'case', 'bp', 'cs', 'n', 'bis', 'ter', 'quater'])
/**
 * Mot qui fait d'un numéro celui d'un complément (« Bât 3 », « Lot 12 », « Étage 2 », « Ét. 2 », « Local commercial 3 »,
 * « km 5 »), pas celui de la rue, même séparé de lui par un « n° » ou une ponctuation (« Lot n° 12 », « Lot : 12 »).
 */
const MOTS_AVANT_NUMERO = new Set([
  ...LOCAUX, 'bat', 'bt', 'bats', 'batiment', 'batiments', 'lot', 'lots', 'lotissement', 'villa', 'villas', 'maison', 'maisons',
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
  const complement = mots.findIndex((mot, i) => COMPLEMENT_FINAL.has(mot) || (DEBUT_COMPLEMENT.has(mot) && i < mots.length - 1))
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
const voieApresNumero = (voie: string) => aDesLettres(voie) && !MOTS_COMPLEMENT.has(premierMot(voie, false))
/** Morceau qui commence par un type de voie, un lieu-dit ou un hameau (« rue X », « Lieu-dit Les Granges »). */
const commenceParUneVoie = (mots: readonly string[]) =>
  mots.length > 1 && (TYPES_VOIE.has(premierMot(mots[0])) || premierMot(mots[0]) === 'lieu' || premierMot(mots[0]) === 'hameau')
/** Mot comparable à MOTS_AVANT_NUMERO : normalisé, sans article élidé (« l'étage ») ni « : » ou « # » collés (« Lot: »). */
const motComplement = (mot: string | undefined) => normaliserLieu(mot ?? '').replace(/^[ld] (?=\S)/u, '').replace(/[:#]+$/u, '')
/** Mot qui sépare un complément de son numéro : « n° » (« n°: » compris) ou ponctuation seule. */
const entreComplementEtNumero = (mot: string) => PREFIXE_NUMERO.test(mot.replace(/[:#]+$/u, '')) || PONCTUATION.test(mot)

/**
 * Le numéro du mot `i` est-il celui d'un complément ? Le mot qui le précède, au-delà d'un « n° » ou d'une ponctuation
 * (« Lot n° 12 », « Lot n°: 12 », « Lot : 12 »), est un complément (« Bât », « Lot », « Étage », « Lgt », « km ») ou un mot
 * abrégé (« Empl. 12 ») ; sauf un étage déjà numéroté (« 2e étage 10 rue X », « 2e ét. 10 ») et, `apresLaVoie`, un mot du
 * nom de la voie précédé d'un article (« rue de la Tour 5 », « rue du Lot 8 ») : au milieu d'un morceau, « Terrain du lot 12
 * rue X » est le lot 12 (relecture du 26/11/2026). Ou une référence cadastrale le précède dans le morceau (« section B
 * n° 10 », « cadastré AB 12 »).
 */
function precedeParUnComplement(mots: readonly string[], i: number, apresLaVoie = false): boolean {
  if (mots.slice(0, i).some(mot => MARQUEURS_CADASTRE.has(motComplement(mot)))) return true
  let j = i - 1
  while (j >= 0 && entreComplementEtNumero(mots[j])) j -= 1
  if (j < 0) return false
  const mot = motComplement(mots[j])
  const avant = motComplement(mots[j - 1])
  const complement = MOTS_AVANT_NUMERO.has(mot) || /\p{L}{2,}\.$/u.test(mots[j])
  const etageNumerote = ETAGES.has(mot) && ORDINAL.test(avant)
  return complement && !etageNumerote && !(apresLaVoie && ARTICLES.has(avant))
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

function lireAdresse(rue: string): Lecture | null {
  const morceaux: Morceaux = morceauxAdresse(rue).map(morceau => morceau.split(' '))
  const lue = numeroDevant(morceaux) ?? numeroAuMilieu(morceaux) ?? numeroApres(morceaux)
  if (!lue) return null
  return { ...lue, autreVoie: morceaux.some((mots, k) => !lue.morceaux.includes(k) && commenceParUneVoie(mots)) }
}

/** 1. Morceau qui commence par le numéro (« 10 rue X »), ou numéro seul suivi de la voie (« 10, rue X »). */
function numeroDevant(morceaux: Morceaux): Lecture | null {
  for (const [k, mots] of morceaux.entries()) {
    const numero = lireNumero(mots, 0)
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
  return DEBUT_COMPLEMENT.has(premier) || MOTS_COMPLEMENT.has(premier) || COMPLEMENT_FINAL.has(premier)
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
    const voie = voieDuMorceauSuivant(morceaux[indice])
    if (voie !== null) return voieApresNumero(voie) ? lecture(numero, voie, `${texte(morceaux[k])} ${voie}`, [k, indice]) : null
  }
  return null
}

/**
 * Voie d'un morceau qui suit un numéro seul : le morceau entier ; d'un complément (« Bât B », « 2e étage »), seulement la
 * voie collée à lui (« Bât B rue Paradis ») ; un type de voie précédé d'un article est un nom (« Résidence Les Allées du
 * Parc »). Null : morceau à sauter.
 */
function voieDuMorceauSuivant(mots: readonly string[]): string | null {
  if (!estUnComplement(mots)) return texte(mots)
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
    let i = 1
    while (i < mots.length) {
      const numero = precedeParUnComplement(mots, i) ? null : lireNumero(mots, i)
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
    const voie = k > 0 && commenceParUneVoie(morceaux[k - 1]) ? morceaux[k - 1] : null
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
 * Sans numéro de rue lu : un nombre de la saisie que la voie rendue n'explique pas peut être un numéro écrit d'une façon
 * non lue (« 45+47 route des Camoins ») ; le centre de la rue n'est alors pas précis (« 45–47 », non lu avant le 26/11,
 * mettait le point à 270 m). Les ordinaux (« 2e étage ») et les nombres du nom de la voie (« avenue du 8 Mai 1945 ») sont
 * expliqués.
 */
function nombreInexplique(rue: string, street: unknown): boolean {
  const duNom = typeof street === 'string' ? nombresDuNom(street) : []
  return normaliserLieu(rue).split(' ').map(mot => cleNumero(mot.replace(PREFIXE_COLLE, '')))
    .some(mot => /^\d/.test(mot) && !ORDINAL.test(mot) && !duNom.includes(mot))
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

/** Voie lue dans la BAN : son nom et sa commune (déléguée comprise), pour ne compter qu'une fois un doublon de la BAN. */
interface VoieLue {
  nom: string
  commune: string
}

/** Voies de la commune déjà demandées à la BAN pendant un géocodage (même recherche pour la première et la seconde réponse). */
type VoiesDemandees = Map<string, Promise<VoieLue[] | null>>

/**
 * Voies de la commune saisie que la BAN rend pour `url` (type=street) ; null en cas de panne, ou sur une page pleine (des
 * voies ont pu être coupées).
 */
async function voiesDeLaCommune(url: string, adresse: AdresseDecomposee): Promise<VoieLue[] | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(DELAI_MS) })
    if (!res.ok) return null
    const trouvees = (await res.json() as ReponseBan).features ?? []
    if (trouvees.length >= LIMITE_VOIES_HOMONYMES) return null
    return trouvees.map(voie => voie.properties ?? {})
      .filter(voie => voie.type === 'street' && memeCommune(adresse, 'FR', voie.postcode, [voie.city, voie.oldcity]))
      .flatMap(voie => {
        const nom = voie.name ?? voie.street
        return typeof nom === 'string' ? [{ nom, commune: normaliserLieu(`${voie.city ?? ''} ${voie.oldcity ?? ''}`) }] : []
      })
  } catch (erreur) {
    console.warn('[btp] vérification des voies de la commune impossible :', erreur instanceof Error ? erreur.message : erreur)
    return null
  }
}

/**
 * Une voie voisine (voieVoisine) n'est admise que si la commune n'a qu'une voie dont le nom contient, dans l'ordre, celui
 * qui est saisi sans son type, quels que soient le type et les mots en plus de cette voie : « 10 République » dans le 13001
 * (la seule rue de la République) oui ; « 10 Alésia » dans le 75014 (rue et villa d'Alésia, deux n° 10 à 824 m), « 2 Le
 * Clos » à Auriol (rue, chemin, clos…) ou « place de l'Église » dans le 49120 (trois places) non (relevés du 26/11/2026).
 * Une panne ou une réponse illisible vaut non.
 */
async function seuleVoieCompatible(adresse: AdresseDecomposee, lue: RueSeule, villesReponse: readonly unknown[], street: string, demandees: VoiesDemandees): Promise<boolean> {
  const formes = formesSaisie(lue.voie, [adresse.ville, ...villesReponse])
  const rendues = [...formesRendues(street, adresse.ville), ...formesSansParenthese(street)]
  const typeOublie = nomNu(lue.voie)
  const forme = formes.find(f => rendues.some(rendue => voieVoisine(f, rendue, typeOublie)))
  if (!forme) return false
  const nom = nomSansType(forme)
  const homonymes = (await voiesDistinctes(adresse, nom, demandees))
    ?.filter(nomVoie => formesRendues(nomVoie, adresse.ville).some(rendue => motsInseres(nom, rendue) !== null))
  return homonymes?.length === 1 && cleVoie(homonymes[0]) === cleVoie(street)
}

/**
 * Voies distinctes de la commune pour un nom : les doublons de la BAN (même nom, parenthèse comprise, même commune : « Place
 * de l'église saint martin (Noyant) » deux fois, à 25 m) ne comptent qu'une fois (relevé du 26/11/2026 à Noyant-Villages) ;
 * sans ville saisie, la rue du même nom de deux communes du code postal compte deux fois.
 */
async function voiesDistinctes(adresse: AdresseDecomposee, nom: readonly string[], demandees: VoiesDemandees): Promise<string[] | null> {
  const voies = await voiesNommees(adresse, nom, demandees)
  return voies === null ? null : [...new Map(voies.map(voie => [`${cleVoie(voie.nom)}|${voie.commune}`, voie.nom])).values()]
}

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
 * Voies de la commune saisie dont la BAN rapproche le nom de `nom` (type=street) : filtrées par le code postal et par la
 * commune de la réponse (codeCommune), ou ville ajoutée à la recherche sans l'un ni l'autre. Demandées une fois par
 * géocodage ; null si le nom est trop court, en panne ou sur une page pleine.
 */
function voiesNommees(adresse: AdresseDecomposee, nom: readonly string[], demandees: VoiesDemandees): Promise<VoieLue[] | null> {
  const filtre = `${filtreCodePostal(adresse)}${filtreCommune(adresse)}`
  const recherche = filtre ? nom.join(' ') : `${nom.join(' ')} ${adresse.ville}`.trim()
  if (nom.join(' ').length < 3) return Promise.resolve(null)
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
 * voies de ce nom, ou aucune de ce nom exact et plusieurs qui le prolongent. Une voie que la BAN ne connaît pas n'est pas
 * ambiguë ; une panne vaut oui.
 */
async function voieAmbigue(adresse: AdresseDecomposee, rendue: string, demandees: VoiesDemandees): Promise<boolean> {
  const forme = formesSansParenthese(rendue)[0]
  if (!forme) return false
  const homonymes = await homonymesDe(adresse, forme, demandees)
  if (homonymes === null) return true
  return homonymes.memes.length > 1 || (homonymes.memes.length === 0 && homonymes.prolongees.length > 1)
}

/**
 * Sans ville saisie, le code postal peut couvrir plusieurs communes (22400 : quinze, dont cinq ont une rue de l'Église ; pour
 * « 5 rue de l'Église », la BAN rend celle de Lamballe-Armor, relevé du 26/11/2026) : la voie rendue doit y être la seule de
 * ce nom.
 */
function communeSure(adresse: AdresseDecomposee, street: unknown, demandees: VoiesDemandees): boolean | Promise<boolean> {
  if (adresse.ville) return true
  return typeof street === 'string' && seuleVoieDeCeNom(adresse, street, demandees)
}

/** Voie voisine (sauf si l'adresse écrit sa voie dans un autre morceau) ou commune déléguée : à confirmer par la BAN. */
function accordConfirme(accord: Accord, adresse: AdresseDecomposee, lue: Lecture, villes: readonly unknown[], street: string, demandees: VoiesDemandees): boolean | Promise<boolean> {
  if (accord === 'commune-deleguee') return seuleVoieDeCeNom(adresse, street, demandees)
  return accord === 'voie-voisine' && !lue.autreVoie && seuleVoieCompatible(adresse, lue.rue, villes, street, demandees)
}

/**
 * `lue` : numéro et voie lus dans la saisie (numeroEtVoieSaisis), ou null sans numéro de rue ; la réponse doit concorder
 * avec eux (accordAvecLaSaisie). Seconde recherche, avec la rue extraite d'une adresse à compléments : `lue` est cette rue.
 * La commune déléguée d'une commune nouvelle (`oldcity`) vaut ville de la réponse.
 */
async function parBaseAdresseNationale(adresse: AdresseDecomposee, lue: Lecture | null, demandees: VoiesDemandees): Promise<PositionAdresse | null> {
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
  const commune = adresse.ville ? { ...adresse, codeCommune: citycode } : adresse
  let precise = aUneRue(adresse) && scoreBanSuffisant(type, score) && memeCommune(adresse, 'FR', postcode, villes)
  if (precise) {
    const accord = accordAvecLaSaisie(lue, adresse, villes, { type, housenumber, street })
    precise = accord === 'oui' || (lue !== null && typeof street === 'string' && await accordConfirme(accord, commune, lue, villes, street, demandees))
    precise = precise && await communeSure(adresse, street, demandees)
  }
  return position(coordonnees[1], coordonnees[0], precise)
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
  const villes = [lieu.city, lieu.town, lieu.village, lieu.municipality, lieu.hamlet, lieu.suburb]
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
    && await voieAmbigue(adresse, street, comparaison.demandees)
  return position(premier.lat, premier.lon, precise && !ambigue)
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
      ? await parBaseAdresseNationale({ ...adresse, rue: rueSeule.rue.texte }, rueSeule, demandees).catch((erreur: unknown) => {
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
