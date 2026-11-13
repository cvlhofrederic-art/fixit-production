// ── Logo d'un cabinet : règles pures de la conversion faite dans le navigateur ───────────────────────────────────────
//
// Demande de Hugo du 13/11/2026. Le super admin choisit une image (SVG, PNG, JPEG ou WebP, 5 Mo au plus) ; le navigateur
// la dessine sur un canvas et en tire un PNG borné (lib/aj-signalement/logo-navigateur.ts). Ce module, sans navigateur,
// fixe : le type d'après les OCTETS (jamais d'après le nom ni le type annoncé du fichier), la taille d'un SVG (attributs
// width, height, viewBox), la taille du dessin (800 × 400 px au plus, proportions gardées ; une image matricielle n'est
// jamais agrandie, un SVG est dessiné à la plus grande taille qui tient) et la réduction quand le PNG dépasse 200 Kio.

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

/**
 * Le texte commence-t-il par une racine <svg> ? Prologue admis avant elle : BOM, espaces, déclaration XML, commentaires,
 * un DOCTYPE, commentaires. Un HTML qui contient un SVG n'en est pas un. Lecture en UN passage (relecture de sécurité du
 * 13/11/2026 : l'expression régulière qui la faisait revenait en arrière de façon exponentielle sur des commentaires
 * répétés) ; un commentaire se termine au premier « --> », comme en XML.
 */
export function commenceParRacineSvgQr(t: string): boolean {
  let i = apresEspaces(t, t.startsWith('﻿') ? 1 : 0)
  if (ouvreParCi(t, i, '<?xml')) {
    const fin = t.indexOf('>', i)
    if (fin < 0 || fin - 1 < i + 5 || t[fin - 1] !== '?') return false
    i = apresEspaces(t, fin + 1)
  }
  i = apresCommentaires(t, i)
  if (i >= 0 && ouvreParCi(t, i, '<!DOCTYPE')) {
    i = apresDoctype(t, i)
    if (i >= 0) i = apresCommentaires(t, i)
  }
  return i >= 0 && ouvreParCi(t, i, '<svg') && i + 4 < t.length && (ESPACE.test(t[i + 4]) || t[i + 4] === '>' || t[i + 4] === '/')
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
