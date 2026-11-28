// tests/lib/aj-signalement-controle.test.ts
//
// controlerAccesQr (lib/aj-signalement/serveur.ts) : contrôle serveur de TOUTES les routes non publiques d'AJ
// Signalement. Super admin = isSuperAdmin (lib/auth-helpers.ts, le vrai : rôle app_metadata ET e-mail de la liste
// ADMIN_EMAIL / ADMIN_EMAIL_2), aligné sur #650 : la « vue en tant que » (_original_role) et la liste vide ne
// passent plus. controlerSuperAdmin reste un alias le temps de la PR.
// codeDepuisErreurSqlQr : traduction des erreurs de la base en codes publics, jamais le message.
// PR 2 : profil gestionnaire. Rôle app_metadata gestionnaire_signalement (jamais user_metadata), puis fiche relue en base
// PAR user_id à CHAQUE appel (aucun cache) : absente, inactive, bloquée ou pseudonymisée → 403 acces_retire ; le cabinet
// vient de la fiche, jamais du compte ; route réservée au super admin → 403 interdit sans lecture ; colonne user_id
// absente (migration 20261112 non appliquée) → 503 base_absente, journalisé une fois par isolat.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const simul = vi.hoisted(() => ({
  cookie: null as null | Record<string, unknown>,
  cookiesIllisibles: false,
  fiche: null as null | Record<string, unknown>,
  erreurFiche: null as null | { code: string; message: string },
  lectures: [] as Array<{ table: string; colonnes: string; filtres: string[] }>,
}))
const journal = vi.hoisted(() => ({ error: vi.fn(), warn: vi.fn() }))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { error: journal.error, warn: journal.warn, info: vi.fn(), debug: vi.fn() } }))
vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      const lecture = { table, colonnes: '', filtres: [] as string[] }
      simul.lectures.push(lecture)
      const q = {
        select: (colonnes: string) => { lecture.colonnes = colonnes; return q },
        eq: (colonne: string, valeur: unknown) => { lecture.filtres.push(`${colonne}=${String(valeur)}`); return q },
        maybeSingle: async () => (simul.erreurFiche ? { data: null, error: simul.erreurFiche } : { data: simul.fiche ? { ...simul.fiche } : null, error: null }),
      }
      return q
    }),
    rpc: vi.fn(),
  },
}))
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
  simul.fiche = null
  simul.erreurFiche = null
  simul.lectures = []
  journal.error.mockClear()
  journal.warn.mockClear()
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

describe('controlerAccesQr : profil gestionnaire (PR 2)', () => {
  const UID = '0b000000-0000-4000-8000-000000000001'
  const FICHE = 'a0000000-0000-4000-8000-000000000001'
  const CAB = 'ca000000-0000-4000-8000-000000000001'
  const AUTRE_CAB = 'ca000000-0000-4000-8000-000000000002'
  const gestionnaire = (app_metadata: Record<string, unknown> = { role: 'gestionnaire_signalement' }, sur: Record<string, unknown> = {}) =>
    ({ id: UID, email: 'marie.exemple@exemple.test', app_metadata, user_metadata: {}, ...sur })
  const ficheActive = (sur: Record<string, unknown> = {}) => ({
    id: FICHE, cabinet_id: CAB, nom: 'Marie Exemple', actif: true, connexion_bloquee_le: null, pseudonymise_le: null, user_id: UID, ...sur,
  })
  const LES_DEUX = { profils: ['super_admin', 'gestionnaire'] as const }
  type Controle = Awaited<ReturnType<Awaited<ReturnType<typeof charger>>['controlerAccesQr']>>

  const attendre403 = async (r: Controle, code: string) => {
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.reponse.status).toBe(403)
      expect(await r.reponse.json()).toEqual({ error: code })
    }
  }

  it('fiche active relue par user_id : profil gestionnaire avec le cabinet DE LA FICHE (jamais celui du compte)', async () => {
    const { controlerAccesQr } = await charger('admin@exemple.test')
    simul.cookie = gestionnaire({ role: 'gestionnaire_signalement', aj_signalement_cabinet: 'autre-cabinet', cabinet_id: AUTRE_CAB })
    simul.fiche = ficheActive()
    const r = await controlerAccesQr(requete(), LES_DEUX)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.profil).toEqual({ type: 'gestionnaire', userId: UID, gestionnaireId: FICHE, cabinetId: CAB, nom: 'Marie Exemple' })
    expect(simul.lectures).toEqual([{ table: 'signalements_qr_gestionnaires', colonnes: expect.stringContaining('connexion_bloquee_le'), filtres: [`user_id=${UID}`] }])
  })

  it('aucun cache : chaque appel relit la fiche ; fiche désactivée entre deux appels → 403 acces_retire', async () => {
    const { controlerAccesQr } = await charger('admin@exemple.test')
    simul.cookie = gestionnaire()
    simul.fiche = ficheActive()
    expect((await controlerAccesQr(requete(), LES_DEUX)).ok).toBe(true)
    simul.fiche = ficheActive({ actif: false })
    await attendre403(await controlerAccesQr(requete(), LES_DEUX), 'acces_retire')
    expect(simul.lectures).toHaveLength(2)
  })

  it.each([
    ['rôle sans fiche', null],
    ['fiche désactivée', { actif: false }],
    ['connexion bloquée', { connexion_bloquee_le: '2026-11-12T09:00:00+00:00' }],
    ['fiche pseudonymisée', { actif: false, pseudonymise_le: '2026-11-12T09:00:00+00:00', nom: null }],
  ])('%s : 403 acces_retire', async (_cas, sur) => {
    const { controlerAccesQr } = await charger('admin@exemple.test')
    simul.cookie = gestionnaire()
    simul.fiche = sur === null ? null : ficheActive(sur)
    await attendre403(await controlerAccesQr(requete(), LES_DEUX), 'acces_retire')
  })

  it('user_metadata.role seul (app_metadata vide) : aucun droit, 403 interdit, aucune lecture', async () => {
    const { controlerAccesQr } = await charger('admin@exemple.test')
    simul.cookie = gestionnaire({}, { user_metadata: { role: 'gestionnaire_signalement' } })
    simul.fiche = ficheActive()
    await attendre403(await controlerAccesQr(requete(), LES_DEUX), 'interdit')
    expect(simul.lectures).toEqual([])
  })

  it('route réservée au super admin : 403 interdit SANS lire la fiche (aucune colonne de la 20261112 nommée)', async () => {
    const { controlerAccesQr, controlerSuperAdmin } = await charger('admin@exemple.test')
    simul.cookie = gestionnaire()
    simul.fiche = ficheActive()
    await attendre403(await controlerAccesQr(requete(), { profils: ['super_admin'] }), 'interdit')
    await attendre403(await controlerSuperAdmin(requete()), 'interdit')
    expect(simul.lectures).toEqual([])
  })

  it('un compte gestionnaire n’est jamais super admin, même avec une adresse de la liste ADMIN_EMAIL', async () => {
    const { controlerAccesQr } = await charger('marie.exemple@exemple.test')
    simul.cookie = gestionnaire()
    simul.fiche = ficheActive()
    const r = await controlerAccesQr(requete(), LES_DEUX)
    expect(r.ok && r.profil.type).toBe('gestionnaire')
    await attendre403(await controlerAccesQr(requete(), { profils: ['super_admin'] }), 'interdit')
  })

  it('super admin sur une route ouverte aux deux profils : profil super_admin, aucune lecture de fiche', async () => {
    const { controlerAccesQr } = await charger('admin@exemple.test')
    simul.cookie = compte('admin@exemple.test', { role: 'super_admin' })
    const r = await controlerAccesQr(requete(), LES_DEUX)
    expect(r.ok && r.profil).toEqual({ type: 'super_admin', userId: '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4' })
    expect(simul.lectures).toEqual([])
  })

  it('autre rôle (client, syndic, artisan) sur une route ouverte aux gestionnaires : 403 interdit, aucune lecture', async () => {
    const { controlerAccesQr } = await charger('admin@exemple.test')
    for (const role of ['client', 'syndic', 'syndic_gestionnaire', 'artisan']) {
      simul.cookie = gestionnaire({ role })
      await attendre403(await controlerAccesQr(requete(), LES_DEUX), 'interdit')
    }
    expect(simul.lectures).toEqual([])
  })

  it.each([
    ['colonne user_id absente (42703)', { code: '42703', message: 'column signalements_qr_gestionnaires.user_id does not exist' }],
    ['table absente (PGRST205)', { code: 'PGRST205', message: "Could not find the table 'public.signalements_qr_gestionnaires' in the schema cache" }],
  ])('%s : 503 base_absente, repli journalisé UNE fois par isolat, sans message', async (_cas, erreur) => {
    const { controlerAccesQr } = await charger('admin@exemple.test')
    simul.cookie = gestionnaire()
    simul.erreurFiche = erreur
    for (let i = 0; i < 2; i += 1) {
      const r = await controlerAccesQr(requete(), LES_DEUX)
      expect(!r.ok && r.reponse.status).toBe(503)
      if (!r.ok) expect(await r.reponse.json()).toEqual({ error: 'base_absente' })
    }
    expect(journal.warn).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(journal.warn.mock.calls)).not.toContain('does not exist')
    expect(JSON.stringify(journal.warn.mock.calls)).not.toContain('schema cache')
  })

  it('autre erreur de lecture : 500 serveur, journalisée avec son seul code', async () => {
    const { controlerAccesQr } = await charger('admin@exemple.test')
    simul.cookie = gestionnaire()
    simul.erreurFiche = { code: '57014', message: 'canceling statement due to statement timeout' }
    const r = await controlerAccesQr(requete(), LES_DEUX)
    expect(!r.ok && r.reponse.status).toBe(500)
    if (!r.ok) expect(await r.reponse.json()).toEqual({ error: 'serveur' })
    expect(JSON.stringify(journal.error.mock.calls)).not.toContain('statement timeout')
  })
})

describe('codeDepuisErreurSqlQr', () => {
  it.each([
    [{ code: 'P0001', message: 'deja_ouvert' }, 'deja_ouvert', 409],
    [{ code: 'P0001', message: 'adresse_contestee' }, 'adresse_contestee', 409],
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
