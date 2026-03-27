// ═══════════════════════════════════════════════
// FACTUR-X PDF/A-3 GENERATOR
// Takes an existing PDF (jsPDF output) + CII XML
// and produces a Factur-X compliant PDF/A-3
// Uses pdf-lib (pure JS, serverless compatible)
// ═══════════════════════════════════════════════

import { PDFDocument, PDFName, PDFString, PDFArray, PDFDict, PDFHexString, PDFStream } from 'pdf-lib'

// ── Relationship entry for AF (Associated Files) ──
const FACTURX_FILENAME = 'factur-x.xml'
const FACTURX_RELATIONSHIP = 'Data' // Alternative or Data for BASIC profile

/**
 * Embed Factur-X XML into a PDF and set PDF/A-3 metadata.
 *
 * @param pdfBytes - The original PDF as Uint8Array (from jsPDF)
 * @param xmlString - The Factur-X CII XML string
 * @returns Uint8Array of the Factur-X compliant PDF
 */
export async function embedFacturX(
  pdfBytes: Uint8Array,
  xmlString: string
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes, { updateMetadata: false })

  // ── 1. Set PDF/A-3 identification via XMP metadata ──
  const xmpMetadata = buildXMPMetadata(pdfDoc)
  pdfDoc.catalog.set(
    PDFName.of('Metadata'),
    pdfDoc.context.stream(
      new TextEncoder().encode(xmpMetadata),
      { Type: PDFName.of('Metadata'), Subtype: PDFName.of('XML') }
    )
  )

  // ── 2. Embed the XML as an embedded file ──
  const xmlBytes = new TextEncoder().encode(xmlString)

  // Create the file spec dictionary
  const embeddedFileStream = pdfDoc.context.stream(xmlBytes, {
    Type: PDFName.of('EmbeddedFile'),
    Subtype: PDFName.of('text/xml'),
  })
  const embeddedFileStreamRef = pdfDoc.context.register(embeddedFileStream)

  // EF dictionary (Embedded File)
  const efDict = pdfDoc.context.obj({
    F: embeddedFileStreamRef,
    UF: embeddedFileStreamRef,
  })

  // FileSpec dictionary
  const fileSpec = pdfDoc.context.obj({
    Type: PDFName.of('Filespec'),
    F: PDFString.of(FACTURX_FILENAME),
    UF: PDFHexString.fromText(FACTURX_FILENAME),
    Desc: PDFString.of('Factur-X invoice data (CII XML)'),
    AFRelationship: PDFName.of(FACTURX_RELATIONSHIP),
    EF: efDict,
  })
  const fileSpecRef = pdfDoc.context.register(fileSpec)

  // ── 3. Add to catalog's AF (Associated Files) array ──
  const afArray = pdfDoc.context.obj([fileSpecRef])
  pdfDoc.catalog.set(PDFName.of('AF'), afArray)

  // ── 4. Add to Names/EmbeddedFiles ──
  const namesDict = pdfDoc.context.obj({
    Names: [PDFString.of(FACTURX_FILENAME), fileSpecRef],
  })
  const namesDictRef = pdfDoc.context.register(namesDict)

  const catalogNames = pdfDoc.context.obj({
    EmbeddedFiles: namesDictRef,
  })
  pdfDoc.catalog.set(PDFName.of('Names'), catalogNames)

  // ── 5. Mark output intent for PDF/A-3 ──
  const outputIntent = pdfDoc.context.obj({
    Type: PDFName.of('OutputIntent'),
    S: PDFName.of('GTS_PDFA1'),
    OutputConditionIdentifier: PDFString.of('sRGB'),
    RegistryName: PDFString.of('http://www.color.org'),
    Info: PDFString.of('sRGB IEC61966-2.1'),
  })
  const outputIntentRef = pdfDoc.context.register(outputIntent)
  pdfDoc.catalog.set(PDFName.of('OutputIntents'), pdfDoc.context.obj([outputIntentRef]))

  // ── 6. Save ──
  return await pdfDoc.save()
}

/**
 * Build XMP metadata packet for PDF/A-3B identification
 */
function buildXMPMetadata(pdfDoc: PDFDocument): string {
  const now = new Date().toISOString()

  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:dc="http://purl.org/dc/elements/1.1/"
      xmlns:pdf="http://ns.adobe.com/pdf/1.3/"
      xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"
      xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#">
      <dc:title>
        <rdf:Alt>
          <rdf:li xml:lang="x-default">Factur-X Invoice</rdf:li>
        </rdf:Alt>
      </dc:title>
      <dc:creator>
        <rdf:Seq>
          <rdf:li>Vitfix.io</rdf:li>
        </rdf:Seq>
      </dc:creator>
      <dc:date>
        <rdf:Seq>
          <rdf:li>${now}</rdf:li>
        </rdf:Seq>
      </dc:date>
      <pdf:Producer>Vitfix.io / pdf-lib</pdf:Producer>
      <pdfaid:part>3</pdfaid:part>
      <pdfaid:conformance>B</pdfaid:conformance>
      <fx:DocumentType>INVOICE</fx:DocumentType>
      <fx:DocumentFileName>${FACTURX_FILENAME}</fx:DocumentFileName>
      <fx:Version>1.0</fx:Version>
      <fx:ConformanceLevel>BASIC</fx:ConformanceLevel>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`
}
