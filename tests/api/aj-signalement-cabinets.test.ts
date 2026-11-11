// tests/api/aj-signalement-cabinets.test.ts
//
// Cabinets clients d'AJ Signalement (demandes de Hugo du 10/11/2026 : chaque client a son nom, son chemin
// vitfix.io/<identifiant>/…, sa langue et ses domaines e-mail, saisis par le super admin dans l'espace) :
//   GET  /api/aj-signalement/cabinets                        — liste, domaines, compteurs, identifiant figé ;
//   POST /api/aj-signalement/cabinets                        — création (identifiant réservé → 400, pris → 409,
//                                                              domaine d'un autre cabinet → 409, messagerie publique → 400) ;
//   PATCH /api/aj-signalement/cabinets/[id]                  — modification (identifiant figé → 409) ;
//   POST /api/aj-signalement/cabinets/[id]/rattachement      — copropriétés sans cabinet seulement (sinon 409).
// Super admin seul (rôle ET liste d'e-mails) ; p_acteur = compte de la session, jamais le corps ; journal par la
// fonction SQL (simulée ici) ; aucun domaine ni identifiant réel : « cabinet-exemple », « exemple.test ».

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/supabase-server', async () => ({ supabaseAdmin: (await import('../helpers/aj-signalement-base')).baseQr.client }))
vi.mock('@/lib/supabase-server-component', async () => (await import('../helpers/aj-signalement-routes')).mockCookies())
vi.mock('@/lib/auth-helpers', async () => (await import('../helpers/aj-signalement-routes')).mockAuth())
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/aj-signalement-routes')).mockLimites())
vi.mock('@/lib/email', async () => (await import('../helpers/aj-signalement-routes')).mockEmail())
vi.mock('@/lib/logger', async () => (await import('../helpers/aj-signalement-routes')).mockLogger())

const { baseQr } = await import('../helpers/aj-signalement-base')
const { ADMIN_QR, contexteQr, reinitialiserSimulQr, requeteQr, simulQr } = await import('../helpers/aj-signalement-routes')
const { GET, POST } = await import('@/app/api/aj-signalement/cabinets/route')
const { PATCH } = await import('@/app/api/aj-signalement/cabinets/[id]/route')
const { POST: RATTACHER } = await import('@/app/api/aj-signalement/cabinets/[id]/rattachement/route')

const CAB = 'ca000000-0000-4000-8000-000000000001'
const CAB_AUTRE = 'ca000000-0000-4000-8000-000000000002'
const COPRO_LIBRE = 'c0000000-0000-4000-8000-000000000001'
const COPRO_RATTACHEE = 'c0000000-0000-4000-8000-000000000002'
const ERREUR_METIER = (message: string) => ({ error: { code: 'P0001', message } })

beforeEach(() => {
  reinitialiserSimulQr()
  baseQr.reinitialiser()
  baseQr.etat.tables.signalements_qr_cabinets = [
    { id: CAB, nom: 'Cabinet Exemple', identifiant: 'cabinet-exemple', langue: 'fr', created_at: '2026-11-10T09:00:00+00:00' },
    { id: CAB_AUTRE, nom: 'Autre Cabinet', identifiant: 'autre-cabinet', langue: 'pt', created_at: '2026-11-10T09:30:00+00:00' },
  ]
  baseQr.etat.tables.signalements_qr_domaines_autorises = [
    { cabinet_id: CAB, domaine: 'exemple.test' },
    { cabinet_id: CAB_AUTRE, domaine: 'autre-exemple.test' },
  ]
  baseQr.etat.tables.signalements_qr_coproprietes = [
    { id: COPRO_LIBRE, nom: 'Résidence Exemple', cabinet_id: null },
    { id: COPRO_RATTACHEE, nom: 'Résidence Rattachée', cabinet_id: CAB_AUTRE },
  ]
  baseQr.etat.tables.signalements_qr_gestionnaires = [
    { id: 'a0000000-0000-4000-8000-000000000001', cabinet_id: CAB, nom: 'Marie Exemple', email: 'marie.exemple@exemple.test', actif: true },
  ]
  // Fonction SQL d'enregistrement, réduite à ses règles visibles depuis la route.
  baseQr.etat.fonctions.signalements_qr_enregistrer_cabinet = (a) => {
    const cabinets = baseQr.table('signalements_qr_cabinets')
    const domaines = baseQr.table('signalements_qr_domaines_autorises')
    if (a.p_identifiant && cabinets.some((c) => c.identifiant === a.p_identifiant && c.id !== a.p_id)) return ERREUR_METIER('identifiant_pris')
    if (Array.isArray(a.p_domaines) && domaines.some((d) => (a.p_domaines as string[]).includes(String(d.domaine)) && d.cabinet_id !== a.p_id)) return ERREUR_METIER('domaine_pris')
    if (a.p_id === null) {
      const id = 'ca000000-0000-4000-8000-000000000099'
      cabinets.push({ id, nom: a.p_nom, identifiant: a.p_identifiant, langue: a.p_langue ?? 'fr', created_at: '2026-11-11T10:00:00+00:00' })
      for (const d of (a.p_domaines as string[]) ?? []) domaines.push({ cabinet_id: id, domaine: d })
      return { data: { id, cree: true, champs: [] } }
    }
    const cabinet = cabinets.find((c) => c.id === a.p_id)
    if (!cabinet) return ERREUR_METIER('a_reverifier')
    const utilise = baseQr.table('signalements_qr_coproprietes').some((c) => c.cabinet_id === a.p_id)
      || baseQr.table('signalements_qr_gestionnaires').some((g) => g.cabinet_id === a.p_id)
    if (a.p_identifiant && a.p_identifiant !== cabinet.identifiant && utilise) return ERREUR_METIER('identifiant_fige')
    if (a.p_nom) cabinet.nom = a.p_nom
    if (a.p_identifiant) cabinet.identifiant = a.p_identifiant
    if (a.p_langue) cabinet.langue = a.p_langue
    if (Array.isArray(a.p_domaines)) {
      baseQr.etat.tables.signalements_qr_domaines_autorises = domaines.filter((d) => d.cabinet_id !== a.p_id)
      for (const d of a.p_domaines as string[]) baseQr.table('signalements_qr_domaines_autorises').push({ cabinet_id: a.p_id, domaine: d })
    }
    return { data: { id: a.p_id, cree: false, champs: ['nom'] } }
  }
  baseQr.etat.fonctions.signalements_qr_rattacher_coproprietes = (a) => {
    const copros = baseQr.table('signalements_qr_coproprietes').filter((c) => (a.p_coproprietes as string[]).includes(String(c.id)))
    if (copros.length !== (a.p_coproprietes as string[]).length || copros.some((c) => c.cabinet_id !== null)) return ERREUR_METIER('a_reverifier')
    for (const c of copros) c.cabinet_id = a.p_cabinet
    return { data: { rattachees: copros.length } }
  }
})

const creer = (corps: unknown) => POST(requeteQr('/api/aj-signalement/cabinets', 'POST', corps))
const modifier = (id: string, corps: unknown) => PATCH(requeteQr(`/api/aj-signalement/cabinets/${id}`, 'PATCH', corps), contexteQr(id))
const rattacher = (id: string, corps: unknown) => RATTACHER(requeteQr(`/api/aj-signalement/cabinets/${id}/rattachement`, 'POST', corps), contexteQr(id))

describe('droits', () => {
  it('401 sans session ; 403 pour un compte super_admin hors de la liste d’e-mails ; aucune fonction appelée', async () => {
    simulQr.user = null
    expect((await GET(requeteQr('/api/aj-signalement/cabinets'))).status).toBe(401)
    simulQr.user = { ...ADMIN_QR, email: 'autre@exemple.test' }
    expect((await creer({ nom: 'X', identifiant: 'cabinet-x', domaines: [] })).status).toBe(403)
    expect((await modifier(CAB, { nom: 'X' })).status).toBe(403)
    expect((await rattacher(CAB, { coproprieteIds: [COPRO_LIBRE] })).status).toBe(403)
    expect(baseQr.etat.appelsRpc).toEqual([])
  })

  it('« vue en tant que » (rôle d’emprunt, _original_role) : 403', async () => {
    simulQr.user = { ...ADMIN_QR, app_metadata: { role: 'coproprio', _original_role: 'super_admin' } }
    expect((await GET(requeteQr('/api/aj-signalement/cabinets'))).status).toBe(403)
  })
})

describe('GET cabinets', () => {
  it('liste triée par nom, domaines, compteurs ; identifiant figé dès une copropriété ou un gestionnaire ; jamais en cache', async () => {
    const res = await GET(requeteQr('/api/aj-signalement/cabinets'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    const { cabinets } = await res.json()
    expect(cabinets).toEqual([
      { id: CAB_AUTRE, nom: 'Autre Cabinet', identifiant: 'autre-cabinet', langue: 'pt', domaines: ['autre-exemple.test'], identifiantFige: true, nbCoproprietes: 1, nbGestionnaires: 0 },
      { id: CAB, nom: 'Cabinet Exemple', identifiant: 'cabinet-exemple', langue: 'fr', domaines: ['exemple.test'], identifiantFige: true, nbCoproprietes: 0, nbGestionnaires: 1 },
    ])
  })

  it('migration absente (42P01) : 503 base_absente', async () => {
    baseQr.etat.tablesAbsentes = ['signalements_qr_cabinets']
    const res = await GET(requeteQr('/api/aj-signalement/cabinets'))
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'base_absente' })
  })
})

describe('POST cabinets', () => {
  it('crée le cabinet : identifiant rogné et mis en minuscules, domaines en minuscules, p_acteur = la session', async () => {
    const res = await creer({ nom: ' Cabinet Neuf ', identifiant: ' Cabinet-Neuf ', langue: 'pt', domaines: ['Neuf-Exemple.TEST'] })
    expect(res.status).toBe(201)
    const appel = baseQr.etat.appelsRpc.find((a) => a.nom === 'signalements_qr_enregistrer_cabinet')
    expect(appel?.args).toEqual({
      p_id: null, p_nom: 'Cabinet Neuf', p_identifiant: 'cabinet-neuf', p_langue: 'pt', p_domaines: ['neuf-exemple.test'], p_acteur: ADMIN_QR.id,
    })
    expect((await res.json()).cabinet).toEqual({
      id: 'ca000000-0000-4000-8000-000000000099', nom: 'Cabinet Neuf', identifiant: 'cabinet-neuf', langue: 'pt',
      domaines: ['neuf-exemple.test'], identifiantFige: false, nbCoproprietes: 0, nbGestionnaires: 0,
    })
  })

  it('le corps ne choisit jamais l’auteur : clé inconnue (acteur, cree_par…) → 400', async () => {
    const res = await creer({ nom: 'Cabinet Neuf', identifiant: 'cabinet-neuf', domaines: [], acteur: 'a0000000-0000-4000-8000-00000000dead' })
    expect(res.status).toBe(400)
    expect(baseQr.etat.appelsRpc).toEqual([])
  })

  it.each([['signalement'], ['api'], ['fr'], ['aj-signalement-bis'], ['confirmation-x'], ['ab'], ['a--b'], ['-ab'], ['Cabinet_Exemple']])(
    'identifiant « %s » : 400 invalide, aucune écriture',
    async (identifiant) => {
      const res = await creer({ nom: 'Cabinet', identifiant, domaines: [] })
      expect(res.status).toBe(400)
      expect((await res.json()).error).toBe('invalide')
      expect(baseQr.etat.appelsRpc).toEqual([])
    },
  )

  it('identifiant réservé : le détail le dit', async () => {
    const res = await creer({ nom: 'Cabinet', identifiant: 'signalement', domaines: [] })
    expect((await res.json()).details).toContain('Identifiant réservé')
  })

  it.each([['gmail.com'], ['outlook.fr'], ['sapo.pt']])('messagerie publique « %s » comme domaine : 400', async (domaine) => {
    const res = await creer({ nom: 'Cabinet', identifiant: 'cabinet-neuf', domaines: [domaine] })
    expect(res.status).toBe(400)
    expect(baseQr.etat.appelsRpc).toEqual([])
  })

  it('identifiant déjà pris : 409 identifiant_pris ; domaine d’un autre cabinet : 409 domaine_pris (jamais le message SQL)', async () => {
    const pris = await creer({ nom: 'Cabinet', identifiant: 'cabinet-exemple', domaines: [] })
    expect(pris.status).toBe(409)
    expect(await pris.json()).toEqual({ error: 'identifiant_pris' })
    const domaine = await creer({ nom: 'Cabinet', identifiant: 'cabinet-neuf', domaines: ['autre-exemple.test'] })
    expect(domaine.status).toBe(409)
    expect(await domaine.json()).toEqual({ error: 'domaine_pris' })
  })

  it('course : 23505 sur la contrainte de l’identifiant → 409 identifiant_pris', async () => {
    baseQr.etat.fonctions.signalements_qr_enregistrer_cabinet = () => ({
      error: { code: '23505', message: 'duplicate key value violates unique constraint "signalements_qr_cabinets_identifiant_unique"' },
    })
    const res = await creer({ nom: 'Cabinet', identifiant: 'cabinet-neuf', domaines: [] })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'identifiant_pris' })
  })

  it('fonction absente (PGRST202, migration non appliquée) : 503 base_absente', async () => {
    delete baseQr.etat.fonctions.signalements_qr_enregistrer_cabinet
    const res = await creer({ nom: 'Cabinet', identifiant: 'cabinet-neuf', domaines: [] })
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'base_absente' })
  })

  it('limite : 10 créations par heure et par compte (clé par user.id), après la limite par IP', async () => {
    await creer({ nom: 'Cabinet', identifiant: 'cabinet-neuf', domaines: [] })
    expect(simulQr.limites).toContain(`qr_cabinet_post_${ADMIN_QR.id}`)
    simulQr.refuser = [`qr_cabinet_post_${ADMIN_QR.id}`]
    expect((await creer({ nom: 'Cabinet', identifiant: 'cabinet-autre', domaines: [] })).status).toBe(429)
  })
})

describe('PATCH cabinets/[id]', () => {
  it('nom et langue modifiés, paramètres absents passés à NULL (inchangés)', async () => {
    const res = await modifier(CAB, { nom: 'Cabinet Exemple Renommé', langue: 'pt' })
    expect(res.status).toBe(200)
    expect(baseQr.etat.appelsRpc[0].args).toEqual({
      p_id: CAB, p_nom: 'Cabinet Exemple Renommé', p_identifiant: null, p_langue: 'pt', p_domaines: null, p_acteur: ADMIN_QR.id,
    })
    expect((await res.json()).cabinet).toMatchObject({ id: CAB, nom: 'Cabinet Exemple Renommé', langue: 'pt' })
  })

  it('identifiant d’un cabinet déjà utilisé : 409 identifiant_fige', async () => {
    const res = await modifier(CAB, { identifiant: 'cabinet-renomme' })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'identifiant_fige' })
  })

  it('nouveaux domaines : les fiches hors de ces domaines ne sont pas touchées mais signalées', async () => {
    const res = await modifier(CAB, { domaines: ['nouveau-exemple.test'] })
    expect(res.status).toBe(200)
    const corps = await res.json()
    expect(corps.fichesHorsDomaines).toEqual([{ id: 'a0000000-0000-4000-8000-000000000001', nom: 'Marie Exemple' }])
    expect(baseQr.ecrituresDe('signalements_qr_gestionnaires')).toEqual([])
  })

  it('rien à modifier : 400 ; cabinet inconnu : 404 ; identifiant de ligne mal formé : 404', async () => {
    expect((await modifier(CAB, {})).status).toBe(400)
    expect((await modifier('ca000000-0000-4000-8000-00000000dead', { nom: 'X' })).status).toBe(404)
    expect((await modifier('pas-un-uuid', { nom: 'X' })).status).toBe(404)
  })
})

describe('POST cabinets/[id]/rattachement', () => {
  it('copropriété sans cabinet : rattachée, réponse { rattachees }', async () => {
    const res = await rattacher(CAB, { coproprieteIds: [COPRO_LIBRE] })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ rattachees: 1 })
    expect(baseQr.etat.appelsRpc[0]).toEqual({
      nom: 'signalements_qr_rattacher_coproprietes',
      // Clé du nom calculée par la route (cle_nom est NULL pour les anciennes) ; aucun doublon forcé.
      args: { p_cabinet: CAB, p_coproprietes: [COPRO_LIBRE], p_acteur: ADMIN_QR.id, p_cles_nom: { [COPRO_LIBRE]: 'exemple' }, p_forcer_doublon: false },
    })
  })

  it('copropriété déjà rattachée (rattachement définitif) : 409 a_reverifier', async () => {
    const res = await rattacher(CAB, { coproprieteIds: [COPRO_RATTACHEE] })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'a_reverifier' })
  })

  describe('relecture 9 : doublons nom + code postal avec le cabinet (RG-08, SPEC § 1.6)', () => {
    const DU_CABINET = 'c0000000-0000-4000-8000-000000000003'
    const AUTRE_LIBRE = 'c0000000-0000-4000-8000-000000000004'
    const appelsRattachement = () => baseQr.etat.appelsRpc.filter((a) => a.nom === 'signalements_qr_rattacher_coproprietes')
    const libre = () => baseQr.table('signalements_qr_coproprietes').find((c) => c.id === COPRO_LIBRE) as Record<string, unknown>
    beforeEach(() => {
      // L'import du fichier du client a déjà créé « Résidence Exemple » (avec son code postal) dans le cabinet.
      baseQr.table('signalements_qr_coproprietes').push({ id: DU_CABINET, nom: 'Résidence Exemple', cabinet_id: CAB, code_postal: '13001', ville: 'Marseille', adresse: '' })
    })

    it('même nom, code postal absent (doublon probable) : 409 doublon, rien n’est rattaché ; confirmé : rattaché', async () => {
      const refus = await rattacher(CAB, { coproprieteIds: [COPRO_LIBRE] })
      expect(refus.status).toBe(409)
      expect(await refus.json()).toEqual({
        error: 'doublon', doublon: { certitude: 'probable', critere: 'nom', copropriete: { id: DU_CABINET, nom: 'Résidence Exemple', ville: 'Marseille' } },
      })
      expect(appelsRattachement()).toEqual([])
      expect(libre().cabinet_id).toBeNull()
      const ok = await rattacher(CAB, { coproprieteIds: [COPRO_LIBRE], confirmerDoublonProbable: true })
      expect(ok.status).toBe(200)
      expect(appelsRattachement()[0].args).toMatchObject({ p_forcer_doublon: false })
    })

    it('même nom ET même code postal (certain) : 409 même confirmé ; « Ce n’est pas un doublon » (forcerDoublon) : rattaché, forçage transmis', async () => {
      Object.assign(libre(), { code_postal: '13001' })
      for (const corps of [{ coproprieteIds: [COPRO_LIBRE] }, { coproprieteIds: [COPRO_LIBRE], confirmerDoublonProbable: true }]) {
        const refus = await rattacher(CAB, corps)
        expect(refus.status).toBe(409)
        expect((await refus.json()).doublon).toMatchObject({ certitude: 'certain', critere: 'nom_code_postal' })
      }
      expect(appelsRattachement()).toEqual([])
      const force = await rattacher(CAB, { coproprieteIds: [COPRO_LIBRE], forcerDoublon: true })
      expect(force.status).toBe(200)
      expect(appelsRattachement()[0].args).toMatchObject({ p_forcer_doublon: true, p_cles_nom: { [COPRO_LIBRE]: 'exemple' } })
    })

    it('même immatriculation : 409, jamais forçable', async () => {
      Object.assign(libre(), { nom: 'Villa Exemple', immatriculation: 'AB1234567' })
      Object.assign(baseQr.table('signalements_qr_coproprietes').find((c) => c.id === DU_CABINET) as Record<string, unknown>, { immatriculation: 'AB1234567' })
      const res = await rattacher(CAB, { coproprieteIds: [COPRO_LIBRE], forcerDoublon: true })
      expect(res.status).toBe(409)
      expect((await res.json()).doublon).toMatchObject({ certitude: 'certain', critere: 'immatriculation' })
      expect(appelsRattachement()).toEqual([])
    })

    it('deux copropriétés du même lot, même nom et même code postal : 409 doublon', async () => {
      baseQr.etat.tables.signalements_qr_coproprietes = baseQr.table('signalements_qr_coproprietes').filter((c) => c.id !== DU_CABINET)
      Object.assign(libre(), { nom: 'Villa Exemple', code_postal: '13002' })
      baseQr.table('signalements_qr_coproprietes').push({ id: AUTRE_LIBRE, nom: 'VILLA exemple', cabinet_id: null, code_postal: '13002', ville: '', adresse: '' })
      const res = await rattacher(CAB, { coproprieteIds: [COPRO_LIBRE, AUTRE_LIBRE] })
      expect(res.status).toBe(409)
      expect((await res.json()).doublon).toMatchObject({ certitude: 'certain', critere: 'nom_code_postal' })
      expect(appelsRattachement()).toEqual([])
    })

    it('doublon apparu entre-temps (contrôle SQL sous le verrou, P0001 doublon) : 409 doublon', async () => {
      baseQr.etat.fonctions.signalements_qr_rattacher_coproprietes = () => ERREUR_METIER('doublon')
      const res = await rattacher(CAB, { coproprieteIds: [COPRO_LIBRE], confirmerDoublonProbable: true })
      expect(res.status).toBe(409)
      expect(await res.json()).toEqual({ error: 'doublon' })
    })

    it('copropriétés illisibles (délai dépassé) : 500, rien n’est rattaché', async () => {
      baseQr.etat.erreursPonctuelles.signalements_qr_coproprietes = { code: '57014', message: 'canceling statement due to statement timeout' }
      const res = await rattacher(CAB, { coproprieteIds: [COPRO_LIBRE] })
      expect(res.status).toBe(500)
      expect(appelsRattachement()).toEqual([])
    })
  })

  it('liste vide ou de plus de 500 copropriétés : 400 ; cabinet inconnu : 404', async () => {
    expect((await rattacher(CAB, { coproprieteIds: [] })).status).toBe(400)
    const trop = Array.from({ length: 501 }, (_, i) => `c0000000-0000-4000-8000-${String(i).padStart(12, '0')}`)
    expect((await rattacher(CAB, { coproprieteIds: trop })).status).toBe(400)
    expect((await rattacher('ca000000-0000-4000-8000-00000000dead', { coproprieteIds: [COPRO_LIBRE] })).status).toBe(404)
  })
})
