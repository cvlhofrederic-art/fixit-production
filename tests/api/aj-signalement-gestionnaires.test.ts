// tests/api/aj-signalement-gestionnaires.test.ts
//
// Fiches gestionnaires vues du super admin (PR 1 ; demandes de Hugo du 10/11/2026 : chaque gestionnaire reçoit
// automatiquement les signalements de ses copropriétés, une fois son adresse confirmée, et seulement sur un domaine
// e-mail de SON cabinet) :
//   GET   /gestionnaires                     P1-R8  liste, état calculé, jamais invite_token
//   POST  /gestionnaires                     P1-R9  création + premier envoi de confirmation (lien du chemin client)
//   GET   /gestionnaires/[id]                P1-R10 fiche, envois, attributions, créations, journal
//   PATCH /gestionnaires/[id]                P1-R11 nom · réactivation · pseudonymisation (fiche désactivée seulement)
//   POST  /gestionnaires/[id]/confirmation   P1-R12 renvoi du lien (anciens liens caducs)
//   PUT   /gestionnaires/[id]/coproprietes   P1-R13 attributions de la fiche
//   POST  /gestionnaires/[id]/depart         P1-R14 départ : une succession par copropriété
//   GET   /gestionnaires/[id]/export         P1-R15 export RGPD
// Les fonctions SQL sont simulées (règles visibles depuis la route) ; la signature du lien est la vraie (lib/equipe).

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/supabase-server', async () => ({ supabaseAdmin: (await import('../helpers/aj-signalement-base')).baseQr.client }))
vi.mock('@/lib/supabase-server-component', async () => (await import('../helpers/aj-signalement-routes')).mockCookies())
vi.mock('@/lib/auth-helpers', async () => (await import('../helpers/aj-signalement-routes')).mockAuth())
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/aj-signalement-routes')).mockLimites())
vi.mock('@/lib/email', async () => (await import('../helpers/aj-signalement-routes')).mockEmail())
vi.mock('@/lib/logger', async () => (await import('../helpers/aj-signalement-routes')).mockLogger())

const { baseQr } = await import('../helpers/aj-signalement-base')
const R = await import('../helpers/aj-signalement-routes')
const { ADMIN_QR, contexteQr, messagesEnvoyesQr, reinitialiserSimulQr, requeteQr, simulQr, texteJournalServeurQr } = R
const { GET: LISTE, POST: CREER } = await import('@/app/api/aj-signalement/gestionnaires/route')
const { GET: FICHE, PATCH: MODIFIER } = await import('@/app/api/aj-signalement/gestionnaires/[id]/route')
const { POST: RENVOYER } = await import('@/app/api/aj-signalement/gestionnaires/[id]/confirmation/route')
const { PUT: ATTRIBUER } = await import('@/app/api/aj-signalement/gestionnaires/[id]/coproprietes/route')
const { POST: DEPART } = await import('@/app/api/aj-signalement/gestionnaires/[id]/depart/route')
const { GET: EXPORT } = await import('@/app/api/aj-signalement/gestionnaires/[id]/export/route')
const { lireInvitationValide } = await import('@/lib/equipe/invitation-serveur')

const CAB = 'ca000000-0000-4000-8000-000000000001'
const CAB_AUTRE = 'ca000000-0000-4000-8000-000000000002'
const COPRO_A = 'c0000000-0000-4000-8000-00000000000a'
const COPRO_TOUS = 'c0000000-0000-4000-8000-00000000000b'
const COPRO_AUTRE = 'c0000000-0000-4000-8000-00000000000c'
const G_MARIE = 'a0000000-0000-4000-8000-000000000001'
const G_CONTESTEE = 'a0000000-0000-4000-8000-000000000002'
const G_PARTI = 'a0000000-0000-4000-8000-000000000003'
const JETON_LIGNE = 'b'.repeat(48)
const ERREUR_METIER = (message: string) => ({ error: { code: 'P0001', message } })

const NOUVELLE = { nom: 'Julie Nouvelle', email: 'Julie.Nouvelle@Exemple.test', cabinetId: CAB }

beforeEach(() => {
  reinitialiserSimulQr()
  baseQr.reinitialiser()
  vi.unstubAllEnvs()
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'cle-de-service-de-test')
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://vitfix.io')
  vi.stubEnv('ADMIN_EMAIL', 'admin@exemple.test')
  vi.stubEnv('ADMIN_EMAIL_2', '')
  const t = baseQr.etat.tables
  t.signalements_qr_cabinets = [
    { id: CAB, nom: 'Cabinet Exemple', identifiant: 'cabinet-exemple', langue: 'fr' },
    { id: CAB_AUTRE, nom: 'Autre Cabinet', identifiant: 'autre-cabinet', langue: 'fr' },
  ]
  t.signalements_qr_domaines_autorises = [
    { cabinet_id: CAB, domaine: 'exemple.test' },
    { cabinet_id: CAB_AUTRE, domaine: 'autre-exemple.test' },
  ]
  t.signalements_qr_coproprietes = [
    { id: COPRO_A, nom: 'Résidence Exemple', cabinet_id: CAB, attribuee_a_tous: false, emails_destinataires: ['julie.nouvelle@exemple.test'], cree_par_gestionnaire_id: null },
    { id: COPRO_TOUS, nom: 'Résidence Test', cabinet_id: CAB, attribuee_a_tous: true, emails_destinataires: [], cree_par_gestionnaire_id: G_MARIE },
    { id: COPRO_AUTRE, nom: 'Résidence Ailleurs', cabinet_id: CAB_AUTRE, attribuee_a_tous: false, emails_destinataires: [], cree_par_gestionnaire_id: null },
  ]
  t.signalements_qr_gestionnaires = [
    {
      id: G_MARIE, cabinet_id: CAB, nom: 'Marie Exemple', email: 'marie.exemple@exemple.test', actif: true, domaine_force: false,
      adresse_confirmee_le: '2026-11-10T10:00:00+00:00', adresse_contestee_le: null, pseudonymise_le: null, created_at: '2026-11-10T09:00:00+00:00',
    },
    {
      id: G_CONTESTEE, cabinet_id: CAB, nom: 'Paul Conteste', email: 'paul.conteste@exemple.test', actif: true, domaine_force: false,
      adresse_confirmee_le: null, adresse_contestee_le: '2026-11-10T11:00:00+00:00', pseudonymise_le: null, created_at: '2026-11-10T09:05:00+00:00',
    },
    {
      id: G_PARTI, cabinet_id: CAB, nom: 'Luc Parti', email: 'luc.parti@exemple.test', actif: false, domaine_force: false,
      adresse_confirmee_le: '2026-11-01T10:00:00+00:00', adresse_contestee_le: null, pseudonymise_le: null, created_at: '2026-11-01T09:00:00+00:00',
    },
  ]
  t.signalements_qr_invitations = [
    { id: 'e0000000-0000-4000-8000-000000000001', gestionnaire_id: G_MARIE, objet: 'confirmation_adresse', email: 'marie.exemple@exemple.test', invite_token: null, created_at: '2026-11-10T09:00:00+00:00', invite_sent_at: '2026-11-10T09:00:01+00:00', accepted_at: '2026-11-10T10:00:00+00:00', refus: null },
    { id: 'e0000000-0000-4000-8000-000000000002', gestionnaire_id: G_CONTESTEE, objet: 'confirmation_adresse', email: 'paul.conteste@exemple.test', invite_token: JETON_LIGNE, created_at: '2026-11-10T09:05:00+00:00', invite_sent_at: '2026-11-10T09:05:01+00:00', accepted_at: null, refus: 'pas_moi' },
  ]
  t.signalements_qr_attributions = [{ copropriete_id: COPRO_A, gestionnaire_id: G_MARIE, origine: 'super_admin', created_at: '2026-11-10T09:10:00+00:00' }]
  t.signalements_qr_journal = []
  baseQr.etat.fonctions.signalements_qr_compteurs = (a) => ({
    data: (a.p_ids as string[]).map((id) => ({ copropriete_id: id, total: 3, en_attente: 1, ouverts: 2, urgents_ouverts: 1, attente_48h: 0, dernier: '2026-11-10T12:00:00+00:00' })),
  })
  baseQr.etat.fonctions.signalements_qr_inviter_gestionnaire = (a) => {
    const g = a.p_gestionnaire as Record<string, unknown>
    const inv = a.p_invitation as Record<string, unknown>
    if (baseQr.table('signalements_qr_gestionnaires').some((f) => f.email === g.email)) {
      return { error: { code: '23505', message: 'duplicate key value violates unique constraint "uq_signalements_qr_gestionnaires_email"' } }
    }
    baseQr.table('signalements_qr_gestionnaires').push({
      id: g.id, cabinet_id: g.cabinetId, nom: g.nom, email: g.email, actif: true, domaine_force: g.domaineForce,
      adresse_confirmee_le: null, adresse_contestee_le: null, pseudonymise_le: null, created_at: '2026-11-11T10:00:00+00:00',
    })
    baseQr.table('signalements_qr_invitations').push({
      id: inv.id, gestionnaire_id: g.id, objet: 'confirmation_adresse', email: inv.email, full_name: g.nom, role: 'gestionnaire_signalement',
      invite_token: inv.invite_token, created_at: new Date().toISOString(), invite_sent_at: null, accepted_at: null, refus: null,
    })
    for (const c of a.p_coproprietes as string[]) baseQr.table('signalements_qr_attributions').push({ copropriete_id: c, gestionnaire_id: g.id, origine: 'super_admin' })
    return { data: g.id }
  }
})

const creer = (corps: unknown) => CREER(requeteQr('/api/aj-signalement/gestionnaires', 'POST', corps))
const jetonDuMessage = (html: string): string => {
  const m = /confirmation-adresse\/#([a-f0-9]{48}\.[a-f0-9]{64})/.exec(html)
  if (!m) throw new Error('lien absent')
  return m[1]
}

describe('POST gestionnaires (P1-R9)', () => {
  it('crée la fiche avec l’id tiré par la route, signé dans le lien ; le lien suit le chemin du cabinet ; ni lien ni jeton dans la réponse', async () => {
    const res = await creer({ ...NOUVELLE, coproprieteIds: [COPRO_A] })
    expect(res.status).toBe(201)
    const appel = baseQr.etat.appelsRpc.find((a) => a.nom === 'signalements_qr_inviter_gestionnaire')
    const g = appel?.args.p_gestionnaire as Record<string, unknown>
    const inv = appel?.args.p_invitation as Record<string, unknown>
    expect(g).toEqual({ id: expect.stringMatching(/^[0-9a-f-]{36}$/), cabinetId: CAB, nom: 'Julie Nouvelle', email: 'julie.nouvelle@exemple.test', domaineForce: false })
    expect(inv).toEqual({ id: expect.any(String), invite_token: expect.stringMatching(/^[a-f0-9]{48}$/), email: 'julie.nouvelle@exemple.test' })
    expect(appel?.args.p_coproprietes).toEqual([COPRO_A])
    expect(appel?.args.p_acteur).toBe(ADMIN_QR.id)

    const messages = messagesEnvoyesQr()
    expect(messages).toHaveLength(1)
    expect(messages[0].to).toBe('julie.nouvelle@exemple.test')
    expect(messages[0].subject).toBe('AJ Signalement — Cabinet Exemple : confirmez votre adresse')
    expect(messages[0].html).toContain('https://vitfix.io/cabinet-exemple/confirmation-adresse/#')
    expect(messages[0].html).toContain('Julie N.')
    // Le jeton du lien, produit à la création, est accepté sur la ligne d'envoi réellement insérée.
    const jeton = jetonDuMessage(messages[0].html)
    const lecture = await lireInvitationValide('aj_signalement', jeton)
    expect(lecture.ok).toBe(true)
    if (lecture.ok) expect(lecture.invite.equipe_id).toBe(g.id)
    // Mais pas pour un autre espace.
    expect((await lireInvitationValide('syndic', jeton)).ok).toBe(false)

    const corps = await res.json()
    const texte = JSON.stringify(corps)
    expect(texte).not.toContain(String(inv.invite_token))
    expect(texte).not.toContain(jeton)
    expect(texte).not.toContain('confirmation-adresse')
    expect(corps).toMatchObject({
      emailEnvoye: true,
      gestionnaire: { id: g.id, nom: 'Julie Nouvelle', email: 'julie.nouvelle@exemple.test', etat: 'confirmation_envoyee', cabinet: { id: CAB, identifiant: 'cabinet-exemple' } },
      coproprietesAvecAdresseSaisie: [{ id: COPRO_A, nom: 'Résidence Exemple' }],
    })
    // Après l'envoi : invite_sent_at posé, journal de l'envoi.
    expect(baseQr.table('signalements_qr_invitations').find((i) => i.id === inv.id)?.invite_sent_at).toEqual(expect.any(String))
    expect(baseQr.table('signalements_qr_journal')).toContainEqual(expect.objectContaining({ action: 'gestionnaire.confirmation_envoyee', gestionnaire_id: g.id, acteur_id: ADMIN_QR.id }))
    // Aucun nom ni aucune adresse au journal serveur.
    expect(texteJournalServeurQr()).not.toMatch(/julie/i)
  })

  it('cabinetId absent : 400 ; id ou jeton fournis par le corps : 400', async () => {
    expect((await creer({ nom: 'Julie Nouvelle', email: 'julie.nouvelle@exemple.test' })).status).toBe(400)
    expect((await creer({ ...NOUVELLE, id: G_MARIE })).status).toBe(400)
    expect(baseQr.etat.appelsRpc).toEqual([])
  })

  it('adresse de l’administrateur (ADMIN_EMAIL) : 409 adresse_reservee', async () => {
    const res = await creer({ ...NOUVELLE, email: 'Admin@Exemple.test' })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'adresse_reservee' })
  })

  it('adresse déjà en table : 409 existe_deja avec l’id de la fiche (« Réactiver »)', async () => {
    const res = await creer({ ...NOUVELLE, email: 'luc.parti@exemple.test' })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'existe_deja', id: G_PARTI })
  })

  it('cabinet sans domaine : 409 domaines_a_renseigner', async () => {
    baseQr.etat.tables.signalements_qr_domaines_autorises = [{ cabinet_id: CAB_AUTRE, domaine: 'autre-exemple.test' }]
    const res = await creer(NOUVELLE)
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'domaines_a_renseigner' })
  })

  it('domaine déclaré par un AUTRE cabinet client : 409 domaine_autre_cabinet, même avec forcerDomaine (relecture 2)', async () => {
    for (const forcerDomaine of [false, true]) {
      const refus = await creer({ ...NOUVELLE, email: 'julie@autre-exemple.test', forcerDomaine })
      expect(refus.status).toBe(409)
      expect(await refus.json()).toEqual({ error: 'domaine_autre_cabinet' })
    }
    expect(baseQr.etat.appelsRpc.filter((a) => a.nom === 'signalements_qr_inviter_gestionnaire')).toEqual([])
    expect(baseQr.table('signalements_qr_gestionnaires').some((f) => f.email === 'julie@autre-exemple.test')).toBe(false)
  })

  it('domaine d’AUCUN cabinet : 409 hors_domaine ; forcerDomaine : 201, fiche « domaine forcé »', async () => {
    const refus = await creer({ ...NOUVELLE, email: 'julie@ailleurs.test' })
    expect(refus.status).toBe(409)
    expect(await refus.json()).toEqual({ error: 'hors_domaine' })
    expect(baseQr.etat.appelsRpc.filter((a) => a.nom === 'signalements_qr_inviter_gestionnaire')).toEqual([])
    const force = await creer({ ...NOUVELLE, email: 'julie@ailleurs.test', forcerDomaine: true })
    expect(force.status).toBe(201)
    const appel = baseQr.etat.appelsRpc.find((a) => a.nom === 'signalements_qr_inviter_gestionnaire')
    expect((appel?.args.p_gestionnaire as Record<string, unknown>).domaineForce).toBe(true)
    expect((await force.json()).gestionnaire.domaineForce).toBe(true)
  })

  it('lecture des domaines en échec (autre que table absente) : 500, rien n’est créé (relecture 4)', async () => {
    baseQr.etat.erreursPonctuelles.signalements_qr_domaines_autorises = { code: '57014', message: 'canceling statement due to statement timeout' }
    const res = await creer(NOUVELLE)
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'serveur' })
    expect(baseQr.etat.appelsRpc.filter((a) => a.nom === 'signalements_qr_inviter_gestionnaire')).toEqual([])
  })

  it('sous-domaine refusé (égalité exacte du domaine, comme la fonction SQL)', async () => {
    expect((await creer({ ...NOUVELLE, email: 'julie@agence.exemple.test' })).status).toBe(409)
  })

  it('e-mail refusé par le service : 201, emailEnvoye false, invite_sent_at reste vide (fiche « à renvoyer »)', async () => {
    simulQr.resultatsLots = [{ sent: 0, failed: 1, errors: ['Resend: adresse julie.nouvelle@exemple.test refusée'] }, { sent: 0, failed: 1, errors: ['idem'] }]
    const res = await creer(NOUVELLE)
    expect(res.status).toBe(201)
    const corps = await res.json()
    expect(corps.emailEnvoye).toBe(false)
    expect(corps.gestionnaire.etat).toBe('confirmation_expiree')
    expect(baseQr.table('signalements_qr_invitations').filter((i) => i.invite_sent_at === null)).toHaveLength(1)
    expect(texteJournalServeurQr()).not.toContain('@')
  })

  it('clé de signature absente : 500, aucune écriture (la signature est tirée avant)', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
    const res = await creer(NOUVELLE)
    expect(res.status).toBe(500)
    expect(baseQr.etat.appelsRpc.filter((a) => a.nom === 'signalements_qr_inviter_gestionnaire')).toEqual([])
  })

  it('course sur l’adresse : 23505 de l’index unique → 409 existe_deja', async () => {
    baseQr.etat.fonctions.signalements_qr_inviter_gestionnaire = () => ({
      error: { code: '23505', message: 'duplicate key value violates unique constraint "uq_signalements_qr_gestionnaires_email"' },
    })
    const res = await creer(NOUVELLE)
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('existe_deja')
  })

  it('limite : 20 créations par heure et par compte', async () => {
    simulQr.refuser = [`qr_gestionnaire_post_${ADMIN_QR.id}`]
    expect((await creer(NOUVELLE)).status).toBe(429)
  })
})

describe('GET gestionnaires (P1-R8)', () => {
  it('fiches actives par défaut, adresse contestée en tête, état calculé, compteurs ; jamais de jeton ; jamais en cache', async () => {
    const res = await LISTE(requeteQr('/api/aj-signalement/gestionnaires'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    const { gestionnaires } = await res.json()
    expect(gestionnaires.map((g: { id: string }) => g.id)).toEqual([G_CONTESTEE, G_MARIE])
    expect(gestionnaires[1]).toEqual({
      id: G_MARIE, nom: 'Marie Exemple', email: 'marie.exemple@exemple.test', etat: 'adresse_confirmee', domaineForce: false,
      cabinet: { id: CAB, nom: 'Cabinet Exemple', identifiant: 'cabinet-exemple' },
      // Une copropriété attribuée ; portée = attribuée ∪ « à tous » du même cabinet (2 × 2 ouverts, 2 × 1 urgent).
      coproprietes: 1, ouverts: 4, urgents: 2, creeLe: '2026-11-10T09:00:00+00:00', confirmeeLe: '2026-11-10T10:00:00+00:00',
    })
    expect(gestionnaires[0].etat).toBe('adresse_contestee')
    expect(JSON.stringify(gestionnaires)).not.toContain(JETON_LIGNE)
    expect(JSON.stringify(gestionnaires)).not.toContain('invite_token')
  })

  it('etat=desactives, etat=tous, filtre par cabinet ; paramètre inconnu : 400', async () => {
    const desactives = await (await LISTE(requeteQr('/api/aj-signalement/gestionnaires?etat=desactives'))).json()
    expect(desactives.gestionnaires.map((g: { id: string; etat: string }) => [g.id, g.etat])).toEqual([[G_PARTI, 'desactive']])
    const tous = await (await LISTE(requeteQr('/api/aj-signalement/gestionnaires?etat=tous'))).json()
    expect(tous.gestionnaires).toHaveLength(3)
    const autre = await (await LISTE(requeteQr(`/api/aj-signalement/gestionnaires?cabinet=${CAB_AUTRE}`))).json()
    expect(autre.gestionnaires).toEqual([])
    expect((await LISTE(requeteQr('/api/aj-signalement/gestionnaires?vue_en_tant_que=1'))).status).toBe(400)
  })

  it('compteurs indisponibles (fonction absente) : 0, la liste reste servie', async () => {
    delete baseQr.etat.fonctions.signalements_qr_compteurs
    const { gestionnaires } = await (await LISTE(requeteQr('/api/aj-signalement/gestionnaires'))).json()
    expect(gestionnaires[1]).toMatchObject({ ouverts: 0, urgents: 0 })
  })

  it('tables absentes : 503 base_absente', async () => {
    baseQr.etat.tablesAbsentes = ['signalements_qr_gestionnaires']
    expect((await LISTE(requeteQr('/api/aj-signalement/gestionnaires'))).status).toBe(503)
  })
})

describe('GET gestionnaires/[id] (P1-R10)', () => {
  it('fiche, envois sans jeton, attributions avec origine, créations, extrait du journal', async () => {
    baseQr.etat.tables.signalements_qr_journal = [
      { id: 7, cabinet_id: CAB, acteur_id: ADMIN_QR.id, acteur_profil: 'super_admin', acteur_gestionnaire_id: null, action: 'gestionnaire.cree', copropriete_id: null, gestionnaire_id: G_CONTESTEE, signalement_id: null, operation_id: null, champs: [], details: {}, created_at: '2026-11-10T09:05:00+00:00' },
    ]
    const res = await FICHE(requeteQr(`/api/aj-signalement/gestionnaires/${G_CONTESTEE}`), contexteQr(G_CONTESTEE))
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    const corps = await res.json()
    expect(corps.gestionnaire).toMatchObject({ id: G_CONTESTEE, etat: 'adresse_contestee' })
    expect(corps.envois).toEqual([{ objet: 'confirmation_adresse', creeLe: '2026-11-10T09:05:00+00:00', envoyeLe: '2026-11-10T09:05:01+00:00', accepteLe: null, refus: 'pas_moi' }])
    expect(corps.journal).toEqual([expect.objectContaining({ id: '7', action: 'gestionnaire.cree', gestionnaireId: G_CONTESTEE })])
    expect(JSON.stringify(corps)).not.toContain(JETON_LIGNE)

    const marie = await (await FICHE(requeteQr(`/api/aj-signalement/gestionnaires/${G_MARIE}`), contexteQr(G_MARIE))).json()
    expect(marie.attributions).toEqual([{ coproprieteId: COPRO_A, nom: 'Résidence Exemple', origine: 'super_admin', creeLe: '2026-11-10T09:10:00+00:00' }])
    expect(marie.creations).toEqual([{ id: COPRO_TOUS, nom: 'Résidence Test' }])
  })

  it('fiche inconnue : 404', async () => {
    const id = 'a0000000-0000-4000-8000-00000000dead'
    expect((await FICHE(requeteQr(`/api/aj-signalement/gestionnaires/${id}`), contexteQr(id))).status).toBe(404)
  })
})

describe('PATCH gestionnaires/[id] (P1-R11)', () => {
  const modifier = (id: string, corps: unknown) => MODIFIER(requeteQr(`/api/aj-signalement/gestionnaires/${id}`, 'PATCH', corps), contexteQr(id))

  it('nom : modifié et journalisé sans valeur', async () => {
    const res = await modifier(G_MARIE, { nom: 'Marie Exemple-Dupont' })
    expect(res.status).toBe(200)
    expect(baseQr.table('signalements_qr_gestionnaires').find((g) => g.id === G_MARIE)?.nom).toBe('Marie Exemple-Dupont')
    const ligne = baseQr.table('signalements_qr_journal').find((j) => j.action === 'gestionnaire.modifie')
    expect(ligne).toMatchObject({ gestionnaire_id: G_MARIE, champs: ['nom'], acteur_id: ADMIN_QR.id })
    expect(JSON.stringify(ligne)).not.toContain('Dupont')
  })

  it('une seule action à la fois ; email jamais modifiable : 400', async () => {
    expect((await modifier(G_MARIE, { nom: 'X', actif: true })).status).toBe(400)
    expect((await modifier(G_MARIE, { email: 'autre@exemple.test' })).status).toBe(400)
  })

  it('pseudonymiser une fiche active : 409 fiche_active (faire d’abord le départ)', async () => {
    const res = await modifier(G_MARIE, { pseudonymiser: true })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'fiche_active' })
  })

  it('pseudonymiser une fiche désactivée : nom et e-mail effacés, envois supprimés, journal', async () => {
    baseQr.table('signalements_qr_invitations').push({ id: 'e0000000-0000-4000-8000-000000000009', gestionnaire_id: G_PARTI, objet: 'confirmation_adresse', email: 'luc.parti@exemple.test', invite_token: null, created_at: '2026-11-01T09:00:00+00:00' })
    const res = await modifier(G_PARTI, { pseudonymiser: true })
    expect(res.status).toBe(200)
    const fiche = baseQr.table('signalements_qr_gestionnaires').find((g) => g.id === G_PARTI)
    expect(fiche).toMatchObject({ nom: null, email: null, pseudonymise_le: expect.any(String) })
    expect(baseQr.table('signalements_qr_invitations').filter((i) => i.gestionnaire_id === G_PARTI)).toEqual([])
    expect(baseQr.table('signalements_qr_journal')).toContainEqual(expect.objectContaining({ action: 'gestionnaire.pseudonymise', gestionnaire_id: G_PARTI }))
  })

  it('réactiver : fonction appelée ; fiche pseudonymisée : 409 fiche_effacee', async () => {
    baseQr.etat.fonctions.signalements_qr_reactiver_gestionnaire = () => ({ data: true })
    expect((await modifier(G_PARTI, { actif: true })).status).toBe(200)
    expect(baseQr.etat.appelsRpc).toContainEqual({ nom: 'signalements_qr_reactiver_gestionnaire', args: { p_id: G_PARTI, p_acteur: ADMIN_QR.id } })
    const fiche = baseQr.table('signalements_qr_gestionnaires').find((g) => g.id === G_PARTI)
    Object.assign(fiche ?? {}, { pseudonymise_le: '2026-11-11T00:00:00+00:00', nom: null, email: null })
    const res = await modifier(G_PARTI, { actif: true })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'fiche_effacee' })
  })
})

describe('POST gestionnaires/[id]/confirmation (P1-R12)', () => {
  const renvoyer = (id: string) => RENVOYER(requeteQr(`/api/aj-signalement/gestionnaires/${id}/confirmation`, 'POST', {}), contexteQr(id))

  it('adresse contestée : 409 adresse_contestee ; déjà confirmée : 409 deja_confirmee ; aucun envoi', async () => {
    expect(await (await renvoyer(G_CONTESTEE)).json()).toEqual({ error: 'adresse_contestee' })
    expect(await (await renvoyer(G_MARIE)).json()).toEqual({ error: 'deja_confirmee' })
    expect(messagesEnvoyesQr()).toEqual([])
  })

  it('renvoi : anciens liens rendus inutilisables, nouvel envoi, e-mail, journal ; limite par fiche', async () => {
    const fiche = baseQr.table('signalements_qr_gestionnaires').find((g) => g.id === G_CONTESTEE)
    Object.assign(fiche ?? {}, { adresse_contestee_le: null })
    const ancien = baseQr.table('signalements_qr_invitations').find((i) => i.gestionnaire_id === G_CONTESTEE)
    Object.assign(ancien ?? {}, { refus: null })
    const res = await renvoyer(G_CONTESTEE)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ emailEnvoye: true })
    const envois = baseQr.table('signalements_qr_invitations').filter((i) => i.gestionnaire_id === G_CONTESTEE)
    expect(envois).toHaveLength(2)
    expect(envois[0].invite_token).toBeNull()
    expect(envois[1]).toMatchObject({ objet: 'confirmation_adresse', email: 'paul.conteste@exemple.test', invite_token: expect.stringMatching(/^[a-f0-9]{48}$/), envoye_par: ADMIN_QR.id })
    const jeton = jetonDuMessage(messagesEnvoyesQr()[0].html)
    expect((await lireInvitationValide('aj_signalement', jeton)).ok).toBe(true)
    expect(simulQr.limites).toContain(`qr_confirmation_fiche_${G_CONTESTEE}`)
    expect(baseQr.table('signalements_qr_journal')).toContainEqual(expect.objectContaining({ action: 'gestionnaire.confirmation_envoyee', gestionnaire_id: G_CONTESTEE }))
  })
})

describe('PUT gestionnaires/[id]/coproprietes (P1-R13) et départ (P1-R14)', () => {
  it('attributions : la fonction reçoit l’ensemble complet ; réponse avec les adresses retirées', async () => {
    baseQr.etat.fonctions.signalements_qr_attribuer_au_gestionnaire = (a) => ({ data: { coproprietes: a.p_coproprietes, adressesRetirees: 1 } })
    const res = await ATTRIBUER(requeteQr(`/api/aj-signalement/gestionnaires/${G_MARIE}/coproprietes`, 'PUT', { coproprieteIds: [COPRO_TOUS] }), contexteQr(G_MARIE))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ coproprietes: [COPRO_TOUS], adressesRetirees: 1 })
    expect(baseQr.etat.appelsRpc).toContainEqual({ nom: 'signalements_qr_attribuer_au_gestionnaire', args: { p_gestionnaire: G_MARIE, p_coproprietes: [COPRO_TOUS], p_acteur: ADMIN_QR.id } })
  })

  it('copropriété d’un autre cabinet : 409 a_reverifier', async () => {
    baseQr.etat.fonctions.signalements_qr_attribuer_au_gestionnaire = () => ERREUR_METIER('a_reverifier')
    const res = await ATTRIBUER(requeteQr(`/api/aj-signalement/gestionnaires/${G_MARIE}/coproprietes`, 'PUT', { coproprieteIds: [COPRO_AUTRE] }), contexteQr(G_MARIE))
    expect(res.status).toBe(409)
  })

  it('départ : successions transmises, réponse de la fonction (adresses retirées comprises)', async () => {
    baseQr.etat.fonctions.signalements_qr_desactiver_gestionnaire = () => ({ data: { deplacees: 1, laisseesSansGestionnaire: 0, adressesRetirees: 2 } })
    const successions = [{ coproprieteId: COPRO_A, versGestionnaireId: G_CONTESTEE }]
    const res = await DEPART(requeteQr(`/api/aj-signalement/gestionnaires/${G_MARIE}/depart`, 'POST', { successions }), contexteQr(G_MARIE))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ deplacees: 1, laisseesSansGestionnaire: 0, adressesRetirees: 2 })
    expect(baseQr.etat.appelsRpc).toContainEqual({ nom: 'signalements_qr_desactiver_gestionnaire', args: { p_id: G_MARIE, p_successions: successions, p_acteur: ADMIN_QR.id } })
  })

  it('départ sans une succession par copropriété : 409 a_reverifier ; corps mal formé : 400', async () => {
    baseQr.etat.fonctions.signalements_qr_desactiver_gestionnaire = () => ERREUR_METIER('a_reverifier')
    const res = await DEPART(requeteQr(`/api/aj-signalement/gestionnaires/${G_MARIE}/depart`, 'POST', { successions: [] }), contexteQr(G_MARIE))
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'a_reverifier' })
    const mal = await DEPART(requeteQr(`/api/aj-signalement/gestionnaires/${G_MARIE}/depart`, 'POST', { successions: [{ coproprieteId: 'x' }] }), contexteQr(G_MARIE))
    expect(mal.status).toBe(400)
  })
})

describe('GET gestionnaires/[id]/export (P1-R15)', () => {
  it('JSON en pièce jointe : fiche, envois sans jeton, attributions, journal ; export journalisé', async () => {
    const res = await EXPORT(requeteQr(`/api/aj-signalement/gestionnaires/${G_CONTESTEE}/export`), contexteQr(G_CONTESTEE))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Disposition')).toMatch(/^attachment; filename="gestionnaire-a0000000-0000-4000-8000-000000000002\.json"$/)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    const corps = await res.json()
    expect(corps.fiche).toMatchObject({ id: G_CONTESTEE, nom: 'Paul Conteste', email: 'paul.conteste@exemple.test' })
    expect(JSON.stringify(corps)).not.toContain(JETON_LIGNE)
    expect(baseQr.table('signalements_qr_journal')).toContainEqual(expect.objectContaining({ action: 'gestionnaire.exporte', gestionnaire_id: G_CONTESTEE }))
    expect(simulQr.limites).toContain(`qr_gestionnaire_export_${ADMIN_QR.id}`)
  })
})
