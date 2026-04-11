// ═══════════════════════════════════════════════
// API ROUTE: POST /api/facturx/generate
// Génère un PDF/A-3 Factur-X conforme EN 16931
// ═══════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { generateFacturXML } from '@/lib/facturx-mapper'
import { embedFacturX } from '@/lib/facturx'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

// ── Validation Zod (facture FR uniquement) ──
const facturxRequestSchema = z.object({
  data: z.object({
    docType: z.literal('facture'),
    docNumber: z.string().min(1),
    docTitle: z.string().default(''),
    companyStatus: z.string().default(''),
    companyName: z.string().min(1),
    companySiret: z.string().min(1),
    companyAddress: z.string().min(1),
    companyRCS: z.string().default(''),
    companyCapital: z.string().default(''),
    companyPhone: z.string().default(''),
    companyEmail: z.string().default(''),
    insuranceNumber: z.string().default(''),
    insuranceName: z.string().default(''),
    insuranceCoverage: z.string().default(''),
    insuranceType: z.enum(['rc_pro', 'decennale', 'both']).default('rc_pro'),
    mediatorName: z.string().default(''),
    mediatorUrl: z.string().default(''),
    isHorsEtablissement: z.boolean().default(false),
    tvaEnabled: z.boolean(),
    tvaNumber: z.string().default(''),
    clientName: z.string().min(1),
    clientEmail: z.string().default(''),
    clientAddress: z.string().min(1),
    interventionAddress: z.string().default(''),
    clientPhone: z.string().default(''),
    clientSiret: z.string().default(''),
    clientType: z.string().optional(),
    docDate: z.string().min(1),
    docValidity: z.number().default(30),
    prestationDate: z.string().default(''),
    executionDelay: z.string().default(''),
    executionDelayDays: z.number().default(0),
    executionDelayType: z.enum(['ouvres', 'calendaires']).default('ouvres'),
    paymentMode: z.string().default('Virement bancaire'),
    paymentDue: z.string().default(''),
    paymentCondition: z.string().default(''),
    discount: z.string().default(''),
    iban: z.string().default(''),
    bic: z.string().default(''),
    lines: z.array(z.object({
      id: z.number(),
      description: z.string(),
      qty: z.number(),
      unit: z.string(),
      customUnit: z.string().optional(),
      priceHT: z.number(),
      tvaRate: z.number(),
      totalHT: z.number(),
      source: z.enum(['etape_motif', 'manual']).optional(),
    })).min(1),
    notes: z.string().default(''),
    acomptesEnabled: z.boolean().optional(),
    // F16: schema strict au lieu de z.any()
    acomptes: z.array(z.object({
      label: z.string().max(200).default(''),
      percentage: z.number().min(0).max(100).optional(),
      amount: z.number().min(0).optional(),
      dueDate: z.string().optional(),
    })).optional(),
  }),
  // PDF base64 optionnel — si fourni, on embed le XML dedans
  // Sinon on génère un PDF minimaliste
  pdfBase64: z.string().optional(),
})

export async function POST(req: NextRequest) {
  // F03: auth + rate limit obligatoires (CPU-intensive)
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const ip = getClientIP(req)
  if (!(await checkRateLimit(`facturx_${ip}`, 10, 60_000))) return rateLimitResponse()

  try {
    const body = await req.json()
    const parsed = facturxRequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { data, pdfBase64 } = parsed.data

    // ── 1. Générer le XML CII ──
    const xmlString = generateFacturXML(data)

    // ── 2. PDF de base ──
    let pdfBytes: Uint8Array

    if (pdfBase64) {
      // Utiliser le PDF transmis (généré par jsPDF côté client)
      const binaryStr = atob(pdfBase64)
      pdfBytes = new Uint8Array(binaryStr.length)
      for (let i = 0; i < binaryStr.length; i++) {
        pdfBytes[i] = binaryStr.charCodeAt(i)
      }
    } else {
      // Générer un PDF minimaliste avec pdf-lib comme fallback
      const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib')
      const doc = await PDFDocument.create()
      const page = doc.addPage([595, 842]) // A4
      const font = await doc.embedFont(StandardFonts.Helvetica)
      const boldFont = await doc.embedFont(StandardFonts.HelveticaBold)

      // Header
      page.drawText('FACTURE ÉLECTRONIQUE', {
        x: 50, y: 780,
        size: 18, font: boldFont,
        color: rgb(0.05, 0.05, 0.05),
      })
      page.drawText(data.docNumber, {
        x: 50, y: 755,
        size: 12, font,
        color: rgb(0.4, 0.4, 0.4),
      })
      page.drawLine({
        start: { x: 50, y: 745 }, end: { x: 545, y: 745 },
        thickness: 1, color: rgb(0.9, 0.63, 0.13),
      })

      // Emetteur
      page.drawText('ÉMETTEUR', { x: 50, y: 720, size: 9, font: boldFont, color: rgb(0.4, 0.4, 0.4) })
      page.drawText(data.companyName, { x: 50, y: 705, size: 11, font: boldFont, color: rgb(0.05, 0.05, 0.05) })
      page.drawText(`SIRET: ${data.companySiret}`, { x: 50, y: 690, size: 9, font, color: rgb(0.3, 0.3, 0.3) })
      page.drawText(data.companyAddress, { x: 50, y: 677, size: 9, font, color: rgb(0.3, 0.3, 0.3) })

      // Destinataire
      page.drawText('DESTINATAIRE', { x: 310, y: 720, size: 9, font: boldFont, color: rgb(0.4, 0.4, 0.4) })
      page.drawText(data.clientName, { x: 310, y: 705, size: 11, font: boldFont, color: rgb(0.05, 0.05, 0.05) })
      page.drawText(data.clientAddress, { x: 310, y: 690, size: 9, font, color: rgb(0.3, 0.3, 0.3) })

      // Date
      page.drawText(`Date: ${data.docDate}`, { x: 50, y: 645, size: 10, font, color: rgb(0.3, 0.3, 0.3) })

      // Lines header
      const tableY = 615
      page.drawRectangle({ x: 50, y: tableY - 4, width: 495, height: 18, color: rgb(0.05, 0.05, 0.05) })
      page.drawText('Désignation', { x: 55, y: tableY, size: 9, font: boldFont, color: rgb(1, 1, 1) })
      page.drawText('Qté', { x: 340, y: tableY, size: 9, font: boldFont, color: rgb(1, 1, 1) })
      page.drawText('PU HT', { x: 390, y: tableY, size: 9, font: boldFont, color: rgb(1, 1, 1) })
      page.drawText('Total HT', { x: 460, y: tableY, size: 9, font: boldFont, color: rgb(1, 1, 1) })

      // Lines
      let lineY = tableY - 20
      for (const line of data.lines.slice(0, 20)) {
        const desc = line.description.replace(/\n/g, ' ').substring(0, 50)
        page.drawText(desc, { x: 55, y: lineY, size: 8, font, color: rgb(0.1, 0.1, 0.1) })
        page.drawText(String(line.qty), { x: 340, y: lineY, size: 8, font, color: rgb(0.1, 0.1, 0.1) })
        page.drawText(`${line.priceHT.toFixed(2)} €`, { x: 390, y: lineY, size: 8, font, color: rgb(0.1, 0.1, 0.1) })
        page.drawText(`${line.totalHT.toFixed(2)} €`, { x: 460, y: lineY, size: 8, font, color: rgb(0.1, 0.1, 0.1) })
        lineY -= 15
        if (lineY < 100) break
      }

      // Totals
      const subtotalHT = data.lines.reduce((s, l) => s + l.totalHT, 0)
      const totalTVA = data.tvaEnabled ? data.lines.reduce((s, l) => s + l.totalHT * l.tvaRate / 100, 0) : 0
      const totalTTC = subtotalHT + totalTVA

      const totalsY = lineY - 15
      page.drawText(`Sous-total HT: ${subtotalHT.toFixed(2)} €`, { x: 380, y: totalsY, size: 9, font, color: rgb(0.3, 0.3, 0.3) })
      if (data.tvaEnabled) {
        page.drawText(`TVA: ${totalTVA.toFixed(2)} €`, { x: 380, y: totalsY - 14, size: 9, font, color: rgb(0.3, 0.3, 0.3) })
      }
      page.drawRectangle({ x: 370, y: totalsY - 38, width: 175, height: 18, color: rgb(0.96, 0.96, 0.95) })
      page.drawText(`TOTAL TTC: ${totalTTC.toFixed(2)} €`, { x: 380, y: totalsY - 32, size: 11, font: boldFont, color: rgb(0.05, 0.05, 0.05) })

      // Footer
      page.drawText('Document généré par Vitfix.io — Factur-X BASIC EN 16931', {
        x: 50, y: 40,
        size: 7, font,
        color: rgb(0.6, 0.6, 0.6),
      })

      pdfBytes = await doc.save()
    }

    // ── 3. Embedder le XML dans le PDF → PDF/A-3 ──
    const facturXBytes = await embedFacturX(pdfBytes, xmlString)

    // ── 4. Retourner le PDF Factur-X ──
    const filename = `facturx_${data.docNumber.replace(/[^a-zA-Z0-9-_]/g, '_')}_${data.clientName.replace(/\s+/g, '_').substring(0, 20)}.pdf`

    return new NextResponse(Buffer.from(facturXBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Facturx-Profile': 'BASIC',
        'X-Facturx-Version': '1.0',
      },
    })

  } catch (err) {
    console.error('[facturx/generate] Error:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la génération Factur-X', details: String(err) },
      { status: 500 }
    )
  }
}
