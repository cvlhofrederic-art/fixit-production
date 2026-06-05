import { describe, it, expect } from 'vitest'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { generatePdfFromTemplate } from '@/lib/syndic/lea-pdf-generator'

async function buildPlainTemplate(): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  page.drawText('Template plain (sans AcroForm)', { x: 50, y: 700, size: 14, font })
  return doc.save()
}

async function buildAcroFormTemplate(): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage()
  const form = doc.getForm()
  const nameField = form.createTextField('nom_copro')
  nameField.addToPage(page, { x: 50, y: 700, width: 200, height: 20 })
  const totalField = form.createTextField('montant_total')
  totalField.addToPage(page, { x: 50, y: 670, width: 200, height: 20 })
  return doc.save()
}

describe('generatePdfFromTemplate', () => {
  it('ajoute une page récap quand le PDF n\'a pas d\'AcroForm', async () => {
    const tpl = await buildPlainTemplate()
    const result = await generatePdfFromTemplate(tpl, [
      { key: 'nom', label: 'Nom', value: 'Madame Dupont' },
      { key: 'montant', label: 'Montant', value: '1250.00 €' },
    ])
    expect(result.filled_fields).toEqual([])
    expect(result.unfilled_fields).toEqual(['nom', 'montant'])
    // Vérifier que le PDF résultant a au moins 2 pages (template + récap)
    const out = await PDFDocument.load(result.bytes)
    expect(out.getPageCount()).toBeGreaterThanOrEqual(2)
  })

  it('remplit les champs AcroForm correspondants', async () => {
    const tpl = await buildAcroFormTemplate()
    const result = await generatePdfFromTemplate(tpl, [
      { key: 'nom_copro', label: 'Copropriété', value: 'Résidence Vitfix' },
      { key: 'montant_total', label: 'Total', value: '3200.50 €' },
    ])
    expect(result.filled_fields).toEqual(expect.arrayContaining(['nom_copro', 'montant_total']))
    expect(result.unfilled_fields).toEqual([])
    expect(result.bytes.byteLength).toBeGreaterThan(0)
  })

  it('marque comme unfilled les champs sans correspondance dans le formulaire', async () => {
    const tpl = await buildAcroFormTemplate()
    const result = await generatePdfFromTemplate(tpl, [
      { key: 'nom_copro', value: 'A' },
      { key: 'inexistant', label: 'Champ inconnu', value: 'X' },
    ])
    expect(result.filled_fields).toContain('nom_copro')
    expect(result.unfilled_fields).toContain('inexistant')
  })
})
