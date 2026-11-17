// ── QR code d'une copropriété : matrice, SVG, PNG et affiche PDF ──────────────
//
// La matrice vient de la bibliothèque `qrcode` (déjà utilisée pour les factures PT) ; le rendu SVG est
// fait en React (un seul <path>), sans HTML injecté. Le PNG et l'affiche A4 (jsPDF) ne tournent que
// dans le navigateur (canvas) et ne sont chargés qu'au clic. Depuis le 11/11/2026 : toutes les affiches d'un import en
// un seul PDF (affichesPdfQr, une page par copropriété, même mise en page).
// Depuis le 13/11/2026 (demande de Hugo) : logo du cabinet de la copropriété, quand il en a un (OptionsAfficheQr.logo, PNG
// lu par la route publique du logo) : posé dans une zone BLANCHE sous le bandeau bleu nuit (un logo sombre y reste
// lisible), au-dessus du nom de la copropriété, centré, proportions gardées, dans un cadre de 80 × 20 mm ; le reste de la
// page descend de la hauteur du logo (+ 2 mm), l'adresse du lien et le pied de page restent en place. Sans logo, la page
// est identique à celle d'avant (même suite d'appels jsPDF : tests/lib/aj-signalement-affiches-logo.test.ts).

export interface MatriceQr {
  /** Nombre de modules par côté. */
  taille: number
  /** Modules sombres, ligne par ligne (taille × taille). */
  sombres: boolean[]
}

/** Matrice du QR code (correction d'erreur M : lisible même partiellement abîmé une fois imprimé). */
export async function matriceQr(texte: string): Promise<MatriceQr> {
  const QRCode = (await import('qrcode')).default
  const code = QRCode.create(texte, { errorCorrectionLevel: 'M' })
  const { size, data } = code.modules
  return { taille: size, sombres: Array.from(data as ArrayLike<number>, (v) => v === 1) }
}

/** Côté du dessin SVG (modules + marge de chaque côté), dans l'unité du viewBox. */
export const coteSvgQr = (matrice: MatriceQr, marge = 2): number => matrice.taille + 2 * marge

/** Un carré par module sombre : « M3 2h1v1h-1z… », à placer dans un <path> du viewBox 0 0 côté côté. */
export function cheminSvgQr(matrice: MatriceQr, marge = 2): string {
  const carres: string[] = []
  for (let y = 0; y < matrice.taille; y++) {
    for (let x = 0; x < matrice.taille; x++) {
      if (matrice.sombres[y * matrice.taille + x]) carres.push(`M${x + marge} ${y + marge}h1v1h-1z`)
    }
  }
  return carres.join('')
}

/** PNG (data URL) du QR code, navigateur seulement ; null sans canvas (tests, serveur). */
export function pngQr(matrice: MatriceQr, pixelsParModule = 16, marge = 4): string | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  const cote = (matrice.taille + 2 * marge) * pixelsParModule
  canvas.width = cote
  canvas.height = cote
  const contexte = canvas.getContext('2d')
  if (!contexte) return null
  contexte.fillStyle = '#FFFFFF'
  contexte.fillRect(0, 0, cote, cote)
  contexte.fillStyle = '#0D1B2E'
  for (let y = 0; y < matrice.taille; y++) {
    for (let x = 0; x < matrice.taille; x++) {
      if (matrice.sombres[y * matrice.taille + x]) {
        contexte.fillRect((x + marge) * pixelsParModule, (y + marge) * pixelsParModule, pixelsParModule, pixelsParModule)
      }
    }
  }
  return canvas.toDataURL('image/png')
}

/** « parc-belle-ombre » : nom de fichier sûr tiré du nom de la copropriété. */
export function nomFichierQr(nom: string): string {
  const base = nom.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return base || 'copropriete'
}

/** Déclenche le téléchargement d'un fichier (data URL ou Blob) dans le navigateur. */
export function telechargerFichier(nomFichier: string, contenu: Blob | string): void {
  if (typeof document === 'undefined') return
  const url = typeof contenu === 'string' ? contenu : URL.createObjectURL(contenu)
  const lien = document.createElement('a')
  lien.href = url
  lien.download = nomFichier
  lien.rel = 'noopener'
  document.body.appendChild(lien)
  lien.click()
  lien.remove()
  if (typeof contenu !== 'string') setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export interface AfficheQr {
  nom: string
  adresse: string
  url: string
  matrice: MatriceQr
}

/** Une copropriété dont on veut l'affiche ; la matrice du QR code est calculée au moment de l'impression. */
export type ElementAfficheQr = Omit<AfficheQr, 'matrice'>

/** Logo du cabinet pour l'affiche : le PNG (revérifié, lu par la route publique du logo) et sa taille en pixels. */
export interface LogoAfficheQr {
  png: Uint8Array
  largeur: number
  hauteur: number
}

export interface OptionsAfficheQr {
  /** Logo du cabinet de la copropriété ; absent ou null : l'affiche d'avant, à l'identique. */
  logo?: LogoAfficheQr | null
}

/**
 * Cadre du logo sur l'affiche (mm) : largeur et hauteur maximales, haut du logo (6 mm sous le bandeau de 42 mm), espace
 * ajouté sous le logo au décalage du reste de la page.
 */
export const CADRE_LOGO_AFFICHE_QR = { largeur: 80, hauteur: 20, haut: 48, espace: 2 } as const
/** Alias jsPDF du logo : sur toutes les pages d'un même PDF, l'image n'est incorporée qu'une fois. */
const ALIAS_LOGO_AFFICHE_QR = 'logo-cabinet'

/** Taille du logo sur l'affiche (mm) : la plus grande qui tient dans le cadre, proportions gardées. */
export function tailleLogoAfficheQr(logo: Pick<LogoAfficheQr, 'largeur' | 'hauteur'>): { largeur: number; hauteur: number } {
  const echelle = Math.min(CADRE_LOGO_AFFICHE_QR.largeur / logo.largeur, CADRE_LOGO_AFFICHE_QR.hauteur / logo.hauteur)
  return { largeur: logo.largeur * echelle, hauteur: logo.hauteur * echelle }
}

type DocumentPdf = InstanceType<typeof import('jspdf').jsPDF>

/**
 * Affiche A4 à imprimer et poser dans la copropriété : bandeau, nom de la copropriété, consigne, QR code,
 * adresse du lien. Police Helvetica (caractères latins, apostrophes droites).
 */
export async function affichePdfQr(affiche: AfficheQr, options: OptionsAfficheQr = {}): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  dessinerAfficheQr(pdf, affiche, options.logo ?? null)
  return pdf.output('blob')
}

/**
 * Toutes les affiches d'une liste (après un import) : UN PDF, une page par copropriété, même mise en page que
 * affichePdfQr. jsPDF et qrcode chargés à l'appel (clic) ; pages produites l'une après l'autre, avancement à chacune.
 */
export async function affichesPdfQr(
  liste: readonly ElementAfficheQr[], onAvancement?: (fait: number, total: number) => void, options: OptionsAfficheQr = {},
): Promise<Blob> {
  if (liste.length === 0) throw new RangeError('aucune affiche à préparer')
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  for (const [i, element] of liste.entries()) {
    if (i > 0) pdf.addPage()
    dessinerAfficheQr(pdf, { ...element, matrice: await matriceQr(element.url) }, options.logo ?? null)
    onAvancement?.(i + 1, liste.length)
  }
  return pdf.output('blob')
}

/** Une affiche sur la page courante du document ; le logo du cabinet, s'il y en a un, sous le bandeau. */
function dessinerAfficheQr(pdf: DocumentPdf, affiche: AfficheQr, logo: LogoAfficheQr | null): void {
  const largeur = 210
  const centre = largeur / 2

  pdf.setFillColor(13, 27, 46)
  pdf.rect(0, 0, largeur, 42, 'F')
  pdf.setTextColor(201, 168, 76)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(13)
  pdf.text('AJ SIGNALEMENT', centre, 16, { align: 'center' })
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(24)
  pdf.text('Un problème dans la copropriété ?', centre, 30, { align: 'center' })

  // Zone blanche du logo : tout ce qui suit descend d'autant ; sans logo, rien ne change (décalage nul, aucun appel).
  let decalage = 0
  if (logo) {
    const taille = tailleLogoAfficheQr(logo)
    pdf.addImage(logo.png, 'PNG', centre - taille.largeur / 2, CADRE_LOGO_AFFICHE_QR.haut, taille.largeur, taille.hauteur, ALIAS_LOGO_AFFICHE_QR, 'FAST')
    decalage = taille.hauteur + CADRE_LOGO_AFFICHE_QR.espace
  }

  pdf.setTextColor(13, 27, 46)
  pdf.setFontSize(22)
  pdf.text(affiche.nom, centre, 60 + decalage, { align: 'center', maxWidth: 180 })
  if (affiche.adresse) {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(13)
    pdf.setTextColor(74, 94, 120)
    pdf.text(affiche.adresse, centre, 70 + decalage, { align: 'center', maxWidth: 180 })
  }

  const coteQr = 105
  const yQr = 80 + decalage
  const png = pngQr(affiche.matrice, 16, 2)
  if (png) pdf.addImage(png, 'PNG', centre - coteQr / 2, yQr, coteQr, coteQr)

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(16)
  pdf.setTextColor(13, 27, 46)
  pdf.text("Scannez ce QR code avec l'appareil photo de votre téléphone", centre, yQr + coteQr + 14, { align: 'center', maxWidth: 180 })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(12.5)
  pdf.setTextColor(31, 45, 61)
  pdf.text(
    "Décrivez le problème (fuite, panne, ascenseur, parties communes...) et laissez vos coordonnées : l'administrateur de la copropriété reçoit votre signalement immédiatement.",
    centre, yQr + coteQr + 24, { align: 'center', maxWidth: 170 },
  )

  pdf.setFontSize(10)
  pdf.setTextColor(74, 94, 120)
  pdf.text(affiche.url, centre, 272, { align: 'center' })
  pdf.setFontSize(9)
  pdf.text('AJ Signalement - un service VITFIX', centre, 284, { align: 'center' })
}
