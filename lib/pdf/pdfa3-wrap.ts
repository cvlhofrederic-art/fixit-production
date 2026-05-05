// ══════════════════════════════════════════════════════════════════════════════
// PDF/A-3 wrapper (FR-V2)
// ══════════════════════════════════════════════════════════════════════════════
// Conformité arrêté du 22 mars 2017 sur l'archivage électronique probant :
// les documents fiscaux conservés en numérique doivent être au format PDF/A
// (ISO 19005). Sans ça, un contrôle DGFiP peut requalifier l'archive
// numérique en non-probant et exiger l'original papier.
//
// PDF/A-3B (BASIC level conformity) suffit pour les documents commerciaux.
// PDF/A-3 (vs PDF/A-1, /A-2) accepte les fichiers attachés (utile si on
// embarquait un XML Factur-X plus tard).
//
// Pattern dérivé de lib/facturx.ts (qui fait Factur-X = PDF/A-3 + XML embedé).
// Ici on ne prend QUE le wrapping PDF/A-3, sans XML embarqué.

import { PDFDocument, PDFName, PDFString } from 'pdf-lib'

interface PdfA3Options {
  /** Titre du document — utilisé dans XMP metadata. */
  title: string
  /** Auteur — par défaut "Vitfix.io". */
  author?: string
  /** Description courte — par défaut le titre. */
  subject?: string
}

/**
 * Wrap an existing PDF (jsPDF output) as PDF/A-3B conformant.
 * Adds XMP metadata + sRGB output intent.
 */
export async function wrapAsPdfA3(
  pdfBytes: Uint8Array,
  opts: PdfA3Options,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes, { updateMetadata: false })

  // ── 1. XMP metadata (PDF/A-3B identification) ──
  const xmpMetadata = buildPdfA3XMP(opts)
  pdfDoc.catalog.set(
    PDFName.of('Metadata'),
    pdfDoc.context.stream(
      new TextEncoder().encode(xmpMetadata),
      { Type: PDFName.of('Metadata'), Subtype: PDFName.of('XML') },
    ),
  )

  // ── 2. Output intent for PDF/A-3 (sRGB) ──
  const outputIntent = pdfDoc.context.obj({
    Type: PDFName.of('OutputIntent'),
    S: PDFName.of('GTS_PDFA1'),
    OutputConditionIdentifier: PDFString.of('sRGB'),
    RegistryName: PDFString.of('http://www.color.org'),
    Info: PDFString.of('sRGB IEC61966-2.1'),
  })
  const outputIntentRef = pdfDoc.context.register(outputIntent)
  pdfDoc.catalog.set(PDFName.of('OutputIntents'), pdfDoc.context.obj([outputIntentRef]))

  // ── 3. Document-level metadata (Info dictionary) ──
  pdfDoc.setTitle(opts.title)
  pdfDoc.setAuthor(opts.author || 'Vitfix.io')
  pdfDoc.setSubject(opts.subject || opts.title)
  pdfDoc.setProducer('Vitfix.io PDF/A-3 wrapper')
  pdfDoc.setCreator('Vitfix Pro (jsPDF + pdf-lib)')

  return await pdfDoc.save({ useObjectStreams: false })
}

function buildPdfA3XMP(opts: PdfA3Options): string {
  const now = new Date().toISOString()
  const title = escapeXml(opts.title)
  const author = escapeXml(opts.author || 'Vitfix.io')

  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:dc="http://purl.org/dc/elements/1.1/"
      xmlns:pdf="http://ns.adobe.com/pdf/1.3/"
      xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
      <dc:title>
        <rdf:Alt>
          <rdf:li xml:lang="x-default">${title}</rdf:li>
        </rdf:Alt>
      </dc:title>
      <dc:creator>
        <rdf:Seq>
          <rdf:li>${author}</rdf:li>
        </rdf:Seq>
      </dc:creator>
      <dc:date>
        <rdf:Seq>
          <rdf:li>${now}</rdf:li>
        </rdf:Seq>
      </dc:date>
      <pdf:Producer>Vitfix.io PDF/A-3 wrapper</pdf:Producer>
      <pdfaid:part>3</pdfaid:part>
      <pdfaid:conformance>B</pdfaid:conformance>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
