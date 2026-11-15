// tests/api/user-delete-account-documents.test.ts
//
// DELETE /api/user/delete-account (RGPD art. 17) — lot RGPD du BTP pro (audit du 11/11/2026, constats base-de-donnees-2
// et stockage-local-miroir-12) :
// - un compte qui détient au moins un devis ou une facture (en base, quel que soit son statut, brouillon compris, ou
//   dans la sauvegarde du stockage du navigateur) est refusé AVANT toute suppression (409, message en français) : la
//   route n'efface jamais un document que la loi impose de conserver dix ans ;
// - le compte (auth) est supprimé EN PREMIER : si la base l'en empêche (référence restante), rien n'est effacé (500) ;
//   une fois le compte supprimé, les données sans lien de cascade sont effacées, dont l'équipe d'une société BTP ;
// - un compte sans document reste supprimé.
// Données fictives : @exemple.test.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/supabase-server', async () => ({ supabaseAdmin: (await import('../helpers/aj-signalement-invitation')).clientInvitationQr }))
vi.mock('@/lib/supabase-server-component', async () => (await import('../helpers/aj-signalement-routes')).mockCookies())
vi.mock('@/lib/auth-helpers', async () => (await import('../helpers/aj-signalement-routes')).mockAuth())
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/aj-signalement-routes')).mockLimites())
vi.mock('@/lib/email', async () => (await import('../helpers/aj-signalement-routes')).mockEmail())
vi.mock('@/lib/logger', async () => {
  const { simulQr } = await import('../helpers/aj-signalement-routes')
  return { logger: { ...simulQr.logger, withTenant: () => simulQr.logger } }
})

const { baseQr } = await import('../helpers/aj-signalement-base')
const { reinitialiserSimulQr, requeteQr, simulQr, texteJournalServeurQr } = await import('../helpers/aj-signalement-routes')
const { authQr, reinitialiserAuthQr } = await import('../helpers/aj-signalement-invitation')
const { DELETE } = await import('@/app/api/user/delete-account/route')
const { reinitialiserReplisQr } = await import('@/lib/aj-signalement/serveur')

const MESSAGE_DOCUMENTS = 'Votre compte détient des documents comptables (devis ou factures) que la loi impose de conserver : contactez le support pour supprimer votre compte.'
const MESSAGE_IMPOSSIBLE = 'La suppression de votre compte n’a pas pu aboutir et aucune donnée n’a été effacée : contactez le support.'

const SOCIETE = { id: '0d000000-0000-4000-8000-000000000001', email: 'societe@exemple.test', app_metadata: { role: 'pro_societe' } }
const FICHE = '0d000000-0000-4000-8000-0000000000f1'
const SOUS_COMPTE = '0d000000-0000-4000-8000-000000000002'
const AUTRE_SOCIETE = '0d000000-0000-4000-8000-000000000009'
const ARTISAN = { id: '0a000000-0000-4000-8000-000000000001', email: 'artisan@exemple.test', app_metadata: { role: 'artisan' } }
const FICHE_ARTISAN = '0a000000-0000-4000-8000-0000000000f1'
const TABLES_DE_DOCUMENTS = ['devis', 'factures', 'factures_recues', 'pt_fiscal_documents']

const supprimer = () => DELETE(requeteQr('/api/user/delete-account', 'DELETE', { confirmation: 'DELETE_MY_ACCOUNT' }))
const suppressions = () => baseQr.etat.ecritures.filter((e) => e.op === 'delete')
const appelsSuppressionCompte = () => authQr.appels.filter((a) => a.methode === 'deleteUser')

function connecter(compte: { id: string; email: string; app_metadata: Record<string, unknown> }, fiche: string): void {
  simulQr.user = compte
  authQr.comptes = [{ id: compte.id, email: compte.email, app_metadata: { ...compte.app_metadata }, user_metadata: {} }]
  baseQr.etat.tables.profiles_artisan = [{ id: fiche, user_id: compte.id, company_name: 'Société Exemple' }]
}

beforeEach(() => {
  reinitialiserSimulQr()
  reinitialiserReplisQr()
  reinitialiserAuthQr()
  baseQr.reinitialiser()
  connecter(SOCIETE, FICHE)
  baseQr.etat.tables.pro_team_members = [
    { id: 'e0000000-0000-4000-8000-000000000001', company_id: SOCIETE.id, user_id: SOCIETE.id, email: 'societe@exemple.test', full_name: 'Gérant Exemple', role: 'GERANT' },
    { id: 'e0000000-0000-4000-8000-000000000002', company_id: SOCIETE.id, user_id: null, email: 'ouvrier@exemple.test', full_name: 'Ouvrier Exemple', role: 'OUVRIER' },
    { id: 'e0000000-0000-4000-8000-000000000003', company_id: AUTRE_SOCIETE, user_id: null, email: 'autre@exemple.test', full_name: 'Autre Exemple', role: 'OUVRIER' },
  ]
})

describe('compte qui détient des devis ou des factures : refus avant toute suppression (409)', () => {
  const t = () => baseQr.etat.tables

  it.each([
    ['une facture émise', () => { t().factures = [{ id: 'f1', artisan_user_id: SOCIETE.id, artisan_id: FICHE, numero: 'FACT-2026-0001', status: 'sent' }] }],
    ['un devis brouillon', () => { t().devis = [{ id: 'd1', artisan_user_id: SOCIETE.id, artisan_id: FICHE, numero: null, status: 'draft' }] }],
    ['une facture annulée et masquée', () => { t().factures = [{ id: 'f2', artisan_user_id: SOCIETE.id, artisan_id: FICHE, numero: 'FACT-2026-0002', status: 'cancelled', deleted_at: '2026-11-01T10:00:00Z' }] }],
    ['un devis d’un sous-compte de la société (rattaché à sa fiche)', () => { t().devis = [{ id: 'd2', artisan_user_id: SOUS_COMPTE, artisan_id: FICHE, numero: 'DEV-2026-0001', status: 'sent' }] }],
    ['une facture reçue', () => { t().factures_recues = [{ id: 'r1', artisan_user_id: SOCIETE.id, numero: 'F-FOURNISSEUR-1' }] }],
    ['un document fiscal portugais', () => { t().pt_fiscal_documents = [{ id: 'p1', artisan_id: SOCIETE.id }] }],
    ['des documents dans la sauvegarde du stockage du navigateur', () => {
      t().user_storage = [{ user_id: SOCIETE.id, key: `fixit_documents_${FICHE}`, value: [{ id: 'doc-1', docNumber: 'FACT-2026-0003' }] }]
    }],
    ['des brouillons dans la sauvegarde du stockage du navigateur', () => {
      t().user_storage = [{ user_id: SOCIETE.id, key: `fixit_drafts_${FICHE}`, value: [{ id: 'brouillon-1' }] }]
    }],
  ])('%s : 409, message clair, rien n’est écrit ni le compte supprimé', async (_cas, poser) => {
    poser()
    const res = await supprimer()
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: MESSAGE_DOCUMENTS, code: 'documents_a_conserver' })
    expect(baseQr.etat.ecritures).toEqual([])
    expect(appelsSuppressionCompte()).toEqual([])
  })

  it('compte artisan qui détient une facture : refusé de même (correctif commun à tous les rôles)', async () => {
    connecter(ARTISAN, FICHE_ARTISAN)
    baseQr.etat.tables.factures = [{ id: 'f3', artisan_user_id: ARTISAN.id, artisan_id: FICHE_ARTISAN, numero: 'FACT-2026-0009', status: 'paid' }]
    const res = await supprimer()
    expect(res.status).toBe(409)
    expect(suppressions()).toEqual([])
    expect(appelsSuppressionCompte()).toEqual([])
    expect(baseQr.table('factures')).toHaveLength(1)
  })

  it('compte sans fiche société : ses documents sont comptés par son compte', async () => {
    baseQr.etat.tables.profiles_artisan = []
    baseQr.etat.tables.devis = [{ id: 'd3', artisan_user_id: SOCIETE.id, artisan_id: FICHE, numero: 'DEV-2026-0002', status: 'signed' }]
    const res = await supprimer()
    expect(res.status).toBe(409)
    expect(appelsSuppressionCompte()).toEqual([])
  })

  it.each(['devis', 'factures', 'factures_recues', 'pt_fiscal_documents', 'user_storage', 'profiles_artisan'])(
    'lecture de %s en panne : 500, rien n’est supprimé (on ne sait pas si le compte détient des documents)',
    async (table) => {
      baseQr.etat.erreursPonctuelles[table] = { code: 'XX000', message: 'panne' }
      const res = await supprimer()
      expect(res.status).toBe(500)
      expect(suppressions()).toEqual([])
      expect(appelsSuppressionCompte()).toEqual([])
    },
  )

  it('sauvegarde du stockage du navigateur : listes de documents vides et autres clés → le compte est supprimé (200)', async () => {
    baseQr.etat.tables.user_storage = [
      { user_id: SOCIETE.id, key: `fixit_documents_${FICHE}`, value: [] },
      { user_id: SOCIETE.id, key: `fixit_drafts_${FICHE}`, value: [] },
      { user_id: SOCIETE.id, key: `fixit_chantiers_${SOCIETE.id}`, value: [{ id: 'ch1' }] },
      { user_id: AUTRE_SOCIETE, key: `fixit_documents_${FICHE}`, value: [{ id: 'doc-autre' }] },
    ]
    const res = await supprimer()
    expect(res.status).toBe(200)
    expect(appelsSuppressionCompte()).toEqual([{ methode: 'deleteUser', args: [SOCIETE.id] }])
  })

  it('table de documents absente de la base (migration non appliquée) : rien à conserver, le compte est supprimé', async () => {
    baseQr.etat.tablesAbsentes = ['factures_recues', 'pt_fiscal_documents']
    baseQr.etat.codeTableAbsente = 'PGRST205'
    const res = await supprimer()
    expect(res.status).toBe(200)
    expect(appelsSuppressionCompte()).toHaveLength(1)
  })
})

describe('suppression sans état intermédiaire : le compte d’abord, puis ses données', () => {
  it('compte sans document : compte supprimé AVANT toute autre suppression, puis sa fiche et l’équipe de la société (200)', async () => {
    let suppressionsAvantLeCompte = -1
    authQr.avant.deleteUser = () => { suppressionsAvantLeCompte = suppressions().length }
    const res = await supprimer()
    expect(res.status).toBe(200)
    expect((await res.json()).success).toBe(true)
    expect(suppressionsAvantLeCompte).toBe(0)
    expect(appelsSuppressionCompte()).toEqual([{ methode: 'deleteUser', args: [SOCIETE.id] }])
    expect(baseQr.table('profiles_artisan')).toEqual([])
    expect(baseQr.table('pro_team_members').map((m) => m.company_id)).toEqual([AUTRE_SOCIETE])
    expect(suppressions().filter((e) => TABLES_DE_DOCUMENTS.includes(e.table))).toEqual([])
  })

  it('suppression du compte refusée par la base (référence restante) : 500, message clair, rien n’est effacé', async () => {
    authQr.echecs.deleteUser = 'Database error deleting user'
    baseQr.etat.tables.charges_fixes = [{ id: 'cf1', owner_id: SOCIETE.id, label: 'Assurance', montant: 100, frequence: 'mensuel', categorie: 'rc_pro' }]
    const res = await supprimer()
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: MESSAGE_IMPOSSIBLE, code: 'suppression_impossible' })
    expect(suppressions()).toEqual([])
    expect(baseQr.table('charges_fixes')).toHaveLength(1)
    expect(baseQr.table('profiles_artisan')).toHaveLength(1)
    expect(baseQr.table('pro_team_members')).toHaveLength(3)
    expect(texteJournalServeurQr()).not.toContain(SOCIETE.email)
  })

  it('une table restante en échec après la suppression du compte : 207, le reste est effacé quand même', async () => {
    authQr.avant.deleteUser = () => { baseQr.etat.erreursPonctuelles.services = { code: 'XX000', message: 'panne' } }
    const res = await supprimer()
    expect(res.status).toBe(207)
    expect(appelsSuppressionCompte()).toHaveLength(1)
    expect(baseQr.table('pro_team_members').map((m) => m.company_id)).toEqual([AUTRE_SOCIETE])
    expect(simulQr.logger.error).toHaveBeenCalled()
  })
})
