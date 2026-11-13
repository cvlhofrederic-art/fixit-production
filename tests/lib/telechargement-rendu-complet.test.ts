// Téléchargement d'un document artisan depuis la liste ou dans un ZIP (lib/pdf/download-saved-devis.ts,
// chemin V2). Document au rendu complet (lib/version-rendu.ts) : mêmes paramètres que le bouton
// « Télécharger » du formulaire — matériaux, frais annexes, tables personnalisées, détail de la TVA,
// échéance saisie. Document d'avant la correction : paramètres d'origine, PDF identique.
// Le générateur est remplacé par un espion ; son rendu est couvert par pdf-v2-rendu-complet.test.ts.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const recu = vi.hoisted(() => ({ v2: [] as Array<Record<string, unknown>> }))

vi.mock('@/lib/supabase', () => {
  const chaine: Record<string, unknown> = {}
  chaine.select = () => chaine
  chaine.eq = () => chaine
  chaine.single = async () => ({ data: { logo_url: null }, error: null })
  return { supabase: { from: () => chaine } }
})
vi.mock('@/lib/pdf/devis-generator-v2', () => ({
  generateDevisPdfV2: vi.fn(async (entree: Record<string, unknown>) => {
    recu.v2.push(entree)
    return { output: () => new TextEncoder().encode('%PDF-v2').buffer, save: () => undefined }
  }),
}))
vi.mock('@/lib/pdf/pdfa3-wrap', () => ({ wrapAsPdfA3: vi.fn(async () => new TextEncoder().encode('%PDF-a3')) }))

import { produireFichierDocument } from '@/lib/pdf/download-saved-devis'

const ctx = { locale: 'fr' as const, t: (k: string) => k, artisan: { id: 'art-1', company_name: 'Plomberie Test EI' }, useBtpDesign: false }

const FACTURE = {
  id: 'a1', docType: 'facture' as const, docNumber: 'FACT-2026-090', docTitle: 'Salle de bain', docDate: '2026-11-13',
  sentAt: '2026-11-13T09:00:00.000Z', clientName: 'M. Test', tvaEnabled: true, insuranceName: 'AXA', insuranceNumber: 'RC-1',
  paymentCondition: '30 jours', paymentDue: '2026-12-20',
  lines: [{ id: 1, description: 'Pose', qty: 1, unit: 'f', priceHT: 1000, tvaRate: 10, totalHT: 1000 }],
  materialLines: [{ id: 2, description: 'Carrelage', qty: 10, unit: 'm2', priceHT: 30, tvaRate: 20, totalHT: 300 }],
  fraisAnnexes: [{ id: 3, designation: 'Déplacement', categorie: 'deplacement', quantite: 1, unite: 'forfait', prix_unitaire_ht: 45, tva_applicable: 20, total_ht: 45 }],
  customTables: [{ id: 't1', name: 'Isolation', lines: [{ id: 4, description: 'Isolant', qty: 1, unit: 'u', priceHT: 200, tvaRate: 5.5, totalHT: 200 }] }],
}

beforeEach(() => {
  vi.clearAllMocks()
  recu.v2.length = 0
})

describe('liste et ZIP — document artisan au rendu complet', () => {
  it('toutes les lignes, détail de la TVA et échéance saisie, comme le formulaire', async () => {
    await produireFichierDocument({ ...FACTURE, versionRendu: 2 } as never, ctx)
    const e = recu.v2[0] as { lignes: Array<{ designation: string; section: string | null }>; tvaBreakdown: unknown; versionRendu: number; devis: { paymentDue: string } }
    expect(e.lignes.map((l) => [l.designation, l.section])).toEqual([
      ['Pose', 'labor'], ['Carrelage', 'materiaux'], ['Déplacement', 'frais_annexes'], ['Isolant', 'custom_t1'],
    ])
    expect(e.tvaBreakdown).toEqual([
      { rate: 20, base: 345, amount: 69 },
      { rate: 10, base: 1000, amount: 100 },
      { rate: 5.5, base: 200, amount: 11 },
    ])
    expect(e.versionRendu).toBe(2)
    expect(e.devis.paymentDue).toBe('2026-12-20')
  })

  it('franchise en base : pas de détail de TVA', async () => {
    await produireFichierDocument({ ...FACTURE, versionRendu: 2, tvaEnabled: false } as never, ctx)
    expect(recu.v2[0].tvaBreakdown).toBeUndefined()
  })
})

describe('liste et ZIP — document artisan d avant la correction', () => {
  it('paramètres d origine : prestations seules, sans TVA ni tables, échéance tirée de la condition', async () => {
    await produireFichierDocument(FACTURE as never, ctx)
    const e = recu.v2[0] as { lignes: Array<{ designation: string }>; mode_affichage: string; devis: { paymentDue: string } }
    expect(e.lignes.map((l) => l.designation)).toEqual(['Pose'])
    expect(e.mode_affichage).toBe('bloc')
    expect('tvaBreakdown' in e && e.tvaBreakdown !== undefined).toBe(false)
    expect('versionRendu' in e).toBe(false)
    expect(e.devis.paymentDue).toBe('30 jours')
  })
})
