// @vitest-environment node
// tests/api/pro-equipe-lecture-panne.test.ts — GET /api/pro/team quand la ligne d'équipe du compte est illisible
// (signalement du 27/11/2026).
//
// resolveCompanyId avale l'erreur de lecture de pro_team_members et rend le compte lui-même. Pour un co-gérant invité,
// la route lisait alors l'équipe d'une « société » à son nom : 200 et une équipe vide, que l'écran Comptes utilisateurs
// garde 30 s, sans message d'erreur. Désormais la ligne est relue : encore illisible → 500 ; retrouvée → l'équipe de la
// société. Un co-gérant désactivé garde sa réponse d'avant (200, équipe vide), choix du 25/11/2026.
// Comptes et identifiants fictifs.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { FauxBase } from '../helpers/faux-supabase-btp'

const h = vi.hoisted(() => ({
  base: null as unknown as FauxBase,
  user: null as null | { id: string; email?: string; app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> },
}))

vi.mock('@/lib/auth-helpers', async (io) => (await import('../helpers/mocks-routes-api')).authHelpersReels(io, () => h.user))
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/mocks-routes-api')).rateLimitPermissif())
vi.mock('@/lib/logger', async () => (await import('../helpers/mocks-routes-api')).loggerSilencieux())
// L'équipe envoie des e-mails d'invitation et rapporte ses erreurs : ni l'un ni l'autre ne part d'un banc.
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn(), templateProTeamInvite: vi.fn() }))
vi.mock('@/lib/supabase-server', async () => {
  const { fauxSupabase } = await import('../helpers/faux-supabase-btp')
  return { supabaseAdmin: { from: (t: string) => fauxSupabase(h.base).from(t) } }
})

const { nouvelleBase, requetes } = await import('../helpers/faux-supabase-btp')
const { GET } = await import('@/app/api/pro/team/route')

const SOCIETE = '550e8400-e29b-41d4-a716-446655440000'
const TABLE = 'pro_team_members'
const PANNE = { code: '57014', message: 'canceling statement due to statement timeout' }
let compteur = 0

/**
 * Co-gérant invité sous un compte neuf (resolveCompanyId garde 60 s une société lue), et l'équipe de la société :
 * le titulaire et lui. Rend l'identifiant de sa ligne d'équipe.
 */
function coGerant(actif = true): string {
  const id = `88888888-0000-4000-8000-${String((compteur += 1)).padStart(12, '0')}`
  h.user = {
    id, email: 'cogerant@exemple.test', user_metadata: {},
    app_metadata: { role: 'pro_societe', pro_team_role: 'GERANT', company_id: SOCIETE },
  }
  h.base.lignes[TABLE] = [
    { id: 'ligne-titulaire', company_id: SOCIETE, user_id: SOCIETE, email: 'titulaire@exemple.test', role: 'GERANT', is_active: true },
    { id: `ligne-${id}`, company_id: SOCIETE, user_id: id, email: 'cogerant@exemple.test', role: 'GERANT', is_active: actif },
  ]
  return `ligne-${id}`
}

const lire = async () => {
  const res = await GET(new NextRequest('https://vitfix.io/api/pro/team', { headers: { Authorization: 'Bearer tok' } }))
  return { status: res.status, json: await res.json() as Record<string, unknown> }
}
const lignesRendues = (json: Record<string, unknown>) => (json.members as { id: string }[]).map(m => m.id).sort()

beforeEach(() => { h.base = nouvelleBase() })

describe('GET /api/pro/team — ligne d’équipe du compte illisible', () => {
  it('lecture de sa ligne en panne : 500, jamais une équipe vide donnée pour vraie', async () => {
    coGerant()
    // Seules les lectures de SA ligne (filtrées par user_id) échouent ; la liste de l'équipe, elle, se lirait.
    h.base.erreurs.push({ table: TABLE, operation: 'select', erreur: PANNE, siFiltre: 'user_id' })

    const { status, json } = await lire()

    expect(status).toBe(500)
    expect(json).not.toHaveProperty('members')
  })

  it('la lecture de sa ligne lève une exception : 500 aussi (la route n’a pas d’autre filet)', async () => {
    coGerant()
    h.base.erreurs.push({ table: TABLE, operation: 'select', erreur: PANNE, siFiltre: 'user_id', lever: true })

    const { status, json } = await lire()

    expect(status).toBe(500)
    expect(json).not.toHaveProperty('members')
  })

  it('panne passagère : la relecture retrouve la société, son équipe s’affiche', async () => {
    const saLigne = coGerant()
    h.base.erreurs.push({ table: TABLE, operation: 'select', erreur: PANNE, fois: 1 })

    const { status, json } = await lire()

    expect(status).toBe(200)
    expect(lignesRendues(json)).toEqual([saLigne, 'ligne-titulaire'].sort())
  })

  it('co-gérant désactivé : la réponse d’avant (200, équipe vide), rien d’écrit', async () => {
    coGerant(false)

    const { status, json } = await lire()

    expect(status).toBe(200)
    expect(json).toEqual({ members: [] })
    expect(requetes(h.base, TABLE, 'insert')).toHaveLength(0)
  })

  it('co-gérant relié, sans panne : l’équipe de la société, une seule lecture de sa ligne', async () => {
    const saLigne = coGerant()

    const { status, json } = await lire()

    expect(status).toBe(200)
    expect(lignesRendues(json)).toEqual([saLigne, 'ligne-titulaire'].sort())
    expect(requetes(h.base, TABLE, 'select').filter(r => 'user_id' in r.filtres)).toHaveLength(1)
  })

  it('super_admin portant la société d’un autre compte : sa propre équipe, comme avant, sans relecture', async () => {
    const id = '77777777-0000-4000-8000-000000000001'
    h.user = { id, email: 'admin@exemple.test', app_metadata: { role: 'super_admin', pro_team_role: 'GERANT', company_id: SOCIETE }, user_metadata: {} }
    h.base.lignes[TABLE] = [
      { id: 'ligne-titulaire', company_id: SOCIETE, user_id: SOCIETE, email: 'titulaire@exemple.test', role: 'GERANT', is_active: true },
      { id: 'ligne-admin', company_id: SOCIETE, user_id: id, email: 'admin@exemple.test', role: 'GERANT', is_active: true },
    ]

    const { status, json } = await lire()

    expect(status).toBe(200)
    expect(json).toEqual({ members: [] })
    expect(requetes(h.base, TABLE, 'select').filter(r => 'user_id' in r.filtres)).toHaveLength(0)
  })

  it('gérant titulaire : sa ligne n’est jamais relue, une panne de cette lecture ne le touche pas', async () => {
    h.user = { id: SOCIETE, email: 'titulaire@exemple.test', app_metadata: { role: 'pro_societe' }, user_metadata: {} }
    h.base.lignes[TABLE] = [{ id: 'ligne-titulaire', company_id: SOCIETE, user_id: SOCIETE, email: 'titulaire@exemple.test', role: 'GERANT', is_active: true }]
    h.base.erreurs.push({ table: TABLE, operation: 'select', erreur: PANNE, siFiltre: 'user_id' })

    const { status, json } = await lire()

    expect(status).toBe(200)
    expect(lignesRendues(json)).toEqual(['ligne-titulaire'])
  })
})
