// Outils des tests d'images des PDF BTP : images exportées par un vrai canvas Chromium, canvas et Image
// du navigateur simulés (jsdom ne dessine pas), relevé des images incorporées au PDF.
import { vi } from 'vitest'

/** PNG 4 × 2 à couche alpha (deux colonnes opaques, une à 50 %, une transparente), exporté par un canvas Chromium. */
export const PNG_ALPHA_4X2 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAACCAYAAAB/qH1jAAAAGUlEQVR4AWI65MjzH4TldKIaGICACYhREAAAAP//HAZ7JQAAAAZJREFUAwCTZAVFLYgHggAAAABJRU5ErkJggg=='

/** JPEG 4 × 2 opaque exporté par un canvas Chromium (profil ICC compris). */
export const JPEG_4X2 =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAACAAQDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAbEAEAAAcAAAAAAAAAAAAAAAAAAgQFFlWU0f/EABUBAQEAAAAAAAAAAAAAAAAAAAED/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8Aj1yVfKTuxH0Arv/Z'

export interface ImageDuPdf {
  largeur: number
  hauteur: number
  /** Filtre de compression du flux (« FlateDecode », « DCTDecode ») ; « aucun » = pixels bruts. */
  filtre: string
  /** L'image porte un masque de transparence (/SMask). */
  masque: boolean
}

/** Images (XObject) incorporées au PDF, masques de transparence compris. */
export function imagesDuPdf(octets: Uint8Array | ArrayBuffer): ImageDuPdf[] {
  const texte = Buffer.from(octets instanceof ArrayBuffer ? new Uint8Array(octets) : octets).toString('latin1')
  const images: ImageDuPdf[] = []
  for (const occurrence of texte.matchAll(/\/Subtype \/Image/g)) {
    const debut = texte.lastIndexOf(' obj', occurrence.index)
    const fin = texte.indexOf('stream', occurrence.index)
    const dictionnaire = texte.slice(debut, fin)
    const nombre = (cle: string) => Number(new RegExp(`/${cle} (\\d+)`).exec(dictionnaire)?.[1])
    images.push({
      largeur: nombre('Width'),
      hauteur: nombre('Height'),
      filtre: /\/Filter \/(\w+)/.exec(dictionnaire)?.[1] ?? 'aucun',
      masque: /\/SMask \d+ 0 R/.test(dictionnaire),
    })
  }
  return images
}

/** Image du navigateur simulée : chargée (onload) aux dimensions données dès que `src` est posée. */
export function imageChargee(largeur: number, hauteur: number) {
  return class {
    crossOrigin = ''
    width = largeur
    height = hauteur
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    set src(_url: string) {
      setTimeout(() => this.onload?.(), 0)
    }
  }
}

/**
 * Canvas simulé : chaque opération de dessin est notée dans l'ordre ; l'export rend les images ci-dessus
 * (JPEG pour 'image/jpeg', PNG à couche alpha sinon, comme un vrai canvas).
 */
export function canvasFactice(): string[] {
  const operations: string[] = []
  const contexte = {
    imageSmoothingEnabled: false,
    imageSmoothingQuality: 'low',
    set fillStyle(valeur: string) {
      operations.push(`fillStyle ${valeur}`)
    },
    fillRect: (x: number, y: number, largeur: number, hauteur: number) => {
      operations.push(`fillRect ${x} ${y} ${largeur} ${hauteur}`)
    },
    drawImage: () => {
      operations.push('drawImage')
    },
    scale: () => {},
  }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    (() => contexte) as unknown as HTMLCanvasElement['getContext'],
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(
    (type?: string) => (type === 'image/jpeg' ? JPEG_4X2 : PNG_ALPHA_4X2),
  )
  return operations
}
