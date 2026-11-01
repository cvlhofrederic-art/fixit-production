// @vitest-environment node
// POST /api/upload — dossier de destination, URL de portfolio, mise à jour du profil.
//   - folder : racine connue + segments [A-Za-z0-9_-], 4 niveaux au plus ; un « ../ » sortait du bucket
//     autorisé (upload en service role). Les dossiers réellement envoyés par l'application restent acceptés.
//   - photo_url (field=portfolio_photo) : seule une URL https est gardée dans portfolio_photos, affiché
//     sur la page publique de l'artisan.
//   - portfolio_photos n'existe pas en production (relevé du 23/10/2026) : la recherche de la fiche ne
//     la sélectionne plus, sinon chaque mise à jour du profil (Kbis, assurance, photo, logo) répondait 404.
//   - dossiers wallet/{fiche}/…, portfolio/{fiche}, syndic-logos/{user} : l'identifiant doit être celui du
//     compte connecté (ou de sa fiche artisan) ; nom de fichier généré côté serveur (UUID + extension de la
//     liste blanche), jamais le nom du client (lib/security/storage-path.ts).
//   - racines sans propriétaire (misc, kbis, messages, syndic-ged…) : le compte connecté est inséré en tête
//     sous la racine ({racine}/{user}/…), un identifiant envoyé dans folder ne devient jamais le dossier de tête.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const USER_ID = '550e8400-e29b-41d4-a716-446655440000'
const ARTISAN_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const AUTRE_ID = 'ffffffff-0000-4000-8000-000000000001'
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  update: vi.fn(),
  loggerError: vi.fn(),
  user: { id: '550e8400-e29b-41d4-a716-446655440000' } as { id: string } | null,
  // Colonnes que la base simulée ne connaît pas (comme PostgREST : erreur 42703 si sélectionnées).
  colonnesAbsentes: [] as string[],
}))

vi.mock('@/lib/auth-helpers', () => ({ getAuthUser: vi.fn(async () => mocks.user) }))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
  getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
  rateLimitResponse: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: mocks.loggerError, warn: vi.fn(), info: vi.fn() },
}))

vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table !== 'profiles_artisan') throw new Error(`table inattendue : ${table}`)
      const ligne: Record<string, unknown> = {
        id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        portfolio_photos: [],
      }
      return {
        select: (colonnes: string) => ({
          eq: () => ({
            single: async () => {
              const demandees = colonnes.split(',').map(c => c.trim())
              const absente = demandees.find(c => mocks.colonnesAbsentes.includes(c))
              if (absente) {
                return { data: null, error: { code: '42703', message: `column profiles_artisan.${absente} does not exist` } }
              }
              return { data: Object.fromEntries(demandees.map(c => [c, ligne[c]])), error: null }
            },
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
  mocks.colonnesAbsentes = []
  mocks.upload.mockImplementation(async (chemin: string) => ({ data: { path: chemin }, error: null }))
})

describe('POST /api/upload — dossier', () => {
  it.each([
    ['messages', `messages/${USER_ID}/`],
    ['clients', `clients/${USER_ID}/`],
    ['en-quotes', `en-quotes/${USER_ID}/`],
    ['syndic-ged', `syndic-ged/${USER_ID}/`],
    ['syndic-interventions', `syndic-interventions/${USER_ID}/`],
    ['kbis', `kbis/${USER_ID}/`],
    // Sous-dossier demandé sur une racine sans propriétaire : conservé, mais derrière le compte connecté
    [`syndic-ged/${AUTRE_ID}/pv`, `syndic-ged/${USER_ID}/${AUTRE_ID}/pv/`],
    [`portfolio/${ARTISAN_ID}`, `portfolio/${ARTISAN_ID}/`],
    [`wallet/${ARTISAN_ID}/rc_pro`, `wallet/${ARTISAN_ID}/rc_pro/`],
    [`syndic-logos/${USER_ID}`, `syndic-logos/${USER_ID}/`],
  ])('accepte le dossier envoyé par l’application : %s → écrit sous %s', async (folder, prefixe) => {
    const res = await appeler({ folder })
    expect(res.status).toBe(200)
    const chemin = mocks.upload.mock.calls[0][0] as string
    expect(chemin.startsWith(prefixe)).toBe(true)
    expect(await res.json()).toMatchObject({ success: true, path: chemin })
  })

  it('prend « misc » quand aucun dossier n’est fourni, sous le compte connecté', async () => {
    const res = await appeler({})
    expect(res.status).toBe(200)
    expect((mocks.upload.mock.calls[0][0] as string).startsWith(`misc/${USER_ID}/`)).toBe(true)
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

  it.each([
    [`wallet/${AUTRE_ID}/rc_pro`],
    [`portfolio/${AUTRE_ID}`],
    [`syndic-logos/${AUTRE_ID}`],
  ])('refuse un dossier appartenant à un autre compte (%s) : 403, rien envoyé', async (folder) => {
    const res = await appeler({ folder })
    expect(res.status).toBe(403)
    expect(mocks.upload).not.toHaveBeenCalled()
  })

  it('refuse un dossier à propriétaire sans identifiant (wallet seul) : 400, rien envoyé', async () => {
    const res = await appeler({ folder: 'wallet' })
    expect(res.status).toBe(400)
    expect(mocks.upload).not.toHaveBeenCalled()
  })

  it('nomme le fichier côté serveur : UUID + extension du type accepté, jamais le nom du client', async () => {
    const res = await appeler({ folder: 'misc', file: new File([PNG], '../../evil.html', { type: 'image/png' }) })
    expect(res.status).toBe(200)
    const chemin = mocks.upload.mock.calls[0][0] as string
    expect(chemin).toMatch(new RegExp(`^misc/${USER_ID}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.png$`))
    expect(await res.json()).toMatchObject({ success: true, path: chemin })
  })
})

describe('POST /api/upload — photo de portfolio', () => {
  // L'origine du stockage Supabase est lue dans NEXT_PUBLIC_SUPABASE_URL (lib/security/safe-url.ts).
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://projet-test.supabase.co')
  })

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

  it('garde une URL https fournie si elle vient du stockage Supabase (la seule que la page publique ouvre)', async () => {
    const fournie = 'https://projet-test.supabase.co/storage/v1/object/public/portfolio/photo.png'
    const res = await appeler(champsPortfolio(fournie))
    expect(res.status).toBe(200)
    const valeurs = mocks.update.mock.calls[0][0] as { portfolio_photos: Array<{ url: string }> }
    expect(valeurs.portfolio_photos[0].url).toBe(fournie)
  })

  it('remplace une URL https d’une autre origine par celle du fichier envoyé', async () => {
    const res = await appeler(champsPortfolio('https://stockage.vitfix.io/photo.png'))
    expect(res.status).toBe(200)
    const valeurs = mocks.update.mock.calls[0][0] as { portfolio_photos: Array<{ url: string }> }
    expect(valeurs.portfolio_photos[0].url).toMatch(/^https:\/\/signe\/portfolio\//)
  })

  it('colonne portfolio_photos absente : fichier envoyé, profil non modifié, erreur journalisée', async () => {
    mocks.colonnesAbsentes = ['portfolio_photos']
    const res = await appeler(champsPortfolio('https://stockage.vitfix.io/photo.png'))
    expect(res.status).toBe(200)
    expect(mocks.upload).toHaveBeenCalledTimes(1)
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.loggerError).toHaveBeenCalledWith('[UPLOAD] Lecture portfolio_photos:', expect.objectContaining({ code: '42703' }))
  })
})

describe('POST /api/upload — mise à jour du profil', () => {
  it.each([
    ['kbis_url', 'kbis', 'artisan-documents'],
    ['insurance_url', 'insurance', 'artisan-documents'],
    ['profile_photo_url', 'profiles', 'profile-photos'],
    ['logo_url', 'logos', 'profile-photos'],
  ])('%s mis à jour même sans colonne portfolio_photos (schéma de production)', async (field, folder, bucket) => {
    mocks.colonnesAbsentes = ['portfolio_photos']
    const res = await appeler({ folder, bucket, artisan_id: ARTISAN_ID, field })
    expect(res.status).toBe(200)
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ [field]: expect.stringMatching(/^https:\/\//) }))
  })
})
