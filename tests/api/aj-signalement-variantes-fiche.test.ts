// tests/api/aj-signalement-variantes-fiche.test.ts
//
// PR 2, contrôle 2, constat C1 : une VARIANTE de l'adresse d'un gestionnaire (même boîte sous une étiquette « + », ou
// même partie locale sur un AUTRE domaine de son cabinet) restée dans les saisies d'une copropriété (import, saisie
// antérieure à la fiche, départ fait avant la 20261112) ne doit jamais recevoir les signalements de la personne partie.
//   - effacement RGPD (PATCH /gestionnaires/[id] { pseudonymiser }) : signalements_qr_pseudonymiser_gestionnaire
//     retire ces saisies de TOUTES les copropriétés, dans la même transaction et AVANT d'effacer l'adresse (après, plus
//     rien ne les exclurait : l'exclusion de l'envoi porte sur l'adresse de la fiche) ; journal comme au départ ;
//   - fonction absente (20261112 non appliquée) : la pseudonymisation de la PR 1, et le repli est journalisé ;
//   - toute autre erreur : RIEN n'est effacé (jamais l'adresse effacée sans la purge) ;
//   - dépôt d'un signalement ensuite : aucun message vers une variante.
// Fonctions SQL simulées par tests/helpers/aj-signalement-variantes.ts (règle : la jumelle estAdresseDeFicheQr). Le SQL
// lui-même : tests/migrations/signalements_qr_acces_gestionnaires.test.ts et l'essai PGlite. Données fictives.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/supabase-server', async () => ({ supabaseAdmin: (await import('../helpers/aj-signalement-invitation')).clientInvitationQr }))
vi.mock('@/lib/supabase-server-component', async () => (await import('../helpers/aj-signalement-routes')).mockCookies())
vi.mock('@/lib/auth-helpers', async () => (await import('../helpers/aj-signalement-routes')).mockAuth())
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/aj-signalement-routes')).mockLimites())
vi.mock('@/lib/email', async () => (await import('../helpers/aj-signalement-routes')).mockEmail())
vi.mock('@/lib/logger', async () => (await import('../helpers/aj-signalement-routes')).mockLogger())

const { baseQr, simulerProductionAvant1112Qr } = await import('../helpers/aj-signalement-base')
const { ADMIN_QR, contexteQr, messagesEnvoyesQr, reinitialiserSimulQr, requeteQr, simulQr, texteJournalServeurQr } = await import('../helpers/aj-signalement-routes')
const { authQr, reinitialiserAuthQr } = await import('../helpers/aj-signalement-invitation')
const A = await import('../helpers/aj-signalement-acces')
const V = await import('../helpers/aj-signalement-variantes')
const { PATCH: MODIFIER_FICHE } = await import('@/app/api/aj-signalement/gestionnaires/[id]/route')
const { POST: DEPART } = await import('@/app/api/aj-signalement/gestionnaires/[id]/depart/route')
const { POST: DEPOSER } = await import('@/app/api/aj-signalement/signalements/route')
const { reinitialiserReplisQr } = await import('@/lib/aj-signalement/serveur')

/** Variantes de l'adresse de G1 (marie.exemple@exemple.test) : étiquette « + », autre domaine du cabinet (avec étiquette). */
const PLUS = 'marie.exemple+suivi@exemple.test'
const AUTRE_DOMAINE = 'marie.exemple@exemple-bis.test'
const AUTRE_DOMAINE_PLUS = 'Marie.Exemple+CS@Exemple-Bis.test'
/** Même partie locale sur le domaine d'un AUTRE cabinet : une autre personne, jamais retirée. */
const AUTRE_CABINET = 'marie.exemple@autre-exemple.test'
const CS = 'cs-une@externe.test'

const copro = (id: string) => baseQr.table('signalements_qr_coproprietes').find((c) => c.id === id)!
const journal = (action: string) => baseQr.table('signalements_qr_journal').filter((l) => l.action === action)
const effacer = (id = A.G1) => MODIFIER_FICHE(requeteQr(`/api/aj-signalement/gestionnaires/${id}`, 'PATCH', { pseudonymiser: true }), contexteQr(id))
const partir = (id = A.G1) =>
  DEPART(requeteQr(`/api/aj-signalement/gestionnaires/${id}/depart`, 'POST', { successions: [{ coproprieteId: A.C1, versGestionnaireId: null }] }), contexteQr(id))
const CORPS_DEPOT = {
  prenom: 'Prénom', nom: 'Déclarant', telephone: '06 00 00 00 00',
  email: 'declarant@exemple.test', batiment: 'A', etage: '2', numLot: '7', estPartieCommune: false, zoneSignalee: '', typeIntervention: 'Plomberie',
  description: 'Fuite d’eau au plafond de la cuisine', priorite: 'normale', langue: 'fr', qualiteDeclarant: 'locataire',
}
const deposer = (jeton: string) => DEPOSER(requeteQr('/api/aj-signalement/signalements', 'POST', { ...CORPS_DEPOT, jeton }))
const destinatairesDuDepot = () => messagesEnvoyesQr().filter((m) => m.subject.startsWith('[AJ Signalement]')).map((m) => String(m.to))
const avertissements1112 = () => simulQr.logger.warn.mock.calls.filter((c) => String(c[0]).includes('12/11/2026'))

beforeEach(() => {
  reinitialiserSimulQr()
  simulQr.user = { ...ADMIN_QR }
  reinitialiserReplisQr()
  reinitialiserAuthQr()
  baseQr.reinitialiser()
  vi.unstubAllEnvs()
  vi.stubEnv('ADMIN_EMAIL', 'admin@exemple.test')
  vi.stubEnv('ADMIN_EMAIL_2', '')
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://vitfix.io')
  A.poserJeuAccesQr()
  // Le cabinet de G1 a deux domaines (ancien et nouveau nom) : sa messagerie livre les deux à la même boîte.
  baseQr.table('signalements_qr_domaines_autorises').push({ cabinet_id: A.CAB, domaine: 'exemple-bis.test' })
  authQr.comptes = [{ id: A.U1, email: A.EMAIL_G1, app_metadata: { role: 'gestionnaire_signalement', aj_signalement_cabinet: 'cabinet-exemple' }, user_metadata: {} }]
  baseQr.etat.tables.signalements_qr_invitations = [
    { id: 'e0000000-0000-4000-8000-000000000001', gestionnaire_id: A.G1, objet: 'confirmation_adresse', email: A.EMAIL_G1, invite_token: null, created_at: '2026-11-05T09:00:00+00:00' },
  ]
  // Variantes héritées (import, saisie antérieure à la fiche) : dans une copropriété du cabinet ET d'un autre cabinet.
  copro(A.C1).emails_destinataires = [CS, PLUS, AUTRE_DOMAINE, AUTRE_CABINET]
  copro(A.C3).emails_destinataires = [AUTRE_DOMAINE_PLUS]
  V.simulerPseudonymisationQr()
  V.simulerDestinatairesQr()
})

describe('C1 — effacement RGPD : les variantes quittent les saisies AVANT que l’adresse ne disparaisse', () => {
  beforeEach(() => {
    // Départ fait AVANT la 20261112 (égalité exacte de la 20261111) : les variantes sont restées dans les saisies.
    V.simulerDepartQr('exacte')
  })

  it('départ (20261111) puis effacement (20261112) : fonction appelée, variantes « + » et autre domaine retirées partout, puis adresse effacée', async () => {
    expect((await partir()).status).toBe(200)
    expect(copro(A.C1).emails_destinataires).toEqual([CS, PLUS, AUTRE_DOMAINE, AUTRE_CABINET])
    const res = await effacer()
    expect(res.status).toBe(200)
    expect(baseQr.etat.appelsRpc.filter((a) => a.nom === 'signalements_qr_pseudonymiser_gestionnaire'))
      .toEqual([{ nom: 'signalements_qr_pseudonymiser_gestionnaire', args: { p_id: A.G1, p_acteur: ADMIN_QR.id } }])
    expect(copro(A.C1).emails_destinataires).toEqual([CS, AUTRE_CABINET])
    expect(copro(A.C3).emails_destinataires).toEqual([])
    expect(A.ficheSimuleeQr(A.G1)).toMatchObject({ nom: null, email: null, pseudonymise_le: expect.any(String) })
    // Une seule écriture de l'adresse : celle de la fonction (aucune mise à jour directe qui l'effacerait sans la purge ;
    // la seule mise à jour directe de la fiche est la date de blocage de la connexion, au départ).
    const ecritures = baseQr.ecrituresDe('signalements_qr_gestionnaires', 'update').map((e) => Object.keys(e.valeurs as object))
    expect(ecritures).toEqual([['connexion_bloquee_le']])
    // Journal comme au départ : une ligne par copropriété retouchée (son cabinet), puis la ligne de la PR 1.
    expect(journal('copropriete.modifiee').map((l) => [l.copropriete_id, l.cabinet_id, l.gestionnaire_id, l.details]))
      .toEqual([[A.C1, A.CAB, A.G1, { motif: 'depart' }], [A.C3, A.CAB_AUTRE, A.G1, { motif: 'depart' }]])
    expect(journal('gestionnaire.pseudonymise')).toHaveLength(1)
    expect(baseQr.table('signalements_qr_invitations').filter((i) => i.gestionnaire_id === A.G1)).toEqual([])
    expect(texteJournalServeurQr()).not.toContain('marie.exemple')
  })

  it('dépôt après l’effacement : aucun message vers une variante de la personne partie', async () => {
    await partir()
    expect((await effacer()).status).toBe(200)
    expect((await deposer(String(copro(A.C1).jeton))).status).toBe(200)
    expect(destinatairesDuDepot()).toEqual([CS, AUTRE_CABINET])
    expect((await deposer(String(copro(A.C3).jeton))).status).toBe(200)
    expect(destinatairesDuDepot().map((e) => e.toLowerCase())).not.toContain(AUTRE_DOMAINE_PLUS.toLowerCase())
    expect(JSON.stringify(messagesEnvoyesQr().map((m) => m.to))).not.toMatch(/marie\.exemple(\+[^@]*)?@exemple(-bis)?\.test/i)
  })

  it('relance (fiche déjà effacée) : la fonction n’est pas rappelée, une seule ligne gestionnaire.pseudonymise', async () => {
    await partir()
    expect((await effacer()).status).toBe(200)
    expect((await effacer()).status).toBe(200)
    expect(baseQr.etat.appelsRpc.filter((a) => a.nom === 'signalements_qr_pseudonymiser_gestionnaire')).toHaveLength(1)
    expect(journal('gestionnaire.pseudonymise')).toHaveLength(1)
  })

  it('erreur de la fonction (autre que son absence) : 500, RIEN n’est effacé (adresse, saisies, envois, journal)', async () => {
    await partir()
    baseQr.etat.fonctions.signalements_qr_pseudonymiser_gestionnaire = () => ({ error: { code: 'XX000', message: 'panne' } })
    const res = await effacer()
    expect(res.status).toBe(500)
    expect(A.ficheSimuleeQr(A.G1)).toMatchObject({ email: A.EMAIL_G1, nom: 'Marie Exemple', pseudonymise_le: null })
    expect(copro(A.C1).emails_destinataires).toEqual([CS, PLUS, AUTRE_DOMAINE, AUTRE_CABINET])
    expect(baseQr.table('signalements_qr_invitations').filter((i) => i.gestionnaire_id === A.G1)).toHaveLength(1)
    expect(journal('gestionnaire.pseudonymise')).toEqual([])
    expect(authQr.appels.filter((a) => a.methode === 'deleteUser')).toEqual([])
  })

  it('conflit concurrent (40P01) : 409 a_reverifier ; fiche réactivée entre-temps (a_reverifier) : 409, rien d’effacé', async () => {
    await partir()
    baseQr.etat.fonctions.signalements_qr_pseudonymiser_gestionnaire = () => ({ error: { code: '40P01', message: 'deadlock detected' } })
    const conflit = await effacer()
    expect(conflit.status).toBe(409)
    expect(await conflit.json()).toEqual({ error: 'a_reverifier' })
    baseQr.etat.fonctions.signalements_qr_pseudonymiser_gestionnaire = () => ({ error: { code: 'P0001', message: 'a_reverifier' } })
    expect((await effacer()).status).toBe(409)
    expect(A.ficheSimuleeQr(A.G1).email).toBe(A.EMAIL_G1)
  })
})

describe('C1 — fonction absente (20261112 non appliquée) : pseudonymisation de la PR 1, repli journalisé', () => {
  it('nom et e-mail effacés comme en PR 1 ; l’effacement sans purge des variantes est SIGNALÉ (migration du 12/11/2026)', async () => {
    simulerProductionAvant1112Qr()
    Object.assign(A.ficheSimuleeQr(A.G1), { actif: false, desactive_le: '2026-11-10T07:00:00+00:00' })
    const res = await effacer()
    expect(res.status).toBe(200)
    expect(A.ficheSimuleeQr(A.G1)).toMatchObject({ nom: null, email: null, pseudonymise_le: expect.any(String) })
    expect(journal('gestionnaire.pseudonymise')).toHaveLength(1)
    const repli = avertissements1112().filter((c) => String(c[0]).includes('pseudonymisation'))
    expect(repli).toHaveLength(1)
    expect(repli[0][1]).toMatchObject({ code: 'PGRST202' })
    expect(texteJournalServeurQr()).not.toContain('marie.exemple')
  })
})

describe('C1 — départ (corps de la 20261112) : variantes retirées dès le départ, aucun message ensuite', () => {
  it('départ puis dépôt : ni la sous-adresse « + » ni la partie locale sur l’autre domaine du cabinet ne reçoivent', async () => {
    V.simulerDepartQr('variantes')
    const res = await partir()
    expect(res.status).toBe(200)
    expect((await res.json()).adressesRetirees).toBe(2)
    expect(copro(A.C1).emails_destinataires).toEqual([CS, AUTRE_CABINET])
    expect(copro(A.C3).emails_destinataires).toEqual([])
    expect((await deposer(String(copro(A.C1).jeton))).status).toBe(200)
    expect(destinatairesDuDepot()).toEqual([CS, AUTRE_CABINET])
  })
})
