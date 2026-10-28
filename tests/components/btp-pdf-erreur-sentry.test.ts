// @vitest-environment node
// Lot 6 Sentry du 28/10/2026 : l'échec de génération d'un PDF BTP (aperçu ou téléchargement) est attrapé, affiché
// (toast) et remonté à Sentry avec l'action et le type de document ; l'aperçu passe par lib/pdf/apercu-pdf.ts.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8')

describe('formulaire BTP : erreurs PDF', () => {
  const source = lire('components/DevisFactureFormBTP.tsx')
  const debut = source.indexOf('const generatePdf = async (action')
  const fin = source.indexOf('/* ──────── Rentabilité', debut)
  const generatePdf = source.slice(debut, fin)

  it('generatePdf attrape l’erreur, l’affiche et la remonte à Sentry avec pdf_action et doc_type', () => {
    expect(debut).toBeGreaterThan(0)
    expect(generatePdf).toContain('await generateDevisPdfV3({')
    expect(generatePdf).toContain('} catch (err: unknown) {')
    expect(generatePdf).toContain('Sentry.captureException(err, { tags: { pdf_action: action, doc_type: docType } })')
    expect(generatePdf).toContain('toast.error(`Erreur PDF : ${msg}`)')
  })
})

describe('générateur V3 : aperçu sans rejet non géré', () => {
  const source = lire('lib/pdf/devis-pdf-v3.ts')

  it('l’aperçu passe par ouvrirApercuOuTelecharger, plus de window.open direct', () => {
    expect(source).toContain("import { DELAI_REVOCATION_TELECHARGEMENT_MS, ouvrirApercuOuTelecharger, telechargerParLien } from '@/lib/pdf/apercu-pdf'")
    expect(source).toContain('ouvrirApercuOuTelecharger(namedFile, filename)')
    expect(source).not.toMatch(/window\.open\(url/)
  })
})
