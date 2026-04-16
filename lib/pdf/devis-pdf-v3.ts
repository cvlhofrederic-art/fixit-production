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
    lines, laborLines, materialLines, subtotalHT, totalTTC,
    acomptesEnabled, acomptes,
    notes, sourceDevisRef,
    signatureData, attachedRapport, selectedPhotos,
    ptFiscalData,
    svgToImageDataUrl, fetchFreshLogo,
  } = input

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

  // ═══ 1. LOGO (coin haut-gauche) ═══
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
        pdf.addImage(logoData, 'PNG', 5.3, 2.8, lw, lh)
      }
    } catch {
      // pas de logo = on saute
    }
  }

  // ═══ 2. TITRE DOCUMENT (centré) ═══
  y = 25  // ~71pt du haut
  const displayDocNumber = ptFiscalData?.docNumber || docNumber
  if (docTitle) {
    pdf.setFontSize(16); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR_TEXT)
    pdf.text(docTitle, pageW / 2, y, { align: 'center' })
    y += 7
  } else {
    const genericTitle = docType === 'devis'
      ? (locale === 'pt' ? 'Orçamento' : 'Devis')
      : (locale === 'pt' ? 'Fatura' : 'Facture')
    pdf.setFontSize(16); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR_TEXT)
    pdf.text(genericTitle, pageW / 2, y, { align: 'center' })
    y += 7
  }

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
  if (interventionEspacesCommuns || interventionExterieur) dy2 += ptToMm(14)
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
  if (companyPhone) { pdf.text(`${locale === 'pt' ? 'Tel' : 'Tél'} : ${companyPhone}`, emTx, ey2); ey2 += ptToMm(14) }
  if (companyEmail) { pdf.text(`E-mail : ${companyEmail}`, emTx, ey2); ey2 += ptToMm(14) }
  if (companySiret) { pdf.text(`SIRET : ${companySiret}`, emTx, ey2); ey2 += ptToMm(14) }
  if (companyRCS) {
    let rmRaw = companyRCS.trim()
    if (!rmRaw.startsWith('RM ')) rmRaw = `RM ${rmRaw}`
    const rmDisplay = rmRaw.includes(' : ') ? rmRaw : rmRaw.replace(/^(RM\s+[A-Za-zÀ-ÿ\s-]+?)\s+(\d+)$/, '$1 : $2')
    pdf.text(rmDisplay, emTx, ey2); ey2 += ptToMm(14)
  }
  if (tvaEnabled && tvaNumber) { pdf.text(`TVA Intra. : ${tvaNumber}`, emTx, ey2); ey2 += ptToMm(14) }
  if (companyAPE) { pdf.text(`APE / NAF : ${companyAPE}`, emTx, ey2); ey2 += ptToMm(14) }
  if (companyCapital) { pdf.text(`Capital : ${companyCapital} EUR`, emTx, ey2); ey2 += ptToMm(14) }

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
    const locParts: string[] = []
    if (interventionEspacesCommuns) locParts.push(`Espaces communs : ${interventionEspacesCommuns}`)
    if (interventionExterieur) locParts.push(`Extérieur : ${interventionExterieur}`)
    if (locParts.length > 0) {
      pdf.text(locParts.join(' — '), destTx, dy3); dy3 += ptToMm(14)
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
        { label: locale === 'pt' ? 'DATA PRESTAÇÃO' : 'DATE PRESTATION', value: prestationDate ? new Date(prestationDate).toLocaleDateString(dateLocaleStr) : '---' },
      ]
    : [
        { label: locale === 'pt' ? 'DATA DE EMISSÃO' : 'DATE D\'ÉMISSION', value: docDate ? new Date(docDate).toLocaleDateString(dateLocaleStr) : '---' },
        { label: locale === 'pt' ? 'DATA PRESTAÇÃO' : 'DATE PRESTATION', value: prestationDate ? new Date(prestationDate).toLocaleDateString(dateLocaleStr) : '---' },
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

  const buildTableBody = (srcLines: ProductLine[]) => {
    const body = srcLines.filter(l => l.description.trim()).map(l => {
      const unitStr = formatUnitForPdf(l.unit, l.customUnit)
      const cleanDesc = l.description.replace(/\s*\[[^\]]*\]/g, '').trim()
      const parts = cleanDesc.split('\n')
      const title = parts[0]
      let detail = parts.slice(1).join('\n').trim()

      // If étapes exist as structured data, strip them from the description text
      // to avoid duplication (description may contain étapes joined with ' → ')
      if (l.etapes && l.etapes.length > 0) {
        const sortedEtapes = [...l.etapes].sort((a, b) => a.ordre - b.ordre).filter(e => e.designation.trim())
        if (sortedEtapes.length > 0) {
          const etapeNames = sortedEtapes.map(e => e.designation.trim())
          const arrowJoined = etapeNames.join(' → ')
          if (detail === arrowJoined) {
            detail = ''
          } else if (detail.includes(arrowJoined)) {
            detail = detail.replace(arrowJoined, '').trim()
          }
        }
      }

      // Build: title, then lineDetail (description), then étapes
      const lineDetail = (l.lineDetail || '').trim()
      let displayDesc = title
      if (detail) displayDesc += `\n${detail}`
      if (lineDetail) displayDesc += `\n \n${lineDetail}`
      if (l.etapes && l.etapes.length > 0) {
        const sortedEtapes = [...l.etapes].sort((a, b) => a.ordre - b.ordre).filter(e => e.designation.trim())
        if (sortedEtapes.length > 0) {
          const descColW = contentW * 0.35 - 6
          pdf.setFontSize(10)
          const etapeLines = sortedEtapes.map((e, i) => {
            const prefix = `${i + 1}. `
            const prefixW = pdf.getTextWidth(prefix)
            const unitSuffix = e.unit ? ` / ${formatUnitForPdf(e.unit)}` : ''
            const priceSuffix = e.prixHT != null && e.prixHT > 0
              ? ` — ${localeFormats.currencyFormat(e.prixHT)}${unitSuffix}`
              : ''
            const etapeText = e.designation + priceSuffix
            const wrapped = pdf.splitTextToSize(etapeText, descColW - prefixW) as string[]
            let indent = ''
            while (pdf.getTextWidth(indent + ' ') < prefixW) indent += ' '
            return wrapped.map((line: string, li: number) =>
              li === 0 ? `${prefix}${line}` : `${indent}${line}`
            ).join('\n')
          })
          displayDesc += '\n \n' + etapeLines.join('\n \n')
        }
      }
      const row = [displayDesc, String(l.qty), unitStr, localeFormats.currencyFormat(l.priceHT)]
      if (tvaEnabled) row.push(`${l.tvaRate}%`)
      row.push(localeFormats.currencyFormat(l.totalHT))
      return row
    })
    if (body.length === 0) {
      body.push(tvaEnabled
        ? [t('devis.noLinesMessage'), '', '', '', '', '']
        : [t('devis.noLinesMessage'), '', '', '', '']
      )
    }
    return body
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

  const renderTable = (body: any[][], startY: number) => {
    autoTable(pdf, {
      head: tableHead,
      body,
      startY,
      margin: { left: mL, right: mR },
      showHead: 'firstPage',
      theme: 'plain',
      headStyles: {
        fillColor: [13, 13, 13],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
        halign: 'left',
        minCellHeight: ptToMm(29),
      },
      bodyStyles: {
        fontSize: 10,
        cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
        textColor: [13, 13, 13],
        lineWidth: 0,
        minCellHeight: ptToMm(32),
      },
      alternateRowStyles: { fillColor: [245, 245, 243] },
      columnStyles: colStyles as any,
      tableLineColor: [224, 224, 220],
      tableLineWidth: 0,
      didDrawPage: () => {},
      didParseCell: (data: any) => {
        if (data.section === 'head' && headColStyles[data.column.index]) {
          data.cell.styles.halign = headColStyles[data.column.index].halign
        }
        const lastCol = tvaEnabled ? 5 : 4
        if (data.section === 'body' && data.column.index === lastCol) {
          data.cell.styles.fontStyle = 'bold'
        }
      },
      willDrawCell: (data: any) => {
        if (data.section === 'body' && data.row.index % 2 === 0) {
          data.cell.styles.fillColor = [255, 255, 255]
        }
      },
    })
  }

  const drawSectionLabel = (label: string) => {
    pdf.setFontSize(9); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR_TEXT)
    pdf.text(label, mL, y + ptToMm(10))
    y += ptToMm(14)
  }

  // Dual table mode: render Main d'oeuvre + Matériaux separately when both arrays are provided and non-empty
  const hasLabor = !!laborLines && laborLines.some(l => l.description.trim())
  const hasMaterials = !!materialLines && materialLines.some(l => l.description.trim())
  const dualMode = hasLabor && hasMaterials

  if (dualMode) {
    const laborLabel = locale === 'pt' ? 'Mão de obra' : "Main d'œuvre"
    const materialLabel = locale === 'pt' ? 'Materiais' : 'Matériaux'
    drawSectionLabel(laborLabel)
    renderTable(buildTableBody(laborLines!), y)
    y = (pdf as any).lastAutoTable.finalY + ptToMm(10)
    drawSectionLabel(materialLabel)
    renderTable(buildTableBody(materialLines!), y)
  } else {
    renderTable(buildTableBody(lines), y)
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

  // Détail TVA par taux
  if (tvaEnabled) {
    const tvaByRate: Record<number, { base: number; amount: number }> = {}
    lines.filter(l => l.description.trim()).forEach(l => {
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

  // 8. Médiation de la consommation (particuliers uniquement — art. L. 612-1 C. conso.)
  if (isParticulier) {
    if (locale === 'pt') {
      legal3 += ' Resolução alternativa de litígios (Lei n.º 144/2015).'
    } else {
      legal3 += ' Médiation de la consommation (art. L. 612-1 C. conso.).'
    }
    if (mediatorName) {
      legal3 += ` ${mediatorName}${mediatorUrl ? ` — ${mediatorUrl}` : ''}.`
    }
  }

  const legal4 = locale === 'pt'
    ? `Documento gerado por Vitfix Pro em ${new Date().toLocaleDateString(dateLocaleStr)}.`
    : `Document généré par Vitfix Pro le ${new Date().toLocaleDateString(dateLocaleStr)}.`

  const fullLegal = `${legal1} ${legal2} ${legal3} ${legal4}`
  const legalW = ptFiscalData ? contentW - 32 : contentW
  const legalWrapped = pdf.splitTextToSize(fullLegal, legalW)
  const legalHeight = legalWrapped.length * ptToMm(10)
  checkPageBreak(legalHeight + 4)
  pdf.text(legalWrapped, mL, y)
  y += legalHeight

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
        pdf.text(`📅 ${dateStr}`, x + 2, infoY + 2)
        if (photo.lat && photo.lng) {
          pdf.text(`📍 ${Number(photo.lat).toFixed(5)}, ${Number(photo.lng).toFixed(5)}`, x + 2, infoY + 5.5)
        }
        if (photo.label) {
          pdf.setFont('helvetica', 'bold')
          const labelTrunc = photo.label.length > 35 ? photo.label.substring(0, 35) + '...' : photo.label
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

  // ─── Page numbers ───
  const totalPgs = (pdf as any).internal.getNumberOfPages()
  for (let p = 1; p <= totalPgs; p++) {
    pdf.setPage(p)
    pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR_TEXT_LIGHT)
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
