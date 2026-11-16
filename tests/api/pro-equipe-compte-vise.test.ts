// @vitest-environment node
// tests/api/pro-equipe-compte-vise.test.ts
//
// R36 (dossier M0 Téléphonie IA ; décision VF-A-02 de Frédéric, 15/11/2026), côté BTP. PATCH /api/pro/team écrivait
// company_id (et pro_team_role pour un changement de rôle) dans l'app_metadata de tout compte désigné par une ligne
// d'équipe de la société appelante, y compris pour un simple changement de statut. Or cette ligne a pu être posée hors
// de l'application, pour le compte d'un autre (policies d'écriture de pro_team_members, retirées par la migration
// 20261115_pro_equipe_ecritures_serveur.sql) : le gérant d'une autre société perdait ses droits de gérant
// (pro_team_role posé), et son compte était rattaché à la société appelante.
// Désormais : AVANT toute écriture, le compte visé doit être un sous-compte de CETTE société d'après son app_metadata
// (posé par le serveur seul, à l'acceptation d'une invitation) ; seul pro_team_role est écrit, jamais company_id ; le
// statut n'écrit plus app_metadata. Comptes et identifiants fictifs. Cas communs : tests/helpers/patch-equipe.ts.

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
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn(), templateProTeamInvite: vi.fn() }))
vi.mock('@/lib/auth-helpers', () => ({
  getAuthUser: vi.fn(async () => ({ id: SOCIETE, email: 'gerant@societe.test', app_metadata: { role: 'pro_societe' }, user_metadata: {} })),
  isProSocieteRole: vi.fn(() => true),
  isProGerant: vi.fn(() => true),
  resolveCompanyId: vi.fn(async () => SOCIETE),
}))
vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: { from: (table: string) => clientMemoire(h.base).from(table), auth: { admin: h.admin } },
}))

const SOCIETE = '0b9a8c7d-6e5f-4a3b-9c2d-1e0f9a8b7c6d'
const AUTRE_SOCIETE = '99999999-8888-4777-8666-555555555555'
const COMPTE_VISE = '5d6e7f80-1a2b-4c3d-8e9f-0a1b2c3d4e5f'
const LIGNE = '6f1c2b8e-3a4d-4e5f-8a9b-0c1d2e3f4a5b'
const TABLE = 'pro_team_members'
const MEMBRE = { role: 'pro_societe', pro_team_role: 'OUVRIER', company_id: SOCIETE, provider: 'email' }

const { PATCH } = await import('@/app/api/pro/team/route')

/** Ligne d'équipe de la société appelante qui désigne COMPTE_VISE (posée par une route ou hors de l'application). */
const ligne = (modif: Record<string, unknown> = {}) => ({
  id: LIGNE, company_id: SOCIETE, user_id: COMPTE_VISE, email: 'vise@exemple.test', full_name: 'Compte Visé',
  role: 'OUVRIER', invite_token: null, accepted_at: '2026-11-01T10:00:00.000Z', is_active: true, ...modif,
})
const compteVise = (appMetadata: Record<string, unknown>) => h.admin.getUserById.mockResolvedValue(compteExistant(COMPTE_VISE, appMetadata))
const modifier = (corps: Record<string, unknown>) => PATCH(requetePatch('https://vitfix.io/api/pro/team', corps))
const misesAJour = () => appelsDe(h.base, TABLE, 'update')
const journal = () => appelsDe(h.base, 'pro_team_audit_log', 'insert').map((a) => a.donnees)

/** Comptes qu'une ligne posée hors de l'application pourrait désigner : aucun n'est un sous-compte de SOCIETE. */
const COMPTES_HORS_SOCIETE: Array<[string, Record<string, unknown>]> = [
  ['gérant d’une autre société', { role: 'pro_societe' }],
  ['gérant d’une autre société (GERANT)', { role: 'pro_societe', pro_team_role: 'GERANT' }],
  ['gérant marqué de cette société', { role: 'pro_societe', pro_team_role: 'GERANT', company_id: SOCIETE }],
  ['sous-compte d’une autre société', { role: 'pro_societe', pro_team_role: 'CHEF_CHANTIER', company_id: AUTRE_SOCIETE }],
  ['sous-compte sans société', { role: 'pro_societe', pro_team_role: 'OUVRIER' }],
  ['artisan', { role: 'artisan' }],
  ['client', { role: 'client' }],
  ['cabinet syndic', { role: 'syndic' }],
  ['super_admin', { role: 'super_admin' }],
  ['compte sans rôle', {}],
]

beforeEach(() => {
  vi.mocked(logger.error).mockClear()
  h.base = nouvelleBase()
  h.base.lignes[TABLE] = [ligne()]
  h.admin.getUserById.mockReset().mockResolvedValue(compteExistant(COMPTE_VISE, {}))
  h.admin.updateUserById.mockReset().mockResolvedValue({ data: {}, error: null })
})

describe('PATCH /api/pro/team — compte visé hors de cette société (R36)', () => {
  it.each(COMPTES_HORS_SOCIETE)('%s, changement de rôle : 403, rien n’est écrit (compte, ligne, journal)', async (_cas, appMetadata) => {
    compteVise(appMetadata)
    const res = await modifier({ member_id: LIGNE, role: 'SECRETAIRE' })
    // Avant la correction : updateUserById(COMPTE_VISE, { app_metadata: { …, company_id: SOCIETE, pro_team_role: 'SECRETAIRE' } }).
    expect(h.admin.updateUserById).not.toHaveBeenCalled()
    expect(misesAJour()).toHaveLength(0)
    expect(journal()).toEqual([])
    expect(res.status).toBe(403)
    expect((await res.json()).error).toMatch(/pas rattaché à votre société/)
  })

  it.each(COMPTES_HORS_SOCIETE)('%s, changement de statut : la ligne change, le compte n’est ni lu ni écrit', async (_cas, appMetadata) => {
    compteVise(appMetadata)
    const res = await modifier({ member_id: LIGNE, is_active: false })
    // Avant la correction : updateUserById(COMPTE_VISE, { app_metadata: { …, company_id: SOCIETE } }).
    expect(h.admin.updateUserById).not.toHaveBeenCalled()
    expect(h.admin.getUserById).not.toHaveBeenCalled()
    expect(res.status).toBe(200)
    expect(misesAJour()[0].donnees).toEqual({ is_active: false })
  })

  it('ligne d’une autre société : 404, aucun compte lu ni écrit', async () => {
    h.base.lignes[TABLE] = [ligne({ company_id: AUTRE_SOCIETE })]
    const res = await modifier({ member_id: LIGNE, role: 'SECRETAIRE' })
    expect(res.status).toBe(404)
    expect(h.admin.getUserById).not.toHaveBeenCalled()
    expect(h.admin.updateUserById).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/pro/team — sous-compte de cette société et gérant (non-régression)', () => {
  it('rôle changé : la ligne et pro_team_role changent ; company_id et les autres clés restent ; journalisé', async () => {
    compteVise(MEMBRE)
    const res = await modifier({ member_id: LIGNE, role: 'CHEF_CHANTIER' })
    expect(res.status).toBe(200)
    expect(misesAJour()).toHaveLength(1)
    expect(misesAJour()[0].donnees).toEqual({ role: 'CHEF_CHANTIER' })
    expect(h.admin.updateUserById).toHaveBeenCalledTimes(1)
    expect(h.admin.updateUserById).toHaveBeenCalledWith(COMPTE_VISE, { app_metadata: { ...MEMBRE, pro_team_role: 'CHEF_CHANTIER' } })
    expect(journal()).toEqual([expect.objectContaining({ action: 'update_role', target_member_id: LIGNE })])
  })

  it('statut changé : la ligne change, app_metadata n’est plus réécrit (company_id déjà le sien) ; journalisé', async () => {
    compteVise(MEMBRE)
    const res = await modifier({ member_id: LIGNE, is_active: false })
    expect(res.status).toBe(200)
    expect(misesAJour()[0].donnees).toEqual({ is_active: false })
    expect(h.admin.updateUserById).not.toHaveBeenCalled()
    expect(journal()).toEqual([expect.objectContaining({ action: 'deactivate', target_member_id: LIGNE })])
  })

  it('écriture de app_metadata en échec : 500, mais la ligne a changé et le journal de l’équipe le garde', async () => {
    compteVise(MEMBRE)
    h.admin.updateUserById.mockResolvedValue({ data: null, error: { message: 'timeout' } })
    expect((await modifier({ member_id: LIGNE, role: 'SECRETAIRE' })).status).toBe(500)
    expect(journal()).toEqual([expect.objectContaining({ action: 'update_role', target_member_id: LIGNE })])
  })

  it.each([
    ['rôle du gérant changé : 403', 'OUVRIER', 403],
    ['sa propre ligne laissée en GERANT : acceptée', 'GERANT', 200],
  ])('gérant, %s ; son compte n’est ni lu ni écrit', async (_cas, role, statut) => {
    h.base.lignes[TABLE] = [ligne({ role: 'GERANT', user_id: SOCIETE })]
    const res = await modifier({ member_id: LIGNE, role })
    expect(res.status).toBe(statut)
    expect(h.admin.getUserById).not.toHaveBeenCalled()
    expect(h.admin.updateUserById).not.toHaveBeenCalled()
  })
})

describe('PATCH /api/pro/team — cas communs (compte supprimé ou illisible, écriture en échec, ligne sans compte)', () => {
  const route = { modifier, admin: h.admin, misesAJour, poserLigne: (modif: Record<string, unknown>) => { h.base.lignes[TABLE] = [ligne(modif)] } }
  casCommunsDuPatch(route, { idLigne: LIGNE, idCompte: COMPTE_VISE, membre: MEMBRE, roleValide: 'SECRETAIRE', roleInconnu: 'super_admin' },
    { message: '[PRO_TEAM] Failed to update app_metadata:', loggerError: vi.mocked(logger.error) })
})
