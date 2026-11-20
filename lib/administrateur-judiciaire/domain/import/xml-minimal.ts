/**
 * Lecteur XML minimal et sûr, écrit pour les relevés ISO 20022 camt.053 (releve-camt.ts). Fonction pure, sans dépendance,
 * utilisable côté serveur où DOMParser n'existe pas.
 *
 * Pourquoi pas un paquet : 🟢 package.json (dépendances de production, relu le 20/11/2026) ne déclare aucun lecteur XML ;
 * xml2js, sax, saxes et @xmldom/xmldom sont présents dans node_modules, mais seulement comme dépendances d'autres paquets :
 * s'y adosser ferait dépendre le code d'un arbre qui peut changer sans prévenir. dompurify suppose un DOM (navigateur).
 *
 * Ce qui est lu (🔵 sous-ensemble de XML 1.0 et des espaces de noms XML, suffisant pour un message camt.053) : éléments,
 * attributs (guillemets simples ou doubles), texte, sections CDATA, commentaires et instructions de traitement (ignorés),
 * déclaration XML en tête de chaque document, espaces de noms (xmlns, xmlns:préfixe) résolus par portée, les cinq entités
 * prédéfinies (&lt; &gt; &amp; &quot; &apos;) et les références numériques (&#233; &#xE9;). Fins de ligne normalisées
 * (XML 1.0, § 2.11). Plusieurs racines successives sont admises : 🟢 un fichier peut regrouper plusieurs messages (guide
 * CFONB « Guide d'utilisation du standard ISO 20022 pour les relevés de compte, camt.053.001.02 », V1.2, juillet 2019,
 * § 1.12 : le client découpe le fichier par messages).
 *
 * Sûreté : toute déclaration « <!… » autre qu'un commentaire ou une section CDATA est refusée, donc toute DTD — aucune
 * entité déclarée, aucune entité externe (XXE), aucune expansion en cascade ; seules les cinq entités prédéfinies sont
 * reconnues, cherchées dans une table sans prototype (« &constructor; » ou « &__proto__; » sont des entités inconnues) ;
 * aucun accès réseau ni fichier ; lecture itérative (pile explicite, pas de récursion) et profondeur bornée. Temps de
 * lecture linéaire en la taille du texte, y compris pour un fichier hostile : attributs répétés repérés par un ensemble,
 * portée des espaces de noms chaînée (une déclaration n'est jamais recopiée dans les éléments descendants ; la chaîne
 * est au plus aussi longue que la profondeur). Tout écart lève une erreur qui cite la ligne.
 * 🔴 Non traité : validation par le schéma XSD (le relevé est contrôlé champ par champ dans releve-camt.ts), encodages
 * autres que celui du texte déjà décodé (l'attribut encoding est ignoré), normalisation des valeurs d'attributs.
 */

/** Élément lu : nom local (sans préfixe), espace de noms résolu ('' sans espace), texte direct décodé. */
export interface ElementXml {
  nom: string
  espaceDeNoms: string
  /**
   * Attributs tels qu'écrits (préfixe compris), déclarations xmlns exclues ; valeurs décodées. Objet sans prototype : un
   * attribut nommé « constructor » ou « __proto__ » est gardé, et un nom absent rend toujours undefined.
   */
  attributs: Readonly<Record<string, string>>
  enfants: ElementXml[]
  /** Nœuds texte et CDATA placés directement dans l'élément, concaténés. */
  texte: string
}

export interface OptionsLectureXml {
  /** Profondeur d'imbrication maximale (128 par défaut ; un camt.053 dépasse rarement 15). */
  profondeurMax?: number
}

const ENTITES_PREDEFINIES: ReadonlyMap<string, string> = new Map([
  ['lt', '<'],
  ['gt', '>'],
  ['amp', '&'],
  ['quot', '"'],
  ['apos', "'"],
])
const CARACTERE_NOM = String.raw`[\w.\-·À-￯]`
const DEBUT_NOM = String.raw`[A-Za-z_À-￯]`
const NOM_XML = new RegExp(`${DEBUT_NOM}${CARACTERE_NOM}*(?::${DEBUT_NOM}${CARACTERE_NOM}*)?`, 'y')
const ESPACE_XML = 'http://www.w3.org/XML/1998/namespace'

const estCaractereXml = (code: number): boolean =>
  code === 0x9 ||
  code === 0xa ||
  code === 0xd ||
  (code >= 0x20 && code <= 0xd7ff) ||
  (code >= 0xe000 && code <= 0xfffd) ||
  (code >= 0x10000 && code <= 0x10ffff)

/** Déclarations d'espace de noms d'un élément (préfixe → espace, '' pour l'espace par défaut), chaînées à celles du parent. */
interface Portee {
  propres: ReadonlyMap<string, string>
  parent: Portee | null
}

const PORTEE_INITIALE: Portee = {
  propres: new Map([
    ['', ''],
    ['xml', ESPACE_XML],
  ]),
  parent: null,
}

interface Cadre {
  element: ElementXml
  nomEcrit: string
  portee: Portee
}

interface EtatLecture {
  texte: string
  i: number
  pile: Cadre[]
  racines: ElementXml[]
  profondeurMax: number
}

function echec(etat: EtatLecture, message: string, position: number): never {
  const ligne = etat.texte.slice(0, position).split('\n').length
  throw new Error(`XML illisible (ligne ${ligne}) : ${message}`)
}

function decoderReference(etat: EtatLecture, reference: string, position: number): string {
  const nom = reference.slice(1, -1)
  if (!reference.endsWith(';') || nom === '') return echec(etat, '« & » isolé : écrire « &amp; ».', position)
  if (nom.startsWith('#')) {
    let code = Number.NaN
    if (/^#x[0-9a-fA-F]{1,6}$/.test(nom)) code = Number.parseInt(nom.slice(2), 16)
    else if (/^#\d{1,7}$/.test(nom)) code = Number.parseInt(nom.slice(1), 10)
    if (!estCaractereXml(code)) return echec(etat, `référence « ${reference} » : caractère interdit en XML.`, position)
    return String.fromCodePoint(code)
  }
  const valeur = ENTITES_PREDEFINIES.get(nom)
  if (valeur === undefined)
    return echec(etat, `entité inconnue « ${reference} » (seules &lt; &gt; &amp; &quot; &apos; et les références numériques sont admises).`, position)
  return valeur
}

const decoder = (etat: EtatLecture, brut: string, position: number): string =>
  brut.replaceAll(/&[^;&<\s]*;?/g, (reference: string, decalage: number) => decoderReference(etat, reference, position + decalage))

function lireNom(etat: EtatLecture, position: number): string {
  NOM_XML.lastIndex = position
  const trouve = NOM_XML.exec(etat.texte)
  return trouve ? trouve[0] : echec(etat, 'nom d’élément ou d’attribut attendu.', position)
}

function sauterEspaces(texte: string, position: number): number {
  let i = position
  while (texte[i] === ' ' || texte[i] === '\t' || texte[i] === '\n') i++
  return i
}

function ajouterTexte(etat: EtatLecture, valeur: string, position: number): void {
  const cadre = etat.pile.at(-1)
  if (cadre) cadre.element.texte += valeur
  else if (valeur.trim() !== '') echec(etat, 'texte hors de l’élément racine.', position)
}

/** Fin d'une construction « ouverture … fermeture » ; erreur si la fermeture manque. */
function finDe(etat: EtatLecture, fermeture: string, depuis: number, quoi: string): number {
  const fin = etat.texte.indexOf(fermeture, depuis)
  return fin < 0 ? echec(etat, `${quoi} non fermé(e).`, etat.i) : fin
}

/** Commentaire, CDATA, déclaration « <!… » (refusée) ou instruction de traitement ; false si autre chose. */
function lireBalisageSpecial(etat: EtatLecture): boolean {
  const { texte, i } = etat
  if (texte.startsWith('<!--', i)) {
    etat.i = finDe(etat, '-->', i + 4, 'commentaire') + 3
    return true
  }
  if (texte.startsWith('<![CDATA[', i)) {
    const fin = finDe(etat, ']]>', i + 9, 'section CDATA')
    if (etat.pile.length === 0) echec(etat, 'section CDATA hors de l’élément racine.', i)
    ajouterTexte(etat, texte.slice(i + 9, fin), i)
    etat.i = fin + 3
    return true
  }
  if (texte.startsWith('<!', i))
    echec(etat, 'déclaration « <!… » refusée : le lecteur n’accepte aucune DTD (ni entité déclarée, ni entité externe).', i)
  if (texte.startsWith('<?', i)) {
    const fin = finDe(etat, '?>', i + 2, 'instruction de traitement')
    if (/^<\?xml[\s?]/i.test(texte.slice(i, i + 6)) && etat.pile.length > 0) echec(etat, 'déclaration XML à l’intérieur d’un élément.', i)
    etat.i = fin + 2
    return true
  }
  return false
}

function lireBaliseFermante(etat: EtatLecture): void {
  const debut = etat.i,
    nomEcrit = lireNom(etat, debut + 2),
    apres = sauterEspaces(etat.texte, debut + 2 + nomEcrit.length)
  if (etat.texte[apres] !== '>') echec(etat, `balise fermante </${nomEcrit}> mal formée.`, debut)
  const cadre = etat.pile.pop()
  if (!cadre) echec(etat, `balise fermante </${nomEcrit}> sans balise ouvrante.`, debut)
  else if (cadre.nomEcrit !== nomEcrit) echec(etat, `balise fermante </${nomEcrit}> alors que <${cadre.nomEcrit}> est ouverte.`, debut)
  etat.i = apres + 1
}

/** Un attribut « nom = "valeur" » à partir de etat.i ; avance etat.i et ajoute le nom à `dejaLus`. */
function lireAttribut(etat: EtatLecture, nomElement: string, dejaLus: Set<string>): [string, string] {
  const { texte } = etat,
    nom = lireNom(etat, etat.i)
  let i = sauterEspaces(texte, etat.i + nom.length)
  if (texte[i] !== '=') echec(etat, `« = » attendu après l’attribut ${nom}.`, i)
  i = sauterEspaces(texte, i + 1)
  const guillemet = texte[i]
  if (guillemet !== '"' && guillemet !== "'") echec(etat, `valeur de l’attribut ${nom} sans guillemets.`, i)
  const fin = finDe(etat, guillemet, i + 1, `valeur de l’attribut ${nom}`),
    brut = texte.slice(i + 1, fin)
  if (brut.includes('<')) echec(etat, `« < » interdit dans la valeur de l’attribut ${nom}.`, i)
  if (dejaLus.has(nom)) echec(etat, `attribut ${nom} répété dans <${nomElement}>.`, i)
  dejaLus.add(nom)
  etat.i = fin + 1
  return [nom, decoder(etat, brut, i + 1)]
}

/** Attributs d'une balise ouvrante jusqu'à « > » ou « /> » ; `vide` : balise auto-fermée. */
function lireAttributs(etat: EtatLecture, nomElement: string, debut: number): { bruts: [string, string][]; vide: boolean } {
  const bruts: [string, string][] = [],
    noms = new Set<string>()
  for (;;) {
    const apresEspaces = sauterEspaces(etat.texte, etat.i),
      avecEspace = apresEspaces > etat.i
    etat.i = apresEspaces
    if (etat.texte.startsWith('/>', etat.i)) {
      etat.i += 2
      return { bruts, vide: true }
    }
    if (etat.texte[etat.i] === '>') {
      etat.i += 1
      return { bruts, vide: false }
    }
    if (etat.i >= etat.texte.length) echec(etat, `balise <${nomElement}> tronquée.`, debut)
    if (!avecEspace) echec(etat, `espace attendu avant l’attribut dans <${nomElement}>.`, etat.i)
    bruts.push(lireAttribut(etat, nomElement, noms))
  }
}

const estDeclaration = (nom: string): boolean => nom === 'xmlns' || nom.startsWith('xmlns:')

/** Portée d'un élément : celle du parent, prolongée de ses propres déclarations xmlns s'il en a (rien n'est recopié). */
function appliquerDeclarations(parent: Portee, bruts: readonly [string, string][]): Portee {
  const propres = new Map<string, string>()
  for (const [nom, valeur] of bruts) if (estDeclaration(nom)) propres.set(nom === 'xmlns' ? '' : nom.slice(6), valeur)
  return propres.size === 0 ? parent : { propres, parent }
}

/** Espace de noms d'un préfixe ('' : espace par défaut), cherché de l'élément vers la racine ; undefined s'il n'est pas déclaré. */
function espaceDuPrefixe(portee: Portee, prefixe: string): string | undefined {
  for (let courante: Portee | null = portee; courante; courante = courante.parent) {
    const espace = courante.propres.get(prefixe)
    if (espace !== undefined) return espace
  }
  return undefined
}

/** Nom écrit « préfixe:local » ou « local » → nom local et espace de noms ; erreur si le préfixe n'est pas déclaré. */
function resoudreNom(etat: EtatLecture, nomEcrit: string, portee: Portee, debut: number): { nom: string; espaceDeNoms: string } {
  const deuxPoints = nomEcrit.indexOf(':'),
    prefixe = deuxPoints < 0 ? '' : nomEcrit.slice(0, deuxPoints),
    espaceDeNoms = espaceDuPrefixe(portee, prefixe)
  if (espaceDeNoms === undefined) return echec(etat, `préfixe « ${prefixe} » non déclaré (élément <${nomEcrit}>).`, debut)
  return { nom: nomEcrit.slice(deuxPoints + 1), espaceDeNoms }
}

/** Attributs d'un élément, déclarations xmlns exclues, dans un objet sans prototype ; erreur sur un préfixe non déclaré. */
function attributsDe(etat: EtatLecture, bruts: readonly [string, string][], portee: Portee, debut: number): Record<string, string> {
  const attributs = Object.create(null) as Record<string, string>
  for (const [nom, valeur] of bruts) {
    if (estDeclaration(nom)) continue
    const deuxPoints = nom.indexOf(':')
    if (deuxPoints >= 0 && espaceDuPrefixe(portee, nom.slice(0, deuxPoints)) === undefined)
      echec(etat, `préfixe « ${nom.slice(0, deuxPoints)} » non déclaré (attribut ${nom}).`, debut)
    attributs[nom] = valeur
  }
  return attributs
}

function lireBaliseOuvrante(etat: EtatLecture): void {
  const debut = etat.i,
    nomEcrit = lireNom(etat, debut + 1)
  etat.i = debut + 1 + nomEcrit.length
  const { bruts, vide } = lireAttributs(etat, nomEcrit, debut),
    parent = etat.pile.at(-1),
    portee = appliquerDeclarations(parent ? parent.portee : PORTEE_INITIALE, bruts),
    element: ElementXml = { ...resoudreNom(etat, nomEcrit, portee, debut), attributs: attributsDe(etat, bruts, portee, debut), enfants: [], texte: '' }
  if (parent) parent.element.enfants.push(element)
  else etat.racines.push(element)
  if (vide) return
  if (etat.pile.length >= etat.profondeurMax) echec(etat, `profondeur d’imbrication supérieure à ${etat.profondeurMax}.`, debut)
  etat.pile.push({ element, nomEcrit, portee })
}

/** Lecture d'un texte XML : rend les éléments racines (un au moins) ; lève une erreur qui cite la ligne en cause. */
export function lireXml(source: string, { profondeurMax = 128 }: OptionsLectureXml = {}): ElementXml[] {
  const etat: EtatLecture = {
    texte: source.replace(/^﻿/, '').replaceAll(/\r\n?/g, '\n'),
    i: 0,
    pile: [],
    racines: [],
    profondeurMax,
  }
  while (etat.i < etat.texte.length) {
    if (etat.texte[etat.i] !== '<') {
      const fin = etat.texte.indexOf('<', etat.i),
        bout = fin < 0 ? etat.texte.length : fin
      ajouterTexte(etat, decoder(etat, etat.texte.slice(etat.i, bout), etat.i), etat.i)
      etat.i = bout
    } else if (lireBalisageSpecial(etat)) continue
    else if (etat.texte.startsWith('</', etat.i)) lireBaliseFermante(etat)
    else lireBaliseOuvrante(etat)
  }
  const ouverte = etat.pile.at(-1)
  if (ouverte) echec(etat, `document tronqué : <${ouverte.nomEcrit}> n’est pas fermé.`, etat.texte.length)
  if (etat.racines.length === 0) echec(etat, 'aucun élément.', 0)
  return etat.racines
}

/** Premier enfant de ce nom local ; null si absent. */
export const enfant = (element: ElementXml | null, nom: string): ElementXml | null =>
  element?.enfants.find((candidat) => candidat.nom === nom) ?? null

/** Enfants de ce nom local, dans l'ordre du document. */
export const enfantsNommes = (element: ElementXml | null, nom: string): ElementXml[] =>
  element ? element.enfants.filter((candidat) => candidat.nom === nom) : []

/** Suit un chemin de noms locaux (premier enfant à chaque pas) ; null dès qu'un pas manque. */
export function suivre(element: ElementXml | null, ...chemin: string[]): ElementXml | null {
  let courant = element
  for (const nom of chemin) courant = enfant(courant, nom)
  return courant
}

/** Texte rogné au bout du chemin ; null si l'élément manque ou si son texte est vide. */
export function texteSuivi(element: ElementXml | null, ...chemin: string[]): string | null {
  const texte = suivre(element, ...chemin)?.texte.trim()
  return texte || null
}
