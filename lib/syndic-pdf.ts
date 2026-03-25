/**
 * Syndic PDF generation — Max AI document export
 * Extracted from syndic dashboard for maintainability.
 */

import { getRoleLabel } from '@/components/syndic-dashboard/types'

interface DocPDFDestinataire {
  prenom?: string
  nom?: string
  immeuble?: string
  batiment?: string
  etage?: string
  porte?: string
}

interface DocPDFData {
  type?: string
  title?: string
  destinataire?: DocPDFDestinataire
  objet?: string
  corps?: string[]
  references?: string[]
  formule_politesse?: string
}

interface SignatureData {
  svg_data?: string
  hash_sha256?: string
}

interface PDFContext {
  locale: string
  cabinetLogo?: string | null
  cabinetNom: string
  cabinetAddress: string
  cabinetEmail: string
  userName: string
  userRole: string
  syndicSignature: SignatureData | null
}

export async function generateMaxPDF(docData: DocPDFData, ctx: PDFContext): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210, M = 18, textW = W - 2 * M
  const isPt = ctx.locale === 'pt'
  let y = M

  const checkPageBreak = (needed: number) => {
    if (y + needed > 275) { pdf.addPage(); y = M }
  }

  // ── 1. HEADER ──
  if (ctx.cabinetLogo) {
    try { pdf.addImage(ctx.cabinetLogo, 'JPEG', M, y, 25, 25) } catch { /* skip logo */ }
  }
  const headerX = ctx.cabinetLogo ? M + 30 : M
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(14)
  pdf.setTextColor(13, 27, 46)
  pdf.text(ctx.cabinetNom || (isPt ? 'Gabinete' : 'Cabinet'), headerX, y + 6)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(100, 100, 100)
  if (ctx.cabinetAddress) {
    const addrLines = ctx.cabinetAddress.split('\n')
    addrLines.forEach((line, i) => { pdf.text(line.trim(), headerX, y + 12 + i * 4) })
    y += 12 + addrLines.length * 4
  } else { y += 14 }
  if (ctx.cabinetEmail) { pdf.text(ctx.cabinetEmail, headerX, y); y += 5 }
  y = Math.max(y, ctx.cabinetLogo ? M + 28 : y) + 4

  // ── Separator ──
  pdf.setDrawColor(201, 168, 76)
  pdf.setLineWidth(0.8)
  pdf.line(M, y, W - M, y)
  y += 8

  // ── 2. TITLE ──
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(16)
  pdf.setTextColor(13, 27, 46)
  pdf.text((docData.title || docData.type || 'DOCUMENT').toUpperCase(), W / 2, y, { align: 'center' })
  y += 8

  // Reference & Date
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(100, 100, 100)
  const refNum = `DOC-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`
  const dateStr = new Date().toLocaleDateString(isPt ? 'pt-PT' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  pdf.text(`${isPt ? 'Referência' : 'Référence'}: ${refNum}`, M, y)
  pdf.text(`${isPt ? 'Data' : 'Date'}: ${dateStr}`, W - M, y, { align: 'right' })
  y += 10

  // ── 3. RECIPIENT ──
  if (docData.destinataire) {
    const d = docData.destinataire
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.setTextColor(13, 27, 46)
    pdf.text(isPt ? 'DESTINATÁRIO:' : 'DESTINATAIRE:', M, y)
    y += 5
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    if (d.prenom || d.nom) pdf.text(`${d.prenom || ''} ${d.nom || ''}`.trim(), M, y)
    y += 5
    const addrParts: string[] = []
    if (d.immeuble) addrParts.push(d.immeuble)
    if (d.batiment) addrParts.push(`${isPt ? 'Bloco' : 'Bât.'} ${d.batiment}`)
    if (d.etage) addrParts.push(`${d.etage}${isPt ? 'º andar' : 'e étage'}`)
    if (d.porte) addrParts.push(`${isPt ? 'Porta' : 'Porte'} ${d.porte}`)
    if (addrParts.length > 0) { pdf.text(addrParts.join(', '), M, y); y += 5 }
    y += 5
  }

  // ── 4. OBJET ──
  if (docData.objet) {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.setTextColor(13, 27, 46)
    pdf.text(`${isPt ? 'Assunto' : 'Objet'}: ${docData.objet}`, M, y)
    y += 8
  }

  // ── 5. BODY ──
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(10)
  pdf.setTextColor(40, 40, 40)
  for (const paragraph of (docData.corps || [])) {
    checkPageBreak(15)
    const lines = pdf.splitTextToSize(paragraph, textW)
    lines.forEach((line: string) => { checkPageBreak(6); pdf.text(line, M, y); y += 5 })
    y += 3
  }

  // ── 6. LEGAL REFERENCES ──
  if (docData.references && docData.references.length > 0) {
    checkPageBreak(15)
    y += 3
    pdf.setFont('helvetica', 'italic')
    pdf.setFontSize(8)
    pdf.setTextColor(100, 100, 100)
    pdf.text(`${isPt ? 'Referências legais' : 'Références légales'}: ${docData.references.join(' · ')}`, M, y)
    y += 8
  }

  // ── 7. CLOSING ──
  if (docData.formule_politesse) {
    checkPageBreak(10)
    y += 3
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    pdf.setTextColor(40, 40, 40)
    const fpLines = pdf.splitTextToSize(docData.formule_politesse, textW)
    fpLines.forEach((line: string) => { pdf.text(line, M, y); y += 5 })
    y += 5
  }

  // ── 8. SIGNATURE ──
  checkPageBreak(50)
  y += 5
  if (ctx.syndicSignature?.svg_data) {
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 400; canvas.height = 160
      const ctx2d = canvas.getContext('2d')
      if (ctx2d) {
        ctx2d.fillStyle = '#ffffff'
        ctx2d.fillRect(0, 0, 400, 160)
        const img = new Image()
        const svgBlob = new Blob([ctx.syndicSignature.svg_data], { type: 'image/svg+xml' })
        const svgUrl = URL.createObjectURL(svgBlob)
        await new Promise<void>((resolve) => {
          img.onload = () => { ctx2d.drawImage(img, 0, 0); URL.revokeObjectURL(svgUrl); resolve() }
          img.onerror = () => { URL.revokeObjectURL(svgUrl); resolve() }
          img.src = svgUrl
        })
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', W - M - 60, y, 50, 20)
        y += 22
      }
    } catch { y += 5 }
  }

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.setTextColor(13, 27, 46)
  pdf.text(ctx.userName, W - M, y, { align: 'right' })
  y += 5
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  pdf.setTextColor(100, 100, 100)
  pdf.text(getRoleLabel(ctx.userRole, isPt ? 'pt' : 'fr'), W - M, y, { align: 'right' })
  y += 4
  const nowStr = new Date().toLocaleString(isPt ? 'pt-PT' : 'fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  pdf.text(`${isPt ? 'Assinado em' : 'Fait le'} ${nowStr}`, W - M, y, { align: 'right' })
  y += 4
  if (ctx.syndicSignature?.hash_sha256) {
    pdf.setFontSize(6)
    pdf.text(`SHA-256: ${ctx.syndicSignature.hash_sha256.substring(0, 32)}...`, W - M, y, { align: 'right' })
  }

  // ── 9. FOOTER ──
  const pageCount = pdf.getNumberOfPages()
  for (let p = 1; p <= pageCount; p++) {
    pdf.setPage(p)
    pdf.setDrawColor(201, 168, 76)
    pdf.setLineWidth(0.5)
    pdf.line(M, 285, W - M, 285)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(150, 150, 150)
    pdf.text(`${ctx.cabinetNom || (isPt ? 'Gabinete' : 'Cabinet')}${ctx.cabinetAddress ? ' — ' + ctx.cabinetAddress.split('\n')[0] : ''}`, W / 2, 289, { align: 'center' })
    pdf.text(`${p}/${pageCount}`, W - M, 289, { align: 'right' })
  }

  pdf.save(`${docData.type || 'document'}_${new Date().toISOString().split('T')[0]}.pdf`)
}
