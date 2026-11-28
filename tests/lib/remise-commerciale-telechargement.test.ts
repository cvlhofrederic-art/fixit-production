// Téléchargement d'un document remisé depuis les listes (lib/pdf/download-saved-devis.ts) : ce que
// reçoivent les générateurs PDF BTP (V3) et artisan (V2). Les générateurs sont remplacés par des
// espions ; leur rendu est couvert par tests/lib/remise-commerciale-pdf.test.ts.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const recu = vi.hoisted(() => ({
  v3: [] as Array<Record<string, unknown>>,
  v2: [] as Array<Record<string, unknown>>,
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
    return { filename: 'devis.pdf', pdfArrayBuffer: new ArrayBuffer(4), fichier: new TextEncoder().encode('%PDF-v3') }
  }),
}))
vi.mock('@/lib/pdf/devis-generator-v2', () => ({
  generateDevisPdfV2: vi.fn(async (entree: Record<string, unknown>) => {
    recu.v2.push(entree)
    return { output: () => new TextEncoder().encode('%PDF-v2').buffer, save: () => undefined }
  }),
}))
vi.mock('@/lib/pdf/pdfa3-wrap', () => ({ wrapAsPdfA3: vi.fn(async () => new TextEncoder().encode('%PDF-a3')) }))

import { produireFichierDocument } from '@/lib/pdf/download-saved-devis'

const ctx = (useBtpDesign: boolean) => ({
  locale: 'fr' as const, t: (k: string) => k, artisan: { id: '11111111-2222-3333-4444-555555555555', company_name: 'BATIR TEST SAS' }, useBtpDesign,
})

// Devis BTP : 900 € à 20 % (1 000 € moins 10 % sur la ligne) + 500 € à 10 %, remise globale de 10 %.
const DEVIS_BTP = {
  id: 'd1', docType: 'devis' as const, docNumber: 'DEV-2026-050', docTitle: 'Ravalement', docDate: '2026-11-13',
  clientName: 'SCI Test', clientType: 'professionnel' as const, regimeTva: 'classique' as const, tvaEnabled: true,
  lines: [
    { id: 1, description: 'Ravalement', qty: 1, unit: 'f', priceHT: 1000, tvaRate: 20, totalHT: 900, remise: { type: 'pourcentage' as const, valeur: 10 } },
    { id: 2, description: 'Échafaudage', qty: 1, unit: 'f', priceHT: 500, tvaRate: 10, totalHT: 500 },
  ],
  remiseGlobale: { type: 'pourcentage', valeur: 10 },
}

beforeEach(() => {
  vi.clearAllMocks()
  recu.v3.length = 0
  recu.v2.length = 0
})

describe('PDF BTP téléchargé depuis la liste', () => {
  it('HT net, HT brut, remise et TVA sur les bases remisées', async () => {
    await produireFichierDocument(DEVIS_BTP, ctx(true))
    const e = recu.v3[0]
    expect(e.subtotalHT).toBe(1260)
    expect(e.totalHTBrut).toBe(1400)
    expect(e.remiseGlobale).toEqual({ montantHT: 140, libelle: 'Remise commerciale (10 %)', base: 1400 })
    expect(e.tvaBreakdown).toEqual([{ rate: 10, base: 450, amount: 45 }, { rate: 20, base: 810, amount: 162 }])
    expect(e.totalTTC).toBe(1467)
  })

  it('facture de solde : la base de la remise exclut les acomptes déduits', async () => {
    const solde = {
      ...DEVIS_BTP, docType: 'facture' as const, docNumber: 'FACT-2026-051',
      customTables: [{ id: 'acomptes-deduits', name: 'Acomptes', lines: [
        { id: 101, description: 'Acompte déjà facturé', qty: 1, unit: 'f', priceHT: -300, tvaRate: 20, totalHT: -300, horsRemise: true },
      ] }],
    }
    await produireFichierDocument(solde, ctx(true))
    const e = recu.v3[0]
    expect(e.remiseGlobale).toEqual({ montantHT: 140, libelle: 'Remise commerciale (10 %)', base: 1400 })
    expect(e.subtotalHT).toBe(960) // 1 400 − 140 − 300
  })

  it('sans remise : paramètres d origine (pas de HT brut ni de remise)', async () => {
    const { remiseGlobale: _r, ...sansRemise } = DEVIS_BTP
    await produireFichierDocument({ ...sansRemise, lines: [{ ...DEVIS_BTP.lines[1] }] }, ctx(true))
    const e = recu.v3[0]
    expect('remiseGlobale' in e).toBe(false)
    expect('totalHTBrut' in e).toBe(false)
    expect(e.subtotalHT).toBe(500)
  })
})

describe('PDF artisan téléchargé depuis la liste', () => {
  const DEVIS_ARTISAN = {
    id: 'a1', docType: 'facture' as const, docNumber: 'FACT-2026-060', docTitle: 'Plomberie', docDate: '2026-11-13',
    sentAt: '2026-11-13T09:00:00.000Z', clientName: 'M. Test', tvaEnabled: false,
    insuranceName: 'AXA', insuranceNumber: 'RC-1',
    lines: [{ id: 1, description: 'Remplacement chauffe-eau', qty: 1, unit: 'f', priceHT: 1000, tvaRate: 0, totalHT: 900, remise: { type: 'pourcentage' as const, valeur: 10 } }],
    remiseGlobale: { type: 'montant', valeur: 50 },
    discount: '2 % si paiement sous 8 jours',
  }

  it('colonne Remise et remise globale transmises au PDF', async () => {
    await produireFichierDocument(DEVIS_ARTISAN, ctx(false))
    const e = recu.v2[0] as { lignes: Array<{ remise?: string; total: number }>; remiseGlobale?: unknown }
    expect(e.lignes[0]).toMatchObject({ remise: '-10 %', total: 900 })
    expect(e.remiseGlobale).toEqual({ montantHT: 50, libelle: 'Remise commerciale', totalBrutHT: 900, totalHT: 850 })
  })

  // Facture à TVA : 1 000 € à 10 % et un tableau personnalisé de 500 € à 20 %, remise globale de 10 %.
  const AVEC_TABLEAU = {
    ...DEVIS_ARTISAN, tvaEnabled: true,
    lines: [{ id: 1, description: 'Remplacement chauffe-eau', qty: 1, unit: 'f', priceHT: 1000, tvaRate: 10, totalHT: 1000 }],
    customTables: [{ id: 't1', name: 'Salle de bain', lines: [{ id: 2, description: 'Faïence', qty: 1, unit: 'f', priceHT: 500, tvaRate: 20, totalHT: 500 }] }],
    remiseGlobale: { type: 'pourcentage', valeur: 10 },
  }

  it('document remisé : mêmes données que le formulaire, remise sur tout le document', async () => {
    await produireFichierDocument(AVEC_TABLEAU, ctx(false))
    const e = recu.v2[0] as { lignes: Array<{ total: number }>; remiseGlobale?: unknown; tvaBreakdown?: unknown }
    expect(e.lignes.map((l) => l.total)).toEqual([1000, 500])
    expect(e.remiseGlobale).toEqual({ montantHT: 150, libelle: 'Remise commerciale (10 %)', totalBrutHT: 1500, totalHT: 1350 })
    expect(e.tvaBreakdown).toEqual([{ rate: 20, base: 450, amount: 90 }, { rate: 10, base: 900, amount: 90 }])
  })

  it('document sans remise aux données incomplètes : téléchargé comme avant, sans erreur', async () => {
    const { remiseGlobale: _r, ...sansRemise } = AVEC_TABLEAU
    for (const abime of [
      { ...sansRemise, customTables: [null, { id: 't2', name: 'Sans lignes' }] },
      { ...sansRemise, customTables: 'illisible' },
      { ...sansRemise, materialLines: 'illisible', fraisAnnexes: [null] },
    ]) {
      recu.v2.length = 0
      await produireFichierDocument(abime as never, ctx(false))
      const e = recu.v2[0] as { lignes: Array<{ total: number }>; tvaBreakdown?: unknown }
      expect(e.lignes.map((l) => l.total)).toEqual([1000])
      expect(e.tvaBreakdown).toBeUndefined()
    }
  })

  it('document sans remise : paramètres d origine (tableau et détail de TVA non transmis, comme avant)', async () => {
    const { remiseGlobale: _r, ...sansRemise } = AVEC_TABLEAU
    await produireFichierDocument(sansRemise, ctx(false))
    const e = recu.v2[0] as { lignes: Array<{ total: number }>; remiseGlobale?: unknown; tvaBreakdown?: unknown }
    expect(e.lignes.map((l) => l.total)).toEqual([1000])
    expect(e.tvaBreakdown).toBeUndefined()
    expect('remiseGlobale' in e).toBe(false)
  })

  it('escompte : imprimé seulement pour un document marqué, l ancien garde « Aucun escompte »', async () => {
    await produireFichierDocument(DEVIS_ARTISAN, ctx(false))
    await produireFichierDocument({ ...DEVIS_ARTISAN, escompteSurPdf: true }, ctx(false))
    expect('escompte' in recu.v2[0]).toBe(false)
    expect(recu.v2[1].escompte).toBe('2 % si paiement sous 8 jours')
  })
})
