// @vitest-environment node
// Téléchargement groupé des listes Devis et Factures : chaque PDF est produit comme par le bouton
// « Télécharger » de sa ligne, puis tous partent dans une seule archive ZIP (un document seul : son PDF).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { unzipSync, strFromU8 } from 'fflate'

vi.mock('@/lib/pdf/download-saved-devis', () => ({
  downloadSavedDevis: vi.fn(async () => undefined),
  produireFichierDocument: vi.fn(),
}))

import { nomUniqueDansArchive, telechargerDocumentsGroupes } from '@/lib/pdf/telechargement-groupe'
import { downloadSavedDevis, type DownloadContext, type FichierDocument, type SavedDevis } from '@/lib/pdf/download-saved-devis'

const CTX: DownloadContext = { locale: 'fr', t: (k: string) => k, artisan: { id: 'a1' }, useBtpDesign: true }
const octets = (texte: string) => new TextEncoder().encode(texte)

/** Production factice : le PDF « contient » le numéro du document ; les numéros de `enEchec` lèvent. */
function produireFactice(enEchec: string[] = []) {
  return vi.fn(async (doc: SavedDevis, _ctx: DownloadContext): Promise<FichierDocument> => {
    if (enEchec.includes(doc.docNumber || '')) throw new Error('PDF impossible')
    return { nom: `${doc.docNumber || 'devis'}.pdf`, octets: octets(`%PDF ${doc.docNumber || doc.clientName}`) }
  })
}

async function lireArchive(blob: Blob): Promise<Record<string, string>> {
  const fichiers = unzipSync(new Uint8Array(await blob.arrayBuffer()))
  return Object.fromEntries(Object.entries(fichiers).map(([nom, contenu]) => [nom, strFromU8(contenu)]))
}

beforeEach(() => { vi.clearAllMocks() })

describe('telechargerDocumentsGroupes', () => {
  it('plusieurs documents : une seule archive ZIP qui contient chaque PDF', async () => {
    const enregistrer = vi.fn()
    const produire = produireFactice()
    const progression = vi.fn()
    const docs = [{ docNumber: 'DEV-2026-001' }, { docNumber: 'DEV-2026-002' }, { docNumber: 'DEV-2026-003' }]
    const resultat = await telechargerDocumentsGroupes(docs, CTX, { nomArchive: 'Devis_2026-11-11', produire, enregistrer, onProgression: progression })

    expect(resultat).toEqual({ telecharges: 3, echecs: [], raison: null, archive: 'Devis_2026-11-11.zip' })
    expect(produire).toHaveBeenCalledTimes(3)
    expect(produire.mock.calls.map(c => c[1])).toEqual([CTX, CTX, CTX]) // même contexte (modèle) que le bouton de la ligne
    expect(enregistrer).toHaveBeenCalledTimes(1)
    const [blob, nom] = enregistrer.mock.calls[0] as [Blob, string]
    expect(nom).toBe('Devis_2026-11-11.zip')
    expect(blob.type).toBe('application/zip')
    expect(await lireArchive(blob)).toEqual({
      'DEV-2026-001.pdf': '%PDF DEV-2026-001',
      'DEV-2026-002.pdf': '%PDF DEV-2026-002',
      'DEV-2026-003.pdf': '%PDF DEV-2026-003',
    })
    expect(progression.mock.calls).toEqual([[1, 3], [2, 3], [3, 3]])
    expect(downloadSavedDevis).not.toHaveBeenCalled()
  })

  it('un seul document : son PDF, téléchargé comme par le bouton de la ligne, sans archive', async () => {
    const enregistrer = vi.fn()
    const produire = produireFactice()
    const doc = { docNumber: 'FACT-2026-040' }
    const resultat = await telechargerDocumentsGroupes([doc], CTX, { nomArchive: 'Factures', produire, enregistrer })

    expect(resultat).toEqual({ telecharges: 1, echecs: [], raison: null, archive: null })
    expect(downloadSavedDevis).toHaveBeenCalledWith(doc, CTX)
    expect(produire).not.toHaveBeenCalled()
    expect(enregistrer).not.toHaveBeenCalled()
  })

  it('un document en échec n\'empêche pas les autres ; il est signalé', async () => {
    const enregistrer = vi.fn()
    const docs = [{ docNumber: 'FACT-1' }, { docNumber: 'FACT-2' }, { docNumber: 'FACT-3' }]
    const resultat = await telechargerDocumentsGroupes(docs, CTX, { nomArchive: 'Factures', produire: produireFactice(['FACT-2']), enregistrer })

    expect(resultat).toEqual({ telecharges: 2, echecs: ['FACT-2'], raison: null, archive: 'Factures.zip' })
    expect(Object.keys(await lireArchive(enregistrer.mock.calls[0][0] as Blob))).toEqual(['FACT-1.pdf', 'FACT-3.pdf'])
  })

  it('tous en échec : aucune archive vide n\'est téléchargée', async () => {
    const enregistrer = vi.fn()
    const docs = [{ docNumber: 'A' }, { docNumber: 'B' }]
    const resultat = await telechargerDocumentsGroupes(docs, CTX, { nomArchive: 'Devis', produire: produireFactice(['A', 'B']), enregistrer })
    expect(resultat).toEqual({ telecharges: 0, echecs: ['A', 'B'], raison: null, archive: null })
    expect(enregistrer).not.toHaveBeenCalled()
  })

  it('raison du premier échec métier (assurance RC Pro manquante) : rendue, sur une ligne', async () => {
    const produire = vi.fn(async () => { throw new Error('Assurance RC Pro obligatoire pour générer un devis\n(art. L243-2 C. assurances)') })
    const resultat = await telechargerDocumentsGroupes([{ docNumber: 'A' }, { docNumber: 'B' }], CTX, { nomArchive: 'Devis', produire })
    expect(resultat.raison).toBe('Assurance RC Pro obligatoire pour générer un devis (art. L243-2 C. assurances)')
  })

  it('erreur technique (message brut d\'exception) : jamais rendue comme raison', async () => {
    const produire = vi.fn(async () => { throw new TypeError("Cannot read properties of undefined (reading 'lines')") })
    const resultat = await telechargerDocumentsGroupes([{ docNumber: 'A' }, { docNumber: 'B' }], CTX, { nomArchive: 'Devis', produire })
    expect(resultat).toMatchObject({ telecharges: 0, echecs: ['A', 'B'], raison: null })
  })

  it('un seul document en échec : signalé, rien ne part', async () => {
    vi.mocked(downloadSavedDevis).mockRejectedValueOnce(new Error('jsPDF'))
    const resultat = await telechargerDocumentsGroupes([{ clientName: 'M. Brouillon' }], CTX, { nomArchive: 'Devis' })
    expect(resultat).toEqual({ telecharges: 0, echecs: ['M. Brouillon'], raison: null, archive: null })
  })

  it('brouillons sans numéro : « Brouillon - <type> - <client> », distincts dans l\'archive (rien n\'est écrasé)', async () => {
    const enregistrer = vi.fn()
    const docs = [
      { docType: 'devis' as const, clientName: 'A' }, { docType: 'devis' as const, clientName: 'A' },
      { docType: 'facture' as const, clientName: 'B' }, { docType: 'devis' as const }, { docNumber: 'DEV-2026-001', clientName: 'A' },
    ]
    await telechargerDocumentsGroupes(docs, CTX, { nomArchive: 'Devis', produire: produireFactice(), enregistrer })
    expect(Object.keys(await lireArchive(enregistrer.mock.calls[0][0] as Blob))).toEqual([
      'Brouillon - Devis - A.pdf',
      'Brouillon - Devis - A (2).pdf',
      'Brouillon - Facture - B.pdf',
      'Brouillon - Devis.pdf',
      'DEV-2026-001.pdf', // numéroté : nom du bouton de la ligne, inchangé
    ])
  })

  it('brouillons en portugais : « Rascunho - Fatura - <client> »', async () => {
    const enregistrer = vi.fn()
    const docs = [{ docType: 'facture' as const, clientName: 'Cliente' }, { docNumber: 'FT-1' }]
    await telechargerDocumentsGroupes(docs, { ...CTX, locale: 'pt' }, { nomArchive: 'Faturas', produire: produireFactice(), enregistrer })
    expect(Object.keys(await lireArchive(enregistrer.mock.calls[0][0] as Blob))).toEqual(['Rascunho - Fatura - Cliente.pdf', 'FT-1.pdf'])
  })

  it('aucun document : rien', async () => {
    const enregistrer = vi.fn()
    expect(await telechargerDocumentsGroupes([], CTX, { nomArchive: 'Devis', enregistrer })).toEqual({ telecharges: 0, echecs: [], raison: null, archive: null })
    expect(enregistrer).not.toHaveBeenCalled()
  })
})

describe('nomUniqueDansArchive', () => {
  it('remplace les caractères interdits sous Windows et retire les caractères de contrôle', () => {
    expect(nomUniqueDansArchive('Facture_FACT/2026:01_A*B?.pdf', new Set())).toBe('Facture_FACT-2026-01_A-B-.pdf')
    expect(nomUniqueDansArchive('DEV\u0007-1.pdf', new Set())).toBe('DEV-1.pdf')
  })

  it('numérote les doublons, sans tenir compte des majuscules', () => {
    const pris = new Set<string>()
    expect(nomUniqueDansArchive('DEV-1.pdf', pris)).toBe('DEV-1.pdf')
    expect(nomUniqueDansArchive('dev-1.PDF', pris)).toBe('dev-1 (2).pdf')
    expect(nomUniqueDansArchive('DEV-1.pdf', pris)).toBe('DEV-1 (3).pdf')
  })

  it('nom vide ou réduit à l\'extension : « document.pdf »', () => {
    expect(nomUniqueDansArchive('', new Set())).toBe('document.pdf')
    expect(nomUniqueDansArchive('.pdf', new Set())).toBe('document.pdf')
    expect(nomUniqueDansArchive('Devis 12', new Set())).toBe('Devis 12.pdf')
  })
})
