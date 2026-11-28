// tests/api/user-delete-account.test.ts
//
// DELETE /api/user/delete-account (RGPD art. 17, libre-service : une session et confirmation: 'DELETE_MY_ACCOUNT').
// PR 2, lot 6 (SPEC § 2.10, RG-26) : le compte d'un gestionnaire Vitfix Signal est géré par son employeur, le cabinet
// (responsable de traitement ; VitFix est sous-traitant, art. 28). Pour un compte gestionnaire_signalement, ou un compte
// relié à une fiche, la route REFUSE avant toute suppression : 403 demande_au_cabinet ; la fiche est seulement datée
// (effacement_demande_le), la demande journalisée (gestionnaire.effacement_demande, acteur : lui-même) et le super admin
// prévenu sans nom ni adresse. Aucun autre compte ne change de parcours, y compris avant les migrations 20261111 et
// 20261112 (table ou colonne absente : la suppression suit son cours, repli journalisé une fois).
// Lot RGPD du BTP pro (audit du 11/11/2026, constats base-de-donnees-2 et stockage-local-miroir-12, puis relecture
// adverse) :
// - un compte qui détient au moins un devis ou une facture (en base, quel que soit son statut, brouillon compris, ou
//   dans la sauvegarde du stockage du navigateur) est refusé AVANT toute suppression (409, message en français) : la
//   route n'efface jamais un document que la loi impose de conserver dix ans ; une table de documents absente ne
//   contient rien (rejoué avec le vrai client Supabase, qui perd le code d'erreur d'une requête de comptage) ;
// - le compte (auth) est supprimé EN PREMIER : si la base l'en empêche (référence restante), rien n'est effacé (500) ;
//   ensuite, les données sans lien de cascade sont effacées (réservations de la fiche avant ses services, la fiche en
//   dernier), dont l'équipe d'une société BTP ; une table absente n'est pas un échec ; un échec rend 207 et part au
//   journal d'erreur avec un objet Error (alerte Sentry) ;
// - un compte sans document reste supprimé.
// Données fictives : @exemple.test.

import { describe, it, expect, vi, beforeEach, onTestFinished } from 'vitest'
import { createClient } from '@supabase/supabase-js'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/supabase-server', async () => ({ supabaseAdmin: (await import('../helpers/vitfixsignal-invitation')).clientInvitationQr }))
vi.mock('@/lib/supabase-server-component', async () => (await import('../helpers/vitfixsignal-routes')).mockCookies())
vi.mock('@/lib/auth-helpers', async () => (await import('../helpers/vitfixsignal-routes')).mockAuth())
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/vitfixsignal-routes')).mockLimites())
vi.mock('@/lib/email', async () => (await import('../helpers/vitfixsignal-routes')).mockEmail())
vi.mock('@/lib/logger', async () => {
  const { simulQr } = await import('../helpers/vitfixsignal-routes')
  return { logger: { ...simulQr.logger, withTenant: () => simulQr.logger } }
})

const { baseQr, simulerProductionAvant1111Qr, simulerProductionAvant1112Qr } = await import('../helpers/vitfixsignal-base')
const { messagesEnvoyesQr, reinitialiserSimulQr, requeteQr, simulQr, texteJournalServeurQr } = await import('../helpers/vitfixsignal-routes')
const { authQr, clientInvitationQr, reinitialiserAuthQr } = await import('../helpers/vitfixsignal-invitation')
const A = await import('../helpers/vitfixsignal-acces')
const { DELETE } = await import('@/app/api/user/delete-account/route')
const { reinitialiserReplisQr } = await import('@/lib/vitfixsignal/serveur')

const CLIENT = { id: '0c000000-0000-4000-8000-000000000001', email: 'client@exemple.test', app_metadata: { role: 'client' } }
const MESSAGE = 'Votre compte Vitfix Signal est géré par votre employeur : adressez votre demande au cabinet.'

const supprimer = (corps: unknown = { confirmation: 'DELETE_MY_ACCOUNT' }) => DELETE(requeteQr('/api/user/delete-account', 'DELETE', corps))
const suppressions = () => baseQr.etat.ecritures.filter((e) => e.op === 'delete')
const appelsSuppressionCompte = () => authQr.appels.filter((a) => a.methode === 'deleteUser')
const avertissementsMigration = () => simulQr.logger.warn.mock.calls.filter((c) => /1[12]\/11\/2026/.test(String(c[0])))

beforeEach(() => {
  reinitialiserSimulQr()
  reinitialiserReplisQr()
  reinitialiserAuthQr()
  baseQr.reinitialiser()
  vi.unstubAllEnvs()
  vi.stubEnv('ADMIN_EMAIL', 'admin@exemple.test')
  vi.stubEnv('ADMIN_EMAIL_2', '')
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://vitfix.io')
  A.poserJeuAccesQr()
})

describe('compte d’un gestionnaire : refus avant toute suppression (403 demande_au_cabinet)', () => {
  beforeEach(() => A.connecterQr(A.COMPTE_G1))

  it('403, aucune suppression ni suppression du compte ; fiche seulement datée ; journal ; alerte au super admin sans nom ni adresse', async () => {
    const res = await supprimer()
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'demande_au_cabinet', message: MESSAGE })
    expect(suppressions()).toEqual([])
    expect(appelsSuppressionCompte()).toEqual([])
    expect(baseQr.table('audit_logs')).toEqual([])
    const fiche = A.ficheSimuleeQr(A.G1)
    expect(fiche).toMatchObject({ actif: true, nom: 'Marie Exemple', email: A.EMAIL_G1, user_id: A.U1, pseudonymise_le: null })
    expect(fiche.effacement_demande_le).toEqual(expect.any(String))
    expect(baseQr.ecrituresDe('signalements_qr_gestionnaires', 'update').map((e) => Object.keys(e.valeurs as object))).toEqual([['effacement_demande_le']])
    expect(baseQr.table('signalements_qr_journal')).toEqual([expect.objectContaining({
      action: 'gestionnaire.effacement_demande', cabinet_id: A.CAB, acteur_id: A.U1, acteur_profil: 'gestionnaire',
      acteur_gestionnaire_id: A.G1, gestionnaire_id: A.G1, champs: [],
    })])
    const alertes = messagesEnvoyesQr()
    expect(alertes.map((m) => m.to)).toEqual(['admin@exemple.test'])
    expect(alertes[0].html).toContain(`#gestionnaire/${A.G1}`)
    for (const donnee of ['Marie', A.EMAIL_G1, A.U1]) expect(JSON.stringify(alertes)).not.toContain(donnee)
    expect(texteJournalServeurQr()).not.toContain(A.EMAIL_G1)
  })

  it('demande répétée : toujours 403, la première date est gardée, aucune nouvelle alerte ni ligne de journal', async () => {
    await supprimer()
    const premiere = A.ficheSimuleeQr(A.G1).effacement_demande_le
    const res = await supprimer()
    expect(res.status).toBe(403)
    expect(A.ficheSimuleeQr(A.G1).effacement_demande_le).toBe(premiere)
    expect(messagesEnvoyesQr()).toHaveLength(1)
    expect(baseQr.table('signalements_qr_journal')).toHaveLength(1)
  })

  it('compte relié à une fiche SANS le rôle des gestionnaires : refusé de même', async () => {
    A.connecterQr({ id: A.U2, email: A.EMAIL_G2, app_metadata: { role: 'client' } })
    const res = await supprimer()
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('demande_au_cabinet')
    expect(suppressions()).toEqual([])
    expect(A.ficheSimuleeQr(A.G2).effacement_demande_le).toEqual(expect.any(String))
  })

  it('rôle des gestionnaires sans fiche reliée : refusé, rien d’écrit', async () => {
    A.ficheSimuleeQr(A.G1).user_id = null
    const res = await supprimer()
    expect(res.status).toBe(403)
    expect(baseQr.etat.ecritures).toEqual([])
    expect(appelsSuppressionCompte()).toEqual([])
    expect(messagesEnvoyesQr()).toEqual([])
  })

  it('rôle des gestionnaires, migration 20261112 absente : refusé, rien d’écrit', async () => {
    simulerProductionAvant1112Qr()
    const res = await supprimer()
    expect(res.status).toBe(403)
    expect(baseQr.etat.ecritures).toEqual([])
    expect(appelsSuppressionCompte()).toEqual([])
  })

  it('rôle des gestionnaires, lecture de la fiche en panne : refusé, rien d’écrit', async () => {
    baseQr.etat.erreursPonctuelles.signalements_qr_gestionnaires = { code: 'XX000', message: 'panne' }
    const res = await supprimer()
    expect(res.status).toBe(403)
    expect(baseQr.etat.ecritures).toEqual([])
  })

  it('corps invalide : 400, comme pour tout compte, rien d’écrit', async () => {
    const res = await supprimer({ confirmation: 'oui' })
    expect(res.status).toBe(400)
    expect(baseQr.etat.ecritures).toEqual([])
    expect(appelsSuppressionCompte()).toEqual([])
  })
})

describe('autres comptes : parcours inchangé', () => {
  beforeEach(() => {
    A.connecterQr(CLIENT)
    authQr.comptes = [{ id: CLIENT.id, email: CLIENT.email, app_metadata: { role: 'client' }, user_metadata: {} }]
  })

  it('compte client sans fiche : suppression complète (compte, puis ses tables), 200', async () => {
    const res = await supprimer()
    expect(res.status).toBe(200)
    expect((await res.json()).success).toBe(true)
    expect(suppressions().length).toBeGreaterThan(5)
    expect(appelsSuppressionCompte()).toEqual([{ methode: 'deleteUser', args: [CLIENT.id] }])
    expect(baseQr.table('signalements_qr_journal')).toEqual([])
    expect(messagesEnvoyesQr()).toEqual([])
  })

  it.each([
    ['migration 20261112 absente (colonne user_id : 42703)', () => simulerProductionAvant1112Qr()],
    ['migrations 20261111 et 20261112 absentes (table : PGRST205)', () => { simulerProductionAvant1111Qr(); simulerProductionAvant1112Qr() }],
  ])('%s : suppression complète, repli journalisé une fois', async (_cas, simuler) => {
    simuler()
    for (let i = 0; i < 2; i += 1) {
      authQr.comptes = [{ id: CLIENT.id, email: CLIENT.email, app_metadata: { role: 'client' }, user_metadata: {} }]
      const res = await supprimer()
      expect(res.status).toBe(200)
    }
    expect(appelsSuppressionCompte()).toHaveLength(2)
    expect(avertissementsMigration()).toHaveLength(1)
  })

  it('lecture de la fiche en panne : 500, rien n’est supprimé (on ne sait pas si le compte est relié)', async () => {
    baseQr.etat.erreursPonctuelles.signalements_qr_gestionnaires = { code: 'XX000', message: 'panne' }
    const res = await supprimer()
    expect(res.status).toBe(500)
    expect(suppressions()).toEqual([])
    expect(appelsSuppressionCompte()).toEqual([])
  })
})

// ── Lot RGPD du BTP pro : aucun devis ni aucune facture effacé, jamais un compte à moitié vidé ──

const MESSAGE_DOCUMENTS = 'Votre compte détient des documents comptables (devis ou factures) que la loi impose de conserver : contactez le support pour supprimer votre compte.'
const MESSAGE_IMPOSSIBLE = 'La suppression de votre compte n’a pas pu aboutir et aucune donnée n’a été effacée : contactez le support.'

const SOCIETE = { id: '0d000000-0000-4000-8000-000000000001', email: 'societe@exemple.test', app_metadata: { role: 'pro_societe' } }
const FICHE = '0d000000-0000-4000-8000-0000000000f1'
const SOUS_COMPTE = '0d000000-0000-4000-8000-000000000002'
const AUTRE_SOCIETE = '0d000000-0000-4000-8000-000000000009'
const ARTISAN = { id: '0a000000-0000-4000-8000-000000000001', email: 'artisan@exemple.test', app_metadata: { role: 'artisan' } }
const FICHE_ARTISAN = '0a000000-0000-4000-8000-0000000000f1'
const TABLES_DE_DOCUMENTS = ['devis', 'factures', 'factures_recues', 'pt_fiscal_documents']

/** Compte connecté, présent dans l'auth simulée, avec sa fiche (profiles_artisan). */
function connecterAvecFiche(compte: { id: string; email: string; app_metadata: Record<string, unknown> }, fiche: string): void {
  simulQr.user = compte
  authQr.comptes = [{ id: compte.id, email: compte.email, app_metadata: { ...compte.app_metadata }, user_metadata: {} }]
  baseQr.etat.tables.profiles_artisan = [{ id: fiche, user_id: compte.id, company_name: 'Société Exemple' }]
}

/**
 * Tables servies par le vrai client Supabase (postgrest-js) devant une base qui répond comme PostgREST à une table
 * absente : 404, code PGRST205 dans le corps. Une requête de comptage (HEAD) n'a pas de corps : la bibliothèque la rend
 * alors sans erreur ni nombre (statut 204), ce que la base simulée ne reproduit pas. Les autres tables restent simulées.
 * Rend les méthodes HTTP reçues par cette base, dans l'ordre.
 */
function servirParLeVraiClient(tablesAbsentes: readonly string[]): string[] {
  const methodes: string[] = []
  const vraiClient = createClient('https://base.exemple.test', 'cle-exemple', {
    accessToken: async () => 'jeton-exemple',
    global: {
      fetch: async (_adresse, init) => {
        methodes.push(init?.method ?? 'GET')
        if (init?.method === 'HEAD') return new Response(null, { status: 404 })
        return Response.json({ code: 'PGRST205', details: null, hint: null, message: 'Could not find the table in the schema cache' }, { status: 404 })
      },
    },
  })
  const baseSimulee = clientInvitationQr.from
  const espion = vi.spyOn(clientInvitationQr, 'from').mockImplementation((table: string) => (tablesAbsentes.includes(table)
    ? vraiClient.from(table) as unknown as ReturnType<typeof baseSimulee>
    : baseSimulee(table)))
  onTestFinished(() => espion.mockRestore())
  return methodes
}

describe('lot RGPD du BTP pro : aucun devis ni aucune facture effacé, jamais un compte à moitié vidé', () => {
  beforeEach(() => {
    connecterAvecFiche(SOCIETE, FICHE)
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
      connecterAvecFiche(ARTISAN, FICHE_ARTISAN)
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

    it('table de documents absente de la base (migration non appliquée), lue par le vrai client : rien à conserver, le compte est supprimé', async () => {
      const methodes = servirParLeVraiClient(['factures_recues', 'pt_fiscal_documents'])
      const res = await supprimer()
      expect(res.status).toBe(200)
      expect(appelsSuppressionCompte()).toHaveLength(1)
      expect(methodes).toHaveLength(2)
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

    it('fiche : ses réservations sont effacées avant ses services, la fiche en dernier (une réservation pointe son service)', async () => {
      const res = await supprimer()
      expect(res.status).toBe(200)
      const ordre = suppressions().map((e) => `${e.table} ${e.filtres.join(' ')}`)
      const reservations = ordre.indexOf(`bookings artisan_id=eq.${FICHE}`)
      const prestations = ordre.indexOf(`services artisan_id=eq.${FICHE}`)
      expect(reservations).toBeGreaterThan(-1)
      expect(reservations).toBeLessThan(prestations)
      expect(prestations).toBeLessThan(ordre.indexOf(`profiles_artisan id=eq.${FICHE}`))
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

    it('une table restante en échec après la suppression du compte : 207, le reste est effacé, alerte avec un objet Error (Sentry)', async () => {
      authQr.avant.deleteUser = () => { baseQr.etat.erreursPonctuelles.services = { code: 'XX000', message: 'panne' } }
      const res = await supprimer()
      expect(res.status).toBe(207)
      expect(appelsSuppressionCompte()).toHaveLength(1)
      expect(baseQr.table('pro_team_members').map((m) => m.company_id)).toEqual([AUTRE_SOCIETE])
      // lib/logger.ts n'alerte Sentry que s'il reçoit un objet Error : noms des tables au contexte, aucune donnée personnelle.
      expect(simulQr.logger.error).toHaveBeenCalledWith(
        'Compte supprimé, données restantes non effacées', { userId: SOCIETE.id.substring(0, 8), tables: ['services'] }, expect.any(Error))
      expect((simulQr.logger.error.mock.calls[0][2] as Error).message).toBe('Suppression de compte RGPD incomplète')
      expect(texteJournalServeurQr()).not.toContain(SOCIETE.email)
    })

    it('table restante absente de la base (migration non appliquée) : rien à y effacer, suppression complète (200), aucune alerte', async () => {
      baseQr.etat.tablesAbsentes = ['availability_services', 'tracking_sessions']
      baseQr.etat.codeTableAbsente = 'PGRST205'
      const res = await supprimer()
      expect(res.status).toBe(200)
      expect((await res.json()).success).toBe(true)
      expect(baseQr.etat.tablesAbsentesLues).toEqual(['availability_services', 'tracking_sessions'])
      expect(simulQr.logger.error).not.toHaveBeenCalled()
    })
  })
})
