// @vitest-environment node
// POST /api/save-logo — photo de profil et logo de l'artisan connecté.
//   - L'image part dans Supabase Storage (bucket public profile-photos, dossiers profiles/ et logos/ comme
//     /api/upload) et la colonne reçoit l'URL https publique, vérifiée par une requête HEAD.
//   - Si l'envoi échoue (bucket absent ou privé, erreur réseau), la data: URL est enregistrée comme avant, et l'erreur
//     est journalisée : aucune régression pour l'artisan. Au-delà de 10 envois en 10 minutes : 429, rien n'est écrit.
//   - Même validation (Zod : 700 000 caractères au plus, champ logo_url ou profile_photo_url) plus le contrôle du
//     contenu (JPEG, PNG, WebP ou GIF réels) ; la ligne modifiée est toujours celle de l'utilisateur connecté.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const USER_A = '550e8400-e29b-41d4-a716-446655440000'
const USER_B = '660e8400-e29b-41d4-a716-446655440001'
const USER_SANS_FICHE = '770e8400-e29b-41d4-a716-446655440002'
const ARTISAN_A = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const ARTISAN_B = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e'
const URL_PUBLIQUE = 'https://irluhepekbqgquveaett.supabase.co/storage/v1/object/public'

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3]

const dataUrl = (type: string, octets: number[]) => `data:${type};base64,${Buffer.from(octets).toString('base64')}`

const mocks = vi.hoisted(() => ({
  user: null as { id: string } | null,
  limiteOk: true,
  upload: vi.fn(),
  remove: vi.fn(),
  fetch: vi.fn(),
  update: vi.fn(),
  selectUserId: vi.fn(),
  erreurUpdate: null as { message: string } | null,
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
  bucket: vi.fn(),
}))

vi.mock('@/lib/auth-helpers', () => ({ getAuthUser: vi.fn(async () => mocks.user) }))

vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: vi.fn(async () => mocks.limiteOk) }))

vi.mock('@/lib/logger', () => ({
  logger: { error: mocks.loggerError, warn: mocks.loggerWarn, info: vi.fn() },
}))

vi.mock('@/lib/supabase-server', () => {
  const lignes = [
    { id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', user_id: '550e8400-e29b-41d4-a716-446655440000' },
    { id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e', user_id: '660e8400-e29b-41d4-a716-446655440001' },
  ]
  return {
    supabaseAdmin: {
      from: (table: string) => {
        if (table !== 'profiles_artisan') throw new Error(`table inattendue : ${table}`)
        return {
          select: (colonnes: string) => ({
            eq: (colonne: string, valeur: string) => ({
              single: async () => {
                mocks.selectUserId(colonne, valeur)
                const ligne = lignes.find(l => l[colonne as 'id' | 'user_id'] === valeur)
                return ligne
                  ? { data: { id: ligne.id }, error: null }
                  : { data: null, error: { code: 'PGRST116', message: `0 rows (${colonnes})` } }
              },
            }),
          }),
          update: (valeurs: Record<string, unknown>) => ({
            eq: async (colonne: string, valeur: string) => {
              mocks.update(valeurs, colonne, valeur)
              return { error: mocks.erreurUpdate }
            },
          }),
        }
      },
      storage: {
        from: (bucket: string) => {
          mocks.bucket(bucket)
          return {
            upload: mocks.upload,
            remove: mocks.remove,
            getPublicUrl: (chemin: string) => ({
              data: { publicUrl: `https://irluhepekbqgquveaett.supabase.co/storage/v1/object/public/${bucket}/${chemin}` },
            }),
          }
        },
      },
    },
  }
})

vi.stubGlobal('fetch', mocks.fetch)

async function appeler(body: Record<string, unknown>) {
  const { POST } = await import('@/app/api/save-logo/route')
  const requete = new Request('http://localhost/api/save-logo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer jeton' },
    body: JSON.stringify(body),
  })
  const res = await POST(requete as never)
  return { status: res.status, json: await res.json() as Record<string, unknown> }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.user = { id: USER_A }
  mocks.limiteOk = true
  mocks.erreurUpdate = null
  mocks.upload.mockImplementation(async (chemin: string) => ({ data: { id: 'objet', path: chemin, fullPath: `profile-photos/${chemin}` }, error: null }))
  mocks.remove.mockResolvedValue({ data: [], error: null })
  mocks.fetch.mockResolvedValue(new Response(null, { status: 200 }))
})

describe('POST /api/save-logo — envoi dans Storage', () => {
  it('envoie le logo dans profile-photos/logos/ et enregistre l’URL https publique', async () => {
    const res = await appeler({ base64: dataUrl('image/png', PNG), field: 'logo_url' })

    expect(res.status).toBe(200)
    expect(mocks.bucket).toHaveBeenCalledWith('profile-photos')
    const [chemin, corps, options] = mocks.upload.mock.calls[0]
    expect(chemin).toMatch(/^logos\/\d+_[0-9a-f]{8}\.png$/)
    expect(Array.from(corps as Uint8Array)).toEqual(PNG)
    expect(options).toMatchObject({ contentType: 'image/png', upsert: false })

    const url = `${URL_PUBLIQUE}/profile-photos/${chemin}`
    expect(mocks.fetch).toHaveBeenCalledWith(url, expect.objectContaining({ method: 'HEAD' }))
    expect(mocks.update).toHaveBeenCalledTimes(1)
    const [valeurs, colonne, id] = mocks.update.mock.calls[0]
    expect(valeurs).toMatchObject({ logo_url: url })
    expect(typeof valeurs.updated_at).toBe('string')
    expect([colonne, id]).toEqual(['id', ARTISAN_A])
    expect(res.json).toEqual({ success: true, url })
    expect(mocks.loggerError).not.toHaveBeenCalled()
  })

  it('envoie la photo de profil dans profiles/', async () => {
    const res = await appeler({ base64: dataUrl('image/jpeg', JPEG), field: 'profile_photo_url' })

    expect(res.status).toBe(200)
    const chemin = mocks.upload.mock.calls[0][0] as string
    expect(chemin).toMatch(/^profiles\/\d+_[0-9a-f]{8}\.jpg$/)
    expect(mocks.update.mock.calls[0][0]).toMatchObject({ profile_photo_url: `${URL_PUBLIQUE}/profile-photos/${chemin}` })
  })

  it('prend le type réel du fichier, pas celui annoncé par le navigateur', async () => {
    await appeler({ base64: dataUrl('image/png', JPEG), field: 'logo_url' })

    const [chemin, , options] = mocks.upload.mock.calls[0]
    expect(chemin).toMatch(/\.jpg$/)
    expect(options).toMatchObject({ contentType: 'image/jpeg' })
  })
})

describe('POST /api/save-logo — repli sur la data: URL', () => {
  it('garde la data: URL et journalise l’erreur si le bucket est absent', async () => {
    mocks.upload.mockResolvedValue({ data: null, error: { message: 'Bucket not found' } })
    const base64 = dataUrl('image/png', PNG)

    const res = await appeler({ base64, field: 'logo_url' })

    expect(res.status).toBe(200)
    expect(res.json).toEqual({ success: true })
    expect(mocks.update.mock.calls[0][0]).toMatchObject({ logo_url: base64 })
    expect(mocks.update.mock.calls[0][2]).toBe(ARTISAN_A)
    expect(mocks.loggerError).toHaveBeenCalledTimes(1)
    const [message, contexte, erreur] = mocks.loggerError.mock.calls[0]
    expect(message).toContain('Storage')
    expect(contexte).toMatchObject({ artisanId: ARTISAN_A, champ: 'logo_url', etape: 'envoi' })
    expect((erreur as Error).message).toContain('Bucket not found')
  })

  it('garde la data: URL si l’envoi lève une erreur réseau', async () => {
    mocks.upload.mockRejectedValue(new TypeError('fetch failed'))
    const base64 = dataUrl('image/jpeg', JPEG)

    const res = await appeler({ base64, field: 'profile_photo_url' })

    expect(res.status).toBe(200)
    expect(mocks.update.mock.calls[0][0]).toMatchObject({ profile_photo_url: base64 })
    expect((mocks.loggerError.mock.calls[0][2] as Error).message).toContain('fetch failed')
  })

  it('supprime le fichier et garde la data: URL si l’URL publique ne se lit pas (bucket privé)', async () => {
    mocks.fetch.mockResolvedValue(new Response(null, { status: 400 }))
    const base64 = dataUrl('image/png', PNG)

    const res = await appeler({ base64, field: 'logo_url' })

    expect(res.status).toBe(200)
    const chemin = mocks.upload.mock.calls[0][0] as string
    expect(mocks.remove).toHaveBeenCalledWith([chemin])
    expect(mocks.update.mock.calls[0][0]).toMatchObject({ logo_url: base64 })
    expect(mocks.loggerError.mock.calls[0][1]).toMatchObject({ etape: 'lecture' })
    expect((mocks.loggerError.mock.calls[0][2] as Error).message).toContain('HTTP 400')
  })

  it('garde la data: URL si la vérification de l’URL publique échoue sur le réseau', async () => {
    mocks.fetch.mockRejectedValue(new Error('timeout'))
    const base64 = dataUrl('image/png', PNG)

    const res = await appeler({ base64, field: 'logo_url' })

    expect(res.status).toBe(200)
    expect(mocks.remove).toHaveBeenCalledTimes(1)
    expect(mocks.update.mock.calls[0][0]).toMatchObject({ logo_url: base64 })
  })

  it('refuse au-delà de la limite d’envois (429), sans rien envoyer ni écrire de base64', async () => {
    mocks.limiteOk = false

    const res = await appeler({ base64: dataUrl('image/png', PNG), field: 'logo_url' })

    expect(res.status).toBe(429)
    expect(res.json.error).toContain('Réessayez')
    expect(mocks.upload).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.loggerWarn).toHaveBeenCalledTimes(1)
  })

  it('supprime le fichier envoyé si la mise à jour du profil échoue', async () => {
    mocks.erreurUpdate = { message: 'connexion perdue' }

    const res = await appeler({ base64: dataUrl('image/png', PNG), field: 'logo_url' })

    expect(res.status).toBe(500)
    expect(res.json).toEqual({ error: 'Erreur serveur' })
    expect(mocks.remove).toHaveBeenCalledWith([mocks.upload.mock.calls[0][0]])
    expect(mocks.loggerError).toHaveBeenCalled()
  })
})

describe('POST /api/save-logo — validation du type et de la taille', () => {
  it.each([
    ['un PDF annoncé comme tel', dataUrl('application/pdf', PDF)],
    ['un PDF déguisé en PNG', dataUrl('image/png', PDF)],
    ['un SVG', dataUrl('image/svg+xml', Array.from(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')))],
    ['une URL https', 'https://exemple.com/logo.png'],
    ['un base64 abîmé', 'data:image/png;base64,iVBORw0KGgo@@@@'],
  ])('refuse %s', async (_cas, base64) => {
    const res = await appeler({ base64, field: 'logo_url' })

    expect(res.status).toBe(400)
    expect(mocks.upload).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
  })

  // Vraie en-tête PNG complétée de zéros : le contenu passe le contrôle d'image, seule la taille peut le refuser.
  const pngDe = (octets: number) => dataUrl('image/png', [...PNG, ...new Array<number>(octets - PNG.length).fill(0)])

  it('refuse une image de plus de 700 000 caractères (limite Zod)', async () => {
    const base64 = pngDe(525_000)
    expect(base64.length).toBeGreaterThan(700_000)

    const res = await appeler({ base64, field: 'logo_url' })

    expect(res.status).toBe(400)
    expect(mocks.upload).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('accepte la même image juste sous la limite', async () => {
    const base64 = pngDe(524_970)
    expect(base64.length).toBeLessThanOrEqual(700_000)

    const res = await appeler({ base64, field: 'logo_url' })

    expect(res.status).toBe(200)
    expect(mocks.upload).toHaveBeenCalledTimes(1)
  })

  it('accepte une vraie image annoncée application/octet-stream (fichier sans extension)', async () => {
    const res = await appeler({ base64: dataUrl('application/octet-stream', JPEG), field: 'profile_photo_url' })

    expect(res.status).toBe(200)
    expect(mocks.upload.mock.calls[0][2]).toMatchObject({ contentType: 'image/jpeg' })
  })

  it('refuse une colonne autre que logo_url ou profile_photo_url', async () => {
    const res = await appeler({ base64: dataUrl('image/png', PNG), field: 'kbis_url' })

    expect(res.status).toBe(400)
    expect(mocks.upload).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
  })
})

describe('POST /api/save-logo — contrôle d’accès', () => {
  it('refuse un appel sans session', async () => {
    mocks.user = null

    const res = await appeler({ base64: dataUrl('image/png', PNG), field: 'logo_url' })

    expect(res.status).toBe(401)
    expect(mocks.upload).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('ne modifie que la fiche de l’utilisateur connecté, même si le corps désigne un autre artisan', async () => {
    mocks.user = { id: USER_B }

    const res = await appeler({ base64: dataUrl('image/png', PNG), field: 'logo_url', artisan_id: ARTISAN_A, id: ARTISAN_A })

    expect(res.status).toBe(200)
    expect(mocks.selectUserId).toHaveBeenCalledWith('user_id', USER_B)
    expect(mocks.update).toHaveBeenCalledTimes(1)
    expect(mocks.update.mock.calls[0][2]).toBe(ARTISAN_B)
    expect(mocks.update.mock.calls.some(appel => appel[2] === ARTISAN_A)).toBe(false)
  })

  it('refuse un utilisateur sans fiche artisan, sans rien envoyer ni écrire', async () => {
    mocks.user = { id: USER_SANS_FICHE }

    const res = await appeler({ base64: dataUrl('image/png', PNG), field: 'logo_url', artisan_id: ARTISAN_A })

    expect(res.status).toBe(404)
    expect(mocks.upload).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
  })
})
