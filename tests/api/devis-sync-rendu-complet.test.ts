// POST /api/devis/sync — montants enregistrés en base (total_ht_cents, total_tax_cents, total_ttc_cents)
// avec les vrais calculs (lib/devis-totals.ts, lib/totaux-artisan.ts) :
//   - document artisan au rendu complet (lib/version-rendu.ts) : TVA des frais annexes comptée
//     (`tva_applicable`), régime d'après `tvaEnabled` — mêmes montants que le formulaire ;
//   - document d'avant la correction : montants d'origine (TVA des frais ignorée), inchangés.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUpsert = vi.fn()
const mockFrom = vi.fn().mockImplementation((table: string) => {
  if (table === 'profiles_artisan') {
    return { select: () => ({ eq: async () => ({ data: [{ id: ARTISAN_ID }], error: null }), in: async () => ({ data: [], error: null }) }) }
  }
  if (table === 'pro_team_members') {
    return { select: () => ({ eq: () => ({ eq: async () => ({ data: [], error: null }) }) }) }
  }
  return {
    select: () => {
      const leaf = { maybeSingle: async () => ({ data: null, error: null }) }
      return { eq: () => ({ ...leaf, eq: () => leaf }) }
    },
    upsert: (...args: unknown[]) => ({ select: () => ({ single: () => mockUpsert(...args) }) }),
  }
})

vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin: { from: mockFrom } }))
vi.mock('@/lib/auth-helpers', () => ({ getAuthUser: async () => ({ id: ARTISAN_USER_ID }) }))
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/mocks-routes-api')).rateLimitPermissif())
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/logger', async () => (await import('../helpers/mocks-routes-api')).loggerSilencieux())

const ARTISAN_USER_ID = '00000000-0000-4000-8000-000000000011'
const ARTISAN_ID = '00000000-0000-4000-8000-000000000012'

// 1 000 € à 10 % + 300 € de matériaux à 20 % + 45 € de déplacement à 20 % : HT 1 345, TVA 169, TTC 1 514.
const FACTURE = {
  id: '6f1c2a34-0000-4000-8000-00000000f001', docType: 'facture', docNumber: 'FACT-2026-130', status: 'envoye',
  clientName: 'M. Test', tvaEnabled: true,
  lines: [{ id: 1, description: 'Pose', qty: 1, unit: 'f', priceHT: 1000, tvaRate: 10, totalHT: 1000 }],
  materialLines: [{ id: 2, description: 'Carrelage', qty: 10, unit: 'm2', priceHT: 30, tvaRate: 20, totalHT: 300 }],
  fraisAnnexes: [{ id: 3, designation: 'Déplacement', categorie: 'deplacement', quantite: 1, unite: 'forfait', prix_unitaire_ht: 45, tva_applicable: 20, total_ht: 45 }],
}

async function synchroniser(doc: Record<string, unknown>): Promise<Record<string, unknown>> {
  mockUpsert.mockResolvedValue({ data: { id: doc.id }, error: null })
  const { POST } = await import('@/app/api/devis/sync/route')
  const res = await POST(new Request('http://localhost:3000/api/devis/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test' },
    body: JSON.stringify({ docType: 'facture', artisanId: ARTISAN_ID, doc }),
  }) as never)
  expect(res.status).toBe(200)
  return mockUpsert.mock.calls.at(-1)![0] as Record<string, unknown>
}

beforeEach(() => {
  mockUpsert.mockReset()
  delete process.env.DOC_HASH_SECRET
})

describe('synchro — document artisan au rendu complet', () => {
  it('TVA des frais annexes comptée : mêmes montants que le formulaire', async () => {
    const p = await synchroniser({ ...FACTURE, versionRendu: 2 })
    expect(p.total_ht_cents).toBe(134500)
    expect(p.total_tax_cents).toBe(16900)
    expect(p.total_ttc_cents).toBe(151400)
    expect(p.regime_tva).toBe('classique')
  })

  it('franchise en base (tvaEnabled false) : TTC = HT, même si des lignes portent un taux', async () => {
    const p = await synchroniser({ ...FACTURE, versionRendu: 2, tvaEnabled: false })
    expect(p.total_tax_cents).toBe(0)
    expect(p.total_ttc_cents).toBe(134500)
    expect(p.regime_tva).toBe('franchise_293b')
  })
})

describe('synchro — document d avant la correction', () => {
  it('montants d origine : TVA des frais ignorée, régime classique par défaut', async () => {
    const p = await synchroniser(FACTURE)
    expect(p.total_ht_cents).toBe(134500)
    expect(p.total_tax_cents).toBe(16000) // 100 + 60, sans les 9 € de TVA du déplacement
    expect(p.total_ttc_cents).toBe(150500)
    expect(p.regime_tva).toBe('classique')
  })
})
