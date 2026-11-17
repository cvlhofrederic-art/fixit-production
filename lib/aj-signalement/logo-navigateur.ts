// ── Logo d'un cabinet : conversion en PNG DANS LE NAVIGATEUR (adaptateur) ───────────────────────────────────────────
//
// Demande de Hugo du 13/11/2026. L'image choisie par le super admin (SVG, PNG, JPEG ou WebP, 5 Mo au plus) est chargée
// comme IMAGE (un SVG chargé ainsi n'exécute aucun script et ne charge aucune ressource externe), dessinée sur un canvas
// à fond transparent, et rendue en PNG : 800 × 400 px au plus, proportions gardées, 200 Kio au plus (redessinée plus
// petite tant qu'il le faut). Le PNG est nettoyé de ses morceaux accessoires non admis (nettoyerPngQr) et revérifié
// (analyserPngQr) avant d'être rendu : c'est lui seul qui part au serveur, jamais le fichier d'origine.
// Relecture de sécurité du 13/11/2026 : un SVG qui contient un <foreignObject> (texte HTML) rend le canvas « tainted »
// dans Chrome et Safari (toBlob lève SecurityError) : il est refusé d'emblée (svg_html, message « exportez en PNG »),
// quel que soit le navigateur ; toute autre erreur du dessin devient un refus « navigateur », jamais une exception.
// Alerte CodeQL du 13/11/2026 (js/xss-through-dom) : le SVG n'est plus relu par DOMParser ; il est lu comme TEXTE
// (preparerSvgQr : aucune DTD, racine seule réécrite, temps linéaire), puis chargé comme image.
// Règles pures : lib/aj-signalement/logo-conversion.ts. Les outils du navigateur (adresses blob, chargement, dessin) sont
// injectables : le canvas de jsdom ne dessine pas (tests/lib/aj-signalement-logo-conversion.test.ts).

import { LOGO_OCTETS_MAX_QR, analyserPngQr, nettoyerPngQr } from '@/lib/aj-signalement/logo'
import {
  LOGO_FICHIER_MAX_QR, TYPES_MIME_LOGO_QR, dimensionsCibleLogoQr, preparerSvgQr, reductionLogoQr, typeImageLogoQr,
  type DimensionsQr,
} from '@/lib/aj-signalement/logo-conversion'

export type RaisonEchecConversionLogoQr = 'fichier_trop_lourd' | 'format' | 'illisible' | 'svg_html' | 'trop_lourd' | 'navigateur'

export type ResultatConversionLogoQr =
  | { ok: true; png: Uint8Array<ArrayBuffer>; largeur: number; hauteur: number }
  | { ok: false; raison: RaisonEchecConversionLogoQr }

/** Ce que la conversion demande au navigateur. */
export interface OutilsConversionLogoQr {
  creerUrl: (source: Blob) => string
  revoquerUrl: (url: string) => void
  /** Image chargée (dimensions naturelles) ; rejette si le navigateur ne sait pas la lire. */
  charger: (url: string) => Promise<HTMLImageElement>
  /** Dessin sur un canvas largeur × hauteur à fond transparent ; PNG rendu, null si le navigateur n'en produit pas. */
  dessiner: (image: HTMLImageElement, largeur: number, hauteur: number) => Promise<Blob | null>
}

/** Outils du navigateur courant. */
export const OUTILS_NAVIGATEUR_LOGO_QR: OutilsConversionLogoQr = {
  creerUrl: (source) => URL.createObjectURL(source),
  revoquerUrl: (url) => URL.revokeObjectURL(url),
  charger: (url) => new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('image illisible'))
    image.src = url
  }),
  dessiner: (image, largeur, hauteur) => {
    const canvas = document.createElement('canvas')
    canvas.width = largeur
    canvas.height = hauteur
    const contexte = canvas.getContext('2d')
    if (!contexte) return Promise.resolve(null)
    contexte.clearRect(0, 0, largeur, hauteur)
    contexte.imageSmoothingEnabled = true
    contexte.imageSmoothingQuality = 'high'
    contexte.drawImage(image, 0, 0, largeur, hauteur)
    return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  },
}

/**
 * SVG prêt à charger comme image, lu comme TEXTE (preparerSvgQr, aucun analyseur DOM ni XML) : racine réécrite avec la
 * taille du dessin. Un SVG mal formé ailleurs que dans sa racine ne se charge pas : refus « illisible » au chargement.
 */
function preparerSvg(octets: Uint8Array): { source: Blob; cible: DimensionsQr } | 'illisible' | 'svg_html' {
  const prepare = preparerSvgQr(new TextDecoder('utf-8').decode(octets))
  if (typeof prepare === 'string') return prepare
  return { source: new Blob([prepare.svg], { type: TYPES_MIME_LOGO_QR.svg }), cible: prepare.cible }
}

/** Dessins successifs, plus petits tant que le PNG dépasse 200 Kio ; PNG nettoyé et revérifié. */
async function dessinerBorne(image: HTMLImageElement, depart: DimensionsQr, outils: OutilsConversionLogoQr): Promise<ResultatConversionLogoQr> {
  let dimensions: DimensionsQr | null = depart
  while (dimensions) {
    const rendu = await outils.dessiner(image, dimensions.largeur, dimensions.hauteur)
    if (!rendu) return { ok: false, raison: 'navigateur' }
    if (rendu.size <= LOGO_OCTETS_MAX_QR) {
      // Nettoyé, le PNG n'est jamais plus lourd : seul un rendu anormal du navigateur est refusé ici.
      const png = nettoyerPngQr(new Uint8Array(await rendu.arrayBuffer()))
      const analyse = png ? analyserPngQr(png) : null
      if (!png || !analyse?.ok) return { ok: false, raison: 'navigateur' }
      return { ok: true, png, largeur: analyse.largeur, hauteur: analyse.hauteur }
    }
    dimensions = reductionLogoQr(dimensions)
  }
  return { ok: false, raison: 'trop_lourd' }
}

/** Fichier choisi → PNG borné, ou la raison du refus (le message est choisi par l'écran). */
export async function convertirLogoQr(fichier: Blob, outils: OutilsConversionLogoQr = OUTILS_NAVIGATEUR_LOGO_QR): Promise<ResultatConversionLogoQr> {
  if (fichier.size > LOGO_FICHIER_MAX_QR) return { ok: false, raison: 'fichier_trop_lourd' }
  const octets = new Uint8Array(await fichier.arrayBuffer())
  const type = typeImageLogoQr(octets)
  if (!type) return { ok: false, raison: 'format' }

  let source: Blob
  let cible: DimensionsQr | null = null
  if (type === 'svg') {
    const prepare = preparerSvg(octets)
    if (typeof prepare === 'string') return { ok: false, raison: prepare }
    source = prepare.source
    cible = prepare.cible
  } else {
    source = new Blob([octets], { type: TYPES_MIME_LOGO_QR[type] })
  }

  const url = outils.creerUrl(source)
  try {
    let image: HTMLImageElement
    try {
      image = await outils.charger(url)
    } catch (e) {
      console.warn('[aj-signalement] logo non chargé par le navigateur', e instanceof Error ? e.message : 'inconnue')
      return { ok: false, raison: 'illisible' }
    }
    const naturelles = { largeur: image.naturalWidth, hauteur: image.naturalHeight }
    if (!cible && (naturelles.largeur <= 0 || naturelles.hauteur <= 0)) return { ok: false, raison: 'illisible' }
    try {
      return await dessinerBorne(image, cible ?? dimensionsCibleLogoQr(naturelles, false), outils)
    } catch (e) {
      // Canvas « tainted » (SecurityError), mémoire, rendu illisible : un refus, jamais une exception (nom seul au journal).
      console.warn('[aj-signalement] logo non converti par le navigateur', e instanceof Error ? e.name : 'inconnue')
      return { ok: false, raison: 'navigateur' }
    }
  } finally {
    outils.revoquerUrl(url)
  }
}
