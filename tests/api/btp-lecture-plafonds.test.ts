// @vitest-environment node
// tests/api/btp-lecture-plafonds.test.ts — GET /api/btp au-delà du nombre maximal de lignes d'une liste
// (constat donnees-btp-10, 15/11/2026).
//
// Avant : au-delà de 500 pointages (200 chantiers, 200 situations…), la route renvoyait les N premières lignes sans
// le dire ; « Voir tout », les cumuls d'heures et la rentabilité portaient sur une liste coupée sans aucun signe.
// Maintenant : mêmes lignes qu'avant (les N premières dans le même ordre, rien de supprimé ni de masqué en plus),
// et `plafondsAtteints` dit quelle liste est incomplète pour que l'écran prévienne.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { FauxBase } from '../helpers/faux-supabase-btp'

const h = vi.hoisted(() => ({
  base: null as unknown as FauxBase,
  user: null as null | { id: string; app_metadata?: Record<string, unknown> },
}))

vi.mock('@/lib/auth-helpers', () => ({ getAuthUser: vi.fn(async () => h.user) }))
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/mocks-routes-api')).rateLimitPermissif())
vi.mock('@/lib/logger', async () => (await import('../helpers/mocks-routes-api')).loggerSilencieux())
vi.mock('@/lib/supabase-server', async () => {
  const { fauxSupabase } = await import('../helpers/faux-supabase-btp')
  return { supabaseAdmin: { from: (t: string) => fauxSupabase(h.base).from(t) } }
})

const { GET } = await import('@/app/api/btp/route')
const { nouvelleBase } = await import('../helpers/faux-supabase-btp')

const SOCIETE = '550e8400-e29b-41d4-a716-446655440000'
const AUTRE = '7c9e6679-7425-40de-944b-e07fc1f90ae7'

const lire = async (query: string) => {
  const res = await GET(new NextRequest(`https://vitfix.io/api/btp${query}`, { headers: { Authorization: 'Bearer tok' } }))
  return { status: res.status, json: await res.json() as Record<string, unknown> }
}

/** n lignes du compte (dans l'ordre où la base les rend), plus une ligne d'un autre compte qui ne doit jamais compter. */
const lignes = (prefixe: string, n: number) => [
  ...Array.from({ length: n }, (_, i) => ({ id: `${prefixe}-${i + 1}`, owner_id: SOCIETE })),
  { id: `${prefixe}-autre`, owner_id: AUTRE },
]

// Paramètre `table`, table (ou vue) en base, nombre maximal de lignes renvoyées.
const LISTES_PLAFONNEES: Array<[string, string, number]> = [
  ['chantiers', 'chantiers_btp', 200], ['membres', 'membres_btp', 500], ['pointages', 'pointages_btp', 500],
  ['depenses', 'depenses_btp', 500], ['situations', 'situations_btp', 200], ['retenues', 'retenues_btp', 200],
  ['dc4', 'dc4_btp', 200], ['dce_analyses', 'dce_analyses_btp', 100], ['dpgf', 'dpgf_btp', 200],
  ['rapports', 'rapports_btp', 500], ['rentabilite', 'v_rentabilite_chantier', 100],
]

beforeEach(() => {
  h.user = { id: SOCIETE, app_metadata: { role: 'pro_societe' } }
  h.base = nouvelleBase()
})

describe('GET /api/btp — liste plus longue que son maximum', () => {
  for (const [parametre, tableEnBase, plafond] of LISTES_PLAFONNEES) {
    it(`table=${parametre} : les ${plafond} mêmes lignes qu'avant, et la liste est signalée incomplète`, async () => {
      h.base.lignes[tableEnBase] = lignes(parametre, plafond + 1)

      const res = await lire(`?table=${parametre}`)

      expect(res.status).toBe(200)
      const recues = res.json[parametre] as Array<{ id: string }>
      expect(recues.map(l => l.id)).toEqual(Array.from({ length: plafond }, (_, i) => `${parametre}-${i + 1}`))
      expect(res.json.plafondsAtteints).toEqual({ [parametre]: plafond })
    })

    it(`table=${parametre} : exactement ${plafond} lignes, liste complète, rien de signalé`, async () => {
      h.base.lignes[tableEnBase] = lignes(parametre, plafond)

      const res = await lire(`?table=${parametre}`)

      expect(res.status).toBe(200)
      expect((res.json[parametre] as unknown[]).length).toBe(plafond)
      expect(res.json).not.toHaveProperty('plafondsAtteints')
    })
  }

  it('table=all : seules les listes coupées sont signalées', async () => {
    h.base.lignes.chantiers_btp = lignes('chantiers', 201)
    h.base.lignes.pointages_btp = lignes('pointages', 12)

    const res = await lire('?table=all')

    expect(res.status).toBe(200)
    expect((res.json.chantiers as unknown[]).length).toBe(200)
    expect((res.json.pointages as unknown[]).length).toBe(12)
    expect(res.json.plafondsAtteints).toEqual({ chantiers: 200 })
  })

  it('listes sans maximum (équipes, frais fixes) : tout est renvoyé, rien de signalé', async () => {
    h.base.lignes.charges_fixes = lignes('frais', 800)

    const res = await lire('?table=charges_fixes')

    expect((res.json.charges_fixes as unknown[]).length).toBe(800)
    expect(res.json).not.toHaveProperty('plafondsAtteints')
  })
})
