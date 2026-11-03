// @vitest-environment node
// lib/storage/migrer-images-artisan.ts — migration des data: URL de profiles_artisan vers Supabase Storage
// (lancée par scripts/migrer-images-artisans-storage.ts).
//   - Simulation par défaut : rien n'est envoyé ni écrit, le bilan compte ce qui serait migré.
//   - Avec appliquer : chaque image reconnue part dans le bucket et la colonne reçoit l'URL https publique ;
//     une valeur non reconnue reste telle quelle ; une valeur changée entre-temps n'est jamais écrasée.
//   - Trois échecs Storage de suite arrêtent la migration (bucket absent ou privé).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { migrerImagesArtisans, motifValeurIdentique } from '@/lib/storage/migrer-images-artisan'

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]
const dataUrl = (type: string, octets: number[]) => `data:${type};base64,${Buffer.from(octets).toString('base64')}`
const PHOTO_PNG = dataUrl('image/png', PNG)
const LOGO_JPEG = dataUrl('image/jpeg', JPEG)
const SVG = dataUrl('image/svg+xml', Array.from(Buffer.from('<svg/>')))
const URL_PUBLIQUE = 'https://projet.supabase.co/storage/v1/object/public/profile-photos'

type Ligne = { id: string; profile_photo_url: string | null; logo_url: string | null }

interface RequeteLecture {
  like(colonne: keyof Ligne, motif: string): RequeteLecture
  eq(colonne: keyof Ligne, valeur: string): RequeteLecture
  order(): RequeteLecture
  range(debut: number, fin: number): Promise<{ data: Array<{ id: string }>; error: null }>
  maybeSingle(): Promise<{ data: Ligne | null; error: null }>
}

interface RequeteMiseAJour {
  eq(colonne: keyof Ligne, valeur: string): RequeteMiseAJour
  like(colonne: keyof Ligne, motif: string): RequeteMiseAJour
  select(): Promise<{ data: Array<{ id: string }>; error: null }>
}

/** LIKE de PostgreSQL : % et _ jokers, \ échappe le caractère suivant. */
function correspondLike(valeur: string, motif: string): boolean {
  let regex = ''
  for (let i = 0; i < motif.length; i++) {
    const c = motif[i]
    if (c === '\\') regex += motif[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    else if (c === '%') regex += '.*'
    else if (c === '_') regex += '.'
    else regex += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${regex}$`, 's').test(valeur)
}

/** profiles_artisan en mémoire, avec les seules requêtes que la migration fait. */
function baseSimulee(lignes: Ligne[]) {
  const upload = vi.fn(async (chemin: string) => ({ data: { path: chemin }, error: null as { message: string } | null }))
  const remove = vi.fn(async (_chemins: string[]) => ({ data: [], error: null }))
  const updates: Array<{ id: string; valeurs: Record<string, unknown> }> = []

  const client = {
    from: (table: string) => {
      if (table !== 'profiles_artisan') throw new Error(`table inattendue : ${table}`)
      return {
        select: () => {
          const filtres: Array<(l: Ligne) => boolean> = []
          const requete: RequeteLecture = {
            like: (colonne: keyof Ligne, motif: string) => {
              filtres.push(l => typeof l[colonne] === 'string' && correspondLike(l[colonne] as string, motif))
              return requete
            },
            eq: (colonne: keyof Ligne, valeur: string) => {
              filtres.push(l => l[colonne] === valeur)
              return requete
            },
            order: () => requete,
            range: async (debut: number, fin: number) => ({
              data: lignes.filter(l => filtres.every(f => f(l)))
                .sort((a, b) => a.id.localeCompare(b.id))
                .slice(debut, fin + 1)
                .map(l => ({ id: l.id })),
              error: null,
            }),
            maybeSingle: async () => {
              const ligne = lignes.find(l => filtres.every(f => f(l)))
              return { data: ligne ? { ...ligne } : null, error: null }
            },
          }
          return requete
        },
        update: (valeurs: Record<string, unknown>) => {
          const filtres: Array<(l: Ligne) => boolean> = []
          const requete: RequeteMiseAJour = {
            eq: (colonne: keyof Ligne, valeur: string) => {
              filtres.push(l => l[colonne] === valeur)
              return requete
            },
            like: (colonne: keyof Ligne, motif: string) => {
              filtres.push(l => typeof l[colonne] === 'string' && correspondLike(l[colonne] as string, motif))
              return requete
            },
            select: async () => {
              const cibles = lignes.filter(l => filtres.every(f => f(l)))
              for (const l of cibles) {
                Object.assign(l, valeurs)
                updates.push({ id: l.id, valeurs })
              }
              return { data: cibles.map(l => ({ id: l.id })), error: null }
            },
          }
          return requete
        },
      }
    },
    storage: {
      from: () => ({
        upload,
        remove,
        getPublicUrl: (chemin: string) => ({ data: { publicUrl: `${URL_PUBLIQUE}/${chemin}` } }),
      }),
    },
  }
  return { client, upload, remove, updates }
}

const journal = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 200 })))
})

describe('migrerImagesArtisans — simulation', () => {
  it('compte les data: URL sans rien envoyer ni écrire', async () => {
    const lignes: Ligne[] = [
      { id: 'a-1', profile_photo_url: PHOTO_PNG, logo_url: LOGO_JPEG },
      { id: 'a-2', profile_photo_url: `${URL_PUBLIQUE}/profiles/1_x.png`, logo_url: null },
      { id: 'a-3', profile_photo_url: SVG, logo_url: null },
    ]
    const avant = structuredClone(lignes)
    const { client, upload, updates } = baseSimulee(lignes)

    const { bilan, arret } = await migrerImagesArtisans(client as never, { appliquer: false, journal })

    expect(arret).toBeNull()
    expect(upload).not.toHaveBeenCalled()
    expect(updates).toEqual([])
    expect(lignes).toEqual(avant)
    expect(bilan.profile_photo_url).toEqual({ trouvees: 2, valides: 1, octets: PNG.length, migrees: 0, ignorees: 1, echecs: 0 })
    expect(bilan.logo_url).toEqual({ trouvees: 1, valides: 1, octets: JPEG.length, migrees: 0, ignorees: 0, echecs: 0 })
  })

  it('parcourt toutes les pages de lignes', async () => {
    const lignes: Ligne[] = Array.from({ length: 1001 }, (_, i) => ({
      id: `id-${String(i).padStart(4, '0')}`, profile_photo_url: PHOTO_PNG, logo_url: null,
    }))
    const { client } = baseSimulee(lignes)

    const { bilan } = await migrerImagesArtisans(client as never, { appliquer: false, champs: ['profile_photo_url'], journal })

    expect(bilan.profile_photo_url.trouvees).toBe(1001)
    expect(bilan.profile_photo_url.valides).toBe(1001)
  })
})

describe('migrerImagesArtisans — application', () => {
  it('envoie chaque image reconnue et remplace la data: URL par l’URL https publique', async () => {
    const lignes: Ligne[] = [
      { id: 'a-1', profile_photo_url: PHOTO_PNG, logo_url: LOGO_JPEG },
      { id: 'a-2', profile_photo_url: SVG, logo_url: null },
    ]
    const { client, upload } = baseSimulee(lignes)

    const { bilan, arret } = await migrerImagesArtisans(client as never, { appliquer: true, journal })

    expect(arret).toBeNull()
    expect(upload).toHaveBeenCalledTimes(2)
    expect(lignes[0].profile_photo_url).toMatch(new RegExp(`^${URL_PUBLIQUE}/profiles/\\d+_[0-9a-f]{8}\\.png$`))
    expect(lignes[0].logo_url).toMatch(new RegExp(`^${URL_PUBLIQUE}/logos/\\d+_[0-9a-f]{8}\\.jpg$`))
    expect(lignes[1].profile_photo_url).toBe(SVG)
    expect(bilan.profile_photo_url).toMatchObject({ trouvees: 2, migrees: 1, ignorees: 1, echecs: 0 })
    expect(bilan.logo_url).toMatchObject({ trouvees: 1, migrees: 1 })
  })

  it('n’écrase pas une image changée pendant la migration et supprime le fichier envoyé', async () => {
    const nouvelle = dataUrl('image/png', [...PNG, 0x01, 0x02, 0x03])
    const lignes: Ligne[] = [{ id: 'a-1', profile_photo_url: PHOTO_PNG, logo_url: null }]
    const { client, upload, remove } = baseSimulee(lignes)
    upload.mockImplementationOnce(async (chemin: string) => {
      lignes[0].profile_photo_url = nouvelle // l'artisan change sa photo entre la lecture et la mise à jour
      return { data: { path: chemin }, error: null }
    })

    const { bilan } = await migrerImagesArtisans(client as never, { appliquer: true, champs: ['profile_photo_url'], journal })

    expect(lignes[0].profile_photo_url).toBe(nouvelle)
    expect(remove).toHaveBeenCalledWith([upload.mock.calls[0][0]])
    expect(bilan.profile_photo_url).toMatchObject({ migrees: 0, ignorees: 1 })
  })

  it('s’arrête après trois échecs Storage de suite, sans toucher aux lignes', async () => {
    const lignes: Ligne[] = Array.from({ length: 5 }, (_, i) => ({ id: `a-${i}`, profile_photo_url: PHOTO_PNG, logo_url: null }))
    const { client, upload } = baseSimulee(lignes)
    upload.mockResolvedValue({ data: null as never, error: { message: 'Bucket not found' } })

    const { bilan, arret } = await migrerImagesArtisans(client as never, { appliquer: true, journal })

    expect(arret).toContain('arrêtée')
    expect(upload).toHaveBeenCalledTimes(3)
    expect(bilan.profile_photo_url).toMatchObject({ migrees: 0, echecs: 3 })
    expect(lignes.every(l => l.profile_photo_url === PHOTO_PNG)).toBe(true)
  })

  it('respecte la limite', async () => {
    const lignes: Ligne[] = Array.from({ length: 3 }, (_, i) => ({ id: `a-${i}`, profile_photo_url: PHOTO_PNG, logo_url: LOGO_JPEG }))
    const { client, upload } = baseSimulee(lignes)

    await migrerImagesArtisans(client as never, { appliquer: true, limite: 1, journal })

    expect(upload).toHaveBeenCalledTimes(1)
    expect(lignes.filter(l => l.profile_photo_url !== PHOTO_PNG)).toHaveLength(1)
    expect(lignes.every(l => l.logo_url === LOGO_JPEG)).toBe(true)
  })
})

describe('motifValeurIdentique', () => {
  it('reprend une valeur courte en entier, jokers échappés', () => {
    expect(motifValeurIdentique('data:a_b%c')).toBe('data:a\\_b\\%c')
  })

  it('compare le début et la fin d’une valeur longue', () => {
    const valeur = `data:image/png;base64,${'A'.repeat(500)}${'B'.repeat(200)}`
    const motif = motifValeurIdentique(valeur)

    expect(motif).toBe(`${valeur.slice(0, 128)}%${valeur.slice(-128)}`)
    expect(correspondLike(valeur, motif)).toBe(true)
    expect(correspondLike(`${valeur.slice(0, -1)}C`, motif)).toBe(false)
  })
})
