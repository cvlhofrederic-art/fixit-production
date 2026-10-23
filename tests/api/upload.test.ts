// @vitest-environment node
// POST /api/upload — dossier de destination et URL de portfolio.
//   - folder : racine connue + segments [A-Za-z0-9_-], 4 niveaux au plus ; un « ../ » sortait du bucket
//     autorisé (upload en service role). Les dossiers réellement envoyés par l'application restent acceptés.
//   - photo_url (field=portfolio_photo) : seule une URL https est gardée dans portfolio_photos, affiché
//     sur la page publique de l'artisan.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const USER_ID = '550e8400-e29b-41d4-a716-446655440000'
const ARTISAN_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  update: vi.fn(),
  user: { id: '550e8400-e29b-41d4-a716-446655440000' } as { id: string } | null,
}))

vi.mock('@/lib/auth-helpers', () => ({ getAuthUser: vi.fn(async () => mocks.user) }))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
  rateLimitResponse: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table !== 'profiles_artisan') throw new Error(`table inattendue : ${table}`)
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: { id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', user_id: '550e8400-e29b-41d4-a716-446655440000', portfolio_photos: [] },
              error: null,
            }),
          }),
        }),
        update: (valeurs: Record<string, unknown>) => {
          mocks.update(valeurs)
          return { eq: async () => ({ error: null }) }
        },
      }
    },
    storage: {
      from: () => ({
        upload: mocks.upload,
        createSignedUrl: async (p: string) => ({ data: { signedUrl: `https://signe/${p}` }, error: null }),
        getPublicUrl: (p: string) => ({ data: { publicUrl: `https://public/${p}` } }),
      }),
    },
  },
}))

function requete(champs: Record<string, string | File>) {
  const fd = new FormData()
  for (const [cle, valeur] of Object.entries(champs)) fd.append(cle, valeur)
  return new Request('http://localhost/api/upload', { method: 'POST', body: fd })
}

const image = () => new File([PNG], 'photo.png', { type: 'image/png' })

async function appeler(champs: Record<string, string | File>) {
  const { POST } = await import('@/app/api/upload/route')
  return POST(requete({ file: image(), ...champs }) as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.user = { id: USER_ID }
  mocks.upload.mockImplementation(async (chemin: string) => ({ data: { path: chemin }, error: null }))
})

describe('POST /api/upload — dossier', () => {
  it.each([
    ['messages'],
    ['clients'],
    ['en-quotes'],
    ['syndic-ged'],
    ['syndic-interventions'],
    ['kbis'],
    [`portfolio/${ARTISAN_ID}`],
    [`wallet/${ARTISAN_ID}/rc_pro`],
    [`syndic-logos/${USER_ID}`],
  ])('accepte le dossier envoyé par l’application : %s', async (folder) => {
    const res = await appeler({ folder })
    expect(res.status).toBe(200)
    const chemin = mocks.upload.mock.calls[0][0] as string
    expect(chemin.startsWith(`${folder}/`)).toBe(true)
  })

  it('prend « misc » quand aucun dossier n’est fourni', async () => {
    const res = await appeler({})
    expect(res.status).toBe(200)
    expect((mocks.upload.mock.calls[0][0] as string).startsWith('misc/')).toBe(true)
  })

  it.each([
    ['../profile-photos'],
    ['misc/../../autre-bucket'],
    ['.'],
    ['portfolio/..'],
    ['/misc'],
    ['misc//x'],
    ['misc\\..\\x'],
    ['inconnu'],
    ['wallet/a/b/c/d'],
    ['misc/%2e%2e'],
  ])('refuse le dossier %s sans rien envoyer au stockage', async (folder) => {
    const res = await appeler({ folder })
    expect(res.status).toBe(400)
    expect(mocks.upload).not.toHaveBeenCalled()
  })
})

describe('POST /api/upload — photo de portfolio', () => {
  const champsPortfolio = (photoUrl: string) => ({
    folder: `portfolio/${ARTISAN_ID}`,
    artisan_id: ARTISAN_ID,
    field: 'portfolio_photo',
    photo_url: photoUrl,
  })

  it('ne garde pas une URL javascript: dans portfolio_photos', async () => {
    const res = await appeler(champsPortfolio('javascript:alert(document.cookie)'))
    expect(res.status).toBe(200)
    const valeurs = mocks.update.mock.calls[0][0] as { portfolio_photos: Array<{ url: string }> }
    expect(valeurs.portfolio_photos[0].url).toMatch(/^https:\/\/signe\/portfolio\//)
  })

  it('garde une URL https fournie', async () => {
    const res = await appeler(champsPortfolio('https://stockage.vitfix.io/photo.png'))
    expect(res.status).toBe(200)
    const valeurs = mocks.update.mock.calls[0][0] as { portfolio_photos: Array<{ url: string }> }
    expect(valeurs.portfolio_photos[0].url).toBe('https://stockage.vitfix.io/photo.png')
  })
})
