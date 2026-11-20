// tests/api/marketplace-btp-annonces.test.ts
//
// Marketplace BTP — « Mes annonces » (audit des fondations BTP du 11/11/2026, constat api-peripherie-8).
//   - GET /api/marketplace-btp?user_id=… : la liste propre à un compte (annonces en pause ou vendues comprises) ne
//     doit être gardée par aucun cache partagé ; elle portait l'en-tête de la liste publique (s-maxage).
//   - PUT /api/marketplace-btp/[id] : la validation de la modification refusait des valeurs que la base admet et que
//     l'écran envoie — le bouton Pauser (statut « paused ») et le type « vente ou location » accepté à la création —
//     et admettait deux statuts que la base refuse (« suspendu », « archive »).
// Valeurs de la base : migration 027_marketplace_btp.sql (statut active, paused, vendu, loue, deleted ; type vente,
// location, vente_location).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { FauxSupabase } from '../helpers/faux-supabase-marches'

const h = vi.hoisted(() => ({ base: null as null | FauxSupabase, user: { id: '11111111-1111-4111-8111-111111111111' } }))

vi.mock('@supabase/supabase-js', async () => {
  const { creerFauxSupabase } = await import('../helpers/faux-supabase-marches')
  h.base = creerFauxSupabase()
  const auth = {
    getUser: async (jeton: string) => (jeton === 'jeton-de-session'
      ? { data: { user: h.user }, error: null }
      : { data: { user: null }, error: { message: 'jeton invalide' } }),
  }
  return { createClient: () => ({ ...(h.base as FauxSupabase).client, auth }) }
})
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/mocks-routes-api')).rateLimitPermissif())
vi.mock('@/lib/logger', async () => (await import('../helpers/mocks-routes-api')).loggerSilencieux())

const { GET } = await import('@/app/api/marketplace-btp/route')
const { PUT } = await import('@/app/api/marketplace-btp/[id]/route')

const MOI = '11111111-1111-4111-8111-111111111111'
const ANNONCE = '44444444-4444-4444-8444-444444444444'
const base = () => h.base as FauxSupabase
const AVEC_SESSION = { Authorization: 'Bearer jeton-de-session' }

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://projet.supabase.test')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'cle-publique-de-test')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'cle-service-de-test')
  base().vider()
  base().repondre = appel => (appel.operation === 'update'
    ? { data: { id: ANNONCE, ...(appel.donnees as object) }, error: null }
    : { data: [{ id: ANNONCE, title: 'Mini-pelle 2,5 t', status: 'paused' }], error: null })
})
afterEach(() => { vi.unstubAllEnvs() })

const modifier = (corps: Record<string, unknown>) =>
  PUT(
    new NextRequest(`https://vitfix.io/api/marketplace-btp/${ANNONCE}`, {
      method: 'PUT', body: JSON.stringify(corps), headers: { 'Content-Type': 'application/json', ...AVEC_SESSION },
    }),
    { params: Promise.resolve({ id: ANNONCE }) },
  )

describe('GET /api/marketplace-btp — mes annonces', () => {
  it('avec la session : mes annonces, tous statuts, jamais gardées par un cache', async () => {
    const res = await GET(new NextRequest(`https://vitfix.io/api/marketplace-btp?user_id=${MOI}`, { headers: AVEC_SESSION }))
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    expect((await res.json()).listings).toHaveLength(1)
    expect(base().sur('marketplace_listings')[0].filtres).toContainEqual(['eq', 'user_id', MOI])
  })

  it('sans session : 401 (inchangé)', async () => {
    const res = await GET(new NextRequest(`https://vitfix.io/api/marketplace-btp?user_id=${MOI}`))
    expect(res.status).toBe(401)
  })

  it('liste publique : en-tête de cache inchangé', async () => {
    const res = await GET(new NextRequest('https://vitfix.io/api/marketplace-btp?categorie=mini_engins'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('s-maxage=300, stale-while-revalidate=600')
  })
})

describe('PUT /api/marketplace-btp/[id] — modifier une annonce', () => {
  it('Pauser une annonce (statut « paused ») est accepté', async () => {
    const res = await modifier({ status: 'paused' })
    expect(res.status).toBe(200)
    expect(base().sur('marketplace_listings', 'update')[0].donnees).toEqual({ status: 'paused' })
  })

  it('les statuts admis par la base le sont aussi par la validation', async () => {
    for (const status of ['active', 'paused', 'vendu', 'loue']) expect((await modifier({ status })).status, status).toBe(200)
  })

  it('une annonce « vente ou location » peut être modifiée', async () => {
    const res = await modifier({ title: 'Mini-pelle 2,5 t', type_annonce: 'vente_location', categorie: 'mini_engins', etat: 'bon' })
    expect(res.status).toBe(200)
    expect(base().sur('marketplace_listings', 'update')[0].donnees).toMatchObject({ type_annonce: 'vente_location' })
  })

  it('un statut que la base refuse est refusé d’emblée, sans écriture', async () => {
    for (const status of ['suspendu', 'archive', 'deleted']) expect((await modifier({ status })).status, status).toBe(400)
    expect(base().sur('marketplace_listings', 'update')).toHaveLength(0)
  })
})
