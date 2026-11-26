// @vitest-environment node
// tests/api/pro-documents-chantiers.test.ts — /api/pro/documents/chantiers : devis et factures de la société vus depuis
// l'écran Chantiers, et « Lier un devis », pour un compte invité (26/11/2026).
//
// Le défaut d'origine : la liaison partait du navigateur, où la RLS de `devis` filtre sans erreur pour un compte invité.
// Zéro ligne touchée, toast « Devis lié au chantier », rien de changé. Ce que chaque cas protège :
//   - la lecture ne rend que les familles que le rôle voit, et rien à un salarié de terrain ;
//   - la liaison exige d'écrire les devis ET les chantiers, borne le devis et le chantier à la société, et une liaison
//     qui ne touche aucune ligne est un 404, jamais un succès.

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

const { GET, POST } = await import('@/app/api/pro/documents/chantiers/route')
const { nouvelleBase, requetes } = await import('../helpers/faux-supabase-btp')

const SOCIETE = '550e8400-e29b-41d4-a716-446655440000'
const AUTRE_SOCIETE = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const CHANTIER = '9b2f0c1e-0000-4000-8000-0000000000c1'
const CHANTIER_AILLEURS = '9b2f0c1e-0000-4000-8000-0000000000c2'
const DEVIS = '3d1a7e42-0000-4000-8000-0000000000d1'
const DEVIS_AILLEURS = '3d1a7e42-0000-4000-8000-0000000000d2'
const DEVIS_SUPPRIME = '3d1a7e42-0000-4000-8000-0000000000d3'

// resolveCompanyId garde la société d'un compte 60 s en mémoire : un compte NEUF par cas.
let compteur = 0
function invite(role: string): string {
  compteur += 1
  const id = `00000000-0000-4000-9100-${String(compteur).padStart(12, '0')}`
  h.user = { id, app_metadata: { role: 'pro_societe', pro_team_role: role, company_id: SOCIETE } }
  h.base.lignes.pro_team_members = [{ id: `membre-${id}`, user_id: id, company_id: SOCIETE, is_active: true }]
  return id
}

const lire = async () => {
  const res = await GET(new NextRequest('https://vitfix.io/api/pro/documents/chantiers', { headers: { Authorization: 'Bearer jeton' } }))
  return { status: res.status, json: await res.json() as Record<string, unknown> }
}
const lier = async (devisId: string, chantierId: string) => {
  const res = await POST(new NextRequest('https://vitfix.io/api/pro/documents/chantiers', {
    method: 'POST',
    headers: { Authorization: 'Bearer jeton', 'Content-Type': 'application/json' },
    body: JSON.stringify({ devisId, chantierId }),
  }))
  return { status: res.status, json: await res.json() as Record<string, unknown> }
}

const devisEnBase = (id: string) => (h.base.lignes.devis ?? []).find(l => l.id === id)

beforeEach(() => {
  h.base = nouvelleBase({
    chantiers_btp: [
      { id: CHANTIER, owner_id: SOCIETE, titre: 'Fachada Rua Exemplo' },
      { id: CHANTIER_AILLEURS, owner_id: AUTRE_SOCIETE, titre: 'Chantier d’une autre entreprise' },
    ],
    devis: [
      { id: DEVIS, artisan_user_id: SOCIETE, numero: 'ORC-2026-001', chantier_id: null, created_at: '2026-11-20' },
      { id: DEVIS_AILLEURS, artisan_user_id: AUTRE_SOCIETE, numero: 'DEV-2026-009', chantier_id: null, created_at: '2026-11-21' },
      { id: DEVIS_SUPPRIME, artisan_user_id: SOCIETE, numero: 'ORC-2026-002', chantier_id: null, deleted_at: '2026-11-22T10:00:00Z' },
    ],
    factures: [
      { id: 'f-liee', artisan_user_id: SOCIETE, numero: 'FT-2026-001', chantier_id: CHANTIER },
      { id: 'f-libre', artisan_user_id: SOCIETE, numero: 'FT-2026-002', chantier_id: null },
    ],
  })
  h.user = null
})

describe('GET : devis et factures de la société pour l’écran Chantiers', () => {
  it('la secrétaire reçoit les devis vivants de la société et les factures rattachées à un chantier', async () => {
    invite('SECRETAIRE')

    const { status, json } = await lire()

    expect(status).toBe(200)
    expect((json.devis as Array<{ id: string }>).map(d => d.id)).toEqual([DEVIS])
    expect((json.factures as Array<{ id: string }>).map(f => f.id)).toEqual(['f-liee'])
    expect(requetes(h.base, 'devis', 'select')[0].filtres).toEqual({ artisan_user_id: SOCIETE })
    // Les factures rattachées sont filtrées en base, pas toute la facturation de la société relue puis triée ici.
    expect(requetes(h.base, 'factures', 'select')[0]).toMatchObject({ filtres: { artisan_user_id: SOCIETE }, nonNul: ['chantier_id'] })
  })

  it('base sans colonne raw_data : relue avec l’ancienne colonne client_address, comme l’écran du titulaire', async () => {
    invite('SECRETAIRE')
    h.base.erreurs.push({
      table: 'devis', operation: 'select', siColonne: 'raw_data',
      erreur: { code: '42703', message: 'column devis.raw_data does not exist' },
    })

    const { status, json } = await lire()

    expect(status).toBe(200)
    expect((json.devis as Array<{ id: string }>).map(d => d.id)).toEqual([DEVIS])
    const lectures = requetes(h.base, 'devis', 'select')
    expect(lectures).toHaveLength(2)
    expect(lectures[1].colonnes).toContain('client_address')
  })

  it('le comptable (devis en lecture, factures) les voit aussi', async () => {
    invite('COMPTABLE')
    expect((await lire()).status).toBe(200)
  })

  it('un salarié de terrain n’en reçoit aucun, et rien n’est lu', async () => {
    invite('OUVRIER')

    const { status, json } = await lire()

    expect(status).toBe(403)
    expect(json.code).toBe('aucun_droit')
    expect(requetes(h.base, 'devis')).toHaveLength(0)
  })
})

describe('POST : lier un devis de la société à un chantier de la société', () => {
  it.each(['GERANT', 'SECRETAIRE'])('%s invité lie le devis : la ligne change vraiment', async (role) => {
    invite(role)

    const { status } = await lier(DEVIS, CHANTIER)

    expect(status).toBe(200)
    expect(devisEnBase(DEVIS)?.chantier_id).toBe(CHANTIER)
  })

  it.each([
    ['le comptable (devis en lecture)', 'COMPTABLE'],
    ['un chef de chantier (chantiers en lecture)', 'CHEF_CHANTIER'],
  ])('%s est refusé sans rien écrire', async (_cas, role) => {
    invite(role)

    const { status, json } = await lier(DEVIS, CHANTIER)

    expect(status).toBe(403)
    expect(json.code).toBe('aucun_droit_liaison')
    expect(requetes(h.base, 'devis', 'update')).toHaveLength(0)
  })

  it.each([
    ['un devis d’une autre société', DEVIS_AILLEURS, CHANTIER],
    ['un devis supprimé', DEVIS_SUPPRIME, CHANTIER],
    ['un chantier d’une autre société', DEVIS, CHANTIER_AILLEURS],
  ])('%s : 404, et aucune liaison', async (_cas, devisId, chantierId) => {
    invite('GERANT')

    const { status } = await lier(devisId, chantierId)

    expect(status).toBe(404)
    for (const id of [DEVIS, DEVIS_AILLEURS, DEVIS_SUPPRIME]) expect(devisEnBase(id)?.chantier_id).toBeNull()
  })

  it('un rattachement sans ligne d’équipe active est refusé (409)', async () => {
    invite('GERANT')
    h.base.lignes.pro_team_members = []

    const { status, json } = await lier(DEVIS, CHANTIER)

    expect(status).toBe(409)
    expect(json.code).toBe('societe_non_resolue')
    expect(devisEnBase(DEVIS)?.chantier_id).toBeNull()
  })
})
