// @vitest-environment node
// tests/api/btp-ref-taux-lecture-seule.test.ts — `ref_taux` en lecture seule pour /api/btp (04/11/2026).
//   - POST /api/btp avec `table: 'ref_taux'` : 400 de validation pour chaque action du schéma, sans
//     aucun appel à Supabase ;
//   - témoin : POST sur une table de l'utilisateur (`charges_fixes`) toujours accepté ;
//   - GET /api/btp?table=ref_taux : toujours 200 avec les taux de référence.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

type Ligne = Record<string, unknown>

const h = vi.hoisted(() => {
  const etat = {
    user: null as null | { id: string },
    refTaux: [] as Ligne[],
    appels: [] as Array<{ table: string; operation: string }>,
  }
  const from = (table: string) => {
    etat.appels.push({ table, operation: 'from' })
    const lignes = (): Ligne[] => (table === 'ref_taux' ? etat.refTaux : [])
    let derniere: Ligne | null = null
    const b: Record<string, unknown> = {}
    b.select = () => b
    b.eq = () => b
    b.order = () => b
    b.limit = () => b
    b.insert = (row: Ligne | Ligne[]) => {
      etat.appels.push({ table, operation: 'insert' })
      derniere = Array.isArray(row) ? row[0] ?? null : { id: 'nouvelle-ligne', ...row }
      return b
    }
    b.update = () => { etat.appels.push({ table, operation: 'update' }); return b }
    b.delete = () => { etat.appels.push({ table, operation: 'delete' }); return b }
    b.upsert = () => { etat.appels.push({ table, operation: 'upsert' }); return b }
    b.single = async () => ({ data: derniere ?? lignes()[0] ?? null, error: null })
    b.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) =>
      Promise.resolve({ data: lignes(), error: null }).then(ok, ko)
    return b
  }
  return { etat, from }
})

vi.mock('@/lib/auth-helpers', () => ({ getAuthUser: vi.fn(async () => h.etat.user) }))
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/mocks-routes-api')).rateLimitPermissif())
vi.mock('@/lib/logger', async () => (await import('../helpers/mocks-routes-api')).loggerSilencieux())
vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin: { from: (t: string) => h.from(t) } }))

const { GET, POST } = await import('@/app/api/btp/route')

const USER_A = '550e8400-e29b-41d4-a716-446655440000'
const ID_TAUX = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'

const poster = async (corps: Record<string, unknown>) => {
  const res = await POST(new NextRequest('https://vitfix.io/api/btp', {
    method: 'POST',
    headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  }))
  return { status: res.status, json: await res.json() }
}

const lire = async (query: string) => {
  const res = await GET(new NextRequest(`https://vitfix.io/api/btp${query}`, { headers: { Authorization: 'Bearer tok' } }))
  return { status: res.status, json: await res.json() }
}

beforeEach(() => {
  h.etat.user = { id: USER_A }
  h.etat.appels = []
  h.etat.refTaux = [
    { id: ID_TAUX, juridiction: 'FR', regime: 'micro', type_charge: 'urssaf', taux: 0.212 },
  ]
})

describe('POST /api/btp — ref_taux refusé en écriture', () => {
  const corpsParAction: Record<string, Record<string, unknown>> = {
    insert: { table: 'ref_taux', action: 'insert', data: { juridiction: 'FR', regime: 'micro', type_charge: 'urssaf', taux: 0 } },
    update: { table: 'ref_taux', action: 'update', id: ID_TAUX, data: { taux: 0 } },
    delete: { table: 'ref_taux', action: 'delete', id: ID_TAUX },
    import: { table: 'ref_taux', action: 'import', data: [{ juridiction: 'FR', regime: 'micro', type_charge: 'urssaf', taux: 0 }] },
    upsert_settings: { table: 'ref_taux', action: 'upsert_settings', data: {} },
  }

  for (const [action, corps] of Object.entries(corpsParAction)) {
    it(`400 de validation pour l'action ${action}, sans appel à Supabase`, async () => {
      const res = await poster(corps)
      expect(res.status).toBe(400)
      expect(res.json.error).toBe('Données invalides')
      expect(res.json.details).toHaveProperty('table')
      expect(h.etat.appels).toEqual([])
    })
  }

  it('témoin : une table de l\'utilisateur (charges_fixes) reste écrivable', async () => {
    const res = await poster({ table: 'charges_fixes', action: 'insert', data: { label: 'Assurance', montant: 100, frequence: 'mensuel', categorie: 'assurance' } })
    expect(res.status).toBe(201)
    expect(h.etat.appels).toContainEqual({ table: 'charges_fixes', operation: 'insert' })
  })
})

describe('GET /api/btp?table=ref_taux — lecture conservée', () => {
  it('200 avec les taux de référence', async () => {
    const res = await lire('?table=ref_taux')
    expect(res.status).toBe(200)
    expect(res.json.ref_taux).toEqual(h.etat.refTaux)
    expect(h.etat.appels).toEqual([{ table: 'ref_taux', operation: 'from' }])
  })
})
