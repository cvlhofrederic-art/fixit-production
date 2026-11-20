// @vitest-environment node
// tests/api/artisan-photos-lecture-proprietaire.test.ts
//
// GET /api/artisan-photos — les photos de chantier d'une fiche (date, libellé, position, lien) ne se lisent
// qu'avec la session du propriétaire de la fiche, comme l'ajout, la modification et la suppression.
// Aucune donnée réelle : identifiants et libellés d'exemple.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { appelsDe, clientMemoire, nouvelleBase, type BaseMemoire } from './syndic-supabase-memoire'

const PROPRIETAIRE = '11111111-1111-4111-8111-111111111111'
const AUTRE_COMPTE = '22222222-2222-4222-8222-222222222222'
const FICHE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const FICHE_INCONNUE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const RESERVATION = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

const h = vi.hoisted(() => ({
  base: null as unknown as BaseMemoire,
  user: null as null | { id: string },
}))

vi.mock('@/lib/auth-helpers', async (original) => ({
  ...(await original<typeof import('@/lib/auth-helpers')>()),
  getAuthUser: vi.fn(async () => h.user),
}))
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/mocks-routes-api')).rateLimitPermissif())
vi.mock('@/lib/logger', async () => (await import('../helpers/mocks-routes-api')).loggerSilencieux())
vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin: { from: (t: string) => clientMemoire(h.base).from(t) } }))

const { GET } = await import('@/app/api/artisan-photos/route')

const lire = async (requete: string) => {
  const res = await GET(new NextRequest(`https://vitfix.io/api/artisan-photos${requete}`, { headers: { Authorization: 'Bearer jeton' } }))
  return { status: res.status, json: await res.json() as { data?: Array<{ id: string }>; error?: string } }
}

beforeEach(() => {
  h.base = nouvelleBase()
  h.user = { id: PROPRIETAIRE }
  h.base.lignes.profiles_artisan = [{ id: FICHE, user_id: PROPRIETAIRE }]
  h.base.lignes.artisan_photos = [
    { id: 'photo-1', artisan_id: FICHE, booking_id: RESERVATION, url: 'https://stockage.exemple.test/photo-1.jpg', label: 'Avant travaux', lat: 43.3, lng: 5.4, taken_at: '2026-11-10T09:00:00Z', source: 'mobile', created_at: '2026-11-10T09:00:05Z' },
    { id: 'photo-2', artisan_id: FICHE, booking_id: null, url: 'https://stockage.exemple.test/photo-2.jpg', label: 'Après travaux', lat: 43.3, lng: 5.4, taken_at: '2026-11-11T16:00:00Z', source: 'desktop', created_at: '2026-11-11T16:00:05Z' },
  ]
})

describe('GET /api/artisan-photos — lecture réservée au propriétaire de la fiche', () => {
  it('un autre compte connecté : 403, aucune photo lue', async () => {
    h.user = { id: AUTRE_COMPTE }
    const res = await lire(`?artisan_id=${FICHE}`)
    expect(res.status).toBe(403)
    expect(res.json.data).toBeUndefined()
    expect(appelsDe(h.base, 'artisan_photos')).toHaveLength(0)
  })

  it('fiche inconnue : 403, aucune photo lue', async () => {
    const res = await lire(`?artisan_id=${FICHE_INCONNUE}`)
    expect(res.status).toBe(403)
    expect(appelsDe(h.base, 'artisan_photos')).toHaveLength(0)
  })

  it('sans session : 401, ni la fiche ni les photos ne sont lues', async () => {
    h.user = null
    const res = await lire(`?artisan_id=${FICHE}`)
    expect(res.status).toBe(401)
    expect(h.base.appels).toHaveLength(0)
  })
})

describe('GET /api/artisan-photos — le propriétaire lit ses photos comme avant', () => {
  it('200 avec les photos de sa fiche', async () => {
    const res = await lire(`?artisan_id=${FICHE}`)
    expect(res.status).toBe(200)
    expect(res.json.data?.map((p) => p.id).sort()).toEqual(['photo-1', 'photo-2'])
    expect(appelsDe(h.base, 'artisan_photos', 'select')[0].eq).toContainEqual(['artisan_id', FICHE])
  })

  it('filtre par réservation conservé', async () => {
    const res = await lire(`?artisan_id=${FICHE}&booking_id=${RESERVATION}`)
    expect(res.status).toBe(200)
    expect(res.json.data?.map((p) => p.id)).toEqual(['photo-1'])
  })

  it('400 sans artisan_id', async () => {
    expect((await lire('')).status).toBe(400)
  })
})
