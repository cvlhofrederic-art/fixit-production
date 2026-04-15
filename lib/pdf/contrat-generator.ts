/**
 * Contrat PDF Generator — reprend la charte visuelle du devis V2
 * (police Liberation Sans, palette, layout, barre d'accent jaune).
 * Adapté aux contrats (maintenance, prestation, location, assurance, sous-traitance, entretien).
 */

export interface ContratPdfInput {
  artisan: {
    logo_url: string | null
    nom: string
    siret: string | null
    adresse: string | null
    telephone: string | null
    email: string | null
    insurance_name?: string | null
    insurance_number?: string | null
  }
  client: {
    nom: string
    adresse?: string | null
    telephone?: string | null
    email?: string | null
    siret?: string | null
  }
  contrat: {
    numero: string
    titre: string
    type: string
    date_debut: string
    date_fin: string
    montant: string
    periodicite: string
    statut: string
    description: string
    date_emission: Date
  }
}

const COLOR = {
  TEXT: '#0D0D0D',
  TEXT_LIGHT: '#888888',
  WHITE: '#FFFFFF',
  BG_GRAY: '#F5F5F3',
  BORDER: '#E0E0DC',
  ACCENT: '#FFD600',
}

const ML = 18.0
const MR = 18.0
const EM_W = 83.11
const DEST_X0 = 104.99
const DEST_W = 86.99
const TEXT_X_EM = 21.88
const TEXT_X_DEST = 108.87
const BOX_H_MIN = 47.27

const ptToMm = (pt: number) => pt / 2.835

function formatDate(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatDateStr(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return formatDate(d)
}

function formatMontant(raw: string, periodicite: string): string {
  const n = parseFloat((raw || '').toString().replace(',', '.'))
  if (!n || isNaN(n)) return '—'
  const int = Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  const dec = (n - Math.floor(n)).toFixed(2).substring(2)
  const price = `${int},${dec} €`
  const per = periodicite ? ` / ${periodicite.toLowerCase()}` : ''
  return price + per
}

function splitAddress(addr: string): { rue: string; ville: string } | null {
  if (!addr) return null
  const m = addr.match(/^(.+?)[,\n\s]+(\d{5}\s+.+)$/)
  if (m) return { rue: m[1].trim(), ville: m[2].trim() }
  const comma = addr.indexOf(',')
  if (comma > 0) return { rue: addr.slice(0, comma).trim(), ville: addr.slice(comma + 1).trim() }
  return { rue: addr.trim(), ville: '' }
}

export async function generateContratPdf(input: ContratPdfInput) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  // ── Embed Liberation Sans (Unicode) ──
  try {
    const [regularRes, boldRes] = await Promise.all([
      fetch('/fonts/LiberationSans-Regular.ttf'),
      fetch('/fonts/LiberationSans-Bold.ttf'),
    ])
    if (regularRes.ok && boldRes.ok) {
      const [regularBuf, boldBuf] = await Promise.all([regularRes.arrayBuffer(), boldRes.arrayBuffer()])
      const toBase64 = (buf: ArrayBuffer) => {
        const bytes = new Uint8Array(buf)
        let binary = ''
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
        return btoa(binary)
      }
      pdf.addFileToVFS('LiberationSans-Regular.ttf', toBase64(regularBuf))
      pdf.addFont('LiberationSans-Regular.ttf', 'LiberationSans', 'normal')
      pdf.addFileToVFS('LiberationSans-Bold.ttf', toBase64(boldBuf))
      pdf.addFont('LiberationSans-Bold.ttf', 'LiberationSans', 'bold')
    }
  } catch { /* fallback helvetica */ }

  const FONT = pdf.getFontList()['LiberationSans'] ? 'LiberationSans' : 'helvetica'

  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const contentW = pageW - ML - MR
  const xRight = pageW - MR
  let y = 0

  const boxPadTop = ptToMm(19)

  const drawHLine = (x1: number, yPos: number, x2: number, color = COLOR.BORDER, width = 0.18) => {
    pdf.setDrawColor(color); pdf.setLineWidth(width); pdf.line(x1, yPos, x2, yPos)
  }
  const drawVLine = (x: number, y1: number, y2: number, color = COLOR.BORDER, width = 0.18) => {
    pdf.setDrawColor(color); pdf.setLineWidth(width); pdf.line(x, y1, x, y2)
  }

  // ─── 1. LOGO ───
  if (input.artisan.logo_url) {
    try {
      const logoImg = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error('logo failed'))
        img.src = input.artisan.logo_url!
      })
      const canvasSize = 500
      const canvas = document.createElement('canvas')
      canvas.width = canvasSize; canvas.height = canvasSize
      const ctx = canvas.getContext('2d')
      if (ctx) {
        const ratio = logoImg.width / logoImg.height
        let drawW = canvasSize, drawH = canvasSize
        if (ratio > 1) drawH = canvasSize / ratio; else drawW = canvasSize * ratio
        ctx.drawImage(logoImg, (canvasSize - drawW) / 2, (canvasSize - drawH) / 2, drawW, drawH)
        const logoSize = ptToMm(65)
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', ptToMm(15), ptToMm(8), logoSize, logoSize)
      }
    } catch { /* skip logo */ }
  }

  // ─── 2. TITRE + 3. NUMÉRO + 4. BARRE D'ACCENT ───
  y = ptToMm(71)
  pdf.setFont(FONT, 'bold'); pdf.setFontSize(16); pdf.setTextColor(COLOR.TEXT)
  const mainTitle = input.contrat.titre || `Contrat de ${input.contrat.type?.toLowerCase() || 'prestation'}`
  pdf.text(mainTitle.toUpperCase(), pageW / 2, y, { align: 'center' })

  y += ptToMm(20)
  pdf.setFont(FONT, 'normal'); pdf.setFontSize(9); pdf.setTextColor(COLOR.TEXT_LIGHT)
  pdf.text(`N° ${input.contrat.numero}`, pageW / 2, y, { align: 'center' })

  y += ptToMm(12)
  pdf.setFillColor(COLOR.ACCENT)
  pdf.rect(ML, y, contentW, ptToMm(3), 'F')
  y += ptToMm(3) + 5

  // ─── 5. ENCADRÉS ÉMETTEUR / DESTINATAIRE ───
  const boxStartY = y

  let emContentH = boxPadTop + ptToMm(18) + ptToMm(14)
  if (input.artisan.siret) emContentH += ptToMm(14)
  if (input.artisan.adresse) { emContentH += ptToMm(14); if (splitAddress(input.artisan.adresse)?.ville) emContentH += ptToMm(14) }
  if (input.artisan.telephone) emContentH += ptToMm(14)
  if (input.artisan.email) emContentH += ptToMm(14)
  if (input.artisan.insurance_name) emContentH += ptToMm(14)
  emContentH += boxPadTop

  let destContentH = boxPadTop + ptToMm(18) + ptToMm(14)
  if (input.client.adresse) { destContentH += ptToMm(14); if (splitAddress(input.client.adresse)?.ville) destContentH += ptToMm(14) }
  if (input.client.siret) destContentH += ptToMm(14)
  if (input.client.telephone) destContentH += ptToMm(14)
  if (input.client.email) destContentH += ptToMm(14)
  destContentH += boxPadTop

  const boxH = Math.max(emContentH, destContentH, BOX_H_MIN)

  pdf.setFillColor(COLOR.BG_GRAY); pdf.setDrawColor(COLOR.BORDER); pdf.setLineWidth(0.18)
  pdf.rect(ML, boxStartY, EM_W, boxH, 'FD')
  pdf.rect(DEST_X0, boxStartY, DEST_W, boxH, 'FD')

  // Émetteur
  let ey = boxStartY + boxPadTop
  pdf.setFontSize(7); pdf.setFont(FONT, 'normal'); pdf.setTextColor(COLOR.TEXT_LIGHT)
  pdf.text('PRESTATAIRE', TEXT_X_EM, ey); ey += ptToMm(18)
  pdf.setFontSize(10); pdf.setTextColor(COLOR.TEXT)
  pdf.text(`Société : ${input.artisan.nom}`, TEXT_X_EM, ey); ey += ptToMm(14)
  if (input.artisan.siret) { pdf.text(`SIRET : ${input.artisan.siret}`, TEXT_X_EM, ey); ey += ptToMm(14) }
  if (input.artisan.adresse) {
    const p = splitAddress(input.artisan.adresse)
    if (p) {
      pdf.text(`Adresse : ${p.rue}`, TEXT_X_EM, ey); ey += ptToMm(14)
      if (p.ville) { pdf.text(`Ville : ${p.ville}`, TEXT_X_EM, ey); ey += ptToMm(14) }
    }
  }
  if (input.artisan.telephone) { pdf.text(`Tél : ${input.artisan.telephone}`, TEXT_X_EM, ey); ey += ptToMm(14) }
  if (input.artisan.email) { pdf.text(`E-mail : ${input.artisan.email}`, TEXT_X_EM, ey); ey += ptToMm(14) }
  if (input.artisan.insurance_name) {
    const tx = `RC Pro : ${input.artisan.insurance_name}${input.artisan.insurance_number ? `, n° ${input.artisan.insurance_number}` : ''}`
    const maxW = EM_W - ptToMm(11) * 2
    let fs = 10
    pdf.setFontSize(fs)
    if (pdf.getTextWidth(tx) > maxW) { fs = 9; pdf.setFontSize(fs) }
    if (pdf.getTextWidth(tx) > maxW) { fs = 8; pdf.setFontSize(fs) }
    pdf.text(tx, TEXT_X_EM, ey); ey += ptToMm(14)
    pdf.setFontSize(10)
  }

  // Destinataire
  let dy = boxStartY + boxPadTop
  pdf.setFontSize(7); pdf.setFont(FONT, 'normal'); pdf.setTextColor(COLOR.TEXT_LIGHT)
  pdf.text('CLIENT', TEXT_X_DEST, dy); dy += ptToMm(18)
  pdf.setFontSize(10); pdf.setTextColor(COLOR.TEXT)
  const clientLabel = input.client.siret ? 'Société' : 'Nom'
  pdf.text(`${clientLabel} : ${input.client.nom || '---'}`, TEXT_X_DEST, dy); dy += ptToMm(14)
  if (input.client.adresse) {
    const p = splitAddress(input.client.adresse)
    if (p && p.rue) {
      pdf.text(`Adresse : ${p.rue}`, TEXT_X_DEST, dy); dy += ptToMm(14)
      if (p.ville) { pdf.text(`Ville : ${p.ville}`, TEXT_X_DEST, dy); dy += ptToMm(14) }
    }
  }
  if (input.client.siret) { pdf.text(`SIRET : ${input.client.siret}`, TEXT_X_DEST, dy); dy += ptToMm(14) }
  if (input.client.telephone) { pdf.text(`Tél : ${input.client.telephone}`, TEXT_X_DEST, dy); dy += ptToMm(14) }
  if (input.client.email) { pdf.text(`E-mail : ${input.client.email}`, TEXT_X_DEST, dy); dy += ptToMm(14) }

  y = boxStartY + boxH + 4

  // ─── 7. TABLEAU DES INFOS CONTRAT (4 colonnes) ───
  const dateBoxH = ptToMm(49)
  const dateSepY = y + ptToMm(20)
  pdf.setFillColor(COLOR.BG_GRAY); pdf.setDrawColor(COLOR.BORDER); pdf.setLineWidth(0.18)
  pdf.rect(ML, y, contentW, dateBoxH, 'FD')

  const cols = [
    { label: "DATE D'ÉMISSION", value: formatDate(input.contrat.date_emission) },
    { label: 'DATE DE DÉBUT', value: formatDateStr(input.contrat.date_debut) },
    { label: 'DATE DE FIN', value: formatDateStr(input.contrat.date_fin) },
    { label: 'MONTANT', value: formatMontant(input.contrat.montant, input.contrat.periodicite) },
  ]

  const vSeps = [60.52, 103.05, 147.51]
  const centers = [(ML + vSeps[0]) / 2, (vSeps[0] + vSeps[1]) / 2, (vSeps[1] + vSeps[2]) / 2, (vSeps[2] + xRight) / 2]
  drawHLine(ML, dateSepY, xRight, COLOR.BORDER, 0.18)
  vSeps.forEach(x => drawVLine(x, y, y + dateBoxH, COLOR.BORDER, 0.18))

  cols.forEach((c, i) => {
    pdf.setFontSize(7); pdf.setFont(FONT, 'normal'); pdf.setTextColor(COLOR.TEXT_LIGHT)
    pdf.text(c.label, centers[i], y + ptToMm(14), { align: 'center' })
  })
  cols.forEach((c, i) => {
    pdf.setFontSize(10); pdf.setFont(FONT, 'bold'); pdf.setTextColor(COLOR.TEXT)
    pdf.text(c.value, centers[i], dateSepY + ptToMm(17), { align: 'center' })
  })

  y += dateBoxH + 5

  // ─── 8. BANDEAU TYPE + STATUT ───
  const stripH = ptToMm(28)
  pdf.setFillColor(COLOR.ACCENT)
  pdf.rect(ML, y, contentW, stripH, 'F')
  pdf.setFont(FONT, 'bold'); pdf.setFontSize(9); pdf.setTextColor(COLOR.TEXT)
  pdf.text(`TYPE : ${(input.contrat.type || '—').toUpperCase()}`, ML + 6, y + ptToMm(17))
  pdf.text(`STATUT : ${(input.contrat.statut || '—').toUpperCase()}`, xRight - 6, y + ptToMm(17), { align: 'right' })
  y += stripH + 6

  // ─── 9. OBJET / DESCRIPTION DU CONTRAT ───
  pdf.setFont(FONT, 'bold'); pdf.setFontSize(10); pdf.setTextColor(COLOR.TEXT)
  pdf.text('OBJET DU CONTRAT', ML, y); y += 5
  pdf.setLineWidth(0.18); pdf.setDrawColor(COLOR.BORDER)
  pdf.line(ML, y, xRight, y); y += 4

  pdf.setFont(FONT, 'normal'); pdf.setFontSize(10); pdf.setTextColor(COLOR.TEXT)
  const desc = (input.contrat.description || '').trim() || 'Prestation convenue entre les parties selon les termes ci-après.'
  const lines = pdf.splitTextToSize(desc, contentW)
  lines.forEach((ln: string) => {
    if (y > pageH - 40) { pdf.addPage(); y = 18 }
    pdf.text(ln, ML, y); y += ptToMm(13)
  })
  y += 4

  // ─── 10. CLAUSES GÉNÉRALES ───
  if (y > pageH - 80) { pdf.addPage(); y = 18 }
  pdf.setFont(FONT, 'bold'); pdf.setFontSize(10); pdf.setTextColor(COLOR.TEXT)
  pdf.text('CONDITIONS GÉNÉRALES', ML, y); y += 5
  pdf.line(ML, y, xRight, y); y += 4

  pdf.setFont(FONT, 'normal'); pdf.setFontSize(9); pdf.setTextColor(COLOR.TEXT)
  const clauses = [
    `• Le présent contrat prend effet le ${formatDateStr(input.contrat.date_debut)} et s'achève le ${formatDateStr(input.contrat.date_fin)}.`,
    `• Le montant convenu est de ${formatMontant(input.contrat.montant, input.contrat.periodicite)}, payable selon la périodicité indiquée.`,
    '• Toute modification des présentes nécessite un avenant écrit signé par les deux parties.',
    '• En cas de manquement aux obligations, la partie lésée pourra résilier le contrat par lettre recommandée avec accusé de réception après mise en demeure restée infructueuse pendant 30 jours.',
    '• Tout litige relatif à l\'interprétation ou à l\'exécution du présent contrat sera soumis aux tribunaux compétents du siège du prestataire.',
    '• Les données personnelles échangées sont traitées conformément au RGPD.',
  ]
  clauses.forEach(c => {
    const wrapped = pdf.splitTextToSize(c, contentW)
    wrapped.forEach((ln: string) => {
      if (y > pageH - 50) { pdf.addPage(); y = 18 }
      pdf.text(ln, ML, y); y += ptToMm(12)
    })
    y += 1
  })
  y += 6

  // ─── 11. SIGNATURES ───
  if (y > pageH - 55) { pdf.addPage(); y = 18 }
  pdf.setFont(FONT, 'bold'); pdf.setFontSize(10); pdf.setTextColor(COLOR.TEXT)
  pdf.text('SIGNATURES', ML, y); y += 5
  pdf.line(ML, y, xRight, y); y += 6

  const sigBoxW = (contentW - 8) / 2
  const sigBoxH = 32
  pdf.setDrawColor(COLOR.BORDER); pdf.setLineWidth(0.18)
  pdf.rect(ML, y, sigBoxW, sigBoxH)
  pdf.rect(ML + sigBoxW + 8, y, sigBoxW, sigBoxH)

  pdf.setFont(FONT, 'normal'); pdf.setFontSize(8); pdf.setTextColor(COLOR.TEXT_LIGHT)
  pdf.text('Le prestataire', ML + 3, y + 5)
  pdf.text(input.artisan.nom, ML + 3, y + sigBoxH - 3)
  pdf.text('Le client', ML + sigBoxW + 8 + 3, y + 5)
  pdf.text(input.client.nom || '—', ML + sigBoxW + 8 + 3, y + sigBoxH - 3)
  y += sigBoxH + 4

  pdf.setFontSize(7); pdf.setTextColor(COLOR.TEXT_LIGHT)
  pdf.text(`Fait en deux exemplaires originaux · Émis le ${formatDate(input.contrat.date_emission)}`, pageW / 2, y, { align: 'center' })

  // ─── Footer ───
  const footerY = pageH - 10
  pdf.setFontSize(7); pdf.setTextColor(COLOR.TEXT_LIGHT)
  pdf.text(`${input.artisan.nom}${input.artisan.siret ? ` — SIRET ${input.artisan.siret}` : ''}`, pageW / 2, footerY, { align: 'center' })

  return pdf
}
