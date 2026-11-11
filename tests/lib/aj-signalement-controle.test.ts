// tests/lib/aj-signalement-controle.test.ts
//
// controlerAccesQr (lib/aj-signalement/serveur.ts) : contrôle serveur de TOUTES les routes non publiques d'AJ
// Signalement. Super admin = isSuperAdmin (lib/auth-helpers.ts, le vrai : rôle app_metadata ET e-mail de la liste
// ADMIN_EMAIL / ADMIN_EMAIL_2), aligné sur #650 : la « vue en tant que » (_original_role) et la liste vide ne
// passent plus. controlerSuperAdmin reste un alias le temps de la PR.
// codeDepuisErreurSqlQr : traduction des erreurs de la base en codes publics, jamais le message.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const simul = vi.hoisted(() => ({ cookie: null as null | Record<string, unknown>, cookiesIllisibles: false }))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }))
vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin: { from: vi.fn(), rpc: vi.fn() } }))
vi.mock('@/lib/supabase-server-component', () => ({
  createServerSupabaseClient: vi.fn(async () => {
    if (simul.cookiesIllisibles) throw new Error('cookies')
    return { auth: { getUser: async () => ({ data: { user: simul.cookie } }) } }
  }),
}))

async function charger(admin1: string, admin2 = '') {
  vi.resetModules()
  vi.stubEnv('ADMIN_EMAIL', admin1)
  vi.stubEnv('ADMIN_EMAIL_2', admin2)
  return import('@/lib/aj-signalement/serveur')
}

const requete = () => new NextRequest('https://vitfix.io/api/aj-signalement/tableau')
const compte = (email: string, app_metadata: Record<string, unknown>) => ({ id: '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4', email, app_metadata })

beforeEach(() => {
  simul.cookie = null
  simul.cookiesIllisibles = false
})
afterEach(() => vi.unstubAllEnvs())

describe('controlerAccesQr', () => {
  it('super admin (rôle ET e-mail de la liste), session par cookies : profil super_admin', async () => {
    const { controlerAccesQr } = await charger('admin@exemple.test')
    simul.cookie = compte('Admin@Exemple.test', { role: 'super_admin' })
    const r = await controlerAccesQr(requete(), { profils: ['super_admin'] })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.profil).toEqual({ type: 'super_admin', userId: '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4' })
  })

  it('pas de session, ou cookies illisibles : 401 non_authentifie', async () => {
    const { controlerAccesQr } = await charger('admin@exemple.test')
    const r = await controlerAccesQr(requete(), { profils: ['super_admin'] })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.reponse.status).toBe(401)
      expect(await r.reponse.json()).toEqual({ error: 'non_authentifie' })
    }
    simul.cookiesIllisibles = true
    const r2 = await controlerAccesQr(requete(), { profils: ['super_admin'] })
    expect(!r2.ok && r2.reponse.status).toBe(401)
  })

  it.each([
    ['liste ADMIN_* vide', '', compte('admin@exemple.test', { role: 'super_admin' })],
    ['compte super_admin hors de la liste', 'admin@exemple.test', compte('autre@exemple.test', { role: 'super_admin' })],
    ['« vue en tant que » (_original_role)', 'admin@exemple.test', compte('admin@exemple.test', { role: 'coproprio', _original_role: 'super_admin', _admin_override: true })],
    ['e-mail de la liste sans le rôle', 'admin@exemple.test', compte('admin@exemple.test', { role: 'syndic' })],
  ])('%s : 403 interdit', async (_cas, liste, utilisateur) => {
    const { controlerAccesQr } = await charger(liste)
    simul.cookie = utilisateur
    const r = await controlerAccesQr(requete(), { profils: ['super_admin'] })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.reponse.status).toBe(403)
      expect(await r.reponse.json()).toEqual({ error: 'interdit' })
    }
  })

  it('controlerSuperAdmin : alias de la même règle', async () => {
    const { controlerSuperAdmin } = await charger('admin@exemple.test')
    simul.cookie = compte('admin@exemple.test', { role: 'coproprio', _original_role: 'super_admin' })
    const r = await controlerSuperAdmin(requete())
    expect(!r.ok && r.reponse.status).toBe(403)
    simul.cookie = compte('admin@exemple.test', { role: 'super_admin' })
    expect((await controlerSuperAdmin(requete())).ok).toBe(true)
  })
})

describe('codeDepuisErreurSqlQr', () => {
  it.each([
    [{ code: 'P0001', message: 'doublon' }, 'doublon', 409],
    [{ code: 'P0001', message: 'a_reverifier' }, 'a_reverifier', 409],
    [{ code: 'P0001', message: 'sans_cabinet' }, 'sans_cabinet', 409],
    [{ code: 'P0001', message: 'identifiant_pris' }, 'identifiant_pris', 409],
    [{ code: 'P0001', message: 'identifiant_fige' }, 'identifiant_fige', 409],
    [{ code: 'P0001', message: 'domaine_pris' }, 'domaine_pris', 409],
    [{ code: 'P0001', message: 'cabinet_fige' }, 'cabinet_fige', 409],
    [{ code: 'P0001', message: 'hors_domaine' }, 'hors_domaine', 409],
    [{ code: 'P0001', message: 'message inattendu : Résidence Exemple' }, 'serveur', 500],
    [{ code: '23505', message: 'duplicate key value violates unique constraint "signalements_qr_cabinets_identifiant_unique"' }, 'identifiant_pris', 409],
    [{ code: '23505', message: 'duplicate key value violates unique constraint "signalements_qr_domaines_domaine_unique"' }, 'domaine_pris', 409],
    [{ code: '23505', message: 'duplicate key value violates unique constraint "uq_signalements_qr_gestionnaires_email"' }, 'existe_deja', 409],
    [{ code: '23505', message: 'duplicate key value violates unique constraint "uq_signalements_qr_copros_immatriculation"' }, 'doublon', 409],
    [{ code: '23505', message: 'duplicate key value violates unique constraint "uq_signalements_qr_copros_reference"' }, 'doublon', 409],
    [{ code: '23505', message: 'duplicate key value violates unique constraint "signalements_qr_operations_pkey"' }, 'a_reverifier', 409],
    [{ code: '23505', message: 'duplicate key value violates unique constraint "autre"' }, 'a_reverifier', 409],
    [{ code: '23503', message: 'insert or update violates foreign key constraint' }, 'a_reverifier', 409],
    [{ code: '42501', message: 'interdit' }, 'interdit', 403],
    [{ code: '22023', message: 'parametre_invalide' }, 'invalide', 400],
    [{ code: '42P01', message: 'relation does not exist' }, 'base_absente', 503],
    [{ code: 'PGRST202', message: 'Could not find the function' }, 'base_absente', 503],
    [{ code: 'PGRST205', message: 'Could not find the table' }, 'base_absente', 503],
    [{ code: 'XX000', message: 'panne' }, 'serveur', 500],
  ])('%o → %s (%i)', async (erreur, code, status) => {
    const { codeDepuisErreurSqlQr } = await charger('admin@exemple.test')
    expect(codeDepuisErreurSqlQr(erreur)).toEqual({ code, status })
  })
})
