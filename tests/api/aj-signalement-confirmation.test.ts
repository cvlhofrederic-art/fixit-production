// tests/api/aj-signalement-confirmation.test.ts
//
// Confirmation d'adresse d'un gestionnaire, routes PUBLIQUES appelées par la page
// vitfix.io/<identifiant>/confirmation-adresse/#<jeton> (le jeton est après le « # », jamais dans l'URL) :
//   POST /api/aj-signalement/confirmation/lecture   P1-R16  lecture SANS effet (un scanner qui ouvre le lien ne confirme rien)
//   POST /api/aj-signalement/confirmation           P1-R17  « C'est moi »
//   POST /api/aj-signalement/confirmation/refus     P1-R17b « Ce n'est pas moi » : fiche figée, alerte au super admin
// Corps { token, cabinet: <identifiant du chemin> } ; cabinet du chemin ≠ cabinet de la fiche → 404 générique ; lien
// d'un autre espace (syndic), signature fausse, envoi « acces », fiche désactivée → 404 ; expiré → 410 ; déjà
// confirmé → 409. La signature est la vraie (lib/equipe) ; les fonctions SQL sont simulées.

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
const { POST: LIRE } = await import('@/app/api/aj-signalement/confirmation/lecture/route')
const { POST: CONFIRMER } = await import('@/app/api/aj-signalement/confirmation/route')
const { POST: REFUSER } = await import('@/app/api/aj-signalement/confirmation/refus/route')
const { nouvelleInvitation } = await import('@/lib/equipe/lien-invitation')

const CAB = 'ca000000-0000-4000-8000-000000000001'
const CAB_AUTRE = 'ca000000-0000-4000-8000-000000000002'
const G = 'a0000000-0000-4000-8000-000000000001'
const EMAIL = 'marie.exemple@exemple.test'

let jeton = ''
let idEnvoi = ''

async function preparerEnvoi(sur: Record<string, unknown> = {}, espace: 'aj_signalement' | 'syndic' = 'aj_signalement') {
  const inv = await nouvelleInvitation(espace, EMAIL, G)
  baseQr.table('signalements_qr_invitations').push({
    id: inv.id, gestionnaire_id: G, objet: 'confirmation_adresse', email: EMAIL, full_name: 'Marie Exemple', role: 'gestionnaire_signalement',
    invite_token: inv.invite_token, created_at: new Date().toISOString(), invite_sent_at: new Date().toISOString(), accepted_at: null, refus: null,
    ...sur,
  })
  jeton = inv.jetonLien
  idEnvoi = inv.id
}

beforeEach(async () => {
  reinitialiserSimulQr()
  simulQr.user = null
  baseQr.reinitialiser()
  vi.unstubAllEnvs()
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'cle-de-service-de-test')
  vi.stubEnv('ADMIN_EMAIL', 'admin@exemple.test')
  vi.stubEnv('ADMIN_EMAIL_2', 'second@exemple.test')
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://vitfix.io')
  baseQr.etat.tables.signalements_qr_cabinets = [
    { id: CAB, nom: 'Cabinet Exemple', identifiant: 'cabinet-exemple', langue: 'fr' },
    { id: CAB_AUTRE, nom: 'Autre Cabinet', identifiant: 'autre-cabinet', langue: 'fr' },
  ]
  baseQr.etat.tables.signalements_qr_gestionnaires = [
    { id: G, cabinet_id: CAB, nom: 'Marie Exemple', email: EMAIL, actif: true, adresse_confirmee_le: null, adresse_contestee_le: null },
  ]
  baseQr.etat.fonctions.signalements_qr_confirmer_adresse = (a) => {
    const envoi = baseQr.table('signalements_qr_invitations').find((i) => i.id === a.p_invitation)
    if (!envoi || envoi.accepted_at || !envoi.invite_token) return { data: false }
    Object.assign(envoi, { accepted_at: new Date().toISOString(), invite_token: null })
    Object.assign(baseQr.table('signalements_qr_gestionnaires')[0], { adresse_confirmee_le: new Date().toISOString() })
    return { data: true }
  }
  baseQr.etat.fonctions.signalements_qr_contester_adresse = (a) => {
    const envoi = baseQr.table('signalements_qr_invitations').find((i) => i.id === a.p_invitation)
    if (!envoi || envoi.refus || !envoi.invite_token) return { data: false }
    Object.assign(envoi, { refus: 'pas_moi', invite_token: null })
    Object.assign(baseQr.table('signalements_qr_gestionnaires')[0], { adresse_contestee_le: new Date().toISOString() })
    return { data: true }
  }
  await preparerEnvoi()
})

const corps = (sur: Record<string, unknown> = {}) => ({ token: jeton, cabinet: 'cabinet-exemple', ...sur })
const lire = (c: unknown) => LIRE(requeteQr('/api/aj-signalement/confirmation/lecture', 'POST', c))
const confirmer = (c: unknown) => CONFIRMER(requeteQr('/api/aj-signalement/confirmation', 'POST', c))
const refuser = (c: unknown) => REFUSER(requeteQr('/api/aj-signalement/confirmation/refus', 'POST', c))

describe('lecture (P1-R16)', () => {
  it('nom court, nom du cabinet, adresse masquée ; AUCUNE écriture ni fonction appelée', async () => {
    const res = await lire(corps())
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    expect(await res.json()).toEqual({ nomCourt: 'Marie E.', cabinet: 'Cabinet Exemple', email: 'ma***@exemple.test' })
    expect(baseQr.etat.ecritures).toEqual([])
    expect(baseQr.etat.appelsRpc).toEqual([])
  })

  it('cabinet du chemin ≠ cabinet de la fiche : 404 générique', async () => {
    const res = await lire(corps({ cabinet: 'autre-cabinet' }))
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'introuvable' })
  })

  it('corps sans cabinet, jeton mal formé ou clé inconnue : 400', async () => {
    expect((await lire({ token: jeton })).status).toBe(400)
    expect((await lire(corps({ token: 'abc' }))).status).toBe(400)
    expect((await lire(corps({ gestionnaireId: G }))).status).toBe(400)
  })

  it('signature fausse, lien d’un autre espace (syndic), envoi « acces » : 404', async () => {
    const faux = `${jeton.split('.')[0]}.${'0'.repeat(64)}`
    expect((await lire(corps({ token: faux }))).status).toBe(404)
    baseQr.reinitialiser()
    baseQr.etat.tables.signalements_qr_cabinets = [{ id: CAB, nom: 'Cabinet Exemple', identifiant: 'cabinet-exemple', langue: 'fr' }]
    baseQr.etat.tables.signalements_qr_gestionnaires = [{ id: G, cabinet_id: CAB, nom: 'Marie Exemple', email: EMAIL, actif: true, adresse_confirmee_le: null, adresse_contestee_le: null }]
    await preparerEnvoi({}, 'syndic')
    expect((await lire(corps())).status).toBe(404)
    await preparerEnvoi({ objet: 'acces' })
    expect((await lire(corps())).status).toBe(404)
  })

  it('fiche désactivée ou contestée : 404 ; lien expiré (plus de 7 jours) : 410 ; déjà confirmé : 409', async () => {
    Object.assign(baseQr.table('signalements_qr_gestionnaires')[0], { actif: false })
    expect((await lire(corps())).status).toBe(404)
    Object.assign(baseQr.table('signalements_qr_gestionnaires')[0], { actif: true, adresse_contestee_le: '2026-11-10T10:00:00+00:00' })
    expect((await lire(corps())).status).toBe(404)
    Object.assign(baseQr.table('signalements_qr_gestionnaires')[0], { adresse_contestee_le: null })
    Object.assign(baseQr.table('signalements_qr_invitations')[0], { created_at: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString() })
    const expire = await lire(corps())
    expect(expire.status).toBe(410)
    expect(await expire.json()).toEqual({ error: 'expire' })
    Object.assign(baseQr.table('signalements_qr_invitations')[0], { created_at: new Date().toISOString(), accepted_at: new Date().toISOString() })
    const deja = await lire(corps())
    expect(deja.status).toBe(409)
    expect(await deja.json()).toEqual({ error: 'deja_confirmee' })
  })

  it.each([
    ['expiré', { created_at: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString() }],
    ['déjà utilisé', { accepted_at: new Date().toISOString() }],
  ])('relecture 3 : lien %s d’un autre cabinet, présenté sous /autre-cabinet/ : le même 404 générique (ni 410 ni 409)', async (_cas, etat) => {
    Object.assign(baseQr.table('signalements_qr_invitations')[0], etat)
    for (const route of [lire, confirmer, refuser]) {
      const res = await route(corps({ cabinet: 'autre-cabinet' }))
      expect(res.status).toBe(404)
      expect(await res.json()).toEqual({ error: 'introuvable' })
    }
    expect(baseQr.etat.appelsRpc).toEqual([])
    // Sous SON chemin, le même lien garde son code (410 expiré, 409 déjà utilisé).
    expect([409, 410]).toContain((await lire(corps())).status)
  })

  it('limite par IP : 20 par minute', async () => {
    simulQr.refuser = ['qr_confirmation_lecture_']
    expect((await lire(corps())).status).toBe(429)
  })
})

describe('« C’est moi » (P1-R17)', () => {
  it('confirme par la fonction SQL ; le même lien ne vaut plus rien ensuite', async () => {
    const res = await confirmer(corps())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ confirmee: true })
    expect(baseQr.etat.appelsRpc).toEqual([{ nom: 'signalements_qr_confirmer_adresse', args: { p_invitation: idEnvoi } }])
    expect((await confirmer(corps())).status).toBe(404)
  })

  it('cabinet du chemin ≠ celui de la fiche : 404, aucune fonction appelée', async () => {
    expect((await confirmer(corps({ cabinet: 'autre-cabinet' }))).status).toBe(404)
    expect(baseQr.etat.appelsRpc).toEqual([])
  })

  it('limite par IP : 5 par minute', async () => {
    simulQr.refuser = ['qr_confirmation_post_']
    expect((await confirmer(corps())).status).toBe(429)
  })
})

describe('« Ce n’est pas moi » (P1-R17b)', () => {
  it('fiche figée par la fonction SQL, alerte à chaque adresse d’administrateur sans nom ni adresse, lien inutilisable ensuite', async () => {
    const res = await refuser(corps())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ contestee: true })
    expect(baseQr.etat.appelsRpc).toEqual([{ nom: 'signalements_qr_contester_adresse', args: { p_invitation: idEnvoi } }])
    const alertes = messagesEnvoyesQr()
    expect(alertes.map((m) => m.to)).toEqual(['admin@exemple.test', 'second@exemple.test'])
    for (const m of alertes) {
      expect(m.subject).toBe('AJ Signalement — adresse de gestionnaire contestée')
      expect(m.html).toContain('Une adresse de gestionnaire a été contestée par son destinataire')
      expect(m.html).toContain(`https://vitfix.io/fr/aj-signalement/#gestionnaire/${G}`)
      expect(m.html).not.toMatch(/marie|exemple\.test/i)
    }
    expect((await confirmer(corps())).status).toBe(404)
    expect(texteJournalServeurQr()).not.toMatch(/marie/i)
  })

  it('alerte impossible (service d’e-mail en panne) : la contestation reste acquise (200)', async () => {
    simulQr.resultatsLots = [{ sent: 0, failed: 2, errors: ['panne'] }, { sent: 0, failed: 1, errors: ['panne'] }, { sent: 0, failed: 1, errors: ['panne'] }]
    const res = await refuser(corps())
    expect(res.status).toBe(200)
    expect(texteJournalServeurQr()).not.toContain('panne')
  })
})
