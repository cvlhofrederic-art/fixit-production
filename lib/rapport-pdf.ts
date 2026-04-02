/**
 * PDF generator for Rapport d'Intervention
 * Extracted from components/dashboard/RapportsSection.tsx
 * Uses jsPDF vectorial rendering (no html2canvas).
 */

export interface RapportPDFData {
  rapportNumber: string
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
  [key: string]: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

/**
 * Generate a PDF for a rapport d'intervention.
 * Dynamically imports jsPDF so the module stays tree-shakeable.
 */
export async function generateRapportPDF(
  r: RapportPDFData,
  availablePhotos: PhotoForPDF[],
  dateFmtLocale: string,
): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()  // 210mm
  const pageH = pdf.internal.pageSize.getHeight() // 297mm
  const mL = 18, mR = 18
  const contentW = pageW - mL - mR
  const col = '#1E293B', colLight = '#64748B'

  // ---- Helper functions ----

  const drawLine = (x1: number, yPos: number, x2: number, color = '#E2E8F0', width = 0.3) => {
    pdf.setDrawColor(color); pdf.setLineWidth(width); pdf.line(x1, yPos, x2, yPos)
  }
  // Suppress unused-var — drawLine is available for future sections
  void drawLine

  const checkPage = (need: number, currentY: number): number => {
    if (currentY + need > pageH - 15) { pdf.addPage(); return 18 }
    return currentY
  }

  const sectionHeader = (text: string, yPos: number, bgColor = '#1E293B'): number => {
    yPos = checkPage(12, yPos)
    pdf.setFillColor(bgColor)
    pdf.roundedRect(mL, yPos, contentW, 7, 1.5, 1.5, 'F')
    pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor('#ffffff')
    pdf.text(text.toUpperCase(), mL + 4, yPos + 4.8)
    return yPos + 8
  }

  const sectionBody = (yStart: number, render: (x: number, y: number, w: number) => number): number => {
    pdf.setDrawColor('#E2E8F0'); pdf.setLineWidth(0.3)
    const endY = render(mL + 4, yStart + 4, contentW - 8)
    pdf.roundedRect(mL, yStart - 0.5, contentW, endY - yStart + 2, 0, 0, 'S')
    return endY + 4
  }

  let y = 0

  // === 1. EN-TETE BANDEAU SOMBRE ===
  pdf.setFillColor('#1E293B')
  pdf.rect(0, 0, pageW, 32, 'F')
  pdf.setFontSize(16); pdf.setFont('helvetica', 'bold'); pdf.setTextColor('#ffffff')
  pdf.text("RAPPORT D'INTERVENTION", mL, 14)
  pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.setTextColor('#FFC107')
  pdf.text(r.rapportNumber, mL, 21)
  pdf.setFontSize(7.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#94A3B8')
  pdf.text(`Etabli le ${new Date().toLocaleDateString(dateFmtLocale, { day: 'numeric', month: 'long', year: 'numeric' })}`, mL, 27)
  if (r.refDevisFact) {
    pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#94A3B8')
    pdf.text(`Ref : ${r.refDevisFact}`, pageW - mR, 21, { align: 'right' })
  }
  pdf.setFillColor('#FFC107')
  pdf.rect(0, 32, pageW, 1.5, 'F')
  y = 40

  // === 2. EMETTEUR + CLIENT (2 colonnes) ===
  const boxW = (contentW - 6) / 2
  const boxStartY = y

  // Emetteur
  pdf.setDrawColor('#E2E8F0'); pdf.setLineWidth(0.3)
  pdf.setFillColor('#F8FAFC')
  pdf.roundedRect(mL, boxStartY, boxW, 36, 2, 2, 'FD')
  let ey = boxStartY + 4
  pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(colLight)
  pdf.text('PRESTATAIRE', mL + 4, ey); ey += 5
  pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(col)
  pdf.text(r.artisanName || '', mL + 4, ey); ey += 4
  pdf.setFontSize(7.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#475569')
  if (r.artisanAddress) { pdf.text(r.artisanAddress, mL + 4, ey); ey += 3.2 }
  if (r.artisanPhone) { pdf.text(r.artisanPhone, mL + 4, ey); ey += 3.2 }
  if (r.artisanEmail) { pdf.text(r.artisanEmail, mL + 4, ey); ey += 3.2 }
  if (r.artisanSiret) { pdf.setFontSize(6.5); pdf.setTextColor('#94A3B8'); pdf.text(`SIRET : ${r.artisanSiret}`, mL + 4, ey); ey += 3 }
  if (r.artisanInsurance) { pdf.text(r.artisanInsurance, mL + 4, ey) }

  // Client
  const destX = mL + boxW + 6
  pdf.setFillColor('#FFFBF0')
  pdf.setDrawColor('#FDE68A'); pdf.setLineWidth(0.3)
  pdf.roundedRect(destX, boxStartY, boxW, 36, 2, 2, 'FD')
  pdf.setFillColor('#FFC107')
  pdf.rect(destX, boxStartY + 2, 1.5, 32, 'F')
  let dy = boxStartY + 4
  pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor('#B45309')
  pdf.text('CLIENT', destX + 6, dy); dy += 5
  pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(col)
  pdf.text(r.clientName || '', destX + 6, dy); dy += 4
  pdf.setFontSize(7.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#475569')
  if (r.clientAddress) { pdf.text(r.clientAddress, destX + 6, dy); dy += 3.2 }
  if (r.clientPhone) { pdf.text(r.clientPhone, destX + 6, dy); dy += 3.2 }
  if (r.clientEmail) { pdf.text(r.clientEmail, destX + 6, dy) }

  y = boxStartY + 38

  // === 3. DETAILS INTERVENTION ===
  pdf.setFillColor('#FFFBEB'); pdf.setDrawColor('#FDE68A'); pdf.setLineWidth(0.3)
  pdf.roundedRect(mL, y, contentW, 18, 2, 2, 'FD')
  pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor('#92400E')
  pdf.text("DETAILS DE L'INTERVENTION", mL + 4, y + 4)
  const colW4 = contentW / 4
  const detY = y + 9
  const detailCol = (label: string, value: string, cx: number) => {
    pdf.setFontSize(6.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#6B7280')
    pdf.text(label, cx, detY)
    pdf.setFontSize(8.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(col)
    pdf.text(value || '\u2014', cx, detY + 4)
  }
  detailCol('Date', r.interventionDate ? new Date(r.interventionDate + 'T12:00:00').toLocaleDateString(dateFmtLocale) : '\u2014', mL + 4)
  detailCol('Heure debut', r.startTime || '\u2014', mL + 4 + colW4)
  detailCol('Heure fin', r.endTime || '\u2014', mL + 4 + colW4 * 2)
  let durationStr = '\u2014'
  if (r.startTime && r.endTime) {
    const [sh, sm] = r.startTime.split(':').map(Number)
    const [eh, em] = r.endTime.split(':').map(Number)
    const mins = (eh * 60 + em) - (sh * 60 + sm)
    if (mins > 0) durationStr = `${Math.floor(mins / 60)}h${mins % 60 > 0 ? String(mins % 60).padStart(2, '0') : '00'}`
  }
  detailCol('Duree', durationStr, mL + 4 + colW4 * 3)
  if (r.siteAddress) {
    pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#6B7280')
    pdf.text('Adresse chantier : ', mL + 4, y + 16)
    pdf.setFont('helvetica', 'bold'); pdf.setTextColor(col)
    pdf.text(r.siteAddress, mL + 4 + pdf.getTextWidth('Adresse chantier : '), y + 16)
  }
  y += 22

  // === 4. MOTIF D'INTERVENTION ===
  if (r.motif) {
    y = sectionHeader("Motif d'intervention", y)
    y = sectionBody(y, (x, sy, w) => {
      pdf.setFontSize(8.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(col)
      const lines = pdf.splitTextToSize(r.motif, w)
      pdf.text(lines, x, sy)
      return sy + lines.length * 3.5 + 1
    })
  }

  // === 5. TRAVAUX REALISES ===
  const travaux = r.travaux?.filter(t => t) || []
  if (travaux.length > 0) {
    y = sectionHeader('Travaux realises', y)
    y = sectionBody(y, (x, sy, w) => {
      let ty = sy
      travaux.forEach(t => {
        ty = checkPage(5, ty)
        pdf.setFontSize(8); pdf.setFont('helvetica', 'bold'); pdf.setTextColor('#059669')
        pdf.text('\u2713', x, ty)
        pdf.setFont('helvetica', 'normal'); pdf.setTextColor(col)
        const tLines = pdf.splitTextToSize(t, w - 6)
        pdf.text(tLines, x + 5, ty)
        ty += tLines.length * 3.5 + 1
      })
      return ty
    })
  }

  // === 6. MATERIAUX UTILISES ===
  const materiaux = r.materiaux?.filter(m => m) || []
  if (materiaux.length > 0) {
    y = sectionHeader('Materiaux utilises', y)
    y = sectionBody(y, (x, sy, w) => {
      let my = sy
      materiaux.forEach(m => {
        my = checkPage(5, my)
        pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(colLight)
        pdf.text('\u2022', x, my)
        pdf.setTextColor(col)
        const mLines = pdf.splitTextToSize(m, w - 6)
        pdf.text(mLines, x + 5, my)
        my += mLines.length * 3.5 + 1
      })
      return my
    })
  }

  // === 7. OBSERVATIONS + RECOMMANDATIONS ===
  if (r.observations || r.recommendations) {
    y = checkPage(25, y)
    const hasObs = !!r.observations
    const hasRec = !!r.recommendations
    const splitW = hasObs && hasRec ? (contentW - 4) / 2 : contentW

    if (hasObs) {
      pdf.setFillColor('#475569')
      pdf.roundedRect(mL, y, splitW, 7, 1.5, 1.5, 'F')
      pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor('#ffffff')
      pdf.text('OBSERVATIONS', mL + 4, y + 4.8)
      pdf.setDrawColor('#E2E8F0'); pdf.setFillColor('#F8FAFC')
      pdf.roundedRect(mL, y + 7, splitW, 20, 0, 0, 'FD')
      pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(col)
      const obsLines = pdf.splitTextToSize(r.observations, splitW - 8)
      pdf.text(obsLines, mL + 4, y + 12)
    }

    if (hasRec) {
      const recX = hasObs ? mL + splitW + 4 : mL
      pdf.setFillColor('#2563EB')
      pdf.roundedRect(recX, y, splitW, 7, 1.5, 1.5, 'F')
      pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor('#ffffff')
      pdf.text('RECOMMANDATIONS', recX + 4, y + 4.8)
      pdf.setDrawColor('#E2E8F0'); pdf.setFillColor('#EFF6FF')
      pdf.roundedRect(recX, y + 7, splitW, 20, 0, 0, 'FD')
      pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(col)
      const recLines = pdf.splitTextToSize(r.recommendations, splitW - 8)
      pdf.text(recLines, recX + 4, y + 12)
    }
    y += 30
  }

  // === 8. PHOTOS CHANTIER ===
  const linkedPhotosList = r.linkedPhotoIds?.length
    ? availablePhotos.filter(p => r.linkedPhotoIds?.includes(p.id))
    : []
  if (linkedPhotosList.length > 0) {
    y = checkPage(20, y)
    y = sectionHeader(`Photos chantier (${linkedPhotosList.length})`, y)
    y += 2

    const photoW = (contentW - 6) / 2
    const photoH = 50
    let photoCol = 0

    const loadImage = (url: string): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        const img = new window.Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error('Image load failed'))
        img.src = url
      })
    }

    for (let i = 0; i < linkedPhotosList.length; i++) {
      const photo = linkedPhotosList[i]
      if (photoCol === 0) y = checkPage(photoH + 16, y)
      const x = mL + photoCol * (photoW + 6)

      try {
        const img = await loadImage(photo.url || '')
        pdf.setDrawColor('#E5E7EB'); pdf.setLineWidth(0.3)
        pdf.roundedRect(x, y, photoW, photoH + 10, 1.5, 1.5, 'S')

        const imgRatio = img.width / img.height
        let drawW = photoW - 4, drawH = photoH - 2
        if (imgRatio > drawW / drawH) { drawH = drawW / imgRatio } else { drawW = drawH * imgRatio }
        const imgX = x + (photoW - drawW) / 2
        const imgY = y + 1 + (photoH - 2 - drawH) / 2

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

        pdf.setFontSize(5.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#6B7280')
        const dateStr = photo.taken_at ? new Date(photo.taken_at).toLocaleString(dateFmtLocale) : ''
        if (dateStr) pdf.text(dateStr, x + 2, y + photoH + 3)
        if (photo.lat && photo.lng) {
          pdf.text(`GPS ${Number(photo.lat).toFixed(5)}, ${Number(photo.lng).toFixed(5)}`, x + 2, y + photoH + 6.5)
        }
      } catch {
        pdf.setFillColor('#F3F4F6')
        pdf.roundedRect(x, y, photoW, photoH + 10, 1.5, 1.5, 'FD')
        pdf.setFontSize(7); pdf.setTextColor('#9CA3AF')
        pdf.text('Photo non disponible', x + photoW / 2, y + photoH / 2, { align: 'center' })
      }

      photoCol++
      if (photoCol >= 2) { photoCol = 0; y += photoH + 14 }
    }
    if (photoCol > 0) y += photoH + 14
  }

  // === FOOTER ===
  pdf.setFontSize(6.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor('#94A3B8')
  const footerText = `${r.artisanName}${r.artisanSiret ? ` \u2014 SIRET ${r.artisanSiret}` : ''} \u2014 Document genere par Vitfix Pro \u2014 ${new Date().toLocaleDateString(dateFmtLocale)}`
  pdf.text(footerText, pageW / 2, pageH - 8, { align: 'center' })

  pdf.save(`${r.rapportNumber}.pdf`)
}
