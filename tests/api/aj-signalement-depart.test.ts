// tests/api/aj-signalement-depart.test.ts
//
// PR 2, lot 6 (SPEC § 2.6, plan § 2.6) : le compte VitFix d'un gestionnaire suit sa fiche.
//   - départ (P1-R14) : la fiche est désactivée PUIS le compte relié est banni (ban_duration 876000h), la date de blocage
//     posée et journalisée ; le rôle est GARDÉ ; un bannissement impossible ne défait pas le départ : 207
//     connexion_non_bloquee, et « Bloquer la connexion » (P2-R6) le relance, sans doublon (idempotent) ;
//   - à la requête suivante du gestionnaire : 403 acces_retire (fiche relue à chaque appel) ;
//   - réactivation (P1-R11 actif: true) : compte débloqué (ban_duration none), date effacée, journal
//     gestionnaire.modifie [connexion_bloquee_le] ; échec → 207 connexion_non_debloquee, relance par le même bouton ;
//   - effacement (P1-R11 pseudonymiser) : pseudonymisation de la PR 1 PUIS suppression du compte (deleteUser) ; échec →
//     207 compte_non_supprime, relance par le même bouton ;
//   - sans la migration 20261112 : départ, réactivation et effacement de la PR 1, AUCUN appel à l'authentification.
// Données fictives (tests/helpers/aj-signalement-acces.ts) ; comptes simulés (tests/helpers/aj-signalement-invitation.ts).

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/supabase-server', async () => ({ supabaseAdmin: (await import('../helpers/aj-signalement-invitation')).clientInvitationQr }))
vi.mock('@/lib/supabase-server-component', async () => (await import('../helpers/aj-signalement-routes')).mockCookies())
vi.mock('@/lib/auth-helpers', async () => (await import('../helpers/aj-signalement-routes')).mockAuth())
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/aj-signalement-routes')).mockLimites())
vi.mock('@/lib/email', async () => (await import('../helpers/aj-signalement-routes')).mockEmail())
vi.mock('@/lib/logger', async () => (await import('../helpers/aj-signalement-routes')).mockLogger())

const { baseQr, simulerProductionAvant1112Qr } = await import('../helpers/aj-signalement-base')
const { ADMIN_QR, contexteQr, reinitialiserSimulQr, requeteQr, simulQr, texteJournalServeurQr } = await import('../helpers/aj-signalement-routes')
const { authQr, ecrituresAuthQr, reinitialiserAuthQr } = await import('../helpers/aj-signalement-invitation')
const A = await import('../helpers/aj-signalement-acces')
const { POST: DEPART } = await import('@/app/api/aj-signalement/gestionnaires/[id]/depart/route')
const { POST: BLOQUER } = await import('@/app/api/aj-signalement/gestionnaires/[id]/bloquer/route')
const { PATCH: MODIFIER_FICHE } = await import('@/app/api/aj-signalement/gestionnaires/[id]/route')
const { GET: MOI } = await import('@/app/api/aj-signalement/moi/route')
const { MIGRATION_ACCES_QR, reinitialiserReplisQr } = await import('@/lib/aj-signalement/serveur')

const BILAN = { deplacees: 0, laisseesSansGestionnaire: 1, adressesRetirees: 0 }
const DATE_BLOCAGE = '2026-11-10T08:00:00+00:00'

/** Corps SQL de signalements_qr_desactiver_gestionnaire (20261111), réduit à ce que la route observe. */
function simulerDesactivation(apres?: () => void): void {
  baseQr.etat.fonctions.signalements_qr_desactiver_gestionnaire = (a) => {
    const f = A.ficheSimuleeQr(String(a.p_id))
    Object.assign(f, { actif: false, desactive_le: new Date().toISOString() })
    baseQr.etat.tables.signalements_qr_attributions = baseQr.table('signalements_qr_attributions').filter((x) => x.gestionnaire_id !== a.p_id)
    apres?.()
    return { data: BILAN }
  }
}

function simulerReactivation(): void {
  baseQr.etat.fonctions.signalements_qr_reactiver_gestionnaire = (a) => {
    Object.assign(A.ficheSimuleeQr(String(a.p_id)), { actif: true, desactive_le: null })
    return { data: true }
  }
}

const compteSimule = (id: string, email: string, identifiant: string) => ({
  id, email, app_metadata: { role: 'gestionnaire_signalement', aj_signalement_cabinet: identifiant }, user_metadata: {},
})

beforeEach(() => {
  reinitialiserSimulQr()
  reinitialiserReplisQr()
  reinitialiserAuthQr()
  baseQr.reinitialiser()
  vi.unstubAllEnvs()
  vi.stubEnv('ADMIN_EMAIL', 'admin@exemple.test')
  vi.stubEnv('ADMIN_EMAIL_2', '')
  A.poserJeuAccesQr()
  authQr.comptes = [compteSimule(A.U1, A.EMAIL_G1, 'cabinet-exemple'), compteSimule(A.U2, A.EMAIL_G2, 'cabinet-exemple')]
  simulerDesactivation()
  simulerReactivation()
})

const partir = (id = A.G1, successions: unknown[] = [{ coproprieteId: A.C1, versGestionnaireId: null }]) =>
  DEPART(requeteQr(`/api/aj-signalement/gestionnaires/${id}/depart`, 'POST', { successions }), contexteQr(id))
const bloquer = (id = A.G1, corps?: unknown) => BLOQUER(requeteQr(`/api/aj-signalement/gestionnaires/${id}/bloquer`, 'POST', corps), contexteQr(id))
const modifier = (id: string, action: unknown) => MODIFIER_FICHE(requeteQr(`/api/aj-signalement/gestionnaires/${id}`, 'PATCH', action), contexteQr(id))

const bannissements = () => authQr.appels.filter((a) => a.methode === 'updateUserById')
const journal = (action: string) => baseQr.table('signalements_qr_journal').filter((l) => l.action === action)
const avertissementsAcces = () => simulQr.logger.warn.mock.calls.filter((c) => String(c[0]).includes('12/11/2026'))

describe('départ d’un gestionnaire au compte relié (avec la 20261112)', () => {
  it('fiche désactivée PUIS compte banni (876000h), date posée, journal ; rôle gardé ; 200 avec connexionBloquee', async () => {
    const res = await partir()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ...BILAN, connexionBloquee: true })
    // L'ordre : la désactivation (fonction SQL) avant le bannissement.
    expect(baseQr.etat.appelsRpc.map((a) => a.nom)).toEqual(['signalements_qr_desactiver_gestionnaire'])
    expect(bannissements()).toEqual([{ methode: 'updateUserById', args: [A.U1, { ban_duration: '876000h' }] }])
    const compte = authQr.comptes.find((c) => c.id === A.U1)
    expect(compte?.app_metadata).toEqual({ role: 'gestionnaire_signalement', aj_signalement_cabinet: 'cabinet-exemple' })
    expect(compte?.ban_duration).toBe('876000h')
    expect(A.ficheSimuleeQr(A.G1)).toMatchObject({ actif: false, connexion_bloquee_le: expect.any(String), user_id: A.U1 })
    expect(journal('gestionnaire.connexion_bloquee')).toEqual([
      expect.objectContaining({ cabinet_id: A.CAB, acteur_id: ADMIN_QR.id, acteur_profil: 'super_admin', gestionnaire_id: A.G1 }),
    ])
    expect(ecrituresAuthQr().map((a) => a.methode)).toEqual(['updateUserById'])
  })

  it('à la requête suivante, le gestionnaire parti reçoit 403 acces_retire', async () => {
    A.connecterQr(A.COMPTE_G1)
    expect((await MOI(requeteQr('/api/aj-signalement/moi'))).status).toBe(200)
    A.connecterQr({ ...ADMIN_QR })
    await partir()
    A.connecterQr(A.COMPTE_G1)
    const res = await MOI(requeteQr('/api/aj-signalement/moi'))
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'acces_retire' })
  })

  it('bannissement refusé : 207 connexion_non_bloquee, départ acquis, aucune date ni ligne de blocage, journal serveur sans adresse', async () => {
    authQr.echecs.updateUserById = 'Service indisponible'
    const res = await partir()
    expect(res.status).toBe(207)
    expect(await res.json()).toEqual({ ...BILAN, error: 'connexion_non_bloquee' })
    expect(A.ficheSimuleeQr(A.G1)).toMatchObject({ actif: false, connexion_bloquee_le: null })
    expect(journal('gestionnaire.connexion_bloquee')).toEqual([])
    expect(simulQr.logger.error).toHaveBeenCalled()
    expect(texteJournalServeurQr()).not.toContain(A.EMAIL_G1)
    expect(texteJournalServeurQr()).not.toContain('Service indisponible')
  })

  it('bannissement interrompu (exception) : 207 connexion_non_bloquee', async () => {
    authQr.avant.updateUserById = () => { throw new TypeError('fetch failed') }
    const res = await partir()
    expect(res.status).toBe(207)
    expect((await res.json()).error).toBe('connexion_non_bloquee')
  })

  it('compte banni mais date non enregistrée : 207 (la relance la pose)', async () => {
    authQr.avant.updateUserById = () => { baseQr.etat.erreursPonctuelles.signalements_qr_gestionnaires = { code: 'XX000', message: 'panne' } }
    const res = await partir()
    expect(res.status).toBe(207)
    expect((await res.json()).error).toBe('connexion_non_bloquee')
    expect(journal('gestionnaire.connexion_bloquee')).toEqual([])
  })

  it('compte de la fiche illisible (panne) : 207 connexion_non_bloquee, aucun appel à l’authentification', async () => {
    simulerDesactivation(() => { baseQr.etat.erreursPonctuelles.signalements_qr_gestionnaires = { code: 'XX000', message: 'panne' } })
    const res = await partir()
    expect(res.status).toBe(207)
    expect((await res.json()).error).toBe('connexion_non_bloquee')
    expect(authQr.appels).toEqual([])
  })

  it('fiche sans compte relié : réponse de la PR 1 (aucun champ de plus), aucun appel à l’authentification', async () => {
    Object.assign(A.ficheSimuleeQr(A.G1), { user_id: null, acces_ouvert_le: null })
    const res = await partir()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(BILAN)
    expect(authQr.appels).toEqual([])
  })

  it('refus de la fonction de départ (succession manquante) : aucun appel à l’authentification', async () => {
    baseQr.etat.fonctions.signalements_qr_desactiver_gestionnaire = () => ({ error: { code: 'P0001', message: 'a_reverifier' } })
    const res = await partir()
    expect(res.status).toBe(409)
    expect(authQr.appels).toEqual([])
  })
})

describe('« Bloquer la connexion » (P2-R6, POST gestionnaires/[id]/bloquer)', () => {
  beforeEach(() => Object.assign(A.ficheSimuleeQr(A.G1), { actif: false, desactive_le: '2026-11-10T07:00:00+00:00' }))

  it('relance après un échec : 200, compte banni, date posée, une ligne de journal', async () => {
    const res = await bloquer()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ connexionBloquee: true })
    expect(bannissements()).toEqual([{ methode: 'updateUserById', args: [A.U1, { ban_duration: '876000h' }] }])
    expect(A.ficheSimuleeQr(A.G1).connexion_bloquee_le).toEqual(expect.any(String))
    expect(journal('gestionnaire.connexion_bloquee')).toHaveLength(1)
  })

  it('idempotente : déjà bloquée, le compte est rebanni sans nouvelle date ni nouvelle ligne', async () => {
    A.ficheSimuleeQr(A.G1).connexion_bloquee_le = DATE_BLOCAGE
    const res = await bloquer()
    expect(res.status).toBe(200)
    expect(bannissements()).toHaveLength(1)
    expect(A.ficheSimuleeQr(A.G1).connexion_bloquee_le).toBe(DATE_BLOCAGE)
    expect(journal('gestionnaire.connexion_bloquee')).toEqual([])
    expect(baseQr.ecrituresDe('signalements_qr_gestionnaires')).toEqual([])
  })

  it('deux appels de suite : une seule ligne de journal, une seule date', async () => {
    await bloquer()
    const premiere = A.ficheSimuleeQr(A.G1).connexion_bloquee_le
    await bloquer()
    expect(A.ficheSimuleeQr(A.G1).connexion_bloquee_le).toBe(premiere)
    expect(journal('gestionnaire.connexion_bloquee')).toHaveLength(1)
    expect(bannissements()).toHaveLength(2)
  })

  it('fiche active : 409 fiche_active (faire d’abord le départ), aucun appel à l’authentification', async () => {
    A.ficheSimuleeQr(A.G1).actif = true
    const res = await bloquer()
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'fiche_active' })
    expect(authQr.appels).toEqual([])
  })

  it('fiche sans compte relié : 409 a_reverifier, aucun appel à l’authentification', async () => {
    A.ficheSimuleeQr(A.G1).user_id = null
    const res = await bloquer()
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'a_reverifier' })
    expect(authQr.appels).toEqual([])
  })

  it('bannissement refusé : 207 connexion_non_bloquee, rien d’écrit', async () => {
    authQr.echecs.updateUserById = 'Service indisponible'
    const res = await bloquer()
    expect(res.status).toBe(207)
    expect(await res.json()).toEqual({ error: 'connexion_non_bloquee' })
    expect(A.ficheSimuleeQr(A.G1).connexion_bloquee_le).toBeNull()
    expect(journal('gestionnaire.connexion_bloquee')).toEqual([])
  })

  it('fiche inconnue ou identifiant mal formé : 404 ; corps non vide : 400 ; aucun appel à l’authentification', async () => {
    expect((await bloquer('a0000000-0000-4000-8000-0000000000ff')).status).toBe(404)
    expect((await bloquer('pas-un-uuid')).status).toBe(404)
    expect((await bloquer(A.G1, { userId: A.U2 })).status).toBe(400)
    expect(authQr.appels).toEqual([])
  })

  it('limites : par IP puis par compte ; gestionnaire connecté : 403 interdit ; sans session : 401', async () => {
    await bloquer()
    expect(simulQr.limites).toEqual(['qr_bloquer_203.0.113.7', `qr_bloquer_${ADMIN_QR.id}`])
    simulQr.refuser = ['qr_bloquer_']
    expect((await bloquer()).status).toBe(429)
    simulQr.refuser = []
    A.connecterQr(A.COMPTE_G2)
    const g = await bloquer()
    expect(g.status).toBe(403)
    expect(await g.json()).toEqual({ error: 'interdit' })
    simulQr.user = null
    expect((await bloquer()).status).toBe(401)
    expect(bannissements()).toHaveLength(1)
  })

  it('sans la 20261112 : 503 base_absente, aucun appel à l’authentification, journalisé une fois', async () => {
    simulerProductionAvant1112Qr()
    for (let i = 0; i < 2; i += 1) {
      const res = await bloquer()
      expect(res.status).toBe(503)
      expect(await res.json()).toEqual({ error: 'base_absente' })
    }
    expect(authQr.appels).toEqual([])
    expect(avertissementsAcces()).toHaveLength(1)
    expect(avertissementsAcces()[0][1]).toMatchObject({ migration: MIGRATION_ACCES_QR, code: '42703' })
  })
})

describe('réactivation (P1-R11 actif: true)', () => {
  beforeEach(() => Object.assign(A.ficheSimuleeQr(A.G1), { actif: false, desactive_le: '2026-11-10T07:00:00+00:00', connexion_bloquee_le: DATE_BLOCAGE }))

  it('fiche réactivée PUIS compte débloqué (ban_duration none), date effacée, journal gestionnaire.modifie [connexion_bloquee_le]', async () => {
    const res = await modifier(A.G1, { actif: true })
    expect(res.status).toBe(200)
    expect((await res.json()).gestionnaire).toMatchObject({ id: A.G1, connexionBloquee: false, compteRelie: true })
    expect(bannissements()).toEqual([{ methode: 'updateUserById', args: [A.U1, { ban_duration: 'none' }] }])
    expect(A.ficheSimuleeQr(A.G1)).toMatchObject({ actif: true, connexion_bloquee_le: null, user_id: A.U1 })
    expect(journal('gestionnaire.modifie')).toEqual([
      expect.objectContaining({ gestionnaire_id: A.G1, acteur_id: ADMIN_QR.id, champs: ['connexion_bloquee_le'] }),
    ])
    // Le compte relié reste relié : il se reconnecte avec son mot de passe (ou « Mot de passe oublié »).
    A.connecterQr(A.COMPTE_G1)
    expect((await MOI(requeteQr('/api/aj-signalement/moi'))).status).toBe(200)
  })

  it('déblocage refusé : 207 connexion_non_debloquee, fiche réactivée mais toujours bloquée ; relance par le même bouton → 200', async () => {
    authQr.echecs.updateUserById = 'Service indisponible'
    const res = await modifier(A.G1, { actif: true })
    expect(res.status).toBe(207)
    const corps = await res.json()
    expect(corps.error).toBe('connexion_non_debloquee')
    expect(corps.gestionnaire).toMatchObject({ id: A.G1, connexionBloquee: true })
    expect(A.ficheSimuleeQr(A.G1)).toMatchObject({ actif: true, connexion_bloquee_le: DATE_BLOCAGE })
    A.connecterQr(A.COMPTE_G1)
    expect((await MOI(requeteQr('/api/aj-signalement/moi'))).status).toBe(403)

    A.connecterQr({ ...ADMIN_QR })
    delete authQr.echecs.updateUserById
    const relance = await modifier(A.G1, { actif: true })
    expect(relance.status).toBe(200)
    expect(A.ficheSimuleeQr(A.G1).connexion_bloquee_le).toBeNull()
    expect(baseQr.etat.appelsRpc.filter((a) => a.nom === 'signalements_qr_reactiver_gestionnaire')).toHaveLength(1)
  })

  it('fiche déjà active et non bloquée : aucun appel à l’authentification', async () => {
    Object.assign(A.ficheSimuleeQr(A.G1), { actif: true, connexion_bloquee_le: null })
    expect((await modifier(A.G1, { actif: true })).status).toBe(200)
    expect(authQr.appels).toEqual([])
  })

  it('fiche sans compte relié : comme en PR 1, aucun appel à l’authentification', async () => {
    Object.assign(A.ficheSimuleeQr(A.G1), { user_id: null, connexion_bloquee_le: null })
    expect((await modifier(A.G1, { actif: true })).status).toBe(200)
    expect(authQr.appels).toEqual([])
  })
})

describe('effacement (P1-R11 pseudonymiser) : la fiche, puis le compte', () => {
  beforeEach(() => Object.assign(A.ficheSimuleeQr(A.G1), { actif: false, desactive_le: '2026-11-10T07:00:00+00:00', connexion_bloquee_le: DATE_BLOCAGE }))

  it('pseudonymisation PUIS suppression du compte (deleteUser) ; 200', async () => {
    const res = await modifier(A.G1, { pseudonymiser: true })
    expect(res.status).toBe(200)
    expect(A.ficheSimuleeQr(A.G1)).toMatchObject({ nom: null, email: null, pseudonymise_le: expect.any(String) })
    expect(authQr.appels).toEqual([{ methode: 'deleteUser', args: [A.U1] }])
    expect(authQr.comptes.map((c) => c.id)).toEqual([A.U2])
    expect(journal('gestionnaire.pseudonymise')).toHaveLength(1)
  })

  it('suppression refusée : 207 compte_non_supprime ; relance par le même bouton → deleteUser rejoué, 200', async () => {
    authQr.echecs.deleteUser = 'Service indisponible'
    const res = await modifier(A.G1, { pseudonymiser: true })
    expect(res.status).toBe(207)
    expect((await res.json()).error).toBe('compte_non_supprime')
    expect(A.ficheSimuleeQr(A.G1).pseudonymise_le).toEqual(expect.any(String))
    delete authQr.echecs.deleteUser
    const relance = await modifier(A.G1, { pseudonymiser: true })
    expect(relance.status).toBe(200)
    expect(authQr.appels.filter((a) => a.methode === 'deleteUser')).toHaveLength(2)
    expect(journal('gestionnaire.pseudonymise')).toHaveLength(1)
    expect(texteJournalServeurQr()).not.toContain(A.EMAIL_G1)
  })

  it('fiche active : 409 fiche_active, rien d’effacé, aucun appel à l’authentification', async () => {
    A.ficheSimuleeQr(A.G1).actif = true
    expect((await modifier(A.G1, { pseudonymiser: true })).status).toBe(409)
    expect(authQr.appels).toEqual([])
  })
})

describe('sans la migration 20261112 : départ, réactivation et effacement de la PR 1, sans appel à l’authentification', () => {
  beforeEach(() => simulerProductionAvant1112Qr())

  it('départ : réponse de la PR 1 exactement, repli journalisé une fois', async () => {
    for (const id of [A.G1, A.G2]) {
      const res = await partir(id, [])
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual(BILAN)
    }
    expect(authQr.appels).toEqual([])
    expect(avertissementsAcces()).toHaveLength(1)
  })

  it('réactivation et effacement : 200, aucun appel à l’authentification', async () => {
    A.ficheSimuleeQr(A.G1).actif = false
    expect((await modifier(A.G1, { actif: true })).status).toBe(200)
    A.ficheSimuleeQr(A.G2).actif = false
    expect((await modifier(A.G2, { pseudonymiser: true })).status).toBe(200)
    expect(authQr.appels).toEqual([])
  })
})
