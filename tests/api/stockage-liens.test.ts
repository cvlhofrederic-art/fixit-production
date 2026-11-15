// @vitest-environment node
// POST /api/stockage/liens — liens frais vers les documents du compte connecté (Conformité, Références).
// Seuls les dossiers que /api/upload réserve au compte (wallet/ et portfolio/ du compte ou de sa fiche) sont signés ;
// toute autre valeur rend null, sans signature. Aucune écriture.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const PROJET = 'https://projet-test.supabase.co'
const USER_ID = '550e8400-e29b-41d4-a716-446655440000'
const FICHE_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const AUTRE_FICHE = 'ffffffff-0000-4000-8000-000000000001'
const SEPT_JOURS = 60 * 60 * 24 * 7
const ancienLien = (chemin: string) => `${PROJET}/storage/v1/object/sign/artisan-documents/${chemin}?token=expire`
const lienFrais = (chemin: string) => `${PROJET}/storage/v1/object/sign/artisan-documents/${chemin}?token=frais`

const mocks = vi.hoisted(() => ({
  user: null as { id: string } | null,
  fiches: [] as Array<{ id: string }>,
  createSignedUrls: vi.fn(),
  update: vi.fn(),
}))

vi.mock('@/lib/auth-helpers', () => ({ getAuthUser: vi.fn(async () => mocks.user) }))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
  rateLimitResponse: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))
vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table !== 'profiles_artisan') throw new Error(`table inattendue : ${table}`)
      return {
        select: () => ({ eq: async () => ({ data: mocks.fiches, error: null }) }),
        update: mocks.update,
      }
    },
    storage: { from: () => ({ createSignedUrls: mocks.createSignedUrls }) },
  },
}))

async function demander(corps: unknown) {
  const { POST } = await import('@/app/api/stockage/liens/route')
  return POST(new Request('http://localhost/api/stockage/liens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer jeton' },
    body: JSON.stringify(corps),
  }) as never)
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', PROJET)
  mocks.user = { id: USER_ID }
  mocks.fiches = [{ id: FICHE_ID }]
  mocks.update.mockReset()
  mocks.createSignedUrls.mockReset().mockImplementation(async (chemins: string[]) => ({
    data: chemins.map((path) => ({ path, error: null, signedUrl: lienFrais(path) })),
    error: null,
  }))
})

describe('POST /api/stockage/liens', () => {
  it('signe les documents du compte (Conformité, Références), 7 jours, dans l’ordre reçu', async () => {
    const wallet = `wallet/${FICHE_ID}/rc_pro/0f8fad5b-d9cb-469f-a165-70867728950e.pdf`
    const reference = `portfolio/${FICHE_ID}/1b4e28ba-2fa1-11d2-883f-0016d3cca427.jpg`
    const walletCompte = `wallet/${USER_ID}/kbis/6ba7b810-9dad-11d1-80b4-00c04fd430c8.pdf`

    const res = await demander({ valeurs: [ancienLien(wallet), ancienLien(reference), walletCompte] })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ liens: [lienFrais(wallet), lienFrais(reference), lienFrais(walletCompte)] })
    expect(mocks.createSignedUrls).toHaveBeenCalledWith([wallet, reference, walletCompte], SEPT_JOURS)
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it.each([
    ['document d’une autre fiche', ancienLien(`wallet/${AUTRE_FICHE}/rc_pro/x.pdf`)],
    ['pièce d’inscription (hors Conformité et Références)', `${USER_ID}/kbis/x.pdf`],
    ['autre dossier du compte', `kbis/${USER_ID}/x.pdf`],
    ['remontée de dossier', `wallet/${FICHE_ID}/../${AUTRE_FICHE}/rc_pro/x.pdf`],
    ['autre site', 'https://exemple.org/wallet/x.pdf'],
  ])('%s : null, rien n’est signé', async (_cas, valeur) => {
    const res = await demander({ valeurs: [valeur] })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ liens: [null] })
    expect(mocks.createSignedUrls).not.toHaveBeenCalled()
  })

  it('sans session : 401', async () => {
    mocks.user = null
    const res = await demander({ valeurs: [] })
    expect(res.status).toBe(401)
  })

  it.each([
    ['valeurs absentes', {}],
    ['valeurs non textuelles', { valeurs: [42] }],
    ['plus de 100 valeurs', { valeurs: Array.from({ length: 101 }, (_, i) => `wallet/${FICHE_ID}/x/${i}.pdf`) }],
  ])('%s : 400', async (_cas, corps) => {
    const res = await demander(corps)
    expect(res.status).toBe(400)
    expect(mocks.createSignedUrls).not.toHaveBeenCalled()
  })

  it('liste vide : aucune requête au stockage', async () => {
    const res = await demander({ valeurs: [] })
    expect(await res.json()).toEqual({ liens: [] })
    expect(mocks.createSignedUrls).not.toHaveBeenCalled()
  })
})
