/**
 * PDF generator for Rapport d'Intervention — Vitfix Pro
 * Pixel-perfect reproduction of build_rapport.py (PyMuPDF) using jsPDF.
 * A4, 2 pages, Helvetica only, 7-color palette.
 * Une société qui a son propre gabarit de relatório (modeleRapportSociete) reçoit celui-ci à la place.
 */

import type { ModeleRapport } from '@/lib/pdf/modeles-societes'

export interface RapportPDFData {
  rapportNumber: string
  /** Création du rapport (ISO) : date d'émission stable des gabarits de société. */
  createdAt?: string
  refDevisFact: string
  // Artisan
  artisanName: string
  artisanAddress: string
  artisanPhone: string
  artisanEmail: string
  artisanSiret: string
  artisanInsurance: string
  // Client
  clientName: string
  clientPhone: string
  clientEmail: string
  clientAddress: string
  // Intervention
  interventionDate: string
  startTime: string
  endTime: string
  siteAddress: string
  motif: string
  // Travaux
  travaux: string[]
  materiaux: string[]
  observations: string
  recommendations: string
  status: string
  linkedPhotoIds?: string[]
}

export interface PhotoForPDF {
  id: string
  url?: string
  taken_at?: string
  lat?: number
  lng?: number
  [key: string]: unknown
}

// ─── Palette ────────────────────────────────────────────────────────
const JAUNE = '#FFD600'
const NOIR = '#0D0D0D'
const GRIS_F = '#F5F5F3'
const GRIS_B = '#E0E0DC'
const GRIS_T = '#888888'
const BLANC = '#FFFFFF'
const VERT = '#4CAF50'

// ─── Dimensions (pt) ────────────────────────────────────────────────
const PW = 595.28
const PH = 841.89
const ML = 51
const MR = 51
const MT = 30
const GAP = 11
const CONTENT_W = PW - ML - MR

/**
 * Parse "nom (quantité)" from a free-text material string.
 * Falls back to full string as designation with "—" quantity.
 */
function parseMaterial(s: string): { nom: string; qte: string } {
  // Try patterns: "Nom (2 u)", "Nom (8 m²)", "Nom x3", "Nom - 2u"
  const m = s.match(/^(.+?)\s*[\(]\s*(.+?)\s*[\)]$/)
  if (m) return { nom: m[1].trim(), qte: m[2].trim() }
  const m2 = s.match(/^(.+?)\s*[-–—]\s*(\d+\s*\S+)$/)
  if (m2) return { nom: m2[1].trim(), qte: m2[2].trim() }
  return { nom: s, qte: '—' }
}

// Libellés du PDF par langue de l'interface, clé par clé : [français, portugais]. Le français est celui d'avant, au
// caractère près ; le portugais suit l'écran des relatórios (titre « Relatório de obra » pour une société BTP,
// « de intervenção » pour un artisan).
type Paire<T> = readonly [fr: T, pt: T]
const p = <T,>(fr: T, pt: T): Paire<T> => [fr, pt]
const TEXTES_RAPPORT = {
  titreBtp: p("Rapport d'intervention", 'Relatório de obra'),
  titre: p("Rapport d'intervention", 'Relatório de intervenção'),
  statuts: p<Record<string, string>>(
    { termine: 'Terminé', en_cours: 'En cours', a_reprendre: 'À reprendre', sous_garantie: 'Sous garantie' },
    { termine: 'Concluído', en_cours: 'Em curso', a_reprendre: 'A retomar', sous_garantie: 'Em garantia' },
  ),
  etabliLe: p('Établi le', 'Emitido em'),
  statut: p('Statut', 'Estado'),
  lieA: p('Lié à : ', 'Associado a: '),
  prestataire: p('PRESTATAIRE', 'PRESTADOR'),
  client: p('CLIENT', 'CLIENTE'),
  tel: p('Tél : ', 'Tel.: '),
  email: p('E-mail : ', 'E-mail: '),
  identifiant: p('SIRET : ', 'NIF: '),
  identifiantPied: p('SIRET', 'NIF'),
  assurance: p('Assurance : ', 'Seguro: '),
  separateur: p(' — ', ' · '),
  genere: p('Document généré par Vitfix Pro', 'Documento gerado pelo Vitfix Pro'),
  page: p('Page', 'Página'),
  details: p("Détails de l'intervention", 'Detalhes da intervenção'),
  colonnes: p(['DATE', 'HEURE DÉBUT', 'HEURE FIN', 'DURÉE'], ['DATA', 'HORA DE INÍCIO', 'HORA DE FIM', 'DURAÇÃO']),
  adresseChantier: p('Adresse chantier : ', 'Morada da obra: '),
  motif: p("Motif d'intervention", 'Motivo da intervenção'),
  travaux: p('Travaux réalisés', 'Trabalhos realizados'),
  materiaux: p('Matériaux utilisés', 'Materiais utilizados'),
  designation: p('DÉSIGNATION', 'DESIGNAÇÃO'),
  quantite: p('QUANTITÉ', 'QUANTIDADE'),
  separateurPage2: p('  —  ', '  ·  '),
  observationsRecommandations: p('Observations / Recommandations', 'Observações / Recomendações'),
  observations: p('Observations', 'Observações'),
  recommandations: p('Recommandations', 'Recomendações'),
  photos: p('Photos chantier', 'Fotos da obra'),
  photoIndisponible: p('Photo non disponible', 'Foto indisponível'),
  aucunePhoto: p('Aucune photo liée.', 'Nenhuma foto associada.'),
  ajouterPhotos: p('Ajoutez des photos depuis le module pour les inclure dans le rapport.', 'Adicione fotos a partir do módulo para as incluir no relatório.'),
  signatures: p('Validation et signatures', 'Validação e assinaturas'),
  signaturePrestataire: p('SIGNATURE PRESTATAIRE', 'ASSINATURA DO PRESTADOR'),
  signatureClient: p('SIGNATURE CLIENT', 'ASSINATURA DO CLIENTE'),
  dateSignature: p('Date  ___ / ___ / ______', 'Data  ___ / ___ / ______'),
}
type TextesRapport = { [K in keyof typeof TEXTES_RAPPORT]: (typeof TEXTES_RAPPORT)[K][0] }

/** Libellés du PDF dans une langue (portugais si `pt`, sinon français). */
function textesRapport(pt: boolean): TextesRapport {
  const i = pt ? 1 : 0
  return Object.fromEntries(Object.entries(TEXTES_RAPPORT).map(([cle, paire]) => [cle, paire[i]])) as TextesRapport
}

/** Compute duration string from HH:MM times */
function computeDuration(start: string, end: string): string {
  if (!start || !end) return '—'
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const mins = (eh * 60 + em) - (sh * 60 + sm)
  if (mins <= 0) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h${m > 0 ? String(m).padStart(2, '0') : '00'}`
}

/** Format date for display (DD/MM/YYYY) */
function formatDateDisplay(dateStr: string, locale: string): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return dateStr
  }
}

/**
 * Generate a PDF for a rapport d'intervention.
 * Dynamically imports jsPDF so the module stays tree-shakeable.
 */
export async function generateRapportPDF(
  r: RapportPDFData,
  availablePhotos: PhotoForPDF[],
  dateFmtLocale: string,
  /** Rôle du compte : en portugais, le titre est « Relatório de obra » pour une société BTP. */
  orgRole?: string,
  /** Gabarit propre à la société (lib/pdf/modeles-societes.ts) ; absent : le PDF ci-dessous. */
  modele?: ModeleRapport,
): Promise<void> {
  const { jsPDF } = await import('jspdf')
  if (modele === 'vitfix-relatorio') {
    const { rendreRelatorioVitfix } = await import('@/lib/pdf/modele-vitfix-relatorio')
    const documento = await rendreRelatorioVitfix(jsPDF, r, availablePhotos)
    documento.save(`${r.rapportNumber}.pdf`)
    return
  }
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: [PW, PH] })

  // Langue du PDF : celle de l'interface (dateFmtLocale « pt-PT » ou « fr-FR »).
  const T = textesRapport(dateFmtLocale.startsWith('pt'))
  const titreRapport = orgRole === 'pro_societe' ? T.titreBtp : T.titre
  const dateEtabli = new Date().toLocaleDateString(dateFmtLocale, { day: '2-digit', month: '2-digit', year: 'numeric' })
  const statusText = T.statuts[r.status] || r.status
  const isTermine = r.status === 'termine'
  const duration = computeDuration(r.startTime, r.endTime)
  const dateDisplay = formatDateDisplay(r.interventionDate, dateFmtLocale)
  const docLie = r.refDevisFact || ''

  // ─── Helper: section label with underline ──────────────────────────
  const sectionLabel = (yBase: number, text: string): number => {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.setTextColor(NOIR)
    pdf.text(text.toUpperCase(), ML, yBase + 12)
    pdf.setDrawColor(GRIS_B)
    pdf.setLineWidth(0.3)
    pdf.line(ML, yBase + 20, PW - MR, yBase + 20)
    return yBase + 28
  }

  // ─── Helper: filled rect with border ───────────────────────────────
  const box = (x0: number, y0: number, x1: number, y1: number, fill = GRIS_F) => {
    pdf.setFillColor(fill)
    pdf.setDrawColor(GRIS_B)
    pdf.setLineWidth(0.5)
    pdf.rect(x0, y0, x1 - x0, y1 - y0, 'FD')
  }

  // ─── Helper: center text in cell ───────────────────────────────────
  const centerText = (text: string, x: number, y: number, w: number, font: string, size: number, color: string) => {
    pdf.setFont('helvetica', font === 'hebo' ? 'bold' : 'normal')
    pdf.setFontSize(size)
    pdf.setTextColor(color)
    const tw = pdf.getTextWidth(text)
    pdf.text(text, x + (w - tw) / 2, y)
  }

  // ─── Helper: footer ────────────────────────────────────────────────
  const drawFooter = (pageNum: number, totalPages: number) => {
    const fy = PH - 28
    pdf.setDrawColor(GRIS_B)
    pdf.setLineWidth(0.3)
    pdf.line(ML, fy, PW - MR, fy)

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(GRIS_T)
    const siretStr = r.artisanSiret ? `${T.identifiantPied} ${r.artisanSiret}` : ''
    const footerLeft = `${r.artisanName}${siretStr ? `${T.separateur}${siretStr}` : ''}${T.separateur}${T.genere}${T.separateur}${dateEtabli}`
    pdf.text(footerLeft, ML, fy + 12)

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(7.5)
    pdf.text(`${T.page} ${pageNum} / ${totalPages}`, PW - MR - 46, fy + 12)
  }

  // ─── Pagination ────────────────────────────────────────────────────
  // Bas de la zone utile, au-dessus du filet du pied de page (PH - 28). Avant, rien ne passait à la page suivante :
  // au-delà de six photos liées, ou d'une longue liste de travaux, la suite sortait de la page sous le pied.
  const BAS_UTILE = PH - 40

  /** Nouvelle page avec l'en-tête réduit des pages 2 et suivantes ; rend l'ordonnée du contenu. */
  const pageSuivante = (): number => {
    pdf.addPage([PW, PH])
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(14)
    pdf.setTextColor(NOIR)
    pdf.text(titreRapport, ML, MT + 20)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(GRIS_T)
    pdf.text(`${r.rapportNumber}${T.separateurPage2}${r.artisanName}`, ML, MT + 34)
    pdf.setDrawColor(GRIS_B)
    pdf.setLineWidth(0.3)
    pdf.line(ML, MT + 44, PW - MR, MT + 44)
    return MT + 58
  }

  // ═══════════════════════════════════════════════════════════════════
  // PAGE 1
  // ═══════════════════════════════════════════════════════════════════

  // ─── Header ────────────────────────────────────────────────────────
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(20)
  pdf.setTextColor(NOIR)
  pdf.text(titreRapport, ML, MT + 26)

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.setTextColor(GRIS_T)
  pdf.text(r.rapportNumber, ML, MT + 46)

  // Right-side metadata — aligned so "Lié à : XXX" ends at PW - MR
  const lieTxt = docLie ? `${T.lieA}${docLie}` : ''
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  const lieTw = lieTxt ? pdf.getTextWidth(lieTxt) : 0
  const xMeta = lieTxt ? (PW - MR - lieTw - 4.5) : (PW - MR - 100)

  // "Établi le"
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(GRIS_T)
  pdf.text(T.etabliLe, xMeta, MT + 12)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.setTextColor(NOIR)
  pdf.text(dateEtabli, xMeta, MT + 27)

  // "Statut" + pastille
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(GRIS_T)
  pdf.text(T.statut, xMeta, MT + 40)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.setTextColor(NOIR)
  pdf.text(statusText, xMeta, MT + 55)
  const statutTw = pdf.getTextWidth(statusText)
  // Pastille (circle r=3)
  const pastilleColor = isTermine ? VERT : JAUNE
  pdf.setFillColor(pastilleColor)
  pdf.circle(xMeta + statutTw + 8, MT + 52, 3, 'F')

  // "Lié à : ..."
  if (lieTxt) {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(GRIS_T)
    pdf.text(lieTxt, xMeta, MT + 68)
  }

  // Filet jaune
  let y = MT + 82
  pdf.setDrawColor(JAUNE)
  pdf.setLineWidth(2.5)
  pdf.line(ML, y, PW - MR, y)

  // ─── 01 — PRESTATAIRE / CLIENT ─────────────────────────────────────
  const y0_cards = y + 12
  const colW = (PW - ML - MR - GAP) / 2
  const cardH = 108

  // Prestataire card
  box(ML, y0_cards, ML + colW, y0_cards + cardH)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.setTextColor(GRIS_T)
  pdf.text(T.prestataire, ML + 11, y0_cards + 14)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.setTextColor(NOIR)
  pdf.text(r.artisanName || '', ML + 11, y0_cards + 30)
  let ly = y0_cards + 44
  const prestaLines = [
    r.artisanAddress,
    r.artisanPhone ? `${T.tel}${r.artisanPhone}` : '',
    r.artisanEmail ? `${T.email}${r.artisanEmail}` : '',
    r.artisanSiret ? `${T.identifiant}${r.artisanSiret}` : '',
    r.artisanInsurance ? `${T.assurance}${r.artisanInsurance}` : '',
  ].filter(Boolean)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(NOIR)
  for (const line of prestaLines) {
    pdf.text(line, ML + 11, ly)
    ly += 12
  }

  // Client card
  const cx = ML + colW + GAP
  box(cx, y0_cards, cx + colW, y0_cards + cardH)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.setTextColor(GRIS_T)
  pdf.text(T.client, cx + 11, y0_cards + 14)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.setTextColor(NOIR)
  pdf.text(r.clientName || '', cx + 11, y0_cards + 30)
  ly = y0_cards + 44
  const clientLines = [
    r.clientAddress,
    r.clientPhone ? `${T.tel}${r.clientPhone}` : '',
    r.clientEmail ? `${T.email}${r.clientEmail}` : '',
  ].filter(Boolean)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(NOIR)
  for (const line of clientLines) {
    pdf.text(line, cx + 11, ly)
    ly += 12
  }

  y = y0_cards + cardH + 8

  // ─── 02 — DÉTAILS DE L'INTERVENTION ────────────────────────────────
  y = sectionLabel(y, T.details)

  const headers = T.colonnes
  const values = [dateDisplay, r.startTime || '—', r.endTime || '—', duration]
  const cellW = CONTENT_W / 4

  // Header row
  for (let i = 0; i < 4; i++) {
    const cx2 = ML + i * cellW
    pdf.setFillColor(GRIS_F)
    pdf.setDrawColor(GRIS_B)
    pdf.setLineWidth(0.5)
    pdf.rect(cx2, y, cellW, 18, 'FD')
    centerText(headers[i], cx2, y + 12, cellW, 'hebo', 7.5, GRIS_T)
  }
  y += 18

  // Values row
  for (let i = 0; i < 4; i++) {
    const cx2 = ML + i * cellW
    pdf.setFillColor(BLANC)
    pdf.setDrawColor(GRIS_B)
    pdf.setLineWidth(0.5)
    pdf.rect(cx2, y, cellW, 28, 'FD')
    centerText(values[i], cx2, y + 19, cellW, 'hebo', 13, NOIR)
  }
  y += 28 + 10

  // Adresse chantier
  box(ML, y, PW - MR, y + 22)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.setTextColor(NOIR)
  pdf.text(`${T.adresseChantier}${r.siteAddress || '—'}`, ML + 11, y + 15)
  y += 22 + 8

  // ─── 03 — MOTIF D'INTERVENTION ─────────────────────────────────────
  y = sectionLabel(y, T.motif)
  box(ML, y, PW - MR, y + 24)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.setTextColor(NOIR)
  pdf.text(r.motif || '—', ML + 11, y + 16)
  y += 24 + 8

  // ─── 04 — TRAVAUX RÉALISÉS ─────────────────────────────────────────
  const travaux = (r.travaux || []).filter(t => t.trim())
  if (travaux.length > 0) {
    if (y + 28 + 20 > BAS_UTILE) y = pageSuivante()
    y = sectionLabel(y, T.travaux)
    for (let i = 0; i < travaux.length; i++) {
      if (y + 20 > BAS_UTILE) y = pageSuivante()
      const fill = i % 2 === 0 ? GRIS_F : BLANC
      pdf.setFillColor(fill)
      pdf.setDrawColor(GRIS_B)
      pdf.setLineWidth(0.3)
      pdf.rect(ML, y, CONTENT_W, 20, 'FD')
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)
      pdf.setTextColor(NOIR)
      pdf.text(travaux[i], ML + 11, y + 14)
      y += 20
    }
    y += 8
  }

  // ─── 05 — MATÉRIAUX UTILISÉS ───────────────────────────────────────
  const materiaux = (r.materiaux || []).filter(m => m.trim())
  if (materiaux.length > 0) {
    if (y + 28 + 18 + 18 > BAS_UTILE) y = pageSuivante()
    y = sectionLabel(y, T.materiaux)

    // Black header row (répété en haut d'une page suivante)
    const enteteMateriaux = () => {
      pdf.setFillColor(NOIR)
      pdf.rect(ML, y, CONTENT_W, 18, 'F')
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(7.5)
      pdf.setTextColor(BLANC)
      pdf.text(T.designation, ML + 11, y + 13)
      pdf.text(T.quantite, PW - MR - 70, y + 13)
      y += 18
    }
    enteteMateriaux()

    // Data rows (zebra)
    for (let i = 0; i < materiaux.length; i++) {
      if (y + 18 > BAS_UTILE) {
        y = pageSuivante()
        enteteMateriaux()
      }
      const { nom, qte } = parseMaterial(materiaux[i])
      const fill = i % 2 === 0 ? GRIS_F : BLANC
      pdf.setFillColor(fill)
      pdf.setDrawColor(GRIS_B)
      pdf.setLineWidth(0.3)
      pdf.rect(ML, y, CONTENT_W, 18, 'FD')
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)
      pdf.setTextColor(NOIR)
      pdf.text(nom, ML + 11, y + 13)
      pdf.setFont('helvetica', 'bold')
      pdf.text(qte, PW - MR - 70, y + 13)
      y += 18
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // PAGE 2
  // ═══════════════════════════════════════════════════════════════════
  let y2 = pageSuivante()

  // ─── 06 — OBSERVATIONS / RECOMMANDATIONS ───────────────────────────
  y2 = sectionLabel(y2, T.observationsRecommandations)

  const colW2 = (PW - ML - MR - GAP) / 2
  const boxH = 80

  // Observations
  box(ML, y2, ML + colW2, y2 + boxH)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.setTextColor(GRIS_T)
  pdf.text(T.observations, ML + 11, y2 + 14)
  if (r.observations) {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(NOIR)
    const obsLines = pdf.splitTextToSize(r.observations, colW2 - 22)
    pdf.text(obsLines, ML + 11, y2 + 28)
  }

  // Recommandations
  const cx3 = ML + colW2 + GAP
  box(cx3, y2, cx3 + colW2, y2 + boxH)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.setTextColor(GRIS_T)
  pdf.text(T.recommandations, cx3 + 11, y2 + 14)
  if (r.recommendations) {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(NOIR)
    const recLines = pdf.splitTextToSize(r.recommendations, colW2 - 22)
    pdf.text(recLines, cx3 + 11, y2 + 28)
  }

  y2 += boxH + 12

  // ─── 07 — PHOTOS CHANTIER ─────────────────────────────────────────
  y2 = sectionLabel(y2, T.photos)

  const linkedPhotos = r.linkedPhotoIds?.length
    ? availablePhotos.filter(p => r.linkedPhotoIds?.includes(p.id))
    : []

  if (linkedPhotos.length > 0) {
    // Grid layout for photos
    const photoColW = (CONTENT_W - GAP) / 2
    const photoH = 120
    let photoCol = 0

    for (let i = 0; i < linkedPhotos.length; i++) {
      if (photoCol === 0 && y2 + photoH > BAS_UTILE) y2 = pageSuivante()
      const photo = linkedPhotos[i]
      const px = ML + photoCol * (photoColW + GAP)

      try {
        const img = await loadImage(photo.url || '')
        const imgRatio = img.width / img.height
        let drawW = photoColW - 8, drawH = photoH - 8
        if (imgRatio > drawW / drawH) { drawH = drawW / imgRatio } else { drawW = drawH * imgRatio }

        box(px, y2, px + photoColW, y2 + photoH)
        const imgX = px + (photoColW - drawW) / 2
        const imgY = y2 + (photoH - drawH) / 2

        const canvas = document.createElement('canvas')
        canvas.width = Math.min(img.width, 2400)
        canvas.height = Math.round(canvas.width / imgRatio)
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'high'
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          const imgData = canvas.toDataURL('image/jpeg', 0.92)
          pdf.addImage(imgData, 'JPEG', imgX, imgY, drawW, drawH)
        }
      } catch {
        box(px, y2, px + photoColW, y2 + photoH)
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(9)
        pdf.setTextColor(GRIS_T)
        pdf.text(T.photoIndisponible, px + 11, y2 + photoH / 2)
      }

      photoCol++
      if (photoCol >= 2) {
        photoCol = 0
        y2 += photoH + 8
      }
    }
    if (photoCol > 0) y2 += photoH + 8
  } else {
    // No photos placeholder
    box(ML, y2, PW - MR, y2 + 40)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(GRIS_T)
    pdf.text(T.aucunePhoto, ML + 11, y2 + 18)
    pdf.setFontSize(8)
    pdf.text(T.ajouterPhotos, ML + 11, y2 + 32)
    y2 += 40 + 12
  }

  // ─── 08 — VALIDATION ET SIGNATURES ─────────────────────────────────
  const sigH = 90
  // Le bloc des signatures ne se coupe pas : il passe entier à la page suivante.
  if (y2 + 28 + sigH > BAS_UTILE) y2 = pageSuivante()
  y2 = sectionLabel(y2, T.signatures)

  const sigW = (PW - ML - MR - GAP) / 2

  // Prestataire signature
  box(ML, y2, ML + sigW, y2 + sigH, BLANC)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(7.5)
  pdf.setTextColor(GRIS_T)
  pdf.text(T.signaturePrestataire, ML + 11, y2 + 14)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.setTextColor(NOIR)
  pdf.text(r.artisanName || '', ML + 11, y2 + 30)
  // Signature line
  pdf.setDrawColor(GRIS_B)
  pdf.setLineWidth(0.4)
  pdf.line(ML + 11, y2 + sigH - 26, ML + sigW - 11, y2 + sigH - 26)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8.5)
  pdf.setTextColor(NOIR)
  pdf.text(T.dateSignature, ML + 11, y2 + sigH - 10)

  // Client signature
  const cx4 = ML + sigW + GAP
  box(cx4, y2, cx4 + sigW, y2 + sigH, BLANC)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(7.5)
  pdf.setTextColor(GRIS_T)
  pdf.text(T.signatureClient, cx4 + 11, y2 + 14)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.setTextColor(NOIR)
  pdf.text(r.clientName || '', cx4 + 11, y2 + 30)
  // Signature line
  pdf.setDrawColor(GRIS_B)
  pdf.setLineWidth(0.4)
  pdf.line(cx4 + 11, y2 + sigH - 26, cx4 + sigW - 11, y2 + sigH - 26)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8.5)
  pdf.setTextColor(NOIR)
  pdf.text(T.dateSignature, cx4 + 11, y2 + sigH - 10)

  // ─── Footers (both pages) ──────────────────────────────────────────
  const totalPages = pdf.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i)
    drawFooter(i, totalPages)
  }

  pdf.save(`${r.rapportNumber}.pdf`)
}

// ─── Image loader ────────────────────────────────────────────────────
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Image load failed'))
    img.src = url
  })
}
