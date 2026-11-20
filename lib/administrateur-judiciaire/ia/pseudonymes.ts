/**
 * Pseudonymes des personnes avant l'envoi au modèle d'IA (décision du 20/11/2026). Dans le contexte, l'historique et la
 * question, les noms des copropriétaires (débiteurs compris), des prestataires et des personnes citées avec leur
 * civilité sont remplacés par des pseudonymes qui ne peuvent pas passer pour des noms : « Copropriétaire 1 »,
 * « Prestataire 2 », « Personne 3 ». `retablir` remet les vrais noms dans la réponse affichée : l'écran ne change pas.
 * Un numéro déjà écrit dans les données (« le copropriétaire 2 du lot 9 ») n'est attribué à personne : la réponse qui
 * le reprend ne reçoit pas un nom au hasard.
 *
 * La table de correspondance n'existe que dans la fermeture de `retablir`, le temps de la requête : rien ne l'exporte,
 * `JSON.stringify` ne la voit pas, elle ne va ni au journal ni dans une trace.
 *
 * Reconnaissance, dans cet ordre (un passage remplacé n'est plus relu) :
 * 1. nom complet (et nom inversé), civilité facultative, quelle que soit la casse, avec ou sans accents, espace ou trait
 *    d'union entre les mots. Prestataires (sociétés, mais aussi entrepreneurs individuels, que rien ne distingue dans
 *    la base) : nom complet seulement, pour ne pas remplacer un mot courant de leur raison sociale ;
 * 2. partie du nom d'une personne : plusieurs mots du nom côte à côte, quelle que soit la casse ; un seul mot (nom de
 *    famille, prénom, nom composé), précédé d'une civilité ou écrit avec une majuscule initiale (un mot seul en
 *    minuscules est un nom commun : « un roc », « couvreur »). Une partie portée par plusieurs personnes devient
 *    « Copropriétaire 1 ou Copropriétaire 2 ». Un mot qui figure aussi dans le nom d'une copropriété, un métier ou une
 *    ville n'est remplacé seul qu'avec sa civilité ;
 * 3. civilité suivie d'un nom absent des listes (« Mme X » dans une note ou dans la question), sur la même ligne :
 *    « Personne N ».
 * Jamais à l'intérieur d'un autre mot : une partie n'est reconnue ni collée à une lettre ni reliée par un trait d'union.
 * Une élision devant un nom remplacé reprend sa forme pleine (« le lot d'Ondine » → « le lot de Copropriétaire 1 ») ;
 * le rétablissement la refait selon l'initiale du vrai nom.
 */

type Role = 'Copropriétaire' | 'Prestataire' | 'Personne'

interface Champ {
  /** Chemin de la liste dans le contexte construit par `construireContexteAgent`. */
  liste: readonly string[]
  champ: string
}

/** Champs du contexte qui portent un nom. Tout nouveau champ de nom du contexte (contexte-agent.ts) se déclare ici. */
const CHAMPS_NOMS: ReadonlyArray<Champ & { role: Exclude<Role, 'Personne'> }> = [
  { liste: ['coproprietairesDebiteurs'], champ: 'nom', role: 'Copropriétaire' },
  { liste: ['dossiersImpayes'], champ: 'debiteur', role: 'Copropriétaire' },
  { liste: ['prestataires'], champ: 'nom', role: 'Prestataire' },
  { liste: ['contrats'], champ: 'prestataire', role: 'Prestataire' },
  { liste: ['ecransDemonstration', 'ordresDeService'], champ: 'presta', role: 'Prestataire' },
]

/** Champs qui ne désignent pas des personnes : leurs mots ne sont pas remplacés seuls (copropriété au nom d'une rue…). */
const CHAMPS_PROTEGES: readonly Champ[] = [
  { liste: ['coproprietes'], champ: 'nom' },
  { liste: ['prestataires'], champ: 'metier' },
  { liste: ['prestataires'], champ: 'ville' },
]

/** Civilités (forme repliée) → forme commune : « M. X » et « Monsieur X » sont la même personne citée. */
const CIVILITES: ReadonlyMap<string, string> = new Map([
  ['m', 'm'], ['m.', 'm'], ['mm.', 'm'], ['mr', 'm'], ['mr.', 'm'], ['monsieur', 'm'],
  ['mme', 'mme'], ['mmes', 'mme'], ['madame', 'mme'], ['mlle', 'mlle'], ['mademoiselle', 'mlle'],
  ['me', 'me'], ['maitre', 'me'], ['dr', 'dr'], ['dr.', 'dr'], ['docteur', 'dr'],
])

/** Mots qui ne désignent personne à eux seuls : particules, formes juridiques, civilités, « née », « & Fils ». */
const MOTS_NEUTRES: ReadonlySet<string> = new Set([
  'de', 'du', 'des', 'd', 'la', 'le', 'les', 'l', 'van', 'von', 'der', 'den', 'da', 'di', 'do', 'dos', 'das', 'del', 'e', 'y', 'et',
  'epouse', 'epoux', 'ep', 'veuve', 'vve', 'nee', 'sci', 'sarl', 'sas', 'sasu', 'sa', 'eurl', 'snc', 'ei', 'eirl', 'scp', 'sel',
  'selarl', 'indivision', 'consorts', 'cts', 'succession', 'heritiers', 'famille', 'societe', 'ste', 'cie', 'fils', 'freres',
  'associes',
  ...CIVILITES.keys(),
])

/** Civilité, sans tenir compte de la casse (étapes 1 et 2). */
const CIVILITE = String.raw`(?:mm?\.|mmes?|mlle|monsieur|madame|mademoiselle|ma[iî]tre|me|mr\.?|dr\.?|docteur|m)`
/** Civilité telle qu'on l'écrit (étape 3 : sensible à la casse, pour ne pas lire « me » ou « m » dans une phrase). */
const CIVILITE_ECRITE = String.raw`(?:MM?\.|Mmes?|MMES?|Mlle|MLLE|Monsieur|MONSIEUR|Madame|MADAME|Mademoiselle|MADEMOISELLE|Ma[iî]tre|MA[IÎ]TRE|Me|Mr\.?|Dr\.?|Docteur)`
/** Civilité en tête d'un nom de la base (forme repliée). */
const CIVILITE_DE_TETE = new RegExp(String.raw`^(?:(?:${[...CIVILITES.keys()].map((c) => c.replaceAll('.', String.raw`\.`)).join('|')})\s+)+`)
/** Pas de lettre, de chiffre ni de trait d'union collé au nom. */
const AVANT = String.raw`(?<![\p{L}\p{N}\-\u2010\u2011])`
const APRES = String.raw`(?![\p{L}\p{N}\-\u2010\u2011])`
const SEPARATEUR = String.raw`[\s\-\u2010\u2011]+`
const APOSTROPHE = String.raw`['\u2019\u02BC]`
const MOT_NOM = String.raw`\p{Lu}[\p{L}'\u2019\-]*`
/** Espaces d'une même ligne : le mot qui ouvre la ligne suivante (« Client : … ») n'appartient pas au nom. */
const ESPACE_LIGNE = String.raw`[^\S\r\n]+`
/** Étape 3 : civilité suivie d'un à trois mots à majuscule (« M. le Président » n'en est pas un), sur la même ligne. */
const PERSONNE_CITEE = new RegExp(
  String.raw`(?<![\p{L}\p{N}])(${CIVILITE_ECRITE})${ESPACE_LIGNE}((?:(?:de|du|des)${ESPACE_LIGNE}|d${APOSTROPHE})?${MOT_NOM}(?:${ESPACE_LIGNE}${MOT_NOM}){0,2})`,
  'gu',
)

/** Jeton provisoire (caractères d'usage privé) : un passage remplacé n'est plus relu par les étapes suivantes. */
const DEBUT_JETON = '\uE000'
const FIN_JETON = '\uE001'
const RESERVES = /[\uE000\uE001]/g
const JETON = /\uE000(\d+)\uE001/g
/** Parties d'un même nom remplacées une à une (« Prénom Nom-composé ») : un seul pseudonyme. */
const JETONS_REPETES = new RegExp(String.raw`(\uE000(\d+)\uE001)(?:${SEPARATEUR}\uE000\2\uE001)+`, 'gu')

/** Élision devant un jeton (« d'Ondine », « qu'Éloïse ») : forme pleine devant le pseudonyme. */
const ELISION_DEVANT_JETON = new RegExp(
  String.raw`(?<![\p{L}\p{N}])(d|qu|jusqu|lorsqu|puisqu|quoiqu)${APOSTROPHE}(?=${JETON.source})`,
  'giu',
)

/**
 * Pseudonymes dans la réponse du modèle : casse, « n° », « numéro », « # » et liste au pluriel tolérés. Un déterminant
 * (« le copropriétaire 4 ») est capturé pour garder le rôle en nom commun devant le vrai nom ; « de » ou « que »
 * (élidés ou non), pour refaire l'élision selon l'initiale du vrai nom.
 */
const ROLE = String.raw`(copropri[ée]taire|prestataire|personne)`
const NUMERO = String.raw`\s+(?:(?:n[°º]|num[ée]ro|#)\s*)?`
const LISTE_NUMEROS = String.raw`\d{1,4}(?:(?:\s*,\s*|\s+(?:et|ou)\s+)\d{1,4})`
const DETERMINANT = String.raw`(le|la|les|du|des|au|aux|un|une|ce|cet|cette|ces|chaque|ledit|ladite|dudit|audit)\s+`
const ELIDABLE = String.raw`(d|qu|jusqu|lorsqu|puisqu|quoiqu)(?:e\s+|${APOSTROPHE}\s*)`
const PSEUDONYME = new RegExp(
  String.raw`(?<![\p{L}\p{N}])(?:${DETERMINANT}|${ELIDABLE})?${ROLE}${NUMERO}(\d{1,4})(?!\d)`,
  'giu',
)
const PSEUDONYMES_PLURIEL = new RegExp(
  String.raw`(?<![\p{L}\p{N}])(?:${DETERMINANT})?${ROLE}s\s+(${LISTE_NUMEROS}+)(?!\s?\d)`,
  'giu',
)
/** Pseudonymes déjà écrits dans les données (singulier ou liste) : leurs numéros ne sont pas attribués. */
const PSEUDONYMES_PRESENTS = new RegExp(String.raw`(?<![\p{L}\p{N}])${ROLE}s?${NUMERO}(${LISTE_NUMEROS}*)`, 'giu')

/** Clé repliée d'un rôle → rôle, et rôle écrit en nom commun après un déterminant. */
const ROLES: ReadonlyMap<string, { role: Role; nomCommun: string }> = new Map([
  ['coproprietaire', { role: 'Copropriétaire', nomCommun: 'copropriétaire' }],
  ['prestataire', { role: 'Prestataire', nomCommun: 'prestataire' }],
  ['personne', { role: 'Personne', nomCommun: 'personne' }],
])

/** Lettre de base → lettre et ses formes accentuées (minuscules). */
const VARIANTES: Readonly<Record<string, string>> = {
  a: 'aàâäáãå', c: 'cç', e: 'eéèêë', i: 'iîïíì', n: 'nñ', o: 'oôöóòõ', u: 'uùûüú', y: 'yÿý',
}

const PROFONDEUR_MAX = 50

/**
 * Casse d'un morceau d'expression : « insensible » (expression compilée avec le drapeau i), « majuscule » (première
 * lettre d'un nom propre), « indifférente » (lettres suivantes d'un nom propre, expression sans le drapeau i).
 */
type Casse = 'insensible' | 'majuscule' | 'indifferente'

interface Entite {
  pseudonyme: string
  jeton: string
}

/** État d'une requête : vit dans la fermeture de `pseudonymiserNoms`, jamais exporté. */
interface Etat {
  compteurs: Record<Role, number>
  /** Numéros déjà écrits dans les données (« le copropriétaire 2 ») : jamais attribués. */
  reserves: Record<Role, Set<number>>
  /** Pseudonyme (clé repliée, « coproprietaire 1 ») → vrai nom. */
  noms: Map<string, string>
  /** Texte de chaque jeton provisoire (un pseudonyme, ou plusieurs reliés par « ou »). */
  jetons: string[]
  /** Personnes citées avec leur civilité : clé → jeton. */
  citees: Map<string, string>
}

interface Reconnaissance {
  /** Étape 1 : noms complets et parties de plusieurs mots, civilité facultative, casse indifférente. */
  complets: RegExp | null
  jetonDuNom: ReadonlyMap<string, string>
  /** Étape 2 : parties d'un seul mot précédées d'une civilité (casse indifférente). */
  partiesAvecCivilite: RegExp | null
  /** Étape 2 : parties d'un seul mot écrites comme un nom propre (majuscule initiale exigée par l'expression). */
  partiesNomPropre: RegExp | null
  jetonDeLaPartie: ReadonlyMap<string, string>
  /** Texte replié des champs protégés, chaque mot entre espaces. */
  protege: string
}

export interface Pseudonymisation<T> {
  /** Données à envoyer au modèle : noms remplacés par les pseudonymes. */
  donnees: T
  /** Texte du modèle → vrais noms rétablis ; un pseudonyme absent de la table reste tel quel. */
  retablir: (texte: string) => string
}

/** Minuscules, sans accents, « œ » et « æ » développés, apostrophes et espaces unifiées (traits d'union gardés). */
function replier(texte: string): string {
  return texte
    .normalize('NFD')
    .replaceAll(/\p{M}/gu, '')
    .toLowerCase()
    .replaceAll(/œ/g, 'oe')
    .replaceAll(/æ/g, 'ae')
    .replaceAll(/[\u2019\u02BC]/g, "'")
    .replaceAll(/\s+/g, ' ')
    .trim()
}

/** Clé de comparaison d'un nom : forme repliée, trait d'union lu comme une espace. */
const cle = (texte: string): string => replier(texte).replaceAll(/[-\u2010\u2011]+/g, ' ').replaceAll(/ {2,}/g, ' ').trim()

const echapper = (caractere: string) => caractere.replaceAll(/[.*+?^${}()|[\]\\/]/g, String.raw`\$&`)

function classeLettre(lettre: string, casse: Casse): string {
  const minuscules = VARIANTES[lettre] ?? lettre
  if (casse === 'insensible') return `[${minuscules}]`
  const majuscules = minuscules.toUpperCase()
  return casse === 'majuscule' ? `[${majuscules}]` : `[${minuscules}${majuscules}]`
}

function classe(caractere: string, casse: Casse): string {
  if (caractere === ' ') return SEPARATEUR
  if (caractere === "'") return APOSTROPHE
  return /\p{L}/u.test(caractere) ? classeLettre(caractere, casse) : echapper(caractere)
}

/** « oe » ou « œ » (et « ae » ou « æ ») : la base garde l'une ou l'autre graphie. */
function ligature(morceau: string, casse: Casse): string {
  const lie = morceau === 'oe' ? 'œ' : 'æ'
  const suite: Casse = casse === 'majuscule' ? 'indifferente' : casse
  const formeLiee = casse === 'insensible' ? lie : classeLettre(lie, casse)
  return `(?:${classe(morceau[0], casse)}${classe(morceau[1], suite)}|${formeLiee})`
}

function casseDuMorceau(nomPropre: boolean, position: number): Casse {
  if (!nomPropre) return 'insensible'
  return position === 0 ? 'majuscule' : 'indifferente'
}

/** Expression d'une clé : chaque lettre avec ses accents, « oe » ou « œ », espace ou trait d'union entre les mots. */
const motif = (cleNom: string, nomPropre: boolean): string =>
  cleNom.replaceAll(/oe|ae|[\s\S]/gu, (morceau: string, position: number) => {
    const casse = casseDuMorceau(nomPropre, position)
    return morceau.length === 2 ? ligature(morceau, casse) : classe(morceau, casse)
  })

const alternative = (cles: readonly string[], nomPropre: boolean) => cles.map((c) => motif(c, nomPropre)).join('|')
const plusLonguesDabord = (cles: Iterable<string>) => [...cles].sort((a, b) => b.length - a.length)

/** Étape 1 et parties avec civilité : civilité (facultative ou exigée) puis l'une des clés, casse indifférente. */
function expressionAvecCivilite(cles: Iterable<string>, civiliteExigee: boolean): RegExp | null {
  const triees = plusLonguesDabord(cles)
  if (triees.length === 0) return null
  const civilite = String.raw`(?:(${CIVILITE})\s+)${civiliteExigee ? '' : '?'}`
  return new RegExp(`${AVANT}${civilite}(${alternative(triees, false)})${APRES}`, 'giu')
}

/** Parties sans civilité : majuscule initiale exigée par l'expression (une partie en minuscules n'est pas lue). */
function expressionNomPropre(cles: Iterable<string>): RegExp | null {
  const triees = plusLonguesDabord(cles)
  if (triees.length === 0) return null
  return new RegExp(`${AVANT}(${alternative(triees, true)})${APRES}`, 'gu')
}

const estObjet = (valeur: unknown): valeur is Record<string, unknown> =>
  typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur)

function valeurs(contexte: Record<string, unknown>, { liste, champ }: Champ): string[] {
  const noeud = liste.reduce<unknown>((courant, etape) => (estObjet(courant) ? courant[etape] : undefined), contexte)
  if (!Array.isArray(noeud)) return []
  return noeud.flatMap((element) => (estObjet(element) && typeof element[champ] === 'string' ? [element[champ] as string] : []))
}

const distinctif = (mot: string) => /\p{L}{2}/u.test(mot) && !MOTS_NEUTRES.has(mot)

/** Nom de la base : forme exacte sans civilité de tête, et ses mots (ponctuation retirée). */
function analyserNom(nom: string): { exact: string; mots: string[] } {
  const exact = cle(nom).replace(CIVILITE_DE_TETE, '')
  const mots = exact.split(/[^\p{L}\p{N}'.]+/u).filter((mot) => /[\p{L}\p{N}]/u.test(mot))
  return { exact: mots.length ? exact : '', mots }
}

/** Parties reconnues seules : suites de mots qui commencent et finissent par un mot distinctif, mot après « d' ». */
function partiesDuNom(mots: readonly string[]): string[] {
  const longueurMax = Math.max(1, mots.length - 1)
  const parties: string[] = []
  for (let debut = 0; debut < mots.length; debut++) {
    for (let fin = debut + 1; fin <= Math.min(mots.length, debut + longueurMax); fin++) {
      if (distinctif(mots[debut]) && distinctif(mots[fin - 1])) parties.push(mots.slice(debut, fin).join(' '))
    }
  }
  const apresElision = mots.flatMap((mot) => /^[dl]'(.+)$/.exec(mot)?.[1] ?? []).filter(distinctif)
  return [...parties, ...apresElision]
}

/** Nom exact, nom sans ponctuation et nom inversé (« Nom Prénom ») ; un prestataire se reconnaît même à un seul mot. */
function variantesCompletes(exact: string, mots: readonly string[], role: Role): string[] {
  const sansPonctuation = mots.join(' ')
  if (role === 'Prestataire') return [exact, sansPonctuation]
  if (mots.length < 2) return []
  return [exact, sansPonctuation, [...mots.slice(-1), ...mots.slice(0, -1)].join(' ')]
}

function nouveauJeton(etat: Etat, texte: string): string {
  etat.jetons.push(texte)
  return `${DEBUT_JETON}${etat.jetons.length - 1}${FIN_JETON}`
}

function nouvelleEntite(etat: Etat, role: Role, nom: string): Entite {
  do {
    etat.compteurs[role] += 1
  } while (etat.reserves[role].has(etat.compteurs[role]))
  const pseudonyme = `${role} ${etat.compteurs[role]}`
  etat.noms.set(cle(pseudonyme), nom)
  return { pseudonyme, jeton: nouveauJeton(etat, pseudonyme) }
}

/** Personne citée hors des listes (ou graphie que les étapes 1 et 2 n'ont pas su rattacher) : « Personne N ». */
function personneCitee(etat: Etat, texte: string, civilite?: string, nom?: string): string {
  const cleCitee = civilite && nom ? `${CIVILITES.get(replier(civilite)) ?? replier(civilite)} ${cle(nom)}` : cle(texte)
  const existant = etat.citees.get(cleCitee)
  if (existant) return existant
  const { jeton } = nouvelleEntite(etat, 'Personne', texte)
  etat.citees.set(cleCitee, jeton)
  return jeton
}

function ajouter<V>(table: Map<string, V[]>, cleTable: string, valeur: V): void {
  const liste = table.get(cleTable) ?? []
  if (!liste.includes(valeur)) liste.push(valeur)
  table.set(cleTable, liste)
}

/** Noms déjà rencontrés dans les listes du contexte. */
interface Repertoire {
  /** Clé du nom → entité : deux fiches au même nom (deux lots) sont une seule personne pour le modèle. */
  entites: Map<string, Entite>
  /** Variante complète du nom → jeton. */
  complets: Map<string, string>
  /** Partie du nom → personnes qui la portent. */
  parties: Map<string, Entite[]>
}

function enregistrerNom(repertoire: Repertoire, etat: Etat, nom: string, role: Role): void {
  const { exact, mots } = analyserNom(nom)
  const cleNom = mots.join(' ')
  if (!exact || repertoire.entites.has(cleNom)) return
  const entite = nouvelleEntite(etat, role, nom.trim())
  repertoire.entites.set(cleNom, entite)
  for (const variante of variantesCompletes(exact, mots, role)) {
    if (!repertoire.complets.has(variante)) repertoire.complets.set(variante, entite.jeton)
  }
  if (role === 'Prestataire') return
  for (const partie of partiesDuNom(mots)) ajouter(repertoire.parties, partie, entite)
}

/** Noms des listes du contexte → entités numérotées dans l'ordre du contexte, expressions des étapes 1 et 2. */
function construireReconnaissance(contexte: Record<string, unknown>, etat: Etat): Reconnaissance {
  const repertoire: Repertoire = { entites: new Map(), complets: new Map(), parties: new Map() }
  for (const source of CHAMPS_NOMS) {
    for (const nom of valeurs(contexte, source)) enregistrerNom(repertoire, etat, nom, source.role)
  }
  const { complets, parties } = repertoire
  // Partie portée par plusieurs personnes : le modèle voit les candidats et peut demander laquelle.
  const jetonDeLaPartie = new Map(
    [...parties].map(([partie, liste]) => [
      partie,
      liste.length === 1 ? liste[0].jeton : nouveauJeton(etat, liste.map((e) => e.pseudonyme).join(' ou ')),
    ]),
  )
  // Plusieurs mots d'un nom côte à côte ne sont pas des mots courants : reconnus quelle que soit la casse, comme le nom
  // complet. Un mot seul (« roc », « petit ») doit être écrit comme un nom propre ou suivre une civilité.
  const plusieursMots = [...jetonDeLaPartie.keys()].filter((partie) => partie.includes(' '))
  const motsSeuls = [...jetonDeLaPartie.keys()].filter((partie) => !partie.includes(' '))
  const valeursProtegees = CHAMPS_PROTEGES.flatMap((champ) => valeurs(contexte, champ))
  return {
    complets: expressionAvecCivilite([...complets.keys(), ...plusieursMots], false),
    jetonDuNom: complets,
    partiesAvecCivilite: expressionAvecCivilite(motsSeuls, true),
    partiesNomPropre: expressionNomPropre(motsSeuls),
    jetonDeLaPartie,
    protege: ` ${valeursProtegees.map((valeur) => replier(valeur).replaceAll(/'/g, ' ')).join(' | ')} `,
  }
}

/** Étape 1 : noms complets (prioritaires sur une partie identique du nom d'une autre personne), parties de plusieurs mots. */
function remplacerNomsComplets(texte: string, reco: Reconnaissance, etat: Etat): string {
  if (!reco.complets) return texte
  return texte.replaceAll(reco.complets, (brut: string, _civilite: string | undefined, nom: string) => {
    const cleNom = cle(nom)
    return reco.jetonDuNom.get(cleNom) ?? reco.jetonDeLaPartie.get(cleNom) ?? personneCitee(etat, brut)
  })
}

/** Étape 2 : mot seul d'un nom précédé d'une civilité, puis écrit comme un nom propre hors des mots protégés. */
function remplacerParties(texte: string, reco: Reconnaissance, etat: Etat): string {
  const jetonDe = (brut: string, partie: string) => reco.jetonDeLaPartie.get(cle(partie)) ?? personneCitee(etat, brut)
  const avecCivilite = reco.partiesAvecCivilite
    ? texte.replaceAll(reco.partiesAvecCivilite, (brut: string, _civilite: string, partie: string) => jetonDe(brut, partie))
    : texte
  if (!reco.partiesNomPropre) return avecCivilite
  return avecCivilite.replaceAll(reco.partiesNomPropre, (brut: string, partie: string) =>
    reco.protege.includes(` ${cle(partie)} `) ? brut : jetonDe(brut, partie),
  )
}

/** Étape 3 : personnes citées avec leur civilité, absentes des listes. */
const remplacerPersonnesCitees = (texte: string, etat: Etat): string =>
  texte.replaceAll(PERSONNE_CITEE, (brut: string, civilite: string, nom: string) => personneCitee(etat, brut, civilite, nom))

/** Remplacement d'un texte : étapes 1 à 3, puis élisions et jetons provisoires → pseudonymes. */
function remplaceur(reco: Reconnaissance, etat: Etat): (texte: string) => string {
  return (texte) => {
    const sansReserves = texte.normalize('NFC').replaceAll(RESERVES, '')
    const avecJetons = remplacerPersonnesCitees(remplacerParties(remplacerNomsComplets(sansReserves, reco, etat), reco, etat), etat)
    return avecJetons
      .replaceAll(JETONS_REPETES, '$1')
      .replaceAll(ELISION_DEVANT_JETON, '$1e ')
      .replaceAll(JETON, (_jeton, index: string) => etat.jetons[Number(index)] ?? '')
  }
}

/** Chaînes d'une valeur JSON, jusqu'à la profondeur maximale. */
function* chaines(valeur: unknown, profondeur = 0): Generator<string> {
  if (typeof valeur === 'string') yield valeur
  else if (typeof valeur === 'object' && valeur !== null && profondeur < PROFONDEUR_MAX) {
    for (const element of Object.values(valeur)) yield* chaines(element, profondeur + 1)
  }
}

/** Numéros des pseudonymes déjà écrits dans les données, par rôle : ils ne seront attribués à personne. */
function numerosReserves(valeurs: readonly unknown[]): Record<Role, Set<number>> {
  const reserves: Record<Role, Set<number>> = { Copropriétaire: new Set(), Prestataire: new Set(), Personne: new Set() }
  for (const texte of valeurs.flatMap((valeur) => [...chaines(valeur)])) {
    for (const [, role, liste] of texte.normalize('NFC').matchAll(PSEUDONYMES_PRESENTS)) {
      const cible = ROLES.get(cle(role))?.role
      if (!cible) continue
      for (const numero of liste.match(/\d+/g) ?? []) reserves[cible].add(Number(numero))
    }
  }
  return reserves
}

/** Chaque chaîne d'une valeur JSON transformée ; au-delà de la profondeur maximale, rien ne part (null). */
function transformer(valeur: unknown, f: (texte: string) => string, profondeur = 0): unknown {
  if (typeof valeur === 'string') return f(valeur)
  if (valeur === null || typeof valeur !== 'object') return valeur
  if (profondeur >= PROFONDEUR_MAX) return null
  if (Array.isArray(valeur)) return valeur.map((element) => transformer(element, f, profondeur + 1))
  return Object.fromEntries(Object.entries(valeur).map(([cleObjet, element]) => [cleObjet, transformer(element, f, profondeur + 1)]))
}

type Noms = ReadonlyMap<string, string>

const nomDe = (noms: Noms, role: string, numero: string) => noms.get(`${cle(role)} ${Number(numero)}`)

/** « personne » en minuscules est un nom commun (« 15 € par personne 1 fois par an »), pas un pseudonyme. */
const nomCommunEcrit = (role: string) => role.startsWith('p') && cle(role) === 'personne'

/** Après « de » ou « que » : élision devant une voyelle (« d’Éloïse »), forme pleine sinon (« de M. Roc »). */
const apresElidable = (base: string, nom: string) => (/^[aeiouy]/.test(replier(nom)) ? `${base}’${nom}` : `${base}e ${nom}`)

/** Après un déterminant, le rôle reste un nom commun : « le copropriétaire Ondine Kervaliec ». */
const apresDeterminant = (determinant: string, role: string, nom: string, pluriel = '') =>
  `${determinant} ${ROLES.get(cle(role))?.nomCommun ?? role}${pluriel} ${nom}`

function retablirUn(noms: Noms, brut: string, prefixe: { determinant?: string; elidable?: string }, role: string, numero: string) {
  const nom = nomCommunEcrit(role) ? undefined : nomDe(noms, role, numero)
  if (!nom) return brut
  if (prefixe.determinant) return apresDeterminant(prefixe.determinant, role, nom)
  return prefixe.elidable ? apresElidable(prefixe.elidable, nom) : nom
}

/** Liste au pluriel (« Copropriétaires 1 et 3 ») : rétablie seulement si chaque numéro est connu. */
function retablirListe(noms: Noms, brut: string, determinant: string | undefined, role: string, liste: string) {
  const numeros = liste.match(/\d+/g) ?? []
  if (nomCommunEcrit(role) || !numeros.every((numero) => nomDe(noms, role, numero))) return brut
  const retablie = liste.replaceAll(/\d+/g, (numero) => nomDe(noms, role, numero) ?? numero)
  return determinant ? apresDeterminant(determinant, role, retablie, 's') : retablie
}

function retablirNoms(texte: string, noms: Noms): string {
  return texte
    .replaceAll(PSEUDONYMES_PLURIEL, (brut: string, determinant: string | undefined, role: string, liste: string) =>
      retablirListe(noms, brut, determinant, role, liste),
    )
    .replaceAll(
      PSEUDONYME,
      (brut: string, determinant: string | undefined, elidable: string | undefined, role: string, numero: string) =>
        retablirUn(noms, brut, { determinant, elidable }, role, numero),
    )
}

/**
 * Remplace, dans `donnees` (contexte, historique, question…), les noms des personnes et des prestataires trouvés dans
 * `contexte` (forme de `construireContexteAgent`), ainsi que les personnes citées avec leur civilité. Fonction pure :
 * la table ne vit que dans la fermeture `retablir`.
 */
export function pseudonymiserNoms<T>(donnees: T, contexte: Record<string, unknown>): Pseudonymisation<T> {
  const etat: Etat = {
    compteurs: { Copropriétaire: 0, Prestataire: 0, Personne: 0 },
    reserves: numerosReserves([donnees, contexte]),
    noms: new Map(),
    jetons: [],
    citees: new Map(),
  }
  const reco = construireReconnaissance(contexte, etat)
  const donneesPseudonymisees = transformer(donnees, remplaceur(reco, etat)) as T
  const { noms } = etat
  return { donnees: donneesPseudonymisees, retablir: (texte) => retablirNoms(texte, noms) }
}
