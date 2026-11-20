// @vitest-environment node
// tests/api/syndic-equipe-roles.test.ts
//
// Rôles et unicité de l'équipe syndic côté routes : POST et PATCH /api/syndic/team et POST /api/admin/init-team-table
// acceptent exactement les rôles de la liste unique (lib/syndic/equipe-contraintes.ts), la même que la contrainte de la
// base (migration 20261115) ; une seconde invitation simultanée de la même adresse (23505 sur l'unicité
// (cabinet_id, email)) répond 409 avec le message de la vérification préalable ; init-team-table n'ajoute qu'une adresse
// nouvelle du cabinet (ON CONFLICT DO NOTHING sur cette unicité) et ne réécrit jamais une ligne existante.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { nouvelleBase, clientMemoire, appelsDe, type BaseMemoire } from './syndic-supabase-memoire'
import { ROLES_EQUIPE_SYNDIC, UNICITE_EMAIL_PAR_CABINET } from '@/lib/syndic/equipe-contraintes'

const CABINET_ID = '0b9a8c7d-6e5f-4a3b-9c2d-1e0f9a8b7c6d'
const MEMBRE_ID = '6f1c2b8e-3a4d-4e5f-8a9b-0c1d2e3f4a5b'
const COMPTE_MEMBRE_ID = '7a2d3c9f-4b5e-4f60-9b1c-2d3e4f5a6b7c'

const h = vi.hoisted(() => ({
  base: null as unknown as BaseMemoire,
  role: 'syndic',
  superAdmin: true,
  upserts: [] as Array<{ table: string; donnees: unknown; options: unknown }>,
  /** ON CONFLICT DO NOTHING a écarté la ligne (adresse déjà dans le cabinet) : PostgREST ne renvoie aucune ligne. */
  upsertDoublon: false,
  emails: 0,
  journal: [] as unknown[][],
}))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => true),
  getClientIP: vi.fn(() => '127.0.0.1'),
  rateLimitResponse: vi.fn(() => Response.json({ error: 'rate' }, { status: 429 })),
}))
vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn(async () => { h.emails++; return { success: true } }),
  templateTeamInvite: vi.fn(() => ({ subject: 'Invitation', html: '<p>Invitation</p>' })),
}))
vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn((...a: unknown[]) => { h.journal.push(a) }),
    warn: vi.fn(), info: vi.fn(), debug: vi.fn(),
  },
}))
vi.mock('@/lib/auth-helpers', () => ({
  getAuthUser: vi.fn(async () => ({
    id: CABINET_ID,
    email: 'titulaire@cabinet.test',
    app_metadata: { role: h.role },
    user_metadata: { cabinet_name: 'Cabinet Test' },
  })),
  getUserRole: vi.fn(() => h.role),
  isSyndicRole: vi.fn(() => true),
  isSuperAdmin: vi.fn(() => h.superAdmin),
  resolveCabinetId: vi.fn(async () => CABINET_ID),
}))
vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: {
    from: (table: string) => {
      const q = clientMemoire(h.base).from(table) as unknown as Record<string, unknown>
      // Upsert de PostgREST : journalisé avec ses options ; rend la ligne envoyée, ou aucune si ON CONFLICT DO NOTHING
      // l'a écartée.
      q.upsert = vi.fn((donnees: unknown, options: unknown) => {
        h.upserts.push({ table, donnees, options })
        const resultat = { data: h.upsertDoublon ? [] : [donnees], error: null }
        const suite: Record<string, unknown> = {}
        suite.select = vi.fn(() => suite)
        suite.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(resultat).then(ok, ko)
        return suite
      })
      return q
    },
    // Compte du membre tel que l'acceptation d'une invitation l'a posé (rôle syndic_*, cabinet du titulaire) : PATCH le
    // vérifie avant d'écrire depuis la branche R36 (fix/syndic-equipe-patch-compte-vise), et l'ignorait avant.
    auth: {
      admin: {
        getUserById: vi.fn(async () => ({
          data: { user: { id: COMPTE_MEMBRE_ID, app_metadata: { role: 'syndic_tech', cabinet_id: CABINET_ID } } },
          error: null,
        })),
        updateUserById: vi.fn(async () => ({ data: {}, error: null })),
      },
    },
  },
}))

const equipe = await import('@/app/api/syndic/team/route')
const initEquipe = await import('@/app/api/admin/init-team-table/route')

const requete = (url: string, method: string, body?: unknown) =>
  new NextRequest(url, {
    method,
    headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
const inviter = (memberRole: string) => equipe.POST(requete('https://vitfix.io/api/syndic/team', 'POST', {
  email: 'Claire@Exemple.fr', full_name: 'Claire Martin', memberRole,
}))
const changerRole = (role: unknown) => equipe.PATCH(requete('https://vitfix.io/api/syndic/team', 'PATCH', { member_id: MEMBRE_ID, role }))
const initialiser = (corps: Record<string, unknown>) => initEquipe.POST(requete('https://vitfix.io/api/admin/init-team-table', 'POST', {
  cabinet_id: CABINET_ID, email: 'Paul.Durand@Exemple.fr', full_name: 'Paul Durand', ...corps,
}))

const ROLES_REFUSES = ['syndic', 'super_admin', 'admin', 'syndic_gestor_condominio', 'SYNDIC_TECH', 'syndic_tech ']
const DOUBLON = {
  code: '23505',
  message: `duplicate key value violates unique constraint "${UNICITE_EMAIL_PAR_CABINET}"`,
  details: 'Key (cabinet_id, email)=(…) already exists.',
}

let cleAvant: string | undefined
beforeEach(() => {
  cleAvant = process.env.SUPABASE_SERVICE_ROLE_KEY
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'cle-de-service-de-test'
  h.base = nouvelleBase()
  h.role = 'syndic'
  h.superAdmin = true
  h.upserts = []
  h.upsertDoublon = false
  h.emails = 0
  h.journal = []
})
afterEach(() => {
  if (cleAvant === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
  else process.env.SUPABASE_SERVICE_ROLE_KEY = cleAvant
})

describe('POST /api/syndic/team : rôles de la liste unique', () => {
  it.each([...ROLES_EQUIPE_SYNDIC])('« %s » : invitation créée avec ce rôle, e-mail envoyé', async (role) => {
    const res = await inviter(role)
    expect(res.status).toBe(200)
    const insere = appelsDe(h.base, 'syndic_team_members', 'insert')[0].donnees as Record<string, unknown>
    expect(insere.role).toBe(role)
    expect(insere.email).toBe('claire@exemple.fr')
    expect(h.emails).toBe(1)
  })

  it.each(ROLES_REFUSES)('« %s » : 400 « Rôle invalide », rien n’est écrit', async (role) => {
    const res = await inviter(role)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Rôle invalide')
    expect(appelsDe(h.base, 'syndic_team_members', 'insert')).toHaveLength(0)
  })
})

describe('POST /api/syndic/team : unicité (cabinet_id, email)', () => {
  it('seconde invitation simultanée de la même adresse (23505 sur l’unicité) : 409, message de la vérification préalable, aucun e-mail', async () => {
    h.base.erreurs['syndic_team_members.insert'] = DOUBLON
    const res = await inviter('syndic_tech')
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('Cet email est déjà membre de votre équipe')
    expect(h.emails).toBe(0)
    // L'erreur de la base (qui contient l'adresse) n'est pas journalisée : un doublon n'est pas une panne.
    expect(h.journal).toHaveLength(0)
  })

  it('adresse déjà présente avant l’insertion : 409 comme avant, sans tenter d’écrire', async () => {
    h.base.lignes.syndic_team_members = [{ id: MEMBRE_ID, cabinet_id: CABINET_ID, email: 'claire@exemple.fr' }]
    const res = await inviter('syndic_tech')
    expect(res.status).toBe(409)
    expect(appelsDe(h.base, 'syndic_team_members', 'insert')).toHaveLength(0)
  })

  it.each([
    ['autre unicité (jeton d’invitation)', { code: '23505', message: 'duplicate key value violates unique constraint "syndic_team_members_invite_token_key"' }],
    ['rôle refusé par une base non migrée (23514)', { code: '23514', message: 'new row for relation "syndic_team_members" violates check constraint "syndic_team_members_role_check"' }],
    ['autre erreur', { code: 'XX000', message: 'erreur interne' }],
  ])('%s : 500 inchangé, erreur journalisée', async (_cas, erreur) => {
    h.base.erreurs['syndic_team_members.insert'] = erreur
    const res = await inviter('syndic_technicien')
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('Erreur lors de la création du membre')
    expect(h.journal).toHaveLength(1)
  })
})

describe('PATCH /api/syndic/team : changement de rôle', () => {
  beforeEach(() => {
    // Membre accepté, compte rattaché au cabinet : le cas légitime, avant comme après R36 (une invitation en attente y
    // répond 409, un compte d'un autre cabinet 403).
    h.base.lignes.syndic_team_members = [{
      id: MEMBRE_ID, cabinet_id: CABINET_ID, user_id: COMPTE_MEMBRE_ID, email: 'membre@exemple.fr',
      role: 'syndic_tech', accepted_at: '2026-11-01T10:00:00.000Z', is_active: true,
    }]
  })

  it.each([...ROLES_EQUIPE_SYNDIC])('« %s » : accepté et écrit', async (role) => {
    const res = await changerRole(role)
    expect(res.status).toBe(200)
    expect(appelsDe(h.base, 'syndic_team_members', 'update')[0].donnees).toEqual({ role })
  })

  it.each([...ROLES_REFUSES, 42, null])('« %s » : 400 « Rôle invalide », rien n’est écrit', async (role) => {
    const res = await changerRole(role)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Rôle invalide')
    expect(appelsDe(h.base, 'syndic_team_members', 'update')).toHaveLength(0)
  })
})

describe('POST /api/admin/init-team-table', () => {
  it('insertion seule sur l’unicité (cabinet_id, email) (DO NOTHING), adresse en minuscules, rôle par défaut syndic_tech', async () => {
    const res = await initialiser({})
    expect(res.status).toBe(200)
    expect(h.upserts).toHaveLength(1)
    expect(h.upserts[0].options).toEqual({ onConflict: 'cabinet_id,email', ignoreDuplicates: true })
    expect(h.upserts[0].donnees).toMatchObject({
      cabinet_id: CABINET_ID, email: 'paul.durand@exemple.fr', role: 'syndic_tech', is_active: true,
    })
  })

  it('adresse déjà dans l’équipe : 409, la ligne existante n’est pas réécrite (aucune ligne rendue par DO NOTHING)', async () => {
    h.upsertDoublon = true
    const res = await initialiser({ role: 'syndic_comptable' })
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('Cet email est déjà membre de cette équipe')
    expect(h.journal).toHaveLength(0)
  })

  it.each([...ROLES_EQUIPE_SYNDIC])('rôle « %s » : accepté', async (role) => {
    const res = await initialiser({ role })
    expect(res.status).toBe(200)
    expect((h.upserts[0].donnees as Record<string, unknown>).role).toBe(role)
  })

  it.each(ROLES_REFUSES)('rôle « %s » : 400 « Rôle invalide », rien n’est écrit', async (role) => {
    const res = await initialiser({ role })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Rôle invalide')
    expect(h.upserts).toHaveLength(0)
  })

  it('hors super admin : 403, rien n’est écrit', async () => {
    h.superAdmin = false
    const res = await initialiser({ role: 'syndic_tech' })
    expect(res.status).toBe(403)
    expect(h.upserts).toHaveLength(0)
  })
})
