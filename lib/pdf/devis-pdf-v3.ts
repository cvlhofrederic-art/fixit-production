/**
 * Devis PDF Generator V3 — extracted from DevisFactureForm.tsx
 * Full jsPDF + autoTable generator matching spec: devis_lepore_logo_arbre.pdf
 *
 * This file contains the pure PDF generation logic with zero React/component dependencies.
 * All data is passed via the PdfV3Input interface.
 */

import type { ProductLine, DevisAcompte, SignatureData } from '@/lib/devis-types'
import { formatUnitForPdf, titleCaseAddress, getStatusLabel } from '@/lib/devis-utils'
import type { Locale } from '@/lib/i18n/config'

// ─── Types ───────────────────────────────────────────────

export interface PdfV3Artisan {
  id?: string
  logo_url?: string | null
  company_name?: string
  rm?: string | null
  rc_pro?: string | null
}

export interface PdfV3Photo {
  id: string
  url: string
  label?: string
  taken_at?: string
  lat?: number
  lng?: number
}

export interface PdfV3Rapport {
  rapportNumber: string
  interventionDate?: string
  startTime?: string
  endTime?: string
  motif?: string
  siteAddress?: string
}

export interface PdfV3PtFiscalData {
  docNumber: string
  hashDisplay: string
  atcudDisplay: string
  qrCodeString: string
  certNumber: string
}

export interface PdfV3Input {
  // Locale
  locale: Locale
  localeFormats: {
    currencyFormat: (n: number) => string
    taxLabel: string
  }
  t: (key: string) => string

  // Document
  docType: 'devis' | 'facture'
  docNumber: string
  docTitle: string
  docDate: string
  docValidity: number
  prestationDate: string
  executionDelay: string

  // Company
  companyStatus: string
  companyName: string
  companySiret: string
  companyAddress: string
  companyRCS: string
  companyCapital: string
  companyPhone: string
  companyEmail: string
  tvaEnabled: boolean
  tvaNumber: string
  insuranceName: string
  insuranceNumber: string
  insuranceCoverage: string
  insuranceType: 'rc_pro' | 'decennale' | 'both'
  mediatorName: string
  mediatorUrl: string
  isHorsEtablissement: boolean

  // Client
  clientName: string
  clientEmail: string
  clientAddress: string
  clientPhone: string
  clientSiret: string
  clientType: 'particulier' | 'professionnel'
  interventionAddress: string
  interventionBatiment: string
  interventionEtage: string
  interventionEspacesCommuns: string
  interventionExterieur: string

  // Company extras
  companyAPE: string

  // Payment
  paymentMode: string
  paymentDue: string
  paymentCondition: string
  discount: string
  penaltyRate: string
  recoveryFee: string
  iban: string
  bic: string

  // Lines & totals
  lines: ProductLine[]
  // Optional split rendering: when present, the PDF renders two separate tables
  // (Main d'oeuvre / Matériaux) instead of a single "lines" block.
  laborLines?: ProductLine[]
  materialLines?: ProductLine[]
  fraisLines?: ProductLine[]
  // BTP — noms personnalisés des 3 sections + masquage doux + tables custom additionnelles
  linesName?: string
  materialLinesName?: string
  fraisLinesName?: string
  materialLinesEnabled?: boolean
  fraisLinesEnabled?: boolean
  customTables?: { id: string; name: string; category?: 'labor' | 'material' | 'frais'; lines: ProductLine[] }[]
  subtotalHT: number
  totalTTC: number

  // Acomptes
  acomptesEnabled: boolean
  acomptes: DevisAcompte[]

  // Notes
  notes: string
  sourceDevisRef: string | null

  // Signature
  signatureData: SignatureData | null

  // Attached rapport & photos
  attachedRapport: PdfV3Rapport | null
  selectedPhotos: PdfV3Photo[]

  // Artisan (for logo refresh)
  artisan: PdfV3Artisan | null

  // PT fiscal (pre-registered)
  ptFiscalData: PdfV3PtFiscalData | null

  // Helpers passed from component (browser-dependent)
  svgToImageDataUrl: (svgString: string, width: number, height: number) => Promise<string>
  fetchFreshLogo: () => Promise<string | null>

  // Output mode: 'download' saves file, 'preview' opens in new tab
  action?: 'download' | 'preview'
}

// ─── Helpers ──────────────────────────────────────

/**
 * Remplace les caractères Unicode non supportés par helvetica (ISO-8859-1).
 * Empêche le rendu fantôme (ex. ᵉ rendu "l", ≤ rendu "d", ≥ rendu "e").
 *
 * Couvre :
 * - Superscripts → équivalent ASCII
 * - Symboles maths (≤≥≠≈) → ASCII
 * - Flèches (→←↔) → ASCII
 * - Cases à cocher (☐☑☒) → [ ]/[x]
 * - Zero-width spaces → supprimés
 * - Emojis (Unicode blocs 1F300-1FAFF, 2600-27BF) → supprimés
 *   (sinon helvetica rend des glyphes vides ou des caractères fantômes)
 */
function sanitizeForHelvetica(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .replace(/[ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖʳˢᵗᵘᵛʷˣʸᶻ]/g, ch => ({ ᵃ:'a',ᵇ:'b',ᶜ:'c',ᵈ:'d',ᵉ:'e',ᶠ:'f',ᵍ:'g',ʰ:'h',ⁱ:'i',ʲ:'j',ᵏ:'k',ˡ:'l',ᵐ:'m',ⁿ:'n',ᵒ:'o',ᵖ:'p',ʳ:'r',ˢ:'s',ᵗ:'t',ᵘ:'u',ᵛ:'v',ʷ:'w',ˣ:'x',ʸ:'y',ᶻ:'z' } as Record<string,string>)[ch] || ch)
    .replace(/≤/g, '<=').replace(/≥/g, '>=')
    .replace(/≠/g, '!=').replace(/≈/g, '~=')
    .replace(/→/g, '->').replace(/←/g, '<-').replace(/↔/g, '<->')
    .replace(/[☑☒]/g, '[x]').replace(/☐/g, '[ ]')
    .replace(/[​-‍﻿]/g, '') // zero-width spaces
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/gu, '') // emojis
}

/**
 * Découpe une adresse française en rue + code postal/ville.
 * Ex : "12 Boulevard Longchamp, 13001 Marseille"
 *   → { street: "12 Boulevard Longchamp", city: "13001 Marseille" }
 * Retourne city=null si aucun code postal 5 chiffres détecté.
 */
function splitAddress(addr: string): { street: string; city: string | null } {
  if (!addr) return { street: '', city: null }
  // Cherche un code postal 5 chiffres + ville (avec ou sans virgule avant)
  const m = addr.match(/^(.+?)[\s,]+(\d{5}\s+.+?)$/)
  if (!m) return { street: addr, city: null }
  const street = m[1].replace(/[\s,]+$/, '').trim()
  const city = m[2].trim()
  return { street, city }
}

// ─── Main generator ──────────────────────────────────────

export async function generateDevisPdfV3(input: PdfV3Input): Promise<{ filename: string }> {
  // Pre-sanitize : tous les champs textuels saisis par l'utilisateur passent par
  // sanitizeForHelvetica AVANT d'être utilisés. Évite emojis fantômes, glyphes
  // manquants, caractères Unicode hors ISO-8859-1 dans le PDF rendu.
  const _s = sanitizeForHelvetica
  const sanitizedInput: PdfV3Input = {
    ...input,
    // Identité doc
    docTitle: _s(input.docTitle),
    // Émetteur (entreprise) — tous les champs textuels libres ou semi-libres
    companyName: _s(input.companyName),
    companyAddress: _s(input.companyAddress),
    companyPhone: _s(input.companyPhone),
    companyEmail: _s(input.companyEmail),
    companySiret: _s(input.companySiret),
    companyRCS: _s(input.companyRCS),
    companyAPE: _s(input.companyAPE),
    companyCapital: _s(input.companyCapital),
    tvaNumber: _s(input.tvaNumber),
    // Assurance / médiateur (insuranceType est un enum strict, pas user-typable)
    insuranceName: _s(input.insuranceName),
    insuranceNumber: _s(input.insuranceNumber),
    insuranceCoverage: _s(input.insuranceCoverage),
    mediatorName: _s(input.mediatorName),
    // Destinataire (client) + lieu d'intervention
    clientName: _s(input.clientName),
    clientAddress: _s(input.clientAddress),
    clientPhone: _s(input.clientPhone),
    clientEmail: _s(input.clientEmail),
    clientSiret: _s(input.clientSiret),
    interventionAddress: _s(input.interventionAddress),
    interventionBatiment: _s(input.interventionBatiment),
    interventionEtage: _s(input.interventionEtage),
    interventionEspacesCommuns: _s(input.interventionEspacesCommuns),
    interventionExterieur: _s(input.interventionExterieur),
    // Paiement (champs libres)
    paymentCondition: _s(input.paymentCondition),
    iban: _s(input.iban),
    bic: _s(input.bic),
    // Notes libres
    notes: _s(input.notes),
  }
  const {
    locale, localeFormats, t,
    docType, docNumber, docTitle, docDate, docValidity,
    prestationDate, executionDelay,
    companyStatus, companyName, companySiret, companyAddress,
    companyRCS, companyCapital, companyPhone, companyEmail,
    tvaEnabled, tvaNumber,
    insuranceName, insuranceNumber, insuranceCoverage, insuranceType,
    mediatorName, mediatorUrl, isHorsEtablissement,
    clientName, clientEmail, clientAddress, clientPhone, clientSiret, clientType,
    interventionAddress, interventionBatiment, interventionEtage,
    interventionEspacesCommuns, interventionExterieur,
    companyAPE,
    paymentMode, paymentDue, paymentCondition, discount, penaltyRate, recoveryFee, iban, bic,
    lines, laborLines, materialLines, fraisLines, subtotalHT, totalTTC,
    linesName, materialLinesName, fraisLinesName, materialLinesEnabled, fraisLinesEnabled, customTables,
    acomptesEnabled, acomptes,
    notes, sourceDevisRef,
    signatureData, attachedRapport, selectedPhotos,
    ptFiscalData,
    svgToImageDataUrl, fetchFreshLogo,
  } = sanitizedInput

  // Dynamic imports (browser-only)
  let jsPDFMod: typeof import('jspdf'), autoTableModule: typeof import('jspdf-autotable')
  try {
    [jsPDFMod, autoTableModule] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  } catch (chunkErr) {
    const retryKey = 'pdf_chunk_retry'
    if (!sessionStorage.getItem(retryKey)) {
      sessionStorage.setItem(retryKey, '1')
      window.location.reload()
    } else {
      sessionStorage.removeItem(retryKey)
      alert('Erreur de chargement PDF. Rechargez la page (Ctrl+R) et réessayez.')
    }
    throw new Error('PDF chunk load failed')
  }
  const { jsPDF } = jsPDFMod
  const autoTable = autoTableModule.default

  // ════════════════════════════════════════════════════════════════
  // DESIGN PDF V3
  // ════════════════════════════════════════════════════════════════
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()   // 210mm
  const pageH = pdf.internal.pageSize.getHeight()   // 297mm

  // ─── Couleurs spec ───
  const COLOR_TEXT = '#0D0D0D'
  const COLOR_TEXT_LIGHT = '#888888'
  const COLOR_BG_GRAY = '#F5F5F3'
  const COLOR_BORDER = '#E0E0DC'
  const COLOR_ACCENT = '#E8A020'
  const COLOR_WHITE = '#FFFFFF'

  // ─── Marges (mm) ───
  const mL = 18.0
  const mR = 18.0
  const contentW = pageW - mL - mR  // ~174mm
  const xRight = pageW - mR          // 192mm
  let y = 0  // curseur vertical courant

  // ─── Helpers ───
  const dateLocaleStr = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const ptToMm = (pt: number) => pt / 2.835

  const drawHLine = (x1: number, yPos: number, x2: number, color = COLOR_BORDER, width = 0.18) => {
    pdf.setDrawColor(color); pdf.setLineWidth(width); pdf.line(x1, yPos, x2, yPos)
  }
  const drawVLine = (x: number, y1: number, y2: number, color = COLOR_BORDER, width = 0.18) => {
    pdf.setDrawColor(color); pdf.setLineWidth(width); pdf.line(x, y1, x, y2)
  }
  const checkPageBreak = (needed: number): boolean => {
    if (y + needed > pageH - 15) { pdf.addPage(); y = 18; return true }
    return false
  }

  // ═══ 1. LOGO (coin haut-droit, bord droit aligné avec la fin de la ligne orange) ═══
  let logoUrl = await fetchFreshLogo()
  if (logoUrl) {
    try {
      const logoImg = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error('Logo load failed'))
        img.src = logoUrl!
      })
      const canvas = document.createElement('canvas')
      const maxSize = 500
      const ratio = logoImg.width / logoImg.height
      canvas.width = Math.min(logoImg.width, maxSize)
      canvas.height = Math.round(canvas.width / ratio)
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(logoImg, 0, 0, canvas.width, canvas.height)
        const logoData = canvas.toDataURL('image/png')
        // 23mm max box (65pt / 2.835)
        const logoMaxW = 23, logoMaxH = 23
        let lw = logoMaxW, lh = logoMaxH
        if (ratio > 1) { lh = lw / ratio } else { lw = lh * ratio }
        // Aligné à droite : bord droit du logo = pageW - mR (même axe que la ligne orange et les blocs)
        const logoX = pageW - mR - lw
        const logoY = 2.8
        pdf.addImage(logoData, 'PNG', logoX, logoY, lw, lh)
      }
    } catch {
      // pas de logo = on saute
    }
  }

  // ═══ 2. TITRE DOCUMENT (centré, contraint pour ne pas chevaucher le logo) ═══
  y = 25  // ~71pt du haut
  const displayDocNumber = ptFiscalData?.docNumber || docNumber
  // Le logo occupe ~23mm à droite (logoMaxW), placé à pageW - mR - lw.
  // Pour un titre centré sur pageW/2 sans chevauchement, on contraint la
  // largeur max à 2 × (pageW/2 - logoLeft) où logoLeft = pageW - mR - 23.
  // Soit titleMaxW = pageW - 2 × (mR + 23 + 5_buffer).
  const logoZoneW = 23 + 5 // logoMaxW + buffer visuel
  const titleMaxW = pageW - 2 * (mR + logoZoneW)
  pdf.setFontSize(16); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR_TEXT)
  const rawTitle = docTitle || (docType === 'devis'
    ? (locale === 'pt' ? 'Orçamento' : 'Devis')
    : (locale === 'pt' ? 'Fatura' : 'Facture'))
  const safeTitle = sanitizeForHelvetica(rawTitle)
  // Réduit progressivement la taille de police jusqu'à ce que le titre tienne
  // sur 1 seule ligne dans la zone safe (sans chevaucher le logo).
  let titleSize = 16
  let titleLines = pdf.splitTextToSize(safeTitle, titleMaxW) as string[]
  while (titleLines.length > 1 && titleSize > 10) {
    titleSize -= 1
    pdf.setFontSize(titleSize)
    titleLines = pdf.splitTextToSize(safeTitle, titleMaxW) as string[]
  }
  pdf.text(titleLines, pageW / 2, y, { align: 'center' })
  // Hauteur ligne ~ size * 0.35mm + interligne
  y += titleLines.length * (titleSize * 0.4) + 2

  // Numéro document
  pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR_TEXT_LIGHT)
  pdf.text(displayDocNumber, pageW / 2, y, { align: 'center' })
  y += 3

  // ── PT Fiscal: ATCUD + Hash ──
  if (ptFiscalData) {
    y += 1
    pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor('#1D4ED8')
    pdf.text(ptFiscalData.atcudDisplay, pageW / 2, y, { align: 'center' })
    y += 3
    pdf.setFontSize(6); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR_TEXT_LIGHT)
    pdf.text(`Hash: ${ptFiscalData.hashDisplay}`, pageW / 2, y, { align: 'center' })
    y += 3
  }

  // ═══ 3. LIGNE D'ACCENT OR ═══
  y += 1
  pdf.setFillColor(COLOR_ACCENT)
  pdf.rect(mL, y, contentW, ptToMm(3), 'F')  // ~1.06mm de haut
  y += ptToMm(3) + 5  // ~5mm gap

  // ═══ 4. BLOCS ÉMETTEUR & DESTINATAIRE ═══
  const gapBoxes = ptToMm(11)  // ~3.88mm gap
  const emBoxW = ptToMm(235.62)  // ~83.1mm
  const destBoxW = contentW - emBoxW - gapBoxes  // ~87mm
  const boxX_em = mL
  const boxX_dest = mL + emBoxW + gapBoxes
  const boxStartY = y
  const boxPadX = ptToMm(11)  // ~3.88mm padding intérieur
  const boxPadTop = ptToMm(12)  // ~4.23mm padding top (plus aéré)

  // ── Mesure hauteur émetteur ──
  let ey = boxStartY + boxPadTop
  const emTx = boxX_em + boxPadX
  const emMaxW = emBoxW - boxPadX * 2

  ey += ptToMm(18)  // label ÉMETTEUR
  ey += ptToMm(14) * 2 + 1.5  // nom entreprise (peut wraper) + espace après nom
  if (companyAddress) {
    const sp = splitAddress(companyAddress)
    ey += ptToMm(14)                 // Adresse
    if (sp.city) ey += ptToMm(14)    // Ville
  }
  if (companyPhone) ey += ptToMm(14)
  if (companyEmail) ey += ptToMm(14)
  if (companySiret) ey += ptToMm(14)
  if (companyRCS) ey += ptToMm(14)
  if (tvaEnabled && tvaNumber) ey += ptToMm(14)
  if (companyAPE) ey += ptToMm(14)
  if (companyCapital) ey += ptToMm(14)

  // ── Mesure hauteur destinataire ──
  let dy2 = boxStartY + boxPadTop
  const destTx = boxX_dest + boxPadX
  const destMaxW = destBoxW - boxPadX * 2

  dy2 += ptToMm(18)  // label DESTINATAIRE
  dy2 += ptToMm(14) + 1.5  // nom client + espace après nom
  if (clientAddress) {
    const sp = splitAddress(clientAddress)
    dy2 += ptToMm(14)                 // Adresse
    if (sp.city) dy2 += ptToMm(14)    // Ville
  }
  if (interventionAddress || interventionBatiment || interventionEtage) {
    dy2 += ptToMm(14)  // Intervention adresse
    if (interventionAddress) {
      const sp = splitAddress(interventionAddress)
      if (sp.city) dy2 += ptToMm(14)  // Ville intervention
    }
  }
  if (interventionBatiment || interventionEtage) dy2 += ptToMm(14)
  if (interventionEspacesCommuns) dy2 += ptToMm(14)
  if (interventionExterieur) dy2 += ptToMm(14)
  if (clientPhone) dy2 += ptToMm(14)
  if (clientEmail) dy2 += ptToMm(14)
  if (clientSiret) dy2 += ptToMm(14)

  // Calculer la hauteur max et dessiner les encadrés
  const boxH = Math.max(ey, dy2) - boxStartY + boxPadTop
  pdf.setFillColor(COLOR_BG_GRAY); pdf.setDrawColor(COLOR_BORDER); pdf.setLineWidth(0.18)
  pdf.rect(boxX_em, boxStartY, emBoxW, boxH, 'FD')
  pdf.rect(boxX_dest, boxStartY, destBoxW, boxH, 'FD')

  // Émetteur
  let ey2 = boxStartY + boxPadTop
  pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR_TEXT_LIGHT)
  pdf.text(locale === 'pt' ? 'EMITENTE' : 'ÉMETTEUR', emTx, ey2)
  ey2 += ptToMm(18)
  pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR_TEXT)
  const companyNameWithStatus = `${companyName} (${getStatusLabel(companyStatus, t)})`
  const nameLines = pdf.splitTextToSize(companyNameWithStatus, emMaxW)
  pdf.text(nameLines, emTx, ey2)
  ey2 += nameLines.length * ptToMm(14) + 1.5  // léger espace après le nom
  pdf.setFontSize(10); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR_TEXT)
  // Ordre : Adresse → Ville → Tél → Email → SIRET → RCS → TVA → APE → Capital
  if (companyAddress) {
    const addrNorm = companyAddress !== companyAddress.toUpperCase() ? companyAddress : titleCaseAddress(companyAddress)
    const sp = splitAddress(addrNorm)
    const addrText = `Adresse : ${sp.street}`
    let addrFs = 10
    pdf.setFontSize(addrFs)
    if (pdf.getTextWidth(addrText) > emMaxW) { addrFs = 9; pdf.setFontSize(addrFs) }
    if (pdf.getTextWidth(addrText) > emMaxW) { addrFs = 8; pdf.setFontSize(addrFs) }
    pdf.text(addrText, emTx, ey2); ey2 += ptToMm(14)
    pdf.setFontSize(10)
    if (sp.city) {
      pdf.text(`Ville : ${sp.city}`, emTx, ey2); ey2 += ptToMm(14)
    }
  }
  // Helper : rendu d'une ligne d'identité avec ramping fontSize 10→9→8 si débordement
  // (évite que SIRET/RCS/TVA/APE/Email longs débordent à droite hors de l'encadré).
  const drawEmitterLine = (text: string) => {
    let fs = 10
    pdf.setFontSize(fs)
    if (pdf.getTextWidth(text) > emMaxW) { fs = 9; pdf.setFontSize(fs) }
    if (pdf.getTextWidth(text) > emMaxW) { fs = 8; pdf.setFontSize(fs) }
    if (pdf.getTextWidth(text) > emMaxW) { fs = 7; pdf.setFontSize(fs) }
    pdf.text(text, emTx, ey2); ey2 += ptToMm(14)
    pdf.setFontSize(10)
  }
  if (companyPhone) { drawEmitterLine(`${locale === 'pt' ? 'Tel' : 'Tél'} : ${companyPhone}`) }
  if (companyEmail) { drawEmitterLine(`E-mail : ${companyEmail}`) }
  if (companySiret) { drawEmitterLine(`SIRET : ${companySiret}`) }
  if (companyRCS) {
    let rmRaw = companyRCS.trim()
    if (!rmRaw.startsWith('RM ')) rmRaw = `RM ${rmRaw}`
    const rmDisplay = rmRaw.includes(' : ') ? rmRaw : rmRaw.replace(/^(RM\s+[A-Za-zÀ-ÿ\s-]+?)\s+(\d+)$/, '$1 : $2')
    drawEmitterLine(rmDisplay)
  }
  if (tvaEnabled && tvaNumber) { drawEmitterLine(`TVA Intra. : ${tvaNumber}`) }
  if (companyAPE) { drawEmitterLine(`APE / NAF : ${companyAPE}`) }
  if (companyCapital) { drawEmitterLine(`Capital : ${companyCapital} EUR`) }

  // Destinataire
  let dy3 = boxStartY + boxPadTop
  pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR_TEXT_LIGHT)
  pdf.text(locale === 'pt' ? 'DESTINATÁRIO' : 'DESTINATAIRE', destTx, dy3)
  dy3 += ptToMm(18)
  pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR_TEXT)
  pdf.text(clientName || '---', destTx, dy3)
  dy3 += ptToMm(14) + 1.5  // léger espace après le nom
  pdf.setFontSize(10); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR_TEXT)
  // Ordre : Adresse → Ville → Intervention → Bât/Étage → … → Tél → Email → SIRET
  if (clientAddress) {
    const sp = splitAddress(clientAddress)
    const cAL = pdf.splitTextToSize(`Adresse : ${sp.street}`, destMaxW)
    pdf.text(cAL, destTx, dy3); dy3 += cAL.length * ptToMm(14)
    if (sp.city) {
      pdf.text(`Ville : ${sp.city}`, destTx, dy3); dy3 += ptToMm(14)
    }
  }
  if (interventionAddress || interventionBatiment || interventionEtage) {
    const interventionLabel = locale === 'pt' ? 'Local' : 'Intervention'
    if (interventionAddress) {
      const sp = splitAddress(interventionAddress)
      const iAL = pdf.splitTextToSize(`${interventionLabel} : ${sp.street}`, destMaxW)
      pdf.text(iAL, destTx, dy3); dy3 += iAL.length * ptToMm(14)
      if (sp.city) {
        pdf.text(`Ville : ${sp.city}`, destTx, dy3); dy3 += ptToMm(14)
      }
    }
    const batEtParts: string[] = []
    if (interventionBatiment) batEtParts.push(`Bât. ${interventionBatiment}`)
    if (interventionEtage) batEtParts.push(`Étage ${interventionEtage}`)
    if (batEtParts.length > 0) {
      pdf.text(batEtParts.join(' — '), destTx, dy3); dy3 += ptToMm(14)
    }
    if (interventionEspacesCommuns) {
      pdf.text(`Lieu : Espaces communs, ${interventionEspacesCommuns}`, destTx, dy3); dy3 += ptToMm(14)
    }
    if (interventionExterieur) {
      pdf.text(`Lieu : Extérieur, ${interventionExterieur}`, destTx, dy3); dy3 += ptToMm(14)
    }
  }
  if (clientPhone) { pdf.text(`${locale === 'pt' ? 'Tel' : 'Tél'} : ${clientPhone}`, destTx, dy3); dy3 += ptToMm(14) }
  if (clientEmail) { pdf.text(`E-mail : ${clientEmail}`, destTx, dy3); dy3 += ptToMm(14) }
  if (clientSiret) { pdf.text(`SIRET : ${clientSiret}`, destTx, dy3); dy3 += ptToMm(14) }

  y = boxStartY + boxH + 4

  // ═══ 5. TABLEAU DES DATES ═══
  const dateBoxH = ptToMm(49)  // ~17.3mm
  const dateSepY = y + ptToMm(20)

  pdf.setFillColor(COLOR_BG_GRAY); pdf.setDrawColor(COLOR_BORDER); pdf.setLineWidth(0.18)
  pdf.rect(mL, y, contentW, dateBoxH, 'FD')

  const dateCols = docType === 'devis'
    ? [
        { label: locale === 'pt' ? 'DATA DE EMISSÃO' : 'DATE D\'ÉMISSION', value: docDate ? new Date(docDate).toLocaleDateString(dateLocaleStr) : '---' },
        { label: locale === 'pt' ? 'VALIDADE' : 'VALIDITÉ', value: docValidity ? `${docValidity} ${locale === 'pt' ? 'dias' : 'jours'}` : '---' },
        { label: locale === 'pt' ? 'PRAZO DE EXECUÇÃO' : 'DÉLAI D\'EXÉCUTION', value: executionDelay || '---' },
        // Date de prestation : "À convenir" si vide (cohérent avec executionDelay)
        { label: locale === 'pt' ? 'DATA PRESTAÇÃO' : 'DATE PRESTATION', value: prestationDate ? new Date(prestationDate).toLocaleDateString(dateLocaleStr) : (locale === 'pt' ? 'A combinar' : 'À convenir') },
      ]
    : [
        { label: locale === 'pt' ? 'DATA DE EMISSÃO' : 'DATE D\'ÉMISSION', value: docDate ? new Date(docDate).toLocaleDateString(dateLocaleStr) : '---' },
        { label: locale === 'pt' ? 'DATA PRESTAÇÃO' : 'DATE PRESTATION', value: prestationDate ? new Date(prestationDate).toLocaleDateString(dateLocaleStr) : (locale === 'pt' ? 'A combinar' : 'À convenir') },
        { label: locale === 'pt' ? 'VENCIMENTO' : 'ÉCHÉANCE', value: paymentDue ? new Date(paymentDue).toLocaleDateString(dateLocaleStr) : '---' },
        { label: locale === 'pt' ? 'MODO PAGAMENTO' : 'MODE RÈGLEMENT', value: paymentMode || '---' },
      ]

  const colW = contentW / dateCols.length
  drawHLine(mL, dateSepY, xRight, COLOR_BORDER, 0.18)
  for (let i = 1; i < dateCols.length; i++) {
    drawVLine(mL + colW * i, y, y + dateBoxH, COLOR_BORDER, 0.18)
  }

  dateCols.forEach((c, i) => {
    const cx = mL + colW * i + colW / 2
    pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR_TEXT_LIGHT)
    pdf.text(c.label, cx, y + ptToMm(14), { align: 'center' })
  })
  dateCols.forEach((c, i) => {
    const cx = mL + colW * i + colW / 2
    pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR_TEXT)
    pdf.text(c.value, cx, dateSepY + ptToMm(17), { align: 'center' })
  })

  y += dateBoxH + 4

  // ═══ 6. TABLEAU PRESTATIONS (autoTable) ═══
  const priceLabel = tvaEnabled ? t('devis.ht') : t('devis.ttc')
  const tableHead = tvaEnabled
    ? [[t('devis.designation'), t('devis.qty'), t('devis.unit'), `${t('devis.unitPrice')} ${priceLabel}`, `${localeFormats.taxLabel} %`, `${t('devis.total')} ${priceLabel}`]]
    : [[t('devis.designation'), t('devis.qty'), t('devis.unit'), `${t('devis.unitPrice')} ${priceLabel}`, `${t('devis.total')} ${priceLabel}`]]

  // ═══ Méthode 100% pro 2026 : étapes en sub-rows distincts ═══
  // Pattern Codial / Mediabat / Onaya (BTP français premium) : au lieu d'agréger
  // motif + détail + N étapes dans UNE seule cellule autoTable (qui devient atomique
  // et bloque la pagination), chaque élément devient sa propre row autoTable :
  //
  //   parent  : motif + qté + unité + prix + TVA + total
  //   desc    : description complémentaire (lineDetail) — colonnes prix vides
  //   etape   : "N. {étape}" indentée — colonnes prix vides
  //
  // Bénéfice : autoTable peut paginer entre n'importe quelle sub-row → plus de gros
  // vide en bas de page. rowPageBreak:'avoid' continue à protéger chaque sub-row
  // individuelle (étape jamais coupée au milieu de son texte).
  type RowKind = 'parent' | 'desc' | 'etape'
  const colCount = tvaEnabled ? 6 : 5
  const emptyCols = (text: string): string[] => {
    const r = Array(colCount).fill('')
    r[0] = text
    return r
  }

  const buildTableBody = (srcLines: ProductLine[]): { rows: any[][]; rowKinds: RowKind[] } => {
    const rows: any[][] = []
    const rowKinds: RowKind[] = []

    for (const l of srcLines.filter(l => l.description.trim())) {
      const unitStr = formatUnitForPdf(l.unit, l.customUnit)
      const cleanDesc = sanitizeForHelvetica(l.description.replace(/\s*\[[^\]]*\]/g, '').trim())
      const parts = cleanDesc.split('\n')
      const title = parts[0]
      let detail = parts.slice(1).join('\n').trim()

      // Strip étapes du detail si elles sont dupliquées (legacy : description peut
      // contenir les étapes jointes par ' → ').
      if (l.etapes && l.etapes.length > 0) {
        const sortedEtapes = [...l.etapes].sort((a, b) => a.ordre - b.ordre).filter(e => e.designation.trim())
        if (sortedEtapes.length > 0) {
          const arrowJoined = sortedEtapes.map(e => e.designation.trim()).join(' → ')
          if (detail === arrowJoined) detail = ''
          else if (detail.includes(arrowJoined)) detail = detail.replace(arrowJoined, '').trim()
        }
      }

      // 1. Row parent (motif + colonnes prix complètes)
      const parentRow: any[] = [title, String(l.qty), unitStr, localeFormats.currencyFormat(l.priceHT)]
      if (tvaEnabled) parentRow.push(`${l.tvaRate}%`)
      parentRow.push(localeFormats.currencyFormat(l.totalHT))
      rows.push(parentRow)
      rowKinds.push('parent')

      // 2. Row détail (continuation du motif si multi-ligne dans description)
      if (detail) {
        rows.push(emptyCols(detail))
        rowKinds.push('desc')
      }

      // 3. Row description complémentaire (lineDetail)
      const lineDetail = sanitizeForHelvetica((l.lineDetail || '').trim())
      if (lineDetail) {
        rows.push(emptyCols(lineDetail))
        rowKinds.push('desc')
      }

      // 4. Rows étapes (1 row par étape, numérotées)
      if (l.etapes && l.etapes.length > 0) {
        const sortedEtapes = [...l.etapes].sort((a, b) => a.ordre - b.ordre).filter(e => e.designation.trim())
        sortedEtapes.forEach((e, i) => {
          const unitSuffix = e.unit ? ` / ${formatUnitForPdf(e.unit)}` : ''
          const priceSuffix = e.prixHT != null && e.prixHT > 0
            ? ` — ${localeFormats.currencyFormat(e.prixHT)}${unitSuffix}`
            : ''
          const etapeText = `${i + 1}. ${sanitizeForHelvetica(e.designation)}${priceSuffix}`
          rows.push(emptyCols(etapeText))
          rowKinds.push('etape')
        })
      }
    }

    if (rows.length === 0) {
      rows.push(emptyCols(t('devis.noLinesMessage')))
      rowKinds.push('parent')
    }
    return { rows, rowKinds }
  }

  // Mesure la hauteur de la 1re row (parent) pour décider du saut de page avant
  // un nouveau label de section. Avec le refactor sub-rows, la parent row est
  // beaucoup plus petite (juste le motif sur 1-2 lignes) → moins d'espace requis →
  // plus de chance de remplir la fin de page courante avec au moins le début de la
  // nouvelle section.
  const descColW = contentW * 0.35 - 6 // largeur utile colonne Désignation
  const measureRowHeight = (l: ProductLine): number => {
    const cleanDesc = sanitizeForHelvetica(l.description.replace(/\s*\[[^\]]*\]/g, '').trim())
    const title = cleanDesc.split('\n')[0]
    pdf.setFontSize(10)
    const dims = pdf.getTextDimensions(title, { maxWidth: descColW })
    const minBody = ptToMm(22) // minCellHeight body
    return Math.max(minBody, dims.h + 5)
  }

  const colStyles: Record<number, { cellWidth: number; halign: string }> = {
    0: { cellWidth: contentW * 0.35, halign: 'left' },
    1: { cellWidth: contentW * 0.07, halign: 'center' },
    2: { cellWidth: contentW * 0.08, halign: 'center' },
    3: { cellWidth: contentW * 0.19, halign: 'center' },
  }
  if (tvaEnabled) {
    colStyles[4] = { cellWidth: contentW * 0.10, halign: 'center' }
    colStyles[5] = { cellWidth: contentW * 0.21, halign: 'right' }
  } else {
    colStyles[4] = { cellWidth: contentW * 0.31, halign: 'right' }
  }

  const headColStyles: Record<number, { halign: string }> = {
    0: { halign: 'left' },
    1: { halign: 'center' },
    2: { halign: 'center' },
    3: { halign: 'center' },
  }
  if (tvaEnabled) {
    headColStyles[4] = { halign: 'center' }
    headColStyles[5] = { halign: 'right' }
  } else {
    headColStyles[4] = { halign: 'right' }
  }

  const renderTable = (
    body: any[][],
    startY: number,
    sectionName?: string,
    rowKinds?: RowKind[],
  ) => {
    // Track la page de départ pour détecter les pages débordées (overflow).
    // Sur ces pages, autoTable redessine le head (showHead: 'everyPage') et nous
    // ajoutons le titre de section "(suite)" via didDrawPage pour éviter qu'une
    // ligne body apparaisse orpheline (sans titre ni head) en haut de page.
    const startPageNum = (pdf as any).internal.getNumberOfPages()
    const suiteSuffix = locale === 'pt' ? ' (continuação)' : ' (suite)'
    autoTable(pdf, {
      head: tableHead,
      body,
      startY,
      // top: 22mm réservés sur les pages overflow pour le titre "(suite)" + petit
      // espace. N'affecte PAS la 1re page de la table (où startY est utilisé).
      margin: { left: mL, right: mR, top: 22 },
      // 'everyPage' au lieu de 'firstPage' : si la table déborde sur une page
      // suivante, le head est répété (Désignation / Qté / Unité / Prix / TVA /
      // Total). Évite l'orphelin ligne body sans contexte de colonnes.
      showHead: 'everyPage',
      theme: 'plain',
      rowPageBreak: 'avoid',
      headStyles: {
        fillColor: [13, 13, 13],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
        halign: 'left',
        // Réduit de 29pt → 16pt pour densifier le tableau sans creuser de blanc
        // entre le head et la 1re ligne. Suffit pour fontSize 8 + paddings 3+3.
        minCellHeight: ptToMm(16),
      },
      bodyStyles: {
        fontSize: 10,
        cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
        textColor: [13, 13, 13],
        lineWidth: 0,
        // Réduit de 32pt → 22pt : minimum pour 1 ligne fontSize 10 + paddings.
        // Plus dense visuellement, gagne ~3mm par ligne single-line.
        minCellHeight: ptToMm(22),
        // Fond gris uniforme pour toutes les lignes (pas d'alternance blanc/gris
        // qui rendait incohérentes les sections multi-lignes comme CUISINE).
        fillColor: [245, 245, 243],
      },
      columnStyles: colStyles as any,
      tableLineColor: [224, 224, 220],
      tableLineWidth: 0,
      didDrawPage: () => {
        // Si on est sur une page créée par autoTable (overflow), redrawer le
        // titre de section "(suite)" pour éviter l'orphelin visuel.
        const currentPage = (pdf as any).internal.getNumberOfPages()
        if (sectionName && currentPage > startPageNum) {
          pdf.setFontSize(9); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR_TEXT)
          pdf.text(`${sectionName}${suiteSuffix}`, mL, 18)
        }
      },
      didParseCell: (data: any) => {
        if (data.section === 'head' && headColStyles[data.column.index]) {
          data.cell.styles.halign = headColStyles[data.column.index].halign
        }
        if (data.section === 'body') {
          const lastCol = tvaEnabled ? 5 : 4
          const kind: RowKind | undefined = rowKinds?.[data.row.index]
          // Style des sub-rows (description et étapes) : police plus petite,
          // padding compact, indentation à gauche pour bien distinguer la
          // hiérarchie visuelle parent / enfant.
          if (kind === 'desc') {
            data.cell.styles.fontSize = 9
            data.cell.styles.fontStyle = 'italic'
            data.cell.styles.textColor = [85, 85, 85]
            data.cell.styles.minCellHeight = 0
            data.cell.styles.cellPadding = { top: 1, bottom: 1, left: data.column.index === 0 ? 8 : 3, right: 3 }
          } else if (kind === 'etape') {
            data.cell.styles.fontSize = 9
            data.cell.styles.textColor = [40, 40, 40]
            data.cell.styles.minCellHeight = 0
            data.cell.styles.cellPadding = { top: 1, bottom: 1, left: data.column.index === 0 ? 8 : 3, right: 3 }
          } else if (kind === 'parent' || !kind) {
            // Total HT en gras (dernière colonne) — uniquement sur les rows parent
            if (data.column.index === lastCol) {
              data.cell.styles.fontStyle = 'bold'
            }
          }
        }
      },
    })
  }

  const drawSectionLabel = (label: string) => {
    // Léger espace au-dessus du label pour respirer après la section précédente
    y += ptToMm(2)
    pdf.setFontSize(9); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR_TEXT)
    pdf.text(label, mL, y + ptToMm(10))
    // Espace entre le label et le head du tableau (1.5 mm de plus qu'avant)
    y += ptToMm(17)
  }

  // Dynamic-section mode : noms personnalisés (linesName/materialLinesName/fraisLinesName), masquage doux
  // (materialLinesEnabled/fraisLinesEnabled) et tables custom additionnelles (customTables).
  const defaultLaborLabel = locale === 'pt' ? 'Mão de obra' : "Main d'œuvre"
  const defaultMaterialLabel = locale === 'pt' ? 'Materiais' : 'Matériaux'
  const defaultFraisLabel = locale === 'pt' ? 'Despesas acessórias' : 'Frais annexes'

  type RenderedSection = { name: string; rows: ProductLine[] }
  const sections: RenderedSection[] = []

  if (laborLines && laborLines.some(l => l.description.trim())) {
    sections.push({ name: linesName || defaultLaborLabel, rows: laborLines })
  }
  if (materialLinesEnabled !== false && materialLines && materialLines.some(l => l.description.trim())) {
    sections.push({ name: materialLinesName || defaultMaterialLabel, rows: materialLines })
  }
  if (fraisLinesEnabled !== false && fraisLines && fraisLines.some(l => l.description.trim())) {
    sections.push({ name: fraisLinesName || defaultFraisLabel, rows: fraisLines })
  }
  if (customTables && customTables.length > 0) {
    for (const ct of customTables) {
      if (ct.lines && ct.lines.some(l => l.description.trim())) {
        sections.push({ name: ct.name || 'Section', rows: ct.lines })
      }
    }
  }

  if (sections.length > 1) {
    // Méthode pro : mesure RÉELLE de la 1re ligne via pdf.getTextDimensions
    // (au lieu d'estimer avec une formule chars/mm imprécise). Garantit que le
    // saut de page se déclenche au mm près — pas d'orphelin ET pas de gros vide.
    // Couple "label + head + 1re ligne" = équivalent du "Keep with next" Word.
    const labelH = 6
    const headH = 12
    for (const s of sections) {
      const firstRowH = s.rows.length > 0 ? measureRowHeight(s.rows[0]) : ptToMm(22)
      const minNeeded = labelH + headH + firstRowH + 2 // +2mm marge sécurité
      checkPageBreak(minNeeded)
      drawSectionLabel(s.name)
      // Passe le sectionName pour que renderTable puisse redessiner le titre
      // "(suite)" sur les pages débordées via didDrawPage.
      const built = buildTableBody(s.rows)
      renderTable(built.rows, y, s.name, built.rowKinds)
      y = (pdf as any).lastAutoTable.finalY + ptToMm(10)
    }
  } else if (sections.length === 1) {
    // Une seule section : rendu sans label de section (comportement historique)
    const built = buildTableBody(sections[0].rows)
    renderTable(built.rows, y, undefined, built.rowKinds)
  } else {
    // Aucune des sections enrichies n'a de contenu → fallback sur le tableau "lines" classique
    const built = buildTableBody(lines)
    renderTable(built.rows, y, undefined, built.rowKinds)
  }

  y = (pdf as any).lastAutoTable.finalY

  // ═══ 7. SOUS-TOTAL + TVA ═══
  const stH = ptToMm(27)
  pdf.setFillColor(COLOR_BG_GRAY); pdf.setDrawColor(COLOR_BORDER); pdf.setLineWidth(0.18)
  pdf.rect(mL, y, contentW, stH, 'FD')

  if (!tvaEnabled) {
    pdf.setFontSize(7.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR_TEXT_LIGHT)
    pdf.text(locale === 'pt' ? 'IVA não aplicável, art. 53.º CIVA' : 'TVA non applicable, art. 293 B CGI', mL + boxPadX, y + stH / 2 + 1)
  }

  pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR_TEXT)
  const stLabel = tvaEnabled ? (locale === 'pt' ? 'Subtotal HT' : 'Sous-total HT') : (locale === 'pt' ? 'Subtotal' : 'Sous-total')
  pdf.text(stLabel, xRight - 60, y + stH / 2 + 1)
  pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR_TEXT)
  pdf.text(localeFormats.currencyFormat(subtotalHT), xRight - boxPadX, y + stH / 2 + 1, { align: 'right' })

  y += stH

  // Détail TVA par taux — itère sur les lignes RÉELLEMENT rendues (sections),
  // sans dédoubler avec `lines` qui est l'union envoyée par les nouveaux callers.
  if (tvaEnabled) {
    const tvaByRate: Record<number, { base: number; amount: number }> = {}
    const allTvaLines: ProductLine[] = sections.length > 0
      ? sections.flatMap(s => s.rows)
      : lines
    allTvaLines.filter(l => l.description.trim()).forEach(l => {
      if (!tvaByRate[l.tvaRate]) tvaByRate[l.tvaRate] = { base: 0, amount: 0 }
      tvaByRate[l.tvaRate].base += l.totalHT
      tvaByRate[l.tvaRate].amount += l.totalHT * l.tvaRate / 100
    })
    Object.entries(tvaByRate).forEach(([rate, { base, amount }]) => {
      if (Number(rate) === 0) return
      pdf.setFillColor(COLOR_WHITE)
      pdf.rect(mL + contentW / 2, y, contentW / 2, 6, 'F')
      pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR_TEXT_LIGHT)
      pdf.text(`TVA ${rate}% sur ${localeFormats.currencyFormat(base)}`, xRight - 60, y + 4)
      pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR_TEXT)
      pdf.text(localeFormats.currencyFormat(amount), xRight - boxPadX, y + 4, { align: 'right' })
      y += 6
    })
  }

  // Remise
  if (discount) {
    pdf.setFillColor(COLOR_WHITE)
    pdf.rect(mL + contentW / 2, y, contentW / 2, 6, 'F')
    pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR_TEXT)
    pdf.text(locale === 'pt' ? 'Desconto' : 'Remise', xRight - 60, y + 4)
    pdf.setFont('helvetica', 'bold')
    pdf.text(`-${discount}`, xRight - boxPadX, y + 4, { align: 'right' })
    y += 6
  }

  // ═══ 8. BLOC TOTAL NET ═══
  y += 4

  const totalVal = tvaEnabled ? totalTTC : subtotalHT
  const totBoxX = boxX_dest
  const totBoxW = destBoxW
  const totH = ptToMm(27)

  pdf.setFillColor(COLOR_BG_GRAY)
  pdf.rect(totBoxX, y, totBoxW, totH, 'F')
  pdf.setFontSize(12); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR_TEXT)
  const totalLabel = tvaEnabled ? (locale === 'pt' ? 'TOTAL TTC' : 'TOTAL TTC') : (locale === 'pt' ? 'TOTAL' : 'TOTAL NET')
  pdf.text(totalLabel, totBoxX + boxPadX, y + totH / 2 + 1.5)
  pdf.text(localeFormats.currencyFormat(totalVal), totBoxX + totBoxW - boxPadX, y + totH / 2 + 1.5, { align: 'right' })

  y += totH + 6

  // ═══ 9. CONDITIONS + BON POUR ACCORD + ACOMPTES (devis) ou RÈGLEMENT (facture) ═══
  checkPageBreak(55)

  if (docType === 'devis') {
    const condX = mL
    const condW = emBoxW
    const sigX = boxX_dest
    const sigW = destBoxW
    const condStartY = y

    // ── CONDITIONS (côté gauche) ──
    pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR_TEXT)
    pdf.text('CONDITIONS', condX, condStartY + 5)
    let cy = condStartY + 12

    pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR_TEXT)
    const validityStr = docValidity ? `${docValidity} ${locale === 'pt' ? 'dias' : 'jours'}` : `30 ${locale === 'pt' ? 'dias' : 'jours'}`
    const condTextLines = [
      t('devis.pdf.validityCondition').replace('{validity}', validityStr),
      ...(executionDelay ? [t('devis.pdf.executionDelayCondition').replace('{delay}', executionDelay)] : []),
      t('devis.pdf.amendmentClause'),
      ...(paymentMode ? [t('devis.pdf.paymentModeCondition').replace('{mode}', paymentMode)] : []),
      ...(iban ? [`IBAN : ${iban}${bic ? ` | BIC : ${bic}` : ''}`] : []),
      ...(paymentCondition ? [paymentCondition] : []),
      ...(penaltyRate ? [`Pénalités de retard : ${penaltyRate}`] : []),
      ...(recoveryFee && clientType !== 'particulier' ? [`Indemnité forfaitaire de recouvrement : ${recoveryFee}`] : []),
    ]
    condTextLines.forEach(line => {
      const wrapped = pdf.splitTextToSize(line, condW - 4)
      pdf.text(wrapped, condX, cy)
      cy += wrapped.length * ptToMm(13)
    })
    if (notes) {
      cy += 2
      pdf.setFont('helvetica', 'italic')
      const noteWrapped = pdf.splitTextToSize(notes, condW - 4)
      pdf.text(noteWrapped, condX, cy)
      cy += noteWrapped.length * ptToMm(13)
    }

    // ── BON POUR ACCORD (côté droit) ──
    const sigContentH = Math.max(cy - condStartY, 46)
    pdf.setFillColor(COLOR_BG_GRAY); pdf.setDrawColor(COLOR_BORDER); pdf.setLineWidth(0.18)
    pdf.rect(sigX, condStartY, sigW, sigContentH, 'FD')

    pdf.setFontSize(9.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR_TEXT)
    pdf.text('BON POUR ACCORD', sigX + boxPadX, condStartY + 5)

    let sy = condStartY + 12
    pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR_TEXT)
    const approvalText = locale === 'pt'
      ? 'Orçamento recebido antes da execução dos trabalhos, lido e aprovado, bom para acordo.'
      : 'Devis reçu avant exécution des travaux, lu et approuvé, bon pour accord.'
    const appWrapped = pdf.splitTextToSize(approvalText, sigW - boxPadX * 2)
    pdf.text(appWrapped, sigX + boxPadX, sy)
    sy += appWrapped.length * ptToMm(13) + 4

    if (signatureData) {
      try {
        const sigImgDataUrl = await svgToImageDataUrl(signatureData.svg_data, 400, 140)
        const sigImgW = sigW - boxPadX * 2 - 10
        const sigImgH = sigImgW * (140 / 400)
        pdf.addImage(sigImgDataUrl, 'PNG', sigX + boxPadX, sy, sigImgW, sigImgH)
        sy += sigImgH + 2
        pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR_TEXT)
        pdf.text(signatureData.signataire, sigX + boxPadX, sy)
        pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR_TEXT_LIGHT)
        pdf.text(new Date(signatureData.timestamp).toLocaleString(dateLocaleStr), sigX + boxPadX, sy + 3)
        sy += 8
        pdf.setFontSize(4.5); pdf.setTextColor('#9CA3AF')
        pdf.text(`SHA-256: ${signatureData.hash_sha256.substring(0, 32)}...`, sigX + boxPadX, sy)
        pdf.text(locale === 'pt' ? 'Assinatura eletrónica simples art. 25.1 eIDAS' : 'Signature électronique simple art. 25.1 eIDAS', sigX + boxPadX, sy + 2.5)
      } catch {
        pdf.setFontSize(9); pdf.setTextColor(COLOR_TEXT)
        pdf.text(signatureData.signataire, sigX + boxPadX, sy)
      }
    } else {
      pdf.text(`Date : ___ / ___ / ______`, sigX + boxPadX, sy)
      sy += ptToMm(18)
      pdf.text(`Signature :`, sigX + boxPadX, sy)
    }

    y = condStartY + sigContentH + 4

    // ═══ ACOMPTES ═══
    if (acomptesEnabled && acomptes.length > 0) {
      const acompteTotal = tvaEnabled ? totalTTC : subtotalHT
      const validAcomptes = acomptes.filter(ac => ac.pourcentage > 0)
      if (validAcomptes.length > 0) {
        const acBlockH = 12 + validAcomptes.length * ptToMm(13) + 4
        checkPageBreak(acBlockH + 4)
        pdf.setFillColor(COLOR_BG_GRAY); pdf.setDrawColor(COLOR_BORDER); pdf.setLineWidth(0.18)
        pdf.rect(sigX, y, sigW, acBlockH, 'FD')
        pdf.setFontSize(9); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR_TEXT)
        pdf.text(locale === 'pt' ? 'PAGAMENTO FASEADO' : 'ÉCHÉANCIER DE PAIEMENT', sigX + boxPadX, y + 5)
        let ay = y + 12
        pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR_TEXT)
        for (const ac of validAcomptes) {
          const montant = acompteTotal * ac.pourcentage / 100
          const label = ac.label || `${locale === 'pt' ? 'Adiantamento' : 'Acompte'} ${ac.ordre}`
          pdf.text(`${label} : ${ac.pourcentage}% ${ac.declencheur}`, sigX + boxPadX, ay)
          pdf.setFont('helvetica', 'bold')
          pdf.text(localeFormats.currencyFormat(montant), sigX + sigW - boxPadX, ay, { align: 'right' })
          pdf.setFont('helvetica', 'normal')
          ay += ptToMm(13)
        }
        y += acBlockH + 4
      }
    }

  } else if (docType === 'facture') {
    // ── Section RÈGLEMENT pour facture ──
    const payLines: string[] = []
    if (paymentCondition) payLines.push(paymentCondition)
    if (paymentMode) payLines.push(t('devis.pdf.paymentModeLabel').replace('{mode}', paymentMode))
    if (paymentDue) payLines.push(t('devis.pdf.paymentDueLabel').replace('{date}', new Date(paymentDue).toLocaleDateString(dateLocaleStr)))
    if (iban) payLines.push(bic ? t('devis.pdf.ibanBicLabel').replace('{iban}', iban).replace('{bic}', bic) : t('devis.pdf.ibanLabel').replace('{iban}', iban))
    payLines.push(t('devis.pdf.latePenalties'))
    if (discount) payLines.push(t('devis.pdf.earlyDiscountYes').replace('{discount}', discount))
    else payLines.push(t('devis.pdf.earlyDiscountNo'))
    if (sourceDevisRef) {
      const datePart = prestationDate ? ` ${locale === 'pt' ? 'com data de' : 'en date du'} ${new Date(prestationDate).toLocaleDateString(dateLocaleStr)}` : ''
      payLines.push(t('devis.pdf.invoiceFromDevis').replace('{ref}', sourceDevisRef).replace('{date}', datePart))
    } else if (notes && (notes.includes('Réf. devis') || notes.includes('Ref. orçamento'))) {
      const devisRef = notes.match(/(?:Réf\. devis|Ref\. orçamento)\s*:\s*([^\n]+)/)?.[1]?.trim()
      if (devisRef) payLines.push(t('devis.pdf.invoiceFromDevis').replace('{ref}', devisRef).replace('{date}', ''))
    }
    payLines.push(t('devis.pdf.contestationClause'))

    const condStartY = y
    let measureY = condStartY + 10
    pdf.setFontSize(9); pdf.setFont('helvetica', 'normal')
    payLines.forEach(line => {
      const wrapped = pdf.splitTextToSize(line, contentW - 8)
      measureY += wrapped.length * ptToMm(13) + 0.5
    })
    const condH = Math.max(measureY - condStartY + 2, 20)

    pdf.setFillColor(COLOR_BG_GRAY); pdf.setDrawColor(COLOR_BORDER); pdf.setLineWidth(0.18)
    pdf.rect(mL, condStartY, contentW, condH, 'FD')

    pdf.setFontSize(9.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR_TEXT)
    pdf.text(locale === 'pt' ? 'CONDIÇÕES DE PAGAMENTO' : 'CONDITIONS DE RÈGLEMENT', mL + boxPadX, condStartY + 5)

    let cy = condStartY + 12
    pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR_TEXT)
    payLines.forEach(line => {
      const wrapped = pdf.splitTextToSize(line, contentW - boxPadX * 2)
      pdf.text(wrapped, mL + boxPadX, cy)
      cy += wrapped.length * ptToMm(13) + 0.5
    })
    y = condStartY + condH + 4
  }

  // ═══ 10. RAPPORT JOINT (optionnel) ═══
  if (attachedRapport && !checkPageBreak(20)) {
    pdf.setFillColor(COLOR_BG_GRAY); pdf.setDrawColor(COLOR_BORDER); pdf.setLineWidth(0.18)
    const rapportTextLines: string[] = []
    rapportTextLines.push(t('devis.pdf.attachedReport').replace('{number}', attachedRapport.rapportNumber))
    if (attachedRapport.interventionDate) rapportTextLines.push(t('devis.pdf.reportDate').replace('{date}', new Date(attachedRapport.interventionDate).toLocaleDateString(dateLocaleStr)) + (attachedRapport.startTime ? ` ${locale === 'pt' ? 'das' : 'de'} ${attachedRapport.startTime}` : '') + (attachedRapport.endTime ? ` ${locale === 'pt' ? 'às' : 'à'} ${attachedRapport.endTime}` : ''))
    if (attachedRapport.motif) rapportTextLines.push(t('devis.pdf.reportMotif').replace('{motif}', attachedRapport.motif))
    if (attachedRapport.siteAddress) rapportTextLines.push(t('devis.pdf.reportLocation').replace('{location}', attachedRapport.siteAddress))
    const rapH = rapportTextLines.length * 4 + 4
    pdf.rect(mL, y, contentW, rapH, 'FD')
    pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR_TEXT)
    pdf.text(rapportTextLines[0], mL + boxPadX, y + 4)
    pdf.setFont('helvetica', 'normal')
    rapportTextLines.slice(1).forEach((rl, i) => pdf.text(rl, mL + boxPadX, y + 4 + (i + 1) * 3.5))
    y += rapH + 4
  }

  // ═══ 11. PT FISCAL: QR CODE + CERTIFICATION ═══
  if (ptFiscalData) {
    checkPageBreak(35)
    const qrSize = 28
    const qrX = pageW - mR - qrSize
    const qrY = y
    try {
      const QRCode = (await import('qrcode')).default
      const qrDataUrl = await QRCode.toDataURL(ptFiscalData.qrCodeString, { width: 200, margin: 1, errorCorrectionLevel: 'M' })
      pdf.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize)
    } catch {
      pdf.setDrawColor(COLOR_BORDER); pdf.setLineWidth(0.3)
      pdf.rect(qrX, qrY, qrSize, qrSize)
      pdf.setFontSize(5); pdf.setTextColor(COLOR_TEXT_LIGHT)
      pdf.text('QR Code', qrX + qrSize / 2, qrY + qrSize / 2, { align: 'center' })
    }
    const certY = qrY + 2
    pdf.setFontSize(6); pdf.setFont('helvetica', 'bold'); pdf.setTextColor('#1D4ED8')
    pdf.text(ptFiscalData.atcudDisplay, mL, certY)
    pdf.setFontSize(5.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR_TEXT_LIGHT)
    pdf.text(`Hash: ${ptFiscalData.hashDisplay}`, mL, certY + 3.5)
    pdf.text(`Processado por programa certificado n.º ${ptFiscalData.certNumber}`, mL, certY + 7)
    pdf.text('Vitfix Pro — https://vitfix.pt', mL, certY + 10.5)
    y = qrY + qrSize + 4
  }

  // ═══ 12. MENTIONS LÉGALES ═══
  checkPageBreak(10)
  drawHLine(mL, y, xRight, COLOR_BORDER, 0.18)
  y += 3

  pdf.setFontSize(6.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR_TEXT_LIGHT)

  const isParticulier = clientType === 'particulier'
  const isPro = !isParticulier // professionnel, SCI, syndic

  // 1. Identification + statut juridique + forme juridique à côté du nom
  const statusLabel = getStatusLabel(companyStatus, t)
  let legal1 = `${companyName} (${statusLabel}).`
  if (companyStatus === 'ei' && locale !== 'pt') legal1 += ' Loi n° 2022-172 du 14 février 2022.'
  if (companySiret) legal1 += ` SIRET : ${companySiret}.`
  if (companyAPE) legal1 += ` APE : ${companyAPE}.`

  // 2. TVA / IVA
  if (!tvaEnabled) {
    legal1 += locale === 'pt' ? ' IVA não aplicável, artigo 53.º do CIVA.' : ' TVA non applicable, article 293 B du CGI.'
  } else if (tvaNumber) {
    legal1 += locale === 'pt' ? ` NIF intracomunitário : ${tvaNumber}.` : ` TVA intracommunautaire : ${tvaNumber}.`
  }

  // TVA taux réduit (remplace CERFA supprimé fév. 2025, loi de finances 2025, art. 41)
  if (tvaEnabled && locale !== 'pt') {
    const usedRates = new Set(lines.filter(l => l.description.trim()).map(l => l.tvaRate))
    if (usedRates.has(5.5)) {
      legal1 += ' Travaux de rénovation énergétique sur logement > 2 ans, taux réduit 5,5 % (art. 278-0 bis A CGI, loi de finances 2025 art. 41).'
    }
    if (usedRates.has(10)) {
      legal1 += ' Travaux d\'amélioration/entretien sur logement > 2 ans, taux réduit 10 % (art. 279-0 bis CGI, loi de finances 2025 art. 41).'
    }
  }

  // Capital social
  if (companyCapital) legal1 += ` Capital social : ${companyCapital} EUR.`

  // 3. Assurance (art. L. 243-2 C. assurances)
  if (insuranceName) {
    if (locale === 'pt') {
      const insLabel = insuranceType === 'rc_pro' ? 'RC Pro' : insuranceType === 'decennale' ? 'Decenal' : 'RC Pro + Decenal'
      legal1 += ` Seguro ${insLabel} ${insuranceName}, apólice n.º ${insuranceNumber || 'N/A'}, cobertura ${insuranceCoverage || 'Portugal continental'}.`
    } else {
      const insLabel = insuranceType === 'rc_pro' ? 'RC Pro' : insuranceType === 'decennale' ? 'Décennale' : 'RC Pro + Décennale'
      legal1 += ` Assurance ${insLabel} : ${insuranceName}, contrat n° ${insuranceNumber || 'N/A'}, couverture ${insuranceCoverage || 'France métropolitaine'} (art. L. 243-2 C. assurances).`
    }
  }

  // 4. Devis / Orçamento
  let legal2 = ''
  if (docType === 'devis') {
    legal2 = locale === 'pt'
      ? 'Orçamento gratuito, conforme o artigo 8.º da Lei n.º 24/96.'
      : 'Devis gratuit, conformément à l\'arrêté du 24 janvier 2017 relatif à l\'information du consommateur sur les prestations de dépannage, de réparation et d\'entretien dans le secteur du bâtiment.'
  } else {
    // Facture
    const dueDateStr = paymentDue ? new Date(paymentDue).toLocaleDateString(dateLocaleStr) : '---'
    if (locale === 'pt') {
      legal2 = `Condições de pagamento : ${dueDateStr}. Modo : ${paymentMode || '---'}. Penalidades por atraso : taxa de juro legal em vigor (DL 62/2013).`
    } else {
      legal2 = `Conditions de paiement : échéance ${dueDateStr}. Règlement : ${paymentMode || '---'}.`
    }
  }

  // 5. Pénalités de retard et recouvrement (toujours mentionner, conditionné B2B / B2C)
  if (locale !== 'pt') {
    if (isPro) {
      // B2B : art. L. 441-10 C. com. + indemnité forfaitaire 40 € (art. D. 441-5 C. com.)
      legal2 += ` Pénalités de retard : ${penaltyRate || '3 fois le taux d\'intérêt légal en vigueur'} (art. L. 441-10 C. com.). Indemnité forfaitaire de recouvrement : 40 € (art. D. 441-5 C. com.).`
    } else {
      // B2C : pénalités contractuelles, pas d'indemnité forfaitaire obligatoire
      legal2 += ` Pénalités de retard : ${penaltyRate || '3 fois le taux d\'intérêt légal en vigueur'}.`
    }
  }

  // 6. Rétractation (particuliers uniquement, FR, hors établissement)
  // Art. L. 221-18 C. conso. — construction exclue au PT (DL 24/2014, art. 4.º, n.º 1, al. f)
  if (docType === 'devis' && isHorsEtablissement && isParticulier && locale !== 'pt') {
    legal2 += ' Droit de rétractation : 14 jours calendaires (art. L. 221-18 C. conso.). Aucun paiement exigible avant 7 jours (art. L. 221-10 C. conso.), sauf travaux urgents (plafond 200 € TTC).'
  }

  // 7. Garanties BTP (articles précis)
  let legal3 = ''
  if (locale === 'pt') {
    legal3 += 'Garantia de defeitos de construção : 5 anos (art. 1225.º do Código Civil). Garantia de vícios ocultos (art. 913.º do Código Civil).'
  } else {
    legal3 += 'Garanties légales : parfait achèvement 1 an (art. 1792-6 C. civ.), bon fonctionnement 2 ans (art. 1792-3 C. civ.), décennale 10 ans (art. 1792 C. civ.).'
  }

  // 8. Médiation de la consommation (particuliers uniquement, art. L. 612-1 C. conso.)
  // Ne s'affiche que si le médiateur est explicitement renseigné
  if (isParticulier && mediatorName) {
    if (locale === 'pt') {
      legal3 += ` Resolução alternativa de litígios (Lei n.º 144/2015) : ${mediatorName}${mediatorUrl ? `, ${mediatorUrl}` : ''}.`
    } else {
      legal3 += ` Médiation de la consommation (art. L. 612-1 C. conso.) : ${mediatorName}${mediatorUrl ? `, ${mediatorUrl}` : ''}.`
    }
  }

  const legal4 = locale === 'pt'
    ? `Documento gerado por Vitfix Pro em ${new Date().toLocaleDateString(dateLocaleStr)}.`
    : `Document généré par Vitfix Pro le ${new Date().toLocaleDateString(dateLocaleStr)}.`

  const fullLegal = `${legal1} ${legal2} ${legal3} ${legal4}`
  const legalW = ptFiscalData ? contentW - 32 : contentW
  const legalWrapped = pdf.splitTextToSize(fullLegal, legalW)
  const legalHeight = legalWrapped.length * ptToMm(10)
  // Pratique pro : les mentions légales sont collées au PIED de page (juste au
  // dessus du footer "Page X/Y" + ref devis), pas flottantes après l'échéancier.
  // Convention SaaS B2B (Stripe Invoicing, QuickBooks) + lecture client : le bloc
  // légal sert de "fin de document" naturelle. Si pas la place sur la page
  // courante, on crée une page suivante et on positionne tout en bas dessus.
  const legalBottomMargin = 6 // 6mm = au-dessus du footer "Page X/Y" (3.2mm)
  const legalTargetY = pageH - legalBottomMargin - legalHeight
  if (y > legalTargetY - 2) {
    pdf.addPage()
  }
  pdf.text(legalWrapped, mL, pageH - legalBottomMargin - legalHeight)
  y = pageH - legalBottomMargin

  // ═══ PAGE 2 — RÉTRACTATION ═══
  // Page rétractation — FR uniquement, particuliers seulement (art. L. 221-18 C. conso.)
  if (docType === 'devis' && isHorsEtablissement && isParticulier && locale !== 'pt') {
    pdf.addPage()
    let ry = 8

    pdf.setFillColor(COLOR_ACCENT)
    pdf.rect(mL, ry, contentW, ptToMm(3), 'F')
    ry += ptToMm(3) + 8

    pdf.setFontSize(12); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR_TEXT)
    pdf.text('DROIT DE RÉTRACTATION', mL, ry)
    ry += 5
    pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR_TEXT)
    pdf.text('Article L. 221-18 du Code de la consommation', mL, ry)
    ry += 8

    pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR_TEXT)
    const retTexts = [
      t('devis.pdf.withdrawalText1'),
      t('devis.pdf.withdrawalText2'),
      t('devis.pdf.withdrawalPayment'),
    ]
    retTexts.forEach(txt => {
      const wrapped = pdf.splitTextToSize(txt, contentW)
      pdf.text(wrapped, mL, ry)
      ry += wrapped.length * ptToMm(13) + 4
    })

    ry += 4

    pdf.setFillColor(COLOR_TEXT)
    pdf.rect(mL, ry, contentW, 8, 'F')
    pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR_WHITE)
    pdf.text('FORMULAIRE DE RÉTRACTATION', mL + boxPadX, ry + 5.5)
    ry += 12

    pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR_TEXT)
    const formAttention = `À l'attention de : ${companyName}, ${companyAddress}`
    pdf.setFont('helvetica', 'normal')
    const attParts = formAttention.split(companyName)
    pdf.text(attParts[0], mL + boxPadX, ry)
    const atW = pdf.getTextWidth(attParts[0])
    pdf.setFont('helvetica', 'bold')
    pdf.text(`${companyName}${attParts[1] || ''}`, mL + boxPadX + atW, ry)
    ry += 6

    pdf.setFont('helvetica', 'normal')
    const noticeText = 'Je notifie par la présente ma rétractation du contrat portant sur la prestation de services ci-dessus.'
    pdf.text(noticeText, mL + boxPadX, ry)
    ry += 8

    const formFields = [
      'Commandé le / reçu le :',
      'Nom du client :',
      'Adresse :',
      'Date : ___ / ___ / ______',
      'Signature :',
    ]
    formFields.forEach(f => {
      pdf.text(f, mL + boxPadX, ry)
      if (!f.startsWith('Date') && !f.startsWith('Signature')) {
        const fw = pdf.getTextWidth(f) + 2
        drawHLine(mL + boxPadX + fw, ry + 0.5, xRight - boxPadX, COLOR_BORDER, 0.2)
      }
      ry += 8
    })
  }

  // ═══ ANNEXE PHOTOS CHANTIER ═══
  if (selectedPhotos.length > 0) {
    const loadImage = (url: string): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error('Image load failed'))
        img.src = url
      })
    }

    pdf.addPage()
    let py = 18
    pdf.setFillColor(COLOR_ACCENT)
    pdf.rect(mL, py - 4, contentW, ptToMm(3), 'F')
    py += 2
    pdf.setFontSize(9); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR_TEXT)
    pdf.text(`${docType === 'devis' ? t('devis.devisTab') : t('devis.factureTab')} ${docNumber} — ${t('devis.pdf.annexePhotos')}`, pageW / 2, py, { align: 'center' })
    py += 5
    pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR_TEXT_LIGHT)
    pdf.text(t('devis.pdf.photosGeotagged').replace('{count}', String(selectedPhotos.length)), pageW / 2, py, { align: 'center' })
    py += 8

    const photoW = (contentW - 6) / 2
    const photoH = 60
    const photoGap = 4
    let col2 = 0

    for (let i = 0; i < selectedPhotos.length; i++) {
      const photo = selectedPhotos[i]

      if (py + photoH + 12 > pageH - 10 && col2 === 0) {
        pdf.addPage()
        py = 18
        pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR_TEXT_LIGHT)
        pdf.text(`${docType === 'devis' ? t('devis.devisTab') : t('devis.factureTab')} ${docNumber} — ${t('devis.pdf.annexePhotosSuite')}`, pageW / 2, py, { align: 'center' })
        py += 8
      }

      const x = mL + col2 * (photoW + photoGap)

      try {
        const img = await loadImage(photo.url)
        pdf.setDrawColor('#E5E7EB'); pdf.setLineWidth(0.3)
        pdf.roundedRect(x, py, photoW, photoH + 10, 1.5, 1.5, 'S')

        const imgRatio = img.width / img.height
        let drawW = photoW - 4
        let drawH = photoH - 2
        if (imgRatio > drawW / drawH) {
          drawH = drawW / imgRatio
        } else {
          drawW = drawH * imgRatio
        }
        const imgX = x + (photoW - drawW) / 2
        const imgY = py + 1 + (photoH - 2 - drawH) / 2

        const canvas = document.createElement('canvas')
        const maxRes = 2400
        canvas.width = Math.min(img.width, maxRes)
        canvas.height = Math.round(canvas.width / imgRatio)
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'high'
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          const imgData = canvas.toDataURL('image/jpeg', 0.92)
          pdf.addImage(imgData, 'JPEG', imgX, imgY, drawW, drawH)
        }

        const infoY = py + photoH + 1
        pdf.setFontSize(5.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#6B7280')
        const dateStr = photo.taken_at ? new Date(photo.taken_at).toLocaleString(dateLocaleStr) : 'N/D'
        pdf.text(`Date : ${dateStr}`, x + 2, infoY + 2)
        if (photo.lat && photo.lng) {
          pdf.text(`GPS : ${Number(photo.lat).toFixed(5)}, ${Number(photo.lng).toFixed(5)}`, x + 2, infoY + 5.5)
        }
        if (photo.label) {
          pdf.setFont('helvetica', 'bold')
          // UTF-8 safe truncation : Array.from itère par code points (évite couper un emoji en 2)
          const labelClean = sanitizeForHelvetica(photo.label)
          const labelChars = Array.from(labelClean)
          const labelTrunc = labelChars.length > 35 ? labelChars.slice(0, 35).join('') + '...' : labelClean
          pdf.text(labelTrunc, x + photoW / 2, infoY + 2, { align: 'center' })
        }
      } catch {
        pdf.setFillColor('#F3F4F6')
        pdf.roundedRect(x, py, photoW, photoH + 10, 1.5, 1.5, 'FD')
        pdf.setFontSize(7); pdf.setTextColor('#9CA3AF')
        pdf.text(t('devis.pdf.photoNotAvailable'), x + photoW / 2, py + photoH / 2, { align: 'center' })
      }

      col2++
      if (col2 >= 2) {
        col2 = 0
        py += photoH + 12 + photoGap
      }
    }
  }

  // ─── Page numbers + référence devis (pied de page) ───
  // Le n° de devis est répété sur chaque page (à gauche) en complément du
  // "Page X/Y" (à droite). Pratique standard SaaS pro 2026 + utile pour
  // contrôles fiscaux : chaque page reste identifiable même imprimée séparément.
  const totalPgs = (pdf as any).internal.getNumberOfPages()
  const footerDocRef = ptFiscalData?.docNumber || docNumber
  for (let p = 1; p <= totalPgs; p++) {
    pdf.setPage(p)
    pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR_TEXT_LIGHT)
    pdf.text(footerDocRef, mL, pageH - 3.2)
    pdf.text(`Page ${p}/${totalPgs}`, xRight - 2, pageH - 3.2, { align: 'right' })
  }

  // ─── Save / Preview ───
  const safeName = clientName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_À-ÿ]/g, '') || 'Client'
  const fileLabel = docType === 'devis' ? (locale === 'pt' ? 'Orcamento' : 'Devis') : (locale === 'pt' ? 'Fatura' : 'Facture')
  const fileDocNumber = (locale === 'pt' && ptFiscalData?.docNumber)
    ? ptFiscalData.docNumber.replace(/\s+/g, '_').replace(/\//g, '-')
    : docNumber
  const filename = `${fileLabel}_${fileDocNumber}_${safeName}.pdf`

  if (input.action === 'preview') {
    // Use a named blob so the browser's PDF viewer shows the real filename
    // (not a UUID) when the user downloads from preview
    const blob = pdf.output('blob')
    const namedFile = new File([blob], filename, { type: 'application/pdf' })
    const url = URL.createObjectURL(namedFile)
    window.open(url, '_blank')
  } else {
    pdf.save(filename)
  }

  return { filename }
}
