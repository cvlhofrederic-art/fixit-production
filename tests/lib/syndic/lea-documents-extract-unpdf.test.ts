// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { PDFDocument, StandardFonts } from 'pdf-lib'

// Test d'intégration réel (sans mock d'unpdf) : unpdf et son pdf.js embarqué lisent un PDF généré
// avec pdf-lib. Il garantit (1) que la version d'unpdf/pdf.js fonctionne sous le Node de la CI et
// (2) que le texte fusionné garde le format d'unpdf 1.4 (une seule ligne, blancs normalisés),
// sur lequel les parseurs aval (extract-pdf, analyse-devis, scoring) sont calibrés.

vi.mock('@/lib/groq', () => ({ callGroqWithRetry: vi.fn() }))
vi.mock('@/lib/env', () => ({
  getSecret: vi.fn(async () => ''),
  getCfEnv: vi.fn(async () => ({})),
}))

async function pdfDeTest(): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const page = doc.addPage([595, 842])
  page.drawText('Facture FACT-2026-007', { x: 50, y: 780, size: 14, font })
  page.drawText('Plomberie Dupont SARL', { x: 50, y: 750, size: 12, font })
  page.drawText('Total TTC 1250,50 EUR', { x: 50, y: 720, size: 12, font })
  const bytes = await doc.save()
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

describe('lib/syndic/lea-documents-extract — extractPdfText avec unpdf (sans mock)', () => {
  it("extrait le texte d'un PDF réel sur une seule ligne, blancs normalisés", async () => {
    const { extractPdfText } = await import('@/lib/syndic/lea-documents-extract')
    const { text, pages } = await extractPdfText(await pdfDeTest())
    expect(pages).toBe(1)
    expect(text).toContain('FACT-2026-007')
    expect(text).toContain('Plomberie Dupont SARL')
    expect(text).toContain('1250,50')
    // Format d'unpdf 1.4 conservé : aucun saut de ligne, jamais deux blancs consécutifs.
    expect(text).not.toMatch(/\n/)
    expect(text).not.toMatch(/\s{2}/)
  })
})
