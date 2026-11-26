// @vitest-environment node
// tests/api/pro-auto-init-gerant.test.ts
//
// POST /api/pro/team/auto-init-gerant (appelé à l'inscription d'une société BTP) : crée la ligne GERANT du compte
// titulaire, « company_id = lui-même ». Un compte rattaché à la société d'un autre (co-gérant ou salarié invité) n'en
// reçoit aucune : elle lui donnerait un second rattachement actif (PGRST116, 409 partout). Comptes fictifs.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { appelsDe, clientMemoire, nouvelleBase, type BaseMemoire } from './syndic-supabase-memoire'

const h = vi.hoisted(() => ({ base: null as unknown as BaseMemoire, compte: null as unknown }))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/mocks-routes-api')).rateLimitPermissif())
vi.mock('@/lib/logger', async () => (await import('../helpers/mocks-routes-api')).loggerSilencieux())
vi.mock('@/lib/auth-helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-helpers')>()),
  getAuthUser: vi.fn(async () => h.compte),
}))
vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin: { from: (table: string) => clientMemoire(h.base).from(table) } }))

const { POST } = await import('@/app/api/pro/team/auto-init-gerant/route')

const COMPTE = 'a1a1a1a1-1111-4222-8333-444444444444'
const SOCIETE = 'b2b2b2b2-1111-4222-8333-444444444444'
const initialiser = () => POST(new NextRequest('https://vitfix.io/api/pro/team/auto-init-gerant', {
  method: 'POST',
  headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
  body: JSON.stringify({ user_id: COMPTE, email: 'compte@exemple.test', full_name: 'Compte Exemple' }),
}))

beforeEach(() => { h.base = nouvelleBase() })

describe('POST /api/pro/team/auto-init-gerant', () => {
  it('titulaire : sa ligne GERANT est créée, au nom de sa propre société', async () => {
    h.compte = { id: COMPTE, email: 'compte@exemple.test', app_metadata: { role: 'pro_societe' } }
    expect((await initialiser()).status).toBe(200)
    expect(appelsDe(h.base, 'pro_team_members', 'insert')[0].donnees).toMatchObject({ company_id: COMPTE, user_id: COMPTE, role: 'GERANT' })
  })

  it.each([
    ['co-gérant', 'GERANT'],
    ['salarié invité', 'OUVRIER'],
  ])('%s d’une autre société : aucune ligne créée', async (_cas, roleEquipe) => {
    h.compte = { id: COMPTE, email: 'compte@exemple.test', app_metadata: { role: 'pro_societe', pro_team_role: roleEquipe, company_id: SOCIETE } }
    const res = await initialiser()
    expect(res.status).toBe(200)
    expect((await res.json()).skipped).toBe('membre_d_une_autre_societe')
    expect(appelsDe(h.base, 'pro_team_members', 'insert')).toHaveLength(0)
  })
})
