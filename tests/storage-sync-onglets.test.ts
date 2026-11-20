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
//
// Relecture adverse du 16/11/2026 (cinquième passe) : la retouche renvoyait depuis cet onglet toute valeur qu'il ne
// reconnaissait pas, la tenant pour la saisie d'un autre onglet. Or la restauration d'un autre onglet écrit aussi des
// valeurs que cet onglet n'a jamais connues — la saisie plus ancienne de cet autre onglet, une valeur venue d'un autre
// appareil, la valeur d'origine après plusieurs confirmations — et la dernière saisie était écrasée au serveur. Une clé
// vidée hors de l'application faisait partir une suppression, et après un rechargement, n'importe quelle valeur du
// navigateur repartait. Seule la modification écrite par l'onglet, ou notée par lui dans l'état, repart désormais ; une
// valeur inconnue est laissée en place une fois, sans repartir d'ici. Les scénarios viennent du banc du relecteur.
//
// Relecture adverse du 17/11/2026 (sixième passe) : une saisie en attente de son nouvel essai repartait dès que le
// navigateur détenait le texte du serveur, tenu pour l'œuvre d'une restauration. Or l'utilisateur peut l'y avoir remis
// lui-même, dans un autre onglet (réglage remis, client ajouté puis retiré) : son retour en arrière était défait quelques
// secondes plus tard, au serveur et dans le navigateur, y compris par un onglet qui avait seulement pris la saisie en
// charge. À l'inverse, une saisie en attente que la restauration lente d'un autre onglet avait remplacée par une valeur
// plus ancienne était abandonnée, comme une suppression en attente que la restauration d'un autre onglet avait annulée.
// La restauration marque désormais les valeurs qu'elle remplace : seule une saisie ainsi remplacée repart, et toute
// écriture faite ensuite dans un onglet efface la marque.
//
// Contre-relecture du 17/11/2026 (septième passe) : un onglet qui s'ouvre réécrit souvent au montage la valeur qu'il lit
// — la modification d'un autre onglet, en attente de son nouvel essai — avant que sa restauration ne réponde. Cette
// restauration ne marquait pas un texte que son onglet avait écrit lui-même : la modification était perdue. Elle ne
// laisse plus de côté que le texte que son onglet a synchronisé. Une suppression en échec, de son côté, n'était remise
// en attente que si la clé restait absente du navigateur : remise par la restauration d'un autre onglet pendant
// l'envoi, elle était abandonnée. Elle attend désormais la relecture du nouvel essai, qui tranche, et ne repart jamais
// pour une clé que le serveur n'a plus. Enfin, la restauration d'un onglet qui n'avait jamais vu une clé ne marquait pas
// sa disparition : la suppression qui y attendait son nouvel essai était abandonnée.
//
// Contre-relecture du 17/11/2026 (huitième passe) : une suppression en échec repartait sans contrôle quand une relecture
// de son propre onglet, faite pendant l'envoi, l'avait déjà tenue pour faite (clé absente du serveur) ; elle effaçait du
// serveur la liste recréée entre-temps, dans un autre onglet ou sur un autre appareil. Elle n'est plus remise en attente
// sans sa note. Une restauration qui marquait plus de cinquante clés à la fois ne gardait que les dernières, toutes
// sortes confondues : les marques de clés absentes (créées ailleurs) faisaient sauter celle d'une saisie remplacée, ou
// les marques de textes remplacés celle d'une suppression, et la modification était perdue au nouvel essai. Chaque
// sorte de marque a désormais sa propre limite.
//
// Contre-relecture du 17/11/2026 (neuvième passe) : la confirmation d'une saisie levait la note de la clé quand la
// suppression faite juste après elle dans le même onglet était encore en route, si la restauration d'un onglet neuf
// avait entre-temps remis dans le navigateur une valeur que le serveur avait détenue : en échec ensuite, la suppression
// était perdue (correctif retiré à la onzième passe : limite écrite en tête du module). Dans un stockage plein, la note
// des remplacements, qui peut garder cent marques, ne s'écrivait plus dès qu'elle devait grandir : la saisie remplacée
// par la restauration d'un onglet neuf était perdue (correctif retiré à la dixième passe : limite écrite en tête du
// module). Aucun test, enfin, ne vérifiait la limite de cinquante marques par sorte.
//
// Contre-relecture du 17/11/2026 (dixième passe) : la confirmation d'une saisie recréait la note de la clé quand la
// suppression faite ensuite dans le même onglet était déjà confirmée ; la saisie suivante de l'onglet la gardait comme
// valeur d'avant et, en échec, était perdue alors que le serveur détenait la valeur qu'elle avait remplacée. Dans un
// stockage plein, la note des remplacements réduite à ses cinquante marques les plus récentes, toutes sortes
// confondues, chassait la marque d'une saisie en attente au profit d'une marque qui ne servait à rien : ce second essai
// est retiré, et une note qui devrait grandir n'est plus réécrite, comme avant la neuvième passe.
//
// Contre-relecture du 17/11/2026 (onzième passe) : garder la note d'une suppression encore en route à la confirmation
// de la saisie plus ancienne (correctif DCF2 des neuvième et dixième passes) faisait de cette saisie la valeur d'avant
// de la saisie ou de la suppression suivante de l'onglet. Quand l'ancienne liste était revenue au serveur avant cette
// nouvelle action (réécrite par l'onglet neuf à son ouverture, ou remise ailleurs), celle-ci cédait au nouvel essai
// sans partir, ou sans repartir si son premier envoi avait échoué. Le correctif est retiré et le code du module
// redevient celui de la huitième passe : la suppression perdue est une limite écrite en tête du module, les deux tests
// du correctif sont retirés, et un test garde la nouvelle saisie.

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
type Issue = 'arrive' | 'reseau' | 'perdue' | 'sansReponse'

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
 * mais sa réponse attend le test, comme sur un réseau lent. `reponses` : réponses des envois arrivés « sansReponse »,
 * encore en route, que le test fait revenir ou perdre (repondre).
 */
const serveur = {
  espace: {} as Record<string, unknown>,
  /** Valeurs postées pour la liste des clients, dans l'ordre des envois. */
  postees: [] as unknown[],
  retenir: false,
  retenus: [] as Array<(issue: Issue) => void>,
  reponses: [] as Array<(issue: 'arrive' | 'reseau') => void>,
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
  let issue: Issue = 'arrive'
  if (serveur.retenir) {
    issue = await new Promise<Issue>((suite) => { serveur.retenus.push(suite) })
    if (issue === 'reseau') throw new TypeError('Failed to fetch')
  }
  if (methode === 'POST') for (const e of corps.entries ?? []) serveur.espace[e.key] = commeLaBase(e.value)
  else for (const cle of corps.keys ?? []) delete serveur.espace[cle]
  // Réponse perdue : l'envoi est arrivé au serveur, mais l'onglet ne le sait pas (coupure juste après l'envoi).
  if (issue === 'perdue') throw new TypeError('Failed to fetch')
  // Réponse en route : l'envoi est arrivé au serveur, sa réponse attend le test, qui la fait revenir ou se perdre.
  if (issue === 'sansReponse') {
    const fin = await new Promise<'arrive' | 'reseau'>((suite) => { serveur.reponses.push(suite) })
    if (fin === 'reseau') throw new TypeError('Failed to fetch')
  }
  return reponse({ success: true })
})

/**
 * L'envoi retenu de rang `rang` (0 pour le premier parti) arrive au serveur, échoue faute de réseau, arrive sans que sa
 * réponse ne revienne (`perdue`), ou arrive avec une réponse encore en route (`sansReponse`, voir repondre).
 */
async function aboutir(rang: number, issue: Issue = 'arrive'): Promise<void> {
  serveur.retenus[rang](issue)
  await vi.advanceTimersByTimeAsync(0)
}

/** La réponse de rang `rang` d'un envoi arrivé « sansReponse » revient à l'onglet (`arrive`) ou se perd (`reseau`). */
async function repondre(rang: number, issue: 'arrive' | 'reseau'): Promise<void> {
  serveur.reponses[rang](issue)
  await vi.advanceTimersByTimeAsync(0)
}

/** Les envois retenus à partir du rang `de` arrivent au serveur dans l'ordre, y compris ceux qui partent entre-temps. */
async function toutLiberer(de: number): Promise<void> {
  serveur.retenir = false
  for (let rang = de; rang < serveur.retenus.length; rang++) await aboutir(rang)
}

/**
 * Restauration d'un onglet qui lit le serveur maintenant, sur un réseau lent : elle n'écrit ce qu'elle a lu dans le
 * navigateur qu'à l'appel de la fonction rendue.
 */
async function restaurationRetardee(onglet: ModuleSync): Promise<() => Promise<void>> {
  serveur.retenirLectures = true
  const restauration = onglet.hydrateStorageFromServer()
  await vi.advanceTimersByTimeAsync(0)
  serveur.retenirLectures = false
  const rang = serveur.lecturesRetenues.length - 1
  return async () => {
    serveur.lecturesRetenues[rang]()
    await restauration
  }
}

/** setItem d'origine, saisi avant que le miroir ne remplace celui de Storage.prototype. */
const setItemDOrigine = Storage.prototype.setItem
const removeItemDOrigine = Storage.prototype.removeItem
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

/** Réglage écrit tel quel, comme fixit_pro_team_role : le texte du navigateur est celui que rend le serveur. */
function saisirTexteDans(onglet: ModuleSync, cle: string, texte: string): void {
  const avant = window.localStorage.getItem(cle)
  setItemDOrigine.call(window.localStorage, cle, texte)
  onglet.enregistrerEcritureMiroir(cle, texte, avant)
}

/** Suppression faite dans un onglet, par le cœur du miroir de cet onglet (voir saisirDans). */
function supprimerDans(onglet: ModuleSync, cle: string): void {
  const avant = window.localStorage.getItem(cle)
  removeItemDOrigine.call(window.localStorage, cle)
  onglet.enregistrerSuppressionMiroir(cle, avant)
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
  serveur.reponses = []
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

  // Le second envoi de A, plus ancien que la saisie de B, arrive au serveur le dernier : le serveur le garde, comme avant
  // ce miroir. A ne renvoie pas la saisie de B : il ne la distingue pas d'une valeur plus ancienne qu'une restauration
  // aurait remise dans le navigateur, et la renvoyer écraserait alors la dernière saisie (cinquième relecture, plus bas).
  it('l’envoi de B arrive avant le second envoi de A : le serveur garde le dernier arrivé, et A ne renvoie rien qu’il n’a pas écrit', async () => {
    const { A, B } = await saisieDeBPendantLesEnvoisDeA('après')
    await aboutir(2) // l'envoi de B arrive
    await aboutir(1) // puis le second envoi de A, plus ancien que la saisie de B
    serveur.retenir = false
    await nouvelEssai()
    await relireDansLesDeuxOnglets(A, B)

    expect(serveur.espace[CLIENTS]).toEqual(liste(1, 2, 3))
    expect(lire(CLIENTS)).toEqual(liste(1, 2, 3))
    expect(serveur.postees).toHaveLength(3)
  })

  it('réseau instable : le second envoi de A et celui de B échouent ; aucun onglet ne renvoie une valeur qu’il n’a pas écrite', async () => {
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
    // A relit le serveur le premier : la saisie de B, qu'il ne connaît pas, reste en place, sans repartir de A. B l'avait
    // faite par-dessus liste(1, 2, 3), que le serveur n'a jamais reçue, et n'a jamais vu liste(1, 2) : à son nouvel essai,
    // il donne raison au serveur et sa saisie est perdue, comme avant ce miroir (limite écrite en tête du module).
    // La renvoyer depuis A rattraperait ce cas, mais renverrait aussi, dans d'autres, une valeur plus ancienne.
    await nouvelEssai()
    await relireDansLesDeuxOnglets(A, B)

    expect(serveur.espace[CLIENTS]).toEqual(liste(1, 2))
    expect(lire(CLIENTS)).toEqual(liste(1, 2))
    expect(serveur.postees).toHaveLength(3)
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

// Cinquième relecture : chaque scénario finissait, avant, sur une valeur plus ancienne que la dernière saisie, renvoyée
// par l'onglet A au serveur.
describe('la restauration d’un autre onglet remet une valeur que cet onglet n’a jamais connue', () => {
  it('B écrit sa propre saisie, arrivée avant la première de A et relue avant la confirmation de celle-ci : A ne la renvoie pas', async () => {
    const A = await ouvrirUnOnglet()
    const B = await ouvrirUnOnglet()
    serveur.retenir = true
    saisirDans(A, CLIENTS, liste(1, 2))
    await ecoulerDebounce() // envoi 0 (A)
    saisirDans(B, CLIENTS, liste(1, 5))
    await ecoulerDebounce() // envoi 1 (B)
    saisirDans(A, CLIENTS, liste(1, 2, 3))
    await ecoulerDebounce() // envoi 2 (A)
    await aboutir(1) // la saisie de B arrive la première
    const ecrireLaLectureDeB = await restaurationRetardee(B) // B relit sa propre saisie, sa réponse tarde
    await aboutir(0) // la première saisie de A arrive, A le sait
    await ecrireLaLectureDeB() // B écrit sa saisie, plus ancienne que celle que le serveur vient d'enregistrer
    expect(lire(CLIENTS)).toEqual(liste(1, 5))

    await A.hydrateStorageFromServer() // retour sur A avant l'arrivée de sa dernière saisie
    await ecoulerDebounce()
    await toutLiberer(2)
    await relireDansLesDeuxOnglets(A, B)

    expect(serveur.espace[CLIENTS]).toEqual(liste(1, 2, 3))
    expect(lire(CLIENTS)).toEqual(liste(1, 2, 3))
    expect(serveur.postees).toHaveLength(3)
  })

  it('même cas, puis la dernière saisie de A échoue : la valeur laissée en place cède à la relecture suivante', async () => {
    const A = await ouvrirUnOnglet()
    const B = await ouvrirUnOnglet()
    serveur.retenir = true
    saisirDans(A, CLIENTS, liste(1, 2))
    await ecoulerDebounce()
    saisirDans(B, CLIENTS, liste(1, 5))
    await ecoulerDebounce()
    saisirDans(A, CLIENTS, liste(1, 2, 3))
    await ecoulerDebounce()
    await aboutir(1)
    const ecrireLaLectureDeB = await restaurationRetardee(B)
    await aboutir(0)
    await ecrireLaLectureDeB()

    await A.hydrateStorageFromServer()
    await ecoulerDebounce()
    expect(lire(CLIENTS)).toEqual(liste(1, 5)) // laissée en place pour cette relecture, sans repartir de A
    await aboutir(2, 'reseau') // la dernière saisie de A échoue : effacée du navigateur, elle est perdue, comme avant
    serveur.retenir = false
    await nouvelEssai() // le nouvel essai commence par relire le serveur

    expect(lire(CLIENTS)).toEqual(liste(1, 2))
    expect(serveur.espace[CLIENTS]).toEqual(liste(1, 2))
    expect(serveur.postees).toHaveLength(3)
  })

  it('B écrit une valeur venue d’un autre appareil, lue avant les saisies de A : A ne la renvoie pas', async () => {
    const A = await ouvrirUnOnglet()
    const B = await ouvrirUnOnglet()
    serveur.espace[CLIENTS] = commeLaBase(liste(1, 7)) // écrite depuis un autre appareil, A ne l'a pas relue
    const ecrireLaLectureDeB = await restaurationRetardee(B)
    serveur.retenir = true
    saisirDans(A, CLIENTS, liste(1, 2))
    await ecoulerDebounce()
    saisirDans(A, CLIENTS, liste(1, 2, 3))
    await ecoulerDebounce()
    await aboutir(0) // la première saisie de A arrive
    await ecrireLaLectureDeB()
    expect(lire(CLIENTS)).toEqual(liste(1, 7))

    await A.hydrateStorageFromServer()
    await ecoulerDebounce()
    await toutLiberer(1)
    await relireDansLesDeuxOnglets(A, B)

    expect(serveur.espace[CLIENTS]).toEqual(liste(1, 2, 3))
    expect(lire(CLIENTS)).toEqual(liste(1, 2, 3))
    expect(serveur.postees).toHaveLength(2)
  })

  it('six envois de A, B écrit après cinq confirmations la valeur lue avant tout : elle n’est jamais renvoyée', async () => {
    const A = await ouvrirUnOnglet()
    const B = await ouvrirUnOnglet()
    const ecrireLaLectureDeB = await restaurationRetardee(B) // B lit liste(1)
    serveur.retenir = true
    const saisies = [2, 3, 4, 5, 6, 7].map(n => liste(...Array.from({ length: n }, (_, rang) => rang + 1)))
    for (const saisie of saisies) {
      saisirDans(A, CLIENTS, saisie)
      await ecoulerDebounce()
    }
    for (let rang = 0; rang < 5; rang++) await aboutir(rang)
    await vi.advanceTimersByTimeAsync(3000) // la note de A est réécrite dans le navigateur
    await ecrireLaLectureDeB()

    await A.hydrateStorageFromServer()
    await ecoulerDebounce()
    await toutLiberer(5)
    await relireDansLesDeuxOnglets(A, B)

    // Avant : au-delà de quatre confirmations, la valeur d'origine n'était plus reconnue et repartait.
    expect(serveur.espace[CLIENTS]).toEqual(saisies[5])
    expect(lire(CLIENTS)).toEqual(saisies[5])
    expect(serveur.postees).toHaveLength(6)
  })

  it('saisie de A encore en route, B écrit une valeur plus ancienne que celle que A a relue : A ne la renvoie pas', async () => {
    serveur.espace[CLIENTS] = commeLaBase(liste(0))
    const A = await ouvrirUnOnglet()
    const B = await ouvrirUnOnglet()
    const ecrireLaLectureDeB = await restaurationRetardee(B) // B lit liste(0)
    serveur.espace[CLIENTS] = commeLaBase(liste(1)) // un autre appareil écrit liste(1)
    await A.hydrateStorageFromServer() // A la relit
    serveur.retenir = true
    saisirDans(A, CLIENTS, liste(1, 2))
    await ecoulerDebounce() // la saisie de A part
    await ecrireLaLectureDeB() // B écrit liste(0)

    await A.hydrateStorageFromServer()
    await ecoulerDebounce()
    await toutLiberer(0)
    await relireDansLesDeuxOnglets(A, B)

    expect(serveur.espace[CLIENTS]).toEqual(liste(1, 2))
    expect(lire(CLIENTS)).toEqual(liste(1, 2))
    expect(serveur.postees).toHaveLength(1)
  })

  it('trois envois de A, B écrit après deux confirmations la valeur lue avant tout, puis la page de A est rechargée : elle n’est pas renvoyée', async () => {
    const A = await ouvrirUnOnglet()
    const B = await ouvrirUnOnglet()
    const ecrireLaLectureDeB = await restaurationRetardee(B) // B lit liste(1)
    serveur.retenir = true
    saisirDans(A, CLIENTS, liste(1, 2))
    await ecoulerDebounce()
    saisirDans(A, CLIENTS, liste(1, 2, 3))
    await ecoulerDebounce()
    saisirDans(A, CLIENTS, liste(1, 2, 3, 4))
    await ecoulerDebounce()
    await aboutir(0)
    await aboutir(1)
    await vi.advanceTimersByTimeAsync(3000) // la note de A est écrite dans le navigateur
    await ecrireLaLectureDeB()
    window.dispatchEvent(new Event('beforeunload'))
    A.reinitialiserMiroirPourTests() // la page de A est rechargée : son troisième envoi reste en route
    const pageDeA = await ouvrirUnOnglet()
    await ecoulerDebounce()

    // Avant : la note gardée dans le navigateur faisait renvoyer liste(1), quelle que soit la valeur qu'elle protégeait.
    expect(lire(CLIENTS)).toEqual(liste(1, 2, 3))
    await toutLiberer(2)
    await relireDansLesDeuxOnglets(pageDeA, B)
    expect(serveur.espace[CLIENTS]).toEqual(liste(1, 2, 3, 4))
    expect(lire(CLIENTS)).toEqual(liste(1, 2, 3, 4))
    expect(serveur.postees).toHaveLength(3)
  })
})

describe('la clé disparaît du navigateur sans suppression faite par l’application (stockage vidé depuis le navigateur)', () => {
  it.each(['avant', 'après'] as const)('vidé %s la première confirmation de trois envois : la relecture remet la valeur du serveur, aucune suppression ne part', async (moment) => {
    const A = await ouvrirUnOnglet()
    serveur.retenir = true
    saisirDans(A, CLIENTS, liste(1, 2))
    await ecoulerDebounce()
    saisirDans(A, CLIENTS, liste(1, 2, 3))
    await ecoulerDebounce()
    saisirDans(A, CLIENTS, liste(1, 2, 3, 4))
    await ecoulerDebounce()
    if (moment === 'après') await aboutir(0)
    window.localStorage.clear() // outils du navigateur ou extension : aucune suppression interceptée
    if (moment === 'avant') await aboutir(0)
    await aboutir(1)

    await A.hydrateStorageFromServer() // la session est toujours valable
    await ecoulerDebounce()
    expect(lire(CLIENTS)).toEqual(liste(1, 2, 3))
    await toutLiberer(2)
    await A.hydrateStorageFromServer()

    // Avant : la clé absente passait pour une suppression faite dans un autre onglet, et la suppression partait.
    expect(serveur.espace[CLIENTS]).toEqual(liste(1, 2, 3, 4))
    expect(lire(CLIENTS)).toEqual(liste(1, 2, 3, 4))
    expect(fauxFetch.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(0)
  })

  it('vidé pendant le seul envoi d’une saisie, relu avant sa confirmation : la valeur du serveur est remise, aucune suppression ne part', async () => {
    const A = await ouvrirUnOnglet()
    serveur.retenir = true
    saisirDans(A, CLIENTS, liste(1, 2))
    await ecoulerDebounce() // la saisie part
    window.localStorage.clear()

    await A.hydrateStorageFromServer()
    await ecoulerDebounce()
    // Avant : la clé absente était prise pour une suppression faite ici, renvoyée après la saisie.
    expect(lire(CLIENTS)).toEqual(liste(1))
    await toutLiberer(0)
    await A.hydrateStorageFromServer()

    expect(serveur.espace[CLIENTS]).toEqual(liste(1, 2))
    expect(lire(CLIENTS)).toEqual(liste(1, 2))
    expect(fauxFetch.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(0)
  })
})

describe('saisie faite dans A par-dessus celle de B encore en route, puis les deux envois échouent', () => {
  it.each(['A', 'B'] as const)('l’envoi de %s échoue le premier : la saisie de A arrive au nouvel essai', async (premier) => {
    const A = await ouvrirUnOnglet()
    const B = await ouvrirUnOnglet()
    serveur.retenir = true
    saisirDans(B, CLIENTS, liste(1, 5))
    await ecoulerDebounce() // envoi 0 (B)
    saisirDans(A, CLIENTS, liste(1, 5, 2))
    await ecoulerDebounce() // envoi 1 (A), fait par-dessus la saisie de B
    await aboutir(premier === 'A' ? 1 : 0, 'reseau')
    await vi.advanceTimersByTimeAsync(1000)
    await aboutir(premier === 'A' ? 0 : 1, 'reseau')
    serveur.retenir = false
    // Nouveaux essais : chaque onglet relit le serveur, qui détient encore liste(1), puis ce qui attend part. A a pris
    // pour valeur d'avant la saisie de B, que le serveur n'a jamais reçue ; il retient aussi la dernière valeur qu'il a
    // synchronisée. Avant : relisant le premier, A donnait raison au serveur, et les deux saisies étaient perdues.
    await vi.advanceTimersByTimeAsync(7000)
    await ecoulerDebounce()
    await relireDansLesDeuxOnglets(A, B)

    expect(serveur.espace[CLIENTS]).toEqual(liste(1, 5, 2))
    expect(lire(CLIENTS)).toEqual(liste(1, 5, 2))
  })
})

describe('saisie remise en attente après un envoi en échec, puis remplacée par la restauration d’un autre onglet', () => {
  /** A saisit, son envoi échoue (la saisie attend le nouvel essai) ; B relit et remet la valeur du serveur à sa place. */
  async function saisieEnAttenteRemplacee(): Promise<{ A: ModuleSync; B: ModuleSync }> {
    const A = await ouvrirUnOnglet()
    const B = await ouvrirUnOnglet()
    serveur.retenir = true
    saisirDans(A, CLIENTS, liste(1, 2))
    await ecoulerDebounce()
    await aboutir(0, 'reseau')
    serveur.retenir = false
    await B.hydrateStorageFromServer()
    expect(lire(CLIENTS)).toEqual(liste(1))
    return { A, B }
  }

  it('serveur inchangé : au nouvel essai, la saisie est remise dans le navigateur et part', async () => {
    const { A, B } = await saisieEnAttenteRemplacee()
    await nouvelEssai()

    // Avant : la relecture qui ouvre le nouvel essai trouvait la valeur du serveur en place et abandonnait la saisie.
    expect(serveur.espace[CLIENTS]).toEqual(liste(1, 2))
    expect(lire(CLIENTS)).toEqual(liste(1, 2))
    await relireDansLesDeuxOnglets(A, B)
    expect(serveur.espace[CLIENTS]).toEqual(liste(1, 2))
    expect(serveur.postees).toHaveLength(2)
  })

  it('un autre appareil a écrit entre-temps : le serveur gagne, la saisie ne part pas', async () => {
    const { A, B } = await saisieEnAttenteRemplacee()
    serveur.espace[CLIENTS] = commeLaBase(liste(1, 9))
    await nouvelEssai()
    await relireDansLesDeuxOnglets(A, B)

    expect(serveur.espace[CLIENTS]).toEqual(liste(1, 9))
    expect(lire(CLIENTS)).toEqual(liste(1, 9))
    expect(serveur.postees).toHaveLength(1)
  })

  it('la clé a disparu du serveur entre-temps : l’ancienne valeur remise par B ne part pas à la place de la saisie', async () => {
    const NOTE = 'fixit_note_a'
    serveur.espace[NOTE] = 'version 1'
    const A = await ouvrirUnOnglet()
    const B = await ouvrirUnOnglet()
    serveur.retenir = true
    saisirDans(A, NOTE, 'version 2')
    await ecoulerDebounce()
    await aboutir(0, 'reseau') // l'envoi échoue : la saisie attend le nouvel essai
    serveur.retenir = false
    await B.hydrateStorageFromServer() // B remet « version 1 » dans le navigateur
    delete serveur.espace[NOTE] // un autre appareil supprime la clé
    await nouvelEssai()

    // Avant : la relecture renvoyait la valeur du navigateur, quelle qu'elle soit, pour une clé absente du serveur. La
    // saisie en attente part, elle, comme avant ce miroir.
    expect(serveur.espace[NOTE]).toBe('version 2')
    await relireDansLesDeuxOnglets(A, B)
    expect(serveur.espace[NOTE]).toBe('version 2')
    expect(window.localStorage.getItem(NOTE)).toBe('version 2')
  })
})

// Relecture adverse du 17/11/2026 (sixième passe), scénarios N2P, T3cP et R3P du banc du relecteur : le navigateur
// détient le texte du serveur à la place de la saisie en attente de A. Une restauration l'y a remis (la saisie doit
// repartir), ou l'utilisateur lui-même, dans un autre onglet (son choix doit l'emporter) : seule la marque laissée par la
// restauration les distingue. Réglage écrit tel quel : le texte du navigateur est celui que rend le serveur.
describe('saisie en attente remplacée par le texte du serveur : seule une restauration la fait repartir', () => {
  const REGLAGE = 'fixit_reglage_a'

  /** Le réglage vaut « non » ; dans A, l'utilisateur le met à « oui », l'envoi échoue : la saisie attend son nouvel essai. */
  async function reglageEnAttente(): Promise<{ A: ModuleSync; B: ModuleSync }> {
    serveur.espace[REGLAGE] = 'non'
    const A = await ouvrirUnOnglet()
    const B = await ouvrirUnOnglet()
    serveur.retenir = true
    saisirTexteDans(A, REGLAGE, 'oui')
    await ecoulerDebounce()
    await aboutir(0, 'reseau')
    serveur.retenir = false
    return { A, B }
  }

  it('B relit le serveur (retour sur l’onglet) : au nouvel essai, la saisie de A est remise et part', async () => {
    const { A, B } = await reglageEnAttente()
    await B.hydrateStorageFromServer()
    expect(window.localStorage.getItem(REGLAGE)).toBe('non')
    await nouvelEssai()
    await relireDansLesDeuxOnglets(A, B)

    expect(serveur.espace[REGLAGE]).toBe('oui')
    expect(window.localStorage.getItem(REGLAGE)).toBe('oui')
  })

  it('dans B, l’utilisateur remet « non » (rien ne part de B, qui avait déjà cette valeur) : son choix l’emporte', async () => {
    const { A, B } = await reglageEnAttente()
    saisirTexteDans(B, REGLAGE, 'non')
    await ecoulerDebounce()
    await nouvelEssai()
    await relireDansLesDeuxOnglets(A, B)

    // Avant : au nouvel essai, A remettait « oui » dans le navigateur et le renvoyait.
    expect(serveur.espace[REGLAGE]).toBe('non')
    expect(window.localStorage.getItem(REGLAGE)).toBe('non')
  })

  it('dans B, l’utilisateur passe par « peut-être » puis revient à « non » (envois arrivés) : son retour l’emporte', async () => {
    const { A, B } = await reglageEnAttente()
    saisirTexteDans(B, REGLAGE, 'peut-etre')
    await ecoulerDebounce()
    saisirTexteDans(B, REGLAGE, 'non')
    await ecoulerDebounce()
    expect(serveur.espace[REGLAGE]).toBe('non')
    await nouvelEssai()
    await relireDansLesDeuxOnglets(A, B)

    expect(serveur.espace[REGLAGE]).toBe('non')
    expect(window.localStorage.getItem(REGLAGE)).toBe('non')
  })

  it('B relit, puis l’utilisateur choisit dans B « non », la valeur déjà en place : son choix l’emporte', async () => {
    const { A, B } = await reglageEnAttente()
    await B.hydrateStorageFromServer() // la restauration de B remplace « oui » par « non » et le marque
    saisirTexteDans(B, REGLAGE, 'non') // B affichait encore « oui » : l'utilisateur choisit « non »
    await ecoulerDebounce()
    await nouvelEssai()
    await relireDansLesDeuxOnglets(A, B)

    expect(serveur.espace[REGLAGE]).toBe('non')
    expect(window.localStorage.getItem(REGLAGE)).toBe('non')
  })

  it('B relit, puis un onglet resté sur la version précédente du site écrit une autre valeur, encore en route : elle reste en place', async () => {
    const { A, B } = await reglageEnAttente()
    await B.hydrateStorageFromServer()
    // Un onglet chargé avant cette version écrit sans laisser ni effacer de marque ; son envoi n'est pas encore arrivé.
    setItemDOrigine.call(window.localStorage, REGLAGE, 'peut-etre')
    await nouvelEssai()

    expect(window.localStorage.getItem(REGLAGE)).toBe('peut-etre')
    expect(serveur.espace[REGLAGE]).toBe('non')
    serveur.espace[REGLAGE] = 'peut-etre' // son envoi arrive
    await relireDansLesDeuxOnglets(A, B)
    expect(serveur.espace[REGLAGE]).toBe('peut-etre')
    expect(window.localStorage.getItem(REGLAGE)).toBe('peut-etre')
  })
})

// Sixième passe, scénarios N1P et N1R : B reprend la saisie notée par A (prise en charge), son envoi échoue, puis
// l'utilisateur revient à la valeur d'avant. Avant, B réécrivait la saisie reprise et la renvoyait environ 5 s plus tard.
describe('saisie prise en charge par un autre onglet, puis défaite par l’utilisateur', () => {
  it('réglage : B prend en charge le « oui » noté par A, son envoi échoue, l’utilisateur remet « non » dans A : le retour l’emporte', async () => {
    const REGLAGE = 'fixit_reglage_a'
    serveur.espace[REGLAGE] = 'non'
    const A = await ouvrirUnOnglet()
    const B = await ouvrirUnOnglet()
    serveur.retenir = true
    saisirTexteDans(A, REGLAGE, 'oui')
    await ecoulerDebounce() // envoi 0 (A), lent
    await vi.advanceTimersByTimeAsync(3000) // la note de A entre dans l'état
    await B.hydrateStorageFromServer() // B trouve la saisie notée de A en place et la prend en charge
    await ecoulerDebounce() // envoi 1 (B)
    expect(serveur.retenus).toHaveLength(2)
    await aboutir(0) // le « oui » de A arrive
    await aboutir(1, 'reseau') // l'envoi de B échoue
    serveur.retenir = false
    saisirTexteDans(A, REGLAGE, 'non') // retour en arrière : il arrive
    await ecoulerDebounce()
    expect(serveur.espace[REGLAGE]).toBe('non')
    await nouvelEssai() // nouvel essai de B
    await relireDansLesDeuxOnglets(A, B)

    expect(serveur.espace[REGLAGE]).toBe('non')
    expect(window.localStorage.getItem(REGLAGE)).toBe('non')
  })

  it('liste : même cas, puis un troisième onglet relit après le retour en arrière : le retour l’emporte', async () => {
    const A = await ouvrirUnOnglet()
    const B = await ouvrirUnOnglet()
    const C = await ouvrirUnOnglet()
    serveur.retenir = true
    saisirDans(A, CLIENTS, liste(1, 2))
    await ecoulerDebounce() // envoi 0 (A)
    await vi.advanceTimersByTimeAsync(3000)
    await B.hydrateStorageFromServer() // B prend en charge la saisie notée de A
    await ecoulerDebounce() // envoi 1 (B)
    expect(serveur.retenus).toHaveLength(2)
    await aboutir(0)
    await aboutir(1, 'reseau')
    serveur.retenir = false
    saisirDans(A, CLIENTS, liste(1)) // client retiré : retour à la liste d'avant, il arrive
    await ecoulerDebounce()
    await C.hydrateStorageFromServer() // C remet dans le navigateur le texte du serveur
    await nouvelEssai() // nouvel essai de B
    await relireDansLesDeuxOnglets(A, B)
    await C.hydrateStorageFromServer()

    expect(serveur.espace[CLIENTS]).toEqual(liste(1))
    expect(lire(CLIENTS)).toEqual(liste(1))
  })
})

// Sixième passe, scénarios L2 et L3 : la restauration lente de B, lue avant une saisie de A arrivée depuis, écrit une
// valeur plus ancienne à la place de la saisie suivante de A, en attente après un échec. Avant, cette saisie était
// abandonnée ; seule la marque de la restauration la distingue de la saisie d'un autre onglet encore en route (L3).
describe('valeur inconnue à la place d’une saisie en attente', () => {
  it.each([
    ['continue de travailler dans A', true],
    ['ne fait rien d’autre', false],
  ] as const)('la restauration lente de B remet une valeur plus ancienne, l’utilisateur %s : au nouvel essai, la saisie part', async (_suite, continuer) => {
    const A = await ouvrirUnOnglet()
    const B = await ouvrirUnOnglet()
    const ecrireB = await restaurationRetardee(B) // B lit liste(1), sa réponse est lente
    saisirDans(A, CLIENTS, liste(1, 2))
    await ecoulerDebounce() // arrive
    serveur.retenir = true
    saisirDans(A, CLIENTS, liste(1, 2, 3))
    await ecoulerDebounce() // envoi 0
    await aboutir(0, 'reseau') // échec : la saisie attend son nouvel essai
    serveur.retenir = false
    await ecrireB() // B écrit liste(1), plus ancienne que liste(1, 2)
    expect(lire(CLIENTS)).toEqual(liste(1))
    if (continuer) {
      saisirDans(A, 'fixit_autre_a', { a: 1 })
      await ecoulerDebounce()
    }
    await nouvelEssai()
    await relireDansLesDeuxOnglets(A, B)

    expect(serveur.espace[CLIENTS]).toEqual(liste(1, 2, 3))
    expect(lire(CLIENTS)).toEqual(liste(1, 2, 3))
  })

  it('la restauration lente de C remet une valeur plus ancienne, puis celle de B la valeur du serveur : au nouvel essai, la saisie part', async () => {
    const A = await ouvrirUnOnglet()
    const B = await ouvrirUnOnglet()
    const C = await ouvrirUnOnglet()
    const ecrireC = await restaurationRetardee(C) // C lit liste(1), sa réponse est lente
    saisirDans(A, CLIENTS, liste(1, 2))
    await ecoulerDebounce() // arrive
    serveur.retenir = true
    saisirDans(A, CLIENTS, liste(1, 2, 3))
    await ecoulerDebounce() // envoi 0
    await aboutir(0, 'reseau') // échec : la saisie attend son nouvel essai
    serveur.retenir = false
    await ecrireC() // C écrit liste(1) à la place de la saisie
    await B.hydrateStorageFromServer() // B écrit liste(1, 2) à la place de ce qu'a écrit C
    expect(lire(CLIENTS)).toEqual(liste(1, 2))
    await nouvelEssai()
    await relireDansLesDeuxOnglets(A, B)

    // La note de C suit le texte qu'il a écrit : B la reporte sur le sien, sans quoi la saisie était perdue.
    expect(serveur.espace[CLIENTS]).toEqual(liste(1, 2, 3))
    expect(lire(CLIENTS)).toEqual(liste(1, 2, 3))
  })

  it('la valeur en place est la saisie de B, encore en route : elle reste, sans que A ne renvoie la sienne, et l’emporte', async () => {
    const A = await ouvrirUnOnglet()
    const B = await ouvrirUnOnglet()
    serveur.retenir = true
    saisirDans(A, CLIENTS, liste(1, 2))
    await ecoulerDebounce() // envoi 0 (A)
    await aboutir(0, 'reseau') // échec : la saisie attend son nouvel essai
    saisirDans(B, CLIENTS, liste(1, 2, 7))
    await ecoulerDebounce() // envoi 1 (B), en route
    await nouvelEssai() // nouvel essai de A, avant l'arrivée de la saisie de B
    expect(lire(CLIENTS)).toEqual(liste(1, 2, 7))
    await toutLiberer(1)
    await relireDansLesDeuxOnglets(A, B)

    expect(serveur.espace[CLIENTS]).toEqual(liste(1, 2, 7))
    expect(lire(CLIENTS)).toEqual(liste(1, 2, 7))
  })
})

// Sixième passe, scénario D1 : la reprise couvre aussi une suppression en attente.
describe('suppression en attente, annulée dans le navigateur', () => {
  /** Dans A, l'utilisateur supprime la liste ; la suppression échoue et attend son nouvel essai. */
  async function suppressionEnAttente(): Promise<{ A: ModuleSync; B: ModuleSync }> {
    const A = await ouvrirUnOnglet()
    const B = await ouvrirUnOnglet()
    serveur.retenir = true
    supprimerDans(A, CLIENTS)
    await ecoulerDebounce()
    await aboutir(0, 'reseau')
    serveur.retenir = false
    return { A, B }
  }

  it('par la restauration de B, qui remet la valeur du serveur : au nouvel essai, la suppression part', async () => {
    const { A, B } = await suppressionEnAttente()
    await B.hydrateStorageFromServer()
    expect(lire(CLIENTS)).toEqual(liste(1))
    await nouvelEssai()
    await relireDansLesDeuxOnglets(A, B)

    // Avant : la suppression était abandonnée et la liste revenait.
    expect(serveur.espace).not.toHaveProperty(CLIENTS)
    expect(window.localStorage.getItem(CLIENTS)).toBeNull()
    // La suppression est faite : les relectures qui suivent (la note de l'état n'est levée que 3 s plus tard) ne la
    // renvoient pas pour une clé que le serveur n'a plus.
    expect(fauxFetch.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(2)
  })

  it('par l’utilisateur, qui recrée la liste dans B : la liste recréée l’emporte', async () => {
    const { A, B } = await suppressionEnAttente()
    saisirDans(B, CLIENTS, liste(1))
    await ecoulerDebounce()
    await nouvelEssai()
    await relireDansLesDeuxOnglets(A, B)

    expect(serveur.espace[CLIENTS]).toEqual(liste(1))
    expect(lire(CLIENTS)).toEqual(liste(1))
  })

  // Septième passe, scénario D1F : la restauration d'un onglet qui n'avait jamais vu la clé ne marquait pas sa
  // disparition, et la suppression en attente était abandonnée au nouvel essai.
  it('par la restauration d’un onglet neuf (ouvert, ou rechargé) qui n’avait jamais vu la clé : au nouvel essai, la suppression part', async () => {
    const A = await ouvrirUnOnglet()
    serveur.retenir = true
    supprimerDans(A, CLIENTS)
    await ecoulerDebounce()
    await aboutir(0, 'reseau') // échec : la suppression attend son nouvel essai
    serveur.retenir = false
    const B = await ouvrirUnOnglet() // sa restauration remet la liste dans le navigateur
    expect(lire(CLIENTS)).toEqual(liste(1))
    await nouvelEssai()
    await relireDansLesDeuxOnglets(A, B)

    expect(serveur.espace).not.toHaveProperty(CLIENTS)
    expect(window.localStorage.getItem(CLIENTS)).toBeNull()
  })
})

// Septième passe, scénarios X3, X3b, X3v et X3D du banc de la contre-relecture : un onglet B s'ouvre (nouvel onglet, ou
// rechargement) pendant que la modification de A attend son nouvel essai, et au montage une section de B réécrit la clé
// telle qu'elle la lit — la modification de A —, avant que sa restauration ne réponde. Cette restauration la remplaçait
// sans la marquer, puisque B l'avait écrite lui-même, et la modification de A était perdue au nouvel essai.
describe('modification en attente réécrite à l’identique par un onglet qui s’ouvre, avant sa restauration', () => {
  /** Onglet dont la restauration n'a pas encore répondu : son miroir est posé, le serveur n'est pas encore relu. */
  async function chargerUnOnglet(): Promise<ModuleSync> {
    vi.resetModules()
    const onglet = await import('@/lib/storage-sync')
    onglet.installStorageSync()
    onglets.push(onglet)
    return onglet
  }

  /** Section qui persiste son état à chaque rendu : au montage, elle réécrit la valeur qu'elle lit dans le navigateur. */
  function reecrireDans(onglet: ModuleSync, cle: string): void {
    const texte = window.localStorage.getItem(cle) as string
    setItemDOrigine.call(window.localStorage, cle, texte)
    onglet.enregistrerEcritureMiroir(cle, texte, texte)
  }

  /** L'onglet affiché passe en arrière-plan : l'utilisateur va sur un autre onglet. */
  async function passerEnArrierePlan(): Promise<void> {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
    delete (document as unknown as Record<string, unknown>).visibilityState
    await vi.advanceTimersByTimeAsync(0)
  }

  /** Dans A, l'utilisateur ajoute un client ; l'envoi échoue, la saisie attend son nouvel essai. */
  async function saisieEnAttente(): Promise<ModuleSync> {
    const A = await ouvrirUnOnglet()
    serveur.retenir = true
    saisirDans(A, CLIENTS, liste(1, 2))
    await ecoulerDebounce()
    await aboutir(0, 'reseau')
    serveur.retenir = false
    return A
  }

  /** B s'ouvre, réécrit au montage la valeur en place, puis sa restauration y remet la liste du serveur. */
  async function ouvrirBQuiReecrit(): Promise<ModuleSync> {
    const B = await chargerUnOnglet()
    reecrireDans(B, CLIENTS)
    await B.hydrateStorageFromServer()
    expect(lire(CLIENTS)).toEqual(liste(1))
    return B
  }

  it.each([
    ['continue de travailler dans A', true],
    ['ne fait rien d’autre', false],
  ] as const)('B réécrit la saisie de A puis restaure, l’utilisateur %s : au nouvel essai, la saisie part', async (_suite, continuer) => {
    const A = await saisieEnAttente()
    const B = await ouvrirBQuiReecrit()
    if (continuer) {
      saisirDans(A, 'fixit_autre_a', { a: 1 })
      await ecoulerDebounce()
    }
    await nouvelEssai()
    await relireDansLesDeuxOnglets(A, B)

    // Avant : la restauration de B ne marquait pas un texte que B avait écrit lui-même, et la saisie était perdue.
    expect(serveur.espace[CLIENTS]).toEqual(liste(1, 2))
    expect(lire(CLIENTS)).toEqual(liste(1, 2))
  })

  it('B s’ouvre après que la note de A est entrée dans l’état : au nouvel essai, la saisie part', async () => {
    const A = await saisieEnAttente()
    await vi.advanceTimersByTimeAsync(2000) // la note de A entre dans l'état, avant son nouvel essai
    const B = await ouvrirBQuiReecrit()
    await nouvelEssai()
    await relireDansLesDeuxOnglets(A, B)

    expect(serveur.espace[CLIENTS]).toEqual(liste(1, 2))
    expect(lire(CLIENTS)).toEqual(liste(1, 2))
  })

  it('l’utilisateur quitte A pour ouvrir B : au nouvel essai, la saisie part', async () => {
    const A = await saisieEnAttente()
    await passerEnArrierePlan() // rien ne part à l'aveugle ; la note de A entre aussitôt dans l'état
    const B = await ouvrirBQuiReecrit()
    await nouvelEssai()
    await relireDansLesDeuxOnglets(A, B)

    expect(serveur.espace[CLIENTS]).toEqual(liste(1, 2))
    expect(lire(CLIENTS)).toEqual(liste(1, 2))
  })

  it('suppression : B retire au montage la clé que A a supprimée, puis restaure : au nouvel essai, la suppression part', async () => {
    const A = await ouvrirUnOnglet()
    serveur.retenir = true
    supprimerDans(A, CLIENTS)
    await ecoulerDebounce()
    await aboutir(0, 'reseau') // échec : la suppression attend son nouvel essai
    serveur.retenir = false
    const B = await chargerUnOnglet()
    supprimerDans(B, CLIENTS) // montage de B : retrait d'une clé déjà absente
    await B.hydrateStorageFromServer()
    expect(lire(CLIENTS)).toEqual(liste(1))
    await nouvelEssai()
    await relireDansLesDeuxOnglets(A, B)

    expect(serveur.espace).not.toHaveProperty(CLIENTS)
    expect(window.localStorage.getItem(CLIENTS)).toBeNull()
  })

  it('un autre appareil a écrit entre-temps : le serveur gagne, la saisie ne part pas', async () => {
    const A = await saisieEnAttente()
    const B = await ouvrirBQuiReecrit()
    serveur.espace[CLIENTS] = commeLaBase(liste(1, 9))
    await nouvelEssai()
    await relireDansLesDeuxOnglets(A, B)

    expect(serveur.espace[CLIENTS]).toEqual(liste(1, 9))
    expect(lire(CLIENTS)).toEqual(liste(1, 9))
    expect(serveur.postees).toHaveLength(1)
  })

  // Garantie 1 : la marque laissée pour un texte que B a écrit lui-même ne fait pas partir un jeu par défaut.
  it('appareil neuf : le jeu par défaut écrit au montage de A, réécrit par B, ne remplace pas la valeur du serveur', async () => {
    serveur.espace[CLIENTS] = commeLaBase(liste(1, 2, 3))
    const A = await chargerUnOnglet()
    saisirDans(A, CLIENTS, liste(9)) // jeu par défaut écrit au montage, dans un navigateur vide
    fauxFetch.mockImplementationOnce(async () => new Response('{}', { status: 500 }))
    await A.hydrateStorageFromServer() // première restauration en échec : rien ne part
    const B = await chargerUnOnglet()
    reecrireDans(B, CLIENTS)
    await B.hydrateStorageFromServer()
    await nouvelEssai()
    await relireDansLesDeuxOnglets(A, B)

    expect(serveur.espace[CLIENTS]).toEqual(liste(1, 2, 3))
    expect(lire(CLIENTS)).toEqual(liste(1, 2, 3))
    expect(serveur.postees).toHaveLength(0)
  })
})

// Septième passe, scénarios DX, DY et DZ : la suppression de A échoue alors que la clé est revenue dans le navigateur
// pendant son envoi. Elle n'était remise en attente que si la clé y restait absente : remise par la restauration d'un
// autre onglet, elle était abandonnée. Elle attend désormais la relecture du nouvel essai, qui tranche.
describe('suppression en échec alors que la clé est revenue dans le navigateur pendant son envoi', () => {
  it.each([
    ['continue de travailler dans A', true],
    ['ne fait rien d’autre', false],
  ] as const)('remise par la restauration de B, l’utilisateur %s : au nouvel essai, la suppression part', async (_suite, continuer) => {
    const A = await ouvrirUnOnglet()
    const B = await ouvrirUnOnglet()
    serveur.retenir = true
    supprimerDans(A, CLIENTS)
    await ecoulerDebounce() // envoi 0 : la suppression, en route
    await B.hydrateStorageFromServer() // B remet la liste du serveur dans le navigateur
    await aboutir(0, 'reseau') // puis la suppression échoue
    serveur.retenir = false
    if (continuer) {
      saisirDans(A, 'fixit_autre_a', { a: 1 })
      await ecoulerDebounce()
    }
    await nouvelEssai()
    await relireDansLesDeuxOnglets(A, B)

    // Avant : la clé n'était plus absente du navigateur, la suppression n'était pas remise en attente et la liste revenait.
    expect(serveur.espace).not.toHaveProperty(CLIENTS)
    expect(window.localStorage.getItem(CLIENTS)).toBeNull()
  })

  it.each([
    ['arrivé avant l’échec', true],
    ['encore en route au nouvel essai', false],
  ] as const)('recréée par l’utilisateur dans B, envoi %s : la liste recréée l’emporte', async (_cas, arrivee) => {
    const A = await ouvrirUnOnglet()
    const B = await ouvrirUnOnglet()
    serveur.retenir = true
    supprimerDans(A, CLIENTS)
    await ecoulerDebounce() // envoi 0 : la suppression (A)
    saisirDans(B, CLIENTS, liste(1, 9))
    await ecoulerDebounce() // envoi 1 : la liste recréée (B)
    if (arrivee) await aboutir(1)
    await aboutir(0, 'reseau') // la suppression échoue
    serveur.retenir = false
    saisirDans(A, 'fixit_autre_a', { a: 1 })
    await ecoulerDebounce()
    await nouvelEssai() // la relecture du nouvel essai de A tranche
    if (!arrivee) await aboutir(1)
    await relireDansLesDeuxOnglets(A, B)

    expect(serveur.espace[CLIENTS]).toEqual(liste(1, 9))
    expect(lire(CLIENTS)).toEqual(liste(1, 9))
  })

  it('la suppression arrive sans réponse ; la liste recréée dans B arrive juste après la relecture de A : elle reste au serveur', async () => {
    const A = await ouvrirUnOnglet()
    const B = await ouvrirUnOnglet()
    serveur.retenir = true
    supprimerDans(A, CLIENTS)
    await ecoulerDebounce() // envoi 0 : la suppression (A)
    saisirDans(B, CLIENTS, liste(1, 9))
    await ecoulerDebounce() // envoi 1 : la liste recréée (B), lente
    await aboutir(0, 'perdue') // la suppression arrive, sa réponse se perd
    await vi.advanceTimersByTimeAsync(5100) // relecture du nouvel essai de A : la clé est absente du serveur
    await aboutir(1) // la liste recréée arrive
    await ecoulerDebounce() // envoi suivant de A
    await toutLiberer(2)
    await relireDansLesDeuxOnglets(A, B)

    // La suppression est faite : renvoyée, elle effaçait du serveur la liste recréée, arrivée entre-temps.
    expect(serveur.espace[CLIENTS]).toEqual(liste(1, 9))
    expect(lire(CLIENTS)).toEqual(liste(1, 9))
    expect(fauxFetch.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(1)
  })

  // Huitième passe, scénarios DW5d et DW5c de la contre-relecture : la suppression arrive au serveur, et une relecture de
  // A faite pendant son envoi trouve la clé absente du serveur : la suppression est faite, sa note est levée. Puis sa
  // réponse se perd. Elle était remise en attente sans note : la relecture du nouvel essai ne la voyait plus, et elle
  // repartait sans contrôle.
  it.each([
    ['continue de travailler dans A', true],
    ['ne fait rien d’autre', false],
  ] as const)('la suppression arrive avec une réponse lente, A relit pendant son envoi, puis la réponse se perd ; l’utilisateur %s : la liste recréée dans B reste au serveur', async (_suite, continuer) => {
    const A = await ouvrirUnOnglet()
    const B = await ouvrirUnOnglet()
    serveur.retenir = true
    supprimerDans(A, CLIENTS)
    await ecoulerDebounce() // envoi 0 : la suppression (A)
    saisirDans(B, CLIENTS, liste(1, 9))
    await ecoulerDebounce() // envoi 1 : la liste recréée (B), lente
    await vi.advanceTimersByTimeAsync(3000) // la note de B entre dans l'état
    await aboutir(0, 'sansReponse') // la suppression arrive ; sa réponse est en route
    await A.hydrateStorageFromServer() // retour sur A : la clé est absente du serveur, la suppression est faite
    await repondre(0, 'reseau') // puis sa réponse se perd
    await vi.advanceTimersByTimeAsync(5100) // nouvel essai de A, s'il est programmé : la liste recréée n'est pas arrivée
    await aboutir(1) // la liste recréée arrive
    if (continuer) saisirDans(A, 'fixit_autre_a', { a: 1 })
    await ecoulerDebounce()
    await toutLiberer(2)
    await relireDansLesDeuxOnglets(A, B)

    // Avant : la suppression repartait au nouvel essai et effaçait du serveur la liste recréée, arrivée entre-temps.
    expect(serveur.espace[CLIENTS]).toEqual(liste(1, 9))
    expect(lire(CLIENTS)).toEqual(liste(1, 9))
    expect(fauxFetch.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(1)
  })

  it('même suppression sans autre onglet, la liste est recréée sur un autre appareil juste après le nouvel essai de A : elle reste au serveur', async () => {
    const A = await ouvrirUnOnglet()
    serveur.retenir = true
    supprimerDans(A, CLIENTS)
    await ecoulerDebounce() // envoi 0 : la suppression
    await aboutir(0, 'sansReponse')
    await A.hydrateStorageFromServer() // la clé est absente du serveur : la suppression est faite
    await repondre(0, 'reseau')
    await vi.advanceTimersByTimeAsync(5100) // nouvel essai de A, s'il est programmé
    serveur.espace[CLIENTS] = commeLaBase(liste(1, 9)) // un autre appareil recrée la liste
    await ecoulerDebounce()
    await toutLiberer(1)
    await A.hydrateStorageFromServer()
    await ecoulerDebounce()

    expect(serveur.espace[CLIENTS]).toEqual(liste(1, 9))
    expect(lire(CLIENTS)).toEqual(liste(1, 9))
    expect(fauxFetch.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(1)
  })
})

// Huitième passe, scénarios CAP et CAPT du banc : une restauration qui marque plus de cinquante clés à la fois ne
// gardait que les cinquante dernières, toutes sortes confondues, dans l'ordre où le serveur rend les clés.
describe('restauration qui marque plus de cinquante clés à la fois', () => {
  it.each([
    ['continue de travailler dans A', true],
    ['ne fait rien d’autre', false],
  ] as const)('saisie de A en attente, un onglet neuf B restaure aussi soixante clés créées ailleurs ; l’utilisateur %s : au nouvel essai, la saisie part', async (_suite, continuer) => {
    const A = await ouvrirUnOnglet()
    serveur.retenir = true
    saisirDans(A, CLIENTS, liste(1, 2))
    await ecoulerDebounce()
    await aboutir(0, 'reseau') // échec : la saisie attend son nouvel essai
    serveur.retenir = false
    // Clés créées sur un autre appareil, absentes de ce navigateur ; le serveur les rend après la liste des clients.
    for (let i = 0; i < 60; i++) serveur.espace[`fixit_clients_a_extra_${String(i).padStart(2, '0')}`] = { n: i }
    const B = await ouvrirUnOnglet() // remplace la saisie de A, et marque aussi les soixante clés absentes
    expect(lire(CLIENTS)).toEqual(liste(1))
    if (continuer) {
      saisirDans(A, 'fixit_autre_a', { a: 1 })
      await ecoulerDebounce()
    }
    await nouvelEssai()
    await relireDansLesDeuxOnglets(A, B)

    // Avant : les marques des clés absentes faisaient sauter celle de la saisie remplacée, perdue au nouvel essai.
    expect(serveur.espace[CLIENTS]).toEqual(liste(1, 2))
    expect(lire(CLIENTS)).toEqual(liste(1, 2))
  })

  it.each([
    ['rangées avant la liste des clients', 'fixit_b'],
    ['rangées après la liste des clients', 'fixit_zz_fiche_'],
  ] as const)('suppression de A en attente, B restaure aussi cinquante-cinq fiches réécrites par l’application, %s : au nouvel essai, la suppression part', async (_cas, prefixe) => {
    const fiches = Array.from({ length: 55 }, (_, i) => `${prefixe}${String(i).padStart(2, '0')}`)
    for (const [i, cle] of fiches.entries()) serveur.espace[cle] = commeLaBase({ nom: `Fiche ${i}`, id: i })
    // Navigateur déjà synchronisé : rien n'y manque à l'ouverture de A, aucune clé absente n'est marquée.
    for (const [cle, valeur] of Object.entries(serveur.espace)) setItemDOrigine.call(window.localStorage, cle, JSON.stringify(commeLaBase(valeur)))
    const A = await ouvrirUnOnglet()
    // L'application réécrit les fiches dans son propre ordre des champs, qui n'est pas celui de la base.
    for (const [i, cle] of fiches.entries()) saisirDans(A, cle, { nom: `Fiche ${i}`, id: i })
    await ecoulerDebounce()
    // L'état de A est écrit : la note de la suppression n'y entrera que 3 s après elle, quand B aura restauré.
    await vi.advanceTimersByTimeAsync(3000)
    serveur.retenir = true
    supprimerDans(A, CLIENTS)
    await ecoulerDebounce()
    await aboutir(0, 'reseau') // échec : la suppression attend son nouvel essai
    serveur.retenir = false
    const B = await ouvrirUnOnglet() // remet la liste ; marque sa disparition et les 55 textes remplacés
    expect(lire(CLIENTS)).toEqual(liste(1))
    saisirDans(A, 'fixit_autre_a', { a: 1 })
    await ecoulerDebounce()
    await nouvelEssai()
    await relireDansLesDeuxOnglets(A, B)

    // Avant, fiches rangées après la liste : les marques des textes remplacés faisaient sauter celle de la disparition,
    // et la suppression était abandonnée.
    expect(serveur.espace).not.toHaveProperty(CLIENTS)
    expect(window.localStorage.getItem(CLIENTS)).toBeNull()
  })
})

// Dixième passe, scénario DCF5-B de la contre-relecture : la suppression arrive au serveur et est confirmée avant la
// saisie plus ancienne, qui arrive après elle. Le correctif DCF2 de la neuvième passe (retiré à la onzième) recréait à
// la confirmation de cette saisie la note de la clé, levée par celle de la suppression. La saisie suivante de l'onglet
// la gardait : la valeur d'avant retenue était la saisie confirmée, et non la valeur du navigateur juste avant la
// nouvelle saisie. En échec, la nouvelle saisie était perdue au nouvel essai, alors que le serveur détenait la valeur
// qu'elle avait remplacée.
describe('saisie qui suit une suppression confirmée avant la saisie plus ancienne', () => {
  it('la nouvelle saisie, en échec, repart au nouvel essai quand le serveur détient la valeur qu’elle a remplacée', async () => {
    const A = await ouvrirUnOnglet()
    const C = await ouvrirUnOnglet()
    serveur.retenir = true
    saisirDans(A, CLIENTS, liste(1, 2))
    await ecoulerDebounce() // envoi 0 : la saisie
    supprimerDans(A, CLIENTS)
    const B = await ouvrirUnOnglet() // remet la liste du serveur, et marque sa disparition
    await ecoulerDebounce() // envoi 1 : la suppression
    await aboutir(1) // la suppression arrive et est confirmée
    await aboutir(0) // la saisie, plus ancienne, arrive après elle et est confirmée
    serveur.retenir = false
    saisirDans(C, CLIENTS, liste(1)) // dans C, l'utilisateur remet la liste d'origine ; l'envoi part et arrive
    await ecoulerDebounce()
    serveur.retenir = true
    saisirDans(A, CLIENTS, liste(5)) // puis il crée une nouvelle liste dans A
    await ecoulerDebounce() // envoi 2
    await aboutir(2, 'reseau')
    serveur.retenir = false
    await nouvelEssai()
    await relireDansLesDeuxOnglets(A, B)

    // Neuvième passe : le serveur gardait la liste d'origine, et elle revenait dans le navigateur.
    expect(serveur.espace[CLIENTS]).toEqual(commeLaBase(liste(5)))
    expect(lire(CLIENTS)).toEqual(commeLaBase(liste(5)))
  })
})

// Onzième passe, scénario DCF5RB de la contre-relecture : la saisie de A arrive au serveur et est confirmée pendant
// l'envoi de la suppression faite juste après elle ; l'onglet neuf B, qui a remis la liste d'origine, la réécrit à son
// ouverture dans l'ordre des champs de l'application, et son envoi arrive avant le nouvel essai. Garder la note de la
// suppression à cette confirmation (correctif DCF2 des neuvième et dixième passes) en faisait la valeur d'avant de la
// saisie suivante de A : faite après l'échec de la suppression, celle-ci cédait au serveur sans jamais partir, et la
// liste d'origine revenait. La suppression, elle, est perdue (limite écrite en tête du module).
describe('saisie après l’échec d’une suppression, l’onglet neuf ayant réécrit à son ouverture la liste remise', () => {
  it('la nouvelle saisie part, et le serveur la garde', async () => {
    const A = await ouvrirUnOnglet()
    serveur.retenir = true
    saisirDans(A, CLIENTS, liste(1, 2))
    await ecoulerDebounce() // envoi 0 : la saisie
    supprimerDans(A, CLIENTS)
    const B = await ouvrirUnOnglet() // remet la liste du serveur, et marque sa disparition
    saisirDans(B, CLIENTS, liste(1)) // l'application de B réécrit la liste dans son propre ordre des champs
    await ecoulerDebounce() // envoi 1 : la suppression ; envoi 2 : la réécriture de B
    await aboutir(0) // la saisie arrive et est confirmée pendant l'envoi de la suppression
    await aboutir(2) // la réécriture de B arrive : le serveur détient de nouveau la liste d'origine
    await aboutir(1, 'reseau') // la suppression échoue
    serveur.retenir = false
    // L'utilisateur crée une nouvelle liste dans A après l'échec de la suppression. Perdue, celle-ci ne programme aucun
    // nouvel essai : la saisie part à son envoi ordinaire (sur 12e2f89b, elle attendait le nouvel essai et y cédait).
    saisirDans(A, CLIENTS, liste(5))
    await ecoulerDebounce()
    await nouvelEssai()
    await relireDansLesDeuxOnglets(A, B)

    // Neuvième et dixième passes : la nouvelle liste ne partait jamais, et la liste d'origine revenait.
    expect(serveur.espace[CLIENTS]).toEqual(commeLaBase(liste(5)))
    expect(lire(CLIENTS)).toEqual(liste(5))
  })
})

// Neuvième passe, remarque de la contre-relecture : la limite de cinquante marques par sorte n'était vérifiée par aucun
// test. Une note qui en garderait moins perdrait l'une de deux modifications remplacées par la même restauration ; une
// note sans limite grandirait avec le nombre de clés du compte.
describe('note des remplacements : plusieurs marques d’une même sorte', () => {
  const DEVIS = 'fixit_clients_a_devis'
  const marquesDeLaNote = (): Array<[string, string]> =>
    Object.values((JSON.parse(window.localStorage.getItem('vitfix_miroir_remplacements_v1') ?? '{}') as { remplacements?: Record<string, [string, string]> }).remplacements ?? {})

  it('deux saisies en attente, sur deux listes, remplacées par la restauration d’un onglet neuf : au nouvel essai, toutes les deux partent', async () => {
    serveur.espace[DEVIS] = commeLaBase(liste(5))
    const A = await ouvrirUnOnglet()
    serveur.retenir = true
    saisirDans(A, CLIENTS, liste(1, 2))
    saisirDans(A, DEVIS, liste(5, 6))
    await ecoulerDebounce()
    await aboutir(0, 'reseau') // échec : les deux saisies attendent leur nouvel essai
    serveur.retenir = false
    const B = await ouvrirUnOnglet() // remet les deux listes du serveur, et marque les deux saisies remplacées
    expect(lire(CLIENTS)).toEqual(liste(1))
    expect(lire(DEVIS)).toEqual(liste(5))
    await nouvelEssai()
    await relireDansLesDeuxOnglets(A, B)

    expect(serveur.espace[CLIENTS]).toEqual(liste(1, 2))
    expect(serveur.espace[DEVIS]).toEqual(liste(5, 6))
    expect(lire(CLIENTS)).toEqual(liste(1, 2))
    expect(lire(DEVIS)).toEqual(liste(5, 6))
  })

  it('deux suppressions en attente, annulées par la restauration d’un onglet neuf : au nouvel essai, toutes les deux partent', async () => {
    serveur.espace[DEVIS] = commeLaBase(liste(5))
    const A = await ouvrirUnOnglet()
    await vi.advanceTimersByTimeAsync(3000)
    serveur.retenir = true
    supprimerDans(A, CLIENTS)
    supprimerDans(A, DEVIS)
    await ecoulerDebounce()
    await aboutir(0, 'reseau') // échec : les deux suppressions attendent leur nouvel essai
    serveur.retenir = false
    const B = await ouvrirUnOnglet() // remet les deux listes, et marque leur disparition
    expect(lire(CLIENTS)).toEqual(liste(1))
    expect(lire(DEVIS)).toEqual(liste(5))
    await nouvelEssai()
    await relireDansLesDeuxOnglets(A, B)

    expect(serveur.espace).not.toHaveProperty(CLIENTS)
    expect(serveur.espace).not.toHaveProperty(DEVIS)
    expect(window.localStorage.getItem(CLIENTS)).toBeNull()
    expect(window.localStorage.getItem(DEVIS)).toBeNull()
  })

  it('la note garde au plus cinquante marques de chaque sorte, soit cent au plus', async () => {
    const fiches = Array.from({ length: 55 }, (_, i) => `fixit_zz_fiche_${String(i).padStart(2, '0')}`)
    for (const [i, cle] of fiches.entries()) serveur.espace[cle] = commeLaBase({ nom: `Fiche ${i}`, id: i })
    // Navigateur synchronisé pour la liste et les fiches ; soixante clés créées ailleurs y manquent.
    for (const [cle, valeur] of Object.entries(serveur.espace)) setItemDOrigine.call(window.localStorage, cle, JSON.stringify(commeLaBase(valeur)))
    for (let i = 0; i < 60; i++) serveur.espace[`fixit_clients_a_extra_${String(i).padStart(2, '0')}`] = { n: i }
    const A = await ouvrirUnOnglet() // remet les soixante clés absentes, et marque leur disparition
    // L'application réécrit les fiches dans son propre ordre des champs, qui n'est pas celui de la base.
    for (const [i, cle] of fiches.entries()) saisirDans(A, cle, { nom: `Fiche ${i}`, id: i })
    await ecoulerDebounce()
    await ouvrirUnOnglet() // onglet neuf : marque les cinquante-cinq textes qu'il remplace

    const marques = marquesDeLaNote()
    expect(marques.filter(([remplace]) => remplace === '')).toHaveLength(50)
    expect(marques.filter(([remplace]) => remplace !== '')).toHaveLength(50)
  })
})

// Dixième passe, scénarios PLEIN-CAPY et PLEIN-CAPZ de la contre-relecture : dans un stockage plein, la neuvième passe
// réécrivait la note des remplacements réduite à ses cinquante marques les plus récentes, toutes sortes confondues. Sa
// marque la plus ancienne en sortait même quand la marque nouvelle ne servait à rien (liste modifiée sur un autre
// appareil, créée ailleurs, ou réécrite par l'application dans son ordre des champs) : la saisie en attente qu'elle
// désignait était perdue au nouvel essai. Ce second essai est retiré : une note qui devrait grandir n'est pas réécrite,
// aucune marque déjà écrite n'en sort, et la marque nouvelle n'est pas écrite.
describe('stockage du navigateur plein, note des remplacements qui devrait grandir', () => {
  /** Remplit le stockage du navigateur jusqu'à son quota (clés et valeurs comptées), avec une pièce jointe volumineuse. */
  function remplirLeStockage(): void {
    const cle = 'piece_jointe_volumineuse'
    let tient = 0
    let depasse = 6_000_000
    while (depasse - tient > 1) {
      const essai = Math.floor((tient + depasse) / 2)
      try {
        setItemDOrigine.call(window.localStorage, cle, 'x'.repeat(essai))
        tient = essai
      } catch {
        depasse = essai
      }
    }
    setItemDOrigine.call(window.localStorage, cle, 'x'.repeat(tient))
  }

  it('la saisie de A, déjà marquée, part au nouvel essai quand un onglet neuf remplace une autre liste', async () => {
    const AUTRE = 'fixit_z'
    serveur.espace[CLIENTS] = commeLaBase(liste(1, 2, 3))
    serveur.espace[AUTRE] = commeLaBase(liste(7))
    // Navigateur synchronisé avec le serveur : la première restauration ne pose aucune marque.
    for (const [cle, valeur] of Object.entries(serveur.espace)) setItemDOrigine.call(window.localStorage, cle, JSON.stringify(commeLaBase(valeur)))
    const A = await ouvrirUnOnglet()
    await vi.advanceTimersByTimeAsync(3000)
    serveur.retenir = true
    saisirDans(A, CLIENTS, liste(1, 2)) // un client retiré : la valeur raccourcit, elle tiendra dans le stockage plein
    await ecoulerDebounce()
    await aboutir(0, 'reseau') // échec : la saisie attend son nouvel essai
    serveur.retenir = false
    const B = await ouvrirUnOnglet() // onglet neuf : remet la liste du serveur à la place de la saisie, et la marque
    for (let i = 0; i < 49; i++) serveur.espace[`fixit_clients_a_extra_nom_long_pour_le_banc_${String(i).padStart(2, '0')}`] = { n: i }
    await ouvrirUnOnglet() // onglet neuf : remet quarante-neuf listes créées ailleurs ; la note compte cinquante marques
    remplirLeStockage()
    serveur.espace[AUTRE] = commeLaBase(liste(8)) // modifiée sur un autre appareil, à longueur égale
    await ouvrirUnOnglet() // onglet neuf : la remplace ; sa marque, qui ne sert à rien, ferait grandir la note
    expect(lire(CLIENTS)).toEqual(liste(1, 2, 3))
    await nouvelEssai()
    await relireDansLesDeuxOnglets(A, B)

    // Neuvième passe : la marque de la saisie sortait de la note réduite, et la saisie était perdue.
    expect(serveur.espace[CLIENTS]).toEqual(liste(1, 2))
    expect(lire(CLIENTS)).toEqual(liste(1, 2))
  })
})
