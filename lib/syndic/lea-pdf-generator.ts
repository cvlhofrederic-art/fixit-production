// P4 Léa Documents — Générateur PDF depuis template avec placeholders.
//
// Stratégie de templating :
// Le template PDF est un PDF arbitraire qui contient des balises sous la forme
// `{{key}}` dans le texte. pdf-lib ne supporte pas un remplacement de texte
// brut « in-place » (la position des glyphes est figée), donc on adopte une
// approche pragmatique en deux passes :
//   1. Si le PDF embarque déjà des champs AcroForm avec le même nom que les
//      placeholders, on les remplit via setText() — c'est le chemin canonique.
//   2. Sinon, on ajoute une page récapitulative en fin de PDF listant chaque
//      placeholder + sa valeur (audit + fallback exploitable même sans form).
//
// Cette approche garantit qu'un template fourni par Frédéric (PDF avec champs
// AcroForm) fonctionne « clé en main », et qu'un template plus simple sans
// AcroForm reste utilisable (avec la page récap).
import { PDFDocument, StandardFonts } from 'pdf-lib'

export interface PdfFieldValue {
  key: string
  label?: string
  value: string
}

export interface GeneratePdfResult {
  bytes: Uint8Array
  filled_fields: string[]
  unfilled_fields: string[]
}

export async function generatePdfFromTemplate(
  templateBytes: ArrayBuffer | Uint8Array,
  fields: PdfFieldValue[],
): Promise<GeneratePdfResult> {
  const pdfDoc = await PDFDocument.load(templateBytes)

  const filled: string[] = []
  const unfilled: string[] = []

  // 1. Tente de remplir les champs AcroForm si présents
  let form: ReturnType<typeof pdfDoc.getForm> | null = null
  try {
    form = pdfDoc.getForm()
  } catch {
    form = null
  }

  if (form) {
    const formFields = form.getFields()
    const formFieldNames = new Set(formFields.map(f => f.getName()))
    for (const { key, value } of fields) {
      if (formFieldNames.has(key)) {
        try {
          const textField = form.getTextField(key)
          textField.setText(value)
          filled.push(key)
        } catch {
          unfilled.push(key)
        }
      } else {
        unfilled.push(key)
      }
    }
    // Flatten pour figer les valeurs (sécurité : empêche modification ultérieure)
    if (filled.length > 0) {
      form.flatten()
    }
  } else {
    unfilled.push(...fields.map(f => f.key))
  }

  // 2. Ajoute une page récapitulative s'il reste des champs non remplis OU
  //    si aucun AcroForm n'a été trouvé (template plain text).
  if (unfilled.length > 0) {
    const helv = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const helvBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const page = pdfDoc.addPage()
    const { width, height } = page.getSize()
    const margin = 50
    let y = height - margin

    page.drawText('Données du document', {
      x: margin, y, size: 18, font: helvBold,
    })
    y -= 30

    page.drawText('Champs renseignés automatiquement :', {
      x: margin, y, size: 11, font: helvBold,
    })
    y -= 20

    for (const { key, label, value } of fields) {
      if (y < margin + 40) break // pagination basique : tronque si trop long
      const labelText = label || key
      // Wrap basique 90 chars
      const valueText = value.length > 80 ? `${value.slice(0, 80)}…` : value
      page.drawText(`${labelText} :`, { x: margin, y, size: 10, font: helvBold })
      page.drawText(valueText, { x: margin + 150, y, size: 10, font: helv, maxWidth: width - margin - 160 })
      y -= 16
    }

    if (filled.length > 0) {
      y -= 10
      // Note: Helvetica StandardFont supporte WinAnsi (accents Latin-1 OK) mais
      // pas les glyphes Unicode étendus (✓, emojis…). On reste donc en ASCII étendu.
      page.drawText(`[OK] ${filled.length} champ(s) injectes directement dans le formulaire du modele.`, {
        x: margin, y, size: 9, font: helv,
      })
    }
  }

  const bytes = await pdfDoc.save()
  return { bytes, filled_fields: filled, unfilled_fields: unfilled }
}
