// @vitest-environment node
// /api/artisan-photos — photos de chantier des sociétés BTP (rôle pro_societe).
// La ligne artisan_photos recevait un lien signé valable 7 jours : au-delà, les miniatures de Photos chantier et les
// photos reprises dans les devis et rapports ne s'affichaient plus, alors que le fichier existait toujours.
// Pour une société BTP, la ligne garde désormais le chemin du fichier et chaque lecture rend un lien frais (même durée
// de 7 jours qu'avant, pour les photos jointes à un devis ou un rapport) ; un ancien lien expiré se relit aussi.
// Côté artisan, rien ne change (règle artisan / BTP) : le même défaut y reste, signalé à Frédéric.
// La liste et ses liens frais ne sont rendus qu'au propriétaire de la fiche (même contrôle que l'ajout, la modification
// et la suppression) : la fiche d'un autre compte répond 403, sans aucune photo lue ni aucun lien créé.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { verifyArtisanOwnership } from '@/lib/auth-helpers'

const PROJET = 'https://projet-test.supabase.co'
const USER_ID = '550e8400-e29b-41d4-a716-446655440000'
const AUTRE_COMPTE = '6ba7b810-9dad-41d1-80b4-00c04fd430c8'
const FICHE_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01])
const SEPT_JOURS = 60 * 60 * 24 * 7
const CHEMIN = `${FICHE_ID}/0f8fad5b-d9cb-469f-a165-70867728950e.jpg`
const CHEMIN_ANCIEN = `${FICHE_ID}/1b4e28ba-2fa1-11d2-883f-0016d3cca427.jpg`
const lienSigne = (chemin: string, jeton: string) => `${PROJET}/storage/v1/object/sign/artisan-photos/${chemin}?token=${jeton}`

const mocks = vi.hoisted(() => ({
  user: null as { id: string; app_metadata: Record<string, unknown> } | null,
  ficheDuCompte: true,
  tablesLues: [] as string[],
  lignes: [] as Array<Record<string, unknown>>,
  insert: vi.fn(),
  remove: vi.fn(),
  createSignedUrl: vi.fn(),
  createSignedUrls: vi.fn(),
}))

vi.mock('@/lib/auth-helpers', () => ({
  getAuthUser: vi.fn(async () => mocks.user),
  verifyArtisanOwnership: vi.fn(async () => (mocks.ficheDuCompte ? 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d' : null)),
}))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
  rateLimitResponse: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))
vi.mock('@/lib/supabase-server', () => {
  const FICHE = { id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', user_id: '550e8400-e29b-41d4-a716-446655440000' }
  return {
    supabaseAdmin: {
      from: (table: string) => {
        mocks.tablesLues.push(table)
        if (table === 'profiles_artisan') {
          return { select: () => ({ eq: () => ({ single: async () => ({ data: FICHE, error: null }) }) }) }
        }
        if (table !== 'artisan_photos') throw new Error(`table inattendue : ${table}`)
        const liste: Record<string, unknown> = {}
        for (const m of ['eq', 'order', 'is']) liste[m] = () => liste
        liste.limit = async () => ({ data: mocks.lignes.map((l) => ({ ...l })), error: null })
        liste.single = async () => ({ data: mocks.lignes[0] ? { ...mocks.lignes[0] } : null, error: null })
        return {
          select: () => liste,
          insert: (ligne: Record<string, unknown>) => {
            mocks.insert(ligne)
            return { select: () => ({ single: async () => ({ data: { id: 'photo-1', ...ligne }, error: null }) }) }
          },
          delete: () => ({ eq: async () => ({ error: null }) }),
        }
      },
      storage: {
        from: () => ({
          upload: async (chemin: string) => ({ data: { path: chemin }, error: null }),
          createSignedUrl: mocks.createSignedUrl,
          createSignedUrls: mocks.createSignedUrls,
          getPublicUrl: (p: string) => ({ data: { publicUrl: `${PROJET}/storage/v1/object/public/artisan-photos/${p}` } }),
          remove: mocks.remove,
        }),
      },
    },
  }
})

const route = () => import('@/app/api/artisan-photos/route')
const societe = () => ({ id: USER_ID, app_metadata: { role: 'pro_societe' } })
const artisan = () => ({ id: USER_ID, app_metadata: { role: 'artisan' } })

function deposer() {
  const fd = new FormData()
  fd.append('file', new File([JPG], 'chantier.jpg', { type: 'image/jpeg' }))
  fd.append('artisan_id', FICHE_ID)
  fd.append('source', 'desktop')
  return new Request('http://localhost/api/artisan-photos', { method: 'POST', body: fd })
}

async function lister() {
  const { GET } = await route()
  const res = await GET(new Request(`http://localhost/api/artisan-photos?artisan_id=${FICHE_ID}`, { headers: { Authorization: 'Bearer x' } }) as never)
  expect(res.status).toBe(200)
  return ((await res.json()) as { data: Array<{ url: string }> }).data
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', PROJET)
  mocks.ficheDuCompte = true
  mocks.tablesLues = []
  vi.mocked(verifyArtisanOwnership).mockClear()
  mocks.lignes = []
  mocks.insert.mockReset()
  mocks.remove.mockReset().mockResolvedValue({ error: null })
  mocks.createSignedUrl.mockReset().mockImplementation(async (p: string) => ({ data: { signedUrl: lienSigne(p, 'depot') }, error: null }))
  mocks.createSignedUrls.mockReset().mockImplementation(async (chemins: string[], duree: number) => ({
    data: chemins.map((path) => ({ path, error: null, signedUrl: lienSigne(path, `frais-${duree}`) })),
    error: null,
  }))
})

describe('POST /api/artisan-photos — société BTP', () => {
  it('enregistre le chemin du fichier, et la réponse porte un lien affichable', async () => {
    mocks.user = societe()
    const { POST } = await route()
    const res = await POST(deposer() as never)

    expect(res.status).toBe(200)
    const ligne = mocks.insert.mock.calls[0][0] as { url: string }
    expect(ligne.url).toMatch(new RegExp(`^${FICHE_ID}/[0-9a-f-]{36}\\.jpg$`))
    const corps = (await res.json()) as { data: { url: string } }
    expect(corps.data.url).toBe(lienSigne(ligne.url, `frais-${SEPT_JOURS}`))
  })

  it('artisan : inchangé, la ligne reçoit le lien signé comme avant', async () => {
    mocks.user = artisan()
    const { POST } = await route()
    const res = await POST(deposer() as never)

    expect(res.status).toBe(200)
    const ligne = mocks.insert.mock.calls[0][0] as { url: string }
    expect(ligne.url).toMatch(/\/object\/sign\/artisan-photos\/.+\?token=depot$/)
  })
})

describe('GET /api/artisan-photos — liens frais à la lecture', () => {
  beforeEach(() => {
    mocks.lignes = [
      { id: 'p1', artisan_id: FICHE_ID, url: CHEMIN },
      { id: 'p2', artisan_id: FICHE_ID, url: lienSigne(CHEMIN_ANCIEN, 'expire') },
    ]
  })

  it('société BTP : chemin enregistré et ancien lien expiré rendus en liens frais de 7 jours', async () => {
    mocks.user = societe()
    const photos = await lister()

    expect(photos.map((p) => p.url)).toEqual([
      lienSigne(CHEMIN, `frais-${SEPT_JOURS}`),
      lienSigne(CHEMIN_ANCIEN, `frais-${SEPT_JOURS}`),
    ])
    expect(mocks.createSignedUrls).toHaveBeenCalledTimes(1)
  })

  it('artisan : l’ancien lien est rendu tel qu’enregistré (inchangé)', async () => {
    mocks.user = artisan()
    mocks.lignes = [{ id: 'p2', artisan_id: FICHE_ID, url: lienSigne(CHEMIN_ANCIEN, 'expire') }]
    const photos = await lister()

    expect(photos.map((p) => p.url)).toEqual([lienSigne(CHEMIN_ANCIEN, 'expire')])
    expect(mocks.createSignedUrls).not.toHaveBeenCalled()
  })

  it('stockage indisponible : la valeur enregistrée est rendue telle quelle', async () => {
    mocks.user = societe()
    mocks.createSignedUrls.mockResolvedValueOnce({ data: null, error: { message: 'storage down' } })
    const photos = await lister()

    expect(photos.map((p) => p.url)).toEqual([CHEMIN, lienSigne(CHEMIN_ANCIEN, 'expire')])
  })
})

describe('GET /api/artisan-photos — fiche d’un autre compte', () => {
  it.each([
    ['client connecté, fiche d’une société BTP (photo enregistrée par son chemin)', 'client', CHEMIN],
    ['société BTP, fiche d’un autre compte (ancien lien expiré)', 'pro_societe', lienSigne(CHEMIN_ANCIEN, 'expire')],
  ])('%s : 403, ni photo lue ni lien créé', async (_cas, role, url) => {
    mocks.user = { id: AUTRE_COMPTE, app_metadata: { role } }
    mocks.ficheDuCompte = false
    mocks.lignes = [{ id: 'p1', artisan_id: FICHE_ID, url }]
    const { GET } = await route()
    const res = await GET(new Request(`http://localhost/api/artisan-photos?artisan_id=${FICHE_ID}`, { headers: { Authorization: 'Bearer x' } }) as never)

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Accès refusé' })
    expect(verifyArtisanOwnership).toHaveBeenCalledWith(AUTRE_COMPTE, FICHE_ID, expect.anything())
    expect(mocks.tablesLues).not.toContain('artisan_photos')
    expect(mocks.createSignedUrls).not.toHaveBeenCalled()
    expect(mocks.createSignedUrl).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/artisan-photos — fichier retiré aussi pour une photo enregistrée par son chemin', () => {
  it('retire le fichier du stockage à partir du chemin enregistré', async () => {
    mocks.user = societe()
    mocks.lignes = [{ artisan_id: FICHE_ID, url: CHEMIN }]
    const { DELETE } = await route()
    const res = await DELETE(new Request('http://localhost/api/artisan-photos?id=p1', { method: 'DELETE' }) as never)

    expect(res.status).toBe(200)
    expect(mocks.remove).toHaveBeenCalledWith([CHEMIN])
  })

  it('ancien lien signé : chemin extrait de l’URL, comme avant', async () => {
    mocks.user = artisan()
    mocks.lignes = [{ artisan_id: FICHE_ID, url: lienSigne(CHEMIN_ANCIEN, 'expire') }]
    const { DELETE } = await route()
    const res = await DELETE(new Request('http://localhost/api/artisan-photos?id=p2', { method: 'DELETE' }) as never)

    expect(res.status).toBe(200)
    expect(mocks.remove).toHaveBeenCalledWith([CHEMIN_ANCIEN])
  })
})
