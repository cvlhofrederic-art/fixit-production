// tests/api/aj-signalement-creation-gestionnaire.test.ts
//
// Écritures d'un gestionnaire connecté sur les copropriétés (PR 2, lot 2 ; SPEC § 2.5, RG-20 à RG-22, Q1, Q4) :
//   POST  /coproprietes       création dans SON cabinet (celui de la fiche relue), lot d'une ligne de la fonction unique
//                             (p_profil 'gestionnaire', fiche et cabinet de la session), attribution « creation » d'office,
//                             QR code immédiat ; doublons comparés à TOUT le cabinet, jamais forçables, sans nom ni
//                             identifiant hors de sa portée (journal doublon.refuse), probable à confirmer (journalisé) ;
//                             destinataires limités aux domaines de son cabinet, jamais l'adresse d'une fiche (la sienne
//                             comprise) ; limites 5 / 10 min et 20 / 24 h par compte ; rejeu 200 ;
//   PATCH /coproprietes/[id]  attribution explicite seulement (invisible 404, « à tous » 403 lecture_seule ; perdue après
//                             un retrait, Q1) ; champs obligatoires non vidables ; adresse posée par le super admin
//                             conservable ; adresses masquées (d'une autre fiche) conservées dans la liste écrite ; écriture
//                             filtrée par cabinet ; journal au nom du gestionnaire (noms de champs seulement).
// Règle de sûreté : fonction de création absente (PGRST202), colonne absente à l'écriture (PGRST204) ou à la lecture des
// doublons (42703), table des domaines absente (PGRST205) → 503 base_absente, rien d'écrit, jamais un contrôle sauté.
// Données fictives (tests/helpers/aj-signalement-acces.ts).

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/supabase-server', async () => ({ supabaseAdmin: (await import('../helpers/aj-signalement-base')).baseQr.client }))
vi.mock('@/lib/supabase-server-component', async () => (await import('../helpers/aj-signalement-routes')).mockCookies())
vi.mock('@/lib/auth-helpers', async () => (await import('../helpers/aj-signalement-routes')).mockAuth())
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/aj-signalement-routes')).mockLimites())
vi.mock('@/lib/email', async () => (await import('../helpers/aj-signalement-routes')).mockEmail())
vi.mock('@/lib/logger', async () => (await import('../helpers/aj-signalement-routes')).mockLogger())

const { baseQr } = await import('../helpers/aj-signalement-base')
const { contexteQr, reinitialiserSimulQr, requeteQr, simulQr, texteJournalServeurQr } = await import('../helpers/aj-signalement-routes')
const A = await import('../helpers/aj-signalement-acces')
const RL = await import('@/lib/rate-limit')
const { POST } = await import('@/app/api/aj-signalement/coproprietes/route')
const { PATCH } = await import('@/app/api/aj-signalement/coproprietes/[id]/route')
const { GET: TABLEAU } = await import('@/app/api/aj-signalement/tableau/route')
const { reinitialiserReplisQr } = await import('@/lib/aj-signalement/serveur')

const OP = 'f0000000-0000-4000-8000-000000000001'
const OP_2 = 'f0000000-0000-4000-8000-000000000002'

const HORS_DOMAINE = 'hors des domaines du cabinet'
const ADRESSE_DE_FICHE = 'un gestionnaire reçoit les signalements par son attribution'
const AUCUN_DOMAINE = 'aucun domaine'

beforeEach(() => {
  reinitialiserSimulQr()
  reinitialiserReplisQr()
  baseQr.reinitialiser()
  vi.mocked(RL.checkRateLimit).mockClear()
  A.poserJeuAccesQr()
  A.simulerCreationCoproprietesQr()
  A.connecterQr(A.COMPTE_G1)
})

const CORPS = {
  operationId: OP, nom: 'Résidence Neuve', adresse: '8 avenue Neuve', codePostal: '13002', ville: 'Marseille',
}
const creer = (corps: unknown) => POST(requeteQr('/api/aj-signalement/coproprietes', 'POST', corps))
const modifier = (id: string, corps: unknown) => PATCH(requeteQr(`/api/aj-signalement/coproprietes/${id}`, 'PATCH', corps), contexteQr(id))
const appelsCreation = () => baseQr.etat.appelsRpc.filter((a) => a.nom === 'signalements_qr_creer_coproprietes')
const insertionsCopro = () => baseQr.ecrituresDe('signalements_qr_coproprietes', 'insert')
const misesAJourCopro = () => baseQr.ecrituresDe('signalements_qr_coproprietes', 'update')
const journal = () => baseQr.table('signalements_qr_journal')
const copro = (id: string) => {
  const c = baseQr.table('signalements_qr_coproprietes').find((x) => x.id === id)
  if (!c) throw new Error(`copropriété ${id} absente du jeu de données`)
  return c
}
const appelsLimite = () => vi.mocked(RL.checkRateLimit).mock.calls.map((c) => [...c])
const avertissements = (marque: string) => simulQr.logger.warn.mock.calls.filter((c) => String(c[0]).includes(marque))

describe('POST coproprietes par un gestionnaire (P1-R3, RG-20)', () => {
  it('201 : lot d’une ligne au nom de la session (compte, fiche, cabinet de la fiche), copropriété minimisée avec son QR code', async () => {
    const res = await creer({ ...CORPS, batiments: ['A'], emailsDestinataires: ['Conseil@Exemple.test'] })
    expect(res.status).toBe(201)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    expect(appelsCreation()).toHaveLength(1)
    expect(appelsCreation()[0].args).toEqual({
      p_operation: OP, p_acteur: A.U1, p_profil: 'gestionnaire', p_gestionnaire: A.G1, p_cabinet: A.CAB,
      p_lignes: [{
        numeroLigne: 1, action: 'creer', nom: 'Résidence Neuve', cleNom: 'neuve', adresse: '8 avenue Neuve', codePostal: '13002', ville: 'Marseille',
        immatriculation: '', referenceCabinet: '', batiments: ['A'], emails: ['conseil@exemple.test'], gestionnaireIds: [], forcerDoublon: false,
      }],
    })
    const { copropriete } = await res.json()
    expect(copropriete).toMatchObject({
      id: A.C_CREEE, nom: 'Résidence Neuve', jeton: expect.stringMatching(/^[0-9a-f]{32}$/), actif: true, modifiable: true, creeeParVous: true,
      gestionnaires: [], emailsDestinataires: ['conseil@exemple.test'], adressesMasquees: 0, attribueeATous: false,
      cabinet: { id: A.CAB, nom: 'Cabinet Exemple', identifiant: 'cabinet-exemple' }, nbSignalements: 0,
    })
    expect(JSON.stringify(copropriete)).not.toContain(A.G2)
  })

  it('attribution « creation » d’office : la copropriété entre dans SA portée, jamais dans celle d’un collègue', async () => {
    await creer(CORPS)
    const deG1 = await (await TABLEAU(requeteQr('/api/aj-signalement/tableau'))).json()
    expect(deG1.tableau.coproprietes.map((c: { id: string }) => c.id)).toContain(A.C_CREEE)
    A.connecterQr(A.COMPTE_G2)
    const deG2 = await (await TABLEAU(requeteQr('/api/aj-signalement/tableau'))).json()
    expect(deG2.tableau.coproprietes.map((c: { id: string }) => c.id)).not.toContain(A.C_CREEE)
  })

  it('même operationId rejoué (double clic) : 200, même copropriété, une seule création', async () => {
    const premiere = await (await creer(CORPS)).json()
    const rejeu = await creer(CORPS)
    expect(rejeu.status).toBe(200)
    expect((await rejeu.json()).copropriete.id).toBe(premiere.copropriete.id)
    expect(baseQr.table('signalements_qr_coproprietes').filter((c) => c.nom === 'Résidence Neuve')).toHaveLength(1)
  })

  it('operationId absent : 400 avant tout appel (le double clic doit rester sans effet)', async () => {
    const { operationId: _sans, ...corps } = CORPS
    const res = await creer(corps)
    expect(res.status).toBe(400)
    expect(appelsCreation()).toEqual([])
  })

  it.each([
    ['nom vide', { nom: '  ' }],
    ['adresse vide', { adresse: '' }],
    ['code postal vide', { codePostal: '' }],
    ['code postal mal formé', { codePostal: '1300' }],
    ['ville vide', { ville: '' }],
  ])('%s : 400, rien d’appelé (nom, adresse, code postal et ville servent aux doublons)', async (_cas, sur) => {
    const res = await creer({ ...CORPS, ...sur })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('invalide')
    expect(appelsCreation()).toEqual([])
  })

  it('code postal portugais (0000-000) accepté', async () => {
    expect((await creer({ ...CORPS, codePostal: '1000-001', ville: 'Lisboa' })).status).toBe(201)
  })

  it('fiche désactivée entre-temps : 403 acces_retire, rien créé', async () => {
    A.ficheSimuleeQr(A.G1).actif = false
    const res = await creer(CORPS)
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'acces_retire' })
    expect(appelsCreation()).toEqual([])
  })

  it('base incohérente (attribution non posée) : 409 a_reverifier, signalé, aucune donnée rendue', async () => {
    A.simulerCreationCoproprietesQr({ sansAttribution: true })
    const res = await creer(CORPS)
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'a_reverifier' })
    expect(simulQr.logger.error).toHaveBeenCalled()
  })
})

describe('destinataires ajoutés par un gestionnaire (RG-22, Q4)', () => {
  it.each([
    ['adresse extérieure', 'conseil@externe.test', HORS_DOMAINE],
    ['sous-domaine du cabinet', 'conseil@sous.exemple.test', HORS_DOMAINE],
    ['fiche d’un autre cabinet (hors de ses domaines)', A.EMAIL_G3, HORS_DOMAINE],
    ['sa propre adresse', A.EMAIL_G1, ADRESSE_DE_FICHE],
    ['l’adresse d’un collègue', A.EMAIL_G2, ADRESSE_DE_FICHE],
    ['l’adresse d’un collègue, en majuscules', A.EMAIL_G2.toUpperCase(), ADRESSE_DE_FICHE],
  ])('%s : 400 invalide, rien créé', async (_cas, email, message) => {
    const res = await creer({ ...CORPS, emailsDestinataires: ['conseil@exemple.test', email] })
    expect(res.status).toBe(400)
    const corps = await res.json()
    expect(corps.error).toBe('invalide')
    expect(corps.details).toContain(message)
    expect(appelsCreation()).toEqual([])
    expect(JSON.stringify(corps)).not.toContain('Paul')
  })

  it('aucun domaine déclaré pour son cabinet : toute adresse refusée (400) ; sans adresse, création possible', async () => {
    baseQr.etat.tables.signalements_qr_domaines_autorises = [{ cabinet_id: A.CAB_AUTRE, domaine: 'autre-exemple.test' }]
    const refus = await creer({ ...CORPS, emailsDestinataires: ['conseil@exemple.test'] })
    expect(refus.status).toBe(400)
    expect((await refus.json()).details).toContain(AUCUN_DOMAINE)
    expect(appelsCreation()).toEqual([])
    expect((await creer(CORPS)).status).toBe(201)
  })

  it('les domaines lus sont ceux de SON cabinet (fiche), jamais ceux d’un autre', async () => {
    const res = await creer({ ...CORPS, emailsDestinataires: ['conseil@autre-exemple.test'] })
    expect(res.status).toBe(400)
    expect((await res.json()).details).toContain(HORS_DOMAINE)
  })

  it('lecture des domaines en échec (délai dépassé) : 500 avant toute création, jamais un contrôle sauté', async () => {
    baseQr.etat.erreursPonctuelles.signalements_qr_domaines_autorises = { code: '57014', message: 'canceling statement due to statement timeout' }
    const res = await creer({ ...CORPS, emailsDestinataires: ['conseil@exemple.test'] })
    expect(res.status).toBe(500)
    expect(appelsCreation()).toEqual([])
  })
})

describe('doublons d’une création par un gestionnaire (SPEC § 1.6 et § 2.5) : tout le cabinet, jamais forçables', () => {
  it('certain hors de sa portée (copropriété d’un collègue) : 409 sans nom ni identifiant, journal doublon.refuse, rien créé', async () => {
    const res = await creer({ ...CORPS, nom: 'Résidence Deux', codePostal: '13001' })
    expect(res.status).toBe(409)
    const corps = await res.json()
    expect(corps).toEqual({ error: 'doublon', doublon: { certitude: 'certain', critere: 'nom_code_postal' } })
    expect(JSON.stringify(corps)).not.toContain(A.C2)
    expect(appelsCreation()).toEqual([])
    expect(journal()).toEqual([expect.objectContaining({
      action: 'doublon.refuse', cabinet_id: A.CAB, acteur_id: A.U1, acteur_profil: 'gestionnaire', acteur_gestionnaire_id: A.G1,
      copropriete_id: A.C2, details: { critere: 'nom_code_postal', dansPortee: false, contexte: 'creation' },
    })])
  })

  it('certain dans sa portée : 409 avec la copropriété (« elle est déjà dans vos copropriétés »)', async () => {
    const res = await creer({ ...CORPS, nom: 'Résidence Une', codePostal: '13001' })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({
      error: 'doublon', doublon: { certitude: 'certain', critere: 'nom_code_postal', copropriete: { id: A.C1, nom: 'Résidence Une', ville: 'Marseille' } },
    })
    expect(journal()[0]).toMatchObject({ action: 'doublon.refuse', details: { dansPortee: true } })
  })

  it('« à tous » de son cabinet (visible) : la copropriété est nommée', async () => {
    const corps = await (await creer({ ...CORPS, nom: 'Résidence Test', codePostal: '13001' })).json()
    expect(corps.doublon.copropriete).toEqual({ id: A.C_TOUS, nom: 'Résidence Test', ville: 'Marseille' })
  })

  it('immatriculation d’une copropriété DÉSACTIVÉE du cabinet : 409 certain, même avec confirmation', async () => {
    Object.assign(copro(A.C2), { actif: false, immatriculation: 'AB123' })
    for (const confirmer of [false, true]) {
      const res = await creer({ ...CORPS, immatriculation: 'ab-123', confirmerDoublonProbable: confirmer })
      expect(res.status).toBe(409)
      expect(await res.json()).toEqual({ error: 'doublon', doublon: { certitude: 'certain', critere: 'immatriculation' } })
    }
    expect(appelsCreation()).toEqual([])
  })

  it('probable (même adresse et code postal) : 409 à confirmer, sans nom hors portée, non journalisé ; confirmé : 201, journalisé', async () => {
    const question = await creer({ ...CORPS, nom: 'Les Jardins', adresse: '2 rue Exemple', codePostal: '13001' })
    expect(question.status).toBe(409)
    expect(await question.json()).toEqual({ error: 'doublon', doublon: { certitude: 'probable', critere: 'adresse_code_postal' } })
    expect(journal()).toEqual([])
    const res = await creer({ ...CORPS, nom: 'Les Jardins', adresse: '2 rue Exemple', codePostal: '13001', confirmerDoublonProbable: true })
    expect(res.status).toBe(201)
    expect(journal().filter((l) => String(l.action).startsWith('doublon.'))).toEqual([expect.objectContaining({
      action: 'doublon.force', cabinet_id: A.CAB, acteur_id: A.U1, acteur_profil: 'gestionnaire', acteur_gestionnaire_id: A.G1,
      copropriete_id: A.C_CREEE, details: { critere: 'adresse_code_postal', doublonProbableConfirme: true },
    })])
  })

  it('même nom et code postal qu’une copropriété d’un AUTRE cabinet, ou sans cabinet : aucun doublon (201)', async () => {
    expect((await creer({ ...CORPS, nom: 'Résidence Ailleurs', codePostal: '13001' })).status).toBe(201)
    // Autre adresse : la première création est maintenant dans le cabinet (même adresse et code postal = probable).
    expect((await creer({ ...CORPS, operationId: OP_2, nom: 'Parc Exemple', adresse: '6 rue Exemple', codePostal: '13001' })).status).toBe(201)
  })

  it('base : doublon levé sous le verrou (P0001) → 409 doublon, rien de plus', async () => {
    baseQr.etat.fonctions.signalements_qr_creer_coproprietes = () => ({ error: { code: 'P0001', message: 'doublon' } })
    const res = await creer(CORPS)
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'doublon' })
  })
})

describe('limites d’un gestionnaire (SPEC § 2.5)', () => {
  it('par IP (20 / min), puis par compte : 5 / 10 min et 20 / 24 h', async () => {
    await creer(CORPS)
    expect(appelsLimite()).toEqual([
      ['qr_copropriete_post_203.0.113.7', 20, 60_000],
      [`qr_copropriete_post_${A.U1}`, 5, 600_000],
      [`qr_copropriete_post_jour_${A.U1}`, 20, 86_400_000],
    ])
  })

  it.each([
    ['10 minutes', `qr_copropriete_post_${A.U1}`],
    ['24 heures', `qr_copropriete_post_jour_${A.U1}`],
  ])('limite des %s atteinte : 429, rien d’appelé', async (_cas, cle) => {
    simulQr.refuser = [cle]
    const res = await creer(CORPS)
    expect(res.status).toBe(429)
    expect(appelsCreation()).toEqual([])
  })

  it('le super admin garde sa limite (60 / h)', async () => {
    reinitialiserSimulQr()
    await creer({ nom: 'Villa Exemple' })
    expect(appelsLimite()).toEqual([['qr_copropriete_post_203.0.113.7', 20, 60_000], ['qr_copropriete_post_389c1c99-49f3-41d9-8bb3-e19ecbfb3dd4', 60, 3_600_000]])
  })
})

describe('règle de sûreté : structures de la 20261111 absentes pour un gestionnaire → 503, rien d’écrit', () => {
  it('fonction de création absente (PGRST202) : 503 base_absente, AUCUNE insertion d’origine, un avertissement', async () => {
    delete baseQr.etat.fonctions.signalements_qr_creer_coproprietes
    for (let i = 0; i < 2; i += 1) {
      const res = await creer(CORPS)
      expect(res.status).toBe(503)
      expect(await res.json()).toEqual({ error: 'base_absente' })
    }
    expect(insertionsCopro()).toEqual([])
    expect(avertissements('11/11/2026')).toHaveLength(1)
  })

  it('colonne des doublons absente (42703) : 503 avant la fonction, jamais un contrôle de doublons sauté', async () => {
    baseQr.etat.colonnesAbsentes.signalements_qr_coproprietes = ['operation_id']
    const res = await creer(CORPS)
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'base_absente' })
    expect(appelsCreation()).toEqual([])
    expect(texteJournalServeurQr()).not.toContain('does not exist')
  })

  it('table des domaines absente (PGRST205) : 503 dès qu’une adresse est saisie, rien créé', async () => {
    baseQr.etat.codeTableAbsente = 'PGRST205'
    baseQr.etat.tablesAbsentes = ['signalements_qr_domaines_autorises']
    const res = await creer({ ...CORPS, emailsDestinataires: ['conseil@exemple.test'] })
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'base_absente' })
    expect(appelsCreation()).toEqual([])
    expect(baseQr.etat.tablesAbsentesLues).toContain('signalements_qr_domaines_autorises')
  })
})

describe('PATCH coproprietes/[id] par un gestionnaire (P1-R4, RG-21)', () => {
  it('sa copropriété : 200, écriture filtrée par id ET cabinet, journal à son nom (noms de champs), réponse minimisée', async () => {
    const res = await modifier(A.C1, { nom: 'Résidence Une Bis', ville: 'Aix-en-Provence' })
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    const [ecriture] = misesAJourCopro()
    expect(ecriture.filtres).toEqual([`id=eq.${A.C1}`, `cabinet_id=eq.${A.CAB}`])
    expect(ecriture.valeurs).toEqual({ nom: 'Résidence Une Bis', cle_nom: 'une bis', ville: 'Aix-en-Provence' })
    expect(journal()).toEqual([expect.objectContaining({
      action: 'copropriete.modifiee', cabinet_id: A.CAB, acteur_id: A.U1, acteur_profil: 'gestionnaire', acteur_gestionnaire_id: A.G1,
      copropriete_id: A.C1, champs: ['nom', 'ville'],
    })])
    expect(JSON.stringify(journal())).not.toContain('Aix')
    const { copropriete } = await res.json()
    expect(copropriete).toMatchObject({ id: A.C1, nom: 'Résidence Une Bis', ville: 'Aix-en-Provence', modifiable: true, gestionnaires: [] })
  })

  it.each([
    ['copropriété d’un collègue', A.C2],
    ['copropriété d’un autre cabinet', A.C3],
    ['« à tous » d’un autre cabinet', A.C_TOUS_AUTRE],
    ['copropriété sans cabinet', A.C_SANS],
    ['copropriété inconnue', 'c0000000-0000-4000-8000-0000000000ff'],
  ])('%s : 404, ni lecture de la fiche, ni écriture, ni journal', async (_cas, id) => {
    const res = await modifier(id, { nom: 'Prise de contrôle' })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'introuvable' })
    expect(baseQr.etat.lectures.filter((l) => l.table === 'signalements_qr_coproprietes' && l.filtres.includes(`id=eq.${id}`))).toEqual([])
    expect(baseQr.etat.ecritures).toEqual([])
  })

  it('« à tous » de son cabinet (copropriété de test, Q2) : 403 lecture_seule, rien écrit', async () => {
    const res = await modifier(A.C_TOUS, { nom: 'Résidence Test Bis' })
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'lecture_seule' })
    expect(baseQr.etat.ecritures).toEqual([])
  })

  it('copropriété désactivée par le cabinet : visible en lecture seulement (403 lecture_seule), rien écrit', async () => {
    copro(A.C1).actif = false
    const res = await modifier(A.C1, { ville: 'Aubagne' })
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'lecture_seule' })
    expect(baseQr.etat.ecritures).toEqual([])
  })

  it('« à tous » ET attribuée nommément : modifiable', async () => {
    baseQr.table('signalements_qr_attributions').push({ copropriete_id: A.C_TOUS, gestionnaire_id: A.G1, origine: 'super_admin' })
    expect((await modifier(A.C_TOUS, { ville: 'Aubagne' })).status).toBe(200)
  })

  it('copropriété créée par lui, attribution retirée par le super admin : il perd la main (Q1), 404', async () => {
    A.connecterQr(A.COMPTE_G2)
    expect((await modifier(A.C2, { ville: 'Aubagne' })).status).toBe(200)
    baseQr.etat.tables.signalements_qr_attributions = baseQr.table('signalements_qr_attributions').filter((a) => a.copropriete_id !== A.C2)
    expect((await modifier(A.C2, { ville: 'Cassis' })).status).toBe(404)
    expect(copro(A.C2).ville).toBe('Aubagne')
  })

  it.each([
    ['nom', { nom: '' }],
    ['adresse', { adresse: '   ' }],
    ['code postal', { codePostal: '' }],
    ['ville', { ville: '' }],
  ])('%s obligatoire : jamais vidé (400)', async (_cas, corps) => {
    expect((await modifier(A.C1, corps)).status).toBe(400)
    expect(baseQr.etat.ecritures).toEqual([])
  })

  it('immatriculation et référence (facultatives) : vidables', async () => {
    Object.assign(copro(A.C1), { immatriculation: 'AB123', reference_cabinet: 'R-1' })
    expect((await modifier(A.C1, { immatriculation: '', referenceCabinet: '' })).status).toBe(200)
    expect(misesAJourCopro()[0].valeurs).toEqual({ immatriculation: null, reference_cabinet: null })
  })

  it('rien à modifier, ou seulement la confirmation : 400', async () => {
    expect((await modifier(A.C1, {})).status).toBe(400)
    expect((await modifier(A.C1, { confirmerDoublonProbable: true })).status).toBe(400)
  })

  it('limite par compte : 30 / 10 min (super admin : 30 / min, inchangé)', async () => {
    await modifier(A.C1, { ville: 'Aubagne' })
    expect(appelsLimite()).toEqual([['qr_copropriete_patch_203.0.113.7', 30, 60_000], [`qr_copropriete_patch_${A.U1}`, 30, 600_000]])
  })

  it('doublon créé par un renommage : 409, hors portée sans nom ni identifiant, journal doublon.refuse, rien écrit', async () => {
    const res = await modifier(A.C1, { nom: 'Résidence Deux' })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'doublon', doublon: { certitude: 'certain', critere: 'nom_code_postal' } })
    expect(misesAJourCopro()).toEqual([])
    expect(journal()).toEqual([expect.objectContaining({
      action: 'doublon.refuse', acteur_profil: 'gestionnaire', acteur_gestionnaire_id: A.G1, copropriete_id: A.C2,
      details: { critere: 'nom_code_postal', dansPortee: false, contexte: 'modification', coproprieteModifiee: A.C1 },
    })])
  })

  it('doublon avec une copropriété de sa portée (« à tous ») : nommée', async () => {
    const corps = await (await modifier(A.C1, { nom: 'Résidence Test' })).json()
    expect(corps.doublon).toEqual({ certitude: 'certain', critere: 'nom_code_postal', copropriete: { id: A.C_TOUS, nom: 'Résidence Test', ville: 'Marseille' } })
  })
})

describe('destinataires modifiés par un gestionnaire (RG-06 bis, RG-22)', () => {
  it('adresse extérieure posée par le super admin : conservable sans contrôle, puis retirable', async () => {
    expect((await modifier(A.C1, { emailsDestinataires: ['cs-une@externe.test'] })).status).toBe(200)
    expect(misesAJourCopro()[0].valeurs).toEqual({ emails_destinataires: ['cs-une@externe.test'] })
    expect(journal()).toEqual([])
    expect((await modifier(A.C1, { emailsDestinataires: [] })).status).toBe(200)
    expect(misesAJourCopro()[1].valeurs).toEqual({ emails_destinataires: [] })
    expect(journal()).toEqual([expect.objectContaining({ action: 'copropriete.modifiee', champs: ['emailsDestinataires'] })])
  })

  it('adresse AJOUTÉE : domaines de son cabinet seulement', async () => {
    const refus = await modifier(A.C1, { emailsDestinataires: ['cs-une@externe.test', 'nouveau@externe.test'] })
    expect(refus.status).toBe(400)
    expect((await refus.json()).details).toContain(HORS_DOMAINE)
    expect(misesAJourCopro()).toEqual([])
    expect((await modifier(A.C1, { emailsDestinataires: ['cs-une@externe.test', 'Nouveau@Exemple.test'] })).status).toBe(200)
    expect(misesAJourCopro()[0].valeurs).toEqual({ emails_destinataires: ['cs-une@externe.test', 'nouveau@exemple.test'] })
  })

  it.each([
    ['sa propre adresse', A.EMAIL_G1],
    ['l’adresse d’un collègue', A.EMAIL_G2],
  ])('%s ajoutée : 400, même message, rien écrit', async (_cas, email) => {
    const res = await modifier(A.C1, { emailsDestinataires: ['cs-une@externe.test', email] })
    expect(res.status).toBe(400)
    expect((await res.json()).details).toContain(ADRESSE_DE_FICHE)
    expect(misesAJourCopro()).toEqual([])
  })

  it('aucun domaine pour son cabinet : rien ne peut être ajouté, mais tout peut être gardé ou retiré', async () => {
    baseQr.etat.tables.signalements_qr_domaines_autorises = []
    const refus = await modifier(A.C1, { emailsDestinataires: ['cs-une@externe.test', 'nouveau@exemple.test'] })
    expect(refus.status).toBe(400)
    expect((await refus.json()).details).toContain(AUCUN_DOMAINE)
    expect((await modifier(A.C1, { emailsDestinataires: ['cs-une@externe.test'] })).status).toBe(200)
  })

  it('adresse d’un collègue restée dans les saisies : jamais montrée, CONSERVÉE dans la liste écrite (il ne peut pas la renvoyer)', async () => {
    copro(A.C1).emails_destinataires = ['cs-une@externe.test', A.EMAIL_G2]
    const vue = await (await TABLEAU(requeteQr('/api/aj-signalement/tableau'))).json()
    expect(vue.tableau.coproprietes.find((c: { id: string }) => c.id === A.C1)).toMatchObject({ emailsDestinataires: ['cs-une@externe.test'], adressesMasquees: 1 })

    const res = await modifier(A.C1, { emailsDestinataires: ['autre@exemple.test'] })
    expect(res.status).toBe(200)
    expect(misesAJourCopro()[0].valeurs).toEqual({ emails_destinataires: [A.EMAIL_G2, 'autre@exemple.test'] })
    const corps = await res.json()
    expect(corps.copropriete).toMatchObject({ emailsDestinataires: ['autre@exemple.test'], adressesMasquees: 1 })
    expect(JSON.stringify(corps)).not.toContain(A.EMAIL_G2)
  })

  it('liste inchangée vue par lui (adresse masquée comprise) : aucune modification journalisée', async () => {
    copro(A.C1).emails_destinataires = [A.EMAIL_G2, 'cs-une@externe.test']
    expect((await modifier(A.C1, { emailsDestinataires: ['cs-une@externe.test'] })).status).toBe(200)
    expect(misesAJourCopro()[0].valeurs).toEqual({ emails_destinataires: [A.EMAIL_G2, 'cs-une@externe.test'] })
    expect(journal()).toEqual([])
  })

  it('sa propre adresse déjà présente (données antérieures) : visible, gardée ou retirée', async () => {
    A.connecterQr(A.COMPTE_G2)
    expect((await modifier(A.C2, { emailsDestinataires: [A.EMAIL_G2] })).status).toBe(200)
    expect((await modifier(A.C2, { emailsDestinataires: [] })).status).toBe(200)
    expect(misesAJourCopro()[1].valeurs).toEqual({ emails_destinataires: [] })
  })

  it('sans emailsDestinataires : saisies intactes', async () => {
    copro(A.C1).emails_destinataires = ['cs-une@externe.test', A.EMAIL_G2]
    await modifier(A.C1, { ville: 'Aubagne' })
    expect(misesAJourCopro()[0].valeurs).toEqual({ ville: 'Aubagne' })
    expect(copro(A.C1).emails_destinataires).toEqual(['cs-une@externe.test', A.EMAIL_G2])
  })

  it('lecture des fiches en échec (délai dépassé) : 500 avant toute écriture', async () => {
    // La première lecture de la table est celle du contrôle d'accès (fiche du compte) : l'échec vise la suivante.
    const from = baseQr.client.from
    let lectures = 0
    const espion = vi.spyOn(baseQr.client, 'from').mockImplementation((table: string) => {
      if (table === 'signalements_qr_gestionnaires') {
        lectures += 1
        if (lectures === 2) baseQr.etat.erreursPonctuelles.signalements_qr_gestionnaires = { code: '57014', message: 'canceling statement due to statement timeout' }
      }
      return from(table)
    })
    try {
      const res = await modifier(A.C1, { emailsDestinataires: ['cs-une@externe.test', 'nouveau@exemple.test'] })
      expect(res.status).toBe(500)
      expect(misesAJourCopro()).toEqual([])
      expect(lectures).toBe(2)
    } finally {
      espion.mockRestore()
    }
  })
})

describe('règle de sûreté (PATCH) : colonne absente à l’écriture → 503, jamais une écriture réduite', () => {
  it('PGRST204 à la mise à jour : 503 base_absente, une seule tentative par appel (jamais rejouée réduite), un avertissement', async () => {
    const from = baseQr.client.from
    let tentatives = 0
    const espion = vi.spyOn(baseQr.client, 'from').mockImplementation((table: string) => {
      const q = from(table)
      if (table === 'signalements_qr_coproprietes') {
        const update = q.update as (v: Record<string, unknown>) => unknown
        q.update = (v: Record<string, unknown>) => {
          tentatives += 1
          baseQr.etat.erreursPonctuelles.signalements_qr_coproprietes = { code: 'PGRST204', message: 'Could not find the \'ville\' column of \'signalements_qr_coproprietes\' in the schema cache' }
          return update(v)
        }
      }
      return q
    })
    try {
      for (let i = 0; i < 2; i += 1) {
        const res = await modifier(A.C1, { ville: 'Aubagne' })
        expect(res.status).toBe(503)
        expect(await res.json()).toEqual({ error: 'base_absente' })
      }
      expect(tentatives).toBe(2)
      expect(copro(A.C1).ville).toBe('Marseille')
      expect(journal()).toEqual([])
      expect(avertissements('11/11/2026')).toHaveLength(1)
    } finally {
      espion.mockRestore()
    }
  })

  it('colonne des doublons absente (42703) lors d’un renommage : 503, rien écrit', async () => {
    baseQr.etat.colonnesAbsentes.signalements_qr_coproprietes = ['operation_id']
    const res = await modifier(A.C1, { nom: 'Résidence Une Bis' })
    expect(res.status).toBe(503)
    expect(misesAJourCopro()).toEqual([])
  })
})
