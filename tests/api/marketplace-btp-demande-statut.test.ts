// @vitest-environment node
// tests/api/marketplace-btp-demande-statut.test.ts
//
// POST /api/marketplace-btp/[id]/demande — demande d'achat ou de location sur une annonce du Marketplace.
// Même règle que le détail (GET /api/marketplace-btp/[id], tests/api/marketplace-btp-detail-statut.test.ts) : seule une
// annonce active reçoit une demande. Une annonce en pause, vendue, louée ou supprimée répond 404 « Annonce
// introuvable », avant toute demande enregistrée et toute notification au vendeur. Même règle pour les sociétés et pour
// les artisans. Aucune donnée réelle : annonce et comptes d'exemple.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { StatusAnnonce } from '@/lib/marketplace-btp-types'

type Ligne = Record<string, unknown>
// Statuts de la base (CHECK de marketplace_listings.status, migration 027) autres que « active ».
const NON_ACTIFS: StatusAnnonce[] = ['paused', 'deleted', 'vendu', 'loue']

const VENDEUR = '11111111-1111-4111-8111-111111111111'
const ACHETEUR = '22222222-2222-4222-8222-222222222222'
const ANNONCE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

const h = vi.hoisted(() => {
  const etat = {
    annonce: null as Record<string, unknown> | null,
    insertions: [] as Array<{ table: string; ligne: Record<string, unknown> }>,
    comptes: {} as Record<string, { id: string }>,
  }
  const client = {
    from(table: string) {
      // Comme PostgREST, la lecture ne rend que les colonnes demandées par select().
      let colonnes = '*'
      let inseree: Record<string, unknown> | null = null
      const q: Record<string, unknown> = {}
      q.select = (liste?: string) => {
        if (!inseree) colonnes = liste ?? '*'
        return q
      }
      q.eq = () => q
      q.insert = (ligne: Record<string, unknown>) => {
        inseree = ligne
        etat.insertions.push({ table, ligne })
        return q
      }
      q.single = async () => {
        if (inseree) return { data: { id: 'demande-1', ...inseree }, error: null }
        const annonce = etat.annonce
        if (table !== 'marketplace_listings' || !annonce) return { data: null, error: { code: 'PGRST116', message: 'aucune ligne' } }
        const data = colonnes === '*'
          ? annonce
          : Object.fromEntries(colonnes.split(',').map(c => c.trim()).filter(c => c in annonce).map(c => [c, annonce[c]]))
        return { data, error: null }
      }
      q.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(ok, ko)
      return q
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

const { POST } = await import('@/app/api/marketplace-btp/[id]/demande/route')

const demander = async (jeton = 'jeton-acheteur') => {
  const res = await POST(
    new NextRequest(`https://vitfix.io/api/marketplace-btp/${ANNONCE}/demande`, {
      method: 'POST',
      body: JSON.stringify({ type_demande: 'achat', message: 'Toujours disponible ?' }),
      headers: { authorization: `Bearer ${jeton}`, 'content-type': 'application/json' },
    }),
    { params: Promise.resolve({ id: ANNONCE }) },
  )
  return { status: res.status, json: await res.json() as Ligne }
}

const annonce = (status: StatusAnnonce): Ligne => ({
  id: ANNONCE, user_id: VENDEUR, title: 'Mini-pelle 1,8 t', status, vendeur_nom: 'Entreprise Exemple',
})

beforeEach(() => {
  h.etat.annonce = annonce('active')
  h.etat.insertions = []
  h.etat.comptes = { 'jeton-vendeur': { id: VENDEUR }, 'jeton-acheteur': { id: ACHETEUR } }
})

describe('POST /api/marketplace-btp/[id]/demande — annonce qui n’est plus active', () => {
  it.each(NON_ACTIFS)('annonce au statut %s : 404 « Annonce introuvable », ni demande enregistrée ni vendeur prévenu', async (statut) => {
    h.etat.annonce = annonce(statut)
    expect(await demander()).toEqual({ status: 404, json: { error: 'Annonce introuvable' } })
    expect(h.etat.insertions).toEqual([])
  })
})

describe('POST /api/marketplace-btp/[id]/demande — ce qui ne change pas', () => {
  it('annonce active : la demande est enregistrée et le vendeur prévenu (201)', async () => {
    const res = await demander()
    expect(res.status).toBe(201)
    expect(res.json.demande).toMatchObject({ listing_id: ANNONCE, buyer_user_id: ACHETEUR, type_demande: 'achat' })
    expect(h.etat.insertions.map(i => i.table)).toEqual(['marketplace_demandes', 'artisan_notifications'])
    expect(h.etat.insertions[1].ligne).toMatchObject({ artisan_id: VENDEUR, type: 'marketplace_demande', read: false })
  })

  it('annonce active de son propre compte : 400, rien n’est écrit', async () => {
    const res = await demander('jeton-vendeur')
    expect(res.status).toBe(400)
    expect(h.etat.insertions).toEqual([])
  })

  it('annonce inconnue : 404 « Annonce introuvable », rien n’est écrit', async () => {
    h.etat.annonce = null
    expect(await demander()).toEqual({ status: 404, json: { error: 'Annonce introuvable' } })
    expect(h.etat.insertions).toEqual([])
  })
})
