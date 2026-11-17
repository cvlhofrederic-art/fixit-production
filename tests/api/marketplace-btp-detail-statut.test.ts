// @vitest-environment node
// tests/api/marketplace-btp-detail-statut.test.ts
//
// GET /api/marketplace-btp/[id] — détail d'une annonce du Marketplace (nom et téléphone du vendeur compris).
// Même règle que la liste (GET /api/marketplace-btp) : le public ne voit que les annonces actives, le vendeur voit
// aussi les siennes tant qu'elles ne sont pas supprimées. Une annonce supprimée n'est plus lisible par personne.
// Aucune donnée réelle : annonce et comptes d'exemple.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { StatusAnnonce } from '@/lib/marketplace-btp-types'

type Ligne = Record<string, unknown>
// Statuts de la base (CHECK de marketplace_listings.status, migration 027) : active, paused, vendu, loue, deleted.
// Typés pour qu'un statut que la base refuse ne puisse plus servir d'exemple.
type Statut = StatusAnnonce | null
const NON_PUBLIQUES: Statut[] = ['deleted', 'paused', 'loue', 'vendu', null]
const LISIBLES_PAR_LE_VENDEUR: Statut[] = ['paused', 'loue', 'vendu']

const VENDEUR = '11111111-1111-4111-8111-111111111111'
const AUTRE_COMPTE = '22222222-2222-4222-8222-222222222222'
const ANNONCE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

const h = vi.hoisted(() => {
  const etat = {
    annonce: null as Ligne | null,
    demandes: [] as Ligne[],
    comptes: {} as Record<string, { id: string }>,
    vues: 0,
  }
  const client = {
    from(table: string) {
      const q: Record<string, unknown> = {}
      q.select = () => q
      q.eq = () => q
      q.single = async () => (table === 'marketplace_listings' && etat.annonce
        ? { data: etat.annonce, error: null }
        : { data: null, error: { code: 'PGRST116', message: 'aucune ligne' } })
      q.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) =>
        Promise.resolve({ data: table === 'marketplace_demandes' ? etat.demandes : [], error: null }).then(ok, ko)
      return q
    },
    rpc(nom: string) {
      if (nom === 'increment_listing_vues') etat.vues += 1
      return Promise.resolve({ data: null, error: null })
    },
    auth: { getUser: async (jeton: string) => ({ data: { user: etat.comptes[jeton] ?? null }, error: null }) },
  }
  return { etat, client }
})

vi.mock('@supabase/supabase-js', () => ({ createClient: () => h.client }))
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/mocks-routes-api')).rateLimitPermissif())
vi.mock('@/lib/logger', async () => (await import('../helpers/mocks-routes-api')).loggerSilencieux())

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://base.exemple.test'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'cle-publique-de-test'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'cle-serveur-de-test'

const { GET } = await import('@/app/api/marketplace-btp/[id]/route')

const lire = async (jeton?: string, id = ANNONCE) => {
  const res = await GET(
    new NextRequest(`https://vitfix.io/api/marketplace-btp/${id}`, { headers: jeton ? { authorization: `Bearer ${jeton}` } : {} }),
    { params: Promise.resolve({ id }) },
  )
  return { status: res.status, json: await res.json() as { listing?: Ligne; error?: string } }
}

const annonce = (status: Statut): Ligne => ({
  id: ANNONCE, user_id: VENDEUR, title: 'Mini-pelle 1,8 t', status,
  vendeur_nom: 'Entreprise Exemple', vendeur_phone: '0600000000',
})

beforeEach(() => {
  h.etat.annonce = annonce('active')
  h.etat.demandes = [{ id: 'demande-1', type_demande: 'achat', status: 'pending', created_at: '2026-11-12T10:00:00Z' }]
  h.etat.comptes = { 'jeton-vendeur': { id: VENDEUR }, 'jeton-autre': { id: AUTRE_COMPTE } }
  h.etat.vues = 0
})

describe('GET /api/marketplace-btp/[id] — annonces qui ne sont plus publiques', () => {
  it.each(NON_PUBLIQUES)('annonce au statut %s : 404 pour un visiteur, ni coordonnées ni vue comptée', async (statut) => {
    h.etat.annonce = annonce(statut)
    const res = await lire()
    expect(res.status).toBe(404)
    expect(res.json.listing).toBeUndefined()
    expect(JSON.stringify(res.json)).not.toContain('0600000000')
    expect(h.etat.vues).toBe(0)
  })

  it('annonce en pause : 404 aussi pour un autre compte connecté', async () => {
    h.etat.annonce = annonce('paused')
    expect((await lire('jeton-autre')).status).toBe(404)
  })

  it('annonce supprimée : 404 même pour son vendeur (elle a quitté « Mes annonces »)', async () => {
    h.etat.annonce = annonce('deleted')
    const res = await lire('jeton-vendeur')
    expect(res.status).toBe(404)
    expect(h.etat.vues).toBe(0)
  })
})

describe('GET /api/marketplace-btp/[id] — ce qui ne change pas', () => {
  it('annonce active : lisible par un visiteur, sans les demandes, vue comptée', async () => {
    const res = await lire()
    expect(res.status).toBe(200)
    expect(res.json.listing).toMatchObject({ id: ANNONCE, title: 'Mini-pelle 1,8 t', marketplace_demandes: null })
    expect(h.etat.vues).toBe(1)
  })

  it('annonce active : son vendeur reçoit aussi les demandes', async () => {
    const res = await lire('jeton-vendeur')
    expect(res.status).toBe(200)
    expect(res.json.listing?.marketplace_demandes).toEqual(h.etat.demandes)
  })

  it.each(LISIBLES_PAR_LE_VENDEUR)('annonce au statut %s : toujours lisible par son vendeur', async (statut) => {
    h.etat.annonce = annonce(statut)
    const res = await lire('jeton-vendeur')
    expect(res.status).toBe(200)
    expect(res.json.listing).toMatchObject({ id: ANNONCE, status: statut })
  })

  it('annonce inconnue : 404 ; identifiant mal formé : 400', async () => {
    h.etat.annonce = null
    expect((await lire()).status).toBe(404)
    expect((await lire(undefined, 'pas-un-identifiant')).status).toBe(400)
  })
})
