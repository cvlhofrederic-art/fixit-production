// tests/api/aj-signalement-depot-repli-cabinet.test.ts
//
// POST /api/aj-signalement/signalements — D9 (décision de Hugo du 17/11/2026, au nom de VitFix, point 7) : repli vers les
// boîtes de VitFix COUPÉ pour une copropriété d'un cabinet client sans aucun destinataire.
//   - le signalement part à l'adresse de contact du cabinet (diffusion_contact_email), réponse directe au déclarant ;
//   - VitFix (ADMIN_EMAIL) reçoit une alerte SANS AUCUNE DONNÉE : « un signalement attend un destinataire » et
//     l'identifiant technique ; elle dit si le cabinet a reçu le signalement ;
//   - sans adresse de contact : aucun e-mail de signalement, l'erreur reste sur la ligne, l'alerte dit que personne au
//     cabinet ne l'a reçu ;
//   - copropriété sans cabinet, ou colonne cabinet_id absente (migration du 11/11/2026 : aucun cabinet ne peut exister) :
//     repli ADMIN_EMAIL d'avant ;
//   - erreur de lecture : traitée comme un cabinet client sans contact (jamais le signalement complet vers VitFix).
// Le dépôt reste acquis dans tous les cas. Données fictives (exemple.test).

import { beforeEach, describe, expect, it, vi } from 'vitest'

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
const CABINET = 'd0000000-0000-4000-8000-000000000001'
const CONTACT = 'contact@cabinet-exemple.test'
const CORPS = {
  jeton: JETON, prenom: 'Prénom', nom: 'Déclarant', telephone: '06 00 00 00 00', email: 'declarant@exemple.test',
  batiment: 'A', etage: '2', numLot: '7', estPartieCommune: false, zoneSignalee: '', typeIntervention: 'Plomberie',
  description: 'Fuite d’eau au plafond de la cuisine', priorite: 'urgente', langue: 'fr', qualiteDeclarant: 'locataire',
}
const OBJET_ALERTE = 'AJ Signalement — un signalement attend un destinataire'
/** Tout ce qui, dans un message, viendrait du signalement ou de la copropriété. */
const DONNEES = ['Prénom', 'Déclarant', '06 00 00 00 00', 'declarant@exemple.test', 'Fuite d’eau', 'Plomberie', 'Résidence Test', '1 rue Exemple', 'lot 7']

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
    emails_destinataires: [], cabinet_id: CABINET,
  }]
  baseQr.etat.tables.signalements_qr_cabinets = [{ id: CABINET, nom: 'Cabinet Exemple', diffusion_contact_email: CONTACT }]
  baseQr.etat.tables.signalements_qr = []
  baseQr.etat.fonctions.signalements_qr_emails_gestionnaires = () => ({ data: [] })
  baseQr.etat.fonctions.signalements_qr_reserver_emails = () => ({ data: { accorde: true, retenus: 0 } })
})

const deposer = () => POST(requeteQr('/api/aj-signalement/signalements', 'POST', CORPS))
const signalements = () => messagesEnvoyesQr().filter((m) => m.subject.startsWith('[AJ Signalement]'))
const alertes = () => messagesEnvoyesQr().filter((m) => m.subject === OBJET_ALERTE)
const versVitfix = () => messagesEnvoyesQr().filter((m) => String(m.to).startsWith('admin'))
const etatFinal = () => baseQr.ecrituresDe('signalements_qr', 'update').map((e) => e.valeurs as Record<string, unknown>).find((v) => 'email_envoye_le' in v)
const idDepose = async (res: Response) => ((await res.json()) as { signalement: { id: string } }).signalement.id

/** Les messages vers VitFix : la seule alerte, sans aucune donnée du signalement, avec son identifiant technique. */
function verifierAlerteSansDonnees(id: string, phrase: string): void {
  expect(versVitfix()).toHaveLength(1)
  const [alerte] = alertes()
  expect(alerte.to).toBe('admin@exemple.test')
  expect(alerte.html).toContain(id)
  expect(alerte.html).toContain(phrase)
  expect(alerte.replyTo).toBeUndefined()
  for (const donnee of DONNEES) {
    expect(alerte.subject, donnee).not.toContain(donnee)
    expect(alerte.html, donnee).not.toContain(donnee)
  }
}

describe('copropriété d’un cabinet client sans destinataire (D9)', () => {
  it('le signalement part à l’adresse de contact du cabinet ; VitFix ne reçoit que l’alerte sans données', async () => {
    const res = await deposer()
    expect(res.status).toBe(200)
    const id = await idDepose(res)
    const [message, ...autres] = signalements()
    expect(autres).toEqual([])
    expect(message.to).toBe(CONTACT)
    expect(message.replyTo).toBe('declarant@exemple.test')
    expect(message.html).toContain('Fuite d’eau au plafond de la cuisine')
    expect(message.html).toContain('ce signalement est envoyé à l’adresse de contact du cabinet')
    expect(message.html).not.toContain('/aj-signalement/#')
    verifierAlerteSansDonnees(id, 'Il a été envoyé à l’adresse de contact du cabinet.')
    expect(etatFinal()).toMatchObject({ email_envoye_le: expect.any(String), email_erreur: null })
  })

  it('cabinet sans adresse de contact : aucun e-mail de signalement, erreur gardée, alerte « personne au cabinet »', async () => {
    baseQr.etat.tables.signalements_qr_cabinets[0].diffusion_contact_email = null
    const res = await deposer()
    expect(res.status).toBe(200)
    const id = await idDepose(res)
    expect(signalements()).toEqual([])
    verifierAlerteSansDonnees(id, 'Personne au cabinet ne l’a reçu : prévenez le cabinet sans attendre.')
    expect(etatFinal()).toMatchObject({ email_envoye_le: null, email_erreur: 'aucun destinataire configuré' })
    expect(simulQr.logger.error.mock.calls.some((c) => String(c[0]).includes('aucun destinataire'))).toBe(true)
    for (const donnee of DONNEES) expect(texteJournalServeurQr(), donnee).not.toContain(donnee)
  })

  it('adresse de contact refusée par le service d’e-mail : l’alerte dit que personne au cabinet ne l’a reçu', async () => {
    simulQr.resultatsLots = [{ sent: 0, failed: 1, errors: ['refus'] }]
    const id = await idDepose(await deposer())
    expect(signalements().map((m) => m.to)).toEqual([CONTACT])
    verifierAlerteSansDonnees(id, 'Personne au cabinet ne l’a reçu')
    expect(etatFinal()).toMatchObject({ email_envoye_le: null })
  })

  it('migration 20261113 absente (colonne de l’adresse de contact) : comme un cabinet sans contact', async () => {
    baseQr.etat.colonnesAbsentes.signalements_qr_cabinets = ['diffusion_contact_email']
    const id = await idDepose(await deposer())
    expect(signalements()).toEqual([])
    verifierAlerteSansDonnees(id, 'Personne au cabinet ne l’a reçu')
  })

  it('erreur de lecture du cabinet de la copropriété : jamais le signalement complet vers VitFix, l’alerte part', async () => {
    baseQr.etat.fonctions.signalements_qr_emails_gestionnaires = () => {
      baseQr.etat.erreursPonctuelles.signalements_qr_coproprietes = { code: '08006', message: 'connexion perdue' }
      return { data: [] }
    }
    const res = await deposer()
    expect(res.status).toBe(200)
    expect(signalements()).toEqual([])
    verifierAlerteSansDonnees(await idDepose(res), 'Personne au cabinet ne l’a reçu')
  })

  it('un gestionnaire reçoit : ni lecture du repli, ni contact du cabinet, ni alerte', async () => {
    baseQr.etat.fonctions.signalements_qr_emails_gestionnaires = () => ({
      data: [{ gestionnaire_id: 'a0000000-0000-4000-8000-000000000001', email: 'gestionnaire@exemple.test', acces_ouvert: false, exclu: false }],
    })
    await deposer()
    expect(signalements().map((m) => m.to)).toEqual(['gestionnaire@exemple.test'])
    expect(alertes()).toEqual([])
    expect(baseQr.etat.lectures.filter((l) => l.colonnes === 'diffusion_contact_email')).toEqual([])
  })
})

describe('copropriété sans cabinet client : repli ADMIN_EMAIL inchangé', () => {
  it('copropriété sans cabinet : le signalement complet part à ADMIN_EMAIL, avec le bouton du tableau ; aucune alerte', async () => {
    baseQr.etat.tables.signalements_qr_coproprietes[0].cabinet_id = null
    await deposer()
    const [message] = signalements()
    expect(signalements().map((m) => m.to)).toEqual(['admin@exemple.test'])
    expect(message.html).toContain('Fuite d’eau au plafond de la cuisine')
    expect(message.html).toContain('https://vitfix.io/fr/aj-signalement/#signalements')
    expect(alertes()).toEqual([])
  })

  it('colonne cabinet_id absente (migration du 11/11/2026 non appliquée) : repli ADMIN_EMAIL d’avant', async () => {
    baseQr.etat.colonnesAbsentes.signalements_qr_coproprietes = ['cabinet_id']
    await deposer()
    expect(signalements().map((m) => m.to)).toEqual(['admin@exemple.test'])
    expect(alertes()).toEqual([])
  })
})
