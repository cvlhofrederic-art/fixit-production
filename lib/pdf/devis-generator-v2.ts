/**
 * Devis PDF Generator V2
 * Standalone generator — does NOT replace components/DevisFactureForm.tsx
 * Rollback: delete lib/pdf/ directory
 */

// ─── Interfaces ───────────────────────────────────────────────

export interface DevisGeneratorInput {
  artisan: {
    logo_url: string | null
    nom: string
    siret: string
    rm: string | null
    adresse: string
    telephone: string
    email: string
    rc_pro: string | null
    tva_mention: string
    mode_paiement: string
  }
  client: {
    nom: string
    adresse: string | null
    telephone: string | null
    email: string | null
  }
  devis: {
    numero: string
    titre: string
    date_emission: Date
    validite_jours: number
    delai_execution: string
    date_prestation: Date | null
  }
  mode_affichage: 'bloc' | 'sections'
  lignes: LigneDevis[]
  etapes?: EtapeIntervention[]
  acomptes?: Acompte[]
  signature?: SignatureData
}

export interface LigneDevis {
  designation: string
  quantite: number
  unite: string
  prix_unitaire: number
  total: number
  section?: 'main_oeuvre' | 'materiaux' | 'deplacement' | 'location' | null
}

export interface EtapeIntervention {
  ordre: number
  designation: string
}

export interface Acompte {
  label: string
  montant: number
  declencheur: string
  statut: 'payé' | 'en attente'
}

export interface SignatureData {
  image_base64: string
  signe_le: Date
  signe_par: string
  ip_address?: string
}

// ─── Colors & Layout constants ────────────────────────────────

const ACCENT = '#F5C518'
const TABLE_HEAD_BG = '#333333'
const TABLE_HEAD_TEXT = '#FFFFFF'
const GRAY_LABEL = '#888888'
const BORDER = '#E0E0E0'
const ALT_ROW = '#F9F9F9'
const MARGIN = 15 // mm each side

// ─── Helpers ──────────────────────────────────────────────────

function formatPrice(n: number): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' \u20AC'
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('fr-FR')
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ]
}

function formatUnitForPdf(unit: string): string {
  const MAP: Record<string, string> = { m2: 'm²', m3: 'm³', ml: 'ml', h: 'h', j: 'j', f: 'Forfait', u: 'u', L: 'L', kg: 'kg', t: 't', pce: 'pce', ens: 'ens', pt: 'pt', lot: 'Lot', m: 'm' }
  return MAP[unit] || unit
}

const SECTION_LABELS: Record<string, string> = {
  main_oeuvre: "MAIN D'OEUVRE",
  materiaux: 'MATÉRIAUX',
  deplacement: 'DÉPLACEMENT',
  location: 'LOCATION',
}

// ─── Main export ──────────────────────────────────────────────

export async function generateDevisPdfV2(input: DevisGeneratorInput) {
  const { jsPDF } = await import('jspdf')

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()   // 210
  const pageH = pdf.internal.pageSize.getHeight()   // 297
  const contentW = pageW - MARGIN * 2
  let y = MARGIN

  // ── Helpers bound to this pdf instance ──

  const drawHLine = (x1: number, yPos: number, x2: number, color = BORDER, width = 0.3) => {
    pdf.setDrawColor(color)
    pdf.setLineWidth(width)
    pdf.line(x1, yPos, x2, yPos)
  }

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - 20) {
      pdf.addPage()
      y = MARGIN
    }
  }

  // ═══════════════════════════════════════════════════════════
  // PAGE 1: HEADER
  // ═══════════════════════════════════════════════════════════

  // Logo (left) — if available, fetch and embed
  if (input.artisan.logo_url) {
    try {
      const resp = await fetch(input.artisan.logo_url)
      const blob = await resp.blob()
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      })
      pdf.addImage(dataUrl, 'PNG', MARGIN, y, 25, 25)
    } catch {
      // Logo fetch failed — skip silently
    }
  }

  // Title centered
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(22)
  pdf.setTextColor('#000000')
  pdf.text(input.devis.titre, pageW / 2, y + 10, { align: 'center' })

  // Subtitle: numero
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(11)
  pdf.setTextColor(GRAY_LABEL)
  pdf.text(input.devis.numero, pageW / 2, y + 18, { align: 'center' })

  y += 24

  // Yellow separator bar
  pdf.setFillColor(...hexToRgb(ACCENT))
  pdf.rect(MARGIN, y, contentW, 0.7, 'F')
  y += 5

  // ═══════════════════════════════════════════════════════════
  // ÉMETTEUR / DESTINATAIRE
  // ═══════════════════════════════════════════════════════════

  const boxW = (contentW - 6) / 2
  const boxPad = 4
  const boxStartY = y

  // Helper: write label-value pairs, return dy consumed
  const writeLabelValue = (label: string, value: string, x: number, yPos: number, maxW: number): number => {
    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(GRAY_LABEL)
    pdf.text(label, x, yPos)
    const lw = pdf.getTextWidth(label)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor('#000000')
    const valW = maxW - lw - 2
    if (valW < 20) {
      // Label too wide — put value on next line
      const lines = pdf.splitTextToSize(value, maxW - 4)
      pdf.text(lines, x + 2, yPos + 3.5)
      return 3.5 + lines.length * 3.5
    }
    const lines = pdf.splitTextToSize(value, valW)
    if (lines.length === 1) {
      pdf.text(value, x + lw + 1, yPos)
      return 4
    }
    // First line next to label, rest below full width
    pdf.text(lines[0], x + lw + 1, yPos)
    for (let i = 1; i < lines.length; i++) {
      pdf.text(lines[i], x + 2, yPos + i * 3.5)
    }
    return lines.length * 3.5
  }

  // ── Émetteur (LEFT) ──
  const emX = MARGIN
  const emLx = emX + boxPad
  const emMaxW = boxW - boxPad * 2

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.setTextColor('#000000')
  pdf.text('ÉMETTEUR', emX + boxW / 2, boxStartY + boxPad, { align: 'center' })
  drawHLine(emX + boxW / 2 - 10, boxStartY + boxPad + 2, emX + boxW / 2 + 10, BORDER, 0.2)

  let ey = boxStartY + boxPad + 5
  ey += writeLabelValue('Entreprise : ', input.artisan.nom, emLx, ey, emMaxW)
  ey += writeLabelValue('SIRET : ', input.artisan.siret, emLx, ey, emMaxW)
  if (input.artisan.rm) ey += writeLabelValue('RM : ', input.artisan.rm, emLx, ey, emMaxW)
  ey += writeLabelValue('Adresse : ', input.artisan.adresse, emLx, ey, emMaxW)
  ey += writeLabelValue('Tél : ', input.artisan.telephone, emLx, ey, emMaxW)
  ey += writeLabelValue('Email : ', input.artisan.email, emLx, ey, emMaxW)
  if (input.artisan.rc_pro) ey += writeLabelValue('RC Pro : ', input.artisan.rc_pro, emLx, ey, emMaxW)

  // ── Destinataire (RIGHT) ──
  const destX = emX + boxW + 6
  const destLx = destX + boxPad
  const destMaxW = boxW - boxPad * 2

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.setTextColor('#000000')
  pdf.text('DESTINATAIRE', destX + boxW / 2, boxStartY + boxPad, { align: 'center' })
  drawHLine(destX + boxW / 2 - 10, boxStartY + boxPad + 2, destX + boxW / 2 + 10, BORDER, 0.2)

  let dy = boxStartY + boxPad + 5
  dy += writeLabelValue('Nom : ', input.client.nom, destLx, dy, destMaxW)
  if (input.client.adresse) dy += writeLabelValue('Adresse : ', input.client.adresse, destLx, dy, destMaxW)
  if (input.client.telephone) dy += writeLabelValue('Tél : ', input.client.telephone, destLx, dy, destMaxW)
  if (input.client.email) dy += writeLabelValue('Email : ', input.client.email, destLx, dy, destMaxW)

  const boxH = Math.max(ey, dy) - boxStartY + 3
  pdf.setDrawColor(BORDER)
  pdf.setLineWidth(0.3)
  pdf.roundedRect(emX, boxStartY, boxW, boxH, 1.5, 1.5, 'S')
  pdf.roundedRect(destX, boxStartY, boxW, boxH, 1.5, 1.5, 'S')

  y = boxStartY + boxH + 5

  // ═══════════════════════════════════════════════════════════
  // INFO BAND (4 columns)
  // ═══════════════════════════════════════════════════════════

  pdf.setFillColor(248, 248, 248)
  pdf.setDrawColor(BORDER)
  pdf.setLineWidth(0.3)
  pdf.roundedRect(MARGIN, y, contentW, 10, 1.5, 1.5, 'FD')

  const colW = contentW / 4
  const bandY = y + 3.5
  const bandValY = y + 7.5

  const drawInfoCol = (label: string, value: string, colIdx: number) => {
    const cx = MARGIN + colW * colIdx + colW / 2
    pdf.setFontSize(6)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(GRAY_LABEL)
    pdf.text(label, cx, bandY, { align: 'center' })
    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor('#000000')
    pdf.text(value, cx, bandValY, { align: 'center' })
  }

  drawInfoCol("DATE D'ÉMISSION", formatDate(input.devis.date_emission), 0)
  drawInfoCol('VALIDITÉ', `${input.devis.validite_jours} jours`, 1)
  drawInfoCol("DÉLAI D'EXÉCUTION", input.devis.delai_execution, 2)
  drawInfoCol('DATE PRESTATION', input.devis.date_prestation ? formatDate(input.devis.date_prestation) : '—', 3)

  y += 14

  // ═══════════════════════════════════════════════════════════
  // ÉTAPES D'INTERVENTION (optional)
  // ═══════════════════════════════════════════════════════════

  if (input.etapes && input.etapes.length > 0) {
    const sorted = [...input.etapes].sort((a, b) => a.ordre - b.ordre).filter(e => e.designation.trim())
    if (sorted.length > 0) {
      ensureSpace(10 + sorted.length * 5)

      pdf.setFillColor(248, 248, 248)
      pdf.rect(MARGIN, y, contentW, 7, 'F')
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(9)
      pdf.setTextColor('#333333')
      pdf.text("DÉTAIL DE L'INTERVENTION", MARGIN + 4, y + 5)
      y += 10

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8.5)
      pdf.setTextColor('#505050')
      for (let i = 0; i < sorted.length; i++) {
        pdf.text(`${i + 1}. ${sorted[i].designation}`, MARGIN + 6, y)
        y += 5
        if (y > pageH - 40) {
          pdf.addPage()
          y = MARGIN
        }
      }
      y += 4
    }
  }

  // ═══════════════════════════════════════════════════════════
  // LINES TABLE
  // ═══════════════════════════════════════════════════════════

  const colWidths = {
    designation: contentW * 0.40,
    quantite: contentW * 0.10,
    unite: contentW * 0.10,
    prixUnit: contentW * 0.18,
    total: contentW * 0.22,
  }
  const headerH = 8
  const rowH = 7

  const drawTableHeader = () => {
    pdf.setFillColor(...hexToRgb(TABLE_HEAD_BG))
    pdf.rect(MARGIN, y, contentW, headerH, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(7.5)
    pdf.setTextColor(TABLE_HEAD_TEXT)

    let hx = MARGIN + 3
    pdf.text('DÉSIGNATION', hx, y + 5.5)
    hx += colWidths.designation
    pdf.text('QTÉ', hx, y + 5.5, { align: 'center' })
    hx += colWidths.quantite
    pdf.text('UNITÉ', hx, y + 5.5, { align: 'center' })
    hx += colWidths.unite
    pdf.text('PRIX U. TTC', hx + colWidths.prixUnit - 3, y + 5.5, { align: 'right' })
    hx += colWidths.prixUnit
    pdf.text('TOTAL TTC', hx + colWidths.total - 3, y + 5.5, { align: 'right' })
    y += headerH
  }

  const drawRow = (line: LigneDevis, rowIdx: number) => {
    // Wrap designation to calculate actual row height
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    const desigLines = pdf.splitTextToSize(line.designation, colWidths.designation - 6)
    const actualRowH = Math.max(rowH, desigLines.length * 3.5 + 3)

    if (y + actualRowH > pageH - 25) {
      pdf.addPage()
      y = MARGIN
      drawTableHeader()
    }

    // Alternating row bg
    if (rowIdx % 2 === 1) {
      pdf.setFillColor(...hexToRgb(ALT_ROW))
      pdf.rect(MARGIN, y, contentW, actualRowH, 'F')
    }

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor('#000000')

    let rx = MARGIN + 3
    // Designation — all wrapped lines
    pdf.text(desigLines, rx, y + 4.5)

    rx += colWidths.designation
    pdf.text(String(line.quantite), rx, y + 5, { align: 'center' })
    rx += colWidths.quantite
    pdf.text(formatUnitForPdf(line.unite), rx, y + 5, { align: 'center' })
    rx += colWidths.unite
    pdf.text(formatPrice(line.prix_unitaire), rx + colWidths.prixUnit - 3, y + 5, { align: 'right' })
    rx += colWidths.prixUnit
    pdf.text(formatPrice(line.total), rx + colWidths.total - 3, y + 5, { align: 'right' })

    // Bottom border
    pdf.setDrawColor(BORDER)
    pdf.setLineWidth(0.1)
    pdf.line(MARGIN, y + actualRowH, MARGIN + contentW, y + actualRowH)

    y += actualRowH
  }

  if (input.mode_affichage === 'bloc') {
    // ── Mode bloc: flat table ──
    drawTableHeader()
    input.lignes.forEach((line, idx) => drawRow(line, idx))
  } else {
    // ── Mode sections: grouped ──
    const grouped: Record<string, LigneDevis[]> = {}
    for (const line of input.lignes) {
      const key = line.section || 'autres'
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(line)
    }

    for (const [section, lines] of Object.entries(grouped)) {
      ensureSpace(headerH + rowH * lines.length + 12)

      // Section title
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(9)
      pdf.setTextColor('#333333')
      pdf.text(SECTION_LABELS[section] || section.toUpperCase(), MARGIN, y + 4)
      y += 7

      drawTableHeader()
      let sectionTotal = 0
      lines.forEach((line, idx) => {
        drawRow(line, idx)
        sectionTotal += line.total
      })

      // Section subtotal
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(8)
      pdf.setTextColor('#333333')
      pdf.text(`Sous-total : ${formatPrice(sectionTotal)}`, MARGIN + contentW - 3, y + 4, { align: 'right' })
      y += 8
    }
  }

  // TVA mention
  pdf.setFont('helvetica', 'italic')
  pdf.setFontSize(7)
  pdf.setTextColor(GRAY_LABEL)
  pdf.text(input.artisan.tva_mention, MARGIN, y + 3)
  y += 7

  // ═══════════════════════════════════════════════════════════
  // TOTAL NET
  // ═══════════════════════════════════════════════════════════

  const totalNet = input.lignes.reduce((sum, l) => sum + l.total, 0)

  const totBoxW = 65
  const totBoxX = MARGIN + contentW - totBoxW

  // Subtotal
  pdf.setFillColor(248, 248, 248)
  pdf.setDrawColor(BORDER)
  pdf.setLineWidth(0.3)
  pdf.rect(totBoxX, y, totBoxW, 8, 'FD')
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(GRAY_LABEL)
  pdf.text('Sous-total TTC', totBoxX + 3, y + 5.5)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor('#000000')
  pdf.text(formatPrice(totalNet), totBoxX + totBoxW - 3, y + 5.5, { align: 'right' })
  y += 8

  // Total NET accent bar
  pdf.setFillColor(...hexToRgb(ACCENT))
  pdf.rect(totBoxX, y, totBoxW, 10, 'F')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.setTextColor('#000000')
  pdf.text('TOTAL NET TTC', totBoxX + 3, y + 7)
  pdf.text(formatPrice(totalNet), totBoxX + totBoxW - 3, y + 7, { align: 'right' })
  y += 16

  // ═══════════════════════════════════════════════════════════
  // ÉCHÉANCIER DE PAIEMENT (optional)
  // ═══════════════════════════════════════════════════════════

  if (input.acomptes && input.acomptes.length > 0) {
    ensureSpace(10 + input.acomptes.length * 8 + 10)

    // Section title
    pdf.setFillColor(248, 248, 248)
    pdf.rect(MARGIN, y, contentW, 7, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.setTextColor('#333333')
    pdf.text('ÉCHÉANCIER DE PAIEMENT', MARGIN + 4, y + 5)
    y += 9

    // Table header
    const ecColW = { desc: contentW * 0.40, montant: contentW * 0.20, declencheur: contentW * 0.25, statut: contentW * 0.15 }
    pdf.setFillColor(...hexToRgb(TABLE_HEAD_BG))
    pdf.rect(MARGIN, y, contentW, 7, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(7)
    pdf.setTextColor(TABLE_HEAD_TEXT)
    pdf.text('Description', MARGIN + 3, y + 5)
    pdf.text('Montant', MARGIN + ecColW.desc + 3, y + 5)
    pdf.text('Déclencheur', MARGIN + ecColW.desc + ecColW.montant + 3, y + 5)
    pdf.text('Statut', MARGIN + ecColW.desc + ecColW.montant + ecColW.declencheur + 3, y + 5)
    y += 8

    // Rows
    for (const ac of input.acomptes) {
      if (y + 7 > pageH - 25) {
        pdf.addPage()
        y = MARGIN
      }

      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8)
      pdf.setTextColor('#000000')
      pdf.text(ac.label, MARGIN + 3, y + 4.5)
      pdf.text(formatPrice(ac.montant), MARGIN + ecColW.desc + 3, y + 4.5)
      pdf.text(ac.declencheur, MARGIN + ecColW.desc + ecColW.montant + 3, y + 4.5)

      // Status with color
      if (ac.statut === 'payé') {
        pdf.setTextColor('#16A34A') // green
      } else {
        pdf.setTextColor('#EA580C') // orange
      }
      pdf.setFont('helvetica', 'bold')
      pdf.text(ac.statut, MARGIN + ecColW.desc + ecColW.montant + ecColW.declencheur + 3, y + 4.5)

      pdf.setDrawColor(BORDER)
      pdf.setLineWidth(0.1)
      pdf.line(MARGIN, y + 7, MARGIN + contentW, y + 7)
      y += 7
    }
    y += 6
  }

  // ═══════════════════════════════════════════════════════════
  // CONDITIONS / BON POUR ACCORD
  // ═══════════════════════════════════════════════════════════

  ensureSpace(45)

  const condW = contentW * 0.55
  const sigW = contentW - condW - 6
  const condX = MARGIN
  const sigX = MARGIN + condW + 6
  const blockStartY = y

  // ── Conditions (LEFT) ──
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.setTextColor('#000000')
  pdf.text('CONDITIONS', condX + condW / 2, blockStartY + 4, { align: 'center' })
  drawHLine(condX + condW / 2 - 10, blockStartY + 6, condX + condW / 2 + 10, BORDER, 0.2)

  let cy = blockStartY + 10
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7)
  pdf.setTextColor('#555555')

  const validStr = `${input.devis.validite_jours} jours`
  const conditions = [
    `Validité du devis : ${validStr} à compter de la date d'émission.`,
    `Délai d'exécution estimé : ${input.devis.delai_execution}.`,
    'Tout travail supplémentaire fera l\'objet d\'un avenant signé par les deux parties.',
    `Mode de règlement : ${input.artisan.mode_paiement}.`,
  ]
  for (const cond of conditions) {
    const wrapped = pdf.splitTextToSize(cond, condW - 8)
    pdf.text(wrapped, condX + 4, cy)
    cy += wrapped.length * 3
  }
  const condH = Math.max(cy - blockStartY + 3, 40)
  pdf.setDrawColor(BORDER)
  pdf.setLineWidth(0.3)
  pdf.roundedRect(condX, blockStartY, condW, condH, 1.5, 1.5, 'S')

  // ── Bon pour accord (RIGHT) ──
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.setTextColor('#000000')
  pdf.text('BON POUR ACCORD', sigX + sigW / 2, blockStartY + 4, { align: 'center' })
  drawHLine(sigX + sigW / 2 - 12, blockStartY + 6, sigX + sigW / 2 + 12, BORDER, 0.2)

  if (input.signature) {
    // Signature present
    try {
      pdf.addImage(input.signature.image_base64, 'PNG', sigX + 4, blockStartY + 10, sigW - 8, 18)
    } catch {
      // If image fails, skip
    }
    const sigInfoY = blockStartY + 30
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor('#333333')
    pdf.text(`Signé électroniquement le ${formatDate(input.signature.signe_le)}`, sigX + 4, sigInfoY)
    pdf.text(`Par : ${input.signature.signe_par}`, sigX + 4, sigInfoY + 3.5)
    if (input.signature.ip_address) {
      pdf.setFontSize(5)
      pdf.setTextColor(GRAY_LABEL)
      pdf.text(`IP : ${input.signature.ip_address}`, sigX + 4, sigInfoY + 7)
    }
  } else {
    // No signature — blank fields
    pdf.setFont('helvetica', 'italic')
    pdf.setFontSize(6.5)
    pdf.setTextColor('#777777')
    pdf.text('Mention manuscrite "Bon pour accord"', sigX + 4, blockStartY + 12)
    pdf.text('Lu et approuvé, bon pour travaux.', sigX + 4, blockStartY + 16)

    drawHLine(sigX + 4, blockStartY + 24, sigX + sigW - 4, '#D1D5DB', 0.2)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(6.5)
    pdf.setTextColor('#777777')
    pdf.text('Date : ___/___/______', sigX + 4, blockStartY + 28)
    pdf.text('Signature :', sigX + 4, blockStartY + 32)
  }

  pdf.setDrawColor(BORDER)
  pdf.setLineWidth(0.3)
  pdf.roundedRect(sigX, blockStartY, sigW, condH, 1.5, 1.5, 'S')

  y = blockStartY + condH + 6

  // ═══════════════════════════════════════════════════════════
  // FOOTER LEGAL (7px)
  // ═══════════════════════════════════════════════════════════

  const rcProStr = input.artisan.rc_pro || 'N/A'
  const genDate = formatDate(new Date())
  const legalLines = [
    'Entrepreneur individuel (EI). Loi n\u00B02022-172 du 14 f\u00E9vrier 2022.',
    'TVA non applicable, article 293 B du CGI.',
    `RC Pro ${rcProStr}, couverture France m\u00E9tropolitaine.`,
    "Devis gratuit, conform\u00E9ment \u00E0 l'article L. 111-1 du Code de la consommation.",
    'Droit de r\u00E9tractation : 14 jours calendaires \u00E0 compter de la signature (art. L. 221-18 C. conso.).',
    'Aucun paiement exigible avant 7 jours apr\u00E8s signature (art. L. 221-10 C. conso.), sauf travaux urgents.',
    'M\u00E9diation de la consommation (art. L. 612-1 C. conso.).',
    `Document g\u00E9n\u00E9r\u00E9 par Vitfix Pro le ${genDate}.`,
  ]

  // Place footer at bottom of current page
  const footerY = pageH - 22
  if (y < footerY - 2) {
    y = footerY
  } else {
    // Content already reached footer zone — just continue
    y += 4
  }

  drawHLine(MARGIN, y, MARGIN + contentW, BORDER, 0.2)
  y += 2

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(5.5)
  pdf.setTextColor(GRAY_LABEL)
  for (const line of legalLines) {
    pdf.text(line, pageW / 2, y, { align: 'center' })
    y += 2.5
  }

  // ═══════════════════════════════════════════════════════════
  // PAGE 2: DROIT DE RÉTRACTATION
  // ═══════════════════════════════════════════════════════════

  pdf.addPage()
  y = MARGIN

  // Title
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(14)
  pdf.setTextColor('#000000')
  pdf.text('DROIT DE RÉTRACTATION', pageW / 2, y, { align: 'center' })
  y += 8

  drawHLine(MARGIN, y, MARGIN + contentW, ACCENT, 0.7)
  y += 6

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor('#333333')

  const retractText = [
    "Conform\u00E9ment aux articles L. 221-18 et suivants du Code de la consommation, le client dispose d'un d\u00E9lai de quatorze (14) jours calendaires \u00E0 compter de la signature du pr\u00E9sent devis pour exercer son droit de r\u00E9tractation, sans avoir \u00E0 motiver sa d\u00E9cision ni \u00E0 supporter de p\u00E9nalit\u00E9s.",
    "",
    "Ce droit s'applique lorsque le contrat est conclu hors \u00E9tablissement (au domicile du consommateur, sur son lieu de travail, ou dans tout autre lieu qui n'est pas celui o\u00F9 le professionnel exerce son activit\u00E9 de mani\u00E8re permanente ou habituelle), conform\u00E9ment \u00E0 l'article L. 221-1 du Code de la consommation.",
    "",
    "Le client peut notifier sa d\u00E9cision de r\u00E9tractation :",
    "  \u2022 Par courrier recommand\u00E9 avec accus\u00E9 de r\u00E9ception ;",
    "  \u2022 Par courriel, avec demande de confirmation de lecture ;",
    "  \u2022 En utilisant le formulaire de r\u00E9tractation ci-dessous.",
    "",
    "Si le client a express\u00E9ment demand\u00E9 le commencement des travaux avant l'expiration du d\u00E9lai de r\u00E9tractation (article L. 221-25), il reste redevable d'un montant proportionnel au service fourni jusqu'\u00E0 la communication de sa d\u00E9cision de r\u00E9tractation.",
    "",
    "En l'absence de demande expresse de commencement anticip\u00E9, aucun paiement ne peut \u00EAtre exig\u00E9 avant l'expiration du d\u00E9lai de sept (7) jours suivant la signature du contrat (article L. 221-10).",
  ]

  for (const para of retractText) {
    if (para === '') {
      y += 2
      continue
    }
    const wrapped = pdf.splitTextToSize(para, contentW - 4)
    pdf.text(wrapped, MARGIN + 2, y)
    y += wrapped.length * 3.5
    if (y > pageH - 40) {
      pdf.addPage()
      y = MARGIN
    }
  }

  y += 8

  // ═══════════════════════════════════════════════════════════
  // FORMULAIRE DE RÉTRACTATION
  // ═══════════════════════════════════════════════════════════

  ensureSpace(80)

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(12)
  pdf.setTextColor('#000000')
  pdf.text('FORMULAIRE DE RÉTRACTATION', pageW / 2, y, { align: 'center' })
  y += 6

  drawHLine(MARGIN, y, MARGIN + contentW, ACCENT, 0.7)
  y += 6

  pdf.setFont('helvetica', 'italic')
  pdf.setFontSize(7)
  pdf.setTextColor(GRAY_LABEL)
  pdf.text('(Veuillez compl\u00E9ter et renvoyer le pr\u00E9sent formulaire uniquement si vous souhaitez vous r\u00E9tracter du contrat)', MARGIN + 2, y)
  y += 6

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8.5)
  pdf.setTextColor('#333333')

  const formFields = [
    `\u00C0 l'attention de : ${input.artisan.nom}`,
    `Adresse : ${input.artisan.adresse}`,
    `Email : ${input.artisan.email}`,
    '',
    'Je/Nous (*) vous notifie/notifions (*) par la pr\u00E9sente ma/notre (*) r\u00E9tractation du contrat portant sur la prestation de services ci-dessous :',
    '',
  ]

  for (const line of formFields) {
    if (line === '') {
      y += 3
      continue
    }
    pdf.text(line, MARGIN + 4, y)
    y += 4.5
  }

  // Dotted line fields
  const dottedFields = [
    "Num\u00E9ro du devis : ",
    "Service concern\u00E9 : ",
    "Command\u00E9 le : ",
    "Nom du client : ",
    "Adresse du client : ",
  ]

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8.5)
  for (const field of dottedFields) {
    pdf.setTextColor('#333333')
    pdf.text(field, MARGIN + 4, y)
    const labelW = pdf.getTextWidth(field)
    // Dotted line
    pdf.setDrawColor('#AAAAAA')
    pdf.setLineWidth(0.2)
    pdf.setLineDashPattern([1, 1], 0)
    pdf.line(MARGIN + 4 + labelW, y + 0.5, MARGIN + contentW - 4, y + 0.5)
    pdf.setLineDashPattern([], 0) // reset
    y += 6
  }

  y += 6
  pdf.setFontSize(8)
  pdf.text('Date :', MARGIN + 4, y)
  drawHLine(MARGIN + 20, y + 0.5, MARGIN + 60, '#AAAAAA', 0.2)

  y += 8
  pdf.text('Signature du client :', MARGIN + 4, y)

  y += 6
  pdf.setFontSize(6)
  pdf.setTextColor(GRAY_LABEL)
  pdf.text('(*) Rayez la mention inutile.', MARGIN + 4, y)

  return pdf
}
