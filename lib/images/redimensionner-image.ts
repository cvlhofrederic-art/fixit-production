/**
 * Redimensionnement d'une image dans le navigateur avant envoi (photo de profil, logo d'artisan) : 512 px de côté
 * au plus, encodée en WebP quand le navigateur sait l'écrire (PNG sinon, transparence conservée). Lot 3 de
 * l'analyse Sentry du 28/10/2026 : un logo envoyé tel quel pesait jusqu'à 500 Ko de base64 ; redimensionné, il
 * pèse quelques dizaines de Ko dans Storage, les PDF et la fiche publique.
 *
 * Si le navigateur ne sait ni décoder ni encoder l'image, la data: URL du fichier d'origine est renvoyée : l'envoi
 * reste possible et la route /api/save-logo contrôle le format réel.
 */
export const COTE_MAX_IMAGE_ARTISAN = 512
export const QUALITE_WEBP = 0.9
/** Au-delà, le décodage est abandonné et le fichier d'origine est envoyé tel quel. */
export const DELAI_DECODAGE_MS = 10_000

function avecDelai<T>(promesse: Promise<T>, delaiMs: number): Promise<T> {
  return new Promise<T>((resoudre, rejeter) => {
    const minuteur = setTimeout(() => rejeter(new Error(`décodage abandonné après ${delaiMs} ms`)), delaiMs)
    promesse.then(
      (valeur) => { clearTimeout(minuteur); resoudre(valeur) },
      (erreur: unknown) => { clearTimeout(minuteur); rejeter(erreur) },
    )
  })
}

export interface Dimensions {
  largeur: number
  hauteur: number
}

/** Dimensions cibles : rapport conservé, plus grand côté ramené à `coteMax` au plus, jamais agrandi. */
export function calculerDimensions(largeur: number, hauteur: number, coteMax: number = COTE_MAX_IMAGE_ARTISAN): Dimensions {
  if (!(largeur > 0) || !(hauteur > 0) || !(coteMax > 0)) return { largeur: 0, hauteur: 0 }
  const plusGrand = Math.max(largeur, hauteur)
  if (plusGrand <= coteMax) return { largeur: Math.round(largeur), hauteur: Math.round(hauteur) }
  const ratio = coteMax / plusGrand
  return {
    largeur: Math.max(1, Math.round(largeur * ratio)),
    hauteur: Math.max(1, Math.round(hauteur * ratio)),
  }
}

function lireEnDataUrl(fichier: Blob): Promise<string> {
  return new Promise((resoudre, rejeter) => {
    const lecteur = new FileReader()
    lecteur.onload = () => resoudre(String(lecteur.result ?? ''))
    lecteur.onerror = () => rejeter(lecteur.error ?? new Error('lecture du fichier impossible'))
    lecteur.readAsDataURL(fichier)
  })
}

interface SourceImage {
  source: CanvasImageSource
  largeur: number
  hauteur: number
  liberer: () => void
}

async function chargerSource(fichier: Blob): Promise<SourceImage> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(fichier)
    return { source: bitmap, largeur: bitmap.width, hauteur: bitmap.height, liberer: () => bitmap.close() }
  }
  const url = URL.createObjectURL(fichier)
  const image = await new Promise<HTMLImageElement>((resoudre, rejeter) => {
    const img = new Image()
    img.onload = () => resoudre(img)
    img.onerror = () => rejeter(new Error('image illisible'))
    img.src = url
  })
  return { source: image, largeur: image.naturalWidth, hauteur: image.naturalHeight, liberer: () => URL.revokeObjectURL(url) }
}

function canvasVersBlob(canvas: HTMLCanvasElement, type: string, qualite?: number): Promise<Blob | null> {
  return new Promise((resoudre) => canvas.toBlob(resoudre, type, qualite))
}

export interface ImageRedimensionnee {
  /** data: URL (WebP ou PNG si redimensionnée, format d'origine sinon). */
  dataUrl: string
  redimensionnee: boolean
}

export async function redimensionnerImage(
  fichier: Blob,
  coteMax: number = COTE_MAX_IMAGE_ARTISAN,
  delaiMs: number = DELAI_DECODAGE_MS,
): Promise<ImageRedimensionnee> {
  try {
    const { source, largeur, hauteur, liberer } = await avecDelai(chargerSource(fichier), delaiMs)
    try {
      const cible = calculerDimensions(largeur, hauteur, coteMax)
      if (cible.largeur === 0) throw new Error('dimensions nulles')
      const canvas = document.createElement('canvas')
      canvas.width = cible.largeur
      canvas.height = cible.hauteur
      const contexte = canvas.getContext('2d')
      if (!contexte) throw new Error('canvas 2d indisponible')
      contexte.drawImage(source, 0, 0, cible.largeur, cible.hauteur)
      let blob = await canvasVersBlob(canvas, 'image/webp', QUALITE_WEBP)
      // Navigateur sans encodeur WebP (Safari ancien) : il renvoie un PNG ou null.
      if (!blob || blob.type !== 'image/webp') blob = await canvasVersBlob(canvas, 'image/png')
      if (!blob) throw new Error('encodage impossible')
      return { dataUrl: await lireEnDataUrl(blob), redimensionnee: true }
    } finally {
      liberer()
    }
  } catch {
    return { dataUrl: await lireEnDataUrl(fichier), redimensionnee: false }
  }
}
