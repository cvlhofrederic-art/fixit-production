// @vitest-environment node
// lib/storage/images-artisan.ts — lecture des data: URL d'images et envoi dans Supabase Storage.
//   - lireImageDataUrl : seules les images JPEG, PNG, WebP et GIF réelles passent, quel que soit le type annoncé ;
//     un SVG, un PDF ou un base64 abîmé sont refusés.
//   - envoyerImageArtisan : bucket profile-photos, dossiers profiles/ et logos/ comme /api/upload, URL publique
//     vérifiée ; en cas d'échec, le fichier envoyé est supprimé.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { envoyerImageArtisan, lireImageDataUrl, type ImageArtisan } from '@/lib/storage/images-artisan'

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]
const GIF = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00]
const WEBP = [0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50]
const WAV = [0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45]

const b64 = (octets: number[]) => Buffer.from(octets).toString('base64')

describe('lireImageDataUrl', () => {
  it.each([
    ['image/png', PNG, 'image/png', 'png'],
    ['image/jpeg', JPEG, 'image/jpeg', 'jpg'],
    ['image/jpg', JPEG, 'image/jpeg', 'jpg'],
    ['image/webp', WEBP, 'image/webp', 'webp'],
    ['image/gif', GIF, 'image/gif', 'gif'],
    ['image/png', JPEG, 'image/jpeg', 'jpg'],
    ['application/octet-stream', JPEG, 'image/jpeg', 'jpg'],
    ['', PNG, 'image/png', 'png'],
  ])('lit une data: URL %s (%#)', (annonce, octets, type, extension) => {
    const image = lireImageDataUrl(`data:${annonce};base64,${b64(octets)}`)
    expect(image).not.toBeNull()
    expect(image?.type).toBe(type)
    expect(image?.extension).toBe(extension)
    expect(Array.from(image?.octets ?? [])).toEqual(octets)
  })

  it('accepte des paramètres entre le type et « base64 »', () => {
    expect(lireImageDataUrl(`data:image/png;name=logo.png;base64,${b64(PNG)}`)?.type).toBe('image/png')
  })

  it.each([
    ['une URL https', 'https://irluhepekbqgquveaett.supabase.co/storage/v1/object/public/profile-photos/logos/1_a.png'],
    ['un SVG', `data:image/svg+xml;base64,${b64(Array.from(Buffer.from('<svg/>')))}`],
    ['un PDF', `data:application/pdf;base64,${b64([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])}`],
    ['un WAV annoncé comme WebP', `data:image/webp;base64,${b64(WAV)}`],
    ['un contenu non image annoncé comme PNG', `data:image/png;base64,${b64([0x00, 0x01, 0x02, 0x03])}`],
    ['une data: URL sans base64', 'data:image/png,%89PNG'],
    ['un base64 aux caractères interdits', 'data:image/png;base64,iVBO@@@@'],
    ['un base64 tronqué', `data:image/png;base64,${b64(PNG).slice(0, -1)}`],
    ['un base64 vide', 'data:image/png;base64,'],
  ])('refuse %s', (_cas, valeur) => {
    expect(lireImageDataUrl(valeur)).toBeNull()
  })
})

describe('envoyerImageArtisan', () => {
  const upload = vi.fn()
  const remove = vi.fn()
  const fetchMock = vi.fn()
  const client = {
    storage: {
      from: (bucket: string) => ({
        upload,
        remove,
        getPublicUrl: (chemin: string) => ({ data: { publicUrl: `https://projet.supabase.co/storage/v1/object/public/${bucket}/${chemin}` } }),
      }),
    },
  }
  const image = lireImageDataUrl(`data:image/png;base64,${b64(PNG)}`) as ImageArtisan

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', fetchMock)
    upload.mockImplementation(async (chemin: string) => ({ data: { path: chemin }, error: null }))
    remove.mockResolvedValue({ data: [], error: null })
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }))
  })

  it('renvoie l’URL publique du fichier envoyé', async () => {
    const resultat = await envoyerImageArtisan(client as never, 'logo_url', image)

    expect(resultat.ok).toBe(true)
    const chemin = upload.mock.calls[0][0] as string
    expect(chemin).toMatch(/^logos\/\d+_[0-9a-f]{8}\.png$/)
    expect(resultat).toEqual({ ok: true, chemin, url: `https://projet.supabase.co/storage/v1/object/public/profile-photos/${chemin}` })
  })

  it('donne un chemin différent à chaque envoi', async () => {
    await envoyerImageArtisan(client as never, 'profile_photo_url', image)
    await envoyerImageArtisan(client as never, 'profile_photo_url', image)

    expect(upload.mock.calls[0][0]).not.toBe(upload.mock.calls[1][0])
  })

  it('signale le fichier resté dans le bucket quand sa suppression échoue', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 400 }))
    remove.mockResolvedValue({ data: null, error: { message: 'interdit' } })

    const resultat = await envoyerImageArtisan(client as never, 'logo_url', image)

    expect(resultat.ok).toBe(false)
    if (resultat.ok) return
    expect(resultat.etape).toBe('lecture')
    expect(resultat.message).toContain('HTTP 400')
    expect(resultat.message).toContain('non supprimé : interdit')
  })
})
