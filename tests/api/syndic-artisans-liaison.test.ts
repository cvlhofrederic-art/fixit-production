// tests/api/syndic-artisans-liaison.test.ts
//
// GET /api/syndic/artisans — liaison automatique des fiches prestataires : le compte Vitfix retrouvé
// par e-mail (artisan_user_id) et les attestations trouvées dans le coffre (RC Pro, décennale) sont
// ENREGISTRÉS. Avant, `void supabaseAdmin.from(...).update(...)` : un constructeur PostgREST est
// paresseux, la requête n'était jamais envoyée (le faux client ci-dessous n'exécute qu'à l'await).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

type Requete = { table: string; op: 'select' | 'update'; donnees?: Record<string, unknown>; eq: Array<[string, unknown]>; envoyee: boolean }

const h = vi.hoisted(() => ({
  requetes: [] as Array<{ table: string; op: 'select' | 'update'; donnees?: Record<string, unknown>; eq: Array<[string, unknown]>; envoyee: boolean }>,
  erreurUpdate: null as null | { message: string },
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

const FICHE = { id: 'fiche-1', cabinet_id: 'cab-1', artisan_user_id: null, email: 'Plombier@Exemple.fr', nom: 'Damien Perrin', statut: 'actif', rc_pro_valide: false, assurance_decennale_valide: false }

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: h.logger }))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => true),
  getClientIP: vi.fn(() => '127.0.0.1'),
  rateLimitResponse: vi.fn(() => Response.json({ error: 'rate' }, { status: 429 })),
}))
vi.mock('@/lib/auth-helpers', () => ({
  getAuthUser: vi.fn(async () => ({ id: 'cab-1', app_metadata: { role: 'syndic' } })),
  isSyndicRole: vi.fn(() => true),
  isSuperAdmin: vi.fn(() => false),
  resolveCabinetId: vi.fn(async () => 'cab-1'),
}))
vi.mock('@/lib/supabase-server', () => {
  const resultat = (r: Requete) => {
    if (r.op === 'update') return { data: null, error: h.erreurUpdate }
    if (r.table === 'syndic_artisans') return { data: [{ ...FICHE }], error: null }
    if (r.table === 'profiles_artisan') return { data: [{ id: 'profil-1', user_id: 'compte-1', email: 'plombier@exemple.fr' }], error: null }
    return { data: [], error: null }
  }
  const from = (table: string) => {
    const r: Requete = { table, op: 'select', eq: [], envoyee: false }
    h.requetes.push(r)
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'order', 'limit', 'in']) b[m] = () => b
    b.eq = (c: string, v: unknown) => { r.eq.push([c, v]); return b }
    b.update = (d: Record<string, unknown>) => { r.op = 'update'; r.donnees = d; return b }
    // Paresseux comme PostgREST : rien n'est envoyé tant que la requête n'est pas attendue.
    b.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => {
      r.envoyee = true
      return Promise.resolve(resultat(r)).then(ok, ko)
    }
    return b
  }
  const fichiers = (chemin: string) =>
    chemin === 'wallet/compte-1/rc_pro' || chemin === 'wallet/compte-1/assurance_decennale'
      ? [{ name: 'attestation.pdf', metadata: { size: 1200 } }]
      : []
  return {
    supabaseAdmin: {
      from,
      storage: { from: () => ({ list: async (chemin: string) => ({ data: fichiers(chemin), error: null }) }) },
    },
  }
})

const { GET } = await import('@/app/api/syndic/artisans/route')
const appeler = () => GET(new NextRequest('https://vitfix.io/api/syndic/artisans', { headers: { Authorization: 'Bearer tok' } }))
const majEnvoyees = () => h.requetes.filter((r) => r.table === 'syndic_artisans' && r.op === 'update' && r.envoyee)

beforeEach(() => {
  h.requetes.length = 0
  h.erreurUpdate = null
  h.logger.error.mockClear()
})

describe('GET /api/syndic/artisans — liaison des fiches enregistrée', () => {
  it('compte retrouvé par e-mail, RC Pro et décennale : les trois mises à jour sont envoyées', async () => {
    const res = await appeler()
    expect(res.status).toBe(200)
    const { artisans } = await res.json()
    expect(artisans[0]).toMatchObject({ artisan_user_id: 'compte-1', rc_pro_valide: true, assurance_decennale_valide: true })

    const maj = majEnvoyees()
    expect(maj.map((r) => r.donnees)).toEqual(expect.arrayContaining([
      expect.objectContaining({ artisan_user_id: 'compte-1' }),
      expect.objectContaining({ rc_pro_valide: true }),
      expect.objectContaining({ assurance_decennale_valide: true }),
    ]))
    for (const r of maj) expect(r.eq).toContainEqual(['id', 'fiche-1'])
    // Aucune mise à jour construite sans être envoyée.
    expect(h.requetes.filter((r) => r.op === 'update' && !r.envoyee)).toHaveLength(0)
  })

  it('échec d’une mise à jour : journalisé, la liste reste servie', async () => {
    h.erreurUpdate = { message: 'permission denied' }
    const res = await appeler()
    expect(res.status).toBe(200)
    expect(h.logger.error).toHaveBeenCalledWith(expect.stringContaining('[ARTISANS GET] mise à jour fiche'), { message: 'permission denied' })
  })
})
