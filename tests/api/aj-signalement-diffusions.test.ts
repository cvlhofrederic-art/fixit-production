// tests/api/aj-signalement-diffusions.test.ts
//
// AJ Signalement, PR 3, lot 5 — routes de diffusion de messages d'exploitation aux déclarants (cahier § 4, § 5.5, § 5.6,
// § 9 ; décisions de Hugo du 11/11/2026, H1 = C, H2, H7, H9 ; HF4) :
//   D-R1 GET  /coproprietes/[id]/diffusions/valeurs        D-R2 POST /coproprietes/[id]/diffusions/apercu
//   D-R3 POST /coproprietes/[id]/diffusions                D-R5 GET  /coproprietes/[id]/diffusions?avant=
//   D-R4 POST /diffusions/[id]/reprendre                   D-R6 GET  /diffusions/[id]
//   D-R7 POST /coproprietes/[id]/signalements/[sid]/opposition
//   D-R8 PATCH /cabinets/[id] (réglages de diffusion, activation) et GET /cabinets/[id]
// Super admin seul en PR 3 (un compte gestionnaire reçoit 403 sans aucune lecture). Les fonctions SQL sont simulées,
// réduites à ce que la route en voit ; leurs règles sont exécutées sur un vrai PostgreSQL ailleurs
// (tests/migrations/signalements_qr_diffusion.execution.test.ts). Aucune donnée réelle : adresses en exemple.test.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type AppelDetaille = { messages: Array<{ to: string | string[]; subject: string; html: string; headers?: Record<string, string> }>; options: { idempotencyKey: string } }
// Lots aux déclarants (appels) et copies au cabinet (copies, clé aj-diffusion-<id>-copie) : résultats simulés séparés.
const detaille = vi.hoisted(() => ({
  appels: [] as AppelDetaille[],
  resultats: [] as unknown[],
  copies: [] as AppelDetaille[],
  resultatsCopies: [] as unknown[],
  /** Clés d'idempotence dans l'ordre des appels (lots et copies). */
  cles: [] as string[],
}))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/supabase-server', async () => ({ supabaseAdmin: (await import('../helpers/aj-signalement-base')).baseQr.client }))
vi.mock('@/lib/supabase-server-component', async () => (await import('../helpers/aj-signalement-routes')).mockCookies())
vi.mock('@/lib/auth-helpers', async () => (await import('../helpers/aj-signalement-routes')).mockAuth())
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/aj-signalement-routes')).mockLimites())
vi.mock('@/lib/email', async () => ({
  ...(await import('../helpers/aj-signalement-routes')).mockEmail(),
  sendBatchEmailsDetaille: vi.fn(async (messages: Array<{ to: string }>, options: { idempotencyKey: string }) => {
    const copie = options.idempotencyKey.endsWith('-copie')
    detaille.cles.push(options.idempotencyKey)
    ;(copie ? detaille.copies : detaille.appels).push({ messages: [...messages] as never, options })
    return (copie ? detaille.resultatsCopies : detaille.resultats).shift() ?? { ok: true, acceptes: messages.map((_, i) => i), refuses: [] }
  }),
}))
vi.mock('@/lib/logger', async () => (await import('../helpers/aj-signalement-routes')).mockLogger())

const { baseQr } = await import('../helpers/aj-signalement-base')
const { ADMIN_QR, contexteQr, reinitialiserSimulQr, requeteQr, simulQr, texteJournalServeurQr } = await import('../helpers/aj-signalement-routes')
const { GET: VALEURS } = await import('@/app/api/aj-signalement/coproprietes/[id]/diffusions/valeurs/route')
const { POST: APERCU } = await import('@/app/api/aj-signalement/coproprietes/[id]/diffusions/apercu/route')
const { POST: DIFFUSER, GET: HISTORIQUE } = await import('@/app/api/aj-signalement/coproprietes/[id]/diffusions/route')
const { GET: DETAIL } = await import('@/app/api/aj-signalement/diffusions/[id]/route')
const { POST: REPRENDRE } = await import('@/app/api/aj-signalement/diffusions/[id]/reprendre/route')
const { POST: OPPOSER } = await import('@/app/api/aj-signalement/coproprietes/[id]/signalements/[sid]/opposition/route')
const { GET: LIRE_CABINET, PATCH: MODIFIER_CABINET } = await import('@/app/api/aj-signalement/cabinets/[id]/route')
const { annonceDiffusionQr, MODELES_DIFFUSION_QR } = await import('@/lib/aj-signalement/affichage-diffusion')
const { MODELES_DIFFUSION_SCHEMA_QR } = await import('@/lib/validation')
const { reinitialiserReplisQr } = await import('@/lib/aj-signalement/serveur')
const { CODES_METIER_QR, codeDepuisReponseQr } = await import('@/lib/aj-signalement/api')
const { messageErreurTableauQr } = await import('@/lib/aj-signalement/affichage')
const { messageErreurGestionnaireQr } = await import('@/lib/aj-signalement/affichage-gestionnaire')
type Ligne = import('../helpers/aj-signalement-base').Ligne

const CAB = 'ca000000-0000-4000-8000-000000000001'
const CAB_PT = 'ca000000-0000-4000-8000-000000000002'
const COPRO = 'c0000000-0000-4000-8000-000000000001'
const COPRO_AUTRE = 'c0000000-0000-4000-8000-000000000002'
const COPRO_SANS_CABINET = 'c0000000-0000-4000-8000-000000000003'
const SIG = 'a1000000-0000-4000-8000-000000000001'
const SIG_AUTRE = 'a1000000-0000-4000-8000-000000000002'
const OPERATION = '0e000000-0000-4000-8000-000000000001'
const CLE = 'cle-de-test-des-liens-de-diffusion-0123456789'
const GESTIONNAIRE = { id: 'b0000000-0000-4000-8000-000000000001', email: 'marie@exemple.test', app_metadata: { role: 'gestionnaire_signalement' } }

const ERREUR_METIER = (message: string) => ({ error: { code: 'P0001', message } })
const ilYa = (ms: number) => new Date(Date.now() - ms).toISOString()
const HEURE = 60 * 60 * 1000
const idDestinataire = (i: number) => `de000000-0000-4000-8000-${String(i).padStart(12, '0')}`

/** Cabinet activé, complet, en français ; `reglages` remplace des colonnes. */
const cabinetActive = (reglages: Ligne = {}): Ligne => ({
  id: CAB, nom: 'Cabinet Exemple', identifiant: 'cabinet-exemple', langue: 'fr',
  diffusion_contact_email: 'contact@cabinet-exemple.test', diffusion_politique_url: 'https://cabinet-exemple.test/confidentialite',
  diffusion_politique_verifiee_le: '2026-11-01T09:00:00+00:00', diffusion_contrat_reference: 'Contrat exemple v1',
  diffusion_contrat_signe_le: '2026-11-01', diffusion_telephones: ['0612345678'], diffusion_activee_le: '2026-11-02T09:00:00+00:00',
  ...reglages,
})

/** Lignes destinataires simulées d'une diffusion (états), pour lot / résultats / nombres. */
interface DestSim { id: string; diffusion: string; email: string; etat: string; lot: number | null }
let destinataires: DestSim[] = []
let dernierLot = 0

function poserFonctions(): void {
  const f = baseQr.etat.fonctions
  f.signalements_qr_diffusion_valeurs = () => ({
    data: [
      { batiment: 'A', etage: '1', nb_adresses: 3 }, { batiment: 'Bât. A', etage: '1er', nb_adresses: 1 },
      { batiment: 'B', etage: 'RDC', nb_adresses: 2 }, { batiment: 'B moi@exemple.test', etage: '2', nb_adresses: 1 },
      { batiment: '', etage: '', nb_adresses: 1 },
    ],
  })
  f.signalements_qr_diffusions_mois = () => ({ data: [{ nb: 3, dernier_le: '2026-11-08T10:00:00+00:00' }] })
  f.signalements_qr_diffusion_raison_inactive = (a) => {
    const c = baseQr.table('signalements_qr_coproprietes').find((x) => x.id === a.p_copropriete)
    if (!c) return { data: 'introuvable' }
    if (c.actif === false) return { data: 'copropriete_inactive' }
    const k = baseQr.table('signalements_qr_cabinets').find((x) => x.id === c.cabinet_id)
    if (!k) return { data: 'sans_cabinet' }
    if (!k.diffusion_activee_le) return { data: 'diffusion_non_activee' }
    if (k.langue !== 'fr') return { data: 'langue_non_ouverte' }
    if (c.diffusion_fin_gestion_le) return { data: 'fin_gestion' }
    return { data: null }
  }
  f.signalements_qr_diffusion_apercu = (a) => {
    const raison = (f.signalements_qr_diffusion_raison_inactive(a).data as string | null) ?? null
    return { data: [{ nb_destinataires: a.p_annonce ? 4 : 23, nb_exclus_opposition: 2, possible: raison === null, raison, instant: '2026-11-12T10:00:00.123456+00:00' }] }
  }
  f.signalements_qr_diffusion_creer = (a) => {
    const existante = baseQr.table('signalements_qr_diffusions').find((d) => d.operation_id === a.p_operation)
    if (existante) return { data: [{ diffusion_id: existante.id, nb_destinataires: existante.nb_destinataires, rejeu: true }] }
    const raison = f.signalements_qr_diffusion_raison_inactive(a).data
    if (raison) return ERREUR_METIER('diffusion_inactive')
    if (Number(a.p_attendu) < 3) return ERREUR_METIER('perimetre_change')
    const c = baseQr.table('signalements_qr_coproprietes').find((x) => x.id === a.p_copropriete) as Ligne
    const k = baseQr.table('signalements_qr_cabinets').find((x) => x.id === c.cabinet_id) as Ligne
    const id = `df000000-0000-4000-8000-${String(baseQr.table('signalements_qr_diffusions').length + 1).padStart(12, '0')}`
    baseQr.table('signalements_qr_diffusions').push({
      id, copropriete_id: a.p_copropriete, cabinet_id: k.id, operation_id: a.p_operation, acteur_profil: a.p_profil, acteur_id: a.p_acteur,
      acteur_gestionnaire_id: a.p_gestionnaire, instruction_reference: a.p_instruction_reference, instruction_recue_le: a.p_instruction_recue_le,
      modele: a.p_modele, langue: k.langue, fige_cabinet_nom: k.nom, fige_cabinet_identifiant: k.identifiant, fige_copropriete_nom: c.nom,
      fige_contact_email: k.diffusion_contact_email, fige_politique_url: k.diffusion_politique_url, fige_expediteur: a.p_expediteur,
      objet: a.p_objet, texte: a.p_texte, portee: a.p_portee, libelle_perimetre: a.p_libelle, nb_destinataires: 3, nb_exclus_opposition: 0,
      copie_cabinet_le: null, created_at: new Date().toISOString(),
    })
    for (let i = 1; i <= 3; i++) destinataires.push({ id: idDestinataire(destinataires.length + 1), diffusion: id, email: `declarant${i}@exemple.test`, etat: 'en_attente', lot: null })
    return { data: [{ diffusion_id: id, nb_destinataires: 3, rejeu: false }] }
  }
  f.signalements_qr_diffusion_lot = (a) => {
    const d = baseQr.table('signalements_qr_diffusions').find((x) => x.id === a.p_diffusion)
    const raison = d ? f.signalements_qr_diffusion_raison_inactive({ p_copropriete: d.copropriete_id }).data : 'introuvable'
    const lignes = destinataires.filter((x) => x.diffusion === a.p_diffusion && x.etat === 'en_attente')
    if (raison) {
      for (const l of lignes) l.etat = 'annule'
      return { data: [] }
    }
    const choisies = lignes.slice(0, Number(a.p_taille))
    if (choisies.length === 0) return { data: [] }
    dernierLot += 1
    for (const l of choisies) Object.assign(l, { etat: 'en_cours', lot: dernierLot })
    return { data: choisies.map((l) => ({ destinataire_id: l.id, email: l.email, lot: l.lot, reprise: false })) }
  }
  f.signalements_qr_diffusion_resultats = (a) => {
    const envoyes = destinataires.filter((l) => l.lot === a.p_lot && l.etat === 'en_cours' && (a.p_envoyes as string[]).includes(l.id))
    for (const l of envoyes) l.etat = 'envoye'
    const refuses = destinataires.filter((l) => l.lot === a.p_lot && l.etat === 'en_cours' && (a.p_refuses as string[]).includes(l.id))
    for (const l of refuses) l.etat = 'refuse'
    const reste = destinataires.filter((l) => l.diffusion === a.p_diffusion && (l.etat === 'en_attente' || l.etat === 'en_cours')).length
    return { data: { envoyes: envoyes.length, refuses: refuses.length, nonPartis: 0, reste } }
  }
  f.signalements_qr_diffusion_nombres = (a) => {
    const de = destinataires.filter((l) => l.diffusion === a.p_diffusion)
    const n = (etats: string[]) => de.filter((l) => etats.includes(l.etat)).length
    return { data: [{ nb_envoyes: n(['envoye']), nb_refuses: n(['refuse']), nb_attente: n(['en_attente', 'en_cours']), nb_annules: n(['annule']), nb_incertains: 0, nb_opposes: 0, nb_perimes: 0 }] }
  }
  f.signalements_qr_diffusions_liste = (a) => ({
    data: baseQr.table('signalements_qr_diffusions').filter((d) => d.copropriete_id === a.p_copropriete).map((d) => ({
      id: d.id, cree_le: d.created_at, acteur_profil: d.acteur_profil, acteur_id: d.acteur_id, acteur_gestionnaire_id: null, modele: d.modele,
      objet: d.objet, portee: d.portee, libelle_perimetre: d.libelle_perimetre, nb_destinataires: d.nb_destinataires, nb_exclus_opposition: 0,
      nb_envoyes: 3, nb_refuses: 0, nb_attente: 0, nb_annules: 0, nb_incertains: 0,
    })).slice(0, Number(a.p_limite)),
  })
  f.signalements_qr_diffusion_purger = () => ({ data: [{ diffusions: 0, oppositions: 0, perimees: 0 }] })
  f.signalements_qr_diffusion_opposer_signalement = (a) => ({
    data: baseQr.table('signalements_qr').some((s) => s.id === a.p_signalement && s.copropriete_id === a.p_copropriete),
  })
  f.signalements_qr_diffusion_regler_cabinet = (a) => {
    const k = baseQr.table('signalements_qr_cabinets').find((x) => x.id === a.p_cabinet) as Ligne
    if (a.p_contact) k.diffusion_contact_email = a.p_contact
    if (a.p_politique) k.diffusion_politique_url = a.p_politique
    if (a.p_politique_declaree) k.diffusion_politique_verifiee_le = '2026-11-12T10:00:00+00:00'
    if (a.p_contrat_reference) k.diffusion_contrat_reference = a.p_contrat_reference
    if (a.p_contrat_signe_le) k.diffusion_contrat_signe_le = a.p_contrat_signe_le
    if (a.p_telephones) k.diffusion_telephones = a.p_telephones
    if (a.p_activer === true) k.diffusion_activee_le = k.diffusion_activee_le ?? '2026-11-12T10:00:00+00:00'
    if (a.p_activer === false) k.diffusion_activee_le = null
    return { data: { active: !!k.diffusion_activee_le, champs: [], etat: null } }
  }
}

beforeEach(() => {
  reinitialiserSimulQr()
  reinitialiserReplisQr()
  baseQr.reinitialiser()
  detaille.appels = []
  detaille.resultats = []
  detaille.copies = []
  detaille.resultatsCopies = []
  detaille.cles = []
  destinataires = []
  dernierLot = 0
  process.env.AJ_SIGNALEMENT_CLE_LIENS_DIFFUSION = CLE
  process.env.RESEND_API_KEY = 're_test'
  baseQr.etat.tables.signalements_qr_cabinets = [
    cabinetActive(),
    { ...cabinetActive({ id: CAB_PT, identifiant: 'autre-cabinet', langue: 'pt', diffusion_activee_le: null }) },
  ]
  baseQr.etat.tables.signalements_qr_coproprietes = [
    { id: COPRO, nom: 'Résidence Exemple', actif: true, cabinet_id: CAB, batiments: ['Bâtiment A'], diffusion_fin_gestion_le: null },
    { id: COPRO_AUTRE, nom: 'Résidence Autre', actif: true, cabinet_id: CAB, batiments: [], diffusion_fin_gestion_le: null },
    { id: COPRO_SANS_CABINET, nom: 'Résidence Seule', actif: true, cabinet_id: null, batiments: [], diffusion_fin_gestion_le: null },
  ]
  baseQr.etat.tables.signalements_qr = [
    { id: SIG, copropriete_id: COPRO, email: 'declarant1@exemple.test' },
    { id: SIG_AUTRE, copropriete_id: COPRO_AUTRE, email: 'declarant9@exemple.test' },
  ]
  baseQr.etat.tables.signalements_qr_diffusions = []
  poserFonctions()
})

afterEach(() => {
  delete process.env.AJ_SIGNALEMENT_CLE_LIENS_DIFFUSION
})

// ── Appels ──

const valeurs = (copro = COPRO, requete = '') =>
  VALEURS(requeteQr(`/api/aj-signalement/coproprietes/${copro}/diffusions/valeurs${requete}`), contexteQr(copro))
const apercu = (corps: unknown, copro = COPRO) =>
  APERCU(requeteQr(`/api/aj-signalement/coproprietes/${copro}/diffusions/apercu`, 'POST', corps), contexteQr(copro))
const historique = (copro = COPRO, requete = '') =>
  HISTORIQUE(requeteQr(`/api/aj-signalement/coproprietes/${copro}/diffusions${requete}`), contexteQr(copro))
const detail = (id: string) => DETAIL(requeteQr(`/api/aj-signalement/diffusions/${id}`), contexteQr(id))
const reprendre = (id: string, corps?: unknown) => REPRENDRE(requeteQr(`/api/aj-signalement/diffusions/${id}/reprendre`, 'POST', corps), contexteQr(id))
const opposer = (copro: string, sid: string, corps: unknown) => OPPOSER(
  requeteQr(`/api/aj-signalement/coproprietes/${copro}/signalements/${sid}/opposition`, 'POST', corps),
  { params: Promise.resolve({ id: copro, sid }) })
const modifierCabinet = (id: string, corps: unknown) => MODIFIER_CABINET(requeteQr(`/api/aj-signalement/cabinets/${id}`, 'PATCH', corps), contexteQr(id))
const lireCabinet = (id: string) => LIRE_CABINET(requeteQr(`/api/aj-signalement/cabinets/${id}`), contexteQr(id))

const DIFFUSION_VALIDE = {
  operationId: OPERATION,
  modele: 'coupure_eau',
  objet: 'Coupure d’eau demain matin',
  texte: 'L’eau sera coupée demain de 9 h à 10 h pour une réparation. Astreinte : 06 12 34 56 78.',
  perimetre: { portee: 'copropriete' },
  libellePerimetre: 'Toute la copropriété',
  perimetreJusquAu: new Date(Date.now() - 60_000).toISOString(),
  nbDestinatairesAttendu: 23,
  instruction: { reference: 'Courriel de la gestionnaire du 12/11/2026 10:02', recueLe: '2026-11-12' },
}
const diffuser = (corps: unknown = DIFFUSION_VALIDE, copro = COPRO) =>
  DIFFUSER(requeteQr(`/api/aj-signalement/coproprietes/${copro}/diffusions`, 'POST', corps), contexteQr(copro))

/** Une diffusion créée par la route (puis ses lignes vieillies selon le cas). */
async function diffusionCreee(): Promise<string> {
  const res = await diffuser()
  expect(res.status).toBe(201)
  return (await res.json()).diffusionId as string
}

const ecrituresJournal = () => baseQr.ecrituresDe('signalements_qr_journal', 'insert')

describe('droits (super admin ; gestionnaire sur D-R1 à D-R7, H11 : tests/api/aj-signalement-diffusions-gestionnaire.test.ts)', () => {
  const routesDiffusion = (): Array<[string, () => Promise<Response>]> => [
    ['D-R1', () => valeurs()], ['D-R2', () => apercu({ perimetre: { portee: 'copropriete' } })], ['D-R3', () => diffuser()],
    ['D-R5', () => historique()], ['D-R6', () => detail('df000000-0000-4000-8000-000000000001')],
    ['D-R4', () => reprendre('df000000-0000-4000-8000-000000000001')], ['D-R7', () => opposer(COPRO, SIG, { demandeRecueLe: '2026-11-10' })],
  ]
  const routes = (): Array<[string, () => Promise<Response>]> => [
    ...routesDiffusion(), ['D-R8', () => modifierCabinet(CAB, { diffusionActivee: true })],
  ]

  it('401 sans session, sur chaque route ; aucune fonction appelée', async () => {
    simulQr.user = null
    for (const [nom, appel] of routes()) expect((await appel()).status, nom).toBe(401)
    expect(baseQr.etat.appelsRpc).toEqual([])
  })

  it('403 pour un compte super_admin hors de la liste d’e-mails, sur chaque route ; aucune lecture de fiche', async () => {
    simulQr.user = { ...ADMIN_QR, email: 'autre@exemple.test' }
    for (const [nom, appel] of routes()) expect((await appel()).status, nom).toBe(403)
    expect(baseQr.etat.appelsRpc).toEqual([])
    expect(baseQr.etat.lectures.filter((l) => l.table === 'signalements_qr_gestionnaires')).toEqual([])
  })

  it('gestionnaire : D-R8 → 403 interdit SANS lire sa fiche ; D-R1 à D-R7 → fiche relue, absente → 403 acces_retire ; aucune fonction appelée', async () => {
    simulQr.user = GESTIONNAIRE
    const d8 = await modifierCabinet(CAB, { diffusionActivee: true })
    expect(d8.status).toBe(403)
    expect(await d8.json()).toEqual({ error: 'interdit' })
    expect(baseQr.etat.lectures.filter((l) => l.table === 'signalements_qr_gestionnaires')).toEqual([])
    for (const [nom, appel] of routesDiffusion()) {
      const res = await appel()
      expect(res.status, nom).toBe(403)
      expect(await res.json(), nom).toEqual({ error: 'acces_retire' })
    }
    expect(baseQr.etat.appelsRpc).toEqual([])
  })

  it('identifiant hors format → 404 sans aucune lecture', async () => {
    const pas = 'pas-un-uuid'
    for (const res of [
      await valeurs(pas), await apercu({ perimetre: { portee: 'copropriete' } }, pas), await diffuser(DIFFUSION_VALIDE, pas), await historique(pas),
      await detail(pas), await reprendre(pas), await opposer(pas, SIG, { demandeRecueLe: '2026-11-10' }), await opposer(COPRO, pas, { demandeRecueLe: '2026-11-10' }),
    ]) expect(res.status).toBe(404)
    expect(baseQr.etat.lectures).toEqual([])
    expect(baseQr.etat.appelsRpc).toEqual([])
  })

  it('limites : par adresse IP puis par COMPTE (user.id), jamais par une adresse e-mail', async () => {
    await valeurs()
    await apercu({ perimetre: { portee: 'copropriete' } })
    await diffuser()
    await historique()
    expect(simulQr.limites).toEqual(expect.arrayContaining([
      `qr_diffusion_valeurs_${ADMIN_QR.id}`, `qr_diffusion_apercu_${ADMIN_QR.id}`, `qr_diffusion_envoi_${ADMIN_QR.id}`, `qr_diffusion_liste_${ADMIN_QR.id}`,
    ]))
    expect(simulQr.limites.join(' ')).not.toContain('@')
  })

  it('limite atteinte → 429, rien n’est lu', async () => {
    simulQr.refuser = ['qr_diffusion_envoi_']
    expect((await diffuser()).status).toBe(429)
    expect(baseQr.etat.appelsRpc).toEqual([])
  })
})

describe('D-R1 valeurs ciblables', () => {
  it('bâtiments regroupés (clé, libellé, variantes), sans bâtiment, portée par défaut, compteur du mois, déclarants à annoncer', async () => {
    const res = await valeurs()
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    const corps = await res.json()
    expect(corps).toMatchObject({ possible: true, raison: null, langue: 'fr', sansBatiment: 1, ceMois: { nb: 3, dernierLe: '2026-11-08T10:00:00+00:00' }, nbNonAnnonces: 4 })
    const a = corps.batiments.find((b: { cle: string }) => b.cle === 'a')
    expect(a).toMatchObject({ libelle: 'Bâtiment A', libelleASaisir: false, variantes: ['A', 'Bât. A'] })
    expect(a.etages.map((e: { cle: string; libelle: string }) => [e.cle, e.libelle])).toEqual([['1', '1er étage']])
    expect(corps.porteeParDefaut).toBe('batiment')
  })

  it('aucune adresse dans la réponse : une variante qui porte un « @ » est retirée, son libellé est à saisir', async () => {
    const corps = await (await valeurs()).json()
    expect(JSON.stringify(corps)).not.toContain('@')
    const groupe = corps.batiments.find((b: { cle: string }) => b.cle.startsWith('bmoi'))
    expect(groupe).toMatchObject({ libelle: null, libelleASaisir: true, variantes: [] })
  })

  it('copropriété désactivée ou fin de mission atteinte : possible false et la raison ; inconnue → 404 ; paramètre inconnu → 400', async () => {
    baseQr.table('signalements_qr_coproprietes')[0].diffusion_fin_gestion_le = '2026-11-01'
    expect(await (await valeurs()).json()).toMatchObject({ possible: false, raison: 'fin_gestion' })
    expect((await valeurs('c0000000-0000-4000-8000-0000000000ff')).status).toBe(404)
    expect((await valeurs(COPRO, '?portee=tout')).status).toBe(400)
  })

  it('migration 20261113 absente (colonne de fin de mission inconnue) → 503 base_absente, journalisé une fois', async () => {
    baseQr.etat.colonnesAbsentes.signalements_qr_coproprietes = ['diffusion_fin_gestion_le']
    for (let i = 0; i < 2; i++) {
      const res = await valeurs()
      expect(res.status).toBe(503)
      expect(await res.json()).toEqual({ error: 'base_absente' })
    }
    expect(simulQr.logger.warn.mock.calls.filter((c) => String(c[0]).includes('13/11/2026'))).toHaveLength(1)
  })

  it('fonction de la migration absente (PGRST202) → 503 base_absente', async () => {
    delete baseQr.etat.fonctions.signalements_qr_diffusion_valeurs
    expect((await valeurs()).status).toBe(503)
  })
})

describe('D-R2 aperçu (aucune écriture)', () => {
  it('copropriété entière : nombre exact, exclus, libellé, instant (repassé à l’envoi), possible ; aucune écriture, aucun « @ »', async () => {
    const res = await apercu({ perimetre: { portee: 'copropriete' } })
    expect(res.status).toBe(200)
    const corps = await res.json()
    expect(corps).toEqual({
      nbDestinataires: 23, nbExclusOpposition: 2, libellePerimetre: 'Toute la copropriété', libelleASaisir: false,
      instant: '2026-11-12T10:00:00.123456+00:00', possible: true, raison: null,
    })
    expect(JSON.stringify(corps)).not.toContain('@')
    expect(baseQr.etat.ecritures).toEqual([])
  })

  it('étage : la clé est reconvertie en valeurs brutes EXACTES (couples) ; libellé « Bâtiment A · 1er étage »', async () => {
    const res = await apercu({ perimetre: { portee: 'etage', batiment: 'a', etage: '1' } })
    expect((await res.json()).libellePerimetre).toBe('Bâtiment A · 1er étage')
    const appel = baseQr.etat.appelsRpc.find((a) => a.nom === 'signalements_qr_diffusion_apercu')
    expect(appel?.args).toEqual({
      p_copropriete: COPRO, p_portee: 'etage', p_batiments: ['A', 'Bât. A'], p_etages: ['1', '1er'], p_signalement: null, p_annonce: false,
    })
  })

  it('clé inconnue → 409 perimetre_change ; champ inconnu → 400 ; signalement d’une autre copropriété → 404', async () => {
    const inconnue = await apercu({ perimetre: { portee: 'batiment', batiment: 'zz' } })
    expect(inconnue.status).toBe(409)
    expect(await inconnue.json()).toEqual({ error: 'perimetre_change' })
    expect((await apercu({ perimetre: { portee: 'copropriete' }, urgent: true })).status).toBe(400)
    expect((await apercu({ perimetre: { portee: 'signalement', signalementId: SIG_AUTRE } })).status).toBe(404)
    expect((await apercu({ perimetre: { portee: 'signalement', signalementId: SIG } })).status).toBe(200)
  })

  it('libellé à saisir : absent → libellePerimetre null ; saisi et refusé → 400 texte_refuse { champ, motif } ; saisi et accepté → écrit', async () => {
    const sansSaisie = await (await apercu({ perimetre: { portee: 'batiment', batiment: 'bmoiexempletest' } })).json()
    expect(sansSaisie).toMatchObject({ libellePerimetre: null, libelleASaisir: true })
    const refus = await apercu({ perimetre: { portee: 'batiment', batiment: 'bmoiexempletest' }, libelleBatimentSaisi: 'B www.exemple.immo' })
    expect(refus.status).toBe(400)
    expect(await refus.json()).toEqual({ error: 'texte_refuse', champ: 'libelleBatimentSaisi', motif: 'lien' })
    const accepte = await apercu({ perimetre: { portee: 'batiment', batiment: 'bmoiexempletest' }, libelleBatimentSaisi: 'B' })
    expect((await accepte.json()).libellePerimetre).toBe('Bâtiment B')
  })

  it('annonce (H1 = C) : copropriété entière seulement, p_annonce vrai', async () => {
    expect((await apercu({ perimetre: { portee: 'batiment', batiment: 'a' }, annonce: true })).status).toBe(400)
    expect((await (await apercu({ perimetre: { portee: 'copropriete' }, annonce: true })).json()).nbDestinataires).toBe(4)
    expect(baseQr.etat.appelsRpc.find((a) => a.nom === 'signalements_qr_diffusion_apercu')?.args.p_annonce).toBe(true)
  })
})

describe('D-R3 envoi', () => {
  it('201 : création (auteur de la session, instruction écrite, valeurs du serveur), copie au cabinet, lots ; totaux', async () => {
    const res = await diffuser()
    expect(res.status).toBe(201)
    const corps = await res.json()
    expect(corps).toEqual({ diffusionId: 'df000000-0000-4000-8000-000000000001', nbDestinataires: 3, envoyes: 3, refuses: 0, reste: 0, arret: null, rejeu: false })
    const creation = baseQr.etat.appelsRpc.find((a) => a.nom === 'signalements_qr_diffusion_creer')
    expect(creation?.args).toMatchObject({
      p_operation: OPERATION, p_copropriete: COPRO, p_acteur: ADMIN_QR.id, p_profil: 'super_admin', p_gestionnaire: null,
      p_instruction_reference: 'Courriel de la gestionnaire du 12/11/2026 10:02', p_instruction_recue_le: '2026-11-12',
      p_modele: 'coupure_eau', p_portee: 'copropriete', p_libelle: 'Toute la copropriété', p_attendu: 23,
      p_jusqu_au: DIFFUSION_VALIDE.perimetreJusquAu, p_expediteur: expect.stringMatching(/^"Cabinet Exemple" </),
    })
    // Copie au contact du cabinet (sans lien ni jeton), un lot détaillé à clé d'idempotence propre, datée au succès.
    expect(detaille.copies).toHaveLength(1)
    expect(detaille.copies[0].options.idempotencyKey).toBe('aj-diffusion-df000000-0000-4000-8000-000000000001-copie')
    expect(detaille.copies[0].messages.map((m) => m.to)).toEqual(['contact@cabinet-exemple.test'])
    expect(detaille.copies[0].messages[0].html).not.toMatch(/desinscription|href=/)
    expect(simulQr.lots).toEqual([])
    expect(baseQr.table('signalements_qr_diffusions')[0].copie_cabinet_le).toEqual(expect.any(String))
    // Un lot, un message par déclarant, en-tête un clic.
    expect(detaille.appels).toHaveLength(1)
    expect(detaille.appels[0].options.idempotencyKey).toBe('aj-diffusion-df000000-0000-4000-8000-000000000001-1')
    expect(detaille.appels[0].messages.map((m) => m.to)).toEqual(['declarant1@exemple.test', 'declarant2@exemple.test', 'declarant3@exemple.test'])
    expect(detaille.appels[0].messages[0].headers?.['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
  })

  it('double clic (même operationId) → 200, même diffusion, aucun nouvel envoi ni nouvelle copie', async () => {
    const premier = await (await diffuser()).json()
    const lots = simulQr.lots.length
    const appels = detaille.appels.length
    const res = await diffuser()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ...premier, arret: null, rejeu: true })
    expect(simulQr.lots).toHaveLength(lots)
    expect(detaille.appels).toHaveLength(appels)
    expect(detaille.copies).toHaveLength(1)
  })

  it('super admin : instruction écrite absente → 400 ; date de l’instruction future → 400 ; référence avec « @ » → 400 ; rien n’est créé', async () => {
    const { instruction: _i, ...sansInstruction } = DIFFUSION_VALIDE
    expect((await diffuser(sansInstruction)).status).toBe(400)
    expect((await diffuser({ ...DIFFUSION_VALIDE, instruction: { reference: 'Courriel du cabinet', recueLe: '2999-01-01' } })).status).toBe(400)
    expect((await diffuser({ ...DIFFUSION_VALIDE, instruction: { reference: 'Courriel de x@exemple.test', recueLe: '2026-11-12' } })).status).toBe(400)
    expect(baseQr.etat.appelsRpc.filter((a) => a.nom === 'signalements_qr_diffusion_creer')).toEqual([])
  })

  it.each([
    ['objet', { objet: 'Voir www.exemple.fr' }, 'lien'],
    ['texte', { texte: 'Pour un plombier, appelez Dupont au 07 98 76 54 32.' }, 'telephone'],
    ['texte', { texte: 'Profitez de notre offre spéciale de réparation.' }, 'terme_commercial'],
    ['texte', { texte: 'Écrivez à syndic@exemple.test pour toute question.' }, 'adresse_email'],
    ['texte', { texte: 'L’eau sera coupée le [date] de 9 h à 10 h.' }, 'a_completer'],
  ])('contenu refusé (%s) → 400 texte_refuse, motif %s, rien n’est créé', async (champ, remplacement, motif) => {
    const res = await diffuser({ ...DIFFUSION_VALIDE, ...remplacement })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'texte_refuse', champ, motif })
    expect(baseQr.etat.appelsRpc.filter((a) => a.nom === 'signalements_qr_diffusion_creer')).toEqual([])
  })

  it('caractère invisible ou de contrôle → 400 (schéma) ; aucun paramètre de forçage accepté', async () => {
    expect((await diffuser({ ...DIFFUSION_VALIDE, objet: 'Coupure​ d’eau' })).status).toBe(400)
    expect((await diffuser({ ...DIFFUSION_VALIDE, urgent: true })).status).toBe(400)
    expect((await diffuser({ ...DIFFUSION_VALIDE, forcer: true })).status).toBe(400)
  })

  it.each([
    ['copropriété désactivée', () => { baseQr.table('signalements_qr_coproprietes')[0].actif = false }],
    ['cabinet non activé', () => { baseQr.table('signalements_qr_cabinets')[0].diffusion_activee_le = null }],
    ['fin de mission passée', () => { baseQr.table('signalements_qr_coproprietes')[0].diffusion_fin_gestion_le = '2026-11-01' }],
  ])('%s → 409 diffusion_inactive (base), aucun envoi', async (_cas, preparer) => {
    preparer()
    const res = await diffuser()
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'diffusion_inactive' })
    expect(detaille.appels).toEqual([])
  })

  it('copropriété sans cabinet → 409 diffusion_inactive sans appel de création', async () => {
    const res = await diffuser(DIFFUSION_VALIDE, COPRO_SANS_CABINET)
    expect(res.status).toBe(409)
    expect(baseQr.etat.appelsRpc.filter((a) => a.nom === 'signalements_qr_diffusion_creer')).toEqual([])
  })

  it('nombre réel au-dessus de l’annoncé → 409 perimetre_change ; personne → 409 aucun_destinataire', async () => {
    expect((await diffuser({ ...DIFFUSION_VALIDE, nbDestinatairesAttendu: 2 })).status).toBe(409)
    baseQr.etat.fonctions.signalements_qr_diffusion_creer = () => ERREUR_METIER('aucun_destinataire')
    const res = await diffuser()
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'aucun_destinataire' })
  })

  it('libellé à saisir non fourni → 400 ; clé inconnue → 409 perimetre_change', async () => {
    expect((await diffuser({ ...DIFFUSION_VALIDE, perimetre: { portee: 'batiment', batiment: 'bmoiexempletest' } })).status).toBe(400)
    expect((await diffuser({ ...DIFFUSION_VALIDE, perimetre: { portee: 'batiment', batiment: 'zz' } })).status).toBe(409)
  })

  // Relecture 2 de la PR 3 (constat 6) : cahier § 3.6 (« le libellé est calculé par le serveur et montré tel quel dans la
  // confirmation ») et § 7.2, point 9 (« périmètre tel qu'il sera écrit dans l'e-mail »). D-R3 recalcule le libellé sur
  // les couples relus : un dépôt arrivé après l'aperçu (non destinataire) ou une fiche modifiée peut le changer ; la
  // route compare alors au libellé CONFIRMÉ (rendu par D-R2, renvoyé par l'écran) et refuse s'il diffère.
  it('libellé confirmé exigé (400 sans lui) et passé tel quel à la base', async () => {
    const { libellePerimetre: _l, ...sansLibelle } = DIFFUSION_VALIDE
    expect((await diffuser(sansLibelle)).status).toBe(400)
    expect((await diffuser({ ...DIFFUSION_VALIDE, libellePerimetre: '' })).status).toBe(400)
    expect((await diffuser({ ...DIFFUSION_VALIDE, libellePerimetre: 'x'.repeat(201) })).status).toBe(400)
    expect(baseQr.etat.appelsRpc.filter((a) => a.nom === 'signalements_qr_diffusion_creer')).toEqual([])
    expect((await diffuser()).status).toBe(201)
    expect(baseQr.etat.appelsRpc.find((a) => a.nom === 'signalements_qr_diffusion_creer')?.args.p_libelle).toBe('Toute la copropriété')
  })

  it('un dépôt arrivé entre l’aperçu et l’envoi change le libellé recalculé (« Bât C » passe devant « Bloc C ») → 409 perimetre_change, rien n’est créé', async () => {
    let couples = [{ batiment: 'Bloc C', etage: '1', nb_adresses: 2 }, { batiment: 'Bât C', etage: '1', nb_adresses: 1 }]
    baseQr.etat.fonctions.signalements_qr_diffusion_valeurs = () => ({ data: couples })
    const vu = await (await apercu({ perimetre: { portee: 'batiment', batiment: 'c' } })).json()
    expect(vu.libellePerimetre).toContain('Bloc C')
    const corps = { ...DIFFUSION_VALIDE, perimetre: { portee: 'batiment', batiment: 'c' }, libellePerimetre: vu.libellePerimetre, nbDestinatairesAttendu: 3 }

    couples = [{ batiment: 'Bloc C', etage: '1', nb_adresses: 2 }, { batiment: 'Bât C', etage: '1', nb_adresses: 3 }]
    const refus = await diffuser(corps)
    expect(refus.status).toBe(409)
    expect(await refus.json()).toEqual({ error: 'perimetre_change' })
    expect(baseQr.etat.appelsRpc.filter((a) => a.nom === 'signalements_qr_diffusion_creer')).toEqual([])

    // Nouvel aperçu, nouvelle confirmation : le libellé montré est celui que la base reçoit.
    const revu = await (await apercu({ perimetre: { portee: 'batiment', batiment: 'c' } })).json()
    expect(revu.libellePerimetre).toContain('Bât C')
    expect((await diffuser({ ...corps, libellePerimetre: revu.libellePerimetre })).status).toBe(201)
    expect(baseQr.etat.appelsRpc.find((a) => a.nom === 'signalements_qr_diffusion_creer')?.args.p_libelle).toBe(revu.libellePerimetre)
  })

  it('nouvel essai de la MÊME opération après un dépôt qui change le libellé : 200 rejeu (la diffusion déjà créée), jamais 409', async () => {
    let couples = [{ batiment: 'Bloc C', etage: '1', nb_adresses: 2 }, { batiment: 'Bât C', etage: '1', nb_adresses: 1 }]
    baseQr.etat.fonctions.signalements_qr_diffusion_valeurs = () => ({ data: couples })
    const vu = await (await apercu({ perimetre: { portee: 'batiment', batiment: 'c' } })).json()
    const corps = { ...DIFFUSION_VALIDE, perimetre: { portee: 'batiment', batiment: 'c' }, libellePerimetre: vu.libellePerimetre, nbDestinatairesAttendu: 3 }
    const premier = await diffuser(corps)
    expect(premier.status).toBe(201)
    couples = [{ batiment: 'Bloc C', etage: '1', nb_adresses: 2 }, { batiment: 'Bât C', etage: '1', nb_adresses: 3 }]
    const second = await diffuser(corps)
    expect(second.status).toBe(200)
    expect(await second.json()).toMatchObject({ diffusionId: (await premier.json()).diffusionId, rejeu: true })
    expect(baseQr.table('signalements_qr_diffusions')).toHaveLength(1)
    // Un autre auteur avec la même opération n'est pas un rejeu : refusé, comme un libellé changé.
    simulQr.user = { ...ADMIN_QR, id: '389c1c99-49f3-41d9-8bb3-e19ecbfb3dd5' }
    expect((await diffuser(corps)).status).toBe(409)
  })

  it('fiche modifiée entre l’aperçu et l’envoi (nom de bâtiment de la fiche) → 409 perimetre_change', async () => {
    const vu = await (await apercu({ perimetre: { portee: 'batiment', batiment: 'a' } })).json()
    expect(vu.libellePerimetre).toContain('Bâtiment A')
    baseQr.table('signalements_qr_coproprietes')[0].batiments = ['Bloc A']
    const res = await diffuser({ ...DIFFUSION_VALIDE, perimetre: { portee: 'batiment', batiment: 'a' }, libellePerimetre: vu.libellePerimetre, nbDestinatairesAttendu: 4 })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'perimetre_change' })
    expect((await (await apercu({ perimetre: { portee: 'batiment', batiment: 'a' } })).json()).libellePerimetre).toContain('Bloc A')
  })

  it('message d’annonce (H1 = C) : texte figé exigé (400 sinon) ; figé → créé au modèle annonce', async () => {
    const annonce = annonceDiffusionQr('fr', 'Cabinet Exemple')
    expect((await diffuser({ ...DIFFUSION_VALIDE, modele: 'annonce', objet: annonce.objet, texte: `${annonce.texte} Merci.` })).status).toBe(400)
    expect((await diffuser({ ...DIFFUSION_VALIDE, modele: 'annonce', perimetre: { portee: 'batiment', batiment: 'a' }, objet: annonce.objet, texte: annonce.texte })).status).toBe(400)
    const res = await diffuser({ ...DIFFUSION_VALIDE, modele: 'annonce', objet: annonce.objet, texte: annonce.texte })
    expect(res.status).toBe(201)
    expect(baseQr.etat.appelsRpc.find((a) => a.nom === 'signalements_qr_diffusion_creer')?.args.p_modele).toBe('annonce')
  })

  it('clé de signature des liens absente → 503 configuration_incomplete, rien n’est créé', async () => {
    delete process.env.AJ_SIGNALEMENT_CLE_LIENS_DIFFUSION
    const res = await diffuser()
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'configuration_incomplete' })
    expect(baseQr.etat.appelsRpc).toEqual([])
  })

  it('migration absente (fonction de création inconnue) → 503 base_absente', async () => {
    delete baseQr.etat.fonctions.signalements_qr_diffusion_creer
    expect((await diffuser()).status).toBe(503)
  })

  it('journal serveur sans adresse, sans objet ni texte ; journal métier écrit par la base seulement (aucune insertion ici)', async () => {
    baseQr.etat.fonctions.signalements_qr_diffusion_creer = () => ({ error: { code: 'XX000', message: 'détail interne declarant1@exemple.test' } })
    expect((await diffuser()).status).toBe(500)
    poserFonctions()
    await diffuser()
    const journal = texteJournalServeurQr()
    expect(journal).not.toContain('@')
    expect(journal).not.toContain('Coupure')
    expect(journal).not.toContain('réparation')
    expect(ecrituresJournal()).toEqual([])
  })
})

describe('D-R5 historique et D-R6 détail', () => {
  it('historique : nombres agrégés, auteur « administrateur », compteur du mois ; aucun « @ » ; purge une fois par jour', async () => {
    await diffusionCreee()
    const res = await historique()
    expect(res.status).toBe(200)
    const corps = await res.json()
    expect(corps.diffusions).toEqual([expect.objectContaining({
      id: 'df000000-0000-4000-8000-000000000001', auteur: 'administrateur', modele: 'coupure_eau', objet: DIFFUSION_VALIDE.objet,
      libellePerimetre: 'Toute la copropriété', nombres: expect.objectContaining({ destinataires: 3, envoyes: 3 }),
    })])
    expect(corps.ceMois).toEqual({ nb: 3, dernierLe: '2026-11-08T10:00:00+00:00' })
    expect(corps.suivant).toBeNull()
    expect(JSON.stringify(corps)).not.toContain('@')
    expect(JSON.stringify(corps)).not.toContain(ADMIN_QR.id)
    expect(simulQr.limites).toContain('qr_purge_diffusion')
    expect(baseQr.etat.appelsRpc.some((a) => a.nom === 'signalements_qr_diffusion_purger')).toBe(true)
  })

  it('historique : curseur BRUT de PostgREST (avec décalage) accepté ; paramètre inconnu → 400 ; copropriété inconnue → 404', async () => {
    expect((await historique(COPRO, `?avant=${encodeURIComponent('2026-11-10T12:00:00.123456+00:00')}`)).status).toBe(200)
    expect(baseQr.etat.appelsRpc.find((a) => a.nom === 'signalements_qr_diffusions_liste')?.args.p_avant).toBe('2026-11-10T12:00:00.123456+00:00')
    expect((await historique(COPRO, '?limite=500')).status).toBe(400)
    expect((await historique('c0000000-0000-4000-8000-0000000000ff')).status).toBe(404)
  })

  it('détail : texte complet, instruction, nombres par état ; ni contact, ni expéditeur, ni politique, ni « @ » ; inconnue → 404', async () => {
    const id = await diffusionCreee()
    const res = await detail(id)
    expect(res.status).toBe(200)
    const { diffusion } = await res.json()
    expect(diffusion).toMatchObject({
      id, coproprieteId: COPRO, auteur: 'administrateur', texte: DIFFUSION_VALIDE.texte,
      instruction: { reference: DIFFUSION_VALIDE.instruction.reference, recueLe: '2026-11-12' }, nombres: expect.objectContaining({ envoyes: 3, attente: 0 }),
    })
    expect(JSON.stringify(diffusion)).not.toMatch(/@|https:|expediteur|contact/)
    expect((await detail('df000000-0000-4000-8000-0000000000ff')).status).toBe(404)
  })
})

/** Une diffusion créée par D-R3 dont le premier lot a été refusé (limite du service) : 3 lignes en attente, âge choisi. */
async function diffusionEnAttente(age: number): Promise<string> {
  detaille.resultats = [{ ok: false, code: 'limite', statutHttp: 429, motif: 'rate_limit_exceeded' }]
  baseQr.etat.fonctions.signalements_qr_diffusion_resultats = (a) => {
    for (const l of destinataires.filter((x) => x.lot === a.p_lot && x.etat === 'en_cours')) Object.assign(l, { etat: 'en_attente', lot: null })
    return { data: { envoyes: 0, refuses: 0, nonPartis: 3, reste: 3 } }
  }
  const res = await diffuser()
  expect(await res.json()).toMatchObject({ reste: 3, arret: 'limite_service' })
  poserFonctions()
  const id = baseQr.table('signalements_qr_diffusions')[0].id as string
  baseQr.table('signalements_qr_diffusions')[0].created_at = ilYa(age)
  return id
}

describe('D-R4 reprise', () => {
  it('moins d’une heure : jusqu’à 5 lots, journal diffusion.reprise (identifiants et énumérations seulement) ; totaux', async () => {
    const id = await diffusionEnAttente(5 * 60_000)
    const res = await reprendre(id)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ envoyes: 3, refuses: 0, reste: 0, arret: null })
    const journal = ecrituresJournal()
    expect(journal).toHaveLength(1)
    expect(journal[0].valeurs).toMatchObject({ action: 'diffusion.reprise', acteur_id: ADMIN_QR.id, acteur_profil: 'super_admin', copropriete_id: COPRO, details: { diffusion: id, mode: 'manuelle', confirmee: false } })
    expect(JSON.stringify(journal)).not.toMatch(/@|Coupure|Astreinte/)
  })

  it('plus d’une heure sans confirmation → 409 a_confirmer (heure d’écriture rendue) ; avec confirmeContenuAJour → envoi', async () => {
    const id = await diffusionEnAttente(2 * HEURE)
    const refus = await reprendre(id)
    expect(refus.status).toBe(409)
    expect(await refus.json()).toEqual({ error: 'a_confirmer', creeLe: baseQr.table('signalements_qr_diffusions')[0].created_at })
    expect(detaille.appels).toHaveLength(1)
    const ok = await reprendre(id, { confirmeContenuAJour: true })
    expect(ok.status).toBe(200)
    expect(detaille.appels).toHaveLength(2)
  })

  it('plus de 24 h → 410 perime ; inconnue → 404 ; champ inconnu → 400', async () => {
    const id = await diffusionEnAttente(25 * HEURE)
    expect((await reprendre(id, { confirmeContenuAJour: true })).status).toBe(410)
    expect((await reprendre('df000000-0000-4000-8000-0000000000ff')).status).toBe(404)
    expect((await reprendre(id, { forcer: true })).status).toBe(400)
  })

  it('copropriété désactivée depuis → 409 diffusion_inactive, lignes restantes annulées par la base, rien ne part', async () => {
    const id = await diffusionEnAttente(5 * 60_000)
    baseQr.table('signalements_qr_coproprietes')[0].actif = false
    const res = await reprendre(id)
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'diffusion_inactive' })
    expect(detaille.appels).toHaveLength(1)
    expect(destinataires.every((l) => l.etat === 'annule')).toBe(true)
  })

  it('clé de signature absente → 503 configuration_incomplete', async () => {
    const id = await diffusionEnAttente(5 * 60_000)
    delete process.env.AJ_SIGNALEMENT_CLE_LIENS_DIFFUSION
    expect((await reprendre(id)).status).toBe(503)
  })
})

// Relecture 2 de la PR 3 (constat 5) : cahier § 5.6, J29, HF4 — « une copie de chaque diffusion » au contact du cabinet
// (elle documente l'envoi et fait voir vite un envoi inattendu). Elle reste DUE tant que copie_cabinet_le est NULL : D-R3,
// la reprise D-R4 et le filet D-C1 (tests/securite/cron-aj-diffusion.test.ts) l'envoient avant les lots, avec une clé
// d'idempotence propre (aj-diffusion-<id>-copie : deux envois concurrents n'en font qu'un chez Resend, 24 h, la durée
// d'une reprise), et la datent au succès. Son échec n'arrête jamais l'envoi aux déclarants (logger.warn).
describe('copie au cabinet : due tant qu’elle n’est pas partie (D-R3, reprise D-R4)', () => {
  const ID1 = 'df000000-0000-4000-8000-000000000001'
  const copieDatee = () => baseQr.table('signalements_qr_diffusions')[0].copie_cabinet_le
  const messagesDesLots = () => detaille.appels.flatMap((a) => a.messages)

  it('D-R3 arrêté après la création, avant la copie (relecture échouée) : la reprise envoie la copie (datée), puis les lots', async () => {
    baseQr.etat.erreursPonctuelles.signalements_qr_diffusions = { code: '08006', message: 'connexion perdue' }
    expect((await diffuser()).status).toBe(500)
    expect(baseQr.table('signalements_qr_diffusions')).toHaveLength(1)
    expect(detaille.copies).toEqual([])
    const rep = await reprendre(ID1)
    expect(rep.status).toBe(200)
    expect(await rep.json()).toMatchObject({ envoyes: 3, reste: 0 })
    expect(detaille.copies.map((c) => c.options.idempotencyKey)).toEqual([`aj-diffusion-${ID1}-copie`])
    expect(detaille.copies[0].messages.map((m) => m.to)).toEqual(['contact@cabinet-exemple.test'])
    expect(copieDatee()).toEqual(expect.any(String))
    expect(messagesDesLots()).toHaveLength(3)
    // Copie avant le premier lot (le cabinet voit l'envoi avant les déclarants).
    expect(detaille.cles).toEqual([`aj-diffusion-${ID1}-copie`, `aj-diffusion-${ID1}-1`])
  })

  it('copie déjà partie (datée par D-R3) : ni la reprise ni le rejeu ne la renvoient', async () => {
    const id = await diffusionEnAttente(5 * 60_000)
    expect(detaille.copies).toHaveLength(1)
    const datee = copieDatee()
    expect((await reprendre(id)).status).toBe(200)
    expect((await diffuser()).status).toBe(200)
    expect(detaille.copies).toHaveLength(1)
    expect(copieDatee()).toBe(datee)
  })

  it('copie refusée par le service : logger.warn (identifiant et code seuls), les déclarants reçoivent ; la reprise suivante la retente, même clé', async () => {
    detaille.resultatsCopies = [{ ok: false, code: 'reseau', statutHttp: null, motif: 'delai_depasse' }]
    const res = await diffuser()
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ envoyes: 3, reste: 0 })
    expect(copieDatee()).toBeNull()
    expect(simulQr.logger.warn).toHaveBeenCalledWith(expect.stringContaining('copie'), { diffusionId: ID1, code: 'reseau' })
    expect((await reprendre(ID1)).status).toBe(200)
    expect(detaille.copies.map((c) => c.options.idempotencyKey)).toEqual([`aj-diffusion-${ID1}-copie`, `aj-diffusion-${ID1}-copie`])
    expect(copieDatee()).toEqual(expect.any(String))
    expect(texteJournalServeurQr()).not.toContain('@')
  })

  it('reprise sur une copropriété devenue inactive : aucune copie (rien ne part), 409 diffusion_inactive', async () => {
    detaille.resultatsCopies = [{ ok: false, code: 'reseau', statutHttp: null, motif: 'delai_depasse' }]
    const id = await diffusionEnAttente(5 * 60_000)
    expect(detaille.copies).toHaveLength(1)
    baseQr.table('signalements_qr_coproprietes')[0].actif = false
    expect((await reprendre(id)).status).toBe(409)
    expect(detaille.copies).toHaveLength(1)
    expect(copieDatee()).toBeNull()
  })
})

describe('D-R7 opposition à la demande écrite du déclarant', () => {
  it('200 : fonction appelée avec la copropriété du chemin, l’auteur de la session, la date de la demande', async () => {
    const res = await opposer(COPRO, SIG, { demandeRecueLe: '2026-11-10' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ enregistree: true })
    expect(baseQr.etat.appelsRpc.find((a) => a.nom === 'signalements_qr_diffusion_opposer_signalement')?.args).toEqual({
      p_signalement: SIG, p_copropriete: COPRO, p_acteur: ADMIN_QR.id, p_profil: 'super_admin', p_gestionnaire: null, p_demande_recue_le: '2026-11-10',
    })
  })

  it('signalement d’une AUTRE copropriété → 404 sans appel ; date future → 400 ; champ inconnu → 400', async () => {
    expect((await opposer(COPRO, SIG_AUTRE, { demandeRecueLe: '2026-11-10' })).status).toBe(404)
    expect(baseQr.etat.appelsRpc).toEqual([])
    expect((await opposer(COPRO, SIG, { demandeRecueLe: '2999-01-01' })).status).toBe(400)
    expect((await opposer(COPRO, SIG, { demandeRecueLe: '2026-11-10', motif: 'x' })).status).toBe(400)
  })

  it('migration absente (fonction inconnue) → 503 base_absente', async () => {
    delete baseQr.etat.fonctions.signalements_qr_diffusion_opposer_signalement
    expect((await opposer(COPRO, SIG, { demandeRecueLe: '2026-11-10' })).status).toBe(503)
  })
})

describe('D-R8 réglages de diffusion et activation du cabinet', () => {
  const cabinetNu = () => {
    baseQr.etat.tables.signalements_qr_cabinets = [{ id: CAB, nom: 'Cabinet Exemple', identifiant: 'cabinet-exemple', langue: 'fr', diffusion_telephones: [] }]
  }
  const COMPLET = {
    diffusionContactEmail: ' Contact@Cabinet-Exemple.test ', diffusionPolitiqueUrl: 'https://cabinet-exemple.test/confidentialite',
    politiqueDecritDiffusion: true, contratReference: 'Contrat exemple v1', contratSigneLe: '2026-11-01',
  }

  it.each([
    ['contact', 'diffusionContactEmail'], ['politique', 'diffusionPolitiqueUrl'], ['declaration_politique', 'politiqueDecritDiffusion'],
    ['contrat_reference', 'contratReference'], ['contrat_date', 'contratSigneLe'],
  ] as const)('activation sans %s → 409 cabinet_incomplet avec la liste de ce qui manque, aucune écriture', async (manque, champ) => {
    cabinetNu()
    const { [champ]: _retire, ...corps } = COMPLET
    const res = await modifierCabinet(CAB, { ...corps, diffusionActivee: true })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'cabinet_incomplet', manque: [manque] })
    expect(baseQr.etat.appelsRpc).toEqual([])
  })

  it('complet → activé en UNE fonction SQL : adresse en minuscules, téléphones normalisés et dédoublonnés, auteur = session ; réglages rendus', async () => {
    cabinetNu()
    const res = await modifierCabinet(CAB, { ...COMPLET, telephonesAutorises: ['+33 6 12 34 56 78', '06 12 34 56 78', '0033612345678'], diffusionActivee: true })
    expect(res.status).toBe(200)
    expect(baseQr.etat.appelsRpc.filter((a) => a.nom === 'signalements_qr_diffusion_regler_cabinet').map((a) => a.args)).toEqual([{
      p_cabinet: CAB, p_acteur: ADMIN_QR.id, p_contact: 'contact@cabinet-exemple.test', p_politique: 'https://cabinet-exemple.test/confidentialite',
      p_politique_declaree: true, p_contrat_reference: 'Contrat exemple v1', p_contrat_signe_le: '2026-11-01',
      p_telephones: ['33612345678', '0612345678'], p_activer: true,
    }])
    const corps = await res.json()
    expect(corps.cabinet).toMatchObject({ id: CAB, identifiant: 'cabinet-exemple' })
    expect(corps.diffusion).toMatchObject({ active: true, contactEmail: 'contact@cabinet-exemple.test', manque: [], langueOuverte: true })
    // Journal : écrit par la fonction SQL (simulée ici), jamais par la route avec des valeurs.
    expect(ecrituresJournal()).toEqual([])
  })

  it('H9 : cabinet « pt » → 409 langue_non_ouverte, même complet', async () => {
    const res = await modifierCabinet(CAB_PT, { ...COMPLET, diffusionActivee: true })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'langue_non_ouverte' })
    expect(baseQr.etat.appelsRpc).toEqual([])
  })

  it('cabinet activé : politique changée sans nouvelle déclaration → 409 cabinet_incomplet (declaration_politique) ; suspension permise', async () => {
    const res = await modifierCabinet(CAB, { diffusionPolitiqueUrl: 'https://cabinet-exemple.test/nouvelle' })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'cabinet_incomplet', manque: ['declaration_politique'] })
    const suspension = await modifierCabinet(CAB, { diffusionActivee: false })
    expect(suspension.status).toBe(200)
    expect((await suspension.json()).diffusion.active).toBe(false)
  })

  it('refus de la base (cabinet_incomplet levé par la fonction) → 409', async () => {
    baseQr.etat.fonctions.signalements_qr_diffusion_regler_cabinet = () => ERREUR_METIER('cabinet_incomplet')
    expect((await modifierCabinet(CAB, { diffusionActivee: true })).status).toBe(409)
  })

  it.each([
    ['mêlé aux champs du cabinet', { nom: 'Nouveau nom', diffusionActivee: true }],
    ['politique en http', { diffusionPolitiqueUrl: 'http://cabinet-exemple.test/confidentialite' }],
    ['politique avec une espace', { diffusionPolitiqueUrl: 'https://cabinet-exemple.test/a b' }],
    ['contact hors du langage de la base', { diffusionContactEmail: 'o’brien@exemple.test' }],
    ['déclaration à faux', { politiqueDecritDiffusion: false }],
    ['contrat daté dans le futur', { contratSigneLe: '2999-01-01' }],
    ['téléphone illisible', { telephonesAutorises: ['appelez-moi'] }],
    ['plus de 10 téléphones', { telephonesAutorises: Array.from({ length: 11 }, (_, i) => `06123456${String(i).padStart(2, '0')}`) }],
  ])('%s → 400, aucune écriture', async (_cas, corps) => {
    expect((await modifierCabinet(CAB, corps)).status).toBe(400)
    expect(baseQr.etat.appelsRpc).toEqual([])
  })

  it('migration absente (colonnes de diffusion inconnues) → 503 base_absente ; la modification PR 1 (nom) reste servie', async () => {
    baseQr.etat.colonnesAbsentes.signalements_qr_cabinets = ['diffusion_contact_email']
    expect((await modifierCabinet(CAB, { diffusionActivee: true })).status).toBe(503)
    baseQr.etat.fonctions.signalements_qr_enregistrer_cabinet = () => ({ data: { id: CAB, cree: false, champs: ['nom'] } })
    expect((await modifierCabinet(CAB, { nom: 'Cabinet Exemple Bis' })).status).toBe(200)
  })

  it('GET : le cabinet et ses réglages ; migration absente → diffusion null (journalisé une fois)', async () => {
    const res = await lireCabinet(CAB)
    expect(res.status).toBe(200)
    expect((await res.json()).diffusion).toMatchObject({ active: true, telephones: ['0612345678'], manque: [] })
    baseQr.etat.colonnesAbsentes.signalements_qr_cabinets = ['diffusion_contact_email']
    expect((await (await lireCabinet(CAB)).json()).diffusion).toBeNull()
    expect((await lireCabinet('ca000000-0000-4000-8000-0000000000ff')).status).toBe(404)
  })
})

describe('codes et messages de l’écran (api.ts, affichage.ts)', () => {
  it.each(['diffusion_inactive', 'aucun_destinataire', 'perimetre_change', 'a_confirmer', 'cabinet_incomplet', 'langue_non_ouverte'])('409 « %s » rendu tel quel', (code) => {
    expect(CODES_METIER_QR).toContain(code)
    expect(codeDepuisReponseQr(409, { error: code })).toBe(code)
  })

  it('410 perime, 400 texte_refuse, 503 configuration_incomplete ; chaque code a un message sans profil ni migration', () => {
    expect(codeDepuisReponseQr(410, { error: 'perime' })).toBe('perime')
    expect(codeDepuisReponseQr(400, { error: 'texte_refuse', champ: 'texte', motif: 'lien' })).toBe('texte_refuse')
    expect(codeDepuisReponseQr(503, { error: 'configuration_incomplete' })).toBe('configuration_incomplete')
    expect(codeDepuisReponseQr(400, { error: 'configuration_incomplete' })).toBe('invalide')
    for (const code of ['diffusion_inactive', 'aucun_destinataire', 'perimetre_change', 'a_confirmer', 'perime', 'cabinet_incomplet', 'langue_non_ouverte', 'texte_refuse', 'configuration_incomplete'] as const) {
      expect(messageErreurTableauQr(code).length, code).toBeGreaterThan(10)
      expect(messageErreurGestionnaireQr(code), code).not.toMatch(/super admin|migration|SQL/i)
    }
    expect(messageErreurTableauQr('configuration_incomplete')).toBe('Fonction pas encore activée.')
  })

  it('modèles du schéma (lib/validation.ts, lu par des écrans) = MODELES_DIFFUSION_QR', () => {
    expect([...MODELES_DIFFUSION_SCHEMA_QR].sort()).toEqual([...MODELES_DIFFUSION_QR].sort())
  })
})
