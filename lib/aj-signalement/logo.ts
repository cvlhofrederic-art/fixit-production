// ── Logo d'un cabinet client (AJ Signalement) : règles de l'image, communes au navigateur et au serveur ──────────────
//
// Demande de Hugo du 13/11/2026 : « pouvoir ajouter le logo au cabinet et aux PDF ». Le logo est une DONNÉE du cabinet
// (migration 20261114_signalements_qr_logo_cabinet.sql), jamais un fichier du dépôt. Le navigateur convertit l'image
// choisie (SVG, PNG, JPEG, WebP) en PNG par un canvas (lib/aj-signalement/logo-conversion.ts) ; le serveur ne stocke
// qu'un PNG TEL QU'UN CANVAS LE PRODUIT, revérifié ici (analyserPngQr). Jamais de SVG stocké ni servi.
//   - FORME (la contrainte de la base vérifie la même, CRC à part) : signature ; morceaux bien formés (longueur, type de
//     quatre lettres, CRC) ; IHDR d'abord : 800 × 400 px au plus, profondeur 8, RVB ou RVBA, sans entrelacement ; puis
//     seulement des morceaux accessoires sans texte et de longueur fixe, chacun une fois au plus ; puis les IDAT, à la
//     suite ; IEND en dernier et rien après ; 200 Kio au plus ;
//   - CONTENU (serveur et navigateur : la base ne sait pas décompresser) : les IDAT forment un flux zlib conforme
//     (lib/aj-signalement/zlib-borne.ts) qui se décompresse en EXACTEMENT hauteur × (1 + largeur × 3 ou 4) octets — la
//     lecture s'arrête au-delà : aucune « bombe » —, filtre de chaque ligne entre 0 et 4, Adler-32 juste et rien après.
// Relecture de sécurité du 13/11/2026 : la version précédente ne regardait que la forme (texte libre dans iCCP, octets
// après le flux zlib, bombe de décompression, IDAT qui n'était pas du zlib étaient acceptés puis servis).
// Module sans dépendance (navigateur, serveur, Workers) : atob / btoa pour le base64.

import type { LogoCabinetQr } from '@/lib/aj-signalement/types'
import { decompresserZlibBorneQr } from '@/lib/aj-signalement/zlib-borne'

/** Bornes de l'image stockée : mêmes valeurs que la contrainte signalements_qr_cabinets_logo_png_valide. */
export const LOGO_LARGEUR_MAX_QR = 800
export const LOGO_HAUTEUR_MAX_QR = 400
export const LOGO_OCTETS_MAX_QR = 200 * 1024
/** Signature, IHDR et IEND : rien de plus petit n'est un PNG. */
export const LOGO_OCTETS_MIN_QR = 45
/** Longueur maximale du PNG en base64 (corps de l'envoi). */
export const LOGO_BASE64_MAX_QR = 4 * Math.ceil(LOGO_OCTETS_MAX_QR / 3)
/** Version : 16 premiers caractères hexadécimaux du SHA-256 de l'image (calculée par la base). */
export const FORMAT_VERSION_LOGO_QR = /^[0-9a-f]{16}$/

/** Préfixe de la route publique de lecture de l'image (app/api/aj-signalement/logo/[identifiant]/route.ts). */
export const CHEMIN_API_LOGO_QR = '/api/aj-signalement/logo'

const SIGNATURE_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const

/** Morceaux critiques admis : en-tête, données de l'image, fin. */
const CRITIQUES_QR: ReadonlySet<string> = new Set(['IHDR', 'IDAT', 'IEND'])

/**
 * Morceaux accessoires admis entre IHDR et le premier IDAT, chacun une fois au plus, et leur longueur selon le type de
 * couleur (spécification PNG, § 11.3) : espace de couleur, gamma, chromaticités, bits significatifs, densité, fond,
 * transparence d'une couleur (RVB seulement) ; tous de longueur fixe et sans texte. Refusés : texte et métadonnées
 * (tEXt, zTXt, iTXt, eXIf, tIME…), profil ICC (iCCP : nom libre et profil compressé), palette (PLTE : facultative en
 * RVB et RVBA, jamais produite par un canvas), animation (acTL, fcTL, fdAT), tout type inconnu.
 * Même liste dans la contrainte de la base (migration 20261114, signalements_qr_png_forme_valide).
 */
const ACCESSOIRES_ADMIS_QR: Readonly<Record<string, Readonly<Partial<Record<number, number>>>>> = {
  sRGB: { 2: 1, 6: 1 }, gAMA: { 2: 4, 6: 4 }, cHRM: { 2: 32, 6: 32 }, sBIT: { 2: 3, 6: 4 }, pHYs: { 2: 9, 6: 9 },
  bKGD: { 2: 6, 6: 6 }, tRNS: { 2: 6 },
}

/** Octets par pixel des types de couleur admis, en profondeur 8 : RVB (2) et RVBA (6), ceux d'un canvas. */
const OCTETS_PAR_PIXEL_QR: Readonly<Partial<Record<number, number>>> = { 2: 3, 6: 4 }

const estAdmisQr = (type: string): boolean => CRITIQUES_QR.has(type) || Object.hasOwn(ACCESSOIRES_ADMIS_QR, type)

export type RaisonRefusPngQr = 'poids' | 'signature' | 'structure' | 'morceau_interdit' | 'dimensions' | 'contenu'
export type AnalysePngQr = { ok: true; largeur: number; hauteur: number } | { ok: false; raison: RaisonRefusPngQr }

let tableCrc: Uint32Array | null = null

/** CRC-32 (polynôme 0xEDB88320) d'une portion d'octets : celui de chaque morceau d'un PNG. */
export function crc32Qr(octets: Uint8Array, debut = 0, fin = octets.length): number {
  if (!tableCrc) {
    tableCrc = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      tableCrc[n] = c >>> 0
    }
  }
  let crc = 0xffffffff
  for (let i = debut; i < fin; i++) crc = tableCrc[(crc ^ octets[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

const entier32 = (o: Uint8Array, i: number): number => ((o[i] << 24) | (o[i + 1] << 16) | (o[i + 2] << 8) | o[i + 3]) >>> 0
const typeMorceau = (o: Uint8Array, i: number): string => String.fromCharCode(o[i], o[i + 1], o[i + 2], o[i + 3])
const estLettre = (c: number): boolean => (c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a)

interface EnteteQr {
  largeur: number
  hauteur: number
  typeCouleur: number
}

/**
 * En-tête IHDR (13 octets à partir de `i`) d'une image telle qu'un canvas la produit : dimensions non nulles,
 * profondeur 8, RVB (2) ou RVBA (6), compression et filtre 0, sans entrelacement ; null sinon (y compris les autres
 * formes admises par la spécification : 16 bits, palette, niveaux de gris, entrelacement Adam7).
 */
function lireIhdr(o: Uint8Array, i: number): EnteteQr | null {
  const largeur = entier32(o, i)
  const hauteur = entier32(o, i + 4)
  const typeCouleur = o[i + 9]
  const valides = largeur > 0 && hauteur > 0 && largeur <= 0x7fffffff && hauteur <= 0x7fffffff
    && o[i + 8] === 8 && OCTETS_PAR_PIXEL_QR[typeCouleur] !== undefined && o[i + 10] === 0 && o[i + 11] === 0 && o[i + 12] === 0
  return valides ? { largeur, hauteur, typeCouleur } : null
}

/** Un morceau d'un PNG : son type, et sa place dans le fichier (longueur, type, données et CRC compris). */
interface MorceauPngQr {
  type: string
  debut: number
  fin: number
  longueur: number
}

/**
 * Morceaux d'un fichier qui commence par la signature PNG, chacun bien formé (longueur dans le fichier, type de quatre
 * lettres, CRC juste), jusqu'à IEND, qui doit être le dernier : rien après lui. null sinon.
 */
function morceauxPngQr(octets: Uint8Array): MorceauPngQr[] | null {
  const total = octets.length
  const morceaux: MorceauPngQr[] = []
  let position = SIGNATURE_PNG.length
  while (position < total) {
    if (morceaux.at(-1)?.type === 'IEND' || total - position < 12) return null
    const longueur = entier32(octets, position)
    if (longueur > total - position - 12) return null
    const debutType = position + 4
    if (![0, 1, 2, 3].every((k) => estLettre(octets[debutType + k]))) return null
    const finDonnees = position + 8 + longueur
    if (crc32Qr(octets, debutType, finDonnees) !== entier32(octets, finDonnees)) return null
    morceaux.push({ type: typeMorceau(octets, debutType), debut: position, fin: finDonnees + 4, longueur })
    position = finDonnees + 4
  }
  return morceaux.at(-1)?.type === 'IEND' ? morceaux : null
}

/**
 * Contenu de l'image : les IDAT (morceaux `debut` … `fin` − 1), mis bout à bout, forment un flux zlib conforme qui se
 * décompresse en exactement une ligne de (1 + largeur × octets par pixel) octets par rangée de pixels, chacune
 * commençant par un type de filtre de 0 à 4 (spécification PNG, § 9).
 */
function contenuConformeQr(octets: Uint8Array, morceaux: readonly MorceauPngQr[], debut: number, fin: number, entete: EnteteQr): boolean {
  const idat = morceaux.slice(debut, fin)
  let donnees: Uint8Array
  if (idat.length === 1) {
    donnees = octets.subarray(idat[0].debut + 8, idat[0].debut + 8 + idat[0].longueur)
  } else {
    donnees = new Uint8Array(idat.reduce((n, m) => n + m.longueur, 0))
    let position = 0
    for (const m of idat) {
      donnees.set(octets.subarray(m.debut + 8, m.debut + 8 + m.longueur), position)
      position += m.longueur
    }
  }
  const ligne = 1 + entete.largeur * (OCTETS_PAR_PIXEL_QR[entete.typeCouleur] ?? 0)
  const brut = decompresserZlibBorneQr(donnees, ligne * entete.hauteur)
  if (!brut) return false
  for (let y = 0; y < entete.hauteur; y++) if (brut[y * ligne] > 4) return false
  return true
}

/**
 * Analyse d'une image reçue (ou relue de la base) : PNG conforme ou refus avec sa raison — poids, signature,
 * structure (morceaux mal formés ou mal ordonnés, en-tête hors de ce que produit un canvas, accessoire de mauvaise
 * longueur ou répété), morceau_interdit (texte, métadonnées, profil ICC, palette, animation, type inconnu),
 * dimensions (au-delà de 800 × 400 px), contenu (flux zlib des IDAT illisible, trop long ou trop court, suivi d'octets,
 * filtre de ligne inconnu). Ne lève jamais.
 */
export function analyserPngQr(octets: Uint8Array): AnalysePngQr {
  if (octets.length > LOGO_OCTETS_MAX_QR) return { ok: false, raison: 'poids' }
  if (octets.length < LOGO_OCTETS_MIN_QR) return { ok: false, raison: 'structure' }
  if (SIGNATURE_PNG.some((v, i) => octets[i] !== v)) return { ok: false, raison: 'signature' }
  const morceaux = morceauxPngQr(octets)
  if (!morceaux || morceaux[0].type !== 'IHDR' || morceaux[0].longueur !== 13) return { ok: false, raison: 'structure' }
  if (morceaux.some((m) => !estAdmisQr(m.type))) return { ok: false, raison: 'morceau_interdit' }
  const entete = lireIhdr(octets, morceaux[0].debut + 8)
  if (!entete) return { ok: false, raison: 'structure' }

  // Suite imposée : IHDR, accessoires (une fois chacun, longueur fixe), IDAT à la suite, IEND (vide) en dernier.
  let i = 1
  const vus = new Set<string>()
  for (; i < morceaux.length && !CRITIQUES_QR.has(morceaux[i].type); i++) {
    const m = morceaux[i]
    const longueur = ACCESSOIRES_ADMIS_QR[m.type][entete.typeCouleur]
    if (longueur === undefined) return { ok: false, raison: 'morceau_interdit' }
    if (m.longueur !== longueur || vus.has(m.type)) return { ok: false, raison: 'structure' }
    vus.add(m.type)
  }
  const premierIdat = i
  while (i < morceaux.length && morceaux[i].type === 'IDAT') i++
  if (i === premierIdat || i !== morceaux.length - 1 || morceaux[i].type !== 'IEND' || morceaux[i].longueur !== 0) {
    return { ok: false, raison: 'structure' }
  }
  if (entete.largeur > LOGO_LARGEUR_MAX_QR || entete.hauteur > LOGO_HAUTEUR_MAX_QR) return { ok: false, raison: 'dimensions' }
  if (!contenuConformeQr(octets, morceaux, premierIdat, i, entete)) return { ok: false, raison: 'contenu' }
  return { ok: true, largeur: entete.largeur, hauteur: entete.hauteur }
}

/**
 * PNG produit par le canvas du navigateur, débarrassé de ses morceaux ACCESSOIRES non admis (texte, métadonnées propres
 * à un navigateur ou à un système : tEXt, iTXt, eXIf, iDOT, profil ICC iCCP…) avant l'envoi ; les autres octets sont
 * gardés tels quels. null : pas un PNG bien formé, ou morceau CRITIQUE non admis (première lettre majuscule : PLTE, type
 * inconnu ; ne peut pas être retiré). Le serveur, lui, ne retire rien : il refuse (analyserPngQr).
 */
export function nettoyerPngQr(octets: Uint8Array): Uint8Array<ArrayBuffer> | null {
  if (SIGNATURE_PNG.some((v, i) => octets[i] !== v)) return null
  const morceaux = morceauxPngQr(octets)
  if (!morceaux) return null
  const gardes: MorceauPngQr[] = []
  for (const m of morceaux) {
    if (estAdmisQr(m.type)) gardes.push(m)
    else if (m.type.charCodeAt(0) < 0x61) return null
  }
  const resultat = new Uint8Array(SIGNATURE_PNG.length + gardes.reduce((n, m) => n + m.fin - m.debut, 0))
  resultat.set(SIGNATURE_PNG)
  let position = SIGNATURE_PNG.length
  for (const m of gardes) {
    resultat.set(octets.subarray(m.debut, m.fin), position)
    position += m.fin - m.debut
  }
  return resultat
}

// ── Transport de l'image ─────────────────────────────────────────────────────

const HEX = '0123456789abcdef'

/** Paramètre bytea pour PostgREST : « \x » suivi de l'hexadécimal (format d'entrée de PostgreSQL). */
export function byteaDepuisOctetsQr(octets: Uint8Array): string {
  let texte = '\\x'
  for (const o of octets) texte += HEX[o >> 4] + HEX[o & 15]
  return texte
}

/** Valeur d'un chiffre hexadécimal par code de caractère (0 à 127) ; -1 : pas un chiffre hexadécimal. */
const VALEURS_HEX = (() => {
  const t = new Int8Array(128).fill(-1)
  for (let i = 0; i < 16; i++) {
    t[HEX.charCodeAt(i)] = i
    t[HEX.toUpperCase().charCodeAt(i)] = i
  }
  return t
})()

/**
 * Colonne bytea lue par PostgREST (« \x89504e47… ») → octets ; null si la valeur n'a pas cette forme. Décodage par table,
 * en un passage (relecture de sécurité du 13/11/2026 : slice et parseInt coûtaient ≈ 21 ms pour un logo de 192 Ko).
 */
export function octetsDepuisByteaQr(valeur: unknown): Uint8Array<ArrayBuffer> | null {
  if (typeof valeur !== 'string' || valeur.length < 4 || valeur.length % 2 !== 0 || valeur[0] !== '\\' || (valeur[1] !== 'x' && valeur[1] !== 'X')) return null
  const octets = new Uint8Array((valeur.length - 2) / 2)
  for (let i = 0, j = 2; i < octets.length; i++, j += 2) {
    const fort = valeur.charCodeAt(j)
    const faible = valeur.charCodeAt(j + 1)
    const h = fort < 128 ? VALEURS_HEX[fort] : -1
    const l = faible < 128 ? VALEURS_HEX[faible] : -1
    if (h < 0 || l < 0) return null
    octets[i] = (h << 4) | l
  }
  return octets
}

/** Base64 (corps de l'envoi du logo, pièce jointe en ligne d'un e-mail). */
export function base64DepuisOctetsQr(octets: Uint8Array): string {
  let binaire = ''
  for (let i = 0; i < octets.length; i += 0x8000) binaire += String.fromCharCode(...octets.subarray(i, i + 0x8000))
  return btoa(binaire)
}

/**
 * Base64 strict (longueur multiple de 4, alphabet standard, deux « = » au plus à la fin) → octets ; null sinon. Ces
 * contrôles sont ceux sous lesquels atob ne lève jamais (algorithme « forgiving-base64 » du WHATWG : après retrait du
 * remplissage, la longueur n'est jamais de la forme 4n + 1).
 */
export function octetsDepuisBase64Qr(texte: string): Uint8Array<ArrayBuffer> | null {
  if (texte.length === 0 || texte.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(texte)) return null
  return Uint8Array.from(atob(texte), (c) => c.charCodeAt(0))
}

// ── Métadonnées et adresse de lecture ────────────────────────────────────────

const dimension = (v: unknown, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= max

/** Ligne de la base (colonnes logo_version, logo_largeur, logo_hauteur) → métadonnées ; null : aucun logo, ou incohérent. */
export function metaLogoDepuisLigneQr(ligne: Readonly<Record<string, unknown>>): LogoCabinetQr | null {
  const { logo_version: version, logo_largeur: largeur, logo_hauteur: hauteur } = ligne
  if (typeof version !== 'string' || !FORMAT_VERSION_LOGO_QR.test(version)) return null
  if (!dimension(largeur, LOGO_LARGEUR_MAX_QR) || !dimension(hauteur, LOGO_HAUTEUR_MAX_QR)) return null
  return { version, largeur, hauteur }
}

/**
 * Adresse publique de l'image d'un cabinet : identifiant de son chemin public et version (empreinte de l'image), rien
 * d'autre. La version change avec l'image : l'adresse se met en cache sans fin. Barre finale : le site est en
 * trailingSlash (next.config.ts), une adresse sans elle coûterait une redirection 308 à chaque lecture.
 */
export const cheminLogoCabinetQr = (identifiant: string, version: string): string =>
  `${CHEMIN_API_LOGO_QR}/${encodeURIComponent(identifiant)}/?v=${encodeURIComponent(version)}`

// ── Affichage dans une page ou un e-mail ─────────────────────────────────────

/** Cadre d'affichage d'un logo, en pixels CSS. */
export interface BoiteLogoQr {
  largeur: number
  hauteur: number
}

/**
 * Taille affichée d'une image de `largeur` × `hauteur` pixels dans un cadre : proportions gardées, jamais agrandie
 * au-delà de sa taille réelle (un petit logo n'est pas rendu flou), entiers d'au moins 1 px. Sert aux attributs width et
 * height d'une page (place réservée : aucun décalage au chargement) et d'un e-mail (Outlook ignore max-height).
 */
export function dimensionsLogoQr(largeur: number, hauteur: number, boite: BoiteLogoQr): BoiteLogoQr {
  const echelle = Math.min(1, boite.largeur / largeur, boite.hauteur / hauteur)
  return { largeur: Math.max(1, Math.round(largeur * echelle)), hauteur: Math.max(1, Math.round(hauteur * echelle)) }
}

/**
 * Logo prêt pour une page de l'espace d'un cabinet ou la page publique du QR code (sérialisable : passé par une page
 * serveur, ou bâti dans le navigateur d'après GET /moi) : adresse de la route publique versionnée, texte alternatif (nom
 * du cabinet), dimensions de l'image en pixels.
 */
export interface LogoPageQr {
  src: string
  alt: string
  largeur: number
  hauteur: number
}

/** Logo d'une page d'après les métadonnées du logo d'un cabinet ; null : aucun logo (la page reste celle d'avant). */
export function logoPageQr(identifiant: string, nom: string, logo: LogoCabinetQr | null | undefined): LogoPageQr | null {
  if (!logo) return null
  return { src: cheminLogoCabinetQr(identifiant, logo.version), alt: nom.trim(), largeur: logo.largeur, hauteur: logo.hauteur }
}
