// tests/api/aj-signalement-import.test.ts
//
// POST /api/aj-signalement/coproprietes/import (P1-R19, SPEC § 1.9.6) : import des copropriétés d'un cabinet client
// depuis le fichier Excel ou CSV lu dans le navigateur (le fichier n'est jamais envoyé : seulement les lignes
// normalisées). Super admin seul ; cabinet OBLIGATOIRE (isolation entre cabinets).
//   - « verifier » : refait tout au serveur (gestionnaires, destinataires, doublons dans le fichier et avec l'existant
//     du cabinet), n'écrit rien ;
//   - « creer » : refait la vérification, puis UN appel de signalements_qr_creer_coproprietes (tout ou rien) ; existant
//     changé depuis la vérification → 409 a_reverifier avec les diagnostics à jour, rien n'est écrit ; operationId
//     rejoué → le résultat du premier passage ;
//   - le journal serveur ne reçoit que des nombres (lignes, créées, complétées), jamais un nom ni une adresse.
// Fonction SQL et base simulées ; données fictives (@exemple.test, « Résidence Exemple », cabinet-exemple).

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/supabase-server', async () => ({ supabaseAdmin: (await import('../helpers/aj-signalement-base')).baseQr.client }))
vi.mock('@/lib/supabase-server-component', async () => (await import('../helpers/aj-signalement-routes')).mockCookies())
vi.mock('@/lib/auth-helpers', async () => (await import('../helpers/aj-signalement-routes')).mockAuth())
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/aj-signalement-routes')).mockLimites())
vi.mock('@/lib/email', async () => (await import('../helpers/aj-signalement-routes')).mockEmail())
vi.mock('@/lib/logger', async () => (await import('../helpers/aj-signalement-routes')).mockLogger())

const { baseQr } = await import('../helpers/aj-signalement-base')
const { ADMIN_QR, reinitialiserSimulQr, requeteQr, simulQr, texteJournalServeurQr } = await import('../helpers/aj-signalement-routes')
const { POST } = await import('@/app/api/aj-signalement/coproprietes/import/route')
const { reinitialiserReplisQr } = await import('@/lib/aj-signalement/serveur')

const CAB = 'ca000000-0000-4000-8000-000000000001'
const CAB2 = 'ca000000-0000-4000-8000-000000000002'
const E1 = 'c0000000-0000-4000-8000-000000000001'
const E_AUTRE = 'c0000000-0000-4000-8000-000000000002'
const G1 = 'a0000000-0000-4000-8000-000000000001'
const G2 = 'a0000000-0000-4000-8000-000000000002'
const G_AUTRE = 'a0000000-0000-4000-8000-000000000009'
const OPERATION = 'f0000000-0000-4000-8000-000000000001'

const fiche = (id: string, cabinet: string, nom: string, email: string, actif = true) => ({
  id, cabinet_id: cabinet, nom, email, actif, domaine_force: false, adresse_confirmee_le: '2026-11-10T09:00:00+00:00', adresse_contestee_le: null,
  pseudonymise_le: null, desactive_le: actif ? null : '2026-11-10T09:00:00+00:00', created_at: '2026-11-01T09:00:00+00:00',
})

const copro = (sur: Record<string, unknown>) => ({
  id: E1, nom: 'Résidence Le Parc', adresse: '', jeton: '1'.repeat(32), emails_destinataires: [], actif: true, created_at: '2026-11-01T09:00:00+00:00',
  cabinet_id: CAB, code_postal: '13008', ville: 'Marseille', immatriculation: 'AB1234567', reference_cabinet: null, batiments: [],
  attribuee_a_tous: false, cree_par_gestionnaire_id: null, cle_nom: 'parc', operation_id: null, ...sur,
})

let compteur = 0

beforeEach(() => {
  reinitialiserSimulQr()
  reinitialiserReplisQr()
  baseQr.reinitialiser()
  compteur = 0
  const t = baseQr.etat.tables
  t.signalements_qr_cabinets = [
    { id: CAB, nom: 'Cabinet Exemple', identifiant: 'cabinet-exemple', langue: 'fr' },
    { id: CAB2, nom: 'Autre Cabinet Exemple', identifiant: 'autre-exemple', langue: 'fr' },
  ]
  t.signalements_qr_domaines_autorises = [{ cabinet_id: CAB, domaine: 'exemple.test' }, { cabinet_id: CAB2, domaine: 'autre-exemple.test' }]
  t.signalements_qr_gestionnaires = [
    fiche(G1, CAB, 'Marie Exemple', 'marie.exemple@exemple.test'),
    fiche(G2, CAB, 'Paul Exemple', 'paul.exemple@exemple.test'),
    fiche(G_AUTRE, CAB2, 'Zoé Exemple', 'zoe.exemple@autre-exemple.test'),
  ]
  // Une copropriété du cabinet, et une homonyme dans UN AUTRE cabinet (jamais comparée).
  t.signalements_qr_coproprietes = [copro({}), copro({ id: E_AUTRE, cabinet_id: CAB2, nom: 'Villa Exemple', code_postal: '13002', immatriculation: null, jeton: '2'.repeat(32) })]
  t.signalements_qr_operations = []
  t.signalements_qr_journal = []
  baseQr.etat.fonctions.signalements_qr_creer_coproprietes = (a) => {
    const deja = baseQr.table('signalements_qr_operations').find((o) => o.id === a.p_operation)
    if (deja) return { data: { ...(deja.resultat as Record<string, unknown>), rejeu: true } }
    const creees: unknown[] = []
    const completees: unknown[] = []
    for (const l of a.p_lignes as Array<Record<string, unknown>>) {
      if (l.action === 'completer') {
        const cible = baseQr.table('signalements_qr_coproprietes').find((c) => c.id === l.coproprieteId && c.cabinet_id === a.p_cabinet)
        if (!cible) return { error: { code: 'P0001', message: 'a_reverifier' } }
        if (cible.adresse === '') cible.adresse = l.adresse
        completees.push({ numeroLigne: l.numeroLigne, id: cible.id })
        continue
      }
      compteur += 1
      const id = `c0000000-0000-4000-8000-0000000001${String(compteur).padStart(2, '0')}`
      const jeton = String(compteur % 10).repeat(32).replace(/^./, 'a')
      baseQr.table('signalements_qr_coproprietes').push(copro({
        id, nom: l.nom, adresse: l.adresse, code_postal: l.codePostal, ville: l.ville, immatriculation: l.immatriculation || null, jeton,
        cle_nom: l.cleNom, emails_destinataires: l.emails, operation_id: a.p_operation,
      }))
      creees.push({ numeroLigne: l.numeroLigne, id, jeton })
    }
    const resultat = { creees, completees }
    baseQr.table('signalements_qr_operations').push({ id: a.p_operation, resultat })
    return { data: { ...resultat, rejeu: false } }
  }
})

const importer = (corps: unknown) => POST(requeteQr('/api/aj-signalement/coproprietes/import', 'POST', corps))
const ligne = (numeroLigne: number, sur: Record<string, unknown> = {}) => ({ numeroLigne, nom: `Villa Exemple ${numeroLigne}`, ...sur })
const corps = (mode: 'verifier' | 'creer', lignes: unknown[], sur: Record<string, unknown> = {}) => ({ mode, operationId: OPERATION, cabinetId: CAB, lignes, ...sur })
const appelsCreation = () => baseQr.etat.appelsRpc.filter((a) => a.nom === 'signalements_qr_creer_coproprietes')

describe('contrôle et schéma', () => {
  it('sans session : 401 ; compte non super admin : 403', async () => {
    simulQr.user = null
    expect((await importer(corps('verifier', [ligne(2)]))).status).toBe(401)
    simulQr.user = { id: G1, email: 'marie.exemple@exemple.test', app_metadata: { role: 'syndic_gestionnaire' } }
    expect((await importer(corps('verifier', [ligne(2)]))).status).toBe(403)
  })

  it('cabinet obligatoire ; clé inconnue ; plus de 500 lignes ; « compléter » sans copropriété ; n° de ligne en double : 400', async () => {
    const { cabinetId: _c, ...sansCabinet } = corps('verifier', [ligne(2)])
    expect((await importer(sansCabinet)).status).toBe(400)
    expect((await importer(corps('verifier', [ligne(2)], { cree_par: G1 }))).status).toBe(400)
    expect((await importer(corps('verifier', [{ ...ligne(2), jeton: 'a'.repeat(32) }]))).status).toBe(400)
    expect((await importer(corps('verifier', Array.from({ length: 501 }, (_, i) => ligne(i + 2))))).status).toBe(400)
    expect((await importer(corps('verifier', [ligne(2, { actionSiExiste: 'completer' })]))).status).toBe(400)
    expect((await importer(corps('verifier', [ligne(2), ligne(2)]))).status).toBe(400)
    expect(appelsCreation()).toEqual([])
  })

  it('cabinet inconnu : 409 a_reverifier', async () => {
    expect(await (await importer(corps('verifier', [ligne(2)], { cabinetId: 'ca000000-0000-4000-8000-0000000000ff' }))).json()).toEqual({ error: 'a_reverifier' })
  })

  it('limites : IP avant la session, puis par compte (vérifier 30/h, créer 5/h)', async () => {
    await importer(corps('verifier', [ligne(2)]))
    expect(simulQr.limites).toEqual(['qr_import_203.0.113.7', `qr_import_verifier_${ADMIN_QR.id}`])
    simulQr.limites = []
    await importer(corps('creer', [ligne(2)]))
    expect(simulQr.limites).toEqual(['qr_import_203.0.113.7', `qr_import_creer_${ADMIN_QR.id}`])
    simulQr.refuser = [`qr_import_creer_${ADMIN_QR.id}`]
    expect((await importer(corps('creer', [ligne(3)], { operationId: 'f0000000-0000-4000-8000-000000000002' }))).status).toBe(429)
  })

  it('migration absente (fiches 42P01) : 503 base_absente', async () => {
    baseQr.etat.tablesAbsentes = ['signalements_qr_gestionnaires']
    expect(await (await importer(corps('verifier', [ligne(2)]))).json()).toEqual({ error: 'base_absente' })
  })
})

describe('mode « verifier »', () => {
  it('diagnostics refaits au serveur, AUCUNE écriture, réponse privée', async () => {
    const res = await importer(corps('verifier', [
      ligne(2, { gestionnaires: ['marie.exemple@exemple.test'], emailsDestinataires: ['cs@externe.test'] }),
      ligne(3, { nom: 'Le Parc', codePostal: '13008' }),
      ligne(4, { gestionnaires: ['zoe.exemple@autre-exemple.test'] }),
      ligne(5, { gestionnaires: ['nina.exemple@exemple.test'] }),
      // Homonyme d'une copropriété d'un AUTRE cabinet : pas un doublon.
      ligne(6, { nom: 'Villa Exemple', codePostal: '13002' }),
    ]))
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    const { diagnostics, gestionnairesInconnus, horsDomaine } = await res.json()
    expect(diagnostics.map((d: { numeroLigne: number; etat: string; action: string }) => [d.numeroLigne, d.etat, d.action])).toEqual([
      [2, 'avertissement', 'creer'], [3, 'existe_deja', 'ignorer'], [4, 'erreur', 'aucune'], [5, 'erreur', 'aucune'], [6, 'a_creer', 'creer'],
    ])
    expect(diagnostics[0].gestionnaires).toEqual([{ id: G1, nom: 'Marie Exemple' }])
    expect(diagnostics[1].doublon).toMatchObject({ critere: 'nom_code_postal', copropriete: { id: E1 } })
    expect(gestionnairesInconnus).toEqual([{ email: 'nina.exemple@exemple.test', nomPropose: 'Nina Exemple', dansDomaines: true, lignes: [5] }])
    expect(horsDomaine).toBe(true)
    expect(baseQr.etat.appelsRpc).toEqual([])
    expect(baseQr.etat.ecritures).toEqual([])
  })
})

describe('mode « creer »', () => {
  it('vérification refaite puis UN appel de la fonction : p_profil super_admin, p_acteur = la session, cabinet, lignes retenues', async () => {
    const res = await importer(corps('creer', [
      ligne(2, { codePostal: '13002', gestionnaires: ['marie.exemple@exemple.test'] }),
      ligne(3, { nom: 'Le Parc', codePostal: '13008' }),
      ligne(4, { nom: 'Autre Exemple', immatriculation: 'AB 123 45 67', actionSiExiste: 'completer', coproprieteExistanteId: E1, adresse: '1 rue Exemple' }),
    ]))
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    expect(appelsCreation()).toHaveLength(1)
    const { args } = appelsCreation()[0]
    expect(args).toMatchObject({ p_operation: OPERATION, p_acteur: ADMIN_QR.id, p_profil: 'super_admin', p_gestionnaire: null, p_cabinet: CAB })
    expect((args.p_lignes as Array<Record<string, unknown>>).map((l) => [l.numeroLigne, l.action, l.origine, l.gestionnaireIds])).toEqual([
      [2, 'creer', 'import', [G1]], [4, 'completer', 'import', []],
    ])
    expect(await res.json()).toEqual({
      creees: [{ numeroLigne: 2, id: 'c0000000-0000-4000-8000-000000000101', jeton: expect.stringMatching(/^[0-9a-f]{32}$/) }],
      completees: [{ numeroLigne: 4, id: E1 }],
      ignorees: 1,
      rejeu: false,
    })
    expect(baseQr.table('signalements_qr_coproprietes').find((c) => c.id === E1)?.adresse).toBe('1 rue Exemple')
  })

  it('ligne en erreur au serveur (gestionnaire désactivé depuis la vérification) : 409 a_reverifier + diagnostics à jour, rien n’est écrit', async () => {
    baseQr.table('signalements_qr_gestionnaires')[0].actif = false
    const res = await importer(corps('creer', [ligne(2, { gestionnaires: ['marie.exemple@exemple.test'] }), ligne(3)]))
    expect(res.status).toBe(409)
    const corpsReponse = await res.json()
    expect(corpsReponse.error).toBe('a_reverifier')
    expect(corpsReponse.diagnostics.map((d: { etat: string }) => d.etat)).toEqual(['erreur', 'a_creer'])
    expect(appelsCreation()).toEqual([])
  })

  it('doublon apparu entre la vérification et l’appel (course, P0001 doublon ou 23505) : 409 a_reverifier, diagnostics relus', async () => {
    baseQr.etat.fonctions.signalements_qr_creer_coproprietes = () => {
      // Une autre session a créé « Villa Exemple 2 » (13002) entre-temps.
      baseQr.table('signalements_qr_coproprietes').push(copro({ id: 'c0000000-0000-4000-8000-000000000050', nom: 'Villa Exemple 2', code_postal: '13002', immatriculation: null, cle_nom: 'villa exemple 2', jeton: '5'.repeat(32) }))
      return { error: { code: 'P0001', message: 'doublon' } }
    }
    const res = await importer(corps('creer', [ligne(2, { codePostal: '13002' })]))
    expect(res.status).toBe(409)
    const r = await res.json()
    expect(r.error).toBe('a_reverifier')
    expect(r.diagnostics[0]).toMatchObject({ etat: 'existe_deja', doublon: { critere: 'nom_code_postal' } })
    baseQr.etat.fonctions.signalements_qr_creer_coproprietes = () => ({ error: { code: '23505', message: 'duplicate key value violates unique constraint "uq_signalements_qr_copros_immatriculation"' } })
    expect((await (await importer(corps('creer', [ligne(3, { immatriculation: 'CD7654321' })]))).json()).error).toBe('a_reverifier')
  })

  it('operationId rejoué (double clic, coupure) : le résultat du premier passage, sans nouvelle création', async () => {
    const lignes = [ligne(2, { codePostal: '13002' }), ligne(3, { codePostal: '13003' })]
    const premier = await (await importer(corps('creer', lignes))).json()
    expect(premier.creees).toHaveLength(2)
    const rejeu = await importer(corps('creer', lignes))
    expect(rejeu.status).toBe(200)
    expect(await rejeu.json()).toEqual({ ...premier, rejeu: true })
    expect(baseQr.table('signalements_qr_coproprietes').filter((c) => c.operation_id === OPERATION)).toHaveLength(2)
  })

  it('destinataire hors des domaines du cabinet : 409 hors_domaine sans confirmerHorsDomaine, accepté avec', async () => {
    const lignes = [ligne(2, { emailsDestinataires: ['cs@externe.test'] })]
    expect(await (await importer(corps('creer', lignes))).json()).toEqual({ error: 'hors_domaine', champ: 'emailsDestinataires' })
    expect(appelsCreation()).toEqual([])
    expect((await importer(corps('creer', lignes, { confirmerHorsDomaine: true }))).status).toBe(200)
  })

  it('tout est ignoré (existant) : 200 sans appel de la fonction', async () => {
    const res = await importer(corps('creer', [ligne(2, { nom: 'Le Parc', codePostal: '13008' })]))
    expect(await res.json()).toEqual({ creees: [], completees: [], ignorees: 1, rejeu: false })
    expect(appelsCreation()).toEqual([])
  })

  it('le journal serveur ne reçoit que des nombres : ni nom, ni adresse (même en cas de panne)', async () => {
    await importer(corps('creer', [ligne(2, { nom: 'Résidence Exemple Unique', adresse: '7 rue Exemple', emailsDestinataires: ['gardien@exemple.test'] })]))
    expect(simulQr.logger.info).toHaveBeenCalledWith(expect.stringContaining('import'), expect.objectContaining({ lignes: 1, creees: 1, completees: 0, ignorees: 0 }))
    baseQr.etat.fonctions.signalements_qr_creer_coproprietes = () => ({ error: { code: 'XX000', message: 'panne : Résidence Exemple Unique gardien@exemple.test' } })
    expect((await importer(corps('creer', [ligne(3, { nom: 'Résidence Exemple Unique', emailsDestinataires: ['gardien@exemple.test'] })], { operationId: 'f0000000-0000-4000-8000-000000000003' }))).status).toBe(500)
    expect(texteJournalServeurQr()).not.toMatch(/Unique|@exemple|rue Exemple/)
  })
})
