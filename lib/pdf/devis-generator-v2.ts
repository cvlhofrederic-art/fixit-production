/**
 * Devis PDF Generator V2
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

// ─── Layout constants (mm) ───────────────────────────────────

const ML = 18.0            // marge gauche
const MR = 18.0            // marge droite

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
  return desc.replace(/\[unit:[^\]]*\]/gi, '').replace(/\[min:[^\]]*\]/gi, '').replace(/\[max:[^\]]*\]/gi, '').replace(/\s{2,}/g, ' ').trim()
}

/** Normalise une adresse ALL CAPS venant de l'API BAN en Title Case lisible */
function titleCaseAddress(addr: string): string {
  if (!addr) return addr
  // Si déjà en casse mixte (contient des minuscules), ne pas toucher
  if (addr !== addr.toUpperCase()) return addr
  // Mots à garder en minuscules (sauf en début)
  const lowerWords = new Set(['de', 'du', 'des', 'le', 'la', 'les', 'l', 'en', 'et', 'au', 'aux', 'sur'])
  // Abréviations courantes
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
    // Code postal = garder tel quel
    if (/^\d{5}$/.test(trimmed)) return trimmed
    // Abréviation connue
    if (abbrMap[trimmed]) return abbrMap[trimmed]
    // Mot court = minuscule (sauf premier mot)
    const lower = trimmed.toLowerCase()
    if (idx > 0 && lowerWords.has(lower)) return lower
    // Title case standard
    return lower.charAt(0).toUpperCase() + lower.slice(1)
  }).join('')
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

  // Box dimensions (spec values converted to mm)
  const gapBoxes = ptToMm(11)          // ~3.88mm
  const emBoxW = ptToMm(235.62)        // ~83.1mm
  const destBoxW = contentW - emBoxW - gapBoxes
  const boxPadX = ptToMm(11)           // ~3.88mm
  const boxPadTop = ptToMm(8)          // ~2.82mm

  // ── Helpers bound to this pdf instance ──

  const drawHLine = (x1: number, yPos: number, x2: number, color = COLOR.BORDER, width = 0.18) => {
    pdf.setDrawColor(color)
    pdf.setLineWidth(width)
    pdf.line(x1, yPos, x2, yPos)
  }

  const drawVLine = (x: number, y1: number, y2: number, color = COLOR.BORDER, width = 0.18) => {
    pdf.setDrawColor(color)
    pdf.setLineWidth(width)
    pdf.line(x, y1, x, y2)
  }

  const checkPageBreak = (needed: number): boolean => {
    if (y + needed > pageH - 15) {
      pdf.addPage()
      y = 18
      return true
    }
    return false
  }

  // ═══════════════════════════════════════════════════════════
  // 1. LOGO (coin haut-gauche)
  // ═══════════════════════════════════════════════════════════

  if (input.artisan.logo_url) {
    try {
      // Utiliser Image + canvas (même approche que V3) pour éviter CORS Supabase
      const logoImg = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error('Logo load failed'))
        img.src = input.artisan.logo_url!
      })
      const canvas = document.createElement('canvas')
      const maxPx = 500
      const ratio = logoImg.width / logoImg.height
      canvas.width = Math.min(logoImg.width, maxPx)
      canvas.height = Math.round(canvas.width / ratio)
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(logoImg, 0, 0, canvas.width, canvas.height)
        const logoData = canvas.toDataURL('image/png')
        // Spec: x=15pt, y=8pt, max 65×65pt — garder proportions
        const logoMaxW = ptToMm(65)  // ~22.9mm
        const logoMaxH = ptToMm(65)
        let lw = logoMaxW, lh = logoMaxH
        if (ratio > 1) { lh = lw / ratio } else { lw = lh * ratio }
        pdf.addImage(logoData, 'PNG', ptToMm(15), ptToMm(8), lw, lh)
      }
    } catch (e) {
      console.warn('[PDF V2] Logo load failed:', e)
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 2. TITRE DOCUMENT (centré)
  // ═══════════════════════════════════════════════════════════

  y = ptToMm(71)  // ~25mm — spec: y ≈ 71pt
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(16)
  pdf.setTextColor(COLOR.TEXT)
  pdf.text(input.devis.titre, pageW / 2, y, { align: 'center' })

  // ═══════════════════════════════════════════════════════════
  // 3. NUMÉRO DE DOCUMENT
  // ═══════════════════════════════════════════════════════════

  y += ptToMm(20)  // spec: titre + 20pt
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(COLOR.TEXT_LIGHT)
  pdf.text(input.devis.numero, pageW / 2, y, { align: 'center' })

  // ═══════════════════════════════════════════════════════════
  // 4. LIGNE D'ACCENT
  // ═══════════════════════════════════════════════════════════

  y += ptToMm(12)  // spec: numéro + 12pt
  pdf.setFillColor(COLOR.ACCENT)
  pdf.rect(ML, y, contentW, ptToMm(3), 'F')
  y += ptToMm(3) + 5

  // ═══════════════════════════════════════════════════════════
  // 5. ENCADRÉS ÉMETTEUR & DESTINATAIRE
  // ═══════════════════════════════════════════════════════════

  const boxX_em = ML
  const boxX_dest = ML + emBoxW + gapBoxes
  const boxStartY = y

  // --- Mesurer la hauteur nécessaire pour chaque box ---

  // Émetteur content height
  const emTx = boxX_em + boxPadX
  const emMaxW = emBoxW - boxPadX * 2
  let ey = boxStartY + boxPadTop

  // Label
  ey += ptToMm(18)  // après le label ÉMETTEUR
  // Nom
  ey += ptToMm(14)
  // Lignes info
  if (input.artisan.siret) ey += ptToMm(14)
  if (input.artisan.rm) ey += ptToMm(14)
  if (input.artisan.adresse) {
    ey += ptToMm(14)  // une seule ligne, pas de wrap
  }
  if (input.artisan.telephone) ey += ptToMm(14)
  if (input.artisan.email) ey += ptToMm(14)

  // Destinataire content height
  const destTx = boxX_dest + boxPadX
  const destMaxW = destBoxW - boxPadX * 2
  let dy = boxStartY + boxPadTop

  dy += ptToMm(18)  // après le label DESTINATAIRE
  dy += ptToMm(14)  // Nom
  if (input.client.adresse) {
    pdf.setFontSize(10); pdf.setFont('helvetica', 'normal')
    const cAddrLines = pdf.splitTextToSize(`Adresse : ${input.client.adresse}`, destMaxW)
    dy += cAddrLines.length * ptToMm(14)
  }
  if (input.client.telephone) dy += ptToMm(14)
  if (input.client.email) dy += ptToMm(14)

  const boxH = Math.max(ey, dy) - boxStartY + boxPadTop

  // --- Dessiner les fonds D'ABORD ---
  pdf.setFillColor(COLOR.BG_GRAY)
  pdf.setDrawColor(COLOR.BORDER)
  pdf.setLineWidth(0.18)
  pdf.rect(boxX_em, boxStartY, emBoxW, boxH, 'FD')
  pdf.rect(boxX_dest, boxStartY, destBoxW, boxH, 'FD')

  // --- Puis dessiner le texte PAR-DESSUS ---

  // ── Émetteur ──
  let ey2 = boxStartY + boxPadTop
  pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR.TEXT_LIGHT)
  pdf.text('ÉMETTEUR', emTx, ey2)
  ey2 += ptToMm(18)

  pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR.TEXT)
  pdf.text(input.artisan.nom, emTx, ey2)
  ey2 += ptToMm(14)

  pdf.setFontSize(10); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR.TEXT)
  if (input.artisan.siret) {
    pdf.text(`SIRET : ${input.artisan.siret}`, emTx, ey2)
    ey2 += ptToMm(14)
  }
  if (input.artisan.rm) {
    // Données Supabase: "RM Marseille 953951589" ou "Marseille 953951589" ou "953951589"
    let rmRaw = input.artisan.rm.trim()
    // Ne pas doubler le préfixe RM
    if (!rmRaw.startsWith('RM ')) rmRaw = `RM ${rmRaw}`
    // Insérer " : " entre le label (RM Ville) et le numéro
    // Pattern: "RM Marseille 953951589" → "RM Marseille : 953951589"
    const rmDisplay = rmRaw.includes(' : ')
      ? rmRaw
      : rmRaw.replace(/^(RM\s+[A-Za-zÀ-ÿ\s-]+?)\s+(\d+)$/, '$1 : $2')
    pdf.text(rmDisplay, emTx, ey2)
    ey2 += ptToMm(14)
  }
  if (input.artisan.adresse) {
    // Normaliser ALL CAPS + jamais sur 2 lignes (réduire police si trop long)
    const addrNorm = titleCaseAddress(input.artisan.adresse)
    const addrText = `Adresse : ${addrNorm}`
    let addrFontSize = 10
    pdf.setFontSize(addrFontSize)
    if (pdf.getTextWidth(addrText) > emMaxW) { addrFontSize = 9; pdf.setFontSize(addrFontSize) }
    if (pdf.getTextWidth(addrText) > emMaxW) { addrFontSize = 8; pdf.setFontSize(addrFontSize) }
    pdf.text(addrText, emTx, ey2)
    pdf.setFontSize(10) // reset
    ey2 += ptToMm(14)
  }
  if (input.artisan.telephone) {
    pdf.text(`Tél : ${input.artisan.telephone}`, emTx, ey2)
    ey2 += ptToMm(14)
  }
  if (input.artisan.email) {
    pdf.text(`E-mail : ${input.artisan.email}`, emTx, ey2)
    ey2 += ptToMm(14)
  }

  // ── Destinataire ──
  let dy2 = boxStartY + boxPadTop
  pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR.TEXT_LIGHT)
  pdf.text('DESTINATAIRE', destTx, dy2)
  dy2 += ptToMm(18)

  pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR.TEXT)
  pdf.text(input.client.nom || '---', destTx, dy2)
  dy2 += ptToMm(14)

  pdf.setFontSize(10); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR.TEXT)
  if (input.client.adresse) {
    const cAddrLines = pdf.splitTextToSize(`Adresse : ${input.client.adresse}`, destMaxW)
    pdf.text(cAddrLines, destTx, dy2)
    dy2 += cAddrLines.length * ptToMm(14)
  }
  if (input.client.telephone) {
    pdf.text(`Tél : ${input.client.telephone}`, destTx, dy2)
    dy2 += ptToMm(14)
  }
  if (input.client.email) {
    pdf.text(`E-mail : ${input.client.email}`, destTx, dy2)
    dy2 += ptToMm(14)
  }

  y = boxStartY + boxH + 4

  // ═══════════════════════════════════════════════════════════
  // 7. TABLEAU DES DATES (4 colonnes)
  // ═══════════════════════════════════════════════════════════

  const dateBoxH = ptToMm(49)  // ~17.3mm
  const dateSepY = y + ptToMm(20)

  pdf.setFillColor(COLOR.BG_GRAY)
  pdf.setDrawColor(COLOR.BORDER)
  pdf.setLineWidth(0.18)
  pdf.rect(ML, y, contentW, dateBoxH, 'FD')

  const dateCols = [
    { label: "DATE D'ÉMISSION", value: formatDate(input.devis.date_emission) },
    { label: 'VALIDITÉ', value: `${input.devis.validite_jours} jours` },
    { label: "DÉLAI D'EXÉCUTION", value: input.devis.delai_execution },
    { label: 'DATE PRESTATION', value: input.devis.date_prestation ? formatDate(input.devis.date_prestation) : '—' },
  ]

  // Séparateurs verticaux — coordonnées exactes du PDF de référence
  const dateVSeps = [60.52, 103.05, 147.51]
  // Centres de chaque colonne (milieu entre séparateurs)
  const dateCenters = [
    (ML + dateVSeps[0]) / 2,                   // ~39.26
    (dateVSeps[0] + dateVSeps[1]) / 2,         // ~81.78
    (dateVSeps[1] + dateVSeps[2]) / 2,         // ~125.28
    (dateVSeps[2] + xRight) / 2,               // ~169.74
  ]
  // Séparateur horizontal
  drawHLine(ML, dateSepY, xRight, COLOR.BORDER, 0.18)
  // Séparateurs verticaux
  dateVSeps.forEach(x => drawVLine(x, y, y + dateBoxH, COLOR.BORDER, 0.18))

  // Labels (ligne du haut)
  dateCols.forEach((c, i) => {
    pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR.TEXT_LIGHT)
    pdf.text(c.label, dateCenters[i], y + ptToMm(14), { align: 'center' })
  })
  // Valeurs (ligne du bas, bold)
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
        const bgColor = i % 2 === 0 ? COLOR.WHITE : COLOR.BG_GRAY
        pdf.setFillColor(bgColor)
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
  // 8. TABLEAU PRESTATIONS (manual drawing, pas autoTable)
  // ═══════════════════════════════════════════════════════════

  const tColWidths = {
    designation: contentW * 0.50,
    quantite: contentW * 0.08,
    unite: contentW * 0.08,
    prixUnit: contentW * 0.16,
    total: contentW * 0.18,
  }
  const headerH = ptToMm(29)  // ~10.2mm
  const minRowH = ptToMm(32)  // ~11.3mm

  const drawTableHeader = () => {
    // Bandeau noir plein
    pdf.setFillColor(COLOR.BLACK)
    pdf.rect(ML, y, contentW, headerH, 'F')
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor(COLOR.WHITE)

    // Coordonnées exactes du PDF de référence (JSPDF_COORDINATES.js)
    const hTextY = y + headerH / 2 + 1
    pdf.text('DÉSIGNATION', 21.16, hTextY)          // ~ML+3.16
    pdf.text('QTÉ', 121.92, hTextY, { align: 'center' })
    pdf.text('UNITÉ', 135.41, hTextY, { align: 'center' })
    pdf.text('PRIX U. TTC', 162.26, hTextY, { align: 'right' })
    pdf.text('TOTAL TTC', 188.71, hTextY, { align: 'right' })

    y += headerH
    // Ligne d'accent or sous le header (visible dans le PDF de référence)
    drawHLine(ML, y, ML + contentW, COLOR.ACCENT, 0.7)
  }

  const drawRow = (line: LigneDevis, rowIdx: number) => {
    const cleaned = cleanDescription(line.designation)
    // Séparer titre et description (si multilignes)
    const parts = cleaned.split('\n')
    const title = parts[0]
    const detail = parts.slice(1).join('\n').trim()

    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10)
    const titleLines = pdf.splitTextToSize(title, tColWidths.designation - 6)
    let descLines: string[] = []
    if (detail) {
      pdf.setFontSize(8)
      descLines = pdf.splitTextToSize(detail, tColWidths.designation - 6)
    }
    const textBlockH = titleLines.length * ptToMm(14) + descLines.length * ptToMm(12) + 4
    const actualRowH = Math.max(minRowH, textBlockH)

    if (y + actualRowH > pageH - 25) {
      pdf.addPage(); y = 18
      drawTableHeader()
    }

    // Fond alterné
    if (rowIdx % 2 === 1) {
      pdf.setFillColor(COLOR.BG_GRAY)
      pdf.rect(ML, y, contentW, actualRowH, 'F')
    }

    // Titre de la prestation (10pt TEXT)
    let textY = y + 5
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); pdf.setTextColor(COLOR.TEXT)
    pdf.text(titleLines, ML + 3, textY)
    textY += titleLines.length * ptToMm(14)

    // Description (8pt TEXT_LIGHT)
    if (descLines.length > 0) {
      pdf.setFontSize(8); pdf.setTextColor(COLOR.TEXT_LIGHT)
      pdf.text(descLines, ML + 3, textY)
    }

    // Données numériques — mêmes x que les headers (JSPDF_COORDINATES.js)
    const numY = y + actualRowH / 2 + 1
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); pdf.setTextColor(COLOR.TEXT)

    pdf.text(String(line.quantite), 121.92, numY, { align: 'center' })
    pdf.text(formatUnitForPdf(line.unite), 135.41, numY, { align: 'center' })
    pdf.text(formatPrice(line.prix_unitaire), 162.26, numY, { align: 'right' })

    // Total en bold
    pdf.setFont('helvetica', 'bold')
    pdf.text(formatPrice(line.total), 188.71, numY, { align: 'right' })

    // Bordure bas
    pdf.setDrawColor(COLOR.BORDER); pdf.setLineWidth(0.18)
    pdf.line(ML, y + actualRowH, ML + contentW, y + actualRowH)

    y += actualRowH
  }

  if (input.mode_affichage === 'bloc') {
    drawTableHeader()
    input.lignes.forEach((line, idx) => drawRow(line, idx))
  } else {
    const grouped: Record<string, LigneDevis[]> = {}
    for (const line of input.lignes) {
      const key = line.section || 'autres'
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(line)
    }
    for (const [section, lines] of Object.entries(grouped)) {
      checkPageBreak(headerH + minRowH * lines.length + 12)
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.setTextColor(COLOR.TEXT)
      pdf.text(SECTION_LABELS[section] || section.toUpperCase(), ML, y + 4)
      y += 7
      drawTableHeader()
      let sectionTotal = 0
      lines.forEach((line, idx) => { drawRow(line, idx); sectionTotal += line.total })
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor(COLOR.TEXT)
      pdf.text(`Sous-total : ${formatPrice(sectionTotal)}`, ML + contentW - 3, y + 4, { align: 'right' })
      y += 8
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 7. SOUS-TOTAL + TVA (fond gris, pleine largeur)
  // ═══════════════════════════════════════════════════════════

  const totalNet = input.lignes.reduce((sum, l) => sum + l.total, 0)
  const stH = ptToMm(27)

  pdf.setFillColor(COLOR.BG_GRAY)
  pdf.setDrawColor(COLOR.BORDER)
  pdf.setLineWidth(0.18)
  pdf.rect(ML, y, contentW, stH, 'FD')

  // Mention TVA (gauche) — coord ref: x=21.16
  pdf.setFontSize(7.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR.TEXT_LIGHT)
  pdf.text(input.artisan.tva_mention, 21.16, y + stH / 2 + 1)

  // Sous-total (droite) — coord ref: label x=148.15, montant x=188.71
  pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR.TEXT)
  pdf.text('Sous-total', 148.15, y + stH / 2 + 1)
  pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR.TEXT)
  pdf.text(formatPrice(totalNet), 188.71, y + stH / 2 + 1, { align: 'right' })

  y += stH

  // ═══════════════════════════════════════════════════════════
  // 9. BLOC TOTAL NET (moitié droite)
  // ═══════════════════════════════════════════════════════════

  // Trait séparateur noir au-dessus
  drawHLine(ML + 2, y + 1, xRight - 2, COLOR.TEXT, 0.4)
  y += 3

  const totBoxX = boxX_dest
  const totBoxW = destBoxW
  const totH = ptToMm(27)

  pdf.setFillColor(COLOR.BG_GRAY)
  pdf.rect(totBoxX, y, totBoxW, totH, 'F')
  pdf.setFontSize(12); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR.TEXT)
  pdf.text('TOTAL NET', totBoxX + boxPadX, y + totH / 2 + 1.5)
  pdf.text(formatPrice(totalNet), totBoxX + totBoxW - boxPadX, y + totH / 2 + 1.5, { align: 'right' })

  y += totH + 4

  // ═══════════════════════════════════════════════════════════
  // 10. ACOMPTES (optionnel — côté droit, texte simple)
  // ═══════════════════════════════════════════════════════════

  if (input.acomptes && input.acomptes.length > 0) {
    pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR.TEXT)
    for (const ac of input.acomptes) {
      pdf.text(`${ac.label} : ${ac.declencheur} = ${formatPrice(ac.montant)}`, totBoxX + boxPadX, y)
      y += ptToMm(13)
    }
    y += 2
  }

  // ═══════════════════════════════════════════════════════════
  // 11. CONDITIONS (gauche) + 12. BON POUR ACCORD (droite)
  // ═══════════════════════════════════════════════════════════

  checkPageBreak(55)

  const condX = ML
  const condW = emBoxW
  const sigX = boxX_dest
  const sigW = destBoxW
  const condStartY = y

  // ── CONDITIONS (fond blanc, pas de bordure) ──
  pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR.TEXT)
  pdf.text('CONDITIONS', condX, condStartY + 4)
  let cy = condStartY + 10

  pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR.TEXT)
  const validStr = `${input.devis.validite_jours} jours`
  const condTextLines = [
    `Validité du devis : ${validStr} à compter de la date d'émission.`,
    `Délai d'exécution : ${input.devis.delai_execution}.`,
    "Toute modification fera l'objet d'un avenant signé par les deux parties.",
    `Mode de règlement : ${input.artisan.mode_paiement}.`,
  ]
  condTextLines.forEach(line => {
    const wrapped = pdf.splitTextToSize(line, condW - 4)
    pdf.text(wrapped, condX, cy)
    cy += wrapped.length * ptToMm(13)
  })

  // Notes intégrées en italic dans les conditions (spec section 11)
  if (input.notes && input.notes.trim()) {
    cy += 2
    pdf.setFont('helvetica', 'italic'); pdf.setFontSize(9); pdf.setTextColor(COLOR.TEXT)
    const noteWrapped = pdf.splitTextToSize(input.notes.trim(), condW - 4)
    pdf.text(noteWrapped, condX, cy)
    cy += noteWrapped.length * ptToMm(13)
  }

  // ── BON POUR ACCORD (fond gris, bordure) ──
  const sigContentH = Math.max(cy - condStartY, 46)
  pdf.setFillColor(COLOR.BG_GRAY)
  pdf.setDrawColor(COLOR.BORDER)
  pdf.setLineWidth(0.18)
  pdf.rect(sigX, condStartY, sigW, sigContentH, 'FD')

  pdf.setFontSize(9.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR.TEXT)
  pdf.text('BON POUR ACCORD', sigX + boxPadX, condStartY + 5)

  let sy = condStartY + 12
  pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR.TEXT)

  if (input.signature) {
    try {
      pdf.addImage(input.signature.image_base64, 'PNG', sigX + boxPadX, sy, sigW - boxPadX * 2 - 10, 18)
      sy += 20
      pdf.setFontSize(7); pdf.setFont('helvetica', 'bold')
      pdf.text(input.signature.signe_par, sigX + boxPadX, sy)
      pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR.TEXT_LIGHT)
      pdf.text(formatDate(input.signature.signe_le), sigX + boxPadX, sy + 3)
    } catch {
      pdf.text(input.signature.signe_par, sigX + boxPadX, sy)
    }
  } else {
    const approvalText = 'Devis reçu avant exécution des travaux, lu et approuvé, bon pour accord.'
    const appWrapped = pdf.splitTextToSize(approvalText, sigW - boxPadX * 2)
    pdf.text(appWrapped, sigX + boxPadX, sy)
    sy += appWrapped.length * ptToMm(13) + 4
    pdf.text('Date : ___ / ___ / ______', sigX + boxPadX, sy)
    sy += ptToMm(18)
    pdf.text('Signature :', sigX + boxPadX, sy)
  }

  y = condStartY + sigContentH + 6

  // ═══════════════════════════════════════════════════════════
  // 13. MENTIONS LÉGALES (bas de page 1)
  // ═══════════════════════════════════════════════════════════

  // Construire le texte légal
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

  // Toujours placer les mentions en bas de la page courante
  const legalY = pageH - 18
  if (y < legalY - 2) {
    // Il reste de la place — aller en bas
    drawHLine(ML, legalY, xRight, COLOR.BORDER, 0.18)
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6.5); pdf.setTextColor(COLOR.TEXT_LIGHT)
    const legalWrapped = pdf.splitTextToSize(legalParagraph, contentW)
    pdf.text(legalWrapped, ML, legalY + 3)
  } else {
    // Le contenu a débordé — mettre les mentions juste après
    y += 4
    drawHLine(ML, y, xRight, COLOR.BORDER, 0.18)
    y += 3
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6.5); pdf.setTextColor(COLOR.TEXT_LIGHT)
    const legalWrapped = pdf.splitTextToSize(legalParagraph, contentW)
    pdf.text(legalWrapped, ML, y)
    y += legalWrapped.length * ptToMm(10)
  }

  // ═══════════════════════════════════════════════════════════
  // PAGE 2: DROIT DE RÉTRACTATION
  // ═══════════════════════════════════════════════════════════

  pdf.addPage()
  let ry = 8

  // Ligne d'accent or en haut
  pdf.setFillColor(COLOR.ACCENT)
  pdf.rect(ML, ry, contentW, ptToMm(3), 'F')
  ry += ptToMm(3) + 8

  // Titre
  pdf.setFontSize(12); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR.TEXT)
  pdf.text('DROIT DE RÉTRACTATION', ML, ry)
  ry += 5
  pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR.TEXT)
  pdf.text('Article L. 221-18 du Code de la consommation', ML, ry)
  ry += 8

  // Texte légal
  pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR.TEXT)
  const retTexts = [
    "Le client dispose d'un délai de 14 jours calendaires à compter de la signature du présent devis pour exercer son droit de rétractation, sans avoir à justifier de motifs ni à payer de pénalités.",
    "Pour exercer ce droit, le client peut utiliser le formulaire ci-dessous ou adresser toute déclaration dénuée d'ambiguïté exprimant sa volonté de se rétracter.",
    "Aucun paiement ne peut être exigé avant l'expiration d'un délai de 7 jours à compter de la signature (art. L. 221-10 C. conso.), sauf travaux urgents demandés expressément par le client.",
  ]
  retTexts.forEach(txt => {
    const wrapped = pdf.splitTextToSize(txt, contentW)
    pdf.text(wrapped, ML, ry)
    ry += wrapped.length * ptToMm(13) + 4
  })

  ry += 4

  // Formulaire de rétractation — bandeau noir
  pdf.setFillColor(COLOR.TEXT)
  pdf.rect(ML, ry, contentW, 8, 'F')
  pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(COLOR.WHITE)
  pdf.text('FORMULAIRE DE RÉTRACTATION', ML + boxPadX, ry + 5.5)
  ry += 12

  // Contenu formulaire
  pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(COLOR.TEXT)
  const formAttention = `À l'attention de : `
  pdf.text(formAttention, ML + boxPadX, ry)
  const atW = pdf.getTextWidth(formAttention)
  pdf.setFont('helvetica', 'bold')
  pdf.text(`${input.artisan.nom}, ${input.artisan.adresse}`, ML + boxPadX + atW, ry)
  ry += 6

  pdf.setFont('helvetica', 'normal')
  pdf.text('Je notifie par la présente ma rétractation du contrat portant sur la prestation de services ci-dessus.', ML + boxPadX, ry)
  ry += 8

  const formFields = [
    'Commandé le / reçu le :',
    'Nom du client :',
    'Adresse :',
    'Date : ___ / ___ / ______',
    'Signature :',
  ]
  formFields.forEach(f => {
    pdf.text(f, ML + boxPadX, ry)
    if (!f.startsWith('Date') && !f.startsWith('Signature')) {
      const fw = pdf.getTextWidth(f) + 2
      pdf.setDrawColor(COLOR.BORDER); pdf.setLineWidth(0.2)
      pdf.line(ML + boxPadX + fw, ry + 0.5, xRight - boxPadX, ry + 0.5)
    }
    ry += 8
  })

  // ═══════════════════════════════════════════════════════════
  // PAGINATION — "Page X/Y" sur chaque page
  // ═══════════════════════════════════════════════════════════

  const totalPages = pdf.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i)
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(COLOR.TEXT_LIGHT)
    pdf.text(`Page ${i}/${totalPages}`, xRight - 2, pageH - 3.2, { align: 'right' })
  }

  return pdf
}
