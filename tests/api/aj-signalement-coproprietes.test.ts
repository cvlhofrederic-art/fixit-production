// tests/api/aj-signalement-coproprietes.test.ts
//
// Copropriétés vues du super admin, routes étendues SANS rupture du contrat des écrans actuels :
//   POST   /coproprietes                     P1-R3  fonction unique de création (lot d'une ligne), doublons, domaines
//   PATCH  /coproprietes/[id]                P1-R4  doublons revérifiés, adresses ajoutées contrôlées, journal sans valeur
//   DELETE /coproprietes/[id]                P1-R5  seulement sans signalement, nom exact, journal avant
//   PUT    /coproprietes/[id]/gestionnaires  P1-R6  attributions et « attribuée à tous »
// Corps actuels de creerCoproprieteQr ({ nom, adresse, emailsDestinataires }, sans operationId) et de
// modifierCoproprieteQr ({ …saisie, actif }, { regenererJeton: true }, { adresse }) acceptés tels quels.
// Fonctions SQL simulées ; données fictives (@exemple.test, « Résidence Exemple »).

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/supabase-server', async () => ({ supabaseAdmin: (await import('../helpers/aj-signalement-base')).baseQr.client }))
vi.mock('@/lib/supabase-server-component', async () => (await import('../helpers/aj-signalement-routes')).mockCookies())
vi.mock('@/lib/auth-helpers', async () => (await import('../helpers/aj-signalement-routes')).mockAuth())
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/aj-signalement-routes')).mockLimites())
vi.mock('@/lib/email', async () => (await import('../helpers/aj-signalement-routes')).mockEmail())
vi.mock('@/lib/logger', async () => (await import('../helpers/aj-signalement-routes')).mockLogger())

const { baseQr, simulerProductionAvant1111Qr } = await import('../helpers/aj-signalement-base')
const { ADMIN_QR, contexteQr, reinitialiserSimulQr, requeteQr, simulQr, texteJournalServeurQr } = await import('../helpers/aj-signalement-routes')
const { POST } = await import('@/app/api/aj-signalement/coproprietes/route')
const { PATCH, DELETE } = await import('@/app/api/aj-signalement/coproprietes/[id]/route')
const { PUT } = await import('@/app/api/aj-signalement/coproprietes/[id]/gestionnaires/route')
const { reinitialiserReplisQr } = await import('@/lib/aj-signalement/serveur')

const CAB = 'ca000000-0000-4000-8000-000000000001'
const COPRO = 'c0000000-0000-4000-8000-000000000001'
const COPRO_SANS_CABINET = 'c0000000-0000-4000-8000-000000000002'
const G = 'a0000000-0000-4000-8000-000000000001'
const OPERATION = 'f0000000-0000-4000-8000-000000000001'
const JETON = '0123456789abcdef0123456789abcdef'

const ligneCopro = (sur: Record<string, unknown> = {}) => ({
  id: COPRO, nom: 'Résidence Exemple', adresse: '1 rue Exemple', jeton: JETON, emails_destinataires: ['cs@externe.test'], actif: true,
  created_at: '2026-11-10T09:00:00+00:00', cabinet_id: CAB, code_postal: '13001', ville: 'Marseille', immatriculation: null,
  reference_cabinet: null, batiments: [], attribuee_a_tous: false, cree_par_gestionnaire_id: null, cle_nom: 'exemple',
  ...sur,
})

beforeEach(() => {
  reinitialiserSimulQr()
  reinitialiserReplisQr()
  baseQr.reinitialiser()
  vi.unstubAllEnvs()
  const t = baseQr.etat.tables
  t.signalements_qr_cabinets = [{ id: CAB, nom: 'Cabinet Exemple', identifiant: 'cabinet-exemple', langue: 'fr' }]
  t.signalements_qr_domaines_autorises = [{ cabinet_id: CAB, domaine: 'exemple.test' }]
  t.signalements_qr_coproprietes = [
    ligneCopro(),
    ligneCopro({ id: COPRO_SANS_CABINET, nom: 'Parc Exemple', jeton: 'f'.repeat(32), cabinet_id: null, code_postal: '', ville: '', emails_destinataires: [], cle_nom: null }),
  ]
  t.signalements_qr_gestionnaires = [{ id: G, cabinet_id: CAB, nom: 'Marie Exemple', email: 'marie.exemple@exemple.test', actif: true }]
  t.signalements_qr_attributions = [{ copropriete_id: COPRO, gestionnaire_id: G, origine: 'super_admin' }]
  t.signalements_qr = []
  t.signalements_qr_journal = []
  baseQr.etat.fonctions.signalements_qr_creer_coproprietes = (a) => {
    const deja = baseQr.table('signalements_qr_operations').find((o) => o.id === a.p_operation)
    if (deja) return { data: { ...(deja.resultat as Record<string, unknown>), rejeu: true } }
    const [l] = a.p_lignes as Array<Record<string, unknown>>
    // Première création du test : …099, puis …098, …097 (un id par copropriété, comme la base).
    const nbCreees = baseQr.table('signalements_qr_coproprietes').filter((c) => String(c.id).startsWith('c0000000-0000-4000-8000-0000000000') && Number(String(c.id).slice(-2)) > 90).length
    const id = `c0000000-0000-4000-8000-0000000000${99 - nbCreees}`
    baseQr.table('signalements_qr_coproprietes').push(ligneCopro({
      id, nom: l.nom, adresse: l.adresse, code_postal: l.codePostal, ville: l.ville, immatriculation: l.immatriculation || null,
      reference_cabinet: l.referenceCabinet || null, batiments: l.batiments, emails_destinataires: l.emails, jeton: 'a'.repeat(32),
      cabinet_id: a.p_cabinet, cle_nom: l.cleNom, created_at: '2026-11-11T10:00:00+00:00', operation_id: a.p_operation,
    }))
    const resultat = { creees: [{ numeroLigne: 1, id, jeton: 'a'.repeat(32) }], completees: [] }
    baseQr.table('signalements_qr_operations').push({ id: a.p_operation, resultat })
    return { data: { ...resultat, rejeu: false } }
  }
  baseQr.etat.fonctions.signalements_qr_remplacer_attributions = (a) => {
    const copro = baseQr.table('signalements_qr_coproprietes').find((c) => c.id === a.p_copropriete)
    if (!copro) return { error: { code: 'P0001', message: 'a_reverifier' } }
    if (!copro.cabinet_id) return { error: { code: 'P0001', message: 'sans_cabinet' } }
    if (a.p_tous !== null) copro.attribuee_a_tous = a.p_tous
    baseQr.etat.tables.signalements_qr_attributions = (a.p_gestionnaires as string[]).map((g) => ({ copropriete_id: copro.id, gestionnaire_id: g, origine: 'super_admin' }))
    return { data: { gestionnaires: a.p_gestionnaires, attribueeATous: copro.attribuee_a_tous, adressesRetirees: 0 } }
  }
})

const creer = (corps: unknown) => POST(requeteQr('/api/aj-signalement/coproprietes', 'POST', corps))
const modifier = (id: string, corps: unknown) => PATCH(requeteQr(`/api/aj-signalement/coproprietes/${id}`, 'PATCH', corps), contexteQr(id))
const supprimer = (id: string, corps: unknown) => DELETE(requeteQr(`/api/aj-signalement/coproprietes/${id}`, 'DELETE', corps), contexteQr(id))
const appelsCreation = () => baseQr.etat.appelsRpc.filter((a) => a.nom === 'signalements_qr_creer_coproprietes')

describe('POST coproprietes (P1-R3)', () => {
  it('corps actuel de l’écran { nom, adresse, emailsDestinataires } sans operationId : 201, fonction appelée UNE fois, p_acteur = la session', async () => {
    const res = await creer({ nom: 'Villa Exemple', adresse: '2 rue Exemple', emailsDestinataires: ['CS@Externe.test'] })
    expect(res.status).toBe(201)
    expect(appelsCreation()).toHaveLength(1)
    const { args } = appelsCreation()[0]
    expect(args).toMatchObject({ p_acteur: ADMIN_QR.id, p_profil: 'super_admin', p_gestionnaire: null, p_cabinet: null })
    expect(args.p_operation).toEqual(expect.stringMatching(/^[0-9a-f-]{36}$/))
    expect(args.p_lignes).toEqual([{
      numeroLigne: 1, action: 'creer', nom: 'Villa Exemple', cleNom: 'villa exemple', adresse: '2 rue Exemple', codePostal: '', ville: '',
      immatriculation: '', referenceCabinet: '', batiments: [], emails: ['cs@externe.test'], gestionnaireIds: [], forcerDoublon: false,
    }])
    const { copropriete } = await res.json()
    // Forme actuelle (lue par creerCoproprieteQr et la carte) + champs ajoutés.
    expect(copropriete).toMatchObject({
      id: 'c0000000-0000-4000-8000-000000000099', nom: 'Villa Exemple', jeton: 'a'.repeat(32), nbSignalements: 0, nbEnAttente: 0, actif: true,
      cabinet: null, gestionnaires: [], attribueeATous: false, creePar: 'administrateur',
    })
  })

  it('cabinet, gestionnaire et « à tous » : cabinet transmis, attribution posée après la création', async () => {
    const res = await creer({ nom: 'Villa Exemple', cabinetId: CAB, gestionnaireIds: [G], attribueeATous: true, operationId: OPERATION })
    expect(res.status).toBe(201)
    expect(appelsCreation()[0].args).toMatchObject({ p_operation: OPERATION, p_cabinet: CAB })
    expect(baseQr.etat.appelsRpc.map((a) => a.nom)).toEqual(['signalements_qr_creer_coproprietes', 'signalements_qr_remplacer_attributions'])
    expect(baseQr.etat.appelsRpc[1].args).toEqual({ p_copropriete: 'c0000000-0000-4000-8000-000000000099', p_gestionnaires: [G], p_tous: true, p_acteur: ADMIN_QR.id })
    expect((await res.json()).copropriete).toMatchObject({ cabinet: { id: CAB, identifiant: 'cabinet-exemple' }, attribueeATous: true })
  })

  it('même operationId rejoué : 200, même copropriété', async () => {
    const premiere = await (await creer({ nom: 'Villa Exemple', operationId: OPERATION })).json()
    const rejeu = await creer({ nom: 'Villa Exemple', operationId: OPERATION })
    expect(rejeu.status).toBe(200)
    expect((await rejeu.json()).copropriete.id).toBe(premiere.copropriete.id)
  })

  it('doublon certain nom + CP dans le même cabinet : 409 avec la copropriété ; « Ce n’est pas un doublon » : forçage transmis', async () => {
    const refus = await creer({ nom: 'Résidence Exemple', codePostal: '13001', cabinetId: CAB })
    expect(refus.status).toBe(409)
    expect(await refus.json()).toEqual({
      error: 'doublon', doublon: { certitude: 'certain', critere: 'nom_code_postal', copropriete: { id: COPRO, nom: 'Résidence Exemple', ville: 'Marseille' } },
    })
    expect(appelsCreation()).toEqual([])
    const force = await creer({ nom: 'Résidence Exemple', codePostal: '13001', cabinetId: CAB, forcerDoublon: true })
    expect(force.status).toBe(201)
    expect((appelsCreation()[0].args.p_lignes as Array<Record<string, unknown>>)[0].forcerDoublon).toBe(true)
  })

  it('même nom dans un AUTRE groupe (sans cabinet) : pas de doublon', async () => {
    expect((await creer({ nom: 'Résidence Exemple', codePostal: '13001' })).status).toBe(201)
  })

  it('doublon venu de la fonction SQL (course) : 409 doublon ; 23505 immatriculation : 409 doublon', async () => {
    baseQr.etat.fonctions.signalements_qr_creer_coproprietes = () => ({ error: { code: 'P0001', message: 'doublon' } })
    expect(await (await creer({ nom: 'Villa Exemple' })).json()).toEqual({ error: 'doublon' })
    baseQr.etat.fonctions.signalements_qr_creer_coproprietes = () => ({ error: { code: '23505', message: 'duplicate key value violates unique constraint "uq_signalements_qr_copros_immatriculation"' } })
    const res = await creer({ nom: 'Villa Exemple', immatriculation: 'AB 123' })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'doublon' })
  })

  it('adresse d’une fiche gestionnaire dans les destinataires : 400 (« attribuez-lui la copropriété »)', async () => {
    const res = await creer({ nom: 'Villa Exemple', emailsDestinataires: ['Marie.Exemple@exemple.test'] })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalide', details: 'emailsDestinataires: adresse d’un gestionnaire : attribuez-lui la copropriété' })
    expect(appelsCreation()).toEqual([])
  })

  it('sous-adresse « + » d’une fiche (même boîte) : 400 comme son adresse (relecture 2 du lot 6) ; boîte cherchée avec l’adresse', async () => {
    const res = await creer({ nom: 'Villa Exemple', emailsDestinataires: ['Marie.Exemple+Copro@exemple.test'] })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'invalide', details: 'emailsDestinataires: adresse d’un gestionnaire : attribuez-lui la copropriété' })
    expect(appelsCreation()).toEqual([])
    const lectures = baseQr.etat.lectures.filter((l) => l.table === 'signalements_qr_gestionnaires')
    expect(lectures.map((l) => l.filtres)).toContainEqual(['email=in.(marie.exemple+copro@exemple.test,marie.exemple@exemple.test)'])
  })

  // Corrections, tour 2 : même règle que pour un gestionnaire (un cabinet à deux domaines les livre aux mêmes boîtes).
  it('partie locale d’une fiche sur un AUTRE domaine de son cabinet : 400 comme son adresse ; autre partie locale : acceptée', async () => {
    baseQr.etat.tables.signalements_qr_domaines_autorises.push({ cabinet_id: CAB, domaine: 'exemple-bis.test' })
    for (const email of ['marie.exemple@exemple-bis.test', 'Marie.Exemple+Copro@Exemple-Bis.test']) {
      const res = await creer({ nom: 'Villa Exemple', emailsDestinataires: [email] })
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'invalide', details: 'emailsDestinataires: adresse d’un gestionnaire : attribuez-lui la copropriété' })
    }
    expect(appelsCreation()).toEqual([])
    expect((await creer({ nom: 'Villa Exemple', emailsDestinataires: ['accueil@exemple-bis.test'] })).status).toBe(201)
  })

  it('relecture 11 : plus de 1 000 fiches (plafond PostgREST) : l’adresse d’une fiche reste refusée ; lectures filtrées (adresses proposées, cabinet de leur domaine), page par page', async () => {
    const t = baseQr.etat.tables
    t.signalements_qr_gestionnaires = [
      ...Array.from({ length: 1200 }, (_, i) => ({ id: `a1000000-0000-4000-8000-${String(i).padStart(12, '0')}`, cabinet_id: CAB, nom: `Fiche ${i}`, email: `fiche${i}@exemple.test`, actif: true })),
      ...t.signalements_qr_gestionnaires,
    ]
    baseQr.etat.maxLignes = 1000
    const res = await creer({ nom: 'Villa Exemple', emailsDestinataires: ['marie.exemple@exemple.test'] })
    expect(res.status).toBe(400)
    expect(appelsCreation()).toEqual([])
    const filtres = baseQr.etat.lectures.filter((l) => l.table === 'signalements_qr_gestionnaires').map((l) => l.filtres)
    // Par l'adresse proposée, puis les fiches du SEUL cabinet qui a déclaré son domaine (1 201 lignes : deux pages).
    expect(filtres.filter((f) => f[0]?.startsWith('email='))).toEqual([['email=in.(marie.exemple@exemple.test)']])
    expect(filtres.filter((f) => f[0]?.startsWith('cabinet_id='))).toEqual([[`cabinet_id=in.(${CAB})`], [`cabinet_id=in.(${CAB})`]])
    expect(filtres).toHaveLength(3)
  })

  it('adresse sur un domaine qu’aucun cabinet n’a déclaré : aucune fiche lue par cabinet', async () => {
    expect((await creer({ nom: 'Villa Exemple', emailsDestinataires: ['cs@externe.test'] })).status).toBe(201)
    const parCabinet = baseQr.etat.lectures.filter((l) => l.table === 'signalements_qr_gestionnaires' && l.filtres.some((f) => f.startsWith('cabinet_id=')))
    expect(parCabinet).toEqual([])
  })

  it('adresse hors des domaines du cabinet : 409 hors_domaine sauf confirmerHorsDomaine ; sans cabinet : aucun contrôle', async () => {
    const refus = await creer({ nom: 'Villa Exemple', cabinetId: CAB, emailsDestinataires: ['cs@externe.test'] })
    expect(refus.status).toBe(409)
    expect(await refus.json()).toEqual({ error: 'hors_domaine', champ: 'emailsDestinataires' })
    expect((await creer({ nom: 'Villa Exemple', cabinetId: CAB, emailsDestinataires: ['cs@externe.test'], confirmerHorsDomaine: true })).status).toBe(201)
    expect((await creer({ nom: 'Villa B', emailsDestinataires: ['cs@externe.test'] })).status).toBe(201)
  })

  it.each([
    // Fiches illisibles : l'adresse d'un gestionnaire passerait pour une adresse saisie.
    ['signalements_qr_gestionnaires', { emailsDestinataires: ['marie.exemple@exemple.test'], confirmerHorsDomaine: true }],
    // Domaines illisibles : une adresse extérieure passerait sans confirmation.
    ['signalements_qr_domaines_autorises', { emailsDestinataires: ['autre@externe.test'] }],
  ])(
    'relecture 4 : %s illisible (délai dépassé, pas une table absente) : 500 AVANT toute écriture',
    async (table, corps) => {
      baseQr.etat.erreursPonctuelles[table] = { code: '57014', message: 'canceling statement due to statement timeout' }
      const res = await creer({ nom: 'Villa Exemple', cabinetId: CAB, ...corps })
      expect(res.status).toBe(500)
      expect(await res.json()).toEqual({ error: 'serveur' })
      expect(appelsCreation()).toEqual([])
    },
  )

  it('gestionnaire ou « à tous » sans cabinet : 409 sans_cabinet', async () => {
    expect(await (await creer({ nom: 'Villa Exemple', gestionnaireIds: [G] })).json()).toEqual({ error: 'sans_cabinet' })
    expect(await (await creer({ nom: 'Villa Exemple', attribueeATous: true })).json()).toEqual({ error: 'sans_cabinet' })
  })

  it('clé inconnue (cree_par, jeton) : 400', async () => {
    expect((await creer({ nom: 'Villa Exemple', jeton: JETON })).status).toBe(400)
    expect((await creer({ nom: 'Villa Exemple', cree_par: G })).status).toBe(400)
  })

  it('migration absente (fonction PGRST202, tables 42P01) : insertion d’origine pour le corps actuel ; 503 si le corps demande un cabinet', async () => {
    delete baseQr.etat.fonctions.signalements_qr_creer_coproprietes
    baseQr.etat.tablesAbsentes = ['signalements_qr_gestionnaires', 'signalements_qr_cabinets', 'signalements_qr_domaines_autorises', 'signalements_qr_attributions', 'signalements_qr_journal']
    baseQr.etat.colonnesAbsentes = { signalements_qr_coproprietes: ['cabinet_id', 'code_postal', 'ville', 'immatriculation', 'reference_cabinet', 'batiments', 'attribuee_a_tous', 'cree_par_gestionnaire_id', 'cle_nom'] }
    baseQr.etat.tables.signalements_qr_coproprietes = []
    const res = await creer({ nom: 'Villa Exemple', adresse: '2 rue Exemple', emailsDestinataires: ['cs@externe.test'] })
    expect(res.status).toBe(201)
    expect(baseQr.ecrituresDe('signalements_qr_coproprietes', 'insert')[0].valeurs).toEqual({
      nom: 'Villa Exemple', adresse: '2 rue Exemple', emails_destinataires: ['cs@externe.test'], jeton: expect.stringMatching(/^[0-9a-f]{32}$/), cree_par: ADMIN_QR.id,
    })
    expect((await res.json()).copropriete).toMatchObject({ nom: 'Villa Exemple', cabinet: null, gestionnaires: [] })
    expect((await creer({ nom: 'Villa Exemple', cabinetId: CAB })).status).toBe(503)
  })

  it.each(['42P01', 'PGRST205'] as const)(
    'production avant la migration du 11/11 (tables %s, fonction PGRST202) : corps actuel créé à l’ancienne (201) ; cabinet demandé : 503',
    async (code) => {
      baseQr.etat.tables.signalements_qr_coproprietes = []
      simulerProductionAvant1111Qr(baseQr, code)
      const res = await creer({ nom: 'Villa Exemple', adresse: '2 rue Exemple', emailsDestinataires: ['cs@externe.test'] })
      expect(res.status).toBe(201)
      expect(baseQr.ecrituresDe('signalements_qr_coproprietes', 'insert')).toHaveLength(1)
      expect((await res.json()).copropriete).toMatchObject({ nom: 'Villa Exemple', emailsDestinataires: ['cs@externe.test'], cabinet: null, gestionnaires: [] })
      // Fiches des destinataires lues dans la table absente : la branche « table absente » est bien prise.
      expect(baseQr.etat.tablesAbsentesLues).toContain('signalements_qr_gestionnaires')
      expect(simulQr.logger.error).not.toHaveBeenCalled()

      const avecCabinet = await creer({ nom: 'Villa Exemple Bis', cabinetId: CAB })
      expect(avecCabinet.status).toBe(503)
      expect(await avecCabinet.json()).toEqual({ error: 'base_absente' })
      expect(baseQr.etat.tablesAbsentesLues).toContain('signalements_qr_cabinets')
      expect(baseQr.ecrituresDe('signalements_qr_coproprietes', 'insert')).toHaveLength(1)
    },
  )

  it('le journal serveur ne reçoit ni nom ni adresse', async () => {
    baseQr.etat.fonctions.signalements_qr_creer_coproprietes = () => ({ error: { code: 'XX000', message: 'panne : Villa Exemple cs@externe.test' } })
    expect((await creer({ nom: 'Villa Exemple', emailsDestinataires: ['cs@externe.test'] })).status).toBe(500)
    expect(texteJournalServeurQr()).not.toMatch(/Villa|@externe/)
  })
})

describe('PATCH coproprietes/[id] (P1-R4)', () => {
  it('corps actuels acceptés : { …saisie, actif }, { regenererJeton: true }, { adresse } ; journal des NOMS de champs', async () => {
    const res = await modifier(COPRO, { nom: 'Résidence Exemple', adresse: '3 rue Exemple', emailsDestinataires: ['cs@externe.test'], actif: false })
    expect(res.status).toBe(200)
    const maj = baseQr.ecrituresDe('signalements_qr_coproprietes', 'update')[0]
    expect(maj.valeurs).toEqual({ nom: 'Résidence Exemple', adresse: '3 rue Exemple', emails_destinataires: ['cs@externe.test'], actif: false, cle_nom: 'exemple' })
    const journal = baseQr.table('signalements_qr_journal')
    expect(journal.map((j) => j.action)).toEqual(['copropriete.modifiee', 'copropriete.desactivee'])
    expect(journal[0]).toMatchObject({ copropriete_id: COPRO, cabinet_id: CAB, acteur_id: ADMIN_QR.id, acteur_profil: 'super_admin' })
    expect(journal[0].champs).toEqual(['adresse'])
    expect(JSON.stringify(journal)).not.toContain('3 rue Exemple')
    expect((await res.json()).copropriete).toMatchObject({ id: COPRO, adresse: '3 rue Exemple', actif: false, gestionnaires: [{ id: G, nom: 'Marie Exemple' }] })

    const jeton = await modifier(COPRO, { regenererJeton: true })
    expect(jeton.status).toBe(200)
    expect((await jeton.json()).copropriete.jeton).not.toBe(JETON)
    expect(baseQr.table('signalements_qr_journal').map((j) => j.action)).toContain('copropriete.jeton_remplace')
    expect((await modifier(COPRO, { adresse: '4 rue Exemple' })).status).toBe(200)
  })

  it('cabinetId refusé ici (rattachement par sa route) ; rien à modifier : 400 ; regenererJeton: false : 400', async () => {
    expect((await modifier(COPRO_SANS_CABINET, { cabinetId: CAB })).status).toBe(400)
    expect((await modifier(COPRO, {})).status).toBe(400)
    expect((await modifier(COPRO, { forcerDoublon: true })).status).toBe(400)
    expect((await modifier(COPRO, { regenererJeton: false })).status).toBe(400)
  })

  it('AJOUT de l’adresse d’une fiche dans les destinataires : 400 ; adresse de fiche déjà présente conservée : 200', async () => {
    const ajout = await modifier(COPRO, { emailsDestinataires: ['cs@externe.test', 'marie.exemple@exemple.test'] })
    expect(ajout.status).toBe(400)
    Object.assign(baseQr.table('signalements_qr_coproprietes')[0], { emails_destinataires: ['marie.exemple@exemple.test'] })
    expect((await modifier(COPRO, { emailsDestinataires: ['marie.exemple@exemple.test'], nom: 'Résidence Exemple' })).status).toBe(200)
  })

  it('AJOUT de la partie locale d’une fiche sur un autre domaine de son cabinet : 400 (corrections, tour 2)', async () => {
    baseQr.etat.tables.signalements_qr_domaines_autorises.push({ cabinet_id: CAB, domaine: 'exemple-bis.test' })
    const ajout = await modifier(COPRO, { emailsDestinataires: ['cs@externe.test', 'marie.exemple@exemple-bis.test'], confirmerHorsDomaine: true })
    expect(ajout.status).toBe(400)
    expect(await ajout.json()).toEqual({ error: 'invalide', details: 'emailsDestinataires: adresse d’un gestionnaire : attribuez-lui la copropriété' })
    expect(baseQr.ecrituresDe('signalements_qr_coproprietes', 'update')).toEqual([])
  })

  it('adresse AJOUTÉE hors domaines : 409 hors_domaine sauf confirmation ; adresse hors domaines déjà présente : sans contrôle', async () => {
    expect(await (await modifier(COPRO, { emailsDestinataires: ['cs@externe.test', 'autre@externe.test'] })).json()).toEqual({ error: 'hors_domaine', champ: 'emailsDestinataires' })
    expect((await modifier(COPRO, { emailsDestinataires: ['cs@externe.test', 'autre@externe.test'], confirmerHorsDomaine: true })).status).toBe(200)
    expect((await modifier(COPRO, { emailsDestinataires: ['autre@externe.test'] })).status).toBe(200)
  })

  it.each([
    ['signalements_qr_gestionnaires', { emailsDestinataires: ['cs@externe.test', 'marie.exemple@exemple.test'], confirmerHorsDomaine: true }],
    ['signalements_qr_domaines_autorises', { emailsDestinataires: ['cs@externe.test', 'autre@externe.test'] }],
  ])(
    'relecture 4 : adresse AJOUTÉE, %s illisible (délai dépassé) : 500, rien n’est écrit',
    async (table, corps) => {
      baseQr.etat.erreursPonctuelles[table] = { code: '57014', message: 'canceling statement due to statement timeout' }
      const res = await modifier(COPRO, corps)
      expect(res.status).toBe(500)
      expect(await res.json()).toEqual({ error: 'serveur' })
      expect(baseQr.ecrituresDe('signalements_qr_coproprietes', 'update')).toEqual([])
    },
  )

  it('nom changé vers celui d’une autre copropriété du cabinet (même CP) : 409 doublon', async () => {
    baseQr.table('signalements_qr_coproprietes').push(ligneCopro({ id: 'c0000000-0000-4000-8000-000000000003', nom: 'Les Pins Exemple', jeton: 'e'.repeat(32) }))
    const res = await modifier(COPRO, { nom: 'Résidence Les Pins Exemple' })
    expect(res.status).toBe(409)
    expect((await res.json()).doublon).toMatchObject({ critere: 'nom_code_postal' })
  })

  it('« attribuée à tous » : par la fonction d’attribution (gestionnaires actuels gardés) ; copropriété sans cabinet : 409 sans_cabinet', async () => {
    const res = await modifier(COPRO, { attribueeATous: true })
    expect(res.status).toBe(200)
    expect(baseQr.etat.appelsRpc).toContainEqual({ nom: 'signalements_qr_remplacer_attributions', args: { p_copropriete: COPRO, p_gestionnaires: [G], p_tous: true, p_acteur: ADMIN_QR.id } })
    expect(await (await modifier(COPRO_SANS_CABINET, { attribueeATous: true })).json()).toEqual({ error: 'sans_cabinet' })
  })

  it('colonnes du 11/11 absentes (PGRST204) : modification d’origine rejouée sans elles', async () => {
    baseQr.etat.colonnesAbsentes = { signalements_qr_coproprietes: ['cle_nom', 'code_postal', 'ville', 'immatriculation', 'reference_cabinet', 'batiments', 'attribuee_a_tous', 'cree_par_gestionnaire_id', 'cabinet_id'] }
    baseQr.etat.tablesAbsentes = ['signalements_qr_journal', 'signalements_qr_gestionnaires', 'signalements_qr_cabinets', 'signalements_qr_attributions', 'signalements_qr_domaines_autorises']
    const res = await modifier(COPRO, { nom: 'Résidence Exemple Bis' })
    expect(res.status).toBe(200)
    const majs = baseQr.ecrituresDe('signalements_qr_coproprietes', 'update')
    expect(majs.at(-1)?.valeurs).toEqual({ nom: 'Résidence Exemple Bis' })
  })

  it.each(['42P01', 'PGRST205'] as const)(
    'production avant la migration du 11/11 (tables %s, colonnes PGRST204) : nom modifié à l’ancienne (200) ; code postal : 503',
    async (code) => {
      simulerProductionAvant1111Qr(baseQr, code)
      const res = await modifier(COPRO, { nom: 'Résidence Exemple Bis', adresse: '5 rue Exemple' })
      expect(res.status).toBe(200)
      expect(baseQr.ecrituresDe('signalements_qr_coproprietes', 'update').at(-1)?.valeurs).toEqual({ nom: 'Résidence Exemple Bis', adresse: '5 rue Exemple' })
      expect(baseQr.etat.tablesAbsentesLues).toContain('signalements_qr_journal')
      expect(simulQr.logger.error).not.toHaveBeenCalled()
      const codePostal = await modifier(COPRO, { codePostal: '13002' })
      expect(codePostal.status).toBe(503)
      expect(await codePostal.json()).toEqual({ error: 'base_absente' })
    },
  )

  it('copropriété inconnue ou identifiant mal formé : 404', async () => {
    expect((await modifier('c0000000-0000-4000-8000-00000000dead', { nom: 'X' })).status).toBe(404)
    expect((await modifier('pas-un-uuid', { nom: 'X' })).status).toBe(404)
  })
})

describe('DELETE coproprietes/[id] (P1-R5)', () => {
  it('sans signalement et nom exact : 204, journal « supprimee { nom } » écrit AVANT la suppression', async () => {
    const res = await supprimer(COPRO, { nomConfirmation: 'Résidence Exemple' })
    expect(res.status).toBe(204)
    const ordre = baseQr.etat.ecritures.map((e) => `${e.table}:${e.op}`)
    expect(ordre.indexOf('signalements_qr_journal:insert')).toBeLessThan(ordre.indexOf('signalements_qr_coproprietes:delete'))
    expect(baseQr.table('signalements_qr_journal')[0]).toMatchObject({ action: 'copropriete.supprimee', copropriete_id: COPRO, details: { nom: 'Résidence Exemple' } })
    expect(baseQr.table('signalements_qr_coproprietes').map((c) => c.id)).toEqual([COPRO_SANS_CABINET])
  })

  it('un signalement existe : 409 signalements_presents, rien n’est supprimé et la copropriété reste active', async () => {
    baseQr.table('signalements_qr').push({ id: 's1', copropriete_id: COPRO })
    const res = await supprimer(COPRO, { nomConfirmation: 'Résidence Exemple' })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'signalements_presents' })
    expect(baseQr.ecrituresDe('signalements_qr_coproprietes', 'delete')).toEqual([])
    expect(baseQr.table('signalements_qr_coproprietes')[0].actif).toBe(true)
  })

  it('nom inexact : 400 ; limite : 10 par heure et par compte', async () => {
    expect((await supprimer(COPRO, { nomConfirmation: 'Residence Exemple' })).status).toBe(400)
    simulQr.refuser = [`qr_copropriete_delete_${ADMIN_QR.id}`]
    expect((await supprimer(COPRO, { nomConfirmation: 'Résidence Exemple' })).status).toBe(429)
  })
})

describe('PUT coproprietes/[id]/gestionnaires (P1-R6)', () => {
  const remplacer = (id: string, corps: unknown) => PUT(requeteQr(`/api/aj-signalement/coproprietes/${id}/gestionnaires`, 'PUT', corps), contexteQr(id))

  it('ensemble complet et « à tous » transmis ; réponse avec les noms', async () => {
    const res = await remplacer(COPRO, { gestionnaireIds: [G], attribueeATous: false })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ gestionnaires: [{ id: G, nom: 'Marie Exemple' }], attribueeATous: false, adressesRetirees: 0 })
    expect(baseQr.etat.appelsRpc[0].args).toEqual({ p_copropriete: COPRO, p_gestionnaires: [G], p_tous: false, p_acteur: ADMIN_QR.id })
  })

  it('« à tous » absent du corps : p_tous NULL (inchangé)', async () => {
    await remplacer(COPRO, { gestionnaireIds: [] })
    expect(baseQr.etat.appelsRpc[0].args.p_tous).toBeNull()
  })

  it('copropriété sans cabinet : 409 sans_cabinet ; inconnue : 404', async () => {
    expect(await (await remplacer(COPRO_SANS_CABINET, { gestionnaireIds: [G] })).json()).toEqual({ error: 'sans_cabinet' })
    expect((await remplacer('c0000000-0000-4000-8000-00000000dead', { gestionnaireIds: [] })).status).toBe(404)
  })
})
