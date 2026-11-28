/**
 * Images des PDF BTP (générateur V3 et gabarits de société).
 *
 * Un PNG sorti d'un canvas (logo, signature) a toujours une couche alpha. Sans compression demandée, jsPDF
 * l'incorpore alors brut, pixel par pixel : un logo de 500 px pesait près d'1 Mo dans chaque PDF, une
 * signature 0,9 Mo. La compression Flate (« FAST ») est sans perte : le rendu reste identique au pixel près.
 */
export const COMPRESSION_PNG = 'FAST' as const

/**
 * Fond blanc sous une photo avant son export en JPEG. Le JPEG n'a pas de transparence : un pixel transparent
 * du canvas (PNG détouré, capture avec transparence) y devenait noir. Sans effet sur une photo opaque, dont
 * chaque pixel recouvre entièrement le blanc.
 */
export function fondBlancAvantJpeg(contexte: CanvasRenderingContext2D, largeur: number, hauteur: number): void {
  contexte.fillStyle = '#ffffff'
  contexte.fillRect(0, 0, largeur, hauteur)
}
