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
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => ({
  base: null as unknown as BaseMemoire,
  admin: { getUserById: vi.fn(), updateUserById: vi.fn() },
  /** Compte appelant ; null = le gérant titulaire (son identifiant EST la société). */
  appelant: null as null | Record<string, unknown>,
}))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/mocks-routes-api')).rateLimitPermissif())
vi.mock('@/lib/logger', async () => (await import('../helpers/mocks-routes-api')).loggerSilencieux())
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn(), templateProTeamInvite: vi.fn() }))
// Rôles réels (isProGerant, societeDunAutreCompte, estTitulaireSociete) : seules la session et la résolution de la
// société sont simulées.
vi.mock('@/lib/auth-helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-helpers')>()),
  getAuthUser: vi.fn(async () => h.appelant ?? { id: SOCIETE, email: 'gerant@societe.test', app_metadata: { role: 'pro_societe' }, user_metadata: {} }),
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

const { PATCH, GET, DELETE } = await import('@/app/api/pro/team/route')
const { resolveCompanyId } = await import('@/lib/auth-helpers')

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
  h.appelant = null
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

describe('PATCH /api/pro/team — droits par membre et catégorie professionnelle (25/11/2026)', () => {
  const DEROGATIONS = [{ module_id: 'devis', access_level: 'READ' }, { module_id: 'pointage', access_level: 'FULL' }]
  const derogations = (op: 'insert' | 'delete') => appelsDe(h.base, 'pro_role_permissions', op)

  it('droits seuls (« Enregistrer les permissions ») : enregistrés, 200 ; la ligne et le compte ne bougent pas', async () => {
    // Avant : 400 « Aucune modification », rien d'enregistré (les droits n'étaient lus qu'avec un rôle ou un statut).
    const res = await modifier({ member_id: LIGNE, permissions: DEROGATIONS })
    expect(res.status).toBe(200)
    expect(derogations('delete')).toHaveLength(1)
    expect(derogations('delete')[0].eq).toEqual([['member_id', LIGNE]])
    expect(derogations('insert')[0].donnees).toEqual(DEROGATIONS.map((d) => ({ company_id: SOCIETE, member_id: LIGNE, ...d })))
    // Anciennes dérogations retirées AVANT d'écrire les nouvelles.
    expect(h.base.appels.indexOf(derogations('delete')[0])).toBeLessThan(h.base.appels.indexOf(derogations('insert')[0]))
    expect(misesAJour()).toHaveLength(0)
    expect(h.admin.getUserById).not.toHaveBeenCalled()
    expect(h.admin.updateUserById).not.toHaveBeenCalled()
    expect(journal()).toEqual([expect.objectContaining({ action: 'update_permissions', target_member_id: LIGNE, details: { permissions: DEROGATIONS } })])
  })

  it('liste vide (retour aux droits du rôle) : dérogations retirées, rien d’inséré', async () => {
    expect((await modifier({ member_id: LIGNE, permissions: [] })).status).toBe(200)
    expect(derogations('delete')).toHaveLength(1)
    expect(derogations('insert')).toHaveLength(0)
  })

  it('même module envoyé deux fois : seule la dernière valeur est écrite (contrainte unique member_id, module_id)', async () => {
    await modifier({ member_id: LIGNE, permissions: [{ module_id: 'devis', access_level: 'READ' }, { module_id: 'devis', access_level: 'NONE' }] })
    expect(derogations('insert')[0].donnees).toEqual([{ company_id: SOCIETE, member_id: LIGNE, module_id: 'devis', access_level: 'NONE' }])
  })

  it.each([
    ['pas une liste', { module_id: 'devis', access_level: 'READ' }],
    ['niveau inconnu', [{ module_id: 'devis', access_level: 'ALL' }]],
    ['module trop long', [{ module_id: 'x'.repeat(51), access_level: 'READ' }]],
  ])('droits invalides (%s) : 400, rien n’est lu ni écrit', async (_cas, permissions) => {
    const res = await modifier({ member_id: LIGNE, permissions })
    expect(res.status).toBe(400)
    expect(h.base.appels).toHaveLength(0)
  })

  it.each(['insert', 'delete'] as const)('écriture des dérogations refusée par la base (%s) : 500, et non 200', async (op) => {
    h.base.erreurs[`pro_role_permissions.${op}`] = { message: 'refus' }
    expect((await modifier({ member_id: LIGNE, permissions: DEROGATIONS })).status).toBe(500)
    expect(journal()).toEqual([])
  })

  it('catégorie : la ligne seule change, blancs réduits ; le compte n’est ni lu ni écrit ; journalisée', async () => {
    const res = await modifier({ member_id: LIGNE, job_title: '  Encarregado   geral ' })
    expect(res.status).toBe(200)
    expect(misesAJour()[0].donnees).toEqual({ job_title: 'Encarregado geral' })
    expect(h.admin.getUserById).not.toHaveBeenCalled()
    expect(derogations('delete')).toHaveLength(0)
    expect(journal()).toEqual([expect.objectContaining({ action: 'update_member', details: { job_title: 'Encarregado geral' } })])
  })

  it('catégorie vide : retirée (null)', async () => {
    await modifier({ member_id: LIGNE, job_title: '' })
    expect(misesAJour()[0].donnees).toEqual({ job_title: null })
  })

  it.each([['81 caractères', 'a'.repeat(81)], ['nombre', 42]])('catégorie refusée (%s) : 400, rien n’est écrit', async (_cas, job_title) => {
    const res = await modifier({ member_id: LIGNE, job_title })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/Catégorie professionnelle refusée/)
    expect(misesAJour()).toHaveLength(0)
  })

  it('invitation en attente : la catégorie se modifie (le lien signé ne porte que le rôle)', async () => {
    h.base.lignes[TABLE] = [ligne({ user_id: null, accepted_at: null, invite_token: 'empreinte-du-jeton' })]
    expect((await modifier({ member_id: LIGNE, job_title: 'Servente' })).status).toBe(200)
    expect(misesAJour()[0].donnees).toEqual({ job_title: 'Servente' })
  })

  it('catégorie et droits ensemble : les deux sont enregistrés', async () => {
    expect((await modifier({ member_id: LIGNE, job_title: 'Oficial', permissions: DEROGATIONS })).status).toBe(200)
    expect(misesAJour()[0].donnees).toEqual({ job_title: 'Oficial' })
    expect(derogations('insert')).toHaveLength(1)
  })

  it('rien à modifier : 400 « Aucune modification »', async () => {
    const res = await modifier({ member_id: LIGNE })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Aucune modification')
  })
})

describe('GET /api/pro/team — catégorie professionnelle', () => {
  it('la liste de l’équipe rend job_title', async () => {
    h.base.lignes[TABLE] = [ligne({ job_title: 'Chefe de equipa', created_at: '2026-11-25T10:00:00.000Z' })]
    const res = await GET(new NextRequest('https://vitfix.io/api/pro/team', { headers: { Authorization: 'Bearer tok' } }))
    expect(res.status).toBe(200)
    const lecture = appelsDe(h.base, TABLE, 'select').find((a) => a.colonnes?.includes('full_name'))
    expect(lecture?.colonnes?.split(',').map((c) => c.trim())).toContain('job_title')
    expect((await res.json()).members[0].job_title).toBe('Chefe de equipa')
  })
})

describe('Dérogations bornées à la société, et remises si leur remplacement échoue (relecture du 25/11/2026)', () => {
  const derogationsDe = (op: 'select' | 'insert' | 'delete') => appelsDe(h.base, 'pro_role_permissions', op)
  const ANCIENNE = { company_id: SOCIETE, member_id: LIGNE, module_id: 'settings', access_level: 'NONE' }
  const FORGEE = { company_id: COMPTE_VISE, member_id: LIGNE, module_id: 'settings', access_level: 'FULL' }

  it('ligne d’une autre société, droits seuls : 404, aucune dérogation lue, supprimée ni écrite', async () => {
    h.base.lignes[TABLE] = [ligne({ company_id: AUTRE_SOCIETE })]
    const res = await modifier({ member_id: LIGNE, permissions: [{ module_id: 'devis', access_level: 'FULL' }] })
    expect(res.status).toBe(404)
    expect(derogationsDe('select')).toHaveLength(0)
    expect(derogationsDe('delete')).toHaveLength(0)
    expect(derogationsDe('insert')).toHaveLength(0)
  })

  it('insertion refusée par la base : les dérogations d’avant (de cette société) sont remises, 500', async () => {
    h.base.lignes.pro_role_permissions = [ANCIENNE, FORGEE]
    h.base.erreurs['pro_role_permissions.insert'] = { message: 'refus' }
    const res = await modifier({ member_id: LIGNE, permissions: [{ module_id: 'devis', access_level: 'READ' }] })
    expect(res.status).toBe(500)
    expect(derogationsDe('select')[0].eq).toEqual([['member_id', LIGNE], ['company_id', SOCIETE]])
    expect(derogationsDe('insert').map((a) => a.donnees)).toEqual([
      [{ company_id: SOCIETE, member_id: LIGNE, module_id: 'devis', access_level: 'READ' }],
      [{ company_id: SOCIETE, member_id: LIGNE, module_id: 'settings', access_level: 'NONE' }],
    ])
  })

  it('lecture des dérogations d’avant impossible : 500, rien n’est supprimé', async () => {
    h.base.erreurs['pro_role_permissions.select'] = { message: 'panne' }
    expect((await modifier({ member_id: LIGNE, permissions: [] })).status).toBe(500)
    expect(derogationsDe('delete')).toHaveLength(0)
  })

  it('GET de l’équipe : dérogations lues pour cette société seulement', async () => {
    h.base.lignes[TABLE] = [ligne({ created_at: '2026-11-25T10:00:00.000Z' })]
    h.base.lignes.pro_role_permissions = [ANCIENNE, FORGEE]
    const res = await GET(new NextRequest('https://vitfix.io/api/pro/team', { headers: { Authorization: 'Bearer tok' } }))
    expect((await res.json()).members[0].permission_overrides).toEqual([{ module_id: 'settings', access_level: 'NONE' }])
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
  })

  it('GET avant la migration 20261125 (colonne job_title absente) : liste lue sans catégorie, pas d’écran vide', async () => {
    h.base.lignes[TABLE] = [ligne({ created_at: '2026-11-25T10:00:00.000Z' })]
    h.base.colonnesAbsentes = { [TABLE]: ['job_title'] }
    const res = await GET(new NextRequest('https://vitfix.io/api/pro/team', { headers: { Authorization: 'Bearer tok' } }))
    expect(res.status).toBe(200)
    expect((await res.json()).members.map((m: { email: string }) => m.email)).toEqual(['vise@exemple.test'])
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(expect.stringMatching(/colonne job_title absente/))
  })

  it('GET /api/pro/team/permissions?self=true : seulement les dérogations de la société du membre', async () => {
    h.base.lignes[TABLE] = [ligne({ user_id: SOCIETE })]
    h.base.lignes.pro_role_permissions = [ANCIENNE, FORGEE]
    const { GET: lirePropres } = await import('@/app/api/pro/team/permissions/route')
    const res = await lirePropres(new NextRequest('https://vitfix.io/api/pro/team/permissions?self=true', { headers: { Authorization: 'Bearer tok' } }))
    expect((await res.json()).overrides).toEqual([ANCIENNE])
  })
})

describe('Co-gérant : gérant invité dans la société d’un autre compte (25/11/2026)', () => {
  const COGERANT = 'c0c0c0c0-1111-4222-8333-444444444444'
  const AUTRE_COGERANT = 'c1c1c1c1-1111-4222-8333-444444444444'
  const LIGNE_TITULAIRE = '7a7a7a7a-1111-4222-8333-444444444444'
  const LIGNE_COGERANT = '7b7b7b7b-1111-4222-8333-444444444444'
  const coGerant = () => {
    h.appelant = { id: COGERANT, email: 'cogerant@exemple.test', app_metadata: { role: 'pro_societe', pro_team_role: 'GERANT', company_id: SOCIETE }, user_metadata: {} }
  }
  const poserLignes = (...autres: Array<Record<string, unknown>>) => {
    h.base.lignes[TABLE] = [
      ligne(),
      ligne({ id: LIGNE_TITULAIRE, user_id: SOCIETE, role: 'GERANT', email: 'gerant@societe.test' }),
      ligne({ id: LIGNE_COGERANT, user_id: COGERANT, role: 'GERANT', email: 'cogerant@exemple.test' }),
      ...autres,
    ]
  }
  const supprimer = (memberId: string) => DELETE(new NextRequest(`https://vitfix.io/api/pro/team?member_id=${memberId}`, {
    method: 'DELETE', headers: { Authorization: 'Bearer tok' },
  }))
  const suppressions = () => appelsDe(h.base, TABLE, 'delete')
  const rienNEstEcrit = () => {
    expect(misesAJour()).toHaveLength(0)
    expect(suppressions()).toHaveLength(0)
    expect(appelsDe(h.base, 'pro_role_permissions', 'insert')).toHaveLength(0)
    expect(h.admin.updateUserById).not.toHaveBeenCalled()
  }

  beforeEach(() => { poserLignes() })

  it('co-gérant : gère un salarié de la société (droits, statut), écritures dans la société du titulaire', async () => {
    coGerant()
    expect((await modifier({ member_id: LIGNE, is_active: false })).status).toBe(200)
    expect(misesAJour()[0].eq).toEqual([['id', LIGNE]])
    expect((await modifier({ member_id: LIGNE, permissions: [{ module_id: 'devis', access_level: 'READ' }] })).status).toBe(200)
    expect(appelsDe(h.base, 'pro_role_permissions', 'insert')[0].donnees).toEqual([
      { company_id: SOCIETE, member_id: LIGNE, module_id: 'devis', access_level: 'READ' },
    ])
  })

  it.each([
    ['désactiver le titulaire', { member_id: LIGNE_TITULAIRE, is_active: false }],
    ['restreindre le titulaire', { member_id: LIGNE_TITULAIRE, permissions: [{ module_id: 'devis', access_level: 'NONE' }] }],
    ['promouvoir un salarié gérant', { member_id: LIGNE, role: 'GERANT' }],
  ])('co-gérant, %s : 403 réservé au titulaire, rien n’est écrit', async (_cas, corps) => {
    coGerant()
    const res = await modifier(corps)
    expect(res.status).toBe(403)
    expect((await res.json()).error).toMatch(/gérant titulaire/)
    rienNEstEcrit()
  })

  it.each([
    ['co-gérant', coGerant, LIGNE_COGERANT],
    ['titulaire', () => { h.appelant = null }, LIGNE_TITULAIRE],
  ])('%s sur sa propre ligne (statut, droits) : 403, il ne se retire ni ne se restreint', async (_cas, appelant, ligneId) => {
    appelant()
    for (const corps of [{ is_active: false }, { permissions: [] }]) {
      const res = await modifier({ member_id: ligneId, ...corps })
      expect(res.status).toBe(403)
    }
    rienNEstEcrit()
  })

  it('titulaire : promeut un salarié gérant (son compte reçoit GERANT, garde la société)', async () => {
    compteVise(MEMBRE)
    expect((await modifier({ member_id: LIGNE, role: 'GERANT' })).status).toBe(200)
    expect(h.admin.updateUserById).toHaveBeenCalledWith(COMPTE_VISE, { app_metadata: { ...MEMBRE, pro_team_role: 'GERANT' } })
  })

  it('co-gérant sans ligne active (resolveCompanyId retombe sur lui) : 409 partout, rien n’est lu ni écrit', async () => {
    coGerant()
    vi.mocked(resolveCompanyId).mockResolvedValue(COGERANT)
    try {
      for (const res of [await modifier({ member_id: LIGNE, is_active: false }), await supprimer(LIGNE)]) {
        expect(res.status).toBe(409)
        expect((await res.json()).error).toMatch(/aucune société active/)
      }
      expect(appelsDe(h.base, TABLE, 'select')).toHaveLength(0)
      rienNEstEcrit()
      // Pas de ligne GERANT « company_id = lui-même » créée par la réparation automatique du GET.
      await GET(new NextRequest('https://vitfix.io/api/pro/team', { headers: { Authorization: 'Bearer tok' } }))
      expect(appelsDe(h.base, TABLE, 'insert')).toHaveLength(0)
    } finally {
      vi.mocked(resolveCompanyId).mockResolvedValue(SOCIETE)
    }
  })

  it.each([
    ['titulaire retire le co-gérant', null, LIGNE_COGERANT, 200],
    ['titulaire retire une invitation de gérant en attente', null, 'ligne-invitation-gerant', 200],
    ['titulaire se retire lui-même', null, LIGNE_TITULAIRE, 403],
    ['co-gérant retire le titulaire', 'cogerant', LIGNE_TITULAIRE, 403],
    ['co-gérant retire un autre co-gérant', 'cogerant', 'ligne-autre-cogerant', 403],
    ['co-gérant se retire lui-même', 'cogerant', LIGNE_COGERANT, 403],
    ['co-gérant retire un salarié', 'cogerant', LIGNE, 200],
  ])('DELETE, %s : %s', async (_cas, appelant, ligneId, statut) => {
    poserLignes(
      ligne({ id: 'ligne-invitation-gerant', user_id: null, role: 'GERANT', email: 'futur@exemple.test', accepted_at: null, invite_token: 'empreinte' }),
      ligne({ id: 'ligne-autre-cogerant', user_id: AUTRE_COGERANT, role: 'GERANT', email: 'autre@exemple.test' }),
    )
    if (appelant === 'cogerant') coGerant()
    const res = await supprimer(ligneId)
    expect(res.status).toBe(statut)
    expect(suppressions()).toHaveLength(statut === 200 ? 1 : 0)
    if (statut === 200) expect(suppressions()[0].eq).toEqual([['id', ligneId], ['company_id', SOCIETE]])
  })
})
