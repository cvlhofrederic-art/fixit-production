// @vitest-environment node
// tests/api/btp-lecture-panne.test.ts — GET /api/btp quand la base répond en erreur (constat api-coeur-6, 15/11/2026).
//
// Avant : l'erreur de chaque requête n'était jamais lue, la route répondait 200 avec une liste vide. Le tableau de
// bord affichait « aucun chantier », gardait cette liste vide 5 minutes en cache, et l'import automatique pouvait
// renvoyer d'anciennes données du navigateur vers une table qui en contenait déjà.
// Maintenant : 500 avec un message clair, jamais une liste vide inventée. Une table réellement vide et des réglages
// pas encore enregistrés restent des réponses normales (200). Même règle depuis le 27/11/2026 quand c'est la ligne
// d'équipe d'un compte invité qui est illisible (dernier bloc).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { FauxBase } from '../helpers/faux-supabase-btp'

const h = vi.hoisted(() => ({
  base: null as unknown as FauxBase,
  user: null as null | { id: string; email?: string; app_metadata?: Record<string, unknown> },
}))

vi.mock('@/lib/auth-helpers', async (io) => (await import('../helpers/mocks-routes-api')).authHelpersReels(io, () => h.user))
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/mocks-routes-api')).rateLimitPermissif())
vi.mock('@/lib/logger', async () => (await import('../helpers/mocks-routes-api')).loggerSilencieux())
vi.mock('@/lib/supabase-server', async () => {
  const { fauxSupabase } = await import('../helpers/faux-supabase-btp')
  return { supabaseAdmin: { from: (t: string) => fauxSupabase(h.base).from(t) } }
})

const { nouvelleBase, requetes } = await import('../helpers/faux-supabase-btp')
const { GET, POST } = await import('@/app/api/btp/route')
const { logger } = await import('@/lib/logger')

const SOCIETE = '550e8400-e29b-41d4-a716-446655440000'
const PANNE = { code: '57014', message: 'canceling statement due to statement timeout' }

const lire = async (query: string) => {
  const res = await GET(new NextRequest(`https://vitfix.io/api/btp${query}`, { headers: { Authorization: 'Bearer tok' } }))
  return { status: res.status, json: await res.json() as Record<string, unknown> }
}

const ecrire = async (corps: unknown) => {
  const res = await POST(new NextRequest('https://vitfix.io/api/btp', {
    method: 'POST', headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' }, body: JSON.stringify(corps),
  }))
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

describe('GET /api/btp — ligne d’équipe d’un compte invité illisible (signalement du 27/11/2026)', () => {
  // resolveCompanyId avale l'erreur de lecture de pro_team_members et rend le compte lui-même. La garde « rattaché à
  // une autre société sans ligne d'équipe active » de lirePerimetreBtp donnait alors un périmètre vide : 200, des
  // listes vides et `restreint`. Le salarié voyait « aucun chantier » sans erreur, liste que le tableau de bord
  // gardait 5 minutes en cache.
  const MEMBRES = 'pro_team_members'
  const AUTRE_SOCIETE = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
  const RESEAU = { code: '', message: 'TypeError: fetch failed' }
  let compteur = 0

  /** Compte invité neuf (resolveCompanyId garde 60 s la société d'un compte), avec sa ligne d'équipe active. */
  const invite = (role: string) => {
    const id = `99999999-0000-4000-8000-${String((compteur += 1)).padStart(12, '0')}`
    h.user = { id, email: 'joao@exemple.test', app_metadata: { role: 'pro_societe', pro_team_role: role, company_id: SOCIETE } }
    h.base.lignes[MEMBRES] = [{ id: `ligne-${id}`, user_id: id, company_id: SOCIETE, is_active: true }]
    return id
  }

  beforeEach(() => {
    h.base.lignes.chantiers_btp = [{ id: 'c1', owner_id: SOCIETE, titre: 'Rénovation', statut: 'En cours' }]
  })

  it.each([
    ['OUVRIER', 'chantiers', PANNE], ['OUVRIER', 'all', PANNE], ['OUVRIER', 'settings', PANNE],
    ['OUVRIER', 'rapports', PANNE], ['SECRETAIRE', 'chantiers', PANNE], ['GERANT', 'all', PANNE],
    ['OUVRIER', 'chantiers', RESEAU],
  ])('%s, table=%s, erreur %j : 500, jamais des listes vides données pour vraies', async (role, parametre, erreur) => {
    invite(role)
    h.base.erreurs.push({ table: MEMBRES, operation: 'select', erreur })

    const res = await lire(`?table=${parametre}`)

    expect(res.status).toBe(500)
    expect(res.json).toEqual({ error: expect.stringMatching(/pas pu être chargées.*réessayez/i) })
    expect(logger.error).toHaveBeenCalled()
  })

  it('la requête lève une exception au lieu de rendre une erreur : 500 aussi', async () => {
    invite('OUVRIER')
    h.base.erreurs.push({ table: MEMBRES, operation: 'select', erreur: RESEAU, siFiltre: 'user_id', lever: true })

    const res = await lire('?table=chantiers')

    expect(res.status).toBe(500)
    expect(res.json).toEqual({ error: expect.stringMatching(/pas pu être chargées.*réessayez/i) })
  })

  it('panne passagère : la relecture retrouve la société, la réponse est normale dès cette requête', async () => {
    invite('SECRETAIRE')
    // La lecture de resolveCompanyId échoue, la relecture aboutit : c'était une panne, et la société est connue.
    h.base.erreurs.push({ table: MEMBRES, operation: 'select', erreur: PANNE, fois: 1 })

    const res = await lire('?table=chantiers')

    expect(res.status).toBe(200)
    expect(res.json).toEqual({ chantiers: [expect.objectContaining({ id: 'c1', owner_id: SOCIETE, titre: 'Rénovation' })] })
  })

  it('panne passagère d’un salarié de terrain : sa vue restreinte, comme sans panne', async () => {
    invite('OUVRIER')
    h.base.lignes.membres_btp = [{ id: 'm1', owner_id: SOCIETE, email: 'joao@exemple.test', actif: true }]
    h.base.lignes.chantiers_btp[0].membres_ids = ['m1']
    h.base.erreurs.push({ table: MEMBRES, operation: 'select', erreur: PANNE, fois: 1 })

    const res = await lire('?table=chantiers')

    expect(res.status).toBe(200)
    expect(res.json).toEqual({ chantiers: [expect.objectContaining({ id: 'c1', titre: 'Rénovation' })], restreint: true, rattachement: 'relie' })
    expect(res.json.chantiers).toEqual([expect.not.objectContaining({ owner_id: SOCIETE })])
  })

  it('plus aucune ligne d’équipe active (retiré, désactivé) : 200 sans droit, comme avant — ce n’est pas une panne', async () => {
    invite('OUVRIER')
    h.base.lignes[MEMBRES] = h.base.lignes[MEMBRES].map(l => ({ ...l, is_active: false }))

    const res = await lire('?table=chantiers')

    expect(res.status).toBe(200)
    expect(res.json).toEqual({ chantiers: [], restreint: true })
  })

  it('deux rattachements actifs : refus durable (200 sans droit), pas un « réessayez » qui ne se résoudrait jamais', async () => {
    const id = invite('OUVRIER')
    h.base.lignes[MEMBRES].push({ id: `autre-${id}`, user_id: id, company_id: AUTRE_SOCIETE, is_active: true })

    const res = await lire('?table=chantiers')

    expect(res.status).toBe(200)
    expect(res.json).toEqual({ chantiers: [], restreint: true })
  })

  it('ligne active vers le compte lui-même (ancienne société fantôme) : refus durable, pas un 500', async () => {
    const id = invite('OUVRIER')
    h.base.lignes[MEMBRES] = [{ id: `fantome-${id}`, user_id: id, company_id: id, is_active: true }]

    const res = await lire('?table=chantiers')

    expect(res.status).toBe(200)
    expect(res.json).toEqual({ chantiers: [], restreint: true })
  })

  it('pendant la panne, aucune écriture ne part', async () => {
    invite('SECRETAIRE')
    h.base.erreurs.push({ table: MEMBRES, operation: 'select', erreur: PANNE })

    const res = await ecrire({ table: 'chantiers_btp', action: 'insert', data: { titre: 'Pendant la panne', statut: 'En cours' } })

    expect([403, 500]).toContain(res.status)
    expect(h.base.lignes.chantiers_btp.some(c => c.titre === 'Pendant la panne')).toBe(false)
  })

  it.each([
    ['gérant titulaire', { role: 'pro_societe' }],
    ['artisan', { role: 'artisan' }],
  ])('%s : pro_team_members n’est pas lue, sa panne ne change rien', async (_cas, appMetadata) => {
    h.user = { id: SOCIETE, app_metadata: appMetadata }
    h.base.erreurs.push({ table: MEMBRES, operation: 'select', erreur: PANNE })

    const res = await lire('?table=chantiers')

    expect(res.status).toBe(200)
    expect(res.json).toEqual({ chantiers: [{ id: 'c1', owner_id: SOCIETE, titre: 'Rénovation', statut: 'En cours' }] })
    expect(requetes(h.base, MEMBRES)).toHaveLength(0)
  })
})
