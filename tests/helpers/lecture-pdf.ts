// Lecture des PDF produits par les tests des gabarits (pdf.js) : morceaux de texte de chaque page avec leur position,
// puis texte de la page dans l'ordre de lecture. Commun aux tests des gabarits Method Soluções et Vitfix.
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const RACINE = process.cwd()

/** Espace insécable (U+00A0). */
export const NB = String.fromCharCode(0xa0)
/** Texte tel qu'il se lit dans le PDF (espaces insécables ramenés à des espaces). */
export const lu = (s: string) => s.split(NB).join(' ')

/** Morceau de texte d'une page : origine en bas à gauche, en points. */
export interface Texte { str: string; x: number; y: number; largeur: number }

let pdfjs: typeof import('pdfjs-dist/legacy/build/pdf.mjs') | null = null

/** Morceaux de texte de chaque page (pdf.js), avec leur position. */
export async function lirePdf(octets: Uint8Array): Promise<Texte[][]> {
  if (!pdfjs) {
    pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(join(RACINE, 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs')).href
  }
  // Données des polices standard (Helvetica du repli) : sans elles, pdf.js mesure mal le texte non embarqué.
  const standardFontDataUrl = `${join(RACINE, 'node_modules/pdfjs-dist/standard_fonts').split('\\').join('/')}/`
  const chargement = pdfjs.getDocument({ data: new Uint8Array(octets), useSystemFonts: false, standardFontDataUrl })
  const doc = await chargement.promise
  const pages: Texte[][] = []
  for (let n = 1; n <= doc.numPages; n++) {
    const contenu = await (await doc.getPage(n)).getTextContent()
    pages.push(contenu.items.flatMap((item) => ('str' in item && item.str.trim()
      ? [{ str: item.str, x: item.transform[4], y: item.transform[5], largeur: item.width }]
      : [])))
  }
  await chargement.destroy()
  return pages
}

/** Ordre de lecture : morceaux regroupés par ligne de base (à 1 pt près), de haut en bas, puis de gauche à droite. */
export function ordreDeLecture(page: Texte[]): string {
  const lignes: Texte[][] = []
  for (const m of [...page].sort((a, b) => b.y - a.y)) {
    const ligneTrouvee = lignes.find((l) => Math.abs(l[0].y - m.y) <= 1)
    if (ligneTrouvee) ligneTrouvee.push(m)
    else lignes.push([m])
  }
  return lu(lignes.map((l) => l.sort((a, b) => a.x - b.x).map((m) => m.str).join(' ')).join(' ')).replace(/ +/g, ' ')
}
