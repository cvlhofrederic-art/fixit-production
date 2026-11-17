// produireFichierDocument (téléchargement groupé des listes Devis et Factures) : même PDF que le bouton
// « Télécharger » de la ligne — même générateur, mêmes paramètres — rendu à l'appelant au lieu d'être
// téléchargé. Et le bouton de la ligne télécharge toujours le même fichier qu'avant.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const recu = vi.hoisted(() => ({
  v3: [] as Array<Record<string, unknown>>,
  v2: [] as Array<Record<string, unknown>>,
  wrapEchoue: false,
  blobs: [] as Blob[],
  clics: [] as Array<{ download: string; href: string }>,
  /** Noms passés à pdf.save (enregistrement jsPDF du PDF brut, repli quand l'habillage PDF/A-3 échoue). */
  enregistrementsJsPdf: [] as string[],
}))

vi.mock('@/lib/supabase', () => {
  const chaine: Record<string, unknown> = {}
  chaine.select = () => chaine
  chaine.eq = () => chaine
  chaine.single = async () => ({ data: { paiement_modes: [], categories: null, type_activite: null, logo_url: null }, error: null })
  return { supabase: { from: () => chaine } }
})

vi.mock('@/lib/pdf/devis-pdf-v3', () => ({
  generateDevisPdfV3: vi.fn(async (entree: Record<string, unknown>) => {
    recu.v3.push(entree)
    return { filename: 'Facture_FACT-2026-040_SCI_Martin.pdf', pdfArrayBuffer: new ArrayBuffer(4), fichier: new TextEncoder().encode('%PDF-v3-final') }
  }),
}))

vi.mock('@/lib/pdf/devis-generator-v2', () => ({
  generateDevisPdfV2: vi.fn(async (entree: Record<string, unknown>) => {
    recu.v2.push(entree)
    return {
      output: () => new TextEncoder().encode('%PDF-brut').buffer,
      save: (nom: string) => { recu.enregistrementsJsPdf.push(nom) },
    }
  }),
}))

vi.mock('@/lib/pdf/pdfa3-wrap', () => ({
  wrapAsPdfA3: vi.fn(async () => {
    if (recu.wrapEchoue) throw new Error('pdf-lib')
    return new TextEncoder().encode('%PDF-avec-metadonnees')
  }),
}))

import { downloadSavedDevis, produireFichierDocument } from '@/lib/pdf/download-saved-devis'
import { generateDevisPdfV3 } from '@/lib/pdf/devis-pdf-v3'

const FACTURE = {
  id: 'f1', docType: 'facture' as const, docNumber: 'FACT-2026-040', docTitle: 'Ravalement', docDate: '2026-10-17',
  sentAt: '2026-10-17T09:00:00.000Z', clientName: 'SCI Martin', clientType: 'professionnel' as const,
  lines: [{ id: 1, description: 'Lavage', qty: 1, unit: 'f', priceHT: 100, tvaRate: 20, totalHT: 100 }],
}
const ctx = (useBtpDesign: boolean) => ({
  locale: 'fr' as const, t: (k: string) => k, artisan: { id: '11111111-2222-3333-4444-555555555555', company_name: 'SUD TRAVAUX' }, useBtpDesign,
})
// Paramètres comparables d'un appel à l'autre : les fonctions (t, aides du navigateur) sont recréées à chaque appel.
const sansFonctions = (entree: Record<string, unknown>) => JSON.parse(JSON.stringify(entree)) as Record<string, unknown>
const lireBlob = (blob: Blob) => new Promise<string>((ok, ko) => {
  const lecteur = new FileReader()
  lecteur.onload = () => ok(String(lecteur.result))
  lecteur.onerror = () => ko(lecteur.error)
  lecteur.readAsText(blob)
})

const createObjectURL = URL.createObjectURL
const revokeObjectURL = URL.revokeObjectURL
let clic: { mockRestore: () => void } | null = null
beforeEach(() => {
  vi.clearAllMocks()
  recu.v3.length = 0; recu.v2.length = 0; recu.blobs.length = 0; recu.clics.length = 0; recu.wrapEchoue = false
  recu.enregistrementsJsPdf.length = 0
  URL.createObjectURL = vi.fn((blob: Blob) => { recu.blobs.push(blob); return 'blob:test' })
  URL.revokeObjectURL = vi.fn()
  clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    recu.clics.push({ download: this.download, href: this.href })
  })
})
afterEach(() => {
  URL.createObjectURL = createObjectURL
  URL.revokeObjectURL = revokeObjectURL
  clic?.mockRestore()
})

describe('produireFichierDocument — BTP (modèle V3)', () => {
  it('rend le fichier final du générateur V3 (Factur-X compris), sans rien télécharger', async () => {
    const fichier = await produireFichierDocument(FACTURE, ctx(true))
    expect(vi.mocked(generateDevisPdfV3)).toHaveBeenCalledTimes(1)
    expect(recu.v3[0].action).toBe('fichier')
    expect(fichier.nom).toBe('Facture_FACT-2026-040_SCI_Martin.pdf')
    expect(new TextDecoder().decode(fichier.octets)).toBe('%PDF-v3-final')
    expect(recu.blobs).toHaveLength(0)
    expect(recu.clics).toHaveLength(0)
  })

  it('mêmes paramètres que le bouton « Télécharger » de la ligne : seul le mode change', async () => {
    await downloadSavedDevis(FACTURE, ctx(true))
    await produireFichierDocument(FACTURE, ctx(true))
    const [telechargement, groupe] = recu.v3.map(sansFonctions)
    expect(telechargement.action).toBe('download')
    expect({ ...groupe, action: 'download' }).toEqual(telechargement)
  })
})

describe('produireFichierDocument — artisan (modèle V2)', () => {
  it('rend le PDF avec ses métadonnées, nommé comme au téléchargement, sans rien télécharger', async () => {
    const fichier = await produireFichierDocument(FACTURE, ctx(false))
    expect(fichier.nom).toBe('FACT-2026-040.pdf')
    expect(new TextDecoder().decode(fichier.octets)).toBe('%PDF-avec-metadonnees')
    expect(recu.blobs).toHaveLength(0)
    expect(recu.clics).toHaveLength(0)
  })

  it('mêmes paramètres du générateur V2 que le bouton de la ligne', async () => {
    await downloadSavedDevis(FACTURE, ctx(false))
    await produireFichierDocument(FACTURE, ctx(false))
    const [telechargement, groupe] = recu.v2.map(sansFonctions)
    expect(groupe).toEqual(telechargement)
  })

  it('métadonnées impossibles à ajouter : le PDF brut, comme au téléchargement, sans rien enregistrer', async () => {
    recu.wrapEchoue = true
    const fichier = await produireFichierDocument(FACTURE, ctx(false))
    expect(new TextDecoder().decode(fichier.octets)).toBe('%PDF-brut')
    expect(fichier).toEqual({ nom: 'FACT-2026-040.pdf', octets: fichier.octets }) // rien d'autre que le fichier
    expect(recu.enregistrementsJsPdf).toHaveLength(0)
    expect(recu.clics).toHaveLength(0)
  })
})

describe('downloadSavedDevis (bouton de la ligne) — même mécanisme et même fichier qu\'avant', () => {
  it('artisan : télécharge « <numéro>.pdf » avec ses métadonnées', async () => {
    await downloadSavedDevis(FACTURE, ctx(false))
    expect(recu.clics).toEqual([{ download: 'FACT-2026-040.pdf', href: 'blob:test' }])
    expect(recu.blobs[0].type).toBe('application/pdf')
    expect(await lireBlob(recu.blobs[0])).toBe('%PDF-avec-metadonnees')
  })

  it('artisan, métadonnées impossibles : le PDF brut enregistré par jsPDF (pdf.save), comme avant', async () => {
    recu.wrapEchoue = true
    await downloadSavedDevis({ ...FACTURE, docNumber: '' }, ctx(false))
    expect(recu.enregistrementsJsPdf).toEqual(['devis.pdf'])
    expect(recu.clics).toHaveLength(0)
  })

  it('BTP : le générateur V3 télécharge lui-même (mode « download »)', async () => {
    await downloadSavedDevis(FACTURE, ctx(true))
    expect(recu.v3[0].action).toBe('download')
    expect(recu.clics).toHaveLength(0) // le V3 factice ne télécharge rien : aucun lien créé par download-saved-devis
  })
})
