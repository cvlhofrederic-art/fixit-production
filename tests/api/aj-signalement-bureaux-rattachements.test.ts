// tests/api/aj-signalement-bureaux-rattachements.test.ts
//
// Bureaux des cabinets clients (PR 1, sans écran) : routes EXISTANTES modifiées (plan § 4.2), super admin :
//   GET   /cabinets                     nombres de bureaux (total, ouverts), clés posées seulement si le cabinet en a ;
//   GET   /gestionnaires                bureau de chaque fiche (clé posée seulement si elle en a un) ; ?bureau=<id>,
//                                       ?bureau=aucun (fiches « bureau à compléter ») ;
//   GET   /gestionnaires/[id]           bureau de la fiche ;
//   POST  /gestionnaires                bureauId transmis à la fonction SQL ; 409 bureau_requis (cabinet qui a un bureau
//                                       ouvert, aucun choisi), bureau_ferme, a_reverifier (bureau d'un autre cabinet) ;
//   PATCH /gestionnaires/[id]           action seule { bureauId } (changer, jamais retirer), journal {bureau} ;
//                                       { actif: true } dans un bureau fermé : 409 bureau_ferme (refus de la base) ;
//   GET   /gestionnaires/[id]/export    bureau de la fiche dans l'export (clé posée seulement si elle en a un) ;
//                                       lecture du bureau en panne : 503, jamais un export sans son bureau ;
//   POST  /coproprietes                 bureauId facultatif, posé juste après la création (207 s'il ne l'est pas) ;
//   PATCH /coproprietes/[id]            bureauId (ou null), journal {bureau} ; { actif: true } dans un bureau fermé :
//                                       409 bureau_ferme (refus de la base) ;
//   GET   /tableau                      bureau de chaque copropriété ; ?bureau=<id>.
// Non-régression (choix 5, visibilité inchangée) : un gestionnaire voit exactement la même chose avec ou sans
// bureaux, et ses réponses n'ont aucune clé nouvelle ; il ne peut ni filtrer par bureau ni poser un bureau. Tant
// qu'aucun bureau n'existe, rien ne change pour personne (réponses identiques), et sans la migration les routes se
// replient. Aucune donnée réelle : « Cabinet Exemple », bureaux « Nord » et « Sud », adresses @exemple.test.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/supabase-server', async () => ({ supabaseAdmin: (await import('../helpers/aj-signalement-base')).baseQr.client }))
vi.mock('@/lib/supabase-server-component', async () => (await import('../helpers/aj-signalement-routes')).mockCookies())
vi.mock('@/lib/auth-helpers', async () => (await import('../helpers/aj-signalement-routes')).mockAuth())
vi.mock('@/lib/rate-limit', async () => (await import('../helpers/aj-signalement-routes')).mockLimites())
vi.mock('@/lib/email', async () => (await import('../helpers/aj-signalement-routes')).mockEmail())
vi.mock('@/lib/logger', async () => (await import('../helpers/aj-signalement-routes')).mockLogger())

const { baseQr } = await import('../helpers/aj-signalement-base')
const { ADMIN_QR, contexteQr, messagesEnvoyesQr, reinitialiserSimulQr, requeteQr, simulQr } = await import('../helpers/aj-signalement-routes')
const A = await import('../helpers/aj-signalement-acces')
const { CAB, CAB_AUTRE, COMPTE_G1, C1, C2, C3, C_SANS, C_TOUS, G1, G2, G3, S1, S2, connecterQr, poserJeuAccesQr, simulerCreationCoproprietesQr } = A
const {
  EXCEPTION_LECTURE_QR, MESSAGE_EXCEPTION_LECTURE_QR, ligneBureauQr, refuserLecturesQr, simulerFonctionsBureauxQr, simulerProductionAvantBureauxQr,
} = await import('../helpers/aj-signalement-bureaux')
const { reinitialiserReplisQr } = await import('@/lib/aj-signalement/serveur')
const { COLONNES_BUREAU_QR } = await import('@/lib/aj-signalement/serveur-bureaux')
const { GET: CABINETS } = await import('@/app/api/aj-signalement/cabinets/route')
const { GET: LISTE, POST: CREER_FICHE } = await import('@/app/api/aj-signalement/gestionnaires/route')
const { GET: FICHE, PATCH: MODIFIER_FICHE } = await import('@/app/api/aj-signalement/gestionnaires/[id]/route')
const { GET: EXPORT } = await import('@/app/api/aj-signalement/gestionnaires/[id]/export/route')
const { POST: CREER_COPRO } = await import('@/app/api/aj-signalement/coproprietes/route')
const { PATCH: MODIFIER_COPRO } = await import('@/app/api/aj-signalement/coproprietes/[id]/route')
const { GET: TABLEAU } = await import('@/app/api/aj-signalement/tableau/route')

const NORD = 'b0000000-0000-4000-8000-0000000000a1'
const SUD = 'b0000000-0000-4000-8000-0000000000a2'
const AILLEURS = 'b0000000-0000-4000-8000-0000000000a3'
const FERME = 'b0000000-0000-4000-8000-0000000000a4'
const INCONNU = 'b0000000-0000-4000-8000-0000000000ff'
const NOUVELLE = { nom: 'Julie Nouvelle', email: 'julie.nouvelle@exemple.test', cabinetId: CAB }
/** Panne de la base (autre chose que la migration absente). */
const PANNE_LECTURE = { code: 'XX000', message: 'panne de lecture simulée' }

type Ligne = Record<string, unknown>
const ligne = (table: string, id: string): Ligne => {
  const trouvee = baseQr.table(table).find((l) => l.id === id)
  if (!trouvee) throw new Error(`${table} ${id} absente`)
  return trouvee
}

/**
 * La prochaine MISE À JOUR de la table reçoit cette erreur (comme un refus d'un trigger ou d'une contrainte de la base) ;
 * les lectures passent. Rend la fonction qui remet le client simulé.
 */
function refuserEcriture(table: string, erreur: { code: string; message: string }): () => void {
  const original = baseQr.client.from
  baseQr.client.from = ((nom: string, ...reste: unknown[]) => {
    const q = (original as (t: string, ...r: unknown[]) => Record<string, unknown>)(nom, ...reste)
    if (nom === table) {
      const update = q.update as (v: Ligne) => unknown
      q.update = (v: Ligne) => {
        baseQr.etat.erreursPonctuelles[table] = erreur
        return update(v)
      }
    }
    return q
  }) as typeof original
  return () => { baseQr.client.from = original }
}

/** Création d'une fiche simulée : la règle du trigger (bureau_requis) et le bureau inséré. */
function simulerCreationFiche(): void {
  baseQr.etat.fonctions.signalements_qr_inviter_gestionnaire = (a) => {
    const g = a.p_gestionnaire as Ligne
    const bureau = typeof g.bureauId === 'string' ? g.bureauId : null
    if (!bureau && baseQr.table('signalements_qr_bureaux').some((b) => b.cabinet_id === g.cabinetId && !b.ferme_le)) {
      return { error: { code: 'P0001', message: 'bureau_requis' } }
    }
    baseQr.table('signalements_qr_gestionnaires').push({
      id: g.id, cabinet_id: g.cabinetId, bureau_id: bureau, nom: g.nom, email: g.email, actif: true, domaine_force: g.domaineForce,
      adresse_confirmee_le: null, adresse_contestee_le: null, pseudonymise_le: null, desactive_le: null, created_at: '2026-11-19T10:00:00+00:00',
    })
    return { data: g.id }
  }
}

/** Bureaux du jeu : Nord et Sud (ouverts) et Fermé dans le cabinet ; Nord dans l'autre cabinet. */
function poserBureaux(): void {
  baseQr.etat.tables.signalements_qr_bureaux = [
    ligneBureauQr(NORD, CAB, 'Nord'),
    ligneBureauQr(SUD, CAB, 'Sud'),
    ligneBureauQr(FERME, CAB, 'Ancien bureau', { ferme_le: '2026-11-18T09:00:00+00:00' }),
    ligneBureauQr(AILLEURS, CAB_AUTRE, 'Nord'),
  ]
}

beforeEach(() => {
  reinitialiserSimulQr()
  reinitialiserReplisQr()
  baseQr.reinitialiser()
  vi.unstubAllEnvs()
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'cle-de-service-de-test')
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://vitfix.io')
  vi.stubEnv('ADMIN_EMAIL', 'admin@exemple.test')
  vi.stubEnv('ADMIN_EMAIL_2', '')
  poserJeuAccesQr()
  simulerFonctionsBureauxQr()
  simulerCreationFiche()
  baseQr.etat.tables.signalements_qr_bureaux = []
})

const json = async (res: Response) => res.json() as Promise<Record<string, unknown>>
const lireCabinets = async () => (await json(await CABINETS(requeteQr('/api/aj-signalement/cabinets')))).cabinets as Ligne[]
const lireListe = async (query = '') => {
  const res = await LISTE(requeteQr(`/api/aj-signalement/gestionnaires${query}`))
  return { res, gestionnaires: res.status === 200 ? ((await json(res)).gestionnaires as Ligne[]) : [] }
}
const lireTableau = async (query = '') => {
  const res = await TABLEAU(requeteQr(`/api/aj-signalement/tableau${query}`))
  return { res, corps: await json(res) }
}
const creerFiche = (corps: unknown) => CREER_FICHE(requeteQr('/api/aj-signalement/gestionnaires', 'POST', corps))
const modifierFiche = (id: string, corps: unknown) => MODIFIER_FICHE(requeteQr(`/api/aj-signalement/gestionnaires/${id}`, 'PATCH', corps), contexteQr(id))
const creerCopro = (corps: unknown) => CREER_COPRO(requeteQr('/api/aj-signalement/coproprietes', 'POST', corps))
const modifierCopro = (id: string, corps: unknown) => MODIFIER_COPRO(requeteQr(`/api/aj-signalement/coproprietes/${id}`, 'PATCH', corps), contexteQr(id))
const appels = (nom: string) => baseQr.etat.appelsRpc.filter((a) => a.nom === nom)
const exporterReponse = (id: string) => EXPORT(requeteQr(`/api/aj-signalement/gestionnaires/${id}/export`), contexteQr(id))
const exporterFiche = async (id: string) => (await json(await exporterReponse(id))).fiche as Ligne

describe('tant qu’aucun bureau n’existe : rien ne change pour personne', () => {
  it('cabinets, gestionnaires, fiche et tableau du super admin : aucune clé de bureau', async () => {
    for (const c of await lireCabinets()) {
      expect(c).not.toHaveProperty('nbBureaux')
      expect(c).not.toHaveProperty('nbBureauxOuverts')
    }
    const { gestionnaires } = await lireListe('?etat=tous')
    expect(gestionnaires.length).toBeGreaterThan(0)
    for (const g of gestionnaires) expect(g).not.toHaveProperty('bureau')
    const fiche = await json(await FICHE(requeteQr(`/api/aj-signalement/gestionnaires/${G1}`), contexteQr(G1)))
    expect(fiche.gestionnaire).not.toHaveProperty('bureau')
    expect(await exporterFiche(G1)).not.toHaveProperty('bureau')
    const { corps } = await lireTableau()
    for (const c of (corps.tableau as { coproprietes: Ligne[] }).coproprietes) expect(c).not.toHaveProperty('bureau')
  })

  it('création d’une fiche sans bureauId : appel de la fonction SQL inchangé (aucune clé bureauId)', async () => {
    const res = await creerFiche(NOUVELLE)
    expect(res.status).toBe(201)
    expect(appels('signalements_qr_inviter_gestionnaire')[0].args.p_gestionnaire).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/), cabinetId: CAB, nom: 'Julie Nouvelle', email: 'julie.nouvelle@exemple.test', domaineForce: false,
    })
  })
})

describe('GET /cabinets : nombres de bureaux', () => {
  it('nbBureaux (fermés compris) et nbBureauxOuverts sur les cabinets qui en ont ; clés absentes sinon', async () => {
    poserBureaux()
    const cabinets = await lireCabinets()
    expect(cabinets.find((c) => c.id === CAB)).toMatchObject({ nbBureaux: 3, nbBureauxOuverts: 2 })
    expect(cabinets.find((c) => c.id === CAB_AUTRE)).toMatchObject({ nbBureaux: 1, nbBureauxOuverts: 1 })
    baseQr.etat.tables.signalements_qr_bureaux = baseQr.table('signalements_qr_bureaux').filter((b) => b.cabinet_id === CAB)
    expect((await lireCabinets()).find((c) => c.id === CAB_AUTRE)).not.toHaveProperty('nbBureaux')
  })

  it('migration absente : la liste reste servie, sans ces clés (repli journalisé)', async () => {
    poserBureaux()
    simulerProductionAvantBureauxQr()
    const res = await CABINETS(requeteQr('/api/aj-signalement/cabinets'))
    expect(res.status).toBe(200)
    for (const c of (await json(res)).cabinets as Ligne[]) expect(c).not.toHaveProperty('nbBureaux')
  })
})

describe('GET /gestionnaires : bureau de chaque fiche, filtre par bureau', () => {
  beforeEach(() => {
    poserBureaux()
    Object.assign(ligne('signalements_qr_gestionnaires', G1), { bureau_id: NORD })
    Object.assign(ligne('signalements_qr_gestionnaires', G3), { bureau_id: AILLEURS })
  })

  it('bureau { id, nom, ferme } sur la fiche qui en a un ; clé absente sinon ; fiche et liste d’accord', async () => {
    const { res, gestionnaires } = await lireListe()
    expect(res.status).toBe(200)
    expect(gestionnaires.find((g) => g.id === G1)?.bureau).toEqual({ id: NORD, nom: 'Nord', ferme: false })
    expect(gestionnaires.find((g) => g.id === G2)).not.toHaveProperty('bureau')
    const fiche = await json(await FICHE(requeteQr(`/api/aj-signalement/gestionnaires/${G1}`), contexteQr(G1)))
    expect((fiche.gestionnaire as Ligne).bureau).toEqual({ id: NORD, nom: 'Nord', ferme: false })
  })

  it('?bureau=<id> : les fiches de ce bureau ; ?bureau=aucun : fiches sans bureau d’un cabinet qui a un bureau ouvert', async () => {
    expect((await lireListe(`?bureau=${NORD}`)).gestionnaires.map((g) => g.id)).toEqual([G1])
    expect((await lireListe(`?bureau=${SUD}`)).gestionnaires).toEqual([])
    expect((await lireListe('?bureau=aucun')).gestionnaires.map((g) => g.id)).toEqual([G2])
    // L'autre cabinet n'a plus de bureau ouvert : sa fiche sans bureau n'est pas « à compléter ».
    Object.assign(ligne('signalements_qr_gestionnaires', G3), { bureau_id: null })
    Object.assign(ligne('signalements_qr_bureaux', AILLEURS), { ferme_le: '2026-11-19T08:00:00+00:00' })
    expect((await lireListe('?bureau=aucun')).gestionnaires.map((g) => g.id)).toEqual([G2])
    expect((await lireListe(`?bureau=aucun&cabinet=${CAB_AUTRE}`)).gestionnaires).toEqual([])
  })

  it('?bureau=aucun : sans les fiches effacées (elles ne peuvent plus recevoir de bureau) ; ?bureau=<id> et la liste sans filtre : inchangés', async () => {
    const PARTIE = 'a0000000-0000-4000-8000-0000000000d1'
    const EFFACEE_NORD = 'a0000000-0000-4000-8000-0000000000d2'
    const depart = { actif: false, desactive_le: '2026-11-17T09:00:00+00:00', user_id: null, acces_ouvert_le: null }
    const effacement = { ...depart, nom: null, email: null, pseudonymise_le: '2026-11-18T09:00:00+00:00' }
    // G2 effacée (départ puis effacement RGPD : nom et e-mail null), sans bureau ; une fiche effacée restée dans Nord ;
    // une fiche partie NON effacée, sans bureau : toujours à compléter (le changement de bureau lui reste permis).
    Object.assign(ligne('signalements_qr_gestionnaires', G2), effacement)
    baseQr.table('signalements_qr_gestionnaires').push(
      { ...ligne('signalements_qr_gestionnaires', G1), ...depart, id: PARTIE, nom: 'Anne Partie', email: 'anne.partie@exemple.test', bureau_id: null, created_at: '2026-11-06T08:00:00+00:00' },
      { ...ligne('signalements_qr_gestionnaires', G1), ...effacement, id: EFFACEE_NORD, bureau_id: NORD, created_at: '2026-11-07T08:00:00+00:00' },
    )
    const ids = async (query: string) => (await lireListe(query)).gestionnaires.map((g) => g.id)

    expect(await ids('?etat=tous&bureau=aucun')).toEqual([PARTIE])
    expect(await ids('?etat=desactives&bureau=aucun')).toEqual([PARTIE])
    expect(await ids('?bureau=aucun')).toEqual([])
    // Inchangés : le filtre d'un bureau garde ses fiches effacées ; sans filtre, toutes les fiches de l'état demandé.
    expect((await ids(`?etat=tous&bureau=${NORD}`)).sort()).toEqual([G1, EFFACEE_NORD].sort())
    expect((await ids('?etat=tous')).sort()).toEqual([G1, G2, G3, PARTIE, EFFACEE_NORD].sort())
    expect((await lireListe('?etat=desactives')).gestionnaires.find((g) => g.id === G2)).toMatchObject({ id: G2, nom: null, email: null })
  })

  it('?bureau= hors format : 400 ; migration absente : liste sans bureau, et ?bureau= → 503 base_absente', async () => {
    expect((await lireListe('?bureau=nord')).res.status).toBe(400)
    simulerProductionAvantBureauxQr()
    const { res, gestionnaires } = await lireListe()
    expect(res.status).toBe(200)
    for (const g of gestionnaires) expect(g).not.toHaveProperty('bureau')
    const filtre = await lireListe(`?bureau=${NORD}`)
    expect(filtre.res.status).toBe(503)
    expect(await json(filtre.res)).toEqual({ error: 'base_absente' })
  })

  // Non-régression de la décision du 20/11/2026 : seuls les EXPORTS refusent de partir sans leur bureau (503) ;
  // l'affichage reste servi comme avant, sans clé de bureau.
  it.each([
    ['bureaux illisibles', () => refuserLecturesQr('signalements_qr_bureaux', COLONNES_BUREAU_QR, PANNE_LECTURE)],
    ['lecture qui lève', () => refuserLecturesQr('signalements_qr_gestionnaires', 'id, bureau_id', EXCEPTION_LECTURE_QR)],
  ])('lecture du bureau en panne (%s) : la liste reste servie (200), sans clé de bureau, comme avant', async (_cas, panne) => {
    const restaurer = panne()
    try {
      const { res, gestionnaires } = await lireListe()
      expect(res.status).toBe(200)
      // G1 (rattachée à Nord) comprise : servie sans son bureau, rien n'est refusé.
      expect(gestionnaires.map((g) => g.id)).toContain(G1)
      for (const g of gestionnaires) expect(g).not.toHaveProperty('bureau')
    } finally {
      restaurer()
    }
  })
})

describe('POST /gestionnaires : bureau d’une nouvelle fiche (choix 2)', () => {
  beforeEach(poserBureaux)

  it('cabinet qui a un bureau ouvert, aucun bureau choisi : 409 bureau_requis, rien d’écrit, aucun e-mail', async () => {
    const res = await creerFiche(NOUVELLE)
    expect(res.status).toBe(409)
    expect(await json(res)).toEqual({ error: 'bureau_requis' })
    expect(appels('signalements_qr_inviter_gestionnaire')).toEqual([])
    expect(messagesEnvoyesQr()).toEqual([])
  })

  it('bureau choisi : transmis à la fonction SQL (bureauId) ; la fiche rendue porte son bureau', async () => {
    const res = await creerFiche({ ...NOUVELLE, bureauId: SUD })
    expect(res.status).toBe(201)
    expect((appels('signalements_qr_inviter_gestionnaire')[0].args.p_gestionnaire as Ligne).bureauId).toBe(SUD)
    expect(((await json(res)).gestionnaire as Ligne).bureau).toEqual({ id: SUD, nom: 'Sud', ferme: false })
  })

  it('bureau fermé : 409 bureau_ferme ; bureau d’un autre cabinet ou inconnu : 409 a_reverifier ; rien d’écrit', async () => {
    expect(await json(await creerFiche({ ...NOUVELLE, bureauId: FERME }))).toEqual({ error: 'bureau_ferme' })
    expect(await json(await creerFiche({ ...NOUVELLE, bureauId: AILLEURS }))).toEqual({ error: 'a_reverifier' })
    expect(await json(await creerFiche({ ...NOUVELLE, bureauId: INCONNU }))).toEqual({ error: 'a_reverifier' })
    expect(appels('signalements_qr_inviter_gestionnaire')).toEqual([])
  })

  it('cabinet dont tous les bureaux sont fermés : fiche créée sans bureau', async () => {
    for (const b of baseQr.table('signalements_qr_bureaux')) b.ferme_le = '2026-11-18T09:00:00+00:00'
    expect((await creerFiche(NOUVELLE)).status).toBe(201)
  })

  it('bureau ouvert entre-temps (la base refuse : bureau_requis) : 409 bureau_requis', async () => {
    baseQr.etat.tables.signalements_qr_bureaux = []
    baseQr.etat.fonctions.signalements_qr_inviter_gestionnaire = () => ({ error: { code: 'P0001', message: 'bureau_requis' } })
    const res = await creerFiche(NOUVELLE)
    expect(res.status).toBe(409)
    expect(await json(res)).toEqual({ error: 'bureau_requis' })
  })

  it('bureauId hors format : 400 ; migration absente : sans bureauId comme avant, avec bureauId 503 sans rien écrire', async () => {
    expect((await creerFiche({ ...NOUVELLE, bureauId: 'nord' })).status).toBe(400)
    simulerProductionAvantBureauxQr()
    const avec = await creerFiche({ ...NOUVELLE, bureauId: NORD })
    expect(avec.status).toBe(503)
    expect(await json(avec)).toEqual({ error: 'base_absente' })
    expect(appels('signalements_qr_inviter_gestionnaire')).toEqual([])
    baseQr.etat.tables.signalements_qr_bureaux = []
    expect((await creerFiche(NOUVELLE)).status).toBe(201)
  })
})

describe('PATCH /gestionnaires/[id] : { bureauId } (changer, jamais retirer)', () => {
  beforeEach(() => {
    poserBureaux()
    Object.assign(ligne('signalements_qr_gestionnaires', G1), { bureau_id: NORD })
  })

  it('change le bureau : écriture de bureau_id seul, journal gestionnaire.modifie {bureau} (identifiants seulement), fiche rendue', async () => {
    const res = await modifierFiche(G1, { bureauId: SUD })
    expect(res.status).toBe(200)
    expect(baseQr.ecrituresDe('signalements_qr_gestionnaires', 'update').at(-1)?.valeurs).toEqual({ bureau_id: SUD })
    expect(baseQr.table('signalements_qr_journal').at(-1)).toMatchObject({
      action: 'gestionnaire.modifie', champs: ['bureau'], gestionnaire_id: G1, cabinet_id: CAB, acteur_id: ADMIN_QR.id,
      details: { bureauId: SUD, ancienBureauId: NORD },
    })
    expect(JSON.stringify(baseQr.table('signalements_qr_journal'))).not.toMatch(/Sud|Nord/)
    expect(((await json(res)).gestionnaire as Ligne).bureau).toEqual({ id: SUD, nom: 'Sud', ferme: false })
  })

  it('fiche existante sans bureau : complétée (ancienBureauId null)', async () => {
    const res = await modifierFiche(G2, { bureauId: NORD })
    expect(res.status).toBe(200)
    expect(baseQr.table('signalements_qr_journal').at(-1)?.details).toEqual({ bureauId: NORD, ancienBureauId: null })
  })

  it('même bureau : 200, rien d’écrit ni journalisé', async () => {
    expect((await modifierFiche(G1, { bureauId: NORD })).status).toBe(200)
    expect(baseQr.ecrituresDe('signalements_qr_gestionnaires', 'update')).toEqual([])
    expect(baseQr.table('signalements_qr_journal')).toEqual([])
  })

  it('retrait (bureauId null) : 400 ; avec une autre action : 400 (une seule action par appel)', async () => {
    expect((await modifierFiche(G1, { bureauId: null })).status).toBe(400)
    expect((await modifierFiche(G1, { bureauId: SUD, nom: 'Marie Exemple' })).status).toBe(400)
    expect(baseQr.ecrituresDe('signalements_qr_gestionnaires', 'update')).toEqual([])
  })

  it('bureau fermé : 409 bureau_ferme ; d’un autre cabinet ou inconnu : 409 a_reverifier ; fiche effacée : 409 fiche_effacee', async () => {
    expect(await json(await modifierFiche(G1, { bureauId: FERME }))).toEqual({ error: 'bureau_ferme' })
    expect(await json(await modifierFiche(G1, { bureauId: AILLEURS }))).toEqual({ error: 'a_reverifier' })
    expect(await json(await modifierFiche(G1, { bureauId: INCONNU }))).toEqual({ error: 'a_reverifier' })
    Object.assign(ligne('signalements_qr_gestionnaires', G2), { pseudonymise_le: '2026-11-18T09:00:00+00:00', nom: null, email: null, actif: false })
    expect(await json(await modifierFiche(G2, { bureauId: NORD }))).toEqual({ error: 'fiche_effacee' })
    expect(baseQr.ecrituresDe('signalements_qr_gestionnaires', 'update')).toEqual([])
  })

  it('refus de la base à l’écriture (bureau fermé entre-temps, trigger) : 409 bureau_ferme', async () => {
    const restaurer = refuserEcriture('signalements_qr_gestionnaires', { code: 'P0001', message: 'bureau_ferme' })
    try {
      expect(await json(await modifierFiche(G1, { bureauId: SUD }))).toEqual({ error: 'bureau_ferme' })
    } finally {
      restaurer()
    }
  })

  it('migration absente : 503 base_absente, rien d’écrit', async () => {
    simulerProductionAvantBureauxQr()
    const res = await modifierFiche(G1, { bureauId: SUD })
    expect(res.status).toBe(503)
    expect(await json(res)).toEqual({ error: 'base_absente' })
    expect(baseQr.ecrituresDe('signalements_qr_gestionnaires', 'update')).toEqual([])
  })
})

describe('GET /gestionnaires/[id]/export : bureau de la fiche', () => {
  it('nom et identifiant du bureau de la fiche ; clé absente sans bureau, et sans la migration (export d’avant)', async () => {
    poserBureaux()
    Object.assign(ligne('signalements_qr_gestionnaires', G1), { bureau_id: NORD })
    expect((await exporterFiche(G1)).bureau).toEqual({ id: NORD, nom: 'Nord' })
    expect(await exporterFiche(G2)).not.toHaveProperty('bureau')
    simulerProductionAvantBureauxQr()
    expect(await exporterFiche(G1)).not.toHaveProperty('bureau')
  })

  it('migration absente : export d’avant (200, pièce jointe, journalisé), repli journalisé une fois', async () => {
    simulerProductionAvantBureauxQr()
    for (let i = 0; i < 2; i += 1) {
      const res = await exporterReponse(G1)
      expect(res.status).toBe(200)
      expect(res.headers.get('content-disposition')).toBe(`attachment; filename="gestionnaire-${G1}.json"`)
      expect((await json(res)).fiche).not.toHaveProperty('bureau')
    }
    expect(simulQr.logger.warn.mock.calls.filter((c) => /19\/11\/2026/.test(String(c[0])))).toHaveLength(1)
    expect(baseQr.table('signalements_qr_journal').filter((j) => j.action === 'gestionnaire.exporte')).toHaveLength(2)
  })

  it.each([
    ['bureaux illisibles, fiche rattachée', G1, () => refuserLecturesQr('signalements_qr_bureaux', COLONNES_BUREAU_QR, PANNE_LECTURE)],
    ['rattachement de la fiche illisible, fiche sans bureau', G2, () => refuserLecturesQr('signalements_qr_gestionnaires', 'id, bureau_id', PANNE_LECTURE)],
  ])('lecture du bureau en panne (%s) : 503 au message générique, aucun export servi ni journalisé', async (_cas, id, panne) => {
    poserBureaux()
    Object.assign(ligne('signalements_qr_gestionnaires', G1), { bureau_id: NORD })
    const restaurer = panne()
    try {
      const res = await exporterReponse(id)
      expect(res.status).toBe(503)
      expect(await json(res)).toEqual({ error: 'serveur' })
      expect(res.headers.get('content-disposition')).toBeNull()
    } finally {
      restaurer()
    }
    expect(baseQr.table('signalements_qr_journal').filter((j) => j.action === 'gestionnaire.exporte')).toEqual([])
    // Journal serveur : le code seul, jamais le nom d'un bureau ni le message de la base.
    expect(simulQr.logger.error).toHaveBeenCalledWith(expect.stringContaining('bureau'), { code: 'XX000' })
    const journalServeur = JSON.stringify([...simulQr.logger.error.mock.calls, ...simulQr.logger.warn.mock.calls])
    expect(journalServeur).not.toContain('Nord')
    expect(journalServeur).not.toContain(PANNE_LECTURE.message)
  })

  it('lecture du bureau qui lève (client ou réseau en panne) : 503 aussi, jamais l’export d’avant ni journalisé', async () => {
    poserBureaux()
    Object.assign(ligne('signalements_qr_gestionnaires', G1), { bureau_id: NORD })
    const restaurer = refuserLecturesQr('signalements_qr_gestionnaires', 'id, bureau_id', EXCEPTION_LECTURE_QR)
    try {
      const res = await exporterReponse(G1)
      expect(res.status).toBe(503)
      expect(await json(res)).toEqual({ error: 'serveur' })
      expect(res.headers.get('content-disposition')).toBeNull()
    } finally {
      restaurer()
    }
    expect(baseQr.table('signalements_qr_journal').filter((j) => j.action === 'gestionnaire.exporte')).toEqual([])
    // Journal serveur : le nom de l'exception seul, jamais son message.
    expect(simulQr.logger.warn).toHaveBeenCalledWith(expect.stringContaining('bureau'), { exception: 'Error' })
    expect(JSON.stringify([...simulQr.logger.error.mock.calls, ...simulQr.logger.warn.mock.calls])).not.toContain(MESSAGE_EXCEPTION_LECTURE_QR)
  })
})

describe('réactivation dans un bureau fermé (refus de la base, trigger) : 409 bureau_ferme, rien de réactivé ni journalisé', () => {
  beforeEach(poserBureaux)

  it('PATCH /gestionnaires/[id] { actif: true } : 409 bureau_ferme (changer de bureau d’abord)', async () => {
    Object.assign(ligne('signalements_qr_gestionnaires', G2), { bureau_id: FERME, actif: false, desactive_le: '2026-11-18T09:00:00+00:00' })
    baseQr.etat.fonctions.signalements_qr_reactiver_gestionnaire = () => ({ error: { code: 'P0001', message: 'bureau_ferme' } })
    const res = await modifierFiche(G2, { actif: true })
    expect(res.status).toBe(409)
    expect(await json(res)).toEqual({ error: 'bureau_ferme' })
    expect(ligne('signalements_qr_gestionnaires', G2).actif).toBe(false)
    // Le changement de bureau passe sur la fiche désactivée.
    expect((await modifierFiche(G2, { bureauId: SUD })).status).toBe(200)
    expect(ligne('signalements_qr_gestionnaires', G2).bureau_id).toBe(SUD)
  })

  it('PATCH /coproprietes/[id] { actif: true } : 409 bureau_ferme, aucun journal copropriete.reactivee', async () => {
    Object.assign(ligne('signalements_qr_coproprietes', C1), { bureau_id: FERME, actif: false })
    const restaurer = refuserEcriture('signalements_qr_coproprietes', { code: 'P0001', message: 'bureau_ferme' })
    try {
      const res = await modifierCopro(C1, { actif: true })
      expect(res.status).toBe(409)
      expect(await json(res)).toEqual({ error: 'bureau_ferme' })
    } finally {
      restaurer()
    }
    expect(baseQr.table('signalements_qr_journal').filter((j) => j.copropriete_id === C1)).toEqual([])
  })
})

describe('PATCH /coproprietes/[id] : bureau d’une copropriété (choix 1, facultatif)', () => {
  beforeEach(poserBureaux)

  it('pose, change puis retire le bureau ; journal copropriete.modifiee {bureau} ; copropriété rendue avec son bureau', async () => {
    const pose = await modifierCopro(C1, { bureauId: NORD })
    expect(pose.status).toBe(200)
    expect(baseQr.ecrituresDe('signalements_qr_coproprietes', 'update').at(-1)?.valeurs).toEqual({ bureau_id: NORD })
    expect(((await json(pose)).copropriete as Ligne).bureau).toEqual({ id: NORD, nom: 'Nord', ferme: false })
    await modifierCopro(C1, { bureauId: SUD })
    const retrait = await modifierCopro(C1, { bureauId: null })
    expect((await json(retrait)).copropriete).not.toHaveProperty('bureau')
    expect(ligne('signalements_qr_coproprietes', C1).bureau_id).toBeNull()
    const journal = baseQr.table('signalements_qr_journal').filter((j) => j.copropriete_id === C1)
    expect(journal.map((j) => [j.action, j.champs])).toEqual([
      ['copropriete.modifiee', ['bureau']], ['copropriete.modifiee', ['bureau']], ['copropriete.modifiee', ['bureau']],
    ])
  })

  it('même bureau, ou retrait sans bureau : aucun champ journalisé', async () => {
    Object.assign(ligne('signalements_qr_coproprietes', C1), { bureau_id: FERME })
    // Déjà rattachée au bureau fermé : elle le garde (aucun refus pour un bureau inchangé).
    expect((await modifierCopro(C1, { bureauId: FERME, nom: 'Résidence Une' })).status).toBe(200)
    expect((await modifierCopro(C2, { bureauId: null })).status).toBe(200)
    expect(baseQr.table('signalements_qr_journal')).toEqual([])
  })

  it('bureau fermé : 409 bureau_ferme ; d’un autre cabinet ou inconnu : 409 a_reverifier ; copropriété sans cabinet : 409 sans_cabinet ; rien d’écrit', async () => {
    expect(await json(await modifierCopro(C1, { bureauId: FERME }))).toEqual({ error: 'bureau_ferme' })
    expect(await json(await modifierCopro(C1, { bureauId: AILLEURS }))).toEqual({ error: 'a_reverifier' })
    expect(await json(await modifierCopro(C1, { bureauId: INCONNU }))).toEqual({ error: 'a_reverifier' })
    expect(await json(await modifierCopro(C_SANS, { bureauId: NORD }))).toEqual({ error: 'sans_cabinet' })
    expect(baseQr.ecrituresDe('signalements_qr_coproprietes', 'update')).toEqual([])
  })

  it('un gestionnaire ne pose pas de bureau (choix 3) : 400, rien d’écrit', async () => {
    connecterQr(COMPTE_G1)
    const res = await modifierCopro(C1, { bureauId: NORD })
    expect(res.status).toBe(400)
    expect(baseQr.ecrituresDe('signalements_qr_coproprietes', 'update')).toEqual([])
  })

  it('migration absente : 503 base_absente avant toute écriture', async () => {
    simulerProductionAvantBureauxQr()
    const res = await modifierCopro(C1, { bureauId: NORD, nom: 'Résidence Une Bis' })
    expect(res.status).toBe(503)
    expect(baseQr.ecrituresDe('signalements_qr_coproprietes', 'update')).toEqual([])
  })
})

describe('POST /coproprietes : bureau facultatif à la création', () => {
  beforeEach(() => {
    poserBureaux()
    simulerCreationCoproprietesQr()
  })
  const FICHE = { nom: 'Résidence Nouvelle', adresse: '9 rue Exemple', codePostal: '13002', ville: 'Ville Exemple', cabinetId: CAB }

  it('bureau posé juste après la création : 201, copropriété rendue avec son bureau, journal {bureau}', async () => {
    const res = await creerCopro({ ...FICHE, bureauId: NORD })
    expect(res.status).toBe(201)
    const copro = (await json(res)).copropriete as Ligne
    expect(copro.bureau).toEqual({ id: NORD, nom: 'Nord', ferme: false })
    expect(ligne('signalements_qr_coproprietes', String(copro.id)).bureau_id).toBe(NORD)
    expect(baseQr.table('signalements_qr_journal').filter((j) => j.copropriete_id === copro.id).map((j) => [j.action, j.champs ?? []]))
      .toEqual([['copropriete.creee', []], ['copropriete.modifiee', ['bureau']]])
  })

  it('sans bureauId : comme avant (aucune écriture de bureau)', async () => {
    const res = await creerCopro(FICHE)
    expect(res.status).toBe(201)
    expect(baseQr.ecrituresDe('signalements_qr_coproprietes', 'update')).toEqual([])
    expect((await json(res)).copropriete).not.toHaveProperty('bureau')
  })

  it('bureau fermé, d’un autre cabinet, ou sans cabinet : refus AVANT la création (409), rien de créé', async () => {
    expect(await json(await creerCopro({ ...FICHE, bureauId: FERME }))).toEqual({ error: 'bureau_ferme' })
    expect(await json(await creerCopro({ ...FICHE, bureauId: AILLEURS }))).toEqual({ error: 'a_reverifier' })
    const sansCabinet = { nom: FICHE.nom, adresse: FICHE.adresse, codePostal: FICHE.codePostal, ville: FICHE.ville }
    expect(await json(await creerCopro({ ...sansCabinet, bureauId: NORD }))).toEqual({ error: 'sans_cabinet' })
    expect(appels('signalements_qr_creer_coproprietes')).toEqual([])
  })

  it('la seconde étape échoue : 207 { copropriete, error: bureau_non_pose } (la copropriété est créée, sans bureau)', async () => {
    const restaurer = refuserEcriture('signalements_qr_coproprietes', { code: 'P0001', message: 'bureau_ferme' })
    try {
      const res = await creerCopro({ ...FICHE, bureauId: NORD })
      expect(res.status).toBe(207)
      const corps = await json(res)
      expect(corps.error).toBe('bureau_non_pose')
      expect(corps.copropriete).toMatchObject({ nom: 'Résidence Nouvelle' })
      expect(corps.copropriete).not.toHaveProperty('bureau')
    } finally {
      restaurer()
    }
  })

  it('un gestionnaire ne pose pas de bureau à la création : 400', async () => {
    connecterQr(COMPTE_G1)
    const res = await creerCopro({ operationId: 'd1000000-0000-4000-8000-000000000001', nom: 'Résidence G', adresse: '1 rue Exemple', codePostal: '13001', ville: 'Ville Exemple', bureauId: NORD })
    expect(res.status).toBe(400)
  })
})

describe('GET /tableau : bureau de chaque copropriété, filtre ?bureau=', () => {
  beforeEach(() => {
    poserBureaux()
    Object.assign(ligne('signalements_qr_coproprietes', C1), { bureau_id: NORD })
    Object.assign(ligne('signalements_qr_coproprietes', C3), { bureau_id: AILLEURS })
  })

  it('super admin : bureau { id, nom, ferme } sur les copropriétés qui en ont un ; clé absente sinon', async () => {
    const { res, corps } = await lireTableau()
    expect(res.status).toBe(200)
    const copros = (corps.tableau as { coproprietes: Ligne[] }).coproprietes
    expect(copros.find((c) => c.id === C1)?.bureau).toEqual({ id: NORD, nom: 'Nord', ferme: false })
    expect(copros.find((c) => c.id === C2)).not.toHaveProperty('bureau')
  })

  it('?bureau=<id> : les copropriétés de ce bureau et leurs signalements seulement ; inconnu : 404 ; hors format : 400', async () => {
    const { corps } = await lireTableau(`?bureau=${NORD}`)
    const tableau = corps.tableau as { coproprietes: Ligne[]; signalements: Ligne[] }
    expect(tableau.coproprietes.map((c) => c.id)).toEqual([C1])
    expect(tableau.signalements.map((s) => s.id)).toEqual([S1])
    expect((await lireTableau(`?bureau=${SUD}`)).corps).toEqual({ tableau: { coproprietes: [], signalements: [] } })
    expect((await lireTableau(`?bureau=${INCONNU}`)).res.status).toBe(404)
    expect((await lireTableau('?bureau=nord')).res.status).toBe(400)
    // Avec ?cabinet= d'un autre cabinet : rien.
    expect(((await lireTableau(`?bureau=${NORD}&cabinet=${CAB_AUTRE}`)).corps.tableau as { coproprietes: Ligne[] }).coproprietes).toEqual([])
  })

  it('migration absente : tableau sans bureau (200), ?bureau= → 503 base_absente', async () => {
    simulerProductionAvantBureauxQr()
    const { res, corps } = await lireTableau()
    expect(res.status).toBe(200)
    for (const c of (corps.tableau as { coproprietes: Ligne[] }).coproprietes) expect(c).not.toHaveProperty('bureau')
    const filtre = await lireTableau(`?bureau=${NORD}`)
    expect(filtre.res.status).toBe(503)
    expect(filtre.corps).toEqual({ error: 'base_absente' })
  })
})

describe('non-régression de la visibilité (choix 5) : un gestionnaire voit exactement la même chose', () => {
  it('tableau d’un gestionnaire identique avec ou sans bureaux, sans aucune clé nouvelle ; ?bureau= lui est refusé (403)', async () => {
    connecterQr(COMPTE_G1)
    const sans = await lireTableau()
    expect(sans.res.status).toBe(200)
    poserBureaux()
    // Ses copropriétés et la « à tous » dans des bureaux différents, sa fiche dans un autre encore : rien ne change.
    Object.assign(ligne('signalements_qr_coproprietes', C1), { bureau_id: SUD })
    Object.assign(ligne('signalements_qr_coproprietes', C_TOUS), { bureau_id: NORD })
    Object.assign(ligne('signalements_qr_coproprietes', C2), { bureau_id: NORD })
    Object.assign(ligne('signalements_qr_gestionnaires', G1), { bureau_id: NORD })
    const avec = await lireTableau()
    expect(avec.corps).toEqual(sans.corps)
    expect(JSON.stringify(avec.corps)).not.toContain('bureau')
    const filtre = await lireTableau(`?bureau=${NORD}`)
    expect(filtre.res.status).toBe(403)
    expect(filtre.corps).toEqual({ error: 'interdit' })
  })

  it('les signalements d’une copropriété vus par lui : aucune clé de bureau', async () => {
    poserBureaux()
    Object.assign(ligne('signalements_qr_coproprietes', C1), { bureau_id: NORD })
    connecterQr(COMPTE_G1)
    const { corps } = await lireTableau()
    const tableau = corps.tableau as { coproprietes: Ligne[]; signalements: Ligne[] }
    expect(tableau.coproprietes.map((c) => c.id)).toContain(C1)
    expect(tableau.signalements.map((s) => s.id)).toContain(S1)
    expect(tableau.signalements.map((s) => s.id)).not.toContain(S2)
    expect(JSON.stringify(tableau)).not.toContain(NORD)
  })

  it('les routes des bureaux et les filtres du super admin lui sont fermés (403)', async () => {
    connecterQr(COMPTE_G1)
    expect((await LISTE(requeteQr(`/api/aj-signalement/gestionnaires?bureau=${NORD}`))).status).toBe(403)
    expect((await CABINETS(requeteQr('/api/aj-signalement/cabinets'))).status).toBe(403)
    expect(baseQr.etat.lectures.some((l) => l.table === 'signalements_qr_bureaux')).toBe(false)
  })
})
