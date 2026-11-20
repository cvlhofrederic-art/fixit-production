// @vitest-environment node
// tests/api/btp-lecture-panne.test.ts — GET /api/btp quand la base répond en erreur (constat api-coeur-6, 15/11/2026).
//
// Avant : l'erreur de chaque requête n'était jamais lue, la route répondait 200 avec une liste vide. Le tableau de
// bord affichait « aucun chantier », gardait cette liste vide 5 minutes en cache, et l'import automatique pouvait
// renvoyer d'anciennes données du navigateur vers une table qui en contenait déjà.
// Maintenant : 500 avec un message clair, jamais une liste vide inventée. Une table réellement vide et des réglages
// pas encore enregistrés restent des réponses normales (200).

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
const { logger } = await import('@/lib/logger')

const SOCIETE = '550e8400-e29b-41d4-a716-446655440000'
const PANNE = { code: '57014', message: 'canceling statement due to statement timeout' }

const lire = async (query: string) => {
  const res = await GET(new NextRequest(`https://vitfix.io/api/btp${query}`, { headers: { Authorization: 'Bearer tok' } }))
  return { status: res.status, json: await res.json() as Record<string, unknown> }
}

// Paramètre `table` → table (ou vue) lue en base et clé de la réponse.
const LECTURES: Array<[string, string]> = [
  ['chantiers', 'chantiers_btp'], ['membres', 'membres_btp'], ['equipes', 'equipes_btp'],
  ['pointages', 'pointages_btp'], ['depenses', 'depenses_btp'], ['settings', 'settings_btp'],
  ['situations', 'situations_btp'], ['retenues', 'retenues_btp'], ['dc4', 'dc4_btp'],
  ['dce_analyses', 'dce_analyses_btp'], ['dpgf', 'dpgf_btp'], ['ref_taux', 'ref_taux'],
  ['charges_fixes', 'charges_fixes'], ['rapports', 'rapports_btp'], ['rentabilite', 'v_rentabilite_chantier'],
]

beforeEach(() => {
  h.user = { id: SOCIETE, app_metadata: { role: 'pro_societe' } }
  h.base = nouvelleBase()
  vi.mocked(logger.error).mockClear()
})

describe('GET /api/btp — la base répond en erreur', () => {
  for (const [parametre, tableEnBase] of LECTURES) {
    it(`table=${parametre} : 500 avec un message clair, jamais une liste vide`, async () => {
      h.base.erreurs.push({ table: tableEnBase, operation: 'select', erreur: PANNE })

      const res = await lire(`?table=${parametre}`)

      expect(res.status).toBe(500)
      expect(res.json.error).toMatch(/pas pu être chargées.*réessayez/i)
      expect(res.json).not.toHaveProperty(parametre)
      expect(logger.error).toHaveBeenCalled()
    })
  }

  it('table=all : une seule requête en erreur suffit à répondre 500', async () => {
    h.base.erreurs.push({ table: 'pointages_btp', operation: 'select', erreur: PANNE })

    const res = await lire('?table=all')

    expect(res.status).toBe(500)
    expect(res.json).not.toHaveProperty('chantiers')
    expect(res.json).not.toHaveProperty('pointages')
  })
})

describe('GET /api/btp — réponses normales conservées', () => {
  it('table réellement vide : 200 avec une liste vide', async () => {
    const res = await lire('?table=chantiers')
    expect(res.status).toBe(200)
    expect(res.json).toEqual({ chantiers: [] })
  })

  it('réglages jamais enregistrés : 200 avec settings à null', async () => {
    const res = await lire('?table=settings')
    expect(res.status).toBe(200)
    expect(res.json).toEqual({ settings: null })
  })

  it('réglages enregistrés : 200 avec la ligne du compte', async () => {
    h.base.lignes.settings_btp = [{ owner_id: SOCIETE, devise: 'EUR', depot_rayon_m: 150 }]
    const res = await lire('?table=settings')
    expect(res.status).toBe(200)
    expect(res.json).toEqual({ settings: { owner_id: SOCIETE, devise: 'EUR', depot_rayon_m: 150 } })
  })

  it('équipes : membreIds reconstitués depuis les liens', async () => {
    h.base.lignes.equipes_btp = [{ id: 'e1', owner_id: SOCIETE, nom: 'Maçons' }]
    h.base.lignes.equipe_membres_btp = [{ equipe_id: 'e1', membre_id: 'm1' }, { equipe_id: 'e1', membre_id: 'm2' }]
    const res = await lire('?table=equipes')
    expect(res.status).toBe(200)
    expect(res.json.equipes).toEqual([expect.objectContaining({ id: 'e1', nom: 'Maçons', membreIds: ['m1', 'm2'] })])
  })

  it('table=all sans erreur : toutes les listes, réglages à null', async () => {
    h.base.lignes.chantiers_btp = [{ id: 'c1', owner_id: SOCIETE, titre: 'Rénovation' }]
    const res = await lire('?table=all')
    expect(res.status).toBe(200)
    expect(res.json).toEqual({
      chantiers: [{ id: 'c1', owner_id: SOCIETE, titre: 'Rénovation' }],
      membres: [], equipes: [], pointages: [], depenses: [], settings: null,
    })
  })
})
