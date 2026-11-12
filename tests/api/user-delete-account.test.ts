// tests/api/user-delete-account.test.ts
//
// DELETE /api/user/delete-account (RGPD art. 17, libre-service : une session et confirmation: 'DELETE_MY_ACCOUNT').
// PR 2, lot 6 (SPEC § 2.10, RG-26) : le compte d'un gestionnaire AJ Signalement est géré par son employeur, le cabinet
// (responsable de traitement ; VitFix est sous-traitant, art. 28). Pour un compte gestionnaire_signalement, ou un compte
// relié à une fiche, la route REFUSE avant toute suppression : 403 demande_au_cabinet ; la fiche est seulement datée
// (effacement_demande_le), la demande journalisée (gestionnaire.effacement_demande, acteur : lui-même) et le super admin
// prévenu sans nom ni adresse. Aucun autre compte ne change de parcours, y compris avant les migrations 20261111 et
// 20261112 (table ou colonne absente : la suppression suit son cours, repli journalisé une fois).
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

const { baseQr, simulerProductionAvant1111Qr, simulerProductionAvant1112Qr } = await import('../helpers/aj-signalement-base')
const { messagesEnvoyesQr, reinitialiserSimulQr, requeteQr, simulQr, texteJournalServeurQr } = await import('../helpers/aj-signalement-routes')
const { authQr, reinitialiserAuthQr } = await import('../helpers/aj-signalement-invitation')
const A = await import('../helpers/aj-signalement-acces')
const { DELETE } = await import('@/app/api/user/delete-account/route')
const { reinitialiserReplisQr } = await import('@/lib/aj-signalement/serveur')

const CLIENT = { id: '0c000000-0000-4000-8000-000000000001', email: 'client@exemple.test', app_metadata: { role: 'client' } }
const MESSAGE = 'Votre compte AJ Signalement est géré par votre employeur : adressez votre demande au cabinet.'

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

  it('compte client sans fiche : suppression complète (tables puis compte), 200', async () => {
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
