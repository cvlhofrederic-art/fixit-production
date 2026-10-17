/**
 * Devis et factures de PROVENCE PRO (SAS, SIREN 131 197 253).
 *
 * Même modèle BTP que toutes les sociétés (lib/pdf/devis-pdf-v3.ts), avec trois
 * différences reprises du devis de référence fourni par la société le 16/10/2026 :
 *  - logo vectoriel centré en haut de la première page (lib/pdf/provence-pro-logo.ts),
 *    à la place du logo image en haut à droite ;
 *  - contenu de la première page décalé vers le bas de 22,9 pt pour loger ce logo ;
 *  - filet rouge brique (#c2410c, couleur du « Pro » du logo) au lieu de l'orange.
 *
 * Seule la fiche PROVENCE_PRO_PROFIL_ID reçoit ce modèle : le générateur V3 n'en
 * tient compte que quand `modele === 'provence-pro'`.
 */

import type { jsPDF } from 'jspdf'
import {
  LOGO_PROVENCE_PRO_CHEMINS,
  LOGO_PROVENCE_PRO_HAUT_PT,
  LOGO_PROVENCE_PRO_LARGEUR_PT,
} from '@/lib/pdf/provence-pro-logo'

/** Fiche profiles_artisan de PROVENCE PRO. */
export const PROVENCE_PRO_PROFIL_ID = '4397dc9e-d115-47cc-ae6b-cfeedc971eb5'

export type ModeleDocument = 'provence-pro'

/** Modèle de document propre à une société, ou undefined pour le modèle par défaut. */
export function modeleDocumentSociete(profilId: string | null | undefined): ModeleDocument | undefined {
  return profilId === PROVENCE_PRO_PROFIL_ID ? 'provence-pro' : undefined
}

/** Couleur du filet et des autres touches de couleur du modèle : le rouge du « Pro ». */
export const COULEUR_ACCENT_PROVENCE_PRO = '#c2410c'

const MM_PAR_PT = 25.4 / 72

/** Décalage vers le bas du contenu de la première page, en mm (22,9 pt). */
export const DECALAGE_EN_TETE_PROVENCE_PRO_MM = 22.9 * MM_PAR_PT

/** Dessine le logo, centré horizontalement en haut de la page courante. `pageW` en mm. */
export function dessinerLogoProvencePro(pdf: jsPDF, pageW: number) {
  const x0 = pageW / 2 - (LOGO_PROVENCE_PRO_LARGEUR_PT * MM_PAR_PT) / 2
  const y0 = LOGO_PROVENCE_PRO_HAUT_PT * MM_PAR_PT
  pdf.saveGraphicsState()
  for (const { couleur, chemin } of LOGO_PROVENCE_PRO_CHEMINS) {
    pdf.setFillColor(couleur)
    tracerChemin(pdf, chemin, x0, y0)
    pdf.fill()
  }
  pdf.restoreGraphicsState()
}

/** Trace un chemin « M x y L x y C x1 y1 x2 y2 x y Z » (points, relatif à x0/y0 en mm). */
function tracerChemin(pdf: jsPDF, chemin: string, x0: number, y0: number) {
  const X = (v: number) => x0 + v * MM_PAR_PT
  const Y = (v: number) => y0 + v * MM_PAR_PT
  for (const segment of chemin.match(/[MLCZ][^MLCZ]*/g) ?? []) {
    const n = segment.slice(1).trim().split(' ').map(Number)
    switch (segment[0]) {
      case 'M': pdf.moveTo(X(n[0]), Y(n[1])); break
      case 'L': pdf.lineTo(X(n[0]), Y(n[1])); break
      case 'C': pdf.curveTo(X(n[0]), Y(n[1]), X(n[2]), Y(n[3]), X(n[4]), Y(n[5])); break
      case 'Z': pdf.close(); break
    }
  }
}
