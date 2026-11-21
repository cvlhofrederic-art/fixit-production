// tests/api/aj-signalement-depot-repli-cabinet.test.ts
//
// POST /api/aj-signalement/signalements — D9 (décision du 17/11/2026, au nom de VitFix, point 7) : repli vers les
// boîtes de VitFix COUPÉ pour une copropriété sans aucun destinataire.
//   - copropriété d'un cabinet client : le signalement part à l'adresse de contact du cabinet (diffusion_contact_email),
//     réponse directe au déclarant ;
//   - copropriété rattachée à aucun cabinet, ou colonne cabinet_id absente (relecture du 17/11/2026 : le code ne
//     distingue pas une copropriété d'essai de VitFix d'une copropriété du cabinet client pas encore rattachée) : le
//     signalement complet ne part plus à ADMIN_EMAIL ;
//   - VitFix (ADMIN_EMAIL) reçoit une alerte SANS AUCUNE DONNÉE : le numéro du tableau et l'identifiant technique, et une
//     phrase qui dit qui l'a reçu. Au plus une alerte par heure, par copropriété et par situation ; aucune quand la limite
//     d'envoi a retenu le signalement (l'alerte de limite part déjà, une fois) ;
//   - erreur de lecture : jamais le signalement complet vers VitFix, l'alerte le dit.
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
const { checkRateLimit } = await import('@/lib/rate-limit')
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
const OBJET_LIMITE = 'AJ Signalement — limite d’envoi atteinte'
/** Tout ce qui, dans un message, viendrait du signalement ou de la copropriété. */
const DONNEES = ['Prénom', 'Déclarant', '06 00 00 00 00', 'declarant@exemple.test', 'Fuite d’eau', 'Plomberie', 'Résidence Test', '1 rue Exemple', 'lot 7']
const PHRASES = {
  contactPrevenu: 'Il a été envoyé à l’adresse de contact du cabinet.',
  contactNonPrevenu: 'L’envoi à l’adresse de contact du cabinet a échoué : personne au cabinet ne l’a reçu.',
  sansContact: 'Le cabinet n’a pas d’adresse de contact : personne au cabinet ne l’a reçu.',
  sansCabinet: 'Cette copropriété n’est rattachée à aucun cabinet : personne ne l’a reçu par e-mail.',
  illisible: 'Le cabinet de cette copropriété n’a pas pu être lu : personne ne l’a reçu par e-mail.',
}

/** Limiteur simulé qui compte, pour la seule clé de l'alerte « en attente » ; les autres limites acceptent tout. */
const comptesAlerte = new Map<string, number>()

beforeEach(() => {
  reinitialiserSimulQr()
  simulQr.user = null
  reinitialiserReplisQr()
  baseQr.reinitialiser()
  comptesAlerte.clear()
  vi.mocked(checkRateLimit).mockClear()
  vi.mocked(checkRateLimit).mockImplementation(async (cle: string, limite = 20) => {
    simulQr.limites.push(cle)
    if (!cle.startsWith('qr_alerte_attente_')) return true
    const n = (comptesAlerte.get(cle) ?? 0) + 1
    comptesAlerte.set(cle, n)
    return n <= limite
  })
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
const numero = (id: string) => id.replace(/-/g, '').slice(0, 8).toUpperCase()

/** Les messages vers VitFix : la seule alerte, sans aucune donnée du signalement, avec son numéro et son identifiant. */
function verifierAlerteSansDonnees(id: string, phrase: string): void {
  expect(versVitfix()).toHaveLength(1)
  const [alerte] = alertes()
  expect(alerte.to).toBe('admin@exemple.test')
  expect(alerte.html).toContain(id)
  expect(alerte.html).toContain(`n° ${numero(id)}`)
  expect(alerte.html).toContain(phrase)
  expect(alerte.html).toContain('Demandez au cabinet, par écrit, qui doit recevoir les signalements de cette copropriété')
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
    verifierAlerteSansDonnees(id, PHRASES.contactPrevenu)
    expect(etatFinal()).toMatchObject({ email_envoye_le: expect.any(String), email_erreur: null })
    // Une alerte par heure au plus, par copropriété et par situation.
    expect(vi.mocked(checkRateLimit).mock.calls).toContainEqual([`qr_alerte_attente_${COPRO}_contact_prevenu`, 1, 3_600_000])
  })

  it('cabinet sans adresse de contact : aucun e-mail de signalement, erreur gardée, l’alerte le dit', async () => {
    baseQr.etat.tables.signalements_qr_cabinets[0].diffusion_contact_email = null
    const res = await deposer()
    expect(res.status).toBe(200)
    const id = await idDepose(res)
    expect(signalements()).toEqual([])
    verifierAlerteSansDonnees(id, PHRASES.sansContact)
    expect(etatFinal()).toMatchObject({ email_envoye_le: null, email_erreur: 'aucun destinataire configuré' })
    expect(simulQr.logger.error.mock.calls.some((c) => String(c[0]).includes('aucun destinataire'))).toBe(true)
    for (const donnee of DONNEES) expect(texteJournalServeurQr(), donnee).not.toContain(donnee)
  })

  it('adresse de contact refusée par le service d’e-mail : l’alerte dit que l’envoi a échoué', async () => {
    simulQr.resultatsLots = [{ sent: 0, failed: 1, errors: ['refus'] }]
    const id = await idDepose(await deposer())
    expect(signalements().map((m) => m.to)).toEqual([CONTACT])
    verifierAlerteSansDonnees(id, PHRASES.contactNonPrevenu)
    expect(etatFinal()).toMatchObject({ email_envoye_le: null })
  })

  it('migration 20261113 absente (colonne de l’adresse de contact) : comme un cabinet sans contact', async () => {
    baseQr.etat.colonnesAbsentes.signalements_qr_cabinets = ['diffusion_contact_email']
    const id = await idDepose(await deposer())
    expect(signalements()).toEqual([])
    verifierAlerteSansDonnees(id, PHRASES.sansContact)
  })

  it('erreur de lecture du cabinet de la copropriété : jamais le signalement complet vers VitFix, l’alerte le dit', async () => {
    baseQr.etat.fonctions.signalements_qr_emails_gestionnaires = () => {
      baseQr.etat.erreursPonctuelles.signalements_qr_coproprietes = { code: '08006', message: 'connexion perdue' }
      return { data: [] }
    }
    const res = await deposer()
    expect(res.status).toBe(200)
    expect(signalements()).toEqual([])
    verifierAlerteSansDonnees(await idDepose(res), PHRASES.illisible)
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

describe('copropriété rattachée à aucun cabinet : plus de signalement complet vers VitFix', () => {
  it('cabinet_id vide : aucun e-mail de signalement ; VitFix ne reçoit que l’alerte sans données', async () => {
    baseQr.etat.tables.signalements_qr_coproprietes[0].cabinet_id = null
    const res = await deposer()
    expect(res.status).toBe(200)
    const id = await idDepose(res)
    expect(signalements()).toEqual([])
    verifierAlerteSansDonnees(id, PHRASES.sansCabinet)
    expect(etatFinal()).toMatchObject({ email_envoye_le: null, email_erreur: 'aucun destinataire configuré' })
    // Le cabinet n'est pas lu : il n'y en a pas.
    expect(baseQr.etat.lectures.filter((l) => l.colonnes === 'diffusion_contact_email')).toEqual([])
  })

  it('colonne cabinet_id absente (migration du 11/11/2026 non appliquée) : de même', async () => {
    baseQr.etat.colonnesAbsentes.signalements_qr_coproprietes = ['cabinet_id']
    const id = await idDepose(await deposer())
    expect(signalements()).toEqual([])
    verifierAlerteSansDonnees(id, PHRASES.sansCabinet)
  })

  it('une adresse saisie reçoit : le signalement complet lui part, sans alerte (rien ne change)', async () => {
    Object.assign(baseQr.etat.tables.signalements_qr_coproprietes[0], { cabinet_id: null, emails_destinataires: ['conseil@exemple.test'] })
    await deposer()
    expect(signalements().map((m) => m.to)).toEqual(['conseil@exemple.test'])
    expect(alertes()).toEqual([])
  })
})

describe('alerte « en attente » : bornée (relecture du 17/11/2026)', () => {
  it('plusieurs dépôts sans contact dans l’heure : une seule alerte vers VitFix', async () => {
    baseQr.etat.tables.signalements_qr_cabinets[0].diffusion_contact_email = null
    for (let i = 0; i < 5; i++) expect((await deposer()).status).toBe(200)
    expect(baseQr.etat.tables.signalements_qr).toHaveLength(5)
    expect(versVitfix()).toHaveLength(1)
    expect(alertes()).toHaveLength(1)
    expect(simulQr.logger.info.mock.calls.some((c) => String(c[0]).includes('alerte déjà envoyée'))).toBe(true)
  })

  it('situation qui change dans l’heure (contact reçu, puis refusé) : une alerte par situation', async () => {
    await deposer()
    // Deuxième dépôt : le premier envoi (le signalement, à l'adresse de contact) est refusé.
    simulQr.resultatsLots = [{ sent: 0, failed: 1, errors: ['refus'] }]
    await deposer()
    const textes = alertes().map((m) => m.html)
    expect(textes).toHaveLength(2)
    expect(textes[0]).toContain(PHRASES.contactPrevenu)
    expect(textes[1]).toContain(PHRASES.contactNonPrevenu)
  })

  it('limite d’envoi atteinte : aucune alerte « en attente », seulement l’alerte de limite, une fois', async () => {
    let retenus = 0
    baseQr.etat.fonctions.signalements_qr_reserver_emails = () => ({ data: { accorde: false, retenus: retenus++ } })
    for (let i = 0; i < 5; i++) expect((await deposer()).status).toBe(200)
    expect(signalements()).toEqual([])
    expect(alertes()).toEqual([])
    expect(versVitfix().map((m) => m.subject)).toEqual([OBJET_LIMITE])
    expect(vi.mocked(checkRateLimit).mock.calls.some(([cle]) => cle.startsWith('qr_alerte_attente_'))).toBe(false)
  })
})
