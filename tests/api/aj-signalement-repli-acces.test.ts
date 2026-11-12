// tests/api/aj-signalement-repli-acces.test.ts
//
// Règle de sûreté de la PR 2 (Hugo fusionne lui-même) : une fusion AVANT les migrations 20261111 et 20261112 ne casse
// AUCUN parcours qui marche aujourd'hui.
//   - sans la 20261112 (20261111 appliquée) : l'espace du super admin répond comme en PR 1 (liste et page profil des
//     gestionnaires SANS les champs d'accès, départ, réactivation, tableau, statut) et le dépôt public par QR aussi ; un
//     compte gestionnaire reçoit 503 base_absente (« migration à appliquer »), journalisé une fois par opération ;
//   - sans aucune des deux : les replis de la PR 1 restent (tableau du super admin servi), le gestionnaire reçoit 503.
// Données fictives (tests/helpers/aj-signalement-acces.ts).

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/supabase-server', async () => ({ supabaseAdmin: (await import('../helpers/aj-signalement-base')).baseQr.client }))
vi.mock('@/lib/supabase-server-component', async () => (await import('../helpers/aj-signalement-routes')).mockCookies())
vi.mock('@/lib/auth-helpers', async () => (await import('../helpers/aj-signalement-routes')).mockAuth())
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/aj-signalement-routes')).mockLimites())
vi.mock('@/lib/email', async () => (await import('../helpers/aj-signalement-routes')).mockEmail())
vi.mock('@/lib/logger', async () => (await import('../helpers/aj-signalement-routes')).mockLogger())

const { baseQr, simulerProductionAvant1111Qr, simulerProductionAvant1112Qr } = await import('../helpers/aj-signalement-base')
const { contexteQr, messagesEnvoyesQr, reinitialiserSimulQr, requeteQr, simulQr, texteJournalServeurQr } = await import('../helpers/aj-signalement-routes')
const A = await import('../helpers/aj-signalement-acces')
const { GET: TABLEAU } = await import('@/app/api/aj-signalement/tableau/route')
const { GET: SIGNALEMENTS_COPRO } = await import('@/app/api/aj-signalement/coproprietes/[id]/signalements/route')
const { PATCH: STATUT } = await import('@/app/api/aj-signalement/signalements/[id]/route')
const { POST: DEPOSER } = await import('@/app/api/aj-signalement/signalements/route')
const { GET: MOI } = await import('@/app/api/aj-signalement/moi/route')
const { GET: LISTE } = await import('@/app/api/aj-signalement/gestionnaires/route')
const { GET: FICHE, PATCH: MODIFIER_FICHE } = await import('@/app/api/aj-signalement/gestionnaires/[id]/route')
const { POST: DEPART } = await import('@/app/api/aj-signalement/gestionnaires/[id]/depart/route')
const { POST: CREER_COPRO } = await import('@/app/api/aj-signalement/coproprietes/route')
const { PATCH: MODIFIER_COPRO } = await import('@/app/api/aj-signalement/coproprietes/[id]/route')
const { MIGRATION_ACCES_QR, reinitialiserReplisQr } = await import('@/lib/aj-signalement/serveur')

/** Clés d'une fiche gestionnaire telles que la PR 1 les rend (aucun champ d'accès). */
const CLES_FICHE_PR1 = ['cabinet', 'confirmeeLe', 'coproprietes', 'creeLe', 'domaineForce', 'email', 'etat', 'id', 'nom', 'ouverts', 'urgents']
const CLES_ACCES = ['accesOuvertLe', 'compteRelie', 'connexionBloquee', 'effacementDemandeLe']
const trie = (v: string[]) => [...v].sort((a, b) => a.localeCompare(b))

beforeEach(() => {
  reinitialiserSimulQr()
  reinitialiserReplisQr()
  baseQr.reinitialiser()
  vi.unstubAllEnvs()
  vi.stubEnv('ADMIN_EMAIL', 'admin@exemple.test')
  vi.stubEnv('ADMIN_EMAIL_2', '')
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://vitfix.io')
  A.poserJeuAccesQr()
  baseQr.etat.fonctions.signalements_qr_emails_gestionnaires = () => ({
    data: [{ gestionnaire_id: A.G1, email: A.EMAIL_G1, acces_ouvert: false, exclu: false }],
  })
  baseQr.etat.fonctions.signalements_qr_reserver_emails = () => ({ data: { accorde: true, retenus: 0 } })
})

const avertissementsAcces = () => simulQr.logger.warn.mock.calls.filter((c) => String(c[0]).includes('12/11/2026'))
const DEPOT = {
  // Jeton de la copropriété C1 du jeu de données.
  jeton: '0123456789abcdef0123456789abcdef', prenom: 'Prénom', nom: 'Déclarant', telephone: '06 00 00 00 00',
  email: 'declarant@exemple.test', batiment: 'A', etage: '2', numLot: '7', estPartieCommune: false, zoneSignalee: '', typeIntervention: 'Plomberie',
  description: 'Fuite d’eau au plafond de la cuisine', priorite: 'normale', langue: 'fr', qualiteDeclarant: 'locataire',
}

/** Saisie d'une copropriété par un gestionnaire (lot 2). */
const CREATION_GESTIONNAIRE = {
  operationId: 'f0000000-0000-4000-8000-000000000001', nom: 'Résidence Neuve', adresse: '8 avenue Neuve', codePostal: '13002', ville: 'Marseille',
  emailsDestinataires: ['conseil@exemple.test'],
}

/** Toutes les routes ouvertes à un gestionnaire (lots 1 et 2). */
const routesGestionnaire = () => [
  ['moi', () => MOI(requeteQr('/api/aj-signalement/moi'))],
  ['tableau', () => TABLEAU(requeteQr('/api/aj-signalement/tableau'))],
  ['signalements d’une copropriété', () => SIGNALEMENTS_COPRO(requeteQr(`/api/aj-signalement/coproprietes/${A.C1}/signalements`), contexteQr(A.C1))],
  ['statut', () => STATUT(requeteQr(`/api/aj-signalement/signalements/${A.S1}`, 'PATCH', { statut: 'en_cours', statutAttendu: 'en_attente' }), contexteQr(A.S1))],
  ['création de copropriété', () => CREER_COPRO(requeteQr('/api/aj-signalement/coproprietes', 'POST', CREATION_GESTIONNAIRE))],
  ['modification de copropriété', () => MODIFIER_COPRO(
    requeteQr(`/api/aj-signalement/coproprietes/${A.C1}`, 'PATCH', { ville: 'Aubagne', emailsDestinataires: ['nouveau@exemple.test'] }), contexteQr(A.C1),
  )],
] as const

describe('sans la migration 20261112 (20261111 appliquée) : le super admin et le public comme en PR 1', () => {
  beforeEach(() => simulerProductionAvant1112Qr())

  it('liste des gestionnaires : 200, fiches SANS champs d’accès (forme de la PR 1), repli journalisé une fois', async () => {
    for (let i = 0; i < 2; i += 1) {
      const res = await LISTE(requeteQr('/api/aj-signalement/gestionnaires'))
      expect(res.status).toBe(200)
      const { gestionnaires } = await res.json()
      expect(gestionnaires).toHaveLength(3)
      for (const g of gestionnaires) expect(trie(Object.keys(g))).toEqual(CLES_FICHE_PR1)
    }
    expect(avertissementsAcces()).toHaveLength(1)
    expect(avertissementsAcces()[0][1]).toMatchObject({ migration: MIGRATION_ACCES_QR, code: '42703' })
  })

  it('page profil d’un gestionnaire : 200, forme de la PR 1', async () => {
    const res = await FICHE(requeteQr(`/api/aj-signalement/gestionnaires/${A.G1}`), contexteQr(A.G1))
    expect(res.status).toBe(200)
    expect(trie(Object.keys((await res.json()).gestionnaire))).toEqual(CLES_FICHE_PR1)
  })

  it('départ et réactivation : servis par les fonctions de la 20261111, comme en PR 1', async () => {
    baseQr.etat.fonctions.signalements_qr_desactiver_gestionnaire = () => ({ data: { deplacees: 0, laisseesSansGestionnaire: 1, adressesRetirees: 0 } })
    const depart = await DEPART(requeteQr(`/api/aj-signalement/gestionnaires/${A.G2}/depart`, 'POST', { successions: [{ coproprieteId: A.C2, versGestionnaireId: null }] }), contexteQr(A.G2))
    expect(depart.status).toBe(200)
    expect(await depart.json()).toEqual({ deplacees: 0, laisseesSansGestionnaire: 1, adressesRetirees: 0 })
    A.ficheSimuleeQr(A.G2).actif = false
    baseQr.etat.fonctions.signalements_qr_reactiver_gestionnaire = () => ({ data: true })
    const reactivation = await MODIFIER_FICHE(requeteQr(`/api/aj-signalement/gestionnaires/${A.G2}`, 'PATCH', { actif: true }), contexteQr(A.G2))
    expect(reactivation.status).toBe(200)
  })

  it('tableau du super admin : 200, toutes les copropriétés, champs de la PR 1 (aucun champ de minimisation)', async () => {
    const res = await TABLEAU(requeteQr('/api/aj-signalement/tableau'))
    expect(res.status).toBe(200)
    const { tableau } = await res.json()
    expect(tableau.coproprietes).toHaveLength(6)
    expect(tableau.coproprietes[0]).not.toHaveProperty('modifiable')
    expect(tableau.coproprietes[0]).not.toHaveProperty('adressesMasquees')
    expect(tableau.signalements[0]).not.toHaveProperty('statutModifiePar')
    expect(tableau.signalements).toHaveLength(6)
  })

  it('création et modification de copropriété par le super admin : comme en PR 1 (aucune colonne de la 20261112)', async () => {
    A.simulerCreationCoproprietesQr()
    const creation = await CREER_COPRO(requeteQr('/api/aj-signalement/coproprietes', 'POST', { nom: 'Villa Exemple', cabinetId: A.CAB, gestionnaireIds: [A.G1] }))
    expect(creation.status).toBe(201)
    expect(baseQr.etat.appelsRpc.find((a) => a.nom === 'signalements_qr_creer_coproprietes')?.args).toMatchObject({ p_profil: 'super_admin', p_gestionnaire: null })
    const modification = await MODIFIER_COPRO(requeteQr(`/api/aj-signalement/coproprietes/${A.C_TOUS}`, 'PATCH', { ville: 'Aubagne', actif: false }), contexteQr(A.C_TOUS))
    expect(modification.status).toBe(200)
    expect(baseQr.ecrituresDe('signalements_qr_coproprietes', 'update')[0].filtres).toEqual([`id=eq.${A.C_TOUS}`])
    expect(avertissementsAcces()).toEqual([])
  })

  it('statut changé par le super admin : 200, trace super_admin', async () => {
    const res = await STATUT(requeteQr(`/api/aj-signalement/signalements/${A.S1}`, 'PATCH', { statut: 'en_cours' }), contexteQr(A.S1))
    expect(res.status).toBe(200)
    expect(baseQr.ecrituresDe('signalements_qr', 'update')[0].valeurs).toMatchObject({ statut_modifie_profil: 'super_admin' })
  })

  it('dépôt public par QR code : 200, e-mail parti (fonction des destinataires de la 20261111)', async () => {
    simulQr.user = null
    expect(baseQr.table('signalements_qr_coproprietes').find((c) => c.id === A.C1)?.jeton).toBe(DEPOT.jeton)
    const res = await DEPOSER(requeteQr('/api/aj-signalement/signalements', 'POST', DEPOT))
    expect(res.status).toBe(200)
    expect((await res.json()).signalement).toMatchObject({ emailEnvoye: true })
    expect(messagesEnvoyesQr().map((m) => m.to)).toContain(A.EMAIL_G1)
  })

  it.each(routesGestionnaire())('gestionnaire, %s : 503 base_absente, rien d’écrit, aucun message de la base', async (_nom, appeler) => {
    A.connecterQr(A.COMPTE_G1)
    const res = await appeler()
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'base_absente' })
    expect(baseQr.etat.ecritures).toEqual([])
    expect(texteJournalServeurQr()).not.toContain('does not exist')
  })

  it('gestionnaire : plusieurs appels, un seul avertissement « migration du 12/11/2026 absente »', async () => {
    A.connecterQr(A.COMPTE_G1)
    for (const [, appeler] of routesGestionnaire()) await appeler()
    for (const [, appeler] of routesGestionnaire()) await appeler()
    expect(avertissementsAcces()).toHaveLength(1)
  })
})

describe('sans aucune des deux migrations : replis de la PR 1 conservés', () => {
  beforeEach(() => {
    simulerProductionAvant1111Qr()
    simulerProductionAvant1112Qr()
  })

  it('tableau du super admin : 200 (copropriétés relues sans les colonnes du 11/11/2026)', async () => {
    const res = await TABLEAU(requeteQr('/api/aj-signalement/tableau'))
    expect(res.status).toBe(200)
    expect((await res.json()).tableau.coproprietes).toHaveLength(6)
  })

  it.each(routesGestionnaire())('gestionnaire, %s : 503 base_absente', async (_nom, appeler) => {
    A.connecterQr(A.COMPTE_G1)
    const res = await appeler()
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'base_absente' })
  })
})

describe('avec les deux migrations : les champs d’accès sont rendus au super admin (jamais l’identifiant du compte)', () => {
  it('liste : accesOuvertLe, connexionBloquee, effacementDemandeLe, compteRelie', async () => {
    const { gestionnaires } = await (await LISTE(requeteQr('/api/aj-signalement/gestionnaires'))).json()
    const marie = gestionnaires.find((g: { id: string }) => g.id === A.G1)
    expect(trie(Object.keys(marie))).toEqual(trie([...CLES_FICHE_PR1, ...CLES_ACCES]))
    expect(marie).toMatchObject({ accesOuvertLe: '2026-11-06T09:00:00+00:00', connexionBloquee: false, effacementDemandeLe: null, compteRelie: true })
    expect(JSON.stringify(gestionnaires)).not.toContain(A.U1)
    expect(avertissementsAcces()).toEqual([])
  })
})

// ── PR 2, lot 5 : états d'accès calculés pour le super admin (etatGestionnaireQr étendu) ─────────────────────────
// Avec la 20261112 : « Accès ouvert » (compte relié), « Accès envoyé » (envoi « acces » en attente), « Adresse déjà
// utilisée par un autre espace » (refus), « Demande d'effacement ». Sans elle : l'état de la PR 1, même avec un envoi.
describe('états d’accès des fiches (lot 5)', () => {
  const envoiAcces = (gestionnaireId: string, sur: Record<string, unknown> = {}) => ({
    id: `e-${gestionnaireId}`, gestionnaire_id: gestionnaireId, objet: 'acces', created_at: new Date(Date.now() - 3_600_000).toISOString(),
    invite_sent_at: new Date(Date.now() - 3_600_000).toISOString(), accepted_at: null, refus: null, ...sur,
  })
  const etats = async () => {
    const { gestionnaires } = await (await LISTE(requeteQr('/api/aj-signalement/gestionnaires'))).json()
    return Object.fromEntries((gestionnaires as Array<{ id: string; etat: string }>).map((g) => [g.id, g.etat]))
  }

  it('avec les deux migrations : accès ouvert, accès envoyé, refus « autre espace », demande d’effacement', async () => {
    const f2 = A.ficheSimuleeQr(A.G2)
    f2.user_id = null
    f2.acces_ouvert_le = null
    const f3 = A.ficheSimuleeQr(A.G3)
    f3.user_id = null
    f3.acces_ouvert_le = null
    baseQr.etat.tables.signalements_qr_invitations = [envoiAcces(A.G2), envoiAcces(A.G3, { refus: 'compte_autre_espace', invite_token: null })]
    expect(await etats()).toEqual({ [A.G1]: 'acces_ouvert', [A.G2]: 'acces_envoye', [A.G3]: 'refus_autre_espace' })
    A.ficheSimuleeQr(A.G1).effacement_demande_le = '2026-11-10T09:00:00+00:00'
    expect((await etats())[A.G1]).toBe('effacement_demande')
  })

  it('sans la 20261112 : états de la PR 1 (adresse confirmée), même avec un envoi « acces » en attente', async () => {
    baseQr.etat.tables.signalements_qr_invitations = [envoiAcces(A.G2)]
    simulerProductionAvant1112Qr()
    expect(new Set(Object.values(await etats()))).toEqual(new Set(['adresse_confirmee']))
  })
})
