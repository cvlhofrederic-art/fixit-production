// tests/api/aj-signalement-invitation.test.ts
//
// Accès de chaque gestionnaire à l'espace de SON cabinet (PR 2, lot 3 ; SPEC § 2.3.2, plan § 2.2-2.3) :
//   POST /api/aj-signalement/gestionnaires/[id]/acces   P2-R1   super admin : envoi d'un accès (lien signé par e-mail)
//   POST /api/aj-signalement/gestionnaires/acces        P2-R1b  super admin : envoi groupé, fiche par fiche
//   POST /api/aj-signalement/invitation/lecture         P2-R2   PUBLIQUE : lecture SANS effet du lien
//   POST /api/aj-signalement/invitation                 P2-R3   PUBLIQUE : acceptation (compte professionnel)
//   POST /api/aj-signalement/invitation/refus           P2-R3b  PUBLIQUE : « Ce n'est pas moi »
// Lien vitfix.io/<identifiant>/invitation/#<jeton> (jeton APRÈS le « # ») ; corps { token, cabinet } comme la confirmation
// d'adresse ; le cabinet du chemin est comparé à celui de la fiche. Rôle gestionnaire_signalement et repère de routage
// fixés par le CODE ; un compte existant n'est jamais converti (refus neutre 409 compte_autre_espace) ; seul un compte
// qui porte déjà le rôle est rattaché. Contrôle après coup : 207 liaison_incomplete. Replis : sans la 20261112, 503 ; sans
// la 20261111, aucun lien n'existe (404). La signature est la vraie (lib/equipe) ; les fonctions SQL, l'auth et la liaison
// du trigger sont simulées (tests/helpers/aj-signalement-invitation.ts). Données fictives en @exemple.test.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/supabase-server', async () => ({ supabaseAdmin: (await import('../helpers/aj-signalement-invitation')).clientInvitationQr }))
vi.mock('@/lib/supabase-server-component', async () => (await import('../helpers/aj-signalement-routes')).mockCookies())
vi.mock('@/lib/auth-helpers', async () => (await import('../helpers/aj-signalement-routes')).mockAuth())
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/aj-signalement-routes')).mockLimites())
vi.mock('@/lib/email', async () => (await import('../helpers/aj-signalement-routes')).mockEmail())
vi.mock('@/lib/logger', async () => (await import('../helpers/aj-signalement-routes')).mockLogger())

const { baseQr, simulerProductionAvant1111Qr, simulerProductionAvant1112Qr } = await import('../helpers/aj-signalement-base')
type Ligne = import('../helpers/aj-signalement-base').Ligne
const { ADMIN_QR, contexteQr, messagesEnvoyesQr, reinitialiserSimulQr, requeteQr, simulQr, texteJournalServeurQr } = await import('../helpers/aj-signalement-routes')
const I = await import('../helpers/aj-signalement-invitation')
const { POST: ENVOYER } = await import('@/app/api/aj-signalement/gestionnaires/[id]/acces/route')
const { POST: ENVOYER_GROUPE } = await import('@/app/api/aj-signalement/gestionnaires/acces/route')
const { POST: LIRE } = await import('@/app/api/aj-signalement/invitation/lecture/route')
const { POST: ACCEPTER } = await import('@/app/api/aj-signalement/invitation/route')
const { POST: REFUSER } = await import('@/app/api/aj-signalement/invitation/refus/route')
const { nouvelleInvitation } = await import('@/lib/equipe/lien-invitation')
const { lireInvitationValide } = await import('@/lib/equipe/invitation-serveur')
const { MIGRATION_ACCES_QR, reinitialiserReplisQr } = await import('@/lib/aj-signalement/serveur')
const { ALERTE_ADRESSE_CONTESTEE_QR, ALERTE_LIAISON_INCOMPLETE_QR, ALERTE_REFUS_AUTRE_ESPACE_QR } = await import('@/lib/aj-signalement/email')

const CAB = 'ca000000-0000-4000-8000-000000000001'
const CAB_AUTRE = 'ca000000-0000-4000-8000-000000000002'
const G = 'a0000000-0000-4000-8000-000000000001'
const G2 = 'a0000000-0000-4000-8000-000000000002'
const G3 = 'a0000000-0000-4000-8000-000000000003'
const G4 = 'a0000000-0000-4000-8000-000000000004'
const INCONNU = 'a0000000-0000-4000-8000-0000000000ff'
const EMAIL = 'marie.exemple@exemple.test'
const MOT_DE_PASSE = 'Bonjour2026'
const COMPTE_EXISTANT = '0e000000-0000-4000-8000-0000000000e1'
const COMPTE_GESTIONNAIRE = { id: '0b000000-0000-4000-8000-000000000009', email: 'paul.collegue@exemple.test', app_metadata: { role: 'gestionnaire_signalement', aj_signalement_cabinet: 'cabinet-exemple' } }

const fiche = (sur: Ligne = {}): Ligne => ({
  id: G, cabinet_id: CAB, nom: 'Marie Exemple', email: EMAIL, actif: true, domaine_force: false, adresse_confirmee_le: null,
  adresse_contestee_le: null, pseudonymise_le: null, desactive_le: null, created_at: '2026-11-11T08:00:00+00:00',
  user_id: null, acces_ouvert_le: null, connexion_bloquee_le: null, effacement_demande_le: null, ...sur,
})
const laFiche = (id = G) => baseQr.table('signalements_qr_gestionnaires').find((f) => f.id === id) as Ligne
const envoi = (id: string) => baseQr.table('signalements_qr_invitations').find((e) => e.id === id) as Ligne

let jeton = ''
let idEnvoi = ''

/** Envoi d'accès posé directement (comme après P2-R1), jeton signé par lib/equipe. */
async function preparerEnvoi(sur: Ligne = {}, espace: 'aj_signalement' | 'syndic' = 'aj_signalement') {
  const inv = await nouvelleInvitation(espace, EMAIL, G)
  baseQr.table('signalements_qr_invitations').push({
    id: inv.id, gestionnaire_id: G, objet: 'acces', email: EMAIL, full_name: 'Marie Exemple', role: 'gestionnaire_signalement',
    invite_token: inv.invite_token, created_at: new Date().toISOString(), invite_sent_at: new Date().toISOString(), accepted_at: null,
    user_id: null, refus: null, envoye_par: ADMIN_QR.id, ...sur,
  })
  I.liaisonQr.vus.set(inv.id, sur.user_id ?? null)
  jeton = inv.jetonLien
  idEnvoi = inv.id
}

beforeEach(async () => {
  reinitialiserSimulQr()
  reinitialiserReplisQr()
  baseQr.reinitialiser()
  I.reinitialiserAuthQr()
  vi.unstubAllEnvs()
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'cle-de-service-de-test')
  vi.stubEnv('ADMIN_EMAIL', 'admin@exemple.test')
  vi.stubEnv('ADMIN_EMAIL_2', 'second@exemple.test')
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://vitfix.io')
  baseQr.etat.tables.signalements_qr_cabinets = [
    { id: CAB, nom: 'Cabinet Exemple', identifiant: 'cabinet-exemple', langue: 'fr' },
    { id: CAB_AUTRE, nom: 'Autre Cabinet', identifiant: 'autre-cabinet', langue: 'fr' },
  ]
  baseQr.etat.tables.signalements_qr_gestionnaires = [fiche()]
  I.simulerEnvoiAccesQr()
  I.simulerContestationAccesQr()
  I.reinitialiserLiaisonQr()
})

const envoyer = (id = G, corps?: unknown) => ENVOYER(requeteQr(`/api/aj-signalement/gestionnaires/${id}/acces`, 'POST', corps), contexteQr(id))
const envoyerGroupe = (corps: unknown) => ENVOYER_GROUPE(requeteQr('/api/aj-signalement/gestionnaires/acces', 'POST', corps))
const corpsLien = (sur: Record<string, unknown> = {}) => ({ token: jeton, cabinet: 'cabinet-exemple', ...sur })
const corpsAcceptation = (sur: Record<string, unknown> = {}) => ({ ...corpsLien(), password: MOT_DE_PASSE, politiqueLue: true, ...sur })
const lire = (c: unknown) => LIRE(requeteQr('/api/aj-signalement/invitation/lecture', 'POST', c))
const accepter = (c: unknown) => ACCEPTER(requeteQr('/api/aj-signalement/invitation', 'POST', c))
const refuser = (c: unknown) => REFUSER(requeteQr('/api/aj-signalement/invitation/refus', 'POST', c))

const jetonDuMessage = (html: string): string => {
  const m = /\/cabinet-exemple\/invitation\/#([a-f0-9]{48}\.[a-f0-9]{64})"/.exec(html)
  if (!m) throw new Error('lien absent')
  return m[1]
}
const lignesJournal = (action: string) => baseQr.table('signalements_qr_journal').filter((l) => l.action === action)
const avertissementsAcces = () => simulQr.logger.warn.mock.calls.filter((c) => String(c[0]).includes('12/11/2026'))

// ── P2-R1 : envoi d'un accès ─────────────────────────────────────────────────

describe('envoi d’un accès (P2-R1, super admin)', () => {
  it('fonction SQL avec l’envoi signé AVANT, un e-mail au seul gestionnaire, lien /<identifiant>/invitation/#<jeton> ; ni lien ni jeton dans la réponse', async () => {
    const res = await envoyer()
    expect(res.status).toBe(200)
    const corps = await res.json()
    expect(corps).toEqual({ emailEnvoye: true })

    const appel = baseQr.etat.appelsRpc.find((a) => a.nom === 'signalements_qr_envoyer_acces')
    const inv = appel?.args.p_invitation as Record<string, unknown>
    expect(appel?.args).toEqual({ p_gestionnaire: G, p_invitation: { id: expect.stringMatching(/^[0-9a-f-]{36}$/), invite_token: expect.stringMatching(/^[a-f0-9]{48}$/), email: EMAIL }, p_acteur: ADMIN_QR.id })

    const messages = messagesEnvoyesQr()
    expect(messages).toHaveLength(1)
    expect(messages[0].to).toBe(EMAIL)
    expect(messages[0].subject).toBe('AJ Signalement — Cabinet Exemple : ouvrez votre accès')
    expect(messages[0].html).toContain('https://vitfix.io/cabinet-exemple/invitation/#')
    expect(messages[0].html).toContain('Marie E.')
    // Le jeton du lien est celui de l'envoi réellement inséré (objet « acces »), et d'aucun autre espace.
    const lien = jetonDuMessage(messages[0].html)
    const lecture = await lireInvitationValide('aj_signalement', lien)
    expect(lecture.ok).toBe(true)
    if (lecture.ok) expect(lecture.invite).toMatchObject({ id: inv.id, equipe_id: G, objet: 'acces' })
    expect((await lireInvitationValide('syndic', lien)).ok).toBe(false)

    const texte = JSON.stringify(corps)
    expect(texte).not.toContain(String(inv.invite_token))
    expect(texte).not.toContain(lien)
    // Après l'e-mail : date d'envoi, puis journal (acteur : le super admin).
    expect(envoi(String(inv.id)).invite_sent_at).toEqual(expect.any(String))
    expect(lignesJournal('gestionnaire.acces_envoye')).toEqual([
      expect.objectContaining({ cabinet_id: CAB, acteur_id: ADMIN_QR.id, acteur_profil: 'super_admin', gestionnaire_id: G }),
    ])
    expect(texteJournalServeurQr()).not.toMatch(/marie|exemple\.test/i)
  })

  it('adresse pas encore confirmée : l’accès s’ouvre quand même (l’acceptation prouve la boîte, point 7.4)', async () => {
    expect(laFiche().adresse_confirmee_le).toBeNull()
    expect((await envoyer()).status).toBe(200)
  })

  it('e-mail refusé par le service : 200 { emailEnvoye: false }, envoi gardé sans date d’envoi, aucun journal', async () => {
    simulQr.resultatsLots = [{ sent: 0, failed: 1, errors: ['refus'] }]
    const res = await envoyer()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ emailEnvoye: false })
    const envois = baseQr.table('signalements_qr_invitations')
    expect(envois).toHaveLength(1)
    expect(envois[0].invite_sent_at).toBeNull()
    expect(lignesJournal('gestionnaire.acces_envoye')).toEqual([])
    expect(texteJournalServeurQr()).not.toContain('refus')
  })

  it('un nouvel envoi rend le lien précédent inutilisable (404) ; le dernier reste lisible', async () => {
    await envoyer()
    const premier = jetonDuMessage(messagesEnvoyesQr()[0].html)
    await envoyer()
    const second = jetonDuMessage(messagesEnvoyesQr()[1].html)
    expect((await lire({ token: premier, cabinet: 'cabinet-exemple' })).status).toBe(404)
    expect((await lire({ token: second, cabinet: 'cabinet-exemple' })).status).toBe(200)
  })

  it.each([
    ['ADMIN_EMAIL', 'ADMIN_EMAIL', 'admin@exemple.test'],
    ['ADMIN_EMAIL_2, écrite en majuscules dans la configuration', 'ADMIN_EMAIL_2', ' Second@Exemple.TEST '],
  ])('adresse de l’administrateur (%s) : 409 adresse_reservee, aucune fonction, aucun e-mail', async (_cas, variable, valeur) => {
    vi.stubEnv(variable, valeur)
    Object.assign(laFiche(), { email: valeur.trim().toLowerCase() })
    const res = await envoyer()
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'adresse_reservee' })
    expect(baseQr.etat.appelsRpc).toEqual([])
    expect(messagesEnvoyesQr()).toEqual([])
  })

  it.each([
    ['compte déjà relié', { user_id: COMPTE_EXISTANT, acces_ouvert_le: '2026-11-11T09:00:00+00:00' }, 'deja_ouvert'],
    ['adresse contestée', { adresse_contestee_le: '2026-11-11T09:00:00+00:00' }, 'adresse_contestee'],
    ['fiche désactivée', { actif: false }, 'a_reverifier'],
    ['fiche pseudonymisée', { actif: false, email: null, nom: null, pseudonymise_le: '2026-11-11T09:00:00+00:00' }, 'a_reverifier'],
  ])('%s : 409 %s, aucun e-mail, aucun envoi', async (_cas, etat, code) => {
    Object.assign(laFiche(), etat)
    const res = await envoyer()
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: code })
    expect(messagesEnvoyesQr()).toEqual([])
    expect(baseQr.table('signalements_qr_invitations')).toEqual([])
  })

  it('fiche inconnue ou id mal formé : 404 ; corps non vide : 400', async () => {
    expect((await envoyer(INCONNU)).status).toBe(404)
    expect((await envoyer('pas-un-uuid')).status).toBe(404)
    expect((await envoyer(G, { email: 'autre@exemple.test' })).status).toBe(400)
    expect(baseQr.etat.appelsRpc).toEqual([])
  })

  it('super admin seul : sans session 401 ; compte gestionnaire 403 interdit (sans lire sa fiche)', async () => {
    simulQr.user = null
    expect((await envoyer()).status).toBe(401)
    simulQr.user = COMPTE_GESTIONNAIRE
    const res = await envoyer()
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'interdit' })
    expect(baseQr.etat.appelsRpc).toEqual([])
  })

  it.each([
    ['par IP', 'qr_acces_envoi_203.0.113.7'],
    ['par compte (20 par heure)', `qr_acces_envoi_${ADMIN_QR.id}`],
    ['par fiche (3 par heure)', `qr_acces_fiche_${G}`],
  ])('limite %s : 429, rien envoyé', async (_cas, cle) => {
    simulQr.refuser = [cle]
    expect((await envoyer()).status).toBe(429)
    expect(messagesEnvoyesQr()).toEqual([])
    expect(baseQr.etat.appelsRpc).toEqual([])
  })

  it('sans la 20261112 (fonction absente, PGRST202) : 503 base_absente, ni envoi ni e-mail, journalisé une fois', async () => {
    simulerProductionAvant1112Qr()
    for (let i = 0; i < 2; i += 1) {
      const res = await envoyer()
      expect(res.status).toBe(503)
      expect(await res.json()).toEqual({ error: 'base_absente' })
    }
    expect(baseQr.table('signalements_qr_invitations')).toEqual([])
    expect(messagesEnvoyesQr()).toEqual([])
    expect(avertissementsAcces()).toHaveLength(1)
    expect(avertissementsAcces()[0][1]).toMatchObject({ migration: MIGRATION_ACCES_QR, code: 'PGRST202' })
  })

  it.each(['40P01', '40001'])('conflit avec une écriture concurrente (%s, PR 1) : 409 a_reverifier, avertissement, aucun e-mail', async (code) => {
    baseQr.etat.fonctions.signalements_qr_envoyer_acces = () => ({ error: { code, message: 'conflit' } })
    const res = await envoyer()
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'a_reverifier' })
    expect(messagesEnvoyesQr()).toEqual([])
    expect(simulQr.logger.error).not.toHaveBeenCalled()
    expect(simulQr.logger.warn).toHaveBeenCalledWith(expect.stringContaining('à recommencer'), expect.objectContaining({ code, gestionnaire: G }))
  })

  it('sans la 20261111 (tables absentes, PGRST205) : 503 base_absente, aucun e-mail', async () => {
    simulerProductionAvant1111Qr()
    const res = await envoyer()
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'base_absente' })
    expect(messagesEnvoyesQr()).toEqual([])
  })
})

// ── P2-R1b : envoi groupé ────────────────────────────────────────────────────

describe('envoi groupé (P2-R1b, super admin)', () => {
  beforeEach(() => {
    baseQr.table('signalements_qr_gestionnaires').push(
      fiche({ id: G2, nom: 'Paul Collègue', email: 'paul.collegue@exemple.test' }),
      fiche({ id: G3, nom: 'Léa Contestée', email: 'lea.contestee@exemple.test', adresse_contestee_le: '2026-11-11T09:00:00+00:00' }),
      fiche({ id: G4, nom: 'Jean Ouvert', email: 'jean.ouvert@exemple.test', user_id: COMPTE_EXISTANT, acces_ouvert_le: '2026-11-11T09:00:00+00:00' }),
    )
  })

  it('chaque fiche une à une : envoyés comptés, échecs avec leur seul code (id, code) ; doublons d’ids ignorés', async () => {
    const res = await envoyerGroupe({ gestionnaireIds: [G, G2, G3, G4, INCONNU, G] })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      envoyes: 2,
      echecs: [{ id: G3, code: 'adresse_contestee' }, { id: G4, code: 'deja_ouvert' }, { id: INCONNU, code: 'introuvable' }],
    })
    expect(messagesEnvoyesQr().map((m) => m.to)).toEqual([EMAIL, 'paul.collegue@exemple.test'])
    expect(lignesJournal('gestionnaire.acces_envoye').map((l) => l.gestionnaire_id)).toEqual([G, G2])
  })

  it('e-mail refusé pour une fiche : envoi enregistré, échec « email_non_envoye »', async () => {
    simulQr.resultatsLots = [{ sent: 1, failed: 0, errors: [] }, { sent: 0, failed: 1, errors: ['refus'] }]
    const res = await envoyerGroupe({ gestionnaireIds: [G, G2] })
    expect(await res.json()).toEqual({ envoyes: 1, echecs: [{ id: G2, code: 'email_non_envoye' }] })
  })

  it('limite d’une fiche atteinte : échec « trop_de_demandes » pour elle seule', async () => {
    simulQr.refuser = [`qr_acces_fiche_${G2}`]
    expect(await (await envoyerGroupe({ gestionnaireIds: [G, G2] })).json()).toEqual({ envoyes: 1, echecs: [{ id: G2, code: 'trop_de_demandes' }] })
  })

  it.each([
    ['liste vide', { gestionnaireIds: [] }],
    ['51 fiches', { gestionnaireIds: Array.from({ length: 51 }, (_, i) => `a0000000-0000-4000-8000-${String(i).padStart(12, '0')}`) }],
    ['id mal formé', { gestionnaireIds: ['pas-un-uuid'] }],
    ['clé inconnue', { gestionnaireIds: [G], forcer: true }],
  ])('%s : 400, rien envoyé', async (_cas, corps) => {
    expect((await envoyerGroupe(corps)).status).toBe(400)
    expect(baseQr.etat.appelsRpc).toEqual([])
  })

  it('super admin seul (gestionnaire : 403) ; limite par compte 5 par heure (429)', async () => {
    simulQr.user = COMPTE_GESTIONNAIRE
    expect((await envoyerGroupe({ gestionnaireIds: [G] })).status).toBe(403)
    simulQr.user = ADMIN_QR
    simulQr.refuser = [`qr_acces_groupe_${ADMIN_QR.id}`]
    expect((await envoyerGroupe({ gestionnaireIds: [G] })).status).toBe(429)
    expect(messagesEnvoyesQr()).toEqual([])
  })

  it('sans la 20261112 : 503 base_absente dès la première fiche, rien envoyé', async () => {
    simulerProductionAvant1112Qr()
    const res = await envoyerGroupe({ gestionnaireIds: [G, G2] })
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'base_absente' })
    expect(messagesEnvoyesQr()).toEqual([])
    expect(baseQr.etat.appelsRpc.filter((a) => a.nom === 'signalements_qr_envoyer_acces')).toHaveLength(1)
  })
})

// ── P2-R2 : lecture du lien (publique, sans effet) ───────────────────────────

describe('lecture du lien d’accès (P2-R2, publique)', () => {
  beforeEach(async () => {
    simulQr.user = null
    await preparerEnvoi()
  })

  it('nom court, cabinet, adresse masquée ; AUCUNE écriture, aucune fonction, aucun appel à l’auth ; réponse privée', async () => {
    const res = await lire(corpsLien())
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    expect(await res.json()).toEqual({ nomCourt: 'Marie E.', cabinet: 'Cabinet Exemple', email: 'ma***@exemple.test' })
    expect(baseQr.etat.ecritures).toEqual([])
    expect(baseQr.etat.appelsRpc).toEqual([])
    expect(I.authQr.appels).toEqual([])
  })

  it('lien de confirmation d’adresse présenté ici : 404 (et le lien d’accès reste refusé par la confirmation)', async () => {
    const accesValide = jeton
    await preparerEnvoi({ objet: 'confirmation_adresse' })
    expect((await lire(corpsLien())).status).toBe(404)
    expect((await accepter(corpsAcceptation())).status).toBe(404)
    expect((await refuser(corpsLien())).status).toBe(404)
    expect(I.authQr.appels).toEqual([])
    expect((await lire(corpsLien({ token: accesValide }))).status).toBe(200)
  })

  it('cabinet du chemin ≠ cabinet de la fiche, signature fausse, lien d’un autre espace (syndic) : le même 404 générique', async () => {
    for (const corps of [corpsLien({ cabinet: 'autre-cabinet' }), corpsLien({ cabinet: 'cabinet-inconnu' }), corpsLien({ token: `${jeton.split('.')[0]}.${'0'.repeat(64)}` })]) {
      const res = await lire(corps)
      expect(res.status).toBe(404)
      expect(await res.json()).toEqual({ error: 'introuvable' })
    }
    await preparerEnvoi({}, 'syndic')
    expect((await lire(corpsLien())).status).toBe(404)
  })

  it.each([
    ['fiche désactivée', { actif: false }],
    ['adresse contestée', { adresse_contestee_le: '2026-11-11T09:00:00+00:00' }],
    ['fiche pseudonymisée', { email: null, nom: null, pseudonymise_le: '2026-11-11T09:00:00+00:00' }],
    ['adresse de la fiche différente de celle de l’envoi', { email: 'autre.adresse@exemple.test' }],
  ])('%s : 404', async (_cas, etat) => {
    Object.assign(laFiche(), etat)
    expect((await lire(corpsLien())).status).toBe(404)
  })

  it('envoi refusé (refus posé) : 404', async () => {
    Object.assign(envoi(idEnvoi), { refus: 'compte_autre_espace' })
    expect((await lire(corpsLien())).status).toBe(404)
  })

  it('compte déjà relié à la fiche : 409 deja_ouvert (« Mot de passe oublié ») sous son chemin, 404 sous un autre', async () => {
    Object.assign(laFiche(), { user_id: COMPTE_EXISTANT, acces_ouvert_le: '2026-11-11T09:00:00+00:00' })
    const res = await lire(corpsLien())
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'deja_ouvert' })
    expect((await lire(corpsLien({ cabinet: 'autre-cabinet' }))).status).toBe(404)
  })

  it.each([
    ['expiré (plus de 7 jours) : 410 expire', { created_at: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString() }, 410, 'expire'],
    ['marqué accepté : 409 deja_ouvert', { accepted_at: new Date().toISOString() }, 409, 'deja_ouvert'],
  ])('lien %s sous son chemin ; sous un autre chemin, le même 404 (ni 410 ni 409)', async (_cas, etat, status, code) => {
    Object.assign(envoi(idEnvoi), etat)
    const res = await lire(corpsLien())
    expect(res.status).toBe(status)
    expect(await res.json()).toEqual({ error: code })
    for (const route of [lire, refuser]) expect((await route(corpsLien({ cabinet: 'autre-cabinet' }))).status).toBe(404)
    expect((await accepter(corpsAcceptation({ cabinet: 'autre-cabinet' }))).status).toBe(404)
    expect(I.authQr.appels).toEqual([])
  })

  it('un lien de confirmation expiré présenté ici sous le bon chemin : 404 (pas 410 : ce n’est pas un lien d’accès)', async () => {
    await preparerEnvoi({ objet: 'confirmation_adresse', created_at: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString() })
    expect((await lire(corpsLien())).status).toBe(404)
  })

  it('corps sans cabinet, jeton mal formé, clé inconnue : 400', async () => {
    expect((await lire({ token: jeton })).status).toBe(400)
    expect((await lire(corpsLien({ token: 'abc' }))).status).toBe(400)
    expect((await lire(corpsLien({ gestionnaireId: G }))).status).toBe(400)
  })

  it('limite par IP : 20 par minute', async () => {
    simulQr.refuser = ['qr_invitation_lecture_']
    expect((await lire(corpsLien())).status).toBe(429)
  })

  it('sans la 20261112 (colonne user_id absente, 42703) : 503 base_absente, journalisé une fois, aucune écriture', async () => {
    simulerProductionAvant1112Qr()
    for (let i = 0; i < 2; i += 1) {
      const res = await lire(corpsLien())
      expect(res.status).toBe(503)
      expect(await res.json()).toEqual({ error: 'base_absente' })
    }
    expect(avertissementsAcces()).toHaveLength(1)
    expect(avertissementsAcces()[0][1]).toMatchObject({ migration: MIGRATION_ACCES_QR, code: '42703' })
    expect(baseQr.etat.ecritures).toEqual([])
  })

  it('sans la 20261111 (table des envois absente, PGRST205) : aucun lien ne peut exister, 404 sans écriture', async () => {
    simulerProductionAvant1111Qr()
    expect((await lire(corpsLien())).status).toBe(404)
    expect(baseQr.etat.tablesAbsentesLues).toContain('signalements_qr_invitations')
    expect(baseQr.etat.ecritures).toEqual([])
  })
})

// ── P2-R3 : acceptation ──────────────────────────────────────────────────────

describe('acceptation (P2-R3, publique)', () => {
  beforeEach(async () => {
    simulQr.user = null
    await preparerEnvoi()
  })

  it('compte neuf : createUser (adresse confirmée), rôle ET repère fixés par le code ; envoi accepté ; fiche reliée ; 200 { acces: ouvert }', async () => {
    const res = await accepter(corpsAcceptation())
    expect(res.status).toBe(200)
    const corps = await res.json()
    expect(corps).toEqual({ acces: 'ouvert' })
    expect(JSON.stringify(corps)).not.toContain('exemple.test')
    // Aucune session ouverte par l'invitation.
    expect(res.headers.get('set-cookie')).toBeNull()

    const creation = I.authQr.appels.find((a) => a.methode === 'createUser')?.args[0] as Record<string, unknown>
    expect(creation).toEqual({
      email: EMAIL, password: MOT_DE_PASSE, email_confirm: true,
      app_metadata: { role: 'gestionnaire_signalement', aj_signalement_cabinet: 'cabinet-exemple' },
      user_metadata: { full_name: 'Marie Exemple' },
    })
    const compte = I.authQr.comptes[0]
    expect(envoi(idEnvoi)).toMatchObject({ user_id: compte.id, accepted_at: expect.any(String), invite_token: null })
    expect(laFiche()).toMatchObject({ user_id: compte.id, acces_ouvert_le: expect.any(String), adresse_confirmee_le: expect.any(String) })
    expect(lignesJournal('gestionnaire.acces_ouvert')).toEqual([expect.objectContaining({ gestionnaire_id: G, acteur_id: compte.id })])
    // Le même lien ne vaut plus rien ensuite.
    expect((await accepter(corpsAcceptation())).status).toBe(404)
    expect(I.authQr.appels.filter((a) => a.methode === 'createUser')).toHaveLength(1)
    expect(texteJournalServeurQr()).not.toMatch(/marie|exemple\.test|Bonjour2026/i)
  })

  it('rôle de la ligne d’envoi modifié en base (super_admin) : sans effet, le rôle vient du code', async () => {
    Object.assign(envoi(idEnvoi), { role: 'super_admin' })
    expect((await accepter(corpsAcceptation())).status).toBe(200)
    expect(I.authQr.comptes[0].app_metadata).toEqual({ role: 'gestionnaire_signalement', aj_signalement_cabinet: 'cabinet-exemple' })
  })

  it('de bout en bout : le lien de l’e-mail de P2-R1 ouvre l’accès', async () => {
    baseQr.etat.tables.signalements_qr_invitations = []
    simulQr.user = ADMIN_QR
    await envoyer()
    simulQr.user = null
    const lien = jetonDuMessage(messagesEnvoyesQr()[0].html)
    expect((await accepter(corpsAcceptation({ token: lien }))).status).toBe(200)
    expect(laFiche().user_id).toBe(I.authQr.comptes[0].id)
  })

  it('compte existant SANS rôle : refus neutre 409 compte_autre_espace, jamais converti ; refus posé, lien caduc, journal, alerte sans nom ni adresse', async () => {
    I.authQr.comptes = [{ id: COMPTE_EXISTANT, email: EMAIL, app_metadata: {}, user_metadata: {} }]
    const res = await accepter(corpsAcceptation())
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'compte_autre_espace' })
    expect(I.authQr.appels.filter((a) => a.methode === 'updateUserById')).toEqual([])
    expect(I.authQr.comptes[0].app_metadata).toEqual({})
    expect(envoi(idEnvoi)).toMatchObject({ refus: 'compte_autre_espace', invite_token: null, accepted_at: null, user_id: null })
    expect(laFiche().user_id).toBeNull()
    expect(lignesJournal('gestionnaire.refus_autre_espace')).toEqual([
      expect.objectContaining({ cabinet_id: CAB, gestionnaire_id: G, acteur_profil: 'gestionnaire', acteur_gestionnaire_id: G }),
    ])
    const alertes = messagesEnvoyesQr()
    expect(alertes.map((m) => m.to)).toEqual(['admin@exemple.test', 'second@exemple.test'])
    for (const m of alertes) {
      expect(m.subject).toBe(ALERTE_REFUS_AUTRE_ESPACE_QR.objet)
      expect(m.html).toContain(`https://vitfix.io/fr/aj-signalement/#gestionnaire/${G}`)
      expect(m.html).not.toMatch(/marie|exemple\.test/i)
    }
    // Le lien ne sert plus : le cabinet doit inviter une autre adresse.
    expect((await lire(corpsLien())).status).toBe(404)
  })

  it.each([
    ['syndic_gestionnaire', { role: 'syndic_gestionnaire', cabinet_id: CAB_AUTRE }],
    ['client', { role: 'client' }],
    ['artisan', { role: 'artisan' }],
    ['super_admin', { role: 'super_admin' }],
    ['pro_societe', { role: 'pro_societe', pro_team_role: 'OUVRIER' }],
  ])('compte existant %s : 409 compte_autre_espace, refus posé, app_metadata intact', async (_role, appMetadata) => {
    I.authQr.comptes = [{ id: COMPTE_EXISTANT, email: EMAIL, app_metadata: { ...appMetadata }, user_metadata: {} }]
    const res = await accepter(corpsAcceptation())
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'compte_autre_espace' })
    expect(I.authQr.comptes[0].app_metadata).toEqual(appMetadata)
    expect(envoi(idEnvoi).refus).toBe('compte_autre_espace')
  })

  it('compte qui porte DÉJÀ le rôle des gestionnaires (acceptation interrompue) : rattaché, repère posé, fiche reliée, 200', async () => {
    I.authQr.comptes = [{ id: COMPTE_EXISTANT, email: EMAIL, app_metadata: { role: 'gestionnaire_signalement', provider: 'email' }, user_metadata: {} }]
    const res = await accepter(corpsAcceptation())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ acces: 'ouvert' })
    expect(I.authQr.comptes[0].app_metadata).toEqual({ role: 'gestionnaire_signalement', provider: 'email', aj_signalement_cabinet: 'cabinet-exemple' })
    expect(envoi(idEnvoi)).toMatchObject({ user_id: COMPTE_EXISTANT, accepted_at: expect.any(String) })
    expect(laFiche().user_id).toBe(COMPTE_EXISTANT)
  })

  it('relecture 5 du lot 6 : compte rattaché → le mot de passe choisi sur la page est le sien, et sa connexion est débloquée', async () => {
    I.authQr.comptes = [{
      id: COMPTE_EXISTANT, email: EMAIL, app_metadata: { role: 'gestionnaire_signalement' }, user_metadata: {}, password: 'AncienMot2025', ban_duration: '876000h',
    }]
    const res = await accepter(corpsAcceptation())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ acces: 'ouvert' })
    expect(I.authQr.comptes[0]).toMatchObject({ password: MOT_DE_PASSE, ban_duration: 'none' })
    // Appliqué APRÈS la liaison de la fiche à CE compte (jamais à un compte que le trigger a refusé).
    const maj = I.authQr.appels.filter((a) => a.methode === 'updateUserById').map((a) => a.args[1])
    expect(maj.at(-1)).toEqual({ password: MOT_DE_PASSE, ban_duration: 'none' })
    expect(texteJournalServeurQr()).not.toMatch(/marie|exemple\.test|Bonjour2026/i)
  })

  it('compte rattaché mais liaison refusée par la base : aucun mot de passe appliqué (207 liaison_incomplete)', async () => {
    I.authQr.comptes = [{ id: COMPTE_EXISTANT, email: EMAIL, app_metadata: { role: 'gestionnaire_signalement' }, user_metadata: {}, password: 'AncienMot2025' }]
    I.liaisonQr.active = false
    expect((await accepter(corpsAcceptation())).status).toBe(207)
    expect(I.authQr.comptes[0].password).toBe('AncienMot2025')
    expect(I.authQr.appels.filter((a) => a.methode === 'updateUserById').map((a) => a.args[1])).not.toContainEqual(expect.objectContaining({ password: MOT_DE_PASSE }))
  })

  it('compte rattaché, mot de passe refusé par Supabase Auth : 200 { acces: ouvert, compte: existant } (il garde son mot de passe)', async () => {
    I.authQr.comptes = [{ id: COMPTE_EXISTANT, email: EMAIL, app_metadata: { role: 'gestionnaire_signalement' }, user_metadata: {}, password: 'AncienMot2025' }]
    I.authQr.refusMotDePasse = { code: 'weak_password', message: 'Password is known to be weak and easy to guess, please choose a different one.' }
    const res = await accepter(corpsAcceptation())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ acces: 'ouvert', compte: 'existant' })
    expect(laFiche().user_id).toBe(COMPTE_EXISTANT)
    expect(I.authQr.comptes[0].password).toBe('AncienMot2025')
    expect(simulQr.logger.error).toHaveBeenCalledWith(expect.stringContaining('mot de passe'), expect.objectContaining({ gestionnaire: G, code: 'weak_password' }))
    expect(texteJournalServeurQr()).not.toMatch(/marie|exemple\.test|Bonjour2026/i)
  })

  it('rattaché mais envoi non marqué (erreur ignorée par lib/equipe) : 207 liaison_incomplete, logger.error sans adresse, alerte', async () => {
    I.authQr.comptes = [{ id: COMPTE_EXISTANT, email: EMAIL, app_metadata: { role: 'gestionnaire_signalement' }, user_metadata: {} }]
    I.authQr.avant.updateUserById = () => {
      baseQr.etat.erreursPonctuelles.signalements_qr_invitations = { code: '57014', message: 'canceling statement due to statement timeout' }
    }
    const res = await accepter(corpsAcceptation())
    expect(res.status).toBe(207)
    expect(await res.json()).toEqual({ error: 'liaison_incomplete' })
    expect(laFiche().user_id).toBeNull()
    expect(simulQr.logger.error).toHaveBeenCalledWith(expect.stringContaining('non relié'), expect.objectContaining({ gestionnaire: G, envoi: idEnvoi }))
    expect(texteJournalServeurQr()).not.toMatch(/marie|exemple\.test/i)
    expect(messagesEnvoyesQr().map((m) => m.subject)).toEqual([ALERTE_LIAISON_INCOMPLETE_QR.objet, ALERTE_LIAISON_INCOMPLETE_QR.objet])
    expect(messagesEnvoyesQr()[0].html).not.toMatch(/marie|exemple\.test/i)
  })

  it('compte neuf mais envoi non marqué (207 de lib/equipe) : 207 liaison_incomplete, adresse jamais renvoyée', async () => {
    I.authQr.avant.createUser = () => {
      baseQr.etat.erreursPonctuelles.signalements_qr_invitations = { code: '57014', message: 'canceling statement due to statement timeout' }
    }
    const res = await accepter(corpsAcceptation())
    expect(res.status).toBe(207)
    const corps = await res.json()
    expect(corps).toEqual({ error: 'liaison_incomplete' })
    expect(JSON.stringify(corps)).not.toContain('exemple.test')
  })

  it('liaison refusée par la base (garde du trigger : compte relié à une autre fiche) : 207 liaison_incomplete', async () => {
    I.liaisonQr.active = false
    const res = await accepter(corpsAcceptation())
    expect(res.status).toBe(207)
    expect(await res.json()).toEqual({ error: 'liaison_incomplete' })
    expect(envoi(idEnvoi).accepted_at).toEqual(expect.any(String))
    expect(laFiche().user_id).toBeNull()
  })

  it.each([
    ['trop court', { password: 'Abc123' }],
    ['sans majuscule', { password: 'bonjour2026' }],
    ['sans minuscule', { password: 'BONJOUR2026' }],
    ['sans chiffre', { password: 'BonjourBonjour' }],
    ['plus de 72 octets', { password: `Aa1${'é'.repeat(40)}` }],
    ['case non cochée', { politiqueLue: false }],
    ['case absente', { politiqueLue: undefined }],
    ['clé inconnue (rôle)', { role: 'super_admin' }],
    ['sans cabinet', { cabinet: undefined }],
  ])('%s : 400 AVANT tout appel (ni lecture de l’envoi, ni auth)', async (_cas, sur) => {
    const res = await accepter(corpsAcceptation(sur))
    expect(res.status).toBe(400)
    expect(baseQr.etat.lectures).toEqual([])
    expect(I.authQr.appels).toEqual([])
  })

  it('fiche désactivée (départ) entre l’envoi et l’acceptation : 404, aucun compte créé', async () => {
    Object.assign(laFiche(), { actif: false })
    expect((await accepter(corpsAcceptation())).status).toBe(404)
    expect(I.authQr.appels).toEqual([])
  })

  it('relecture 4 du lot 6 : mot de passe refusé par la politique de Supabase Auth (weak_password) : 422 invalide, rien créé, le lien reste valable', async () => {
    I.authQr.refusMotDePasse = { code: 'weak_password', message: 'Password is known to be weak and easy to guess, please choose a different one.' }
    const res = await accepter(corpsAcceptation())
    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ error: 'invalide' })
    expect(I.authQr.comptes).toEqual([])
    expect(envoi(idEnvoi).accepted_at).toBeNull()
    expect(texteJournalServeurQr()).not.toMatch(/marie|exemple\.test|Bonjour2026/i)
    // Un autre mot de passe, accepté par la politique : le même lien ouvre l'accès.
    I.authQr.refusMotDePasse = null
    const reprise = await accepter(corpsAcceptation({ password: 'AutreMot2026' }))
    expect(reprise.status).toBe(200)
    expect(I.authQr.comptes[0].password).toBe('AutreMot2026')
  })

  it('autre refus de Supabase Auth à la création (service en panne) : 500 serveur, journal sans adresse ni mot de passe', async () => {
    I.authQr.echecs.createUser = 'Database error creating new user'
    const res = await accepter(corpsAcceptation())
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'serveur' })
    expect(envoi(idEnvoi).accepted_at).toBeNull()
    expect(texteJournalServeurQr()).not.toMatch(/marie|exemple\.test|Bonjour2026/i)
  })

  it('limites : 5 par minute et par IP ; 10 par heure par EMPREINTE du jeton (jamais le jeton en clair)', async () => {
    await accepter(corpsAcceptation({ password: 'faible' }))
    expect(simulQr.limites).toEqual(['qr_invitation_post_203.0.113.7'])
    simulQr.limites = []
    await accepter(corpsAcceptation())
    const cle = simulQr.limites.find((c) => c.startsWith('qr_invitation_jeton_'))
    expect(cle).toMatch(/^qr_invitation_jeton_[a-f0-9]{64}$/)
    for (const partie of jeton.split('.')) expect(cle).not.toContain(partie)
    simulQr.refuser = ['qr_invitation_post_']
    expect((await accepter(corpsAcceptation())).status).toBe(429)
    simulQr.refuser = ['qr_invitation_jeton_']
    expect((await accepter(corpsAcceptation())).status).toBe(429)
  })

  it('sans la 20261112 : 503 base_absente AVANT toute création de compte', async () => {
    simulerProductionAvant1112Qr()
    const res = await accepter(corpsAcceptation())
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'base_absente' })
    expect(I.authQr.appels).toEqual([])
    expect(baseQr.etat.ecritures).toEqual([])
  })

  it('sans la 20261111 : 404 (aucun lien ne peut exister), aucun compte créé', async () => {
    simulerProductionAvant1111Qr()
    expect((await accepter(corpsAcceptation())).status).toBe(404)
    expect(I.authQr.appels).toEqual([])
  })
})

// ── P2-R3b : « Ce n'est pas moi » ────────────────────────────────────────────

describe('« Ce n’est pas moi » (P2-R3b, publique)', () => {
  beforeEach(async () => {
    simulQr.user = null
    await preparerEnvoi()
  })

  it('contestation par la fonction SQL (corps élargi de la 20261112), alerte au super admin sans nom ni adresse, lien caduc', async () => {
    const res = await refuser(corpsLien())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ contestee: true })
    expect(baseQr.etat.appelsRpc).toEqual([{ nom: 'signalements_qr_contester_adresse', args: { p_invitation: idEnvoi } }])
    expect(laFiche().adresse_contestee_le).toEqual(expect.any(String))
    expect(lignesJournal('gestionnaire.adresse_contestee')).toEqual([expect.objectContaining({ gestionnaire_id: G, details: { objet: 'acces' } })])
    const alertes = messagesEnvoyesQr()
    expect(alertes.map((m) => m.to)).toEqual(['admin@exemple.test', 'second@exemple.test'])
    for (const m of alertes) {
      expect(m.subject).toBe(ALERTE_ADRESSE_CONTESTEE_QR.objet)
      expect(m.html).toContain(`https://vitfix.io/fr/aj-signalement/#gestionnaire/${G}`)
      expect(m.html).not.toMatch(/marie|exemple\.test/i)
    }
    expect(I.authQr.appels).toEqual([])
    expect((await lire(corpsLien())).status).toBe(404)
    expect((await accepter(corpsAcceptation())).status).toBe(404)
  })

  it('lien de confirmation déjà confirmé (jeton gardé par « C’est moi », PR 1) : effacé lui aussi, comme tous les liens de la fiche', async () => {
    const confirme = {
      id: 'e1000000-0000-4000-8000-0000000000c1', gestionnaire_id: G, objet: 'confirmation_adresse', email: EMAIL, invite_token: 'c'.repeat(48),
      accepted_at: '2026-11-11T09:00:00+00:00', refus: null, created_at: '2026-11-11T08:30:00+00:00',
    }
    baseQr.table('signalements_qr_invitations').push(confirme)
    expect((await refuser(corpsLien())).status).toBe(200)
    expect(envoi(confirme.id)).toMatchObject({ invite_token: null, accepted_at: confirme.accepted_at, refus: null })
    expect(envoi(idEnvoi)).toMatchObject({ invite_token: null, refus: 'pas_moi' })
  })

  it('cabinet du chemin ≠ celui de la fiche : 404, aucune fonction appelée', async () => {
    expect((await refuser(corpsLien({ cabinet: 'autre-cabinet' }))).status).toBe(404)
    expect(baseQr.etat.appelsRpc).toEqual([])
  })

  it('refusée par la base (course : lien utilisé entre-temps) : 404, aucune alerte', async () => {
    baseQr.etat.fonctions.signalements_qr_contester_adresse = () => ({ data: false })
    expect((await refuser(corpsLien())).status).toBe(404)
    expect(messagesEnvoyesQr()).toEqual([])
  })

  // PR 1 (essai PGlite du 11/11, D7) : la fonction verrouille la fiche d'abord ; un conflit avec une écriture concurrente
  // (40P01 blocage mutuel, 40001 sérialisation) annule tout et se traduit comme partout : 409 a_reverifier, signalé en
  // avertissement (« à recommencer »), jamais une erreur serveur.
  it.each(['40P01', '40001'])('conflit avec une écriture concurrente (%s) : 409 a_reverifier, avertissement, aucune alerte', async (code) => {
    baseQr.etat.fonctions.signalements_qr_contester_adresse = () => ({ error: { code, message: 'conflit' } })
    const res = await refuser(corpsLien())
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'a_reverifier' })
    expect(messagesEnvoyesQr()).toEqual([])
    expect(simulQr.logger.error).not.toHaveBeenCalled()
    expect(simulQr.logger.warn).toHaveBeenCalledWith(expect.stringContaining('à recommencer'), expect.objectContaining({ code, gestionnaire: G }))
  })

  it('alerte impossible : la contestation reste acquise (200)', async () => {
    simulQr.resultatsLots = [{ sent: 0, failed: 2, errors: ['panne'] }, { sent: 0, failed: 1, errors: ['panne'] }, { sent: 0, failed: 1, errors: ['panne'] }]
    expect((await refuser(corpsLien())).status).toBe(200)
    expect(texteJournalServeurQr()).not.toContain('panne')
  })

  it('limite par IP : 5 par minute', async () => {
    simulQr.refuser = ['qr_invitation_refus_']
    expect((await refuser(corpsLien())).status).toBe(429)
  })

  it('sans la 20261112 : 503 base_absente, aucune fonction appelée', async () => {
    simulerProductionAvant1112Qr()
    const res = await refuser(corpsLien())
    expect(res.status).toBe(503)
    expect(baseQr.etat.appelsRpc).toEqual([])
  })
})
