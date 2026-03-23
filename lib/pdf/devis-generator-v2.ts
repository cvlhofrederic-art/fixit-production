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
  notes?: string
  mediateur?: string
  mediateur_url?: string
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

const ACCENT = '#FFD600'        // Reference: (1.0, 0.839, 0.0) — pure golden yellow
const TABLE_HEAD_BG = '#0D0D0D'  // Reference: (0.051, 0.051, 0.051) — near black
const TABLE_HEAD_TEXT = '#FFFFFF'
const GRAY_LABEL = '#888888'
const BORDER = '#E0E0DC'         // Reference: (0.878, 0.878, 0.863) — warm gray
const ALT_ROW = '#F5F5F3'       // Reference: (0.961, 0.961, 0.953) — warm light gray
const DEST_BG = '#F5F5F3'       // Destinataire box background
const MARGIN = 18               // Reference: x0=51pt ≈ 18mm

// ─── Helpers ──────────────────────────────────────────────────

function formatPrice(n: number): string {
  const parts = n.toFixed(2).split('.')
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return intPart + ',' + parts[1] + ' \u20AC'
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

function cleanDescription(desc: string): string {
  // Remove [unit:...], [min:...], [max:...] metadata patterns
  return desc.replace(/\[unit:[^\]]*\]/gi, '').replace(/\[min:[^\]]*\]/gi, '').replace(/\[max:[^\]]*\]/gi, '').replace(/\s{2,}/g, ' ').trim()
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

  // Title — centered on page
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(22)
  pdf.setTextColor('#000000')
  pdf.text(input.devis.titre, pageW / 2, y + 10, { align: 'center' })

  // Subtitle: numero — centered
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

  // ── Émetteur (LEFT) ──
  const emX = MARGIN
  const emLx = emX + boxPad
  const emMaxW = boxW - boxPad * 2

  // CORRECTION 2: Title left-aligned within box, small caps style, no underline
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(7)
  pdf.setTextColor('#000000')
  pdf.text('ÉMETTEUR', emX + boxPad, boxStartY + boxPad)

  let ey = boxStartY + boxPad + 4

  // Name — bold, standalone
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.setTextColor('#000000')
  pdf.text(input.artisan.nom, emLx, ey)
  ey += 4

  // Remaining lines — normal weight, with or without prefix
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7.5)
  pdf.setTextColor('#333333')

  const emLines: string[] = []
  emLines.push(`SIRET : ${input.artisan.siret}`)
  if (input.artisan.rm) emLines.push(input.artisan.rm)
  // Address — split by comma to wrap naturally
  const addrWrapped = pdf.splitTextToSize(input.artisan.adresse, emMaxW - 4)
  emLines.push(...addrWrapped)
  emLines.push(`Tél : ${input.artisan.telephone}`)
  emLines.push(input.artisan.email)
  if (input.artisan.rc_pro) emLines.push(`RC Pro ${input.artisan.rc_pro}`)

  for (const line of emLines) {
    pdf.text(line, emLx, ey)
    ey += 3.5
  }

  // ── Destinataire (RIGHT) ──
  const destX = emX + boxW + 6
  const destLx = destX + boxPad
  const destMaxW = boxW - boxPad * 2

  // CORRECTION 2: Title left-aligned within box, small caps style, no underline
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(7)
  pdf.setTextColor('#000000')
  pdf.text('DESTINATAIRE', destX + boxPad, boxStartY + boxPad)

  let dy = boxStartY + boxPad + 4

  // Name — bold, standalone
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.setTextColor('#000000')
  pdf.text(input.client.nom, destLx, dy)
  dy += 4

  // Remaining lines — normal weight
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(7.5)
  pdf.setTextColor('#333333')

  const destLines: string[] = []
  if (input.client.adresse) {
    const addrLines = pdf.splitTextToSize(input.client.adresse, destMaxW - 4)
    destLines.push(...addrLines)
  }
  if (input.client.telephone) destLines.push(`Tél : ${input.client.telephone}`)
  if (input.client.email) destLines.push(input.client.email)

  for (const line of destLines) {
    pdf.text(line, destLx, dy)
    dy += 3.5
  }

  const boxH = Math.max(ey, dy) - boxStartY + 3
  // ÉMETTEUR: border only (no fill) — matches reference
  pdf.setDrawColor(BORDER)
  pdf.setLineWidth(0.5)
  pdf.rect(emX, boxStartY, boxW, boxH, 'S')
  // DESTINATAIRE: light gray fill + border — matches reference
  pdf.setFillColor(...hexToRgb(DEST_BG))
  pdf.setDrawColor(BORDER)
  pdf.setLineWidth(0.5)
  pdf.rect(destX, boxStartY, boxW, boxH, 'FD')

  y = boxStartY + boxH + 5

  // ═══════════════════════════════════════════════════════════
  // INFO BAND (4 columns)
  // ═══════════════════════════════════════════════════════════

  pdf.setFillColor(...hexToRgb(ALT_ROW))
  pdf.setDrawColor(BORDER)
  pdf.setLineWidth(0.5)
  pdf.rect(MARGIN, y, contentW, 17, 'FD')

  const colW = contentW / 4
  const bandY = y + 5
  const bandValY = y + 12

  const drawInfoCol = (label: string, value: string, colIdx: number) => {
    const cx = MARGIN + colW * colIdx + colW / 2
    pdf.setFontSize(6)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(GRAY_LABEL)
    pdf.text(label, cx, bandY, { align: 'center' })
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor('#0D0D0D')
    pdf.text(value, cx, bandValY, { align: 'center' })
  }

  drawInfoCol("DATE D'ÉMISSION", formatDate(input.devis.date_emission), 0)
  drawInfoCol('VALIDITÉ', `${input.devis.validite_jours} jours`, 1)
  drawInfoCol("DÉLAI D'EXÉCUTION", input.devis.delai_execution, 2)
  drawInfoCol('DATE PRESTATION', input.devis.date_prestation ? formatDate(input.devis.date_prestation) : '—', 3)

  // CORRECTION 4: Vertical separators between the 4 info columns
  pdf.setDrawColor(BORDER)
  pdf.setLineWidth(0.5)
  for (let i = 1; i < 4; i++) {
    const sepX = MARGIN + colW * i
    pdf.line(sepX, y, sepX, y + 17)
  }

  y += 22  // reference: 14pt gap between info band bottom and table header

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
    designation: contentW * 0.50,
    quantite: contentW * 0.08,
    unite: contentW * 0.08,
    prixUnit: contentW * 0.16,
    total: contentW * 0.18,
  }
  const headerH = 10  // reference: ~29pt = ~10mm
  const rowH = 11     // reference: ~32pt = ~11mm

  const drawTableHeader = () => {
    pdf.setFillColor(...hexToRgb(TABLE_HEAD_BG))
    pdf.rect(MARGIN, y, contentW, headerH, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8)
    pdf.setTextColor(TABLE_HEAD_TEXT)

    let hx = MARGIN + 3
    pdf.text('DÉSIGNATION', hx, y + 6.5)
    hx += colWidths.designation
    pdf.text('QTÉ', hx, y + 6.5, { align: 'center' })
    hx += colWidths.quantite
    pdf.text('UNITÉ', hx, y + 6.5, { align: 'center' })
    hx += colWidths.unite
    pdf.text('PRIX U. TTC', hx + colWidths.prixUnit - 3, y + 6.5, { align: 'right' })
    hx += colWidths.prixUnit
    pdf.text('TOTAL TTC', hx + colWidths.total - 3, y + 6.5, { align: 'right' })
    y += headerH
    // Yellow line under header — reference: (1.0, 0.839, 0.0) width=1.0
    drawHLine(MARGIN, y, MARGIN + contentW, ACCENT, 1.0)
  }

  const drawRow = (line: LigneDevis, rowIdx: number) => {
    // Wrap designation to calculate actual row height
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    const desigLines = pdf.splitTextToSize(cleanDescription(line.designation), colWidths.designation - 6)
    const actualRowH = Math.max(rowH, desigLines.length * 4 + 4)

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

    const textY = y + actualRowH / 2 + 1  // vertically centered in row

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor('#0D0D0D')

    let rx = MARGIN + 3
    // Designation — all wrapped lines, top-aligned
    pdf.text(desigLines, rx, y + 5)

    rx += colWidths.designation
    pdf.text(String(line.quantite), rx, textY, { align: 'center' })
    rx += colWidths.quantite
    pdf.text(formatUnitForPdf(line.unite), rx, textY, { align: 'center' })
    rx += colWidths.unite
    pdf.text(formatPrice(line.prix_unitaire), rx + colWidths.prixUnit - 3, textY, { align: 'right' })
    rx += colWidths.prixUnit
    // Total in bold
    pdf.setFont('helvetica', 'bold')
    pdf.text(formatPrice(line.total), rx + colWidths.total - 3, textY, { align: 'right' })

    // Bottom border — reference: 0.5 width warm gray
    pdf.setDrawColor(BORDER)
    pdf.setLineWidth(0.5)
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

  // ═══════════════════════════════════════════════════════════
  // CORRECTION 5: Sous-total as a table row (not separate box)
  // ═══════════════════════════════════════════════════════════

  const totalNet = input.lignes.reduce((sum, l) => sum + l.total, 0)

  // TVA mention + Sous-total on same row (no background)
  y += 3
  pdf.setFont('helvetica', 'italic')
  pdf.setFontSize(7.5)
  pdf.setTextColor('#808080')
  pdf.text(input.artisan.tva_mention, MARGIN, y + 3)

  // Sous-total right-aligned
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor('#808080')
  const stLabelX = MARGIN + contentW - colWidths.total - 3
  pdf.text('Sous-total', stLabelX, y + 3, { align: 'right' })
  pdf.setTextColor('#0D0D0D')
  pdf.text(formatPrice(totalNet), MARGIN + contentW - 3, y + 3, { align: 'right' })
  y += 10

  // ═══════════════════════════════════════════════════════════
  // TOTAL NET — yellow line above, gray bg box, right-aligned
  // Reference: half-page right, yellow line 1.5pt, gray fill
  // ═══════════════════════════════════════════════════════════

  const totBoxW = contentW / 2  // right half of page
  const totBoxX = MARGIN + contentW - totBoxW
  const totBoxH = 10

  // Yellow line above the box
  drawHLine(totBoxX, y, totBoxX + totBoxW, ACCENT, 1.5)
  y += 2

  // Light gray background
  pdf.setFillColor(...hexToRgb(ALT_ROW))
  pdf.setDrawColor(BORDER)
  pdf.setLineWidth(0.5)
  pdf.rect(totBoxX, y, totBoxW, totBoxH, 'FD')

  // "TOTAL NET" label bold left
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.setTextColor('#0D0D0D')
  pdf.text('TOTAL NET', totBoxX + 4, y + 7)

  // Amount bold right
  pdf.text(formatPrice(totalNet), totBoxX + totBoxW - 3, y + 7, { align: 'right' })
  y += totBoxH + 6

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

  // ── CORRECTION 7: Conditions (LEFT) — no enclosing box, title left-aligned ──
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.setTextColor('#000000')
  pdf.text('CONDITIONS', condX, blockStartY + 4)

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

  // BON POUR ACCORD (RIGHT) — gray fill + border box, title left-aligned
  // Reference: rect fill=(0.96,0.96,0.95) + stroke border
  const condH = Math.max(cy - blockStartY + 3, 55)
  pdf.setFillColor(...hexToRgb(ALT_ROW))
  pdf.setDrawColor(BORDER)
  pdf.setLineWidth(0.5)
  pdf.rect(sigX, blockStartY, sigW, condH, 'FD')

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.setTextColor('#0D0D0D')
  pdf.text('BON POUR ACCORD', sigX + 4, blockStartY + 6)

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
    // No signature — reference layout: text + date + signature fields
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor('#0D0D0D')
    const bonText = pdf.splitTextToSize('Devis reçu avant exécution des travaux, lu et approuvé, bon pour accord.', sigW - 12)
    pdf.text(bonText, sigX + 4, blockStartY + 14)

    pdf.text('Date : ___ / ___ / ______', sigX + 4, blockStartY + 30)
    pdf.text('Signature :', sigX + 4, blockStartY + 40)
  }

  // condH already computed above for BON POUR ACCORD box

  y = blockStartY + condH + 6

  // ═══════════════════════════════════════════════════════════
  // NOTES (optional)
  // ═══════════════════════════════════════════════════════════

  if (input.notes && input.notes.trim()) {
    ensureSpace(20)

    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8)
    pdf.setTextColor('#000000')
    pdf.text('NOTES', MARGIN + 4, y + 4)
    const notesY = y + 8
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor('#555555')
    const notesWrapped = pdf.splitTextToSize(input.notes.trim(), contentW - 12)
    pdf.text(notesWrapped, MARGIN + 4, notesY)
    const notesBoxH = 10 + notesWrapped.length * 3
    pdf.setDrawColor(BORDER)
    pdf.setLineWidth(0.3)
    pdf.roundedRect(MARGIN, y, contentW, notesBoxH, 1.5, 1.5, 'S')
    y += notesBoxH + 4
  }

  // ═══════════════════════════════════════════════════════════
  // CORRECTION 10: FOOTER LEGAL — single continuous paragraph
  // ═══════════════════════════════════════════════════════════

  const rcProStr = input.artisan.rc_pro || 'N/A'
  const genDate = formatDate(new Date())
  const legalParagraph = [
    'Entrepreneur individuel (EI). Loi n\u00B02022-172 du 14 f\u00E9vrier 2022.',
    'TVA non applicable, article 293 B du CGI.',
    `RC Pro ${rcProStr}, couverture France m\u00E9tropolitaine.`,
    "Devis gratuit, conform\u00E9ment \u00E0 l'article L. 111-1 du Code de la consommation.",
    'Droit de r\u00E9tractation : 14 jours calendaires \u00E0 compter de la signature (art. L. 221-18 C. conso.).',
    'Aucun paiement exigible avant 7 jours apr\u00E8s signature (art. L. 221-10 C. conso.), sauf travaux urgents.',
    input.mediateur
      ? `M\u00E9diation de la consommation : ${input.mediateur}${input.mediateur_url ? ' \u2014 ' + input.mediateur_url : ''} (art. L. 612-1 C. conso.).`
      : 'M\u00E9diation de la consommation (art. L. 612-1 C. conso.).',
    `Document g\u00E9n\u00E9r\u00E9 par Vitfix Pro le ${genDate}.`,
  ].join(' ')

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
  const legalWrapped = pdf.splitTextToSize(legalParagraph, contentW - 10)
  pdf.text(legalWrapped, pageW / 2, y, { align: 'center' })

  // ═══════════════════════════════════════════════════════════
  // PAGE 2: DROIT DE RÉTRACTATION
  // ═══════════════════════════════════════════════════════════

  pdf.addPage()
  y = MARGIN

  // CORRECTION 11: Title left-aligned at MARGIN + subtitle
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(14)
  pdf.setTextColor('#000000')
  pdf.text('DROIT DE RÉTRACTATION', MARGIN, y)
  y += 5

  // Subtitle — smaller gray font, left-aligned
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(GRAY_LABEL)
  pdf.text('Article L. 221-18 du Code de la consommation', MARGIN, y)
  y += 4

  drawHLine(MARGIN, y, MARGIN + contentW, ACCENT, 0.7)
  y += 6

  // CORRECTION 12: Shorter, more readable retractation text
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor('#333333')

  const retractText = [
    "Le client dispose d'un d\u00E9lai de 14 jours calendaires \u00E0 compter de la signature du pr\u00E9sent devis pour exercer son droit de r\u00E9tractation, sans avoir \u00E0 justifier de motifs ni \u00E0 payer de p\u00E9nalit\u00E9s.",
    "",
    "Pour exercer ce droit, le client peut utiliser le formulaire ci-dessous ou adresser toute d\u00E9claration d\u00E9nu\u00E9e d'ambigu\u00EFt\u00E9 exprimant sa volont\u00E9 de se r\u00E9tracter.",
    "",
    "Aucun paiement ne peut \u00EAtre exig\u00E9 avant l'expiration d'un d\u00E9lai de 7 jours \u00E0 compter de la signature (art. L. 221-10 C. conso.), sauf travaux urgents demand\u00E9s express\u00E9ment par le client.",
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

  // Black banner — 8mm height, title LEFT-aligned
  pdf.setFillColor(...hexToRgb('#333333'))
  pdf.rect(MARGIN, y, contentW, 8, 'F')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.setTextColor('#FFFFFF')
  pdf.text('FORMULAIRE DE RÉTRACTATION', MARGIN + 4, y + 5.5)
  y += 14

  // "À l'attention de" with bold name+address
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor('#333333')
  pdf.text('\u00C0 l\u2019attention de : ', MARGIN + 4, y)
  const attnLabelW = pdf.getTextWidth('\u00C0 l\u2019attention de : ')
  pdf.setFont('helvetica', 'bold')
  pdf.text(`${input.artisan.nom}, ${input.artisan.adresse}`, MARGIN + 4 + attnLabelW, y)
  y += 10

  // Notification text
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor('#333333')
  const notifText = 'Je notifie par la pr\u00E9sente ma r\u00E9tractation du contrat portant sur la prestation de services ci-dessus.'
  const notifWrapped = pdf.splitTextToSize(notifText, contentW - 8)
  pdf.text(notifWrapped, MARGIN + 4, y)
  y += notifWrapped.length * 4 + 10

  // Simple fields with underlines — 28pt spacing between fields
  const formFieldsSimple = [
    'Command\u00E9 le / re\u00E7u le :    _________________________',
    'Nom du client :    _________________________',
    'Adresse :    _________________________',
  ]

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor('#333333')
  for (const field of formFieldsSimple) {
    pdf.text(field, MARGIN + 4, y)
    y += 10 // ~28pt spacing
  }

  y += 4
  pdf.text('Date : ___ / ___ / ______', MARGIN + 4, y)
  y += 12
  pdf.text('Signature :', MARGIN + 4, y)

  // ═══════════════════════════════════════════════════════════
  // PAGE NUMBERING — stamp "Page X/Y" on every page
  // ═══════════════════════════════════════════════════════════

  const totalPages = pdf.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(GRAY_LABEL)
    pdf.text(`Page ${i}/${totalPages}`, pageW - MARGIN, pageH - 5, { align: 'right' })
  }

  return pdf
}
