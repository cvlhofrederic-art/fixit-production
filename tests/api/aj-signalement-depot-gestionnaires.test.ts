// tests/api/aj-signalement-depot-gestionnaires.test.ts
//
// POST /api/aj-signalement/signalements (P1-R20, public) : destinataires automatiques et budget d'e-mails.
// Demande de Hugo du 10/11/2026 : le gestionnaire reçoit AUTOMATIQUEMENT les signalements de ses copropriétés.
//   - destinataires = (adresses saisies MOINS fiches inactives ou contestées) ∪ gestionnaires confirmés de la
//     copropriété (fonction signalements_qr_emails_gestionnaires, simulée) ; ADMIN_EMAIL seulement si l'union est vide ;
//   - UN e-mail par destinataire (sendBatchEmails) : personne ne voit les autres adresses ; repli un par un si le lot
//     est refusé ; email_erreur résumé, sans adresse ni texte du service d'e-mail ;
//   - budget (60 / h par copropriété, 300 / h par cabinet) réservé en base AVANT l'envoi : au-delà, le dépôt est
//     ENREGISTRÉ (200), l'e-mail retenu, une seule alerte au super admin ; le dépôt suivant accordé mentionne les
//     signalements retenus ;
//   - fonctions absentes (migration non appliquée) : envoi aux adresses saisies, sans budget, comme aujourd'hui.
// Les limites du dépôt (5 / min par IP, 30 / 10 min par copropriété) ne changent pas.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/supabase-server', async () => ({ supabaseAdmin: (await import('../helpers/aj-signalement-base')).baseQr.client }))
vi.mock('@/lib/supabase-server-component', async () => (await import('../helpers/aj-signalement-routes')).mockCookies())
vi.mock('@/lib/auth-helpers', async () => (await import('../helpers/aj-signalement-routes')).mockAuth())
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/aj-signalement-routes')).mockLimites())
vi.mock('@/lib/email', async () => (await import('../helpers/aj-signalement-routes')).mockEmail())
vi.mock('@/lib/logger', async () => (await import('../helpers/aj-signalement-routes')).mockLogger())

const { baseQr } = await import('../helpers/aj-signalement-base')
const { messagesEnvoyesQr, reinitialiserSimulQr, requeteQr, simulQr, texteJournalServeurQr } = await import('../helpers/aj-signalement-routes')
const { POST } = await import('@/app/api/aj-signalement/signalements/route')
const { reinitialiserReplisQr } = await import('@/lib/aj-signalement/serveur')

const JETON = '0123456789abcdef0123456789abcdef'
const COPRO = 'c0000000-0000-4000-8000-000000000001'
const G1 = 'a0000000-0000-4000-8000-000000000001'
const G2 = 'a0000000-0000-4000-8000-000000000002'
const G_PARTI = 'a0000000-0000-4000-8000-000000000003'
const CORPS = {
  jeton: JETON, prenom: 'Prénom', nom: 'Déclarant', telephone: '06 00 00 00 00', email: 'declarant@exemple.test',
  batiment: 'A', etage: '2', numLot: '7', estPartieCommune: false, zoneSignalee: '', typeIntervention: 'Plomberie',
  description: 'Fuite d’eau au plafond de la cuisine', priorite: 'normale', langue: 'fr', qualiteDeclarant: 'locataire',
}

type Reservation = { accorde: boolean; retenus: number }
let reservation: Reservation = { accorde: true, retenus: 0 }

beforeEach(() => {
  reinitialiserSimulQr()
  simulQr.user = null
  reinitialiserReplisQr()
  baseQr.reinitialiser()
  vi.unstubAllEnvs()
  vi.stubEnv('ADMIN_EMAIL', 'admin@exemple.test')
  vi.stubEnv('ADMIN_EMAIL_2', '')
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://vitfix.io')
  baseQr.etat.tables.signalements_qr_coproprietes = [{
    id: COPRO, nom: 'Résidence Test', adresse: '1 rue Exemple', jeton: JETON, actif: true, created_at: '2026-11-01T09:00:00+00:00',
    emails_destinataires: ['cs@externe.test', 'luc.parti@exemple.test'],
  }]
  baseQr.etat.tables.signalements_qr = []
  baseQr.etat.fonctions.signalements_qr_emails_gestionnaires = () => ({
    data: [
      { gestionnaire_id: G_PARTI, email: 'luc.parti@exemple.test', acces_ouvert: false, exclu: true },
      { gestionnaire_id: G1, email: 'marie.exemple@exemple.test', acces_ouvert: false, exclu: false },
      { gestionnaire_id: G2, email: 'paul.exemple@exemple.test', acces_ouvert: false, exclu: false },
    ],
  })
  reservation = { accorde: true, retenus: 0 }
  baseQr.etat.fonctions.signalements_qr_reserver_emails = () => ({ data: reservation })
})

const deposer = (corps: unknown = CORPS) => POST(requeteQr('/api/aj-signalement/signalements', 'POST', corps))
const versAdministrateur = () => messagesEnvoyesQr().filter((m) => m.subject.startsWith('[AJ Signalement]'))
const etatFinal = () => baseQr.ecrituresDe('signalements_qr', 'update').map((e) => e.valeurs as Record<string, unknown>).find((v) => 'email_envoye_le' in v)

describe('destinataires automatiques', () => {
  it('un message par destinataire : saisie extérieure + gestionnaires confirmés ; la fiche partie est exclue ; personne ne voit les autres', async () => {
    const res = await deposer()
    expect(res.status).toBe(200)
    expect((await res.json()).signalement).toMatchObject({ emailEnvoye: true })
    const messages = versAdministrateur()
    expect(messages.map((m) => m.to)).toEqual(['cs@externe.test', 'marie.exemple@exemple.test', 'paul.exemple@exemple.test'])
    for (const m of messages) {
      const autres = messages.filter((x) => x !== m).map((x) => String(x.to))
      for (const autre of autres) expect(m.html).not.toContain(autre)
      expect(m.replyTo).toBe('declarant@exemple.test')
    }
    expect(JSON.stringify(messages)).not.toContain('luc.parti')
    // Gestionnaire (sans accès en PR 1) : pas de bouton ; adresse saisie : pas de bouton non plus.
    const gestionnaire = messages[1].html
    expect(gestionnaire).toContain('Le cabinet suit ce signalement dans AJ Signalement.')
    expect(gestionnaire).not.toContain('/aj-signalement/#')
    expect(messages[0].html).not.toContain('/aj-signalement/#')
    // Réservation du budget avant l'envoi, pour 3 messages.
    expect(baseQr.etat.appelsRpc.map((a) => a.nom)).toEqual(['signalements_qr_emails_gestionnaires', 'signalements_qr_reserver_emails'])
    expect(baseQr.etat.appelsRpc[1].args).toEqual({ p_signalement: expect.any(String), p_nombre: 3, p_max_copro: 60, p_max_cabinet: 300 })
    expect(etatFinal()).toMatchObject({ email_envoye_le: expect.any(String), email_erreur: null })
  })

  it('seule saisie = l’adresse d’une fiche partie : repli sur l’administrateur, avec le bouton de l’espace', async () => {
    baseQr.etat.tables.signalements_qr_coproprietes[0].emails_destinataires = ['luc.parti@exemple.test']
    baseQr.etat.fonctions.signalements_qr_emails_gestionnaires = () => ({ data: [{ gestionnaire_id: G_PARTI, email: 'luc.parti@exemple.test', acces_ouvert: false, exclu: true }] })
    await deposer()
    const messages = versAdministrateur()
    expect(messages.map((m) => m.to)).toEqual(['admin@exemple.test'])
    expect(messages[0].html).toContain('https://vitfix.io/fr/aj-signalement/#signalements')
  })

  it('fonction des gestionnaires absente (PGRST202) : envoi aux saisies, dépôt 200, journalisé une fois', async () => {
    delete baseQr.etat.fonctions.signalements_qr_emails_gestionnaires
    delete baseQr.etat.fonctions.signalements_qr_reserver_emails
    expect((await deposer()).status).toBe(200)
    expect(versAdministrateur().map((m) => m.to)).toEqual(['cs@externe.test', 'luc.parti@exemple.test'])
    expect((await deposer()).status).toBe(200)
    expect(simulQr.logger.warn.mock.calls.filter((c) => String(c[0]).includes('repli'))).toHaveLength(2)
  })
})

describe('lot refusé par le service d’e-mail', () => {
  it('repli un par un : un refus n’empêche pas les autres ; email_erreur résumé sans adresse ni texte du service', async () => {
    simulQr.resultatsLots = [
      { sent: 0, failed: 3, errors: ['Invalid `to` field: paul.exemple@exemple.test'] },
      { sent: 1, failed: 0, errors: [] },
      { sent: 1, failed: 0, errors: [] },
      { sent: 0, failed: 1, errors: ['Invalid `to` field: paul.exemple@exemple.test'] },
    ]
    const res = await deposer()
    expect(res.status).toBe(200)
    expect((await res.json()).signalement.emailEnvoye).toBe(true)
    expect(simulQr.lots.map((l) => l.length)).toEqual([3, 1, 1, 1])
    const etat = etatFinal()
    expect(etat?.email_erreur).toBe('1 envoi(s) sur 3 refusé(s) par le service d’e-mail')
    expect(String(etat?.email_erreur)).not.toContain('@')
    expect(texteJournalServeurQr()).not.toContain('Invalid')
    expect(texteJournalServeurQr()).not.toContain('@')
    // Messages réellement acceptés : 2 (le budget est ramené à ce nombre).
    expect(baseQr.ecrituresDe('signalements_qr', 'update').map((e) => e.valeurs)).toContainEqual({ nb_emails_envoyes: 2 })
  })
})

describe('budget d’e-mails', () => {
  it('budget atteint : dépôt 200, aucun e-mail aux destinataires, retenu, une seule alerte sans nom ni adresse', async () => {
    reservation = { accorde: false, retenus: 0 }
    const res = await deposer()
    expect(res.status).toBe(200)
    expect((await res.json()).signalement.emailEnvoye).toBe(false)
    expect(versAdministrateur()).toEqual([])
    expect(etatFinal()).toMatchObject({ email_envoye_le: null, email_erreur: 'Limite d’envoi atteinte : e-mail non envoyé.' })
    const alertes = messagesEnvoyesQr().filter((m) => m.subject === 'AJ Signalement — limite d’envoi atteinte')
    expect(alertes.map((m) => m.to)).toEqual(['admin@exemple.test'])
    expect(alertes[0].html).not.toMatch(/Résidence Test|declarant|Déclarant/)
    // Déjà des signalements retenus depuis le dernier e-mail : pas de nouvelle alerte.
    simulQr.lots = []
    reservation = { accorde: false, retenus: 2 }
    await deposer()
    expect(messagesEnvoyesQr().filter((m) => m.subject === 'AJ Signalement — limite d’envoi atteinte')).toEqual([])
  })

  it('dépôt suivant accordé : le message mentionne les signalements retenus, sans leur contenu', async () => {
    reservation = { accorde: true, retenus: 2 }
    await deposer()
    for (const m of versAdministrateur()) expect(m.html).toContain('2 autres signalements reçus pendant la limite d’envoi : à consulter dans AJ Signalement.')
  })

  it('le déclarant reçoit toujours sa confirmation (limite propre), même quand l’e-mail est retenu', async () => {
    reservation = { accorde: false, retenus: 0 }
    const res = await deposer()
    expect((await res.json()).signalement.confirmationEnvoyee).toBe(true)
    expect(simulQr.emailsSimples.map((m) => m.to)).toEqual([['declarant@exemple.test']])
  })

  it('limites du dépôt inchangées : 5 / min par IP, 30 / 10 min par copropriété', async () => {
    simulQr.refuser = ['qr_signalement_copro_']
    expect((await deposer()).status).toBe(429)
    expect(simulQr.limites).toContain('qr_signalement_post_203.0.113.7')
    expect(simulQr.limites).toContain(`qr_signalement_copro_${COPRO}`)
  })
})

// ── PR 2, lot 5 : bouton « Ouvrir le suivi » (RG-25) ──────────────────────────────────────────────────────────────
// Un gestionnaire dont l'accès est ouvert (acces_ouvert de signalements_qr_emails_gestionnaires, corps de la 20261112)
// reçoit le bouton vers /<identifiant>/suivi/#signalements, sans jeton. L'identifiant du cabinet n'est lu QUE si un
// destinataire a l'accès ouvert ; s'il ne peut pas l'être (colonne cabinet_id 42703, table des cabinets PGRST205 ou
// 42P01, autre erreur), l'e-mail part quand même, avec la phrase de la PR 1 ; le dépôt reste 200.
describe('bouton « Ouvrir le suivi » (PR 2)', () => {
  const CAB = 'ca000000-0000-4000-8000-000000000001'
  const LIEN = 'https://vitfix.io/cabinet-exemple/suivi/#signalements'

  beforeEach(() => {
    baseQr.etat.tables.signalements_qr_coproprietes[0].cabinet_id = CAB
    baseQr.etat.tables.signalements_qr_cabinets = [{ id: CAB, nom: 'Cabinet Exemple', identifiant: 'cabinet-exemple', langue: 'fr' }]
    baseQr.etat.fonctions.signalements_qr_emails_gestionnaires = () => ({
      data: [
        { gestionnaire_id: G1, email: 'marie.exemple@exemple.test', acces_ouvert: true, exclu: false },
        { gestionnaire_id: G2, email: 'paul.exemple@exemple.test', acces_ouvert: false, exclu: false },
      ],
    })
  })

  const message = (to: string) => versAdministrateur().find((m) => m.to === to)
  const lecturesCabinets = () => baseQr.etat.lectures.filter((l) => l.table === 'signalements_qr_cabinets')

  it('accès ouvert : bouton vers le suivi de SON cabinet pour lui seul, sans jeton ; les autres messages comme avant', async () => {
    expect((await deposer()).status).toBe(200)
    expect(message('marie.exemple@exemple.test')?.html).toContain(`href="${LIEN}"`)
    expect(message('marie.exemple@exemple.test')?.html).not.toContain(JETON)
    expect(message('paul.exemple@exemple.test')?.html).not.toContain(LIEN)
    expect(message('paul.exemple@exemple.test')?.html).toContain('Le cabinet suit ce signalement dans AJ Signalement.')
    expect(message('cs@externe.test')?.html).not.toContain(LIEN)
    expect(lecturesCabinets()).toHaveLength(1)
  })

  it('aucun accès ouvert (ou connexion bloquée, acces_ouvert faux) : le cabinet n’est pas lu, aucun bouton', async () => {
    baseQr.etat.fonctions.signalements_qr_emails_gestionnaires = () => ({
      data: [{ gestionnaire_id: G1, email: 'marie.exemple@exemple.test', acces_ouvert: false, exclu: false }],
    })
    expect((await deposer()).status).toBe(200)
    expect(lecturesCabinets()).toEqual([])
    expect(JSON.stringify(versAdministrateur())).not.toContain('/suivi/')
  })

  it.each([
    ['colonne cabinet_id absente (42703)', () => { baseQr.etat.colonnesAbsentes.signalements_qr_coproprietes = ['cabinet_id'] }],
    ['table des cabinets absente (PGRST205)', () => { baseQr.etat.codeTableAbsente = 'PGRST205'; baseQr.etat.tablesAbsentes = ['signalements_qr_cabinets'] }],
    ['table des cabinets absente (42P01)', () => { baseQr.etat.tablesAbsentes = ['signalements_qr_cabinets'] }],
  ])('%s : e-mail parti sans bouton de suivi, dépôt 200, repli journalisé une fois', async (_cas, simuler) => {
    simuler()
    expect((await deposer()).status).toBe(200)
    expect(message('marie.exemple@exemple.test')?.html).not.toContain('/suivi/')
    expect(message('marie.exemple@exemple.test')?.html).toContain('Le cabinet suit ce signalement dans AJ Signalement.')
    expect((await deposer()).status).toBe(200)
    expect(simulQr.logger.warn.mock.calls.filter((c) => String(c[0]).includes('repli (cabinet du lien de suivi)'))).toHaveLength(1)
  })

  it('autre erreur de lecture : e-mail parti sans bouton, dépôt 200, avertissement sans détail', async () => {
    baseQr.etat.erreursPonctuelles.signalements_qr_cabinets = { code: '57014', message: 'canceling statement due to statement timeout' }
    expect((await deposer()).status).toBe(200)
    expect(message('marie.exemple@exemple.test')?.html).not.toContain('/suivi/')
    expect(texteJournalServeurQr()).not.toContain('statement timeout')
  })

  it('copropriété sans cabinet : aucun bouton', async () => {
    baseQr.etat.tables.signalements_qr_coproprietes[0].cabinet_id = null
    expect((await deposer()).status).toBe(200)
    expect(message('marie.exemple@exemple.test')?.html).not.toContain('/suivi/')
  })
})
