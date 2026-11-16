// tests/storage-sync-onglets.test.ts — miroir localStorage <-> user_storage : deux onglets du même compte.
//
// Les onglets d'un navigateur partagent le localStorage mais pas la mémoire du miroir : chacun a ses envois et ses
// notes, et sa restauration (retour sur l'onglet, jeton rafraîchi : l'événement est diffusé à tous les onglets) écrit
// dans le navigateur pendant que les envois de l'autre sont en route. Ici, chaque onglet est une instance distincte du
// module (rechargé par vi.resetModules), et les deux travaillent sur le même localStorage.
//
// Relecture adverse du 16/11/2026 (quatrième passe) : la note gardée à la confirmation d'un envoi donnait raison au
// serveur dès que le navigateur ne détenait plus la dernière valeur écrite par cet onglet, sans distinguer l'ancienne
// valeur remise par la restauration d'un autre onglet (à ne jamais renvoyer) de la saisie plus récente faite dans un
// autre onglet (à garder). La relecture de l'onglet remplaçait alors cette saisie par une valeur plus ancienne ; si
// son envoi échouait, elle était perdue, et l'autre onglet renvoyait l'ancienne valeur par-dessus le serveur.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const mockGetSession = vi.fn()
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  },
}))

type ModuleSync = typeof import('@/lib/storage-sync')
type Issue = 'arrive' | 'reseau'

const COMPTE = '550e8400-e29b-41d4-a716-446655440000'
const CLIENTS = 'fixit_clients_a'
const b64 = (objet: unknown) => btoa(JSON.stringify(objet)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
const JETON = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: COMPTE, role: 'authenticated' })}.signature`

/** Liste de clients telle que l'application l'écrit : le nom avant l'identifiant. */
const liste = (...ids: number[]) => ids.map(id => ({ nom: `Client ${id}`, id }))

/** Postgres (jsonb) range les clés d'un objet par longueur puis par ordre des octets : l'ordre de l'application est perdu. */
function commeLaBase(valeur: unknown): unknown {
  if (Array.isArray(valeur)) return valeur.map(commeLaBase)
  if (valeur !== null && typeof valeur === 'object') {
    const objet = valeur as Record<string, unknown>
    const cles = Object.keys(objet).sort((a, b) => a.length - b.length || (a < b ? -1 : 1))
    return Object.fromEntries(cles.map(cle => [cle, commeLaBase(objet[cle])]))
  }
  return valeur
}

const reponse = (contenu: unknown) => new Response(JSON.stringify(contenu), { status: 200 })

/**
 * Faux /api/user-storage. `retenir` : les envois (POST, DELETE) attendent que le test les fasse arriver au serveur ou
 * échouer, dans l'ordre qu'il choisit. `retenirLectures` : une lecture (GET) prend la valeur du serveur à son arrivée,
 * mais sa réponse attend le test, comme sur un réseau lent.
 */
const serveur = {
  espace: {} as Record<string, unknown>,
  /** Valeurs postées pour la liste des clients, dans l'ordre des envois. */
  postees: [] as unknown[],
  retenir: false,
  retenus: [] as Array<(issue: Issue) => void>,
  retenirLectures: false,
  lecturesRetenues: [] as Array<() => void>,
}

const fauxFetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
  const methode = init?.method ?? 'GET'
  if (methode === 'GET') {
    const lue = reponse({ entries: commeLaBase(serveur.espace) })
    if (serveur.retenirLectures) await new Promise<void>((suite) => { serveur.lecturesRetenues.push(suite) })
    return lue
  }
  const corps = JSON.parse(String(init?.body)) as { entries?: Array<{ key: string; value: unknown }>; keys?: string[] }
  if (methode === 'POST') serveur.postees.push(...(corps.entries ?? []).filter(e => e.key === CLIENTS).map(e => e.value))
  if (serveur.retenir) {
    const issue = await new Promise<Issue>((suite) => { serveur.retenus.push(suite) })
    if (issue === 'reseau') throw new TypeError('Failed to fetch')
  }
  if (methode === 'POST') for (const e of corps.entries ?? []) serveur.espace[e.key] = commeLaBase(e.value)
  else for (const cle of corps.keys ?? []) delete serveur.espace[cle]
  return reponse({ success: true })
})

/** L'envoi retenu de rang `rang` (0 pour le premier parti) arrive au serveur, ou échoue faute de réseau. */
async function aboutir(rang: number, issue: Issue = 'arrive'): Promise<void> {
  serveur.retenus[rang](issue)
  await vi.advanceTimersByTimeAsync(0)
}

/** setItem d'origine, saisi avant que le miroir ne remplace celui de Storage.prototype. */
const setItemDOrigine = Storage.prototype.setItem
const onglets: ModuleSync[] = []
const originalFetch = globalThis.fetch

/** Ouvre un onglet : une instance du module à lui, posée puis restaurée depuis le serveur, comme le fait Providers. */
async function ouvrirUnOnglet(): Promise<ModuleSync> {
  vi.resetModules()
  const onglet = await import('@/lib/storage-sync')
  onglet.installStorageSync()
  onglets.push(onglet)
  await onglet.hydrateStorageFromServer()
  return onglet
}

/**
 * Saisie faite dans un onglet. L'interception de Storage.prototype ne sert que la dernière instance posée : la saisie
 * passe donc par le cœur du miroir de l'onglet, comme son setItem intercepté (valeur d'avant, écriture, miroir).
 */
function saisirDans(onglet: ModuleSync, cle: string, valeur: unknown): void {
  const texte = JSON.stringify(valeur)
  const avant = window.localStorage.getItem(cle)
  setItemDOrigine.call(window.localStorage, cle, texte)
  onglet.enregistrerEcritureMiroir(cle, texte, avant)
}

const lire = (cle: string): unknown => JSON.parse(window.localStorage.getItem(cle) ?? 'null')
const ecoulerDebounce = () => vi.advanceTimersByTimeAsync(1600)
/** Nouvel essai programmé après un envoi en échec : le délai, la relecture du serveur, puis l'envoi. */
async function nouvelEssai(): Promise<void> {
  await vi.advanceTimersByTimeAsync(5000)
  await ecoulerDebounce()
}
/** Chaque onglet relit le serveur (retour sur l'onglet), puis ce qui attend part. */
async function relireDansLesDeuxOnglets(A: ModuleSync, B: ModuleSync): Promise<void> {
  await A.hydrateStorageFromServer()
  await ecoulerDebounce()
  await B.hydrateStorageFromServer()
  await ecoulerDebounce()
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  window.localStorage.clear()
  serveur.espace = { [CLIENTS]: liste(1) }
  serveur.postees = []
  serveur.retenir = false
  serveur.retenus = []
  serveur.retenirLectures = false
  serveur.lecturesRetenues = []
  fauxFetch.mockClear()
  ;(globalThis as unknown as { fetch: typeof fetch }).fetch = fauxFetch as unknown as typeof fetch
  mockGetSession.mockResolvedValue({ data: { session: { access_token: JETON, user: { id: COMPTE } } }, error: null })
})

afterEach(() => {
  for (const onglet of onglets) onglet.reinitialiserMiroirPourTests()
  onglets.length = 0
  mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
  ;(globalThis as unknown as { fetch: typeof fetch }).fetch = originalFetch
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('une saisie faite dans un autre onglet pendant que deux envois de cet onglet se chevauchent', () => {
  /**
   * Onglet A : deux saisies de la même liste dont les envois se chevauchent (réseau lent), le premier arrive au
   * serveur. Onglet B, ouvert sur le même compte : une saisie plus récente de la même liste, `avant` ou `après` cette
   * arrivée. Puis A relit le serveur (retour sur A, jeton rafraîchi) avant l'arrivée de son second envoi.
   */
  async function saisieDeBPendantLesEnvoisDeA(moment: 'avant' | 'après'): Promise<{ A: ModuleSync; B: ModuleSync }> {
    const A = await ouvrirUnOnglet()
    const B = await ouvrirUnOnglet()
    serveur.retenir = true
    saisirDans(A, CLIENTS, liste(1, 2))
    await ecoulerDebounce() // envoi 0 (A), retenu
    saisirDans(A, CLIENTS, liste(1, 2, 3))
    await ecoulerDebounce() // envoi 1 (A), retenu
    if (moment === 'après') await aboutir(0)
    saisirDans(B, CLIENTS, liste(1, 2, 3, 4))
    await ecoulerDebounce() // envoi 2 (B), retenu
    if (moment === 'avant') await aboutir(0)
    expect(serveur.espace[CLIENTS]).toEqual(liste(1, 2))

    await A.hydrateStorageFromServer()
    // Avant : A remettait dans le navigateur la liste du serveur, à la place de la saisie de B.
    expect(lire(CLIENTS)).toEqual(liste(1, 2, 3, 4))
    return { A, B }
  }

  it.each(['avant', 'après'] as const)('B saisit %s l’arrivée du premier envoi de A, puis son envoi échoue : sa saisie arrive quand même au serveur', async (moment) => {
    const { A, B } = await saisieDeBPendantLesEnvoisDeA(moment)
    await aboutir(1) // le second envoi de A arrive
    await aboutir(2, 'reseau') // l'envoi de B échoue
    serveur.retenir = false
    await nouvelEssai()
    await relireDansLesDeuxOnglets(A, B)

    // Avant : le serveur revenait à liste(1, 2) — une valeur plus ancienne que celle de chaque onglet.
    expect(serveur.espace[CLIENTS]).toEqual(liste(1, 2, 3, 4))
    expect(lire(CLIENTS)).toEqual(liste(1, 2, 3, 4))
    expect(serveur.postees.filter(v => JSON.stringify(commeLaBase(v)) === JSON.stringify(commeLaBase(liste(1, 2))))).toHaveLength(1)
  })

  it('l’envoi de B arrive avant le second envoi de A : la saisie de B, la plus récente, reste celle du serveur', async () => {
    const { A, B } = await saisieDeBPendantLesEnvoisDeA('après')
    await aboutir(2) // l'envoi de B arrive
    await aboutir(1) // puis le second envoi de A, plus ancien que la saisie de B
    serveur.retenir = false
    await nouvelEssai()
    await relireDansLesDeuxOnglets(A, B)

    expect(serveur.espace[CLIENTS]).toEqual(liste(1, 2, 3, 4))
    expect(lire(CLIENTS)).toEqual(liste(1, 2, 3, 4))
  })

  it('réseau instable : le second envoi de A et celui de B échouent, la saisie de B arrive au nouvel essai', async () => {
    const A = await ouvrirUnOnglet()
    const B = await ouvrirUnOnglet()
    serveur.retenir = true
    saisirDans(A, CLIENTS, liste(1, 2))
    await ecoulerDebounce()
    saisirDans(A, CLIENTS, liste(1, 2, 3))
    await ecoulerDebounce()
    await aboutir(0) // le premier envoi de A arrive
    saisirDans(B, CLIENTS, liste(1, 2, 3, 4))
    await ecoulerDebounce()
    await aboutir(1, 'reseau') // le second envoi de A échoue
    await aboutir(2, 'reseau') // celui de B aussi
    serveur.retenir = false
    // A relit le serveur le premier et garde la saisie de B, puis l'envoie. B, lui, l'avait notée comme faite par-dessus
    // liste(1, 2, 3), que le serveur n'a jamais reçue : relisant le premier, il donnerait raison au serveur (limite
    // connue, écrite en tête du module).
    await nouvelEssai()
    await relireDansLesDeuxOnglets(A, B)

    expect(serveur.espace[CLIENTS]).toEqual(liste(1, 2, 3, 4))
    expect(lire(CLIENTS)).toEqual(liste(1, 2, 3, 4))
  })
})

describe('la restauration d’un autre onglet, lue avant l’arrivée d’un envoi, remet une valeur plus ancienne', () => {
  it('une seule saisie dans A, B relit le serveur avant son arrivée : l’ancienne valeur n’est jamais renvoyée', async () => {
    const A = await ouvrirUnOnglet()
    const B = await ouvrirUnOnglet()
    serveur.retenir = true
    saisirDans(A, CLIENTS, liste(1, 2))
    await ecoulerDebounce() // l'envoi de A part, retenu
    await B.hydrateStorageFromServer() // B relit le serveur, qui détient encore liste(1)
    expect(lire(CLIENTS)).toEqual(liste(1))
    serveur.retenir = false
    await aboutir(0) // l'envoi de A arrive
    await relireDansLesDeuxOnglets(A, B)

    expect(serveur.espace[CLIENTS]).toEqual(liste(1, 2))
    expect(lire(CLIENTS)).toEqual(liste(1, 2))
    expect(serveur.postees).toHaveLength(1)
  })

  /** Onglet A : trois saisies de la même liste dont les envois se chevauchent ; aucun n'est encore arrivé. */
  async function troisEnvoisDeAEnRoute(): Promise<{ A: ModuleSync; B: ModuleSync }> {
    const A = await ouvrirUnOnglet()
    const B = await ouvrirUnOnglet()
    serveur.retenir = true
    saisirDans(A, CLIENTS, liste(1, 2))
    await ecoulerDebounce()
    saisirDans(A, CLIENTS, liste(1, 2, 3))
    await ecoulerDebounce()
    saisirDans(A, CLIENTS, liste(1, 2, 3, 4))
    await ecoulerDebounce()
    expect(serveur.retenus).toHaveLength(3)
    return { A, B }
  }

  /**
   * Restauration d'un troisième onglet, qui a lu le serveur avant l'arrivée des envois en cause : elle écrit la liste
   * telle que le serveur la rend, sans passer par le miroir des onglets A et B.
   */
  const restaurationPerimee = (valeur: unknown) => setItemDOrigine.call(window.localStorage, CLIENTS, JSON.stringify(commeLaBase(valeur)))

  it('trois envois de A, un autre onglet remet la valeur d’origine avant l’arrivée du premier : elle n’est jamais renvoyée', async () => {
    const { A, B } = await troisEnvoisDeAEnRoute()
    restaurationPerimee(liste(1))
    await aboutir(0) // liste(1, 2) arrive
    await aboutir(1) // liste(1, 2, 3) arrive
    await A.hydrateStorageFromServer() // retour sur A avant l'arrivée du troisième
    expect(lire(CLIENTS)).toEqual(liste(1, 2, 3))
    await aboutir(2) // liste(1, 2, 3, 4) arrive
    serveur.retenir = false
    await relireDansLesDeuxOnglets(A, B)

    expect(serveur.espace[CLIENTS]).toEqual(liste(1, 2, 3, 4))
    expect(lire(CLIENTS)).toEqual(liste(1, 2, 3, 4))
    expect(serveur.postees).toHaveLength(3)
  })

  it('même cas, puis la page de A est rechargée avant l’arrivée du troisième : aucune note gardée ne fait renvoyer la valeur d’origine', async () => {
    const { A } = await troisEnvoisDeAEnRoute()
    restaurationPerimee(liste(1))
    await aboutir(0)
    await aboutir(1)
    await vi.advanceTimersByTimeAsync(3000) // délai de l'état gardé dans le navigateur
    A.reinitialiserMiroirPourTests() // la page de A est rechargée : son troisième envoi reste en route
    await ouvrirUnOnglet()
    await ecoulerDebounce()

    expect(lire(CLIENTS)).toEqual(liste(1, 2, 3))
    expect(serveur.postees).toHaveLength(3)
    serveur.retenir = false
    await aboutir(2)
    expect(serveur.espace[CLIENTS]).toEqual(liste(1, 2, 3, 4))
  })

  it('trois envois de A, un autre onglet remet la valeur d’origine après l’arrivée du deuxième : A relit, elle n’est pas renvoyée', async () => {
    const { A, B } = await troisEnvoisDeAEnRoute()
    await aboutir(0) // liste(1, 2) arrive
    await aboutir(1) // liste(1, 2, 3) arrive
    restaurationPerimee(liste(1))
    await A.hydrateStorageFromServer()
    expect(lire(CLIENTS)).toEqual(liste(1, 2, 3))
    await aboutir(2)
    serveur.retenir = false
    await relireDansLesDeuxOnglets(A, B)

    expect(serveur.espace[CLIENTS]).toEqual(liste(1, 2, 3, 4))
    expect(serveur.postees).toHaveLength(3)
  })

  // A note comme valeur du serveur ce que le navigateur détenait avant sa saisie : ici la saisie de B, encore en route.
  // La valeur que le serveur détenait vraiment, A la connaît par sa dernière restauration.
  it('A saisit par-dessus une saisie de B encore en route, un troisième onglet remet la valeur d’origine : elle n’est pas renvoyée', async () => {
    const A = await ouvrirUnOnglet()
    const B = await ouvrirUnOnglet()
    serveur.retenir = true
    saisirDans(B, CLIENTS, liste(1, 9))
    await ecoulerDebounce() // envoi 0 (B)
    saisirDans(A, CLIENTS, liste(1, 9, 2))
    await ecoulerDebounce() // envoi 1 (A)
    saisirDans(A, CLIENTS, liste(1, 9, 2, 3))
    await ecoulerDebounce() // envoi 2 (A)
    restaurationPerimee(liste(1))
    await aboutir(0) // la saisie de B arrive
    await aboutir(1) // la première de A arrive
    await A.hydrateStorageFromServer()
    expect(lire(CLIENTS)).toEqual(liste(1, 9, 2))
    await aboutir(2)
    serveur.retenir = false
    await relireDansLesDeuxOnglets(A, B)

    expect(serveur.espace[CLIENTS]).toEqual(liste(1, 9, 2, 3))
    expect(lire(CLIENTS)).toEqual(liste(1, 9, 2, 3))
    expect(serveur.postees).toHaveLength(3)
  })

  // Une saisie plus récente écrite dans cet onglet a été remplacée, mais par une valeur que le serveur détenait avant :
  // la note ne doit pas la faire renvoyer, même quand plus rien n'est à confirmer pour la dernière saisie de A.
  it('trois envois de A, B relit entre l’arrivée du premier et celle du deuxième : la valeur intermédiaire n’est jamais renvoyée', async () => {
    const { A, B } = await troisEnvoisDeAEnRoute()
    await aboutir(0) // liste(1, 2) arrive
    await B.hydrateStorageFromServer() // B relit liste(1, 2) et l'écrit à la place de la dernière saisie de A
    expect(lire(CLIENTS)).toEqual(liste(1, 2))
    await aboutir(1) // liste(1, 2, 3) arrive
    await aboutir(2) // liste(1, 2, 3, 4) arrive
    serveur.retenir = false
    await relireDansLesDeuxOnglets(A, B)

    expect(serveur.espace[CLIENTS]).toEqual(liste(1, 2, 3, 4))
    expect(lire(CLIENTS)).toEqual(liste(1, 2, 3, 4))
    expect(serveur.postees).toHaveLength(3)
  })

  it('trois envois de A, B a lu le serveur avant l’arrivée du deuxième et l’écrit après : A relit, la valeur intermédiaire n’est pas renvoyée', async () => {
    const { A, B } = await troisEnvoisDeAEnRoute()
    await aboutir(0) // liste(1, 2) arrive
    serveur.retenirLectures = true
    const lectureDeB = B.hydrateStorageFromServer() // B lit liste(1, 2), sa réponse tarde
    await vi.advanceTimersByTimeAsync(0)
    await aboutir(1) // liste(1, 2, 3) arrive, A le sait
    serveur.lecturesRetenues[0]() // la réponse de B arrive : il écrit liste(1, 2)
    await lectureDeB
    serveur.retenirLectures = false
    expect(lire(CLIENTS)).toEqual(liste(1, 2))

    await A.hydrateStorageFromServer() // le serveur détient liste(1, 2, 3)
    expect(lire(CLIENTS)).toEqual(liste(1, 2, 3))
    await aboutir(2) // liste(1, 2, 3, 4) arrive
    serveur.retenir = false
    await relireDansLesDeuxOnglets(A, B)

    expect(serveur.espace[CLIENTS]).toEqual(liste(1, 2, 3, 4))
    expect(lire(CLIENTS)).toEqual(liste(1, 2, 3, 4))
    expect(serveur.postees).toHaveLength(3)
  })
})
