// @vitest-environment node
// tests/api/syndic-mission-report.test.ts
//
// POST /api/syndic/mission-report — rapport d'intervention envoyé par l'application mobile. syndic_id, qui
// nomme le dossier Storage (mission-reports/{syndic}/…) et le destinataire de la notification, vient du
// corps : pour un artisan, il n'est accepté que si le cabinet l'a inscrit parmi ses prestataires
// (syndic_artisans, écrit par le cabinet seul) et si booking_id est SON booking. bookings.syndic_id,
// metadata.syndic_id et client_id ne valent pas preuve : l'artisan propriétaire du booking peut les écrire
// avec son JWT (policy bookings_participant_update, sans restriction de colonne). Un membre du cabinet
// n'envoie que pour son cabinet. Nom de dossier du rapport : rapport_{horodatage}_{8 car. aléatoires},
// dépôt sans écrasement. Supabase en mémoire (tables) ; Storage simulé (dépôts journalisés).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { appelsDe, clientMemoire, nouvelleBase, type BaseMemoire } from './syndic-supabase-memoire'

const h = vi.hoisted(() => ({
  base: null as unknown as BaseMemoire,
  utilisateur: null as Record<string, unknown> | null,
  depots: [] as Array<{ bucket: string; chemin: string; options: unknown }>,
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({ logger: { error: h.loggerError, warn: h.loggerWarn, info: vi.fn(), debug: vi.fn() } }))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => true),
  getClientIP: vi.fn(() => '127.0.0.1'),
  rateLimitResponse: vi.fn(() => Response.json({ error: 'rate' }, { status: 429 })),
}))
vi.mock('@/lib/sanitize', () => ({ sanitizeSvg: vi.fn((svg: string) => svg) }))
// isSyndicRole et resolveCabinetId réels (rôle syndic : cabinet = son id, sans lecture en base)
vi.mock('@/lib/auth-helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-helpers')>()),
  getAuthUser: vi.fn(async () => h.utilisateur),
}))
vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: {
    from: (table: string) => clientMemoire(h.base).from(table),
    storage: {
      from: (bucket: string) => ({
        upload: async (chemin: string, _corps: unknown, options: unknown) => {
          h.depots.push({ bucket, chemin, options })
          return { data: { path: chemin }, error: null }
        },
        createSignedUrl: async (chemin: string) => ({ data: { signedUrl: `https://signe/${bucket}/${chemin}` }, error: null }),
        getPublicUrl: (chemin: string) => ({ data: { publicUrl: `https://public/${bucket}/${chemin}` } }),
      }),
    },
  },
}))

const { POST } = await import('@/app/api/syndic/mission-report/route')

// ── Jeu de données ───────────────────────────────────────────────────────────

const CABINET = '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4'
const AUTRE_CABINET = '11111111-2222-4333-8444-555555555555'
const ARTISAN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' // compte (auth user id)
const FICHE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1' // profiles_artisan.id
const AUTRE_FICHE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb9'
const BOOKING = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1'
const BOOKING_AUTRE_ARTISAN = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2'

type Ligne = Record<string, unknown>

const artisan = (): Ligne => ({ id: ARTISAN, email: 'paul@exemple.fr', app_metadata: { role: 'artisan' } })
const syndic = (id = CABINET): Ligne => ({ id, email: 'syndic@exemple.fr', app_metadata: { role: 'syndic' } })

const corps = (surcharge: Ligne = {}): Ligne => ({
  syndic_id: CABINET,
  artisan_id: ARTISAN,
  artisan_nom: 'Paul Durand',
  booking_id: BOOKING,
  type_travaux: 'Plomberie',
  immeuble: 'Résidence Le Prado',
  description: 'Fuite réparée',
  photos_before: ['data:image/jpeg;base64,/9j/4AAQSkZJRg=='],
  photos_after: ['data:image/jpeg;base64,/9j/4AAQSkZJRg=='],
  completed_at: '2026-10-28T10:00:00.000Z',
  ...surcharge,
})

const envoyer = (body: Ligne) =>
  POST(new NextRequest('https://vitfix.io/api/syndic/mission-report', {
    method: 'POST', headers: { Authorization: 'Bearer jeton-test', 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }))

beforeEach(() => {
  h.base = nouvelleBase()
  h.base.lignes = {
    // syndic_id et metadata.syndic_id posés exprès : des valeurs que l'artisan peut écrire lui-même
    bookings: [
      { id: BOOKING, artisan_id: FICHE, syndic_id: CABINET, metadata: { syndic_id: CABINET } },
      { id: BOOKING_AUTRE_ARTISAN, artisan_id: AUTRE_FICHE, syndic_id: CABINET, metadata: { syndic_id: CABINET } },
    ],
    profiles_artisan: [{ id: FICHE, user_id: ARTISAN }],
    syndic_artisans: [{ id: 'sa-1', cabinet_id: CABINET, artisan_user_id: ARTISAN, statut: 'actif' }],
  }
  h.utilisateur = artisan()
  h.depots = []
  h.loggerError.mockClear()
  h.loggerWarn.mockClear()
})

describe('POST /api/syndic/mission-report — artisan', () => {
  it('prestataire du cabinet, sur son booking → 200, photos sous mission-reports/{cabinet}/rapport_…/, sans écrasement', async () => {
    const res = await envoyer(corps())
    expect(res.status).toBe(200)
    const reponse = await res.json()
    expect(reponse).toMatchObject({ success: true, photos_uploaded: 2 })
    expect(reponse.report_id).toMatch(/^rapport_\d{13}_[0-9a-f]{8}$/)

    expect(h.depots.map(d => d.bucket)).toEqual(['mission-reports', 'mission-reports'])
    expect(h.depots[0].chemin).toBe(`${CABINET}/${reponse.report_id}/avant_1.jpg`)
    expect(h.depots[1].chemin).toBe(`${CABINET}/${reponse.report_id}/apres_1.jpg`)
    expect(h.depots[0].options).toEqual({ contentType: 'image/jpeg', upsert: false })

    // Le lien est lu dans syndic_artisans pour CE cabinet et CE compte, le booking par son id
    const prestataire = appelsDe(h.base, 'syndic_artisans', 'select')[0]
    expect(prestataire.eq).toContainEqual(['cabinet_id', CABINET])
    expect(prestataire.eq).toContainEqual(['artisan_user_id', ARTISAN])
    expect(appelsDe(h.base, 'bookings', 'select')[0].eq).toContainEqual(['id', BOOKING])

    // Rapport et notification pour le cabinet, booking terminé
    expect((appelsDe(h.base, 'syndic_emails_analysed', 'insert')[0].donnees as Ligne).syndic_id).toBe(CABINET)
    const notification = appelsDe(h.base, 'syndic_notifications', 'insert')[0].donnees as { syndic_id: string; data_json: { report_id: string } }
    expect(notification.syndic_id).toBe(CABINET)
    expect(notification.data_json.report_id).toBe(reponse.report_id)
    expect(appelsDe(h.base, 'bookings', 'update')[0].eq).toContainEqual(['id', BOOKING])
  })

  it('booking dont artisan_id est le compte (sans fiche) → accepté', async () => {
    h.base.lignes.profiles_artisan = []
    h.base.lignes.bookings = [{ id: BOOKING, artisan_id: ARTISAN }]
    expect((await envoyer(corps())).status).toBe(200)
  })

  it('absent de syndic_artisans du cabinet, même si bookings.syndic_id et metadata.syndic_id le désignent → 403, rien déposé', async () => {
    h.base.lignes.syndic_artisans = []
    const res = await envoyer(corps())
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Non autorisé' })
    expect(h.depots).toHaveLength(0)
    expect(appelsDe(h.base, 'syndic_emails_analysed', 'insert')).toHaveLength(0)
    expect(appelsDe(h.base, 'syndic_notifications', 'insert')).toHaveLength(0)
  })

  it('prestataire d’un autre cabinet seulement → 403 pour ce cabinet', async () => {
    h.base.lignes.syndic_artisans = [{ id: 'sa-2', cabinet_id: AUTRE_CABINET, artisan_user_id: ARTISAN }]
    expect((await envoyer(corps())).status).toBe(403)
    expect(h.depots).toHaveLength(0)
  })

  it('booking d’un autre artisan → 403', async () => {
    expect((await envoyer(corps({ booking_id: BOOKING_AUTRE_ARTISAN }))).status).toBe(403)
    expect(h.depots).toHaveLength(0)
  })

  it('booking inconnu ou absent → 403', async () => {
    expect((await envoyer(corps({ booking_id: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc7' }))).status).toBe(403)
    expect((await envoyer(corps({ booking_id: null }))).status).toBe(403)
    expect(h.depots).toHaveLength(0)
  })

  it('lecture en erreur → 403 (refus fermé), erreur journalisée', async () => {
    h.base.erreurs['syndic_artisans.select'] = { message: 'timeout' }
    expect((await envoyer(corps())).status).toBe(403)
    expect(h.loggerError).toHaveBeenCalledWith('mission-report liaison artisan/syndic', expect.objectContaining({ prestataire: 'timeout' }))
  })

  it('compte qui n’est ni l’artisan désigné ni un syndic → 403', async () => {
    h.utilisateur = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', app_metadata: { role: 'artisan' } }
    expect((await envoyer(corps())).status).toBe(403)
    expect(h.depots).toHaveLength(0)
  })

  it('sans utilisateur → 401', async () => {
    h.utilisateur = null
    expect((await envoyer(corps())).status).toBe(401)
  })
})

describe('POST /api/syndic/mission-report — membre du cabinet', () => {
  it('syndic de ce cabinet → 200 sans contrôle du booking ni de syndic_artisans', async () => {
    h.utilisateur = syndic()
    h.base.lignes.syndic_artisans = []
    const res = await envoyer(corps({ booking_id: null }))
    expect(res.status).toBe(200)
    expect(h.depots[0].chemin).toMatch(new RegExp(`^${CABINET}/rapport_\\d{13}_[0-9a-f]{8}/avant_1\\.jpg$`))
    expect(appelsDe(h.base, 'syndic_artisans')).toHaveLength(0)
  })

  it('syndic d’un autre cabinet → 403, rien déposé', async () => {
    h.utilisateur = syndic(AUTRE_CABINET)
    expect((await envoyer(corps())).status).toBe(403)
    expect(h.depots).toHaveLength(0)
  })
})
