// @vitest-environment node
// tests/api/syndic-equipe-compte-vise.test.ts
//
// R36 (dossier M0 Téléphonie IA ; décision VF-A-02 de Frédéric, 15/11/2026). PATCH /api/syndic/team réécrivait le
// rôle ET le cabinet (app_metadata) de tout compte désigné par une ligne d'équipe du cabinet appelant. Or cette ligne
// a pu être posée hors de l'application, pour le compte d'un autre (policies d'écriture de syndic_team_members, que
// T20 ferme) : le compte visé perdait l'accès à son propre espace et se retrouvait rattaché au cabinet de l'appelant.
// Désormais, AVANT toute écriture, le compte visé doit être membre de CE cabinet d'après son app_metadata (posé par
// le serveur seul, à l'acceptation d'une invitation) ; le PATCH n'écrit plus jamais cabinet_id.
// Comptes et identifiants fictifs. Cas communs : tests/helpers/patch-equipe.ts.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nouvelleBase, clientMemoire, appelsDe, type BaseMemoire } from './syndic-supabase-memoire'
import { casCommunsDuPatch, compteExistant, requetePatch } from '../helpers/patch-equipe'
import { logger } from '@/lib/logger'

const h = vi.hoisted(() => ({
  base: null as unknown as BaseMemoire,
  admin: { getUserById: vi.fn(), updateUserById: vi.fn() },
}))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/mocks-routes-api')).rateLimitPermissif())
vi.mock('@/lib/logger', async () => (await import('../helpers/mocks-routes-api')).loggerSilencieux())
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn(), templateTeamInvite: vi.fn() }))
vi.mock('@/lib/auth-helpers', () => ({
  getAuthUser: vi.fn(async () => ({ id: CABINET, email: 'titulaire@cabinet.test', app_metadata: { role: 'syndic' }, user_metadata: {} })),
  getUserRole: vi.fn(() => 'syndic'),
  isSyndicRole: vi.fn(() => true),
  resolveCabinetId: vi.fn(async () => CABINET),
}))
vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: { from: (table: string) => clientMemoire(h.base).from(table), auth: { admin: h.admin } },
}))

const CABINET = '0b9a8c7d-6e5f-4a3b-9c2d-1e0f9a8b7c6d'
const AUTRE_CABINET = '99999999-8888-4777-8666-555555555555'
const COMPTE_VISE = '5d6e7f80-1a2b-4c3d-8e9f-0a1b2c3d4e5f'
const LIGNE = '6f1c2b8e-3a4d-4e5f-8a9b-0c1d2e3f4a5b'
const TABLE = 'syndic_team_members'
const MEMBRE = { role: 'syndic_gestionnaire', cabinet_id: CABINET, provider: 'email' }

const { PATCH } = await import('@/app/api/syndic/team/route')

/** Ligne d'équipe du cabinet appelant qui désigne COMPTE_VISE (posée par une route ou hors de l'application). */
const ligne = (modif: Record<string, unknown> = {}) => ({
  id: LIGNE, cabinet_id: CABINET, user_id: COMPTE_VISE, email: 'vise@exemple.test', full_name: 'Compte Visé',
  role: 'syndic_gestionnaire', invite_token: null, accepted_at: '2026-11-01T10:00:00.000Z', is_active: true, ...modif,
})
const compteVise = (appMetadata: Record<string, unknown>) => h.admin.getUserById.mockResolvedValue(compteExistant(COMPTE_VISE, appMetadata))
const modifier = (corps: Record<string, unknown>) => PATCH(requetePatch('https://vitfix.io/api/syndic/team', corps))
const misesAJour = () => appelsDe(h.base, TABLE, 'update')

beforeEach(() => {
  vi.mocked(logger.error).mockClear()
  h.base = nouvelleBase()
  h.base.lignes[TABLE] = [ligne()]
  h.admin.getUserById.mockReset().mockResolvedValue(compteExistant(COMPTE_VISE, {}))
  h.admin.updateUserById.mockReset().mockResolvedValue({ data: {}, error: null })
})

describe('PATCH /api/syndic/team — compte visé hors de ce cabinet (R36)', () => {
  it.each([
    ['artisan', { role: 'artisan' }],
    ['client', { role: 'client' }],
    ['gérant de société BTP', { role: 'pro_societe' }],
    ['titulaire d’un cabinet syndic', { role: 'syndic' }],
    ['super_admin', { role: 'super_admin' }],
    ['membre d’un autre cabinet', { role: 'syndic_tech', cabinet_id: AUTRE_CABINET }],
    ['rôle syndic_* sans cabinet', { role: 'syndic_comptable' }],
    ['compte sans rôle', {}],
  ])('%s : 403, ni son rôle ni son cabinet ne changent, la ligne non plus', async (_cas, appMetadata) => {
    compteVise(appMetadata)
    const res = await modifier({ member_id: LIGNE, role: 'syndic_admin' })
    // Avant la correction : updateUserById(COMPTE_VISE, { app_metadata: { …, role: 'syndic_admin', cabinet_id: CABINET } }).
    expect(h.admin.updateUserById).not.toHaveBeenCalled()
    expect(misesAJour()).toHaveLength(0)
    expect(res.status).toBe(403)
    expect((await res.json()).error).toMatch(/pas rattaché à votre cabinet/)
  })

  it('ligne d’un autre cabinet : 404, aucun compte lu ni écrit', async () => {
    h.base.lignes[TABLE] = [ligne({ cabinet_id: AUTRE_CABINET })]
    const res = await modifier({ member_id: LIGNE, role: 'syndic_comptable' })
    expect(res.status).toBe(404)
    expect(h.admin.getUserById).not.toHaveBeenCalled()
    expect(h.admin.updateUserById).not.toHaveBeenCalled()
  })

  it('invitation en cours (jeton encore en base) : 409, rien n’est lu ni écrit (son rôle est signé dans le lien)', async () => {
    h.base.lignes[TABLE] = [ligne({ user_id: null, accepted_at: null, invite_token: 'a1'.repeat(24) })]
    const res = await modifier({ member_id: LIGNE, role: 'syndic_comptable' })
    expect(res.status).toBe(409)
    expect(misesAJour()).toHaveLength(0)
    expect(h.admin.getUserById).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/syndic/team — membre de ce cabinet (non-régression)', () => {
  it('rôle changé : la ligne et app_metadata reçoivent le rôle ; cabinet_id et les autres clés restent', async () => {
    compteVise(MEMBRE)
    const res = await modifier({ member_id: LIGNE, role: 'syndic_comptable' })
    expect(res.status).toBe(200)
    expect(misesAJour()).toHaveLength(1)
    expect(misesAJour()[0].donnees).toEqual({ role: 'syndic_comptable' })
    expect(misesAJour()[0].eq).toContainEqual(['id', LIGNE])
    expect(h.admin.updateUserById).toHaveBeenCalledTimes(1)
    expect(h.admin.updateUserById).toHaveBeenCalledWith(COMPTE_VISE, { app_metadata: { ...MEMBRE, role: 'syndic_comptable' } })
  })

  it.each([
    ['statut', { is_active: false }, { is_active: false }],
    ['modules', { customModules: ['missions'] }, { custom_modules: ['missions'] }],
  ])('%s seul : la ligne change, aucun compte n’est lu ni écrit', async (_cas, corps, attendu) => {
    const res = await modifier({ member_id: LIGNE, ...corps })
    expect(res.status).toBe(200)
    expect(misesAJour()[0].donnees).toEqual(attendu)
    expect(h.admin.getUserById).not.toHaveBeenCalled()
    expect(h.admin.updateUserById).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/syndic/team — cas communs (compte supprimé ou illisible, écriture en échec, ligne sans compte)', () => {
  const route = { modifier, admin: h.admin, misesAJour, poserLigne: (modif: Record<string, unknown>) => { h.base.lignes[TABLE] = [ligne(modif)] } }
  casCommunsDuPatch(route, { idLigne: LIGNE, idCompte: COMPTE_VISE, membre: MEMBRE, roleValide: 'syndic_comptable', roleInconnu: 'super_admin' },
    { message: '[TEAM] Failed to update app_metadata:', loggerError: vi.mocked(logger.error) })
})
