// ── Logo d'un cabinet : règles pures de la conversion faite dans le navigateur ───────────────────────────────────────
//
// Demande de Hugo du 13/11/2026. Le super admin choisit une image (SVG, PNG, JPEG ou WebP, 5 Mo au plus) ; le navigateur
// la dessine sur un canvas et en tire un PNG borné (lib/aj-signalement/logo-navigateur.ts). Ce module, sans navigateur,
// fixe : le type d'après les OCTETS (jamais d'après le nom ni le type annoncé du fichier), la taille d'un SVG (attributs
// width, height, viewBox), la taille du dessin (800 × 400 px au plus, proportions gardées ; une image matricielle n'est
// jamais agrandie, un SVG est dessiné à la plus grande taille qui tient) et la réduction quand le PNG dépasse 200 Kio.
// Le SVG est lu comme TEXTE (preparerSvgQr), jamais par un analyseur DOM ni XML (alerte CodeQL du 13/11/2026).

import { LOGO_HAUTEUR_MAX_QR, LOGO_LARGEUR_MAX_QR } from '@/lib/aj-signalement/logo'

/** Poids maximal du fichier choisi (avant conversion). */
export const LOGO_FICHIER_MAX_QR = 5 * 1024 * 1024
/** Plus grand côté en dessous duquel le PNG n'est plus réduit (trop lourd : refusé). */
export const LOGO_COTE_MIN_REDUCTION_QR = 48
/** Facteur de chaque réduction. */
const REDUCTION_QR = 0.8

export type TypeImageLogoQr = 'png' | 'jpeg' | 'webp' | 'svg'

/** Type MIME de la source chargée par le navigateur, selon le type reconnu. */
export const TYPES_MIME_LOGO_QR: Readonly<Record<TypeImageLogoQr, string>> = {
  png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml',
}

/** Attribut accept du champ de fichier (filtre du sélecteur ; le type réel est relu dans les octets). */
export const ACCEPT_LOGO_QR = '.svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp'

export interface DimensionsQr {
  largeur: number
  hauteur: number
}

const commencePar = (o: Uint8Array, valeurs: readonly number[], depuis = 0): boolean => valeurs.every((v, i) => o[depuis + i] === v)
const ascii = (s: string): number[] => [...s].map((c) => c.charCodeAt(0))

const ESPACE = /\s/
/** Position du premier caractère qui n'est pas un espace (au sens de \s), à partir de `i`. */
function apresEspaces(t: string, i: number): number {
  while (i < t.length && ESPACE.test(t[i])) i++
  return i
}
const ouvreParCi = (t: string, i: number, mot: string): boolean => t.slice(i, i + mot.length).toLowerCase() === mot.toLowerCase()

/** Commentaires et espaces qui les suivent, à partir de `i` ; -1 : commentaire non fermé. */
function apresCommentaires(t: string, i: number): number {
  while (t.startsWith('<!--', i)) {
    const fin = t.indexOf('-->', i + 4)
    if (fin < 0) return -1
    i = apresEspaces(t, fin + 3)
  }
  return i
}

/** DOCTYPE (avec son éventuel sous-ensemble interne « [ … ] ») et espaces qui le suivent ; -1 : non fermé. */
function apresDoctype(t: string, i: number): number {
  let j = i + '<!DOCTYPE'.length
  while (j < t.length && t[j] !== '>' && t[j] !== '[') j++
  if (j >= t.length) return -1
  if (t[j] === '[') {
    // Le sous-ensemble se termine au premier « ] » suivi (après des espaces) de « > ».
    let crochet = j
    for (;;) {
      crochet = t.indexOf(']', crochet + 1)
      if (crochet < 0) return -1
      j = apresEspaces(t, crochet + 1)
      if (t[j] === '>') break
    }
  }
  return apresEspaces(t, j + 1)
}

/** Position de la racine « <svg » (casse indifférente) après le prologue ; -1 : le texte ne commence pas par elle. */
function positionRacineSvg(t: string): number {
  let i = apresEspaces(t, t.startsWith('﻿') ? 1 : 0)
  if (ouvreParCi(t, i, '<?xml')) {
    const fin = t.indexOf('>', i)
    if (fin < 0 || fin - 1 < i + 5 || t[fin - 1] !== '?') return -1
    i = apresEspaces(t, fin + 1)
  }
  i = apresCommentaires(t, i)
  if (i >= 0 && ouvreParCi(t, i, '<!DOCTYPE')) {
    i = apresDoctype(t, i)
    if (i >= 0) i = apresCommentaires(t, i)
  }
  const racine = i >= 0 && ouvreParCi(t, i, '<svg') && i + 4 < t.length && (ESPACE.test(t[i + 4]) || t[i + 4] === '>' || t[i + 4] === '/')
  return racine ? i : -1
}

/**
 * Le texte commence-t-il par une racine <svg> ? Prologue admis avant elle : BOM, espaces, déclaration XML, commentaires,
 * un DOCTYPE, commentaires. Un HTML qui contient un SVG n'en est pas un. Lecture en UN passage (relecture de sécurité du
 * 13/11/2026 : l'expression régulière qui la faisait revenait en arrière de façon exponentielle sur des commentaires
 * répétés) ; un commentaire se termine au premier « --> », comme en XML.
 */
export function commenceParRacineSvgQr(t: string): boolean {
  return positionRacineSvg(t) >= 0
}

/** Type de l'image d'après ses octets ; null : ni PNG, ni JPEG, ni WebP, ni SVG. */
export function typeImageLogoQr(octets: Uint8Array): TypeImageLogoQr | null {
  if (commencePar(octets, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png'
  if (commencePar(octets, [0xff, 0xd8, 0xff])) return 'jpeg'
  if (commencePar(octets, ascii('RIFF')) && commencePar(octets, ascii('WEBP'), 8)) return 'webp'
  return commenceParRacineSvgQr(new TextDecoder('utf-8').decode(octets.subarray(0, 4096))) ? 'svg' : null
}

/** Longueur d'un attribut width / height : nombre seul ou en px (les unités physiques et les % ne disent rien ici). */
function longueurSvg(valeur: string | null): number | null {
  const m = /^\s*(\d+(?:\.\d+)?|\.\d+)\s*(?:px)?\s*$/.exec(valeur ?? '')
  const n = m ? Number(m[1]) : Number.NaN
  return Number.isFinite(n) && n > 0 ? n : null
}

/** viewBox « min-x min-y largeur hauteur » (espaces ou virgules) → largeur et hauteur, positives. */
function boiteSvg(valeur: string | null): DimensionsQr | null {
  const parts = (valeur ?? '').trim().split(/[\s,]+/).map(Number)
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n)) || parts[2] <= 0 || parts[3] <= 0) return null
  return { largeur: parts[2], hauteur: parts[3] }
}

/** Taille du dessin d'un SVG d'après les attributs de sa racine ; null si elle ne peut pas en être tirée. */
export function dimensionsSvgQr(attributs: { width: string | null; height: string | null; viewBox: string | null }): DimensionsQr | null {
  const largeur = longueurSvg(attributs.width)
  const hauteur = longueurSvg(attributs.height)
  if (largeur && hauteur) return { largeur, hauteur }
  const boite = boiteSvg(attributs.viewBox)
  if (!boite) return null
  if (largeur) return { largeur, hauteur: (largeur * boite.hauteur) / boite.largeur }
  if (hauteur) return { largeur: (hauteur * boite.largeur) / boite.hauteur, hauteur }
  return boite
}

const borne = (n: number, max: number): number => Math.min(max, Math.max(1, Math.round(n)))

/**
 * Taille du PNG : dans 800 × 400 px, proportions gardées. `vectoriel` (SVG) : la plus grande taille qui tient ; sinon
 * l'image n'est jamais agrandie.
 */
export function dimensionsCibleLogoQr(source: DimensionsQr, vectoriel: boolean): DimensionsQr {
  const ajustee = Math.min(LOGO_LARGEUR_MAX_QR / source.largeur, LOGO_HAUTEUR_MAX_QR / source.hauteur)
  const echelle = vectoriel ? ajustee : Math.min(1, ajustee)
  return { largeur: borne(source.largeur * echelle, LOGO_LARGEUR_MAX_QR), hauteur: borne(source.hauteur * echelle, LOGO_HAUTEUR_MAX_QR) }
}

/** Taille de l'essai suivant quand le PNG est trop lourd (−20 %) ; null : plus de réduction possible. */
export function reductionLogoQr(dimensions: DimensionsQr): DimensionsQr | null {
  if (Math.max(dimensions.largeur, dimensions.hauteur) <= LOGO_COTE_MIN_REDUCTION_QR) return null
  return {
    largeur: Math.max(1, Math.round(dimensions.largeur * REDUCTION_QR)),
    hauteur: Math.max(1, Math.round(dimensions.hauteur * REDUCTION_QR)),
  }
}

// ── SVG lu comme TEXTE (alerte CodeQL js/xss-through-dom du 13/11/2026, PR #684) ─────────────────────────────────────
//
// Le texte du fichier choisi était relu par DOMParser. Au-delà de l'alerte, un analyseur XML sur un fichier inconnu peut
// figer l'onglet (DTD, entités en cascade « billion laughs »). Aucun analyseur DOM ni XML n'est plus appliqué au fichier :
// toute DOCTYPE ou ENTITY est refusée ; seule la balise ouvrante de la racine est relue (petit tokeniseur, temps
// linéaire, aucune expression régulière à retour arrière) et réécrite ; le reste du texte n'est lu que par le navigateur,
// qui charge le SVG comme IMAGE (aucun script, aucune ressource externe) et ne charge pas un XML mal formé (refus
// « illisible »). Sans DTD, aucune entité ne peut produire de balise : chaque élément du document figure en clair
// (« <nom ») dans le texte, ce qui rend sûre la recherche textuelle de foreignObject.

const ESPACE_SVG = 'http://www.w3.org/2000/svg'

/**
 * Longueur maximale (caractères) de la balise ouvrante de la racine : quelques centaines dans un logo (un export
 * Inkscape, espaces de noms compris, en compte moins de 2 000). Au-delà : illisible, sans la relire plus loin ; le
 * travail sur la racine (attributs, références, réécriture) reste ainsi borné quel que soit le fichier.
 */
export const RACINE_SVG_MAX_QR = 16 * 1024

// Classes des caractères ASCII, par code : espace XML (espace, tabulation, sauts de ligne) ; fin d'un nom d'attribut de
// la racine ; fin d'un nom d'élément (tout caractère de contrôle ou espace ASCII compris). Un caractère non ASCII n'en
// a aucune.
const ESPACE_XML = 1
const FIN_NOM_ATTRIBUT = 2
const FIN_NOM_ELEMENT = 4
const CLASSES_ASCII = new Uint8Array(128)
const classer = (caracteres: string, classe: number): void => {
  for (const c of caracteres) CLASSES_ASCII[c.charCodeAt(0)] |= classe
}
classer(' \t\n\r', ESPACE_XML | FIN_NOM_ATTRIBUT)
classer('=>/<"\'&', FIN_NOM_ATTRIBUT)
classer(`${String.fromCodePoint(...Array.from({ length: 0x21 }, (_, c) => c))}>/<="'`, FIN_NOM_ELEMENT)
/** Le caractère en `i` est-il de cette classe ? (Hors du texte : d'aucune.) */
const estDeClasse = (t: string, i: number, classe: number): boolean => {
  const c = t.charCodeAt(i)
  return c < 128 && (CLASSES_ASCII[c] & classe) !== 0
}
/** Seules entités nommées d'un XML sans DTD. */
const ENTITES_XML: ReadonlyMap<string, string> = new Map([['lt', '<'], ['gt', '>'], ['amp', '&'], ['quot', '"'], ['apos', "'"]])
/** Échappement d'une valeur réécrite entre guillemets doubles ; sauts de ligne et tabulations codés (gardés à la relecture). */
const ECHAPPEMENTS_XML: Readonly<Record<string, string>> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;', '\t': '&#9;', '\n': '&#10;', '\r': '&#13;',
}
const A_ECHAPPER = /[&<>"'\t\n\r]/
const A_DECODER = /[<&\t\n\r]/

/** SVG prêt à charger comme image, et taille du dessin. */
export interface SvgPrepareQr {
  svg: string
  cible: DimensionsQr
}

interface AttributXml {
  nom: string
  valeur: string
}

function apresEspacesXml(t: string, i: number): number {
  while (estDeClasse(t, i, ESPACE_XML)) i++
  return i
}

/** Une DOCTYPE ou une déclaration ENTITY, où que ce soit dans le texte (casse indifférente) ? */
function contientDtd(t: string): boolean {
  for (let i = t.indexOf('<!'); i >= 0; i = t.indexOf('<!', i + 2)) {
    const initiale = t.charAt(i + 2).toUpperCase()
    if ((initiale === 'D' && ouvreParCi(t, i, '<!DOCTYPE')) || (initiale === 'E' && ouvreParCi(t, i, '<!ENTITY'))) return true
  }
  return false
}

/**
 * Un élément foreignObject, casse indifférente, avec ou sans préfixe ? Les espaces de noms ne sont pas résolus : un
 * homonyme d'un autre espace est refusé lui aussi, comme une mention dans un commentaire (prudence). Un nom plus long
 * (foreignObjectif) n'en est pas un. Chaque caractère est lu au plus deux fois.
 */
function contientForeignObject(t: string): boolean {
  let i = t.indexOf('<')
  while (i >= 0) {
    let j = i + 1
    while (j < t.length && !estDeClasse(t, j, FIN_NOM_ELEMENT)) j++
    const nom = t.slice(i + 1, j)
    const local = nom.slice(nom.lastIndexOf(':') + 1)
    if (ouvreParCi(local, 0, 'foreignObject') && !/[\w.-]/.test(local.charAt('foreignObject'.length))) return true
    i = t.indexOf('<', j)
  }
  return false
}

/** Point de code admis en XML 1.0 ? */
const caractereXmlAdmis = (n: number): boolean =>
  n === 0x9 || n === 0xa || n === 0xd || (n >= 0x20 && n <= 0xd7ff) || (n >= 0xe000 && n <= 0xfffd) || (n >= 0x10000 && n <= 0x10ffff)

/** Caractère d'une référence « &nom; » (`nom` sans & ni ;) : entité prédéfinie ou référence numérique ; null : refusée. */
function caractereReference(nom: string): string | null {
  const entite = ENTITES_XML.get(nom)
  if (entite !== undefined) return entite
  let point = Number.NaN
  if (/^#x[\da-fA-F]{1,6}$/.test(nom)) point = Number.parseInt(nom.slice(2), 16)
  else if (/^#\d{1,7}$/.test(nom)) point = Number.parseInt(nom.slice(1), 10)
  return caractereXmlAdmis(point) ? String.fromCodePoint(point) : null
}

/**
 * Valeur d'un attribut telle qu'un analyseur XML la lit : tabulations et sauts de ligne littéraux devenus des espaces,
 * références décodées ; null : « < », ou « & » hors d'une référence admise (aucune DTD : aucune autre entité).
 */
function decoderValeurXml(brute: string): string | null {
  if (!A_DECODER.test(brute)) return brute
  if (brute.includes('<')) return null
  const v = brute.replaceAll(/\r\n?|[\t\n]/g, ' ')
  let sortie = ''
  let i = 0
  for (let et = v.indexOf('&'); et >= 0; et = v.indexOf('&', i)) {
    const fin = v.indexOf(';', et + 1)
    const caractere = fin < 0 ? null : caractereReference(v.slice(et + 1, fin))
    if (caractere === null) return null
    sortie += v.slice(i, et) + caractere
    i = fin + 1
  }
  return sortie + v.slice(i)
}

const echapperXml = (valeur: string): string =>
  A_ECHAPPER.test(valeur) ? valeur.replaceAll(/[&<>"'\t\n\r]/g, (c) => ECHAPPEMENTS_XML[c]) : valeur

/**
 * Attribut « nom = "valeur" » ou « nom = 'valeur' » à partir de `i`, ajouté à `attributs` (valeur décodée) ; position
 * qui le suit, -1 : mal formé.
 */
function lireAttribut(t: string, i: number, attributs: AttributXml[]): number {
  const debut = i
  while (i < t.length && !estDeClasse(t, i, FIN_NOM_ATTRIBUT)) i++
  const nom = t.slice(debut, i)
  i = apresEspacesXml(t, i)
  if (!nom || t[i] !== '=') return -1
  i = apresEspacesXml(t, i + 1)
  const guillemet = t[i]
  if (guillemet !== '"' && guillemet !== "'") return -1
  const fin = t.indexOf(guillemet, i + 1)
  const valeur = fin < 0 ? null : decoderValeurXml(t.slice(i + 1, fin))
  if (valeur === null) return -1
  attributs.push({ nom, valeur })
  return fin + 1
}

/** Balise ouvrante de la racine, en tête de `t` (« <svg ») : attributs dans l'ordre, longueur ; null : mal formée. */
function lireRacine(t: string): { attributs: AttributXml[]; fin: number; autoFermante: boolean } | null {
  const attributs: AttributXml[] = []
  let i = '<svg'.length
  while (i >= 0) {
    const separe = estDeClasse(t, i, ESPACE_XML)
    i = apresEspacesXml(t, i)
    if (t[i] === '>') return { attributs, fin: i + 1, autoFermante: false }
    if (t.startsWith('/>', i)) return { attributs, fin: i + 2, autoFermante: true }
    // Un attribut est toujours précédé d'un espace (« width="1"height="1" » est mal formé).
    i = separe ? lireAttribut(t, i, attributs) : -1
  }
  return null
}

/**
 * SVG prêt à charger comme image, lu comme TEXTE : balise ouvrante de la racine réécrite avec la taille du dessin en px,
 * et une viewBox d'après la taille d'origine si elle manque ou est vide (le dessin est mis à l'échelle, jamais rogné) ;
 * valeurs réécrites entre guillemets doubles, échappées. Le reste du texte est repris tel quel ; le prologue
 * (déclaration XML, commentaires) ne l'est pas : le SVG est réencodé en UTF-8, ce que dit l'absence de déclaration
 * (XMLSerializer, avant, l'omettait aussi). 'illisible' : DOCTYPE ou ENTITY, autre racine, racine hors de l'espace SVG,
 * balise racine mal formée ou de plus de RACINE_SVG_MAX_QR caractères, taille introuvable ; 'svg_html' : un élément
 * foreignObject (contenu HTML, que Chrome et Safari refusent d'exporter d'un canvas).
 */
export function preparerSvgQr(t: string): SvgPrepareQr | 'illisible' | 'svg_html' {
  if (contientDtd(t)) return 'illisible'
  const debut = positionRacineSvg(t)
  const racine = debut >= 0 && t.startsWith('<svg', debut) ? lireRacine(t.slice(debut, debut + RACINE_SVG_MAX_QR)) : null
  if (!racine) return 'illisible'
  const valeurs = new Map<string, string>()
  for (const { nom, valeur } of racine.attributs) valeurs.set(nom, valeur)
  // Un attribut en double est mal formé.
  if (valeurs.size !== racine.attributs.length || valeurs.get('xmlns') !== ESPACE_SVG) return 'illisible'
  if (contientForeignObject(t)) return 'svg_html'
  const boite = valeurs.get('viewBox')
  const origine = dimensionsSvgQr({ width: valeurs.get('width') ?? null, height: valeurs.get('height') ?? null, viewBox: boite ?? null })
  if (!origine) return 'illisible'
  const cible = dimensionsCibleLogoQr(origine, true)
  // Valeurs posées, à leur place si l'attribut existe ; sinon ajoutées dans cet ordre (celui d'avant).
  const posees = new Map<string, string>([
    ['viewBox', boite === undefined || boite === '' ? `0 0 ${origine.largeur} ${origine.hauteur}` : boite],
    ['width', String(cible.largeur)],
    ['height', String(cible.hauteur)],
  ])
  let balise = '<svg'
  for (const { nom, valeur } of racine.attributs) balise += ` ${nom}="${echapperXml(posees.get(nom) ?? valeur)}"`
  for (const [nom, valeur] of posees) if (!valeurs.has(nom)) balise += ` ${nom}="${echapperXml(valeur)}"`
  balise += racine.autoFermante ? '/>' : '>'
  return { svg: balise + t.slice(debut + racine.fin), cible }
}
