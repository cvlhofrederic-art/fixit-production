/**
 * Devis PDF Generator V2 — V5 corrections
 * Matches spec: SPEC_PDF_VITFIX_PRO.md + devis_lepore_logo_arbre.pdf reference
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

// ─── Colors — spec palette, 7 couleurs uniquement ────────────

const COLOR = {
  TEXT:       '#0D0D0D',
  TEXT_LIGHT: '#888888',
  WHITE:      '#FFFFFF',
  BG_GRAY:    '#F5F5F3',
  BORDER:     '#E0E0DC',
  ACCENT:     '#FFD600',
  BLACK:      '#0D0D0D',
}

// ─── Layout constants (mm) — from JSPDF_COORDINATES.js ───────

const ML = 18.0             // marge gauche
const MR = 18.0             // marge droite
const EM_W = 83.11          // largeur encadré émetteur
const DEST_X0 = 104.99      // x début encadré destinataire
const DEST_W = 86.99         // largeur encadré destinataire
const TEXT_X_EM = 21.88      // x texte émetteur (ML + padding 3.88)
const TEXT_X_DEST = 108.87   // x texte destinataire
const BOX_H_MIN = 47.27     // hauteur min encadrés (134pt) — FIX #2

// ─── Helpers ─────────────────────────────────────────────────

const ptToMm = (pt: number) => pt / 2.835

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
  return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)]
}

function formatUnitForPdf(unit: string): string {
  const MAP: Record<string, string> = { m2: 'm\u00B2', m3: 'm\u00B3', ml: 'ml', h: 'h', j: 'j', f: 'Forfait', u: 'u', L: 'L', kg: 'kg', t: 't', pce: 'pce', ens: 'ens', pt: 'pt', lot: 'Lot', m: 'm' }
  return MAP[unit] || unit
}

function cleanDescription(desc: string): string {
  return desc.replace(/\[unit:[^\]]*\]/gi, '').replace(/\[min:[^\]]*\]/gi, '').replace(/\[max:[^\]]*\]/gi, '').replace(/\s{2,}/g, ' ').trim()
}

/** Normalise une adresse ALL CAPS venant de l'API BAN en Title Case lisible */
function titleCaseAddress(addr: string): string {
  if (!addr) return addr
  if (addr !== addr.toUpperCase()) return addr
  const lowerWords = new Set(['de', 'du', 'des', 'le', 'la', 'les', 'l', 'en', 'et', 'au', 'aux', 'sur'])
  const abbrMap: Record<string, string> = {
    'RES': 'Rés.', 'RESIDENCE': 'Résidence', 'BAT': 'Bât.', 'BATIMENT': 'Bâtiment',
    'AV': 'Av.', 'AVENUE': 'Avenue', 'BD': 'Bd', 'BOULEVARD': 'Boulevard',
    'RUE': 'Rue', 'IMPASSE': 'Impasse', 'ALLEE': 'Allée', 'ALLÉE': 'Allée',
    'CHEMIN': 'Chemin', 'PLACE': 'Place', 'ROUTE': 'Route', 'COURS': 'Cours',
    'CEDEX': 'Cedex', 'ST': 'St', 'STE': 'Ste',
  }
  return addr.split(/(\s+|,\s*)/g).map((part, idx) => {
    const trimmed = part.trim()
    if (!trimmed || /^[\s,]+$/.test(part)) return part
    if (/^\d{5}$/.test(trimmed)) return trimmed
    if (abbrMap[trimmed]) return abbrMap[trimmed]
    const lower = trimmed.toLowerCase()
    if (idx > 0 && lowerWords.has(lower)) return lower
    return lower.charAt(0).toUpperCase() + lower.slice(1)
  }).join('')
}

/**
 * FIX #3: Sépare une adresse en {rue, ville} en extrayant le code postal.
 * "BATIMENT B RES L AURORE 13600 LA CIOTAT" → { rue: "Bât. B Rés. L'Aurore", ville: "13600 La Ciotat" }
 */
function splitAddress(addr: string): { rue: string; ville: string } | null {
  if (!addr) return null
  const norm = titleCaseAddress(addr)
  const match = norm.match(/^(.+?)\s*,?\s*(\d{5})\s+(.+)$/)
  if (match) {
    return { rue: match[1].replace(/,\s*$/, '').trim(), ville: `${match[2]} ${match[3].trim()}` }
  }
  // Pas de code postal trouvé — renvoyer tel quel
  return { rue: norm, ville: '' }
}

const SECTION_LABELS: Record<string, string> = {
  main_oeuvre: "MAIN D'OEUVRE",
  materiaux: 'MATÉRIAUX',
  deplacement: 'DÉPLACEMENT',
  location: 'LOCATION',
}

// ─── Main export ─────────────────────────────────────────────

export async function generateDevisPdfV2(input: DevisGeneratorInput) {
  const { jsPDF } = await import('jspdf')

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()   // 210
  const pageH = pdf.internal.pageSize.getHeight()   // 297
  const contentW = pageW - ML - MR                   // ~174mm
  const xRight = pageW - MR                          // 192mm
  let y = 0

  const boxPadX = ptToMm(11)           // ~3.88mm
  const boxPadTop = ptToMm(8)          // ~2.82mm

  // ── Helpers ──

  const drawHLine = (x1: number, yPos: number, x2: number, color = COLOR.BORDER, width = 0.18) => {
    pdf.setDrawColor(color); pdf.setLineWidth(width); pdf.line(x1, yPos, x2, yPos)
  }
  const drawVLine = (x: number, y1: number, y2: number, color = COLOR.BORDER, width = 0.18) => {
    pdf.setDrawColor(color); pdf.setLineWidth(width); pdf.line(x, y1, x, y2)
  }
  const checkPageBreak = (needed: number): boolean => {
    if (y + needed > pageH - 15) { pdf.addPage(); y = 18; return true }
    return false
  }

  // ═══════════════════════════════════════════════════════════
  // 1. LOGO (coin haut-gauche)
  // ═══════════════════════════════════════════════════════════

  if (input.artisan.logo_url) {
    try {
      const logoImg = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error('Logo load failed'))
        img.src = input.artisan.logo_url!
      })
      const canvasSize = 500
      const canvas = document.createElement('canvas')
      canvas.width = canvasSize; canvas.height = canvasSize
      const ctx = canvas.getContext('2d')
      if (ctx) {
        const ratio = logoImg.width / logoImg.height
        let drawW = canvasSize, drawH = canvasSize
        if (ratio > 1) { drawH = canvasSize / ratio } else { drawW = canvasSize * ratio }
        ctx.drawImage(logoImg, (canvasSize - drawW) / 2, (canvasSize - drawH) / 2, drawW, drawH)
        const logoSize = ptToMm(65)
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', ptToMm(15), ptToMm(8), logoSize, logoSize)
      }
    } catch (e) { console.warn('[PDF V2] Logo load failed:', e) }
  }

  // ═══════════════════════════════════════════════════════════
  // 2. TITRE + 3. NUMÉRO + 4. LIGNE D'ACCENT
  // ═══════════════════════════════════════════════════════════

  y = ptToMm(71)
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(16); pdf.setTextColor(COLOR.TEXT)
  pdf.text(input.devis.titre, pageW / 2, y, { align: 'center' })

  y += ptToMm(20)
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(COLOR.TEXT_LIGHT)
  pdf.text(input.devis.numero, pageW / 2, y, { align: 'center' })

  y += ptToMm(12)
  pdf.setFillColor(COLOR.ACCENT)
  pdf.rect(ML, y, contentW, ptToMm(3), 'F')
  y += ptToMm(3) + 5

  // ═══════════════════════════════════════════════════════════
  // 5. ENCADRÉS ÉMETTEUR & DESTINATAIRE — FIX #2 (H=134pt min)
  // ═══════════════════════════════════════════════════════════

  const boxStartY = y

  // FIX #2: Hauteur fixe minimum 47.27mm (134pt) comme dans le PDF de référence
  // On calcule la hauteur du contenu et on prend le max avec BOX_H_MIN
  let emContentH = boxPadTop + ptToMm(18) // label
  emContentH += ptToMm(14) // nom
  if (input.artisan.siret) emContentH += ptToMm(14)
  if (input.artisan.rm) emContentH += ptToMm(14)
  if (input.artisan.adresse) { emContentH += ptToMm(14); if (splitAddress(input.artisan.adresse)?.ville) emContentH += ptToMm(14) }
  if (input.artisan.telephone) emContentH += ptToMm(14)
  if (input.artisan.email) emContentH += ptToMm(14)
  emContentH += boxPadTop

  let destContentH = boxPadTop + ptToMm(18) + ptToMm(14) // label + nom
  if (input.client.adresse) { destContentH += ptToMm(14); if (splitAddress(input.client.adresse)?.ville) destContentH += ptToMm(14) }
  if (input.client.telephone) destContentH += ptToMm(14)
  if (input.client.email) destContentH += ptToMm(14)
  destContentH += boxPadTop

  const boxH = Math.max(emContentH, destContentH, BOX_H_MIN)

  // Dessiner les fonds D'ABORD — coordonnées exactes JSPDF_COORDINATES.js
  pdf.setFillColor(COLOR.BG_GRAY); pdf.setDrawColor(COLOR.BORDER); pdf.setLineWidth(0.18)
  pdf.rect(ML, boxStartY, EM_W, boxH, 'FD')
  pdf.rect(DEST_X0, boxStartY, DEST_W, boxH, 'FD')

  // ── Émetteur (texte par-dessus, UNE SEULE FOIS) ──
  let ey = boxStartY + boxPadTop
  pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR.TEXT_LIGHT)
  pdf.text('ÉMETTEUR', TEXT_X_EM, ey)
  ey += ptToMm(18)

  pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR.TEXT)
  pdf.text(input.artisan.nom, TEXT_X_EM, ey)
  ey += ptToMm(14)

  pdf.setFontSize(10); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR.TEXT)
  if (input.artisan.siret) { pdf.text(`SIRET : ${input.artisan.siret}`, TEXT_X_EM, ey); ey += ptToMm(14) }

  if (input.artisan.rm) {
    let rmRaw = input.artisan.rm.trim()
    if (!rmRaw.startsWith('RM ')) rmRaw = `RM ${rmRaw}`
    const rmDisplay = rmRaw.includes(' : ') ? rmRaw : rmRaw.replace(/^(RM\s+[A-Za-zÀ-ÿ\s-]+?)\s+(\d+)$/, '$1 : $2')
    pdf.text(rmDisplay, TEXT_X_EM, ey); ey += ptToMm(14)
  }

  // FIX #3: Adresse séparée en Adresse + Ville
  if (input.artisan.adresse) {
    const parts = splitAddress(input.artisan.adresse)
    if (parts) {
      const emMaxW = EM_W - boxPadX * 2
      // Ligne "Adresse : {rue}" — réduire police si trop long
      const rueText = `Adresse : ${parts.rue}`
      let fontSize = 10
      pdf.setFontSize(fontSize)
      if (pdf.getTextWidth(rueText) > emMaxW) { fontSize = 9; pdf.setFontSize(fontSize) }
      if (pdf.getTextWidth(rueText) > emMaxW) { fontSize = 8; pdf.setFontSize(fontSize) }
      pdf.text(rueText, TEXT_X_EM, ey)
      pdf.setFontSize(10)
      ey += ptToMm(14)
      // Ligne "Ville : {cp} {ville}" (si le split a trouvé un code postal)
      if (parts.ville) {
        pdf.text(`Ville : ${parts.ville}`, TEXT_X_EM, ey); ey += ptToMm(14)
      }
    }
  }

  if (input.artisan.telephone) { pdf.text(`Tél : ${input.artisan.telephone}`, TEXT_X_EM, ey); ey += ptToMm(14) }
  if (input.artisan.email) { pdf.text(`E-mail : ${input.artisan.email}`, TEXT_X_EM, ey); ey += ptToMm(14) }

  // ── Destinataire (texte par-dessus, UNE SEULE FOIS) ──
  let dy = boxStartY + boxPadTop
  pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR.TEXT_LIGHT)
  pdf.text('DESTINATAIRE', TEXT_X_DEST, dy)
  dy += ptToMm(18)

  pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR.TEXT)
  pdf.text(input.client.nom || '---', TEXT_X_DEST, dy)
  dy += ptToMm(14)

  pdf.setFontSize(10); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR.TEXT)

  // FIX #4: Même split Adresse/Ville côté destinataire
  if (input.client.adresse) {
    const parts = splitAddress(input.client.adresse)
    if (parts) {
      pdf.text(`Adresse : ${parts.rue}`, TEXT_X_DEST, dy); dy += ptToMm(14)
      if (parts.ville) { pdf.text(`Ville : ${parts.ville}`, TEXT_X_DEST, dy); dy += ptToMm(14) }
    }
  }

  if (input.client.telephone) { pdf.text(`Tél : ${input.client.telephone}`, TEXT_X_DEST, dy); dy += ptToMm(14) }
  if (input.client.email) { pdf.text(`E-mail : ${input.client.email}`, TEXT_X_DEST, dy); dy += ptToMm(14) }

  y = boxStartY + boxH + 4

  // ═══════════════════════════════════════════════════════════
  // 7. TABLEAU DES DATES (4 colonnes)
  // ═══════════════════════════════════════════════════════════

  const dateBoxH = ptToMm(49)
  const dateSepY = y + ptToMm(20)

  pdf.setFillColor(COLOR.BG_GRAY); pdf.setDrawColor(COLOR.BORDER); pdf.setLineWidth(0.18)
  pdf.rect(ML, y, contentW, dateBoxH, 'FD')

  const dateCols = [
    { label: "DATE D'ÉMISSION", value: formatDate(input.devis.date_emission) },
    { label: 'VALIDITÉ', value: `${input.devis.validite_jours} jours` },
    { label: "DÉLAI D'EXÉCUTION", value: input.devis.delai_execution || 'À convenir' },
    { label: 'DATE PRESTATION', value: input.devis.date_prestation ? formatDate(input.devis.date_prestation) : '—' },
  ]

  const dateVSeps = [60.52, 103.05, 147.51]
  const dateCenters = [(ML + dateVSeps[0]) / 2, (dateVSeps[0] + dateVSeps[1]) / 2, (dateVSeps[1] + dateVSeps[2]) / 2, (dateVSeps[2] + xRight) / 2]
  drawHLine(ML, dateSepY, xRight, COLOR.BORDER, 0.18)
  dateVSeps.forEach(x => drawVLine(x, y, y + dateBoxH, COLOR.BORDER, 0.18))

  dateCols.forEach((c, i) => {
    pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR.TEXT_LIGHT)
    pdf.text(c.label, dateCenters[i], y + ptToMm(14), { align: 'center' })
  })
  dateCols.forEach((c, i) => {
    pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR.TEXT)
    pdf.text(c.value, dateCenters[i], dateSepY + ptToMm(17), { align: 'center' })
  })

  y += dateBoxH + 4

  // ═══════════════════════════════════════════════════════════
  // ÉTAPES D'INTERVENTION (optionnel)
  // ═══════════════════════════════════════════════════════════

  if (input.etapes && input.etapes.length > 0) {
    const sorted = [...input.etapes].sort((a, b) => a.ordre - b.ordre).filter(e => e.designation.trim())
    if (sorted.length > 0) {
      checkPageBreak(15 + sorted.length * 5)
      pdf.setFillColor(COLOR.BG_GRAY)
      pdf.rect(ML, y, contentW, 8, 'F')
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.setTextColor(COLOR.TEXT)
      pdf.text("ÉTAPES DU CHANTIER", ML + 4, y + 5.5)
      y += 12
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(COLOR.TEXT)
      for (let i = 0; i < sorted.length; i++) {
        pdf.setFillColor(i % 2 === 0 ? COLOR.WHITE : COLOR.BG_GRAY)
        pdf.rect(ML, y - 3, contentW, 5.5, 'F')
        pdf.setTextColor(COLOR.TEXT)
        pdf.text(`${i + 1}. ${sorted[i].designation}`, ML + 6, y)
        y += 5.5
        if (y > pageH - 40) { pdf.addPage(); y = 20 }
      }
      y += 4
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 8. TABLEAU PRESTATIONS — FIX #1 (pas de doublon) + FIX #5 (alternance)
  // ═══════════════════════════════════════════════════════════

  const tColWidths = { designation: contentW * 0.50 }
  const headerH = ptToMm(29)
  const minRowH = ptToMm(32)

  const drawTableHeader = () => {
    pdf.setFillColor(COLOR.BLACK)
    pdf.rect(ML, y, contentW, headerH, 'F')
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor(COLOR.WHITE)
    const hTextY = y + headerH / 2 + 1
    pdf.text('DÉSIGNATION', 21.16, hTextY)
    pdf.text('QTÉ', 121.92, hTextY, { align: 'center' })
    pdf.text('UNITÉ', 135.41, hTextY, { align: 'center' })
    pdf.text('PRIX U. TTC', 162.26, hTextY, { align: 'right' })
    pdf.text('TOTAL TTC', 188.71, hTextY, { align: 'right' })
    y += headerH
    drawHLine(ML, y, ML + contentW, COLOR.ACCENT, 0.7)
  }

  // FIX #1: Chaque texte rendu UNE SEULE FOIS, pas de boucle double
  const drawRow = (line: LigneDevis, rowIdx: number) => {
    const cleaned = cleanDescription(line.designation)
    const nlParts = cleaned.split('\n')
    const title = nlParts[0]
    const detail = nlParts.slice(1).join('\n').trim()

    // Mesurer les hauteurs nécessaires
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10)
    const titleWrapped = pdf.splitTextToSize(title, tColWidths.designation - 6)
    let descWrapped: string[] = []
    if (detail) {
      pdf.setFontSize(8)
      descWrapped = pdf.splitTextToSize(detail, tColWidths.designation - 6)
    }
    const textH = titleWrapped.length * ptToMm(14) + descWrapped.length * ptToMm(12) + 4
    const rowH = Math.max(minRowH, textH)

    if (y + rowH > pageH - 25) { pdf.addPage(); y = 18; drawTableHeader() }

    // FIX #5: Alternance fond WHITE/BG_GRAY
    pdf.setFillColor(rowIdx % 2 === 0 ? COLOR.WHITE : COLOR.BG_GRAY)
    pdf.rect(ML, y, contentW, rowH, 'F')

    // Titre (10pt TEXT) — UNE SEULE FOIS
    let textY = y + 5
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); pdf.setTextColor(COLOR.TEXT)
    for (let i = 0; i < titleWrapped.length; i++) {
      pdf.text(titleWrapped[i], ML + 3, textY)
      textY += ptToMm(14)
    }

    // Description (8pt TEXT_LIGHT) — UNE SEULE FOIS
    if (descWrapped.length > 0) {
      pdf.setFontSize(8); pdf.setTextColor(COLOR.TEXT_LIGHT)
      for (let i = 0; i < descWrapped.length; i++) {
        pdf.text(descWrapped[i], ML + 3, textY)
        textY += ptToMm(12)
      }
    }

    // Données numériques (centrées verticalement)
    const numY = y + rowH / 2 + 1
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); pdf.setTextColor(COLOR.TEXT)
    pdf.text(String(line.quantite), 121.92, numY, { align: 'center' })
    pdf.text(formatUnitForPdf(line.unite), 135.41, numY, { align: 'center' })
    pdf.text(formatPrice(line.prix_unitaire), 162.26, numY, { align: 'right' })
    pdf.setFont('helvetica', 'bold')
    pdf.text(formatPrice(line.total), 188.71, numY, { align: 'right' })

    // Bordure bas
    pdf.setDrawColor(COLOR.BORDER); pdf.setLineWidth(0.18)
    pdf.line(ML, y + rowH, ML + contentW, y + rowH)
    y += rowH
  }

  if (input.mode_affichage === 'bloc') {
    drawTableHeader()
    input.lignes.forEach((line, idx) => drawRow(line, idx))
  } else {
    const grouped: Record<string, LigneDevis[]> = {}
    for (const line of input.lignes) { const k = line.section || 'autres'; if (!grouped[k]) grouped[k] = []; grouped[k].push(line) }
    for (const [section, lines] of Object.entries(grouped)) {
      checkPageBreak(headerH + minRowH * lines.length + 12)
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.setTextColor(COLOR.TEXT)
      pdf.text(SECTION_LABELS[section] || section.toUpperCase(), ML, y + 4)
      y += 7
      drawTableHeader()
      let st = 0
      lines.forEach((l, i) => { drawRow(l, i); st += l.total })
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor(COLOR.TEXT)
      pdf.text(`Sous-total : ${formatPrice(st)}`, ML + contentW - 3, y + 4, { align: 'right' })
      y += 8
    }
  }

  // ═══════════════════════════════════════════════════════════
  // SOUS-TOTAL + TVA — FIX #6 (bordure FD)
  // ═══════════════════════════════════════════════════════════

  const totalNet = input.lignes.reduce((sum, l) => sum + l.total, 0)
  const stH = ptToMm(27)

  // FIX #6: 'FD' = fond gris + bordure (pas juste fond)
  pdf.setFillColor(COLOR.BG_GRAY); pdf.setDrawColor(COLOR.BORDER); pdf.setLineWidth(0.18)
  pdf.rect(ML, y, contentW, stH, 'FD')

  pdf.setFontSize(7.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR.TEXT_LIGHT)
  pdf.text(input.artisan.tva_mention, 21.16, y + stH / 2 + 1)
  pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR.TEXT)
  pdf.text('Sous-total', 148.15, y + stH / 2 + 1)
  pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR.TEXT)
  pdf.text(formatPrice(totalNet), 188.71, y + stH / 2 + 1, { align: 'right' })
  y += stH

  // ═══════════════════════════════════════════════════════════
  // 9. BLOC TOTAL NET (moitié droite)
  // ═══════════════════════════════════════════════════════════

  drawHLine(ML + 2, y + 1, xRight - 2, COLOR.TEXT, 0.4)
  y += 3
  const totH = ptToMm(27)
  pdf.setFillColor(COLOR.BG_GRAY)
  pdf.rect(DEST_X0, y, DEST_W, totH, 'F')
  pdf.setFontSize(12); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR.TEXT)
  pdf.text('TOTAL NET', DEST_X0 + boxPadX, y + totH / 2 + 1.5)
  pdf.text(formatPrice(totalNet), DEST_X0 + DEST_W - boxPadX, y + totH / 2 + 1.5, { align: 'right' })
  y += totH + 4

  // ═══════════════════════════════════════════════════════════
  // 10. ACOMPTES (optionnel)
  // ═══════════════════════════════════════════════════════════

  if (input.acomptes && input.acomptes.length > 0) {
    pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR.TEXT)
    for (const ac of input.acomptes) {
      pdf.text(`${ac.label} : ${ac.declencheur} = ${formatPrice(ac.montant)}`, DEST_X0 + boxPadX, y)
      y += ptToMm(13)
    }
    y += 2
  }

  // ═══════════════════════════════════════════════════════════
  // 11. CONDITIONS + 12. BON POUR ACCORD — FIX #7 (bordure droite+bas)
  // ═══════════════════════════════════════════════════════════

  checkPageBreak(55)
  const condStartY = y

  // CONDITIONS (fond blanc, pas de bordure)
  pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR.TEXT)
  pdf.text('CONDITIONS', ML, condStartY + 4)
  let cy = condStartY + 10

  pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR.TEXT)
  const condLines = [
    `Validité du devis : ${input.devis.validite_jours} jours à compter de la date d'émission.`,
    `Délai d'exécution : ${input.devis.delai_execution || 'À convenir'}.`,
    "Toute modification fera l'objet d'un avenant signé par les deux parties.",
    `Mode de règlement : ${input.artisan.mode_paiement}.`,
  ]
  condLines.forEach(line => {
    const wrapped = pdf.splitTextToSize(line, EM_W - 4)
    pdf.text(wrapped, ML, cy)
    cy += wrapped.length * ptToMm(13)
  })

  if (input.notes && input.notes.trim()) {
    cy += 2
    pdf.setFont('helvetica', 'italic'); pdf.setFontSize(9); pdf.setTextColor(COLOR.TEXT)
    const noteWrapped = pdf.splitTextToSize(input.notes.trim(), EM_W - 4)
    pdf.text(noteWrapped, ML, cy)
    cy += noteWrapped.length * ptToMm(13)
  }

  // BON POUR ACCORD — FIX #7: fond gris + bordure DROITE et BAS uniquement
  const sigH = Math.max(cy - condStartY, 46)
  // Fond gris (sans bordure complète)
  pdf.setFillColor(COLOR.BG_GRAY)
  pdf.rect(DEST_X0, condStartY, DEST_W, sigH, 'F')
  // Bordure droite uniquement
  pdf.setDrawColor(COLOR.BORDER); pdf.setLineWidth(0.18)
  pdf.line(DEST_X0 + DEST_W, condStartY, DEST_X0 + DEST_W, condStartY + sigH) // droite
  pdf.line(DEST_X0, condStartY + sigH, DEST_X0 + DEST_W, condStartY + sigH)   // bas

  pdf.setFontSize(9.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR.TEXT)
  pdf.text('BON POUR ACCORD', DEST_X0 + boxPadX, condStartY + 5)

  let sy = condStartY + 12
  pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR.TEXT)

  if (input.signature) {
    try {
      pdf.addImage(input.signature.image_base64, 'PNG', DEST_X0 + boxPadX, sy, DEST_W - boxPadX * 2 - 10, 18)
      sy += 20
      pdf.setFontSize(7); pdf.setFont('helvetica', 'bold')
      pdf.text(input.signature.signe_par, DEST_X0 + boxPadX, sy)
      pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR.TEXT_LIGHT)
      pdf.text(formatDate(input.signature.signe_le), DEST_X0 + boxPadX, sy + 3)
    } catch { pdf.text(input.signature.signe_par, DEST_X0 + boxPadX, sy) }
  } else {
    const appWrapped = pdf.splitTextToSize('Devis reçu avant exécution des travaux, lu et approuvé, bon pour accord.', DEST_W - boxPadX * 2)
    pdf.text(appWrapped, DEST_X0 + boxPadX, sy)
    sy += appWrapped.length * ptToMm(13) + 4
    pdf.text('Date : ___ / ___ / ______', DEST_X0 + boxPadX, sy)
    sy += ptToMm(18)
    pdf.text('Signature :', DEST_X0 + boxPadX, sy)
  }

  y = condStartY + sigH + 6

  // ═══════════════════════════════════════════════════════════
  // 13. MENTIONS LÉGALES (bas de page 1)
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

  const legalY = pageH - 18
  if (y < legalY - 2) {
    drawHLine(ML, legalY, xRight, COLOR.BORDER, 0.18)
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6.5); pdf.setTextColor(COLOR.TEXT_LIGHT)
    pdf.text(pdf.splitTextToSize(legalParagraph, contentW), ML, legalY + 3)
  } else {
    y += 4
    drawHLine(ML, y, xRight, COLOR.BORDER, 0.18); y += 3
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6.5); pdf.setTextColor(COLOR.TEXT_LIGHT)
    const lw = pdf.splitTextToSize(legalParagraph, contentW)
    pdf.text(lw, ML, y); y += lw.length * ptToMm(10)
  }

  // ═══════════════════════════════════════════════════════════
  // PAGE 2: DROIT DE RÉTRACTATION
  // ═══════════════════════════════════════════════════════════

  pdf.addPage()
  let ry = 8
  pdf.setFillColor(COLOR.ACCENT); pdf.rect(ML, ry, contentW, ptToMm(3), 'F')
  ry += ptToMm(3) + 8

  pdf.setFontSize(12); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR.TEXT)
  pdf.text('DROIT DE RÉTRACTATION', ML, ry); ry += 5
  pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR.TEXT)
  pdf.text('Article L. 221-18 du Code de la consommation', ML, ry); ry += 8

  pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR.TEXT)
  const retTexts = [
    "Le client dispose d'un délai de 14 jours calendaires à compter de la signature du présent devis pour exercer son droit de rétractation, sans avoir à justifier de motifs ni à payer de pénalités.",
    "Pour exercer ce droit, le client peut utiliser le formulaire ci-dessous ou adresser toute déclaration dénuée d'ambiguïté exprimant sa volonté de se rétracter.",
    "Aucun paiement ne peut être exigé avant l'expiration d'un délai de 7 jours à compter de la signature (art. L. 221-10 C. conso.), sauf travaux urgents demandés expressément par le client.",
  ]
  retTexts.forEach(txt => {
    const w = pdf.splitTextToSize(txt, contentW)
    pdf.text(w, ML, ry); ry += w.length * ptToMm(13) + 4
  })
  ry += 4

  // Formulaire rétractation
  pdf.setFillColor(COLOR.TEXT); pdf.rect(ML, ry, contentW, 8, 'F')
  pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR.WHITE)
  pdf.text('FORMULAIRE DE RÉTRACTATION', ML + boxPadX, ry + 5.5)
  ry += 12

  pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR.TEXT)
  const formAttn = `À l'attention de : `
  pdf.text(formAttn, ML + boxPadX, ry)
  const atW = pdf.getTextWidth(formAttn)
  pdf.setFont('helvetica', 'bold')
  // Utiliser l'adresse normalisée pour le formulaire aussi
  const artAddr = titleCaseAddress(input.artisan.adresse)
  pdf.text(`${input.artisan.nom}, ${artAddr}`, ML + boxPadX + atW, ry)
  ry += 6

  pdf.setFont('helvetica', 'normal')
  pdf.text('Je notifie par la présente ma rétractation du contrat portant sur la prestation de services ci-dessus.', ML + boxPadX, ry)
  ry += 8

  for (const f of ['Commandé le / reçu le :', 'Nom du client :', 'Adresse :', 'Date : ___ / ___ / ______', 'Signature :']) {
    pdf.text(f, ML + boxPadX, ry)
    if (!f.startsWith('Date') && !f.startsWith('Signature')) {
      const fw = pdf.getTextWidth(f) + 2
      pdf.setDrawColor(COLOR.BORDER); pdf.setLineWidth(0.2)
      pdf.line(ML + boxPadX + fw, ry + 0.5, xRight - boxPadX, ry + 0.5)
    }
    ry += 8
  }

  // ═══════════════════════════════════════════════════════════
  // PAGINATION
  // ═══════════════════════════════════════════════════════════

  const totalPages = pdf.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i)
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(COLOR.TEXT_LIGHT)
    pdf.text(`Page ${i}/${totalPages}`, xRight - 2, pageH - 3.2, { align: 'right' })
  }

  return pdf
}
