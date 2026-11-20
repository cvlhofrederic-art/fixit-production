// tests/storage-sync-garanties.test.ts — miroir localStorage <-> user_storage, audit des fondations du 11/11/2026.
//
// Le serveur est la seule copie qui survit à un changement d'appareil ; le navigateur, la seule qui contient ce qui
// n'est pas encore parti. Quatre garanties, chacune avec le défaut qu'elle ferme :
//   1. une restauration en échec ne laisse rien partir vers le serveur (avant : les jeux par défaut écrits au montage
//      remplaçaient les vraies données, et Providers lançait « tout envoyer ») ;
//   2. une saisie pas encore envoyée n'est plus effacée par la restauration suivante, tant que le serveur détient
//      encore la valeur d'avant — y compris après un rechargement de la page ;
//   3. un envoi en échec est retenté, et une valeur refusée ne bloque plus les autres ;
//   4. rien ne part avec le jeton d'un autre compte.
// Et l'interception elle-même : sur un Storage conforme à la norme (Firefox, jsdom), `localStorage.setItem = …`
// n'installait rien et déposait une entrée « setItem » ; le remplacement se fait maintenant sur Storage.prototype.
// Relecture adverse du 14/11/2026 : le nouvel essai d'un envoi en échec relit d'abord le serveur (garantie 2) ; une
// valeur que le serveur ne parvient pas à enregistrer est mise à part sans bloquer les autres (garantie 3) ; « tout
// envoyer » ne recopie que les clés du compte et porte lui-même ses conditions (garanties 1 et 4).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

type RappelAuth = (evenement: string, session: unknown) => void
const mockGetSession = vi.fn()
let rappelAuth: RappelAuth | null = null
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: (rappel: RappelAuth) => {
        rappelAuth = rappel
        return { data: { subscription: { unsubscribe() {} } } }
      },
    },
  },
}))

type ModuleSync = typeof import('@/lib/storage-sync')
type Methode = 'GET' | 'POST' | 'DELETE'
interface Appel { methode: Methode; compte: string | null; cles: string[] }

const COMPTE_A = '550e8400-e29b-41d4-a716-446655440000'
const COMPTE_B = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
/** Fiches des deux comptes : c'est sous l'identifiant de sa fiche que le tableau de bord pro range ses clés. */
const FICHE_A = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
const FICHE_B = '9b2d7c1a-5e6f-4a3b-8c9d-1e2f3a4b5c6d'
const CLE_ETAT = 'vitfix_miroir_etat_v1'

const b64 = (objet: unknown) => btoa(JSON.stringify(objet)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
/** Jeton d'accès de la même forme que ceux de Supabase : le compte est dans la charge (`sub`). */
const jeton = (compte: string) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: compte, role: 'authenticated' })}.signature`
const compteDuJeton = (init?: RequestInit): string | null => {
  const autorisation = (init?.headers as Record<string, string> | undefined)?.Authorization ?? ''
  const charge = autorisation.split('.')[1]
  return charge ? (JSON.parse(atob(charge.replaceAll('-', '+').replaceAll('_', '/'))) as { sub: string }).sub : null
}

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

const reponse = (contenu: unknown, status = 200) => new Response(JSON.stringify(contenu), { status })

/** Faux /api/user-storage : un espace par compte, des pannes programmables, le journal des appels. */
const serveur = {
  espaces: new Map<string, Record<string, unknown>>(),
  appels: [] as Appel[],
  panne: { GET: null, POST: null, DELETE: null } as Record<Methode, null | number | 'reseau'>,
  /** Clés que le serveur refuse, avec le statut rendu (400, 413 ou 422) : tout l'envoi qui en contient une est refusé. */
  refusees: new Map<string, number>(),
  /** Clés que le serveur ne parvient pas à enregistrer : tout envoi qui en contient une reçoit ce statut (500). */
  enErreur: new Map<string, number>(),
  /** Fiches de chaque compte : un espace vide les donne avec l'identifiant du compte, comme la route. */
  fiches: new Map<string, string[]>(),
  /** Corps imposé à la réponse des GET (réponse inattendue du serveur), sinon null. */
  corpsGet: null as unknown,
  /** Permet à un test de retenir une réponse. */
  avantReponse: null as null | ((appel: Appel) => Promise<void> | void),
  /** Nombre d'envois (POST) enregistrés dont la réponse se perd ensuite (coupure juste après l'envoi). */
  reponsesPerdues: 0,
  espace(compte: string | null): Record<string, unknown> {
    const cle = compte ?? 'inconnu'
    if (!this.espaces.has(cle)) this.espaces.set(cle, {})
    return this.espaces.get(cle)!
  },
  de(methode: Methode): Appel[] {
    return this.appels.filter(a => a.methode === methode)
  },
}

const fauxFetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
  const methode = (init?.method ?? 'GET') as Methode
  const compte = compteDuJeton(init)
  const corps = init?.body ? JSON.parse(String(init.body)) as { entries?: Array<{ key: string; value: unknown }>; keys?: string[] } : {}
  const appel: Appel = { methode, compte, cles: corps.entries?.map(e => e.key) ?? corps.keys ?? [] }
  serveur.appels.push(appel)
  await serveur.avantReponse?.(appel)
  const panne = serveur.panne[methode]
  if (panne === 'reseau') throw new TypeError('Failed to fetch')
  if (typeof panne === 'number') return reponse({ error: 'indisponible' }, panne)
  const espace = serveur.espace(compte)
  if (methode === 'GET') {
    if (serveur.corpsGet !== null) return reponse(serveur.corpsGet)
    const identifiants = Object.keys(espace).length === 0 ? { identifiants: [compte, ...(serveur.fiches.get(compte ?? '') ?? [])] } : {}
    return reponse({ entries: commeLaBase(espace), ...identifiants })
  }
  if (methode === 'POST') {
    const statut = corps.entries!.map(e => serveur.enErreur.get(e.key)).find(s => s !== undefined)
    if (statut !== undefined) return reponse({ error: 'Erreur lors de la sauvegarde' }, statut)
    const refus = corps.entries!.map(e => serveur.refusees.get(e.key)).find(s => s !== undefined)
    if (refus !== undefined) return reponse({ error: 'Données invalides' }, refus)
    for (const e of corps.entries!) espace[e.key] = commeLaBase(e.value)
    if (serveur.reponsesPerdues > 0) {
      serveur.reponsesPerdues--
      throw new TypeError('Failed to fetch')
    }
    return reponse({ success: true })
  }
  for (const cle of corps.keys!) delete espace[cle]
  return reponse({ success: true })
})

function connecter(compte: string | null): void {
  const session = compte ? { access_token: jeton(compte), user: { id: compte } } : null
  mockGetSession.mockResolvedValue({ data: { session }, error: null })
  rappelAuth?.(compte ? 'SIGNED_IN' : 'SIGNED_OUT', session)
}

let syncCourant: ModuleSync | null = null

/** Charge le module comme une page qui s'ouvre : miroir posé par Providers avant toute restauration. */
async function ouvrirLaPage(): Promise<ModuleSync> {
  const sync = await import('@/lib/storage-sync')
  sync.installStorageSync()
  syncCourant = sync
  return sync
}

/** Rechargement de la page : la mémoire du module est perdue, le localStorage reste. */
async function rechargerLaPage(): Promise<ModuleSync> {
  syncCourant?.reinitialiserMiroirPourTests()
  vi.resetModules()
  rappelAuth = null
  return ouvrirLaPage()
}

const ecoulerDebounce = () => vi.advanceTimersByTimeAsync(1600)
/** Nouvel essai programmé après un envoi en échec : le délai, la relecture du serveur, puis l'envoi. */
async function nouvelEssai(delai = 5000): Promise<void> {
  await vi.advanceTimersByTimeAsync(delai)
  await ecoulerDebounce()
}
/** L'onglet passe en arrière-plan (sur mobile, il n'y a pas forcément de beforeunload). */
function cacherLOnglet(): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
  document.dispatchEvent(new Event('visibilitychange'))
  delete (document as unknown as Record<string, unknown>).visibilityState
}
const lire = (cle: string) => window.localStorage.getItem(cle)
const etat = () => JSON.parse(lire(CLE_ETAT) ?? 'null') as { compte: string; comptes: string[]; attente: Record<string, string> } | null
/**
 * Écriture d'un autre onglet du même navigateur (sa restauration, par exemple) : elle atteint le même localStorage sans
 * passer par le miroir de cet onglet. Le setItem d'origine est saisi au chargement de ce fichier, avant que le miroir ne
 * remplace celui de Storage.prototype.
 */
const setItemDOrigine = Storage.prototype.setItem
const ecritureDUnAutreOnglet = (cle: string, valeur: string) => setItemDOrigine.call(window.localStorage, cle, valeur)
const originalFetch = globalThis.fetch

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  window.localStorage.clear()
  window.sessionStorage.clear()
  serveur.espaces.clear()
  serveur.appels = []
  serveur.panne = { GET: null, POST: null, DELETE: null }
  serveur.refusees.clear()
  serveur.enErreur.clear()
  serveur.fiches.clear()
  serveur.corpsGet = null
  serveur.avantReponse = null
  serveur.reponsesPerdues = 0
  fauxFetch.mockClear()
  ;(globalThis as unknown as { fetch: typeof fetch }).fetch = fauxFetch as unknown as typeof fetch
  rappelAuth = null
  connecter(COMPTE_A)
})

afterEach(() => {
  syncCourant?.reinitialiserMiroirPourTests()
  syncCourant = null
  mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
  ;(globalThis as unknown as { fetch: typeof fetch }).fetch = originalFetch
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('interception des écritures sur un Storage conforme à la norme (Firefox, jsdom)', () => {
  it('setItem et removeItem du localStorage sont répliqués, sans déposer d’entrée « setItem » dans le stockage', async () => {
    window.localStorage.setItem('fixit_vieux_a', '"à retirer"')
    serveur.espace(COMPTE_A).fixit_vieux_a = 'à retirer'
    const sync = await ouvrirLaPage()
    expect((await sync.hydrateStorageFromServer()).ok).toBe(true)

    window.localStorage.setItem('fixit_clients_a', JSON.stringify([{ id: 1, nom: 'Dupré' }]))
    window.localStorage.removeItem('fixit_vieux_a')
    await ecoulerDebounce()

    expect(serveur.espace(COMPTE_A)).toEqual({ fixit_clients_a: [{ id: 1, nom: 'Dupré' }] })
    expect(serveur.de('POST').map(a => a.cles)).toEqual([['fixit_clients_a']])
    expect(serveur.de('DELETE').map(a => a.cles)).toEqual([['fixit_vieux_a']])
    // Le défaut d'avant : l'affectation `localStorage.setItem = …` enregistrait le texte de la fonction.
    expect(lire('setItem')).toBeNull()
    expect(lire('removeItem')).toBeNull()
  })

  it('sessionStorage, clés hors fixit_ et appels incomplets : inchangés', async () => {
    const sync = await ouvrirLaPage()
    await sync.hydrateStorageFromServer()

    window.sessionStorage.setItem('fixit_brouillon_a', '1')
    window.localStorage.setItem('sb-auth-token', 'secret')
    // L'erreur du navigateur passe telle quelle (TypeError du Storage : « 2 arguments required »).
    expect(() => Reflect.apply(window.localStorage.setItem, window.localStorage, ['fixit_incomplet_a'])).toThrow('2 arguments required')
    await ecoulerDebounce()

    expect(window.sessionStorage.getItem('fixit_brouillon_a')).toBe('1')
    expect(lire('sb-auth-token')).toBe('secret')
    expect(lire('fixit_incomplet_a')).toBeNull()
    expect(serveur.de('POST')).toEqual([])
  })

  it('une clé que le serveur refuserait n’est jamais envoyée et ne bloque pas les autres', async () => {
    const sync = await ouvrirLaPage()
    await sync.hydrateStorageFromServer()

    window.localStorage.setItem('fixit_client.dupre@exemple.fr', '1')
    window.localStorage.setItem('fixit_clients_a', '[1]')
    await ecoulerDebounce()

    expect(serveur.de('POST').map(a => a.cles)).toEqual([['fixit_clients_a']])
    expect(lire('fixit_client.dupre@exemple.fr')).toBe('1')
    expect(vi.mocked(console.warn).mock.calls.flat().join(' ')).toContain('fixit_client.dupre@exemple.fr')
  })

  it('un module rechargé à chaud ne s’empile pas : une écriture, un seul envoi', async () => {
    // La première instance est prête à envoyer : si elle recevait encore les écritures, on verrait deux POST.
    const premiere = await ouvrirLaPage()
    await premiere.hydrateStorageFromServer()
    vi.resetModules()
    rappelAuth = null
    const seconde = await ouvrirLaPage()
    await seconde.hydrateStorageFromServer()

    window.localStorage.setItem('fixit_clients_a', '[1]')
    await ecoulerDebounce()

    expect(serveur.de('POST').map(a => a.cles)).toEqual([['fixit_clients_a']])
    premiere.reinitialiserMiroirPourTests()
  })

  it('un module rechargé à chaud : c’est la nouvelle instance qui reçoit les écritures', async () => {
    // La première instance n'a jamais restauré : si elle recevait encore les écritures, rien ne partirait.
    const premiere = await ouvrirLaPage()
    vi.resetModules()
    rappelAuth = null
    const seconde = await ouvrirLaPage()
    await seconde.hydrateStorageFromServer()

    window.localStorage.setItem('fixit_clients_a', '[1]')
    await ecoulerDebounce()

    expect(serveur.de('POST').map(a => a.cles)).toEqual([['fixit_clients_a']])
    premiere.reinitialiserMiroirPourTests()
  })
})

describe('garantie 1 — une restauration en échec ne laisse rien partir', () => {
  it('appareil neuf, serveur en erreur 500 : le jeu par défaut écrit au montage ne remplace pas le vrai catalogue', async () => {
    serveur.espace(COMPTE_A).fixit_catalogue_a = [{ id: 'vrai', libelle: 'Dalle béton' }]
    serveur.panne.GET = 500
    const sync = await ouvrirLaPage()
    // Montage : le composant ne trouve rien dans ce navigateur et écrit son jeu par défaut.
    window.localStorage.setItem('fixit_catalogue_a', JSON.stringify([{ id: 'defaut' }]))

    expect(await sync.hydrateStorageFromServer()).toEqual({ count: 0, ok: false, vide: false, autreCompte: false })
    await ecoulerDebounce()
    await ecoulerDebounce()
    expect(serveur.de('POST')).toEqual([])
    expect(serveur.espace(COMPTE_A).fixit_catalogue_a).toEqual([{ id: 'vrai', libelle: 'Dalle béton' }])

    // Le serveur revient : le nouvel essai (5 s après l'échec) rapporte le vrai catalogue, et rien n'est envoyé.
    serveur.panne.GET = null
    await vi.advanceTimersByTimeAsync(5000)
    expect(JSON.parse(lire('fixit_catalogue_a')!)).toEqual([{ id: 'vrai', libelle: 'Dalle béton' }])
    await ecoulerDebounce()
    expect(serveur.de('POST')).toEqual([])
  })

  it('la restauration est retentée seule : 5 s, 15 s, 1 min, puis toutes les 5 min', async () => {
    serveur.panne.GET = 'reseau'
    const sync = await ouvrirLaPage()
    await sync.hydrateStorageFromServer()
    const essais = () => serveur.de('GET').length
    expect(essais()).toBe(1)

    await vi.advanceTimersByTimeAsync(4900)
    expect(essais()).toBe(1)
    await vi.advanceTimersByTimeAsync(200)
    expect(essais()).toBe(2)
    await vi.advanceTimersByTimeAsync(15_000)
    expect(essais()).toBe(3)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(essais()).toBe(4)
    await vi.advanceTimersByTimeAsync(300_000)
    expect(essais()).toBe(5)
    await vi.advanceTimersByTimeAsync(300_000)
    expect(essais()).toBe(6)
  })

  it('le retour du réseau relance la restauration sans attendre, puis ce qui attendait part', async () => {
    serveur.panne.GET = 'reseau'
    const sync = await ouvrirLaPage()
    await sync.hydrateStorageFromServer()
    await vi.advanceTimersByTimeAsync(5000 + 15_000) // deux nouveaux essais en échec : le suivant est dans 1 min
    window.localStorage.setItem('fixit_clients_a', '[1]')
    await ecoulerDebounce()
    expect(serveur.de('POST')).toEqual([])

    serveur.panne.GET = null
    window.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(0)
    await ecoulerDebounce()

    expect(serveur.espace(COMPTE_A)).toEqual({ fixit_clients_a: [1] })
  })

  it('sans session, rien n’est demandé au serveur et rien n’est retenté', async () => {
    connecter(null)
    const sync = await ouvrirLaPage()
    window.localStorage.setItem('fixit_langue', '"fr"')
    expect((await sync.hydrateStorageFromServer()).ok).toBe(false)
    await vi.advanceTimersByTimeAsync(400_000)
    expect(serveur.appels).toEqual([])
  })

  // Relecture du 14/11/2026 : une réponse 200 sans la liste des valeurs était tenue pour « le serveur ne détient
  // rien », ce qui autorisait « tout envoyer ».
  it.each([
    ['sans le champ entries', { success: true }],
    ['avec entries nul', { entries: null }],
    ['avec une liste à la place de l’objet', { entries: [] }],
  ])('une réponse 200 %s n’est pas un serveur vide : restauration en échec, rien ne part', async (_cas, corps) => {
    serveur.corpsGet = corps
    window.localStorage.setItem('fixit_clients_a', '[{"id":"local"}]')
    const sync = await ouvrirLaPage()
    window.localStorage.setItem('fixit_catalogue_a', '[{"id":"defaut"}]')

    expect(await sync.hydrateStorageFromServer()).toEqual({ count: 0, ok: false, vide: false, autreCompte: false })
    await ecoulerDebounce()
    expect(await sync.pushAllLocalToServer()).toEqual({ count: 0 })
    expect(serveur.de('POST')).toEqual([])

    // Le serveur répond de nouveau normalement : le nouvel essai de restauration (5 s) libère l'envoi.
    serveur.corpsGet = null
    await nouvelEssai()
    expect(serveur.espace(COMPTE_A)).toEqual({ fixit_catalogue_a: [{ id: 'defaut' }] })
  })
})

describe('garantie 2 — une saisie pas encore envoyée n’est pas effacée par la restauration suivante', () => {
  const CLIENTS = 'fixit_clients_a'

  /** Page ouverte et à jour avec le serveur, puis une saisie dont l'envoi échoue (réseau coupé). */
  async function saisirSansReseau(): Promise<ModuleSync> {
    serveur.espace(COMPTE_A)[CLIENTS] = [{ id: 1 }]
    const sync = await ouvrirLaPage()
    await sync.hydrateStorageFromServer()
    expect(lire(CLIENTS)).toBe('[{"id":1}]')
    serveur.panne.POST = 'reseau'
    window.localStorage.setItem(CLIENTS, JSON.stringify([{ id: 1 }, { id: 2 }]))
    await ecoulerDebounce()
    expect(serveur.de('POST')).toHaveLength(1) // l'envoi a bien été tenté
    return sync
  }

  it('retour sur l’onglet, serveur inchangé : la saisie reste à l’écran et finit par arriver au serveur', async () => {
    const sync = await saisirSansReseau()

    expect((await sync.hydrateStorageFromServer()).ok).toBe(true) // avant : la liste revenait à [{ id: 1 }]
    expect(JSON.parse(lire(CLIENTS)!)).toEqual([{ id: 1 }, { id: 2 }])

    serveur.panne.POST = null
    await ecoulerDebounce()
    expect(serveur.espace(COMPTE_A)[CLIENTS]).toEqual([{ id: 1 }, { id: 2 }])
    // Le nouvel essai qui était programmé n'a plus lieu d'être : le serveur n'est pas relu une fois de plus.
    const appels = serveur.appels.length
    await vi.advanceTimersByTimeAsync(400_000)
    expect(serveur.appels).toHaveLength(appels)
  })

  it('un autre appareil a écrit entre-temps : le serveur gagne, la saisie locale n’est pas renvoyée par-dessus', async () => {
    const sync = await saisirSansReseau()
    serveur.espace(COMPTE_A)[CLIENTS] = [{ id: 1 }, { id: 9 }]

    await sync.hydrateStorageFromServer()
    expect(JSON.parse(lire(CLIENTS)!)).toEqual([{ id: 1 }, { id: 9 }])

    serveur.panne.POST = null
    await vi.advanceTimersByTimeAsync(10_000)
    expect(serveur.de('POST')).toHaveLength(1)
    expect(serveur.espace(COMPTE_A)[CLIENTS]).toEqual([{ id: 1 }, { id: 9 }])
  })

  // Relecture du 14/11/2026 : le nouvel essai d'un envoi en échec repartait sans relire le serveur. Il tombe 5 s après
  // l'échec, donc avant tout retour sur l'onglet : il écrasait ce qu'un autre appareil venait d'écrire.
  it('un autre appareil a écrit, puis le nouvel essai d’envoi tombe avant toute restauration : le serveur est relu, il gagne', async () => {
    await saisirSansReseau()
    serveur.espace(COMPTE_A)[CLIENTS] = [{ id: 1 }, { id: 9 }]
    serveur.panne.POST = null

    await nouvelEssai()
    expect(serveur.espace(COMPTE_A)[CLIENTS]).toEqual([{ id: 1 }, { id: 9 }])
    expect(JSON.parse(lire(CLIENTS)!)).toEqual([{ id: 1 }, { id: 9 }])
    expect(serveur.de('POST')).toHaveLength(1)
    // Plus rien n'attend : aucun autre essai.
    await vi.advanceTimersByTimeAsync(400_000)
    expect(serveur.de('POST')).toHaveLength(1)

    // La série d'échecs est close : une nouvelle panne repart du premier délai (5 s).
    serveur.panne.POST = 'reseau'
    window.localStorage.setItem(CLIENTS, JSON.stringify([{ id: 1 }, { id: 9 }, { id: 3 }]))
    await ecoulerDebounce()
    serveur.panne.POST = null
    await nouvelEssai()
    expect(serveur.espace(COMPTE_A)[CLIENTS]).toEqual([{ id: 1 }, { id: 9 }, { id: 3 }])
  })

  it('nouvel essai d’envoi, serveur inchangé : il est relu, puis la saisie arrive', async () => {
    await saisirSansReseau()
    serveur.panne.POST = null
    const lectures = serveur.de('GET').length

    await nouvelEssai()
    expect(serveur.de('GET')).toHaveLength(lectures + 1)
    expect(serveur.espace(COMPTE_A)[CLIENTS]).toEqual([{ id: 1 }, { id: 2 }])

    // L'envoi a réussi : la série d'échecs est close, une nouvelle panne repart du premier délai (5 s).
    serveur.panne.POST = 'reseau'
    window.localStorage.setItem(CLIENTS, JSON.stringify([{ id: 1 }, { id: 2 }, { id: 3 }]))
    await ecoulerDebounce()
    serveur.panne.POST = null
    await nouvelEssai()
    expect(serveur.espace(COMPTE_A)[CLIENTS]).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }])
  })

  it('saisie faite juste avant de quitter l’onglet (moins de 3 s) : notée aussitôt, protégée à la visite suivante', async () => {
    serveur.espace(COMPTE_A)[CLIENTS] = [{ id: 1 }]
    const sync = await ouvrirLaPage()
    await sync.hydrateStorageFromServer()
    serveur.panne.POST = 'reseau'
    window.localStorage.setItem(CLIENTS, JSON.stringify([{ id: 1 }, { id: 2 }]))
    expect(etat()!.attente).toEqual({})

    cacherLOnglet() // sans attendre les 3 s de la note différée
    await vi.advanceTimersByTimeAsync(0)
    expect(Object.keys(etat()!.attente)).toEqual([CLIENTS])

    const page = await rechargerLaPage()
    serveur.panne.POST = null
    await page.hydrateStorageFromServer()
    expect(JSON.parse(lire(CLIENTS)!)).toEqual([{ id: 1 }, { id: 2 }])
    await ecoulerDebounce()
    expect(serveur.espace(COMPTE_A)[CLIENTS]).toEqual([{ id: 1 }, { id: 2 }])
  })

  it('saisie faite avant une première restauration en échec : notée quand même, protégée après rechargement', async () => {
    serveur.espace(COMPTE_A)[CLIENTS] = [{ id: 1 }]
    window.localStorage.setItem(CLIENTS, '[{"id":1}]') // à jour depuis une visite précédente
    serveur.panne.GET = 503
    const sync = await ouvrirLaPage()
    // La saisie précède la restauration : à cet instant le miroir ne connaît pas encore le compte.
    window.localStorage.setItem(CLIENTS, JSON.stringify([{ id: 1 }, { id: 2 }]))
    await sync.hydrateStorageFromServer()
    await vi.advanceTimersByTimeAsync(3000)
    expect(Object.keys(etat()!.attente)).toEqual([CLIENTS])

    const page = await rechargerLaPage()
    serveur.panne.GET = null
    await page.hydrateStorageFromServer()
    expect(JSON.parse(lire(CLIENTS)!)).toEqual([{ id: 1 }, { id: 2 }])
    await ecoulerDebounce()
    expect(serveur.espace(COMPTE_A)[CLIENTS]).toEqual([{ id: 1 }, { id: 2 }])
  })

  it('clé supprimée (suppression confirmée) puis recréée ici sans réseau, et recréée entre-temps sur un autre appareil : le serveur gagne', async () => {
    const NOTE = 'fixit_note_a'
    serveur.espace(COMPTE_A)[NOTE] = 'x'
    const sync = await ouvrirLaPage()
    await sync.hydrateStorageFromServer()
    let liberer: () => void = () => {}
    serveur.avantReponse = (appel) => (appel.methode === 'DELETE' ? new Promise<void>((ok) => { liberer = ok }) : undefined)

    window.localStorage.removeItem(NOTE)
    await ecoulerDebounce() // suppression partie, réponse pas encore arrivée
    serveur.panne.POST = 'reseau'
    window.localStorage.setItem(NOTE, 'y') // recréée ici pendant l'appel
    liberer() // la suppression est confirmée : le serveur ne détient plus rien pour cette clé
    await ecoulerDebounce() // l'envoi de la nouvelle valeur échoue
    expect(serveur.espace(COMPTE_A)).toEqual({})

    // Un autre appareil recrée la clé, avec la valeur d'avant la suppression.
    serveur.espace(COMPTE_A)[NOTE] = 'x'
    serveur.panne.POST = null
    await nouvelEssai()
    // Ce que cet appareil savait du serveur, c'est « plus rien » : il détient maintenant autre chose, il gagne.
    expect(lire(NOTE)).toBe('x')
    expect(serveur.espace(COMPTE_A)[NOTE]).toBe('x')
  })

  it('après un rechargement de la page : la note gardée dans le navigateur protège la saisie, puis s’efface', async () => {
    await saisirSansReseau()
    await vi.advanceTimersByTimeAsync(3000) // l'envoi n'est toujours pas confirmé : la note est écrite
    expect(etat()).toMatchObject({ compte: COMPTE_A, comptes: [COMPTE_A] })
    expect(Object.keys(etat()!.attente)).toEqual([CLIENTS])

    const sync = await rechargerLaPage()
    serveur.panne.POST = null
    await sync.hydrateStorageFromServer()
    expect(JSON.parse(lire(CLIENTS)!)).toEqual([{ id: 1 }, { id: 2 }])
    await ecoulerDebounce()
    expect(serveur.espace(COMPTE_A)[CLIENTS]).toEqual([{ id: 1 }, { id: 2 }])

    await vi.advanceTimersByTimeAsync(3000)
    expect(etat()!.attente).toEqual({})
  })

  // Relecture du 16/11/2026 : la note gardée dans le navigateur donne aussi l'empreinte de la modification, et seule
  // celle-ci repart après un rechargement. L'état suit donc chaque nouvelle saisie de la clé, pas seulement la première.
  it('nouvelle saisie sur une clé déjà notée, puis onglet tué sans événement de fermeture : la dernière saisie part à la visite suivante', async () => {
    serveur.espace(COMPTE_A)[CLIENTS] = [{ id: 1 }]
    const sync = await ouvrirLaPage()
    await sync.hydrateStorageFromServer()
    // Réseau très lent : aucun envoi n'aboutit avant que l'onglet ne soit tué.
    serveur.avantReponse = (appel) => (appel.methode === 'POST' ? new Promise<void>(() => {}) : undefined)
    window.localStorage.setItem(CLIENTS, JSON.stringify([{ id: 1 }, { id: 2 }]))
    await vi.advanceTimersByTimeAsync(3000) // envoi parti, note écrite
    window.localStorage.setItem(CLIENTS, JSON.stringify([{ id: 1 }, { id: 2 }, { id: 3 }]))
    await vi.advanceTimersByTimeAsync(3000) // second envoi parti, l'état suit la dernière saisie

    serveur.avantReponse = null
    const page = await rechargerLaPage()
    await page.hydrateStorageFromServer()
    await ecoulerDebounce()
    expect(serveur.espace(COMPTE_A)[CLIENTS]).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }])
    expect(JSON.parse(lire(CLIENTS)!)).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }])
  })

  // Un état écrit sans l'empreinte de la modification reste lisible (comptes, notes) : sa note ne fait alors rien
  // repartir, le serveur gagne.
  it('après un rechargement, un état sans l’empreinte de la modification reste lisible, et sa note ne fait rien repartir', async () => {
    await saisirSansReseau()
    await vi.advanceTimersByTimeAsync(3000) // la note est écrite, avec l'empreinte de la modification
    const ecrit = JSON.parse(lire(CLE_ETAT)!) as Record<string, unknown>
    expect(Object.keys(ecrit.valeurs as Record<string, string>)).toEqual([CLIENTS])
    delete ecrit.valeurs
    ecrit.comptes = [COMPTE_B, COMPTE_A]
    ecritureDUnAutreOnglet(CLE_ETAT, JSON.stringify(ecrit))

    const sync = await rechargerLaPage()
    serveur.panne.POST = null
    expect(await sync.hydrateStorageFromServer()).toMatchObject({ ok: true, autreCompte: true })
    await ecoulerDebounce()
    expect(JSON.parse(lire(CLIENTS)!)).toEqual([{ id: 1 }])
    expect(serveur.espace(COMPTE_A)[CLIENTS]).toEqual([{ id: 1 }])
    expect(serveur.de('POST')).toHaveLength(1)
  })

  it('après un rechargement, si le serveur a changé entre-temps, il gagne et la note est retirée', async () => {
    await saisirSansReseau()
    await vi.advanceTimersByTimeAsync(3000)
    serveur.espace(COMPTE_A)[CLIENTS] = [{ id: 7 }]

    const sync = await rechargerLaPage()
    serveur.panne.POST = null
    await sync.hydrateStorageFromServer()
    expect(JSON.parse(lire(CLIENTS)!)).toEqual([{ id: 7 }])
    await ecoulerDebounce()
    expect(serveur.espace(COMPTE_A)[CLIENTS]).toEqual([{ id: 7 }])
    expect(etat()!.attente).toEqual({})
  })

  it('la base range les clés des objets autrement que l’application : la valeur est tout de même reconnue', async () => {
    const FICHE = 'fixit_societe_a'
    const sync = await ouvrirLaPage()
    await sync.hydrateStorageFromServer()
    // Premier enregistrement, dans l'ordre de l'application ; le serveur le range dans le sien.
    window.localStorage.setItem(FICHE, '{"raison_sociale":"Dupré","id":1}')
    await ecoulerDebounce()
    expect(JSON.stringify(serveur.espace(COMPTE_A)[FICHE])).toBe('{"id":1,"raison_sociale":"Dupré"}')
    // Plus rien n'attend : aucune note n'est gardée dans le navigateur. La saisie suivante ne sera donc reconnue
    // que par la comparaison des valeurs elles-mêmes, pas par une note.
    await vi.advanceTimersByTimeAsync(3000)
    expect(etat()!.attente).toEqual({})

    serveur.panne.POST = 'reseau'
    window.localStorage.setItem(FICHE, '{"raison_sociale":"Dupré SARL","id":1}')
    await ecoulerDebounce()

    await sync.hydrateStorageFromServer()
    expect(lire(FICHE)).toBe('{"raison_sociale":"Dupré SARL","id":1}')
    serveur.panne.POST = null
    await ecoulerDebounce()
    expect(serveur.espace(COMPTE_A)[FICHE]).toEqual({ id: 1, raison_sociale: 'Dupré SARL' })
  })

  it('une suppression pas encore envoyée n’est pas annulée par la restauration', async () => {
    serveur.espace(COMPTE_A).fixit_note_a = 'à supprimer'
    const sync = await ouvrirLaPage()
    await sync.hydrateStorageFromServer()
    serveur.panne.DELETE = 500
    window.localStorage.removeItem('fixit_note_a')
    await ecoulerDebounce()
    expect(serveur.de('DELETE')).toHaveLength(1)

    await sync.hydrateStorageFromServer()
    expect(lire('fixit_note_a')).toBeNull() // avant : la note revenait du serveur

    serveur.panne.DELETE = null
    await ecoulerDebounce()
    expect(serveur.espace(COMPTE_A)).toEqual({})
  })

  it('saisie faite avant la première restauration, sur un appareil à jour : conservée quand le serveur revient', async () => {
    serveur.espace(COMPTE_A)[CLIENTS] = [{ id: 1 }]
    window.localStorage.setItem(CLIENTS, '[{"id":1}]') // à jour depuis une visite précédente
    serveur.panne.GET = 503
    const sync = await ouvrirLaPage()
    await sync.hydrateStorageFromServer() // le serveur ne répond pas
    window.localStorage.setItem(CLIENTS, JSON.stringify([{ id: 1 }, { id: 2 }])) // l'utilisateur saisit quand même

    serveur.panne.GET = null
    await vi.advanceTimersByTimeAsync(5000) // nouvel essai de restauration, réussi
    expect(JSON.parse(lire(CLIENTS)!)).toEqual([{ id: 1 }, { id: 2 }])
    await ecoulerDebounce()
    expect(serveur.espace(COMPTE_A)[CLIENTS]).toEqual([{ id: 1 }, { id: 2 }])
  })

  it('saisie faite pendant qu’un envoi est en cours : protégée elle aussi', async () => {
    serveur.espace(COMPTE_A)[CLIENTS] = [{ id: 1 }]
    const sync = await ouvrirLaPage()
    await sync.hydrateStorageFromServer()
    let liberer: () => void = () => {}
    serveur.avantReponse = (appel) =>
      (appel.methode === 'POST' && serveur.de('POST').length === 1 ? new Promise<void>((ok) => { liberer = ok }) : undefined)

    window.localStorage.setItem(CLIENTS, JSON.stringify([{ id: 1 }, { id: 2 }]))
    await ecoulerDebounce() // premier envoi parti, réponse pas encore arrivée
    window.localStorage.setItem(CLIENTS, JSON.stringify([{ id: 1 }, { id: 2 }, { id: 3 }]))
    liberer() // le premier envoi arrive au serveur
    await vi.advanceTimersByTimeAsync(0)
    serveur.panne.POST = 'reseau'
    await ecoulerDebounce() // l'envoi de la seconde saisie échoue

    await sync.hydrateStorageFromServer() // retour sur l'onglet : le serveur détient la première saisie
    expect(JSON.parse(lire(CLIENTS)!)).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }])
    serveur.panne.POST = null
    await ecoulerDebounce()
    expect(serveur.espace(COMPTE_A)[CLIENTS]).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }])
  })

  // Relecture du 15/11/2026 : quand deux envois de la même clé se chevauchaient (valeur volumineuse, réseau lent), la
  // confirmation du premier effaçait la note de la clé alors que le second était encore en route. La relecture suivante
  // du serveur (nouvel essai, retour sur l'onglet) y trouvait la première saisie et la faisait gagner : la dernière était
  // remplacée dans le navigateur et, si son envoi échouait, n'atteignait jamais le serveur.
  describe('deux envois de la même clé qui se chevauchent : le premier arrive, le second est encore en route', () => {
    /** `avantLArriveeDuPremier` : ce qui se passe ailleurs juste avant que le premier envoi n'arrive au serveur. */
    async function deuxEnvoisEnRoute(avantLArriveeDuPremier?: () => void): Promise<{ sync: ModuleSync; liberer: Array<() => void> }> {
      serveur.espace(COMPTE_A)[CLIENTS] = [{ id: 1 }]
      const sync = await ouvrirLaPage()
      await sync.hydrateStorageFromServer()
      const liberer: Array<() => void> = []
      serveur.avantReponse = (appel) =>
        (appel.methode === 'POST' && serveur.de('POST').length <= 2 ? new Promise<void>((ok) => { liberer.push(ok) }) : undefined)

      window.localStorage.setItem(CLIENTS, JSON.stringify([{ id: 1 }, { id: 2 }]))
      await ecoulerDebounce() // premier envoi parti, réponse retenue
      window.localStorage.setItem(CLIENTS, JSON.stringify([{ id: 1 }, { id: 2 }, { id: 3 }]))
      await ecoulerDebounce() // second envoi parti à son tour, avant la réponse du premier
      expect(serveur.de('POST')).toHaveLength(2)
      avantLArriveeDuPremier?.()
      liberer[0]() // le premier arrive au serveur
      await vi.advanceTimersByTimeAsync(0)
      expect(serveur.espace(COMPTE_A)[CLIENTS]).toEqual([{ id: 1 }, { id: 2 }])
      return { sync, liberer }
    }

    /** Le second envoi revient en échec (réseau coupé). */
    async function faireEchouerLeSecond(liberer: Array<() => void>): Promise<void> {
      serveur.panne.POST = 'reseau'
      liberer[1]()
      await vi.advanceTimersByTimeAsync(0)
      serveur.panne.POST = null
    }

    it('le second échoue : au nouvel essai, le serveur relu détient la première saisie, la dernière part quand même', async () => {
      const { liberer } = await deuxEnvoisEnRoute()
      await faireEchouerLeSecond(liberer)

      await nouvelEssai()
      expect(JSON.parse(lire(CLIENTS)!)).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }])
      expect(serveur.espace(COMPTE_A)[CLIENTS]).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }])
    })

    it('le serveur est relu pendant le second (retour sur l’onglet) : la dernière saisie reste, et part même si cet envoi échoue', async () => {
      const { sync, liberer } = await deuxEnvoisEnRoute()

      await sync.hydrateStorageFromServer()
      expect(JSON.parse(lire(CLIENTS)!)).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }])

      await faireEchouerLeSecond(liberer)
      await nouvelEssai()
      expect(serveur.espace(COMPTE_A)[CLIENTS]).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }])
    })

    it('onglet tué pendant le second (sans événement de fermeture) : la note gardée dans le navigateur protège la dernière saisie', async () => {
      await deuxEnvoisEnRoute()
      await vi.advanceTimersByTimeAsync(3000) // la note suit la valeur que le serveur détient désormais

      const page = await rechargerLaPage()
      await page.hydrateStorageFromServer()
      expect(JSON.parse(lire(CLIENTS)!)).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }])
      await ecoulerDebounce()
      expect(serveur.espace(COMPTE_A)[CLIENTS]).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }])
    })

    // Relecture du 16/11/2026 : un autre onglet du même compte peut réécrire l'ancienne valeur du serveur à la place de
    // la dernière saisie (sa restauration, lue avant l'arrivée du premier envoi). Ni la confirmation du premier, ni la
    // note qu'elle garde pour le second ne doivent alors la faire renvoyer par-dessus les saisies.
    it.each(['avant', 'après'] as const)('un autre onglet réécrit l’ancienne valeur %s l’arrivée du premier : elle n’est jamais renvoyée, la dernière saisie l’emporte', async (moment) => {
      const ecrireLAncienne = () => ecritureDUnAutreOnglet(CLIENTS, '[{"id":1}]')
      const { sync, liberer } = await deuxEnvoisEnRoute(moment === 'avant' ? ecrireLAncienne : undefined)
      if (moment === 'après') ecrireLAncienne()

      await sync.hydrateStorageFromServer() // retour sur l'onglet, le second encore en route
      await ecoulerDebounce()
      liberer[1]() // le second arrive au serveur
      await vi.advanceTimersByTimeAsync(0)
      expect(serveur.de('POST')).toHaveLength(2)
      expect(serveur.espace(COMPTE_A)[CLIENTS]).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }])

      await sync.hydrateStorageFromServer()
      expect(JSON.parse(lire(CLIENTS)!)).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }])
    })

    it('une suppression faite pendant l’envoi de la saisie, puis en échec : au nouvel essai, le serveur relu détient la saisie, la suppression part quand même', async () => {
      serveur.espace(COMPTE_A)[CLIENTS] = [{ id: 1 }]
      const sync = await ouvrirLaPage()
      await sync.hydrateStorageFromServer()
      const liberer: Array<() => void> = []
      serveur.avantReponse = (appel) => (appel.methode !== 'GET' ? new Promise<void>((ok) => { liberer.push(ok) }) : undefined)

      window.localStorage.setItem(CLIENTS, JSON.stringify([{ id: 1 }, { id: 2 }]))
      await ecoulerDebounce() // la saisie part, réponse retenue
      window.localStorage.removeItem(CLIENTS)
      await ecoulerDebounce() // la suppression part à son tour
      liberer[0]() // la saisie arrive au serveur
      await vi.advanceTimersByTimeAsync(0)
      serveur.panne.DELETE = 'reseau'
      liberer[1]() // la suppression échoue
      await vi.advanceTimersByTimeAsync(0)
      serveur.panne.DELETE = null
      serveur.avantReponse = null
      expect(serveur.espace(COMPTE_A)[CLIENTS]).toEqual([{ id: 1 }, { id: 2 }])

      await nouvelEssai()
      expect(lire(CLIENTS)).toBeNull()
      expect(serveur.espace(COMPTE_A)).toEqual({})
    })

    it('un autre onglet réécrit l’ancienne valeur avant l’arrivée du premier, puis la page est rechargée : aucune note ne la fait renvoyer', async () => {
      await deuxEnvoisEnRoute(() => ecritureDUnAutreOnglet(CLIENTS, '[{"id":1}]'))
      await vi.advanceTimersByTimeAsync(3000) // délai de l'état gardé dans le navigateur
      expect(etat()!.attente).toEqual({})

      const page = await rechargerLaPage()
      await page.hydrateStorageFromServer()
      await ecoulerDebounce()
      expect(serveur.espace(COMPTE_A)[CLIENTS]).toEqual([{ id: 1 }, { id: 2 }])
      expect(JSON.parse(lire(CLIENTS)!)).toEqual([{ id: 1 }, { id: 2 }])
      expect(serveur.de('POST')).toHaveLength(2)
    })
  })

  // Relecture du 16/11/2026 : depuis la retouche du 15/11, la confirmation d'un envoi gardait la note de la clé dès que
  // le navigateur détenait une autre valeur que celle confirmée, même écrite par un autre onglet. La restauration d'un
  // autre onglet du même compte (ouverture, jeton rafraîchi, fenêtre restée visible), lue avant l'arrivée de l'envoi, y
  // remet l'ancienne valeur du serveur : la relecture suivante la prenait pour une modification faite ici et la renvoyait
  // par-dessus la saisie que le serveur venait d'enregistrer, sans aucun message. Seule une valeur plus récente écrite
  // dans cet onglet retient maintenant la note (les cas des deux envois qui se chevauchent, ci-dessus), ou une valeur
  // que cet onglet ne connaît pas, laissée en place une fois sans repartir d'ici (tests/storage-sync-onglets.test.ts) —
  // jamais une valeur que le serveur détenait avant.
  describe('un autre onglet du même compte réécrit l’ancienne valeur du serveur pendant qu’une saisie part', () => {
    /** La saisie part et arrive au serveur ; l'autre onglet, qui l'a relu avant, réécrit l'ancienne valeur. */
    async function saisieRecouverteParUnAutreOnglet(moment: 'avant' | 'pendant'): Promise<ModuleSync> {
      serveur.espace(COMPTE_A)[CLIENTS] = [{ id: 1 }]
      const sync = await ouvrirLaPage()
      await sync.hydrateStorageFromServer()
      let liberer: () => void = () => {}
      serveur.avantReponse = (appel) => (appel.methode === 'POST' ? new Promise<void>((ok) => { liberer = ok }) : undefined)

      window.localStorage.setItem(CLIENTS, JSON.stringify([{ id: 1 }, { id: 2 }]))
      if (moment === 'avant') ecritureDUnAutreOnglet(CLIENTS, '[{"id":1}]')
      await ecoulerDebounce() // la saisie part, réponse retenue
      if (moment === 'pendant') ecritureDUnAutreOnglet(CLIENTS, '[{"id":1}]')
      serveur.avantReponse = null
      liberer() // la saisie arrive au serveur
      await vi.advanceTimersByTimeAsync(0)
      expect(serveur.espace(COMPTE_A)[CLIENTS]).toEqual([{ id: 1 }, { id: 2 }])
      expect(lire(CLIENTS)).toBe('[{"id":1}]')
      return sync
    }

    it.each(['avant', 'pendant'] as const)('l’autre onglet écrit %s l’envoi : la relecture suivante remet la saisie à l’écran, sans l’écraser au serveur', async (moment) => {
      const sync = await saisieRecouverteParUnAutreOnglet(moment)

      await sync.hydrateStorageFromServer() // retour sur l'onglet
      await ecoulerDebounce()
      expect(serveur.espace(COMPTE_A)[CLIENTS]).toEqual([{ id: 1 }, { id: 2 }])
      expect(JSON.parse(lire(CLIENTS)!)).toEqual([{ id: 1 }, { id: 2 }])
      expect(serveur.de('POST')).toHaveLength(1)
    })

    it('page rechargée après la confirmation : aucune note gardée ne fait renvoyer l’ancienne valeur', async () => {
      await saisieRecouverteParUnAutreOnglet('pendant')
      await vi.advanceTimersByTimeAsync(3000) // délai de l'état gardé dans le navigateur
      expect(etat()!.attente).toEqual({})

      const page = await rechargerLaPage()
      await page.hydrateStorageFromServer()
      await ecoulerDebounce()
      expect(serveur.espace(COMPTE_A)[CLIENTS]).toEqual([{ id: 1 }, { id: 2 }])
      expect(JSON.parse(lire(CLIENTS)!)).toEqual([{ id: 1 }, { id: 2 }])
    })
  })

  it('clé créée ici et jamais partie, page rechargée : elle part à la visite suivante', async () => {
    const sync = await ouvrirLaPage()
    await sync.hydrateStorageFromServer()
    serveur.panne.POST = 'reseau'
    window.localStorage.setItem('fixit_note_chantier_a', '"créée sans réseau"')
    await ecoulerDebounce()
    await vi.advanceTimersByTimeAsync(3000)

    const page = await rechargerLaPage()
    serveur.panne.POST = null
    await page.hydrateStorageFromServer()
    await ecoulerDebounce()
    expect(serveur.espace(COMPTE_A)).toEqual({ fixit_note_chantier_a: 'créée sans réseau' })
  })

  it('suppression pas encore envoyée, page rechargée : elle part à la visite suivante', async () => {
    serveur.espace(COMPTE_A).fixit_note_a = 'à supprimer'
    const sync = await ouvrirLaPage()
    await sync.hydrateStorageFromServer()
    serveur.panne.DELETE = 'reseau'
    window.localStorage.removeItem('fixit_note_a')
    await ecoulerDebounce()
    await vi.advanceTimersByTimeAsync(3000) // la suppression n'est pas confirmée : la note est écrite

    const page = await rechargerLaPage()
    serveur.panne.DELETE = null
    await page.hydrateStorageFromServer()
    expect(lire('fixit_note_a')).toBeNull()
    await ecoulerDebounce()
    expect(serveur.espace(COMPTE_A)).toEqual({})
  })

  it('une valeur déjà identique à celle du serveur n’est pas renvoyée', async () => {
    serveur.espace(COMPTE_A)[CLIENTS] = [{ id: 1 }]
    window.localStorage.setItem(CLIENTS, '[{"id":1}]')
    const sync = await ouvrirLaPage()
    // Montage : le composant relit puis réécrit la même liste.
    window.localStorage.setItem(CLIENTS, '[{"id":1}]')
    await sync.hydrateStorageFromServer()
    await ecoulerDebounce()
    expect(serveur.de('POST')).toEqual([])
  })
})

// Relecture adverse du 17/11/2026 (sixième passe, scénario P1) : un envoi arrive au serveur mais sa réponse se perd
// (coupure juste après l'envoi, passage du wifi au réseau mobile, appli mise en arrière-plan) ; fetch échoue comme sans
// réseau. La relecture du nouvel essai trouvait alors au serveur la valeur envoyée par cet onglet, la prenait pour une
// écriture faite ailleurs et abandonnait la saisie faite depuis ; le navigateur reprenait l'ancienne valeur.
describe('garantie 2 — réponse perdue : l’envoi est arrivé, cet onglet ne le sait pas', () => {
  const CLIENTS = 'fixit_clients_a'

  it.each([
    ['une nouvelle valeur', [{ id: 1 }, { id: 2 }, { id: 3 }]],
    ['un retour à la valeur d’avant', [{ id: 1 }]],
  ] as const)('l’utilisateur saisit ensuite %s : au nouvel essai, elle part et reste à l’écran', async (_nom, derniere) => {
    serveur.espace(COMPTE_A)[CLIENTS] = [{ id: 1 }]
    const sync = await ouvrirLaPage()
    await sync.hydrateStorageFromServer()
    serveur.reponsesPerdues = 1
    window.localStorage.setItem(CLIENTS, JSON.stringify([{ id: 1 }, { id: 2 }]))
    await ecoulerDebounce() // l'envoi est enregistré, sa réponse se perd
    expect(serveur.espace(COMPTE_A)[CLIENTS]).toEqual([{ id: 1 }, { id: 2 }])

    window.localStorage.setItem(CLIENTS, JSON.stringify(derniere))
    await nouvelEssai()
    expect(serveur.espace(COMPTE_A)[CLIENTS]).toEqual(derniere)
    expect(JSON.parse(lire(CLIENTS)!)).toEqual(derniere)
    await sync.hydrateStorageFromServer()
    expect(JSON.parse(lire(CLIENTS)!)).toEqual(derniere)
  })

  it('liste de clients que la base range dans un autre ordre (le nom avant l’identifiant) : la saisie suivante part aussi', async () => {
    const client = (id: number) => ({ nom: `Client ${id}`, id })
    serveur.espace(COMPTE_A)[CLIENTS] = [client(1)]
    const sync = await ouvrirLaPage()
    await sync.hydrateStorageFromServer()
    serveur.reponsesPerdues = 1
    window.localStorage.setItem(CLIENTS, JSON.stringify([client(1), client(2)]))
    await ecoulerDebounce() // l'envoi est enregistré, sa réponse se perd
    expect(JSON.stringify(serveur.espace(COMPTE_A)[CLIENTS])).not.toBe(JSON.stringify([client(1), client(2)]))

    window.localStorage.setItem(CLIENTS, JSON.stringify([client(1), client(2), client(3)]))
    await nouvelEssai()
    expect(serveur.espace(COMPTE_A)[CLIENTS]).toEqual([client(1), client(2), client(3)])
    expect(JSON.parse(lire(CLIENTS)!)).toEqual([client(1), client(2), client(3)])
  })

  it('un autre appareil écrit après la saisie perdue : il gagne, comme avant', async () => {
    serveur.espace(COMPTE_A)[CLIENTS] = [{ id: 1 }]
    const sync = await ouvrirLaPage()
    await sync.hydrateStorageFromServer()
    serveur.reponsesPerdues = 1
    window.localStorage.setItem(CLIENTS, JSON.stringify([{ id: 1 }, { id: 2 }]))
    await ecoulerDebounce()
    window.localStorage.setItem(CLIENTS, JSON.stringify([{ id: 1 }, { id: 2 }, { id: 3 }]))
    serveur.espace(COMPTE_A)[CLIENTS] = [{ id: 1 }, { id: 9 }]
    await nouvelEssai()

    expect(serveur.espace(COMPTE_A)[CLIENTS]).toEqual([{ id: 1 }, { id: 9 }])
    expect(JSON.parse(lire(CLIENTS)!)).toEqual([{ id: 1 }, { id: 9 }])
  })
})

// Relecture adverse du 17/11/2026 (sixième passe, remarque sur le format de l'état) : la réécriture de l'état perdait
// les champs qu'elle ne connaissait pas, et un état d'un autre numéro de version était pris pour absent puis écrasé,
// avec la liste des comptes vus qui empêche « tout envoyer » de recopier les clés d'un autre compte (garantie 4). Sans
// effet tant qu'aucune autre version du site n'écrit l'état ; utile le jour où son format changera.
describe('garantie 2 — état gardé dans le navigateur, écrit par une autre version du site', () => {
  const CLIENTS = 'fixit_clients_a'

  /** Page ouverte et restaurée, puis une saisie dont l'envoi échoue : sa note est écrite dans l'état 3 s plus tard. */
  async function saisieNoteeDansLEtat(): Promise<ModuleSync> {
    serveur.espace(COMPTE_A)[CLIENTS] = [{ id: 1 }]
    const sync = await ouvrirLaPage()
    await sync.hydrateStorageFromServer()
    serveur.panne.POST = 'reseau'
    window.localStorage.setItem(CLIENTS, JSON.stringify([{ id: 1 }, { id: 2 }]))
    await ecoulerDebounce()
    await vi.advanceTimersByTimeAsync(3000)
    return sync
  }

  it('même numéro de version, avec un champ que cette version ne connaît pas : réécrit sans perdre ce champ', async () => {
    ecritureDUnAutreOnglet(CLE_ETAT, JSON.stringify({ v: 1, compte: COMPTE_A, comptes: [COMPTE_A], attente: {}, futur: { a: 1 } }))
    await saisieNoteeDansLEtat()

    const ecrit = JSON.parse(lire(CLE_ETAT)!) as { futur?: unknown; attente: Record<string, string> }
    expect(Object.keys(ecrit.attente)).toEqual([CLIENTS])
    expect(ecrit.futur).toEqual({ a: 1 })
  })

  it('autre numéro de version : jamais écrasé, et le compte qui y figure compte toujours comme un autre compte vu ici', async () => {
    const autreVersion = JSON.stringify({ v: 2, comptes: [COMPTE_B], ailleurs: true })
    ecritureDUnAutreOnglet(CLE_ETAT, autreVersion)
    serveur.espace(COMPTE_A)[CLIENTS] = [{ id: 1 }]
    const sync = await ouvrirLaPage()
    expect((await sync.hydrateStorageFromServer()).autreCompte).toBe(true)

    serveur.panne.POST = 'reseau'
    window.localStorage.setItem(CLIENTS, JSON.stringify([{ id: 1 }, { id: 2 }]))
    await ecoulerDebounce()
    await vi.advanceTimersByTimeAsync(3000)
    await sync.hydrateStorageFromServer()
    expect(lire(CLE_ETAT)).toBe(autreVersion)
  })
})

describe('garantie 3 — un envoi en échec est retenté, une valeur refusée ne bloque pas les autres', () => {
  // 422 : c'est ce que répond la route quand la base refuse le contenu d'une valeur (relecture du 14/11/2026).
  it.each([400, 413, 422])('une valeur refusée (%i) dans un envoi groupé : les autres arrivent quand même, et rien ne boucle', async (statut) => {
    serveur.refusees.set('fixit_piece_invalide_a', statut)
    const sync = await ouvrirLaPage()
    await sync.hydrateStorageFromServer()

    window.localStorage.setItem('fixit_clients_a', '[1]')
    window.localStorage.setItem('fixit_piece_invalide_a', '"x"')
    window.localStorage.setItem('fixit_depenses_a', '[2]')
    await ecoulerDebounce()

    // Avant : le refus faisait perdre en silence les trois valeurs.
    expect(serveur.espace(COMPTE_A)).toEqual({ fixit_clients_a: [1], fixit_depenses_a: [2] })
    expect(serveur.de('POST').map(a => a.cles)).toEqual([
      ['fixit_clients_a', 'fixit_piece_invalide_a', 'fixit_depenses_a'],
      ['fixit_clients_a'], ['fixit_piece_invalide_a'], ['fixit_depenses_a'],
    ])
    expect(lire('fixit_piece_invalide_a')).toBe('"x"') // elle reste dans le navigateur

    await vi.advanceTimersByTimeAsync(400_000)
    await sync.hydrateStorageFromServer()
    await ecoulerDebounce()
    expect(serveur.de('POST')).toHaveLength(4) // la valeur refusée n'est pas renvoyée en boucle
  })

  it('valeur trop volumineuse pour le serveur : jamais envoyée, signalée, et les autres partent', async () => {
    const sync = await ouvrirLaPage()
    await sync.hydrateStorageFromServer()
    // Au-delà de ce que le stockage de test accepte : le cœur du miroir est appelé comme le ferait l'interception.
    sync.enregistrerEcritureMiroir('fixit_piece_enorme_a', JSON.stringify({ d: 'x'.repeat(5_000_001) }), null)
    window.localStorage.setItem('fixit_clients_a', '[1]')
    await ecoulerDebounce()

    expect(serveur.de('POST').map(a => a.cles)).toEqual([['fixit_clients_a']])
    expect(vi.mocked(console.warn).mock.calls.flat().join(' ')).toContain('fixit_piece_enorme_a')
  })

  it('une suppression en échec (500) est retentée seule', async () => {
    serveur.espace(COMPTE_A).fixit_note_a = 'x'
    const sync = await ouvrirLaPage()
    await sync.hydrateStorageFromServer()
    serveur.panne.DELETE = 500
    window.localStorage.removeItem('fixit_note_a')
    await ecoulerDebounce()
    expect(serveur.espace(COMPTE_A)).toEqual({ fixit_note_a: 'x' })

    serveur.panne.DELETE = null
    await nouvelEssai()
    expect(serveur.espace(COMPTE_A)).toEqual({})
  })

  // Relecture du 14/11/2026 : la suppression en échec était remise en attente même si la clé avait été recréée et
  // enregistrée entre-temps ; son nouvel essai effaçait alors du serveur une valeur présente dans le navigateur.
  it('suppression en échec alors que la clé a été recréée et enregistrée entre-temps : elle n’est pas retentée', async () => {
    serveur.espace(COMPTE_A).fixit_note_a = 'x'
    const sync = await ouvrirLaPage()
    await sync.hydrateStorageFromServer()
    let liberer: () => void = () => {}
    serveur.avantReponse = (appel) => (appel.methode === 'DELETE' ? new Promise<void>((ok) => { liberer = ok }) : undefined)

    window.localStorage.removeItem('fixit_note_a')
    await ecoulerDebounce() // suppression partie, réponse retenue
    window.localStorage.setItem('fixit_note_a', '"recréée"')
    await ecoulerDebounce() // la nouvelle valeur est enregistrée
    expect(serveur.espace(COMPTE_A)).toEqual({ fixit_note_a: 'recréée' })
    serveur.panne.DELETE = 503
    liberer() // la suppression revient en erreur
    await vi.advanceTimersByTimeAsync(0)
    serveur.panne.DELETE = null
    const appels = serveur.appels.length

    await vi.advanceTimersByTimeAsync(400_000)
    expect(serveur.espace(COMPTE_A)).toEqual({ fixit_note_a: 'recréée' })
    expect(lire('fixit_note_a')).toBe('"recréée"')
    expect(serveur.appels).toHaveLength(appels) // plus rien à retenter : ni suppression, ni relecture du serveur
  })

  it('plus de 50 suppressions : découpées comme le serveur l’exige', async () => {
    const sync = await ouvrirLaPage()
    await sync.hydrateStorageFromServer()
    for (let i = 0; i < 60; i++) sync.enregistrerSuppressionMiroir(`fixit_cle_${i}`, '1')
    await ecoulerDebounce()
    expect(serveur.de('DELETE').map(a => a.cles.length)).toEqual([50, 10])
  })

  it('pendant une panne, les écritures suivantes attendent le nouvel essai au lieu de marteler le serveur', async () => {
    const sync = await ouvrirLaPage()
    await sync.hydrateStorageFromServer()
    serveur.panne.POST = 429
    window.localStorage.setItem('fixit_clients_a', '[1]')
    await ecoulerDebounce()
    window.localStorage.setItem('fixit_clients_a', '[1,2]')
    await ecoulerDebounce()
    window.localStorage.setItem('fixit_clients_a', '[1,2,3]')
    await ecoulerDebounce()
    expect(serveur.de('POST')).toHaveLength(1)

    serveur.panne.POST = null
    await vi.advanceTimersByTimeAsync(5000)
    expect(serveur.de('POST')).toHaveLength(2)
    expect(serveur.espace(COMPTE_A)).toEqual({ fixit_clients_a: [1, 2, 3] })
  })

  it('le retour du réseau n’attend pas le nouvel essai programmé : le serveur est relu aussitôt, puis l’envoi repart', async () => {
    serveur.espace(COMPTE_A).fixit_clients_a = [1]
    const sync = await ouvrirLaPage()
    await sync.hydrateStorageFromServer()
    serveur.panne.POST = 'reseau'
    window.localStorage.setItem('fixit_clients_a', '[1,2]')
    await ecoulerDebounce()
    await nouvelEssai()
    await nouvelEssai(15_000) // trois échecs : le prochain essai est dans une minute
    expect(serveur.de('POST')).toHaveLength(3)

    serveur.panne.POST = null
    window.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(0)
    await ecoulerDebounce()
    expect(serveur.espace(COMPTE_A)).toEqual({ fixit_clients_a: [1, 2] })
    // L'essai programmé n'a plus lieu d'être.
    const appels = serveur.appels.length
    await vi.advanceTimersByTimeAsync(400_000)
    expect(serveur.appels).toHaveLength(appels)
  })

  it('onglet fermé avant le délai d’envoi : ce qui attend part aussitôt, par un envoi qui survit à la fermeture', async () => {
    const sync = await ouvrirLaPage()
    await sync.hydrateStorageFromServer()
    window.localStorage.setItem('fixit_clients_a', '[1]')
    window.dispatchEvent(new Event('beforeunload'))
    await vi.advanceTimersByTimeAsync(0)
    expect(serveur.espace(COMPTE_A)).toEqual({ fixit_clients_a: [1] })
    expect(fauxFetch.mock.calls[fauxFetch.mock.calls.length - 1][1]).toMatchObject({ method: 'POST', keepalive: true })
  })

  it('onglet fermé pendant une panne d’envoi : rien ne repart sans relecture du serveur, et ce qui attend est noté', async () => {
    serveur.espace(COMPTE_A).fixit_clients_a = [1]
    const sync = await ouvrirLaPage()
    await sync.hydrateStorageFromServer()
    serveur.panne.POST = 'reseau'
    window.localStorage.setItem('fixit_clients_a', '[1,2]')
    await ecoulerDebounce() // envoi en échec, nouvel essai programmé
    expect(etat()!.attente).toEqual({})

    serveur.panne.POST = null
    window.dispatchEvent(new Event('beforeunload'))
    await vi.advanceTimersByTimeAsync(0)
    expect(serveur.de('POST')).toHaveLength(1)
    expect(Object.keys(etat()!.attente)).toEqual(['fixit_clients_a'])

    // Visite suivante : le serveur est relu, il détient toujours la valeur d'avant, la saisie part.
    const page = await rechargerLaPage()
    await page.hydrateStorageFromServer()
    await ecoulerDebounce()
    expect(serveur.espace(COMPTE_A)).toEqual({ fixit_clients_a: [1, 2] })
  })

  it('serveur en panne pour tout (500) : rien n’est mis à part, pas de martèlement, tout arrive à son retour', async () => {
    const sync = await ouvrirLaPage()
    await sync.hydrateStorageFromServer()
    serveur.panne.POST = 500
    for (let i = 1; i <= 6; i++) window.localStorage.setItem(`fixit_liste_${i}`, `[${i}]`)
    await ecoulerDebounce() // envoi groupé : 500
    await nouvelEssai() // encore 500 ; un par un, trois échecs sans un seul succès : c'est le serveur, la série s'arrête
    expect(serveur.de('POST').map(a => a.cles.length)).toEqual([6, 6, 1, 1, 1])

    serveur.panne.POST = null
    await nouvelEssai(15_000)
    expect(Object.keys(serveur.espace(COMPTE_A))).toHaveLength(6)
    // Rien n'a été mis à part : plus aucun envoi ensuite.
    const envois = serveur.de('POST').length
    await vi.advanceTimersByTimeAsync(3_600_000)
    expect(serveur.de('POST')).toHaveLength(envois)

    // Tout est arrivé : plus aucune clé n'est tenue pour en échec. Une nouvelle panne repart d'un seul envoi groupé.
    serveur.panne.POST = 500
    window.localStorage.setItem('fixit_liste_1', '[10]')
    window.localStorage.setItem('fixit_liste_4', '[40]')
    await ecoulerDebounce()
    expect(serveur.de('POST').slice(envois).map(a => a.cles.length)).toEqual([2])
  })

  it.each([429, 401])('envois refusés par une réponse %i (limite de débit, jeton) : jamais d’envois un par un, rien n’est mis à part', async (statut) => {
    const sync = await ouvrirLaPage()
    await sync.hydrateStorageFromServer()
    serveur.panne.POST = statut
    for (let i = 1; i <= 6; i++) window.localStorage.setItem(`fixit_liste_${i}`, `[${i}]`)
    await ecoulerDebounce()
    await nouvelEssai()
    await nouvelEssai(15_000)
    expect(serveur.de('POST').map(a => a.cles.length)).toEqual([6, 6, 6])

    serveur.panne.POST = null
    await nouvelEssai(60_000)
    expect(serveur.de('POST').map(a => a.cles.length)).toEqual([6, 6, 6, 6])
    expect(Object.keys(serveur.espace(COMPTE_A))).toHaveLength(6)
  })

  it('un envoi en échec n’empêche pas le suivant de partir : une valeur qui ne passe pas ne retient pas les autres lots', async () => {
    const sync = await ouvrirLaPage()
    await sync.hydrateStorageFromServer()
    // 60 clés : deux envois (50 puis 10). Le premier, qui contient la première clé, n'aboutit jamais.
    serveur.avantReponse = (appel) => {
      if (appel.methode === 'POST' && appel.cles.includes('fixit_cle_0')) throw new TypeError('Failed to fetch')
    }
    for (let i = 0; i < 60; i++) window.localStorage.setItem(`fixit_cle_${i}`, String(i))
    await ecoulerDebounce()

    expect(serveur.de('POST').map(a => a.cles.length)).toEqual([50, 10])
    expect(Object.keys(serveur.espace(COMPTE_A))).toHaveLength(10)
  })

  it('le retour du réseau envoie aussitôt ce qui attendait sans avoir échoué', async () => {
    const sync = await ouvrirLaPage()
    await sync.hydrateStorageFromServer()
    connecter(null) // session momentanément illisible : l'envoi ne peut pas partir
    window.localStorage.setItem('fixit_clients_a', '[1]')
    await ecoulerDebounce()
    expect(serveur.de('POST')).toEqual([])

    connecter(COMPTE_A)
    window.dispatchEvent(new Event('online'))
    await vi.advanceTimersByTimeAsync(0)
    expect(serveur.espace(COMPTE_A)).toEqual({ fixit_clients_a: [1] })
  })

  // Relecture du 14/11/2026 : une valeur que la base ne parvient pas à enregistrer (réponse 500, pas 400) faisait
  // échouer sans fin tout l'envoi groupé, et les saisies suivantes rejoignaient le même envoi : plus rien n'était
  // sauvegardé pour ce compte sur ce navigateur, rechargement compris.
  describe('valeur que le serveur ne parvient pas à enregistrer (500 à chaque envoi qui la contient)', () => {
    const EN_CAUSE = 'fixit_piece_illisible_a'
    const envoisDeLaValeurEnCause = () => serveur.de('POST').filter(a => a.cles.includes(EN_CAUSE))

    /** Une valeur en cause et une saisie légitime dans le même envoi ; la première est mise à part au second échec. */
    async function mettreAPart(): Promise<ModuleSync> {
      serveur.enErreur.set(EN_CAUSE, 500)
      const sync = await ouvrirLaPage()
      await sync.hydrateStorageFromServer()
      window.localStorage.setItem(EN_CAUSE, '"x"')
      window.localStorage.setItem('fixit_clients_a', '[1]')
      await ecoulerDebounce() // envoi groupé : 500
      expect(serveur.espace(COMPTE_A)).toEqual({})
      await nouvelEssai() // encore 500 : les valeurs repartent une par une
      return sync
    }

    it('les autres valeurs du même envoi arrivent, et les saisies suivantes partent normalement', async () => {
      await mettreAPart()
      expect(serveur.espace(COMPTE_A)).toEqual({ fixit_clients_a: [1] })
      expect(lire(EN_CAUSE)).toBe('"x"') // elle reste dans le navigateur
      expect(vi.mocked(console.warn).mock.calls.flat().join(' ')).toContain(EN_CAUSE)

      await vi.advanceTimersByTimeAsync(600_000)
      const envoisDeLaValeur = envoisDeLaValeurEnCause().length
      window.localStorage.setItem('fixit_depenses_a', '[9]')
      await ecoulerDebounce()
      expect(serveur.espace(COMPTE_A)).toEqual({ fixit_clients_a: [1], fixit_depenses_a: [9] })
      expect(envoisDeLaValeurEnCause()).toHaveLength(envoisDeLaValeur) // une sauvegarde ordinaire ne la renvoie pas
    })

    it('elle n’est retentée que seule et de loin en loin : pas de boucle d’envois', async () => {
      await mettreAPart()
      expect(envoisDeLaValeurEnCause()).toHaveLength(3) // deux envois groupés, puis un envoi seule
      const appels = serveur.appels.length

      await vi.advanceTimersByTimeAsync(3_600_000)
      // En une heure : un essai au bout de 5 min, un autre 30 min plus tard. Chacun relit le serveur puis l'envoie
      // seule ; son échec ne déclenche ni nouvel essai rapproché ni autre relecture.
      const depuis = serveur.appels.slice(appels)
      expect(depuis.map(a => a.methode)).toEqual(['GET', 'POST', 'GET', 'POST'])
      expect(depuis.filter(a => a.methode === 'POST').map(a => a.cles)).toEqual([[EN_CAUSE], [EN_CAUSE]])
    })

    it('si le serveur finit par l’accepter, elle arrive à son essai suivant', async () => {
      await mettreAPart()
      serveur.enErreur.clear()
      await nouvelEssai(300_000)
      expect(serveur.espace(COMPTE_A)).toEqual({ fixit_clients_a: [1], [EN_CAUSE]: 'x' })
      // Plus rien n'est à part : aucun autre envoi.
      const envois = serveur.de('POST').length
      await vi.advanceTimersByTimeAsync(3_600_000)
      expect(serveur.de('POST')).toHaveLength(envois)
    })

    it('à son essai le serveur est relu d’abord : écrite entre-temps sur un autre appareil, elle n’est pas renvoyée par-dessus', async () => {
      await mettreAPart()
      serveur.espace(COMPTE_A)[EN_CAUSE] = 'écrite ailleurs'
      serveur.enErreur.clear()
      const envois = serveur.de('POST').length

      await nouvelEssai(300_000)
      expect(lire(EN_CAUSE)).toBe('écrite ailleurs')
      expect(serveur.espace(COMPTE_A)[EN_CAUSE]).toBe('écrite ailleurs')
      expect(serveur.de('POST')).toHaveLength(envois)
    })

    it('reprise du serveur à un retour sur l’onglet, elle redevient une clé ordinaire : sa saisie suivante part sans délai', async () => {
      const sync = await mettreAPart()
      serveur.espace(COMPTE_A)[EN_CAUSE] = 'écrite ailleurs'
      serveur.enErreur.clear()
      await sync.hydrateStorageFromServer() // retour sur l'onglet : le serveur gagne
      expect(lire(EN_CAUSE)).toBe('écrite ailleurs')

      window.localStorage.setItem(EN_CAUSE, '"y"')
      await ecoulerDebounce()
      expect(serveur.espace(COMPTE_A)[EN_CAUSE]).toBe('y')
    })

    it.each(['reseau', 429] as const)('son essai tombe pendant une panne (%s) : elle est reprise au nouvel essai, pas une demi-heure plus tard', async (panne) => {
      await mettreAPart()
      serveur.enErreur.clear()
      serveur.panne.POST = panne
      await nouvelEssai(300_000) // son essai : le serveur est relu, mais l'envoi ne passe pas
      expect(serveur.espace(COMPTE_A)).toEqual({ fixit_clients_a: [1] })

      serveur.panne.POST = null
      await nouvelEssai()
      expect(serveur.espace(COMPTE_A)).toEqual({ fixit_clients_a: [1], [EN_CAUSE]: 'x' })
    })

    it('après un rechargement de la page, elle ne bloque pas davantage la saisie suivante', async () => {
      await mettreAPart()
      await vi.advanceTimersByTimeAsync(3000) // la note de la valeur en attente est écrite
      const page = await rechargerLaPage()
      await page.hydrateStorageFromServer()
      window.localStorage.setItem('fixit_autre_a', '"saisie après rechargement"')
      await ecoulerDebounce()
      await nouvelEssai()
      expect(serveur.espace(COMPTE_A)).toEqual({ fixit_clients_a: [1], fixit_autre_a: 'saisie après rechargement' })
    })

    it('trois valeurs en cause et une saisie légitime : la saisie passe quand même, et elles sont mises à part', async () => {
      const toutes = [EN_CAUSE, 'fixit_piece_illisible_b', 'fixit_piece_illisible_c']
      for (const cle of toutes) serveur.enErreur.set(cle, 500)
      const sync = await ouvrirLaPage()
      await sync.hydrateStorageFromServer()
      for (const cle of toutes) window.localStorage.setItem(cle, '"x"')
      await ecoulerDebounce() // envoi groupé : 500
      await nouvelEssai() // une par une : trois échecs, rien ne passe — le serveur est tenu pour en panne

      window.localStorage.setItem('fixit_clients_a', '[1]')
      await nouvelEssai(15_000) // la saisie, jamais en échec, part en tête : le serveur répond, ce sont les trois autres
      expect(serveur.espace(COMPTE_A)).toEqual({ fixit_clients_a: [1] })
      window.localStorage.setItem('fixit_depenses_a', '[9]')
      await ecoulerDebounce()
      expect(serveur.espace(COMPTE_A)).toEqual({ fixit_clients_a: [1], fixit_depenses_a: [9] })
    })

    it('volumineuse au point d’être seule dans son envoi : mise à part dès qu’une autre valeur passe pendant qu’elle échoue', async () => {
      const PIECE = 'fixit_piece_lourde_a'
      const envoisDeLaPiece = () => serveur.de('POST').filter(a => a.cles.includes(PIECE))
      serveur.enErreur.set(PIECE, 500)
      const sync = await ouvrirLaPage()
      await sync.hydrateStorageFromServer()
      window.localStorage.setItem(PIECE, JSON.stringify('p'.repeat(4_100_000))) // au-delà de 4 Mo : un envoi à elle seule
      window.localStorage.setItem('fixit_clients_a', '[1]')
      await ecoulerDebounce() // deux envois : la pièce (500), puis la liste, qui passe
      expect(serveur.espace(COMPTE_A)).toEqual({ fixit_clients_a: [1] })
      await nouvelEssai() // la pièce échoue de nouveau et rien d'autre ne part : rien ne dit que ce n'est pas le serveur

      window.localStorage.setItem('fixit_depenses_a', '[9]')
      await nouvelEssai(15_000) // la pièce échoue encore, la dépense passe dans le même envoi : c'est donc la pièce
      expect(serveur.espace(COMPTE_A)).toEqual({ fixit_clients_a: [1], fixit_depenses_a: [9] })
      expect(envoisDeLaPiece()).toHaveLength(3)

      // Mise à part : la saisie suivante part sans attendre, et la pièce n'est pas renvoyée avec elle.
      window.localStorage.setItem('fixit_autre_a', '"suite"')
      await ecoulerDebounce()
      expect(serveur.espace(COMPTE_A)).toEqual({ fixit_clients_a: [1], fixit_depenses_a: [9], fixit_autre_a: 'suite' })
      expect(envoisDeLaPiece()).toHaveLength(3)
    })

    it('seule dans son envoi : la première saisie qui la rejoint passe, et elle est mise à part', async () => {
      serveur.enErreur.set(EN_CAUSE, 500)
      const sync = await ouvrirLaPage()
      await sync.hydrateStorageFromServer()
      window.localStorage.setItem(EN_CAUSE, '"x"')
      await ecoulerDebounce()
      await nouvelEssai()
      await nouvelEssai(15_000) // trois échecs, seule : rien ne dit encore si c'est elle ou le serveur

      window.localStorage.setItem('fixit_clients_a', '[1]')
      await nouvelEssai(60_000)
      expect(serveur.espace(COMPTE_A)).toEqual({ fixit_clients_a: [1] })
      // Mise à part : la saisie suivante n'attend plus aucun délai.
      window.localStorage.setItem('fixit_depenses_a', '[9]')
      await ecoulerDebounce()
      expect(serveur.espace(COMPTE_A)).toEqual({ fixit_clients_a: [1], fixit_depenses_a: [9] })
    })

    // Relecture du 15/11/2026 : la mise à part visait la clé, pas la valeur. Une nouvelle valeur saisie pour cette clé
    // attendait l'essai des valeurs mises à part (5 min, puis 30 min) au lieu de partir avec les envois ordinaires.
    it('une nouvelle valeur saisie pour cette clé part avec les envois ordinaires ; réécrite à l’identique, elle reste à part', async () => {
      await mettreAPart()
      const envois = envoisDeLaValeurEnCause().length
      window.localStorage.setItem(EN_CAUSE, '"x"') // réécriture à l'identique (montage du tableau de bord)
      await ecoulerDebounce()
      expect(envoisDeLaValeurEnCause()).toHaveLength(envois)

      serveur.enErreur.clear()
      window.localStorage.setItem(EN_CAUSE, '"corrigée"')
      await ecoulerDebounce()
      expect(serveur.espace(COMPTE_A)).toEqual({ fixit_clients_a: [1], [EN_CAUSE]: 'corrigée' })
    })

    it('une nouvelle valeur saisie pendant l’envoi qui met la clé à part part, elle aussi, avec les envois ordinaires', async () => {
      serveur.enErreur.set(EN_CAUSE, 500)
      const sync = await ouvrirLaPage()
      await sync.hydrateStorageFromServer()
      window.localStorage.setItem(EN_CAUSE, '"x"')
      window.localStorage.setItem('fixit_clients_a', '[1]')
      await ecoulerDebounce() // envoi groupé : 500
      let liberer: () => void = () => {}
      serveur.avantReponse = (appel) =>
        (appel.methode === 'POST' && appel.cles.length === 1 && appel.cles[0] === EN_CAUSE ? new Promise<void>((ok) => { liberer = ok }) : undefined)
      await nouvelEssai() // encore 500 : une par une ; l'envoi de la valeur en cause, seule, est retenu

      window.localStorage.setItem(EN_CAUSE, '"corrigée"') // saisie pendant cet envoi
      liberer() // 500 : la valeur « x » est mise à part, la liste passe
      await vi.advanceTimersByTimeAsync(0)
      serveur.avantReponse = null
      serveur.enErreur.clear()
      expect(serveur.espace(COMPTE_A)).toEqual({ fixit_clients_a: [1] })

      await ecoulerDebounce()
      expect(serveur.espace(COMPTE_A)).toEqual({ fixit_clients_a: [1], [EN_CAUSE]: 'corrigée' })
    })

    // Relecture du 16/11/2026 : une nouvelle valeur pour une clé mise à part repartait comme si la clé n'avait jamais
    // échoué. Si le serveur ne l'enregistrait pas davantage, tout l'envoi groupé était remis en attente : la saisie
    // voisine attendait le nouvel essai, précédé d'une relecture complète du serveur (plusieurs Mo pour un compte chargé).
    it('une nouvelle valeur pour cette clé, toujours en échec : la saisie voisine passe dès le premier envoi, sans relecture du serveur', async () => {
      await mettreAPart()
      const lectures = serveur.de('GET').length
      window.localStorage.setItem(EN_CAUSE, '"y"') // nouvelle valeur, que le serveur n'enregistre pas davantage
      window.localStorage.setItem('fixit_clients_a', '[1,2]')
      await ecoulerDebounce()
      expect(serveur.espace(COMPTE_A)).toEqual({ fixit_clients_a: [1, 2] })
      expect(serveur.de('GET')).toHaveLength(lectures)

      // Mise à part à son tour : la saisie suivante part sans la renvoyer.
      const envois = envoisDeLaValeurEnCause().length
      window.localStorage.setItem('fixit_depenses_a', '[9]')
      await ecoulerDebounce()
      expect(serveur.espace(COMPTE_A)).toEqual({ fixit_clients_a: [1, 2], fixit_depenses_a: [9] })
      expect(envoisDeLaValeurEnCause()).toHaveLength(envois)
      expect(lire(EN_CAUSE)).toBe('"y"') // elle reste dans le navigateur
    })

    // Relecture du 15/11/2026 : une série d'envois un par un arrêtée (trois échecs sans un succès : le serveur est tenu
    // pour en panne) remettait le reste en attente sans programmer de nouvel essai. Si un lot suivant du même envoi
    // passait, ce reste attendait l'essai des valeurs mises à part, 5 min plus tard, ou la saisie suivante.
    it('série un par un arrêtée, puis un lot suivant qui passe : le reste de la série repart au nouvel essai, pas 5 min plus tard', async () => {
      const sync = await ouvrirLaPage()
      await sync.hydrateStorageFromServer()
      serveur.panne.POST = 500
      for (let i = 0; i < 50; i++) window.localStorage.setItem(`fixit_cle_${i}`, String(i))
      await ecoulerDebounce() // envoi groupé des 50 valeurs : 500
      serveur.panne.POST = null
      for (const i of [0, 1, 2]) serveur.enErreur.set(`fixit_cle_${i}`, 500)
      window.localStorage.setItem('fixit_autre_a', '"saisie"') // elle formera un second lot
      await nouvelEssai() // les 50 : 500 encore ; une par une, 0, 1 et 2 échouent et la série s'arrête ; le second lot passe
      expect(serveur.espace(COMPTE_A)).toEqual({ fixit_autre_a: 'saisie' })

      await nouvelEssai(15_000)
      expect(Object.keys(serveur.espace(COMPTE_A))).toHaveLength(48)
      // Les trois valeurs en cause, elles, sont mises à part et ne sont pas reparties avec les autres.
      expect(serveur.de('POST').slice(-1)[0].cles).not.toContain('fixit_cle_0')
    })
  })
})

describe('garantie 4 — rien ne part avec le jeton d’un autre compte', () => {
  it('ce qui attendait pour le compte A ne part pas quand le compte B se connecte dans la même page', async () => {
    const sync = await ouvrirLaPage()
    await sync.hydrateStorageFromServer()
    serveur.panne.POST = 'reseau'
    window.localStorage.setItem('fixit_clients_a', JSON.stringify([{ nom: 'client de A' }]))
    await ecoulerDebounce()

    connecter(COMPTE_B)
    serveur.panne.POST = null
    await vi.advanceTimersByTimeAsync(5000) // le nouvel essai d'envoi tombe alors que B est connecté
    await ecoulerDebounce()
    // Puis la restauration de B réussit : ce qui attendait pour A ne doit pas partir pour autant.
    expect((await sync.hydrateStorageFromServer()).ok).toBe(true)
    await ecoulerDebounce()

    expect(serveur.appels.filter(a => a.compte === COMPTE_B && a.methode !== 'GET')).toEqual([])
    expect(serveur.espace(COMPTE_B)).toEqual({})
  })

  it('un envoi du compte A qui aboutit après l’arrivée du compte B ne fausse pas le suivi de B', async () => {
    const sync = await ouvrirLaPage()
    await sync.hydrateStorageFromServer()
    let liberer: () => void = () => {}
    serveur.avantReponse = (appel) =>
      (appel.methode === 'POST' && appel.compte === COMPTE_A ? new Promise<void>((ok) => { liberer = ok }) : undefined)
    window.localStorage.setItem('fixit_theme_x', '"sombre"')
    await ecoulerDebounce() // envoi de A en cours

    connecter(COMPTE_B)
    expect((await sync.hydrateStorageFromServer()).ok).toBe(true)
    liberer() // l'envoi de A aboutit alors que B est connecté
    await vi.advanceTimersByTimeAsync(0)

    // B enregistre le même réglage : il doit partir dans SON espace, pas être tenu pour « déjà synchronisé ».
    window.localStorage.setItem('fixit_theme_x', '"sombre"')
    await ecoulerDebounce()
    expect(serveur.espace(COMPTE_B)).toEqual({ fixit_theme_x: 'sombre' })
  })

  it('envois un par un du compte A interrompus par l’arrivée du compte B : la suite ne part pas, le suivi de B n’est pas faussé', async () => {
    serveur.refusees.set('fixit_piece_invalide_a', 400)
    const sync = await ouvrirLaPage()
    await sync.hydrateStorageFromServer()
    let liberer: () => void = () => {}
    // Le deuxième POST est le premier envoi « seul » : le premier, groupé, est refusé en bloc.
    serveur.avantReponse = (appel) =>
      (appel.methode === 'POST' && serveur.de('POST').length === 2 ? new Promise<void>((ok) => { liberer = ok }) : undefined)
    window.localStorage.setItem('fixit_theme_x', '"sombre"')
    window.localStorage.setItem('fixit_piece_invalide_a', '"x"')
    window.localStorage.setItem('fixit_langue_x', '"fr"')
    await ecoulerDebounce() // envoi groupé refusé, premier envoi seul en cours

    connecter(COMPTE_B)
    expect((await sync.hydrateStorageFromServer()).ok).toBe(true)
    liberer()
    await vi.advanceTimersByTimeAsync(0)
    // Les deux valeurs suivantes ne partent pas : elles appartenaient à l'envoi du compte A.
    expect(serveur.de('POST').map(a => [a.compte, a.cles])).toEqual([
      [COMPTE_A, ['fixit_theme_x', 'fixit_piece_invalide_a', 'fixit_langue_x']],
      [COMPTE_A, ['fixit_theme_x']],
    ])

    // B enregistre le même réglage : il doit partir dans SON espace, pas être tenu pour « déjà synchronisé ».
    window.localStorage.setItem('fixit_theme_x', '"sombre"')
    await ecoulerDebounce()
    expect(serveur.espace(COMPTE_B)).toEqual({ fixit_theme_x: 'sombre' })
  })

  it('une valeur mise à part pour le compte A ne l’est pas pour le compte B, qui se connecte dans la même page', async () => {
    serveur.enErreur.set('fixit_reglage_x', 500)
    const sync = await ouvrirLaPage()
    await sync.hydrateStorageFromServer()
    window.localStorage.setItem('fixit_reglage_x', '"a"')
    window.localStorage.setItem('fixit_clients_a', '[1]')
    await ecoulerDebounce()
    await nouvelEssai() // chez A, le serveur n'enregistre pas ce réglage : il est mis à part
    expect(serveur.espace(COMPTE_A)).toEqual({ fixit_clients_a: [1] })

    serveur.enErreur.clear()
    connecter(COMPTE_B)
    expect((await sync.hydrateStorageFromServer()).ok).toBe(true)
    window.localStorage.setItem('fixit_reglage_x', '"b"')
    await ecoulerDebounce()
    expect(serveur.espace(COMPTE_B)).toEqual({ fixit_reglage_x: 'b' })
    // Et l'essai différé qui attendait pour le compte A n'a plus lieu.
    const appels = serveur.appels.length
    await vi.advanceTimersByTimeAsync(3_600_000)
    expect(serveur.appels).toHaveLength(appels)
  })

  it('le compte B enregistre une valeur que le compte A avait déjà synchronisée : elle part dans son espace', async () => {
    const sync = await ouvrirLaPage()
    await sync.hydrateStorageFromServer()
    window.localStorage.setItem('fixit_theme_x', '"sombre"')
    await ecoulerDebounce()
    expect(serveur.espace(COMPTE_A)).toEqual({ fixit_theme_x: 'sombre' })

    connecter(COMPTE_B)
    expect((await sync.hydrateStorageFromServer()).ok).toBe(true)
    // Le souvenir « déjà synchronisée » valait pour A : chez B, la même valeur doit partir.
    window.localStorage.setItem('fixit_theme_x', '"sombre"')
    await ecoulerDebounce()
    expect(serveur.espace(COMPTE_B)).toEqual({ fixit_theme_x: 'sombre' })
  })

  it('compte seul sur ce navigateur : autreCompte est faux ; après un second compte : vrai pour lui', async () => {
    const sync = await ouvrirLaPage()
    expect(await sync.hydrateStorageFromServer()).toEqual({ count: 0, ok: true, vide: true, autreCompte: false })
    expect(etat()).toEqual({ v: 1, compte: COMPTE_A, comptes: [COMPTE_A], attente: {} })
    // Le compte A revient plus tard : toujours seul.
    expect((await (await rechargerLaPage()).hydrateStorageFromServer()).autreCompte).toBe(false)

    connecter(COMPTE_B)
    const page = await rechargerLaPage()
    expect(await page.hydrateStorageFromServer()).toEqual({ count: 0, ok: true, vide: true, autreCompte: true })
    expect(etat()).toEqual({ v: 1, compte: COMPTE_B, comptes: [COMPTE_A, COMPTE_B], attente: {} })
    // Et A, de retour sur ce navigateur que B a utilisé, est prévenu lui aussi.
    connecter(COMPTE_A)
    expect((await (await rechargerLaPage()).hydrateStorageFromServer()).autreCompte).toBe(true)
  })

  it('la note laissée par le compte A ne protège rien chez le compte B', async () => {
    // Même valeur de départ chez les deux comptes (un jeu par défaut, par exemple) : c'est le cas où la note de A
    // « reconnaîtrait » à tort la valeur du serveur de B.
    serveur.espace(COMPTE_A).fixit_clients_x = [{ id: 1 }]
    serveur.espace(COMPTE_B).fixit_clients_x = [{ id: 1 }]
    const sync = await ouvrirLaPage()
    await sync.hydrateStorageFromServer()
    serveur.panne.POST = 'reseau'
    window.localStorage.setItem('fixit_clients_x', JSON.stringify([{ id: 1 }, { id: 2 }]))
    await ecoulerDebounce()
    await vi.advanceTimersByTimeAsync(3000)
    expect(Object.keys(etat()!.attente)).toEqual(['fixit_clients_x'])

    connecter(COMPTE_B)
    serveur.panne.POST = null
    const page = await rechargerLaPage()
    await page.hydrateStorageFromServer()
    await ecoulerDebounce()

    expect(JSON.parse(lire('fixit_clients_x')!)).toEqual([{ id: 1 }])
    expect(serveur.espace(COMPTE_B).fixit_clients_x).toEqual([{ id: 1 }])
    expect(serveur.appels.filter(a => a.compte === COMPTE_B && a.methode !== 'GET')).toEqual([])
    expect(etat()).toEqual({ v: 1, compte: COMPTE_B, comptes: [COMPTE_A, COMPTE_B], attente: {} })
  })

  it('une réponse arrivée après un changement de compte est ignorée', async () => {
    serveur.espace(COMPTE_A).fixit_secret_de_a = 'A'
    serveur.espace(COMPTE_B).fixit_donnee_de_b = 'B'
    let liberer: () => void = () => {}
    serveur.avantReponse = (appel) => (appel.compte === COMPTE_A ? new Promise<void>((ok) => { liberer = ok }) : undefined)
    const sync = await ouvrirLaPage()
    const restaurationDeA = sync.hydrateStorageFromServer()
    await vi.advanceTimersByTimeAsync(0)

    connecter(COMPTE_B)
    expect((await sync.hydrateStorageFromServer()).ok).toBe(true)
    liberer()

    expect((await restaurationDeA).ok).toBe(false)
    expect(lire('fixit_secret_de_a')).toBeNull()
    expect(lire('fixit_donnee_de_b')).toBe('B')
  })

  // Relecture du 14/11/2026 : « ce navigateur a servi à un autre compte » n'était connu que par l'état du miroir, donc
  // seulement après le passage de deux comptes ; et les conditions vivaient dans Providers, pas dans la fonction.
  describe('« tout envoyer » (premier passage d’un compte dont le serveur ne détient rien)', () => {
    const DOCUMENTS_DE_A = `fixit_documents_${FICHE_A}`
    const DOCUMENTS_DE_B = `fixit_documents_${FICHE_B}`
    const MENU = 'fixit_modules_categories_v3' // clé sans identifiant, commune au navigateur

    it('navigateur sans état du miroir où un autre compte a travaillé : ses clés ne sont pas recopiées dans l’espace du nouveau', async () => {
      // Ce que le compte A a laissé avant ce correctif : ni état du miroir, ni drapeau de migration.
      window.localStorage.setItem(DOCUMENTS_DE_A, JSON.stringify([{ id: 'devis-de-A' }]))
      window.localStorage.setItem(`fixit_manual_clients_${FICHE_A}`, JSON.stringify([{ nom: 'client de A' }]))
      window.localStorage.setItem(`fixit_devis_synced_v1_${COMPTE_A}`, '2026-10-01T08:00:00.000Z')
      window.localStorage.setItem(MENU, '{"ordre":["devis"]}')
      // Et ce que le compte B y a déjà rangé lui-même, sous sa fiche.
      window.localStorage.setItem(DOCUMENTS_DE_B, JSON.stringify([{ id: 'devis-de-B' }]))
      serveur.fiches.set(COMPTE_B, [FICHE_B])
      connecter(COMPTE_B)
      const sync = await ouvrirLaPage()
      // Tout ce que Providers vérifie est réuni : restauration réussie, serveur vide, aucun autre compte connu.
      expect(await sync.hydrateStorageFromServer()).toEqual({ count: 0, ok: true, vide: true, autreCompte: false })

      expect(await sync.pushAllLocalToServer()).toEqual({ count: 1 })
      expect(serveur.espace(COMPTE_B)).toEqual({ [DOCUMENTS_DE_B]: [{ id: 'devis-de-B' }] })
      // Rien n'est retiré du navigateur : les données de A y restent, pour A.
      expect(JSON.parse(lire(DOCUMENTS_DE_A)!)).toEqual([{ id: 'devis-de-A' }])
    })

    it('compte seul sur son navigateur : ses clés et les clés sans identifiant partent, comme avant', async () => {
      window.localStorage.setItem(DOCUMENTS_DE_A, JSON.stringify([{ id: 'devis-de-A' }]))
      window.localStorage.setItem(`fixit_syndic_immeubles_${COMPTE_A}`, '[]')
      window.localStorage.setItem(MENU, '{"ordre":["devis"]}')
      serveur.fiches.set(COMPTE_A, [FICHE_A])
      const sync = await ouvrirLaPage()
      await sync.hydrateStorageFromServer()

      expect(await sync.pushAllLocalToServer()).toEqual({ count: 3 })
      expect(serveur.espace(COMPTE_A)).toEqual({
        [DOCUMENTS_DE_A]: [{ id: 'devis-de-A' }],
        [`fixit_syndic_immeubles_${COMPTE_A}`]: [],
        [MENU]: { ordre: ['devis'] },
      })
    })

    // Relecture du 15/11/2026 : sans la liste (fiche du compte illisible côté serveur), seules les clés à l'identifiant
    // du compte partaient — des drapeaux pour une société, dont les données sont rangées sous sa fiche — et Providers
    // tenait la migration pour faite : les clés de la fiche ne partaient plus jamais par ce chemin.
    it('le serveur ne donne pas la liste des identifiants (fiche illisible) : rien ne part, la migration reste à faire', async () => {
      window.localStorage.setItem(DOCUMENTS_DE_A, JSON.stringify([{ id: 'devis-de-A' }]))
      window.localStorage.setItem(`fixit_syndic_immeubles_${COMPTE_A}`, '[]')
      window.localStorage.setItem(MENU, '{"ordre":["devis"]}')
      serveur.corpsGet = { entries: {} }
      const sync = await ouvrirLaPage()
      expect(await sync.hydrateStorageFromServer()).toEqual({ count: 0, ok: true, vide: true, autreCompte: false })

      expect(await sync.pushAllLocalToServer()).toEqual({ count: 0 })
      expect(serveur.de('POST')).toEqual([])
      // Rien n'est retiré du navigateur.
      expect(JSON.parse(lire(DOCUMENTS_DE_A)!)).toEqual([{ id: 'devis-de-A' }])

      // Restauration suivante, avec la liste : la migration se fait.
      serveur.corpsGet = null
      serveur.fiches.set(COMPTE_A, [FICHE_A])
      await sync.hydrateStorageFromServer()
      expect(await sync.pushAllLocalToServer()).toEqual({ count: 3 })
    })

    // Relecture du 15/11/2026 : un lot refusé ou en échec était abandonné en entier par « tout envoyer ». Une seule valeur
    // que la base refuse privait toutes les autres du lot de leur copie en ligne, et une coupure du réseau aussi.
    it('une valeur que la base refuse dans un lot : les autres valeurs du lot partent quand même', async () => {
      const VIDE_DE_A = `fixit_vide_${FICHE_A}`
      window.localStorage.setItem(DOCUMENTS_DE_A, JSON.stringify([{ numero: 'D-1' }]))
      window.localStorage.setItem(VIDE_DE_A, 'null')
      serveur.refusees.set(VIDE_DE_A, 422) // valeur nulle : la base la refuse
      serveur.fiches.set(COMPTE_A, [FICHE_A])
      const sync = await ouvrirLaPage()
      await sync.hydrateStorageFromServer()

      expect(await sync.pushAllLocalToServer()).toEqual({ count: 1 })
      expect(serveur.espace(COMPTE_A)).toEqual({ [DOCUMENTS_DE_A]: [{ numero: 'D-1' }] })
      expect(lire(VIDE_DE_A)).toBe('null') // elle reste dans le navigateur
    })

    /** 60 clés dans le navigateur : deux lots (50 puis 10). Le premier n'aboutit pas (réseau), le second passe. */
    async function toutEnvoyerAvecUnLotEnEchec(): Promise<ModuleSync> {
      for (let i = 0; i < 60; i++) window.localStorage.setItem(`fixit_cle_${i}`, String(i))
      const sync = await ouvrirLaPage()
      await sync.hydrateStorageFromServer()
      serveur.avantReponse = (appel) => {
        if (appel.methode === 'POST' && serveur.de('POST').length === 1) throw new TypeError('Failed to fetch')
      }
      expect(await sync.pushAllLocalToServer()).toEqual({ count: 10 })
      expect(Object.keys(serveur.espace(COMPTE_A))).toHaveLength(10)
      return sync
    }

    it('un lot en échec : ses valeurs restent à envoyer, et partent au nouvel essai, après relecture du serveur', async () => {
      await toutEnvoyerAvecUnLotEnEchec()
      await nouvelEssai()
      expect(Object.keys(serveur.espace(COMPTE_A))).toHaveLength(60)
    })

    it('un lot en échec, puis la page rechargée avant le nouvel essai : ses valeurs sont notées et partent à la visite suivante', async () => {
      await toutEnvoyerAvecUnLotEnEchec()
      await vi.advanceTimersByTimeAsync(3000) // la note des valeurs en attente est écrite

      const page = await rechargerLaPage()
      await page.hydrateStorageFromServer()
      await ecoulerDebounce()
      expect(Object.keys(serveur.espace(COMPTE_A))).toHaveLength(60)
    })

    it('après un envoi en échec, « tout envoyer » attend lui aussi que le serveur ait été relu', async () => {
      window.localStorage.setItem('fixit_depenses_a', '[{"id":"locale"}]')
      const sync = await ouvrirLaPage()
      expect((await sync.hydrateStorageFromServer()).vide).toBe(true)
      serveur.panne.POST = 'reseau'
      window.localStorage.setItem('fixit_clients_a', '[1]')
      await ecoulerDebounce() // envoi en échec
      serveur.panne.POST = null

      expect(await sync.pushAllLocalToServer()).toEqual({ count: 0 })
      expect(serveur.de('POST')).toHaveLength(1)
    })

    it('navigateur déjà utilisé par un autre compte d’après l’état du miroir : les clés sans identifiant ne partent pas non plus', async () => {
      const pageDeA = await ouvrirLaPage()
      await pageDeA.hydrateStorageFromServer() // le compte A est passé par ce navigateur : l'état du miroir s'en souvient
      pageDeA.reinitialiserMiroirPourTests()
      window.localStorage.setItem(MENU, '{"ordre":["factures"]}')
      window.localStorage.setItem(`fixit_syndic_immeubles_${COMPTE_B}`, '[{"nom":"immeuble de B"}]')

      connecter(COMPTE_B)
      const page = await rechargerLaPage()
      expect((await page.hydrateStorageFromServer()).autreCompte).toBe(true)
      expect(await page.pushAllLocalToServer()).toEqual({ count: 1 })
      expect(serveur.espace(COMPTE_B)).toEqual({ [`fixit_syndic_immeubles_${COMPTE_B}`]: [{ nom: 'immeuble de B' }] })
    })

    it('la garde est dans la fonction : rien ne part sans restauration réussie, ni quand le serveur détient déjà des valeurs', async () => {
      window.localStorage.setItem('fixit_clients_a', '[{"id":"local"}]')
      window.localStorage.setItem('fixit_depenses_a', '[{"id":"locale"}]')
      const sync = await ouvrirLaPage()
      expect(await sync.pushAllLocalToServer()).toEqual({ count: 0 }) // aucune restauration encore

      serveur.panne.GET = 500
      await sync.hydrateStorageFromServer()
      expect(await sync.pushAllLocalToServer()).toEqual({ count: 0 }) // restauration en échec

      serveur.panne.GET = null
      serveur.espace(COMPTE_A).fixit_clients_a = [{ id: 'serveur' }]
      expect((await sync.hydrateStorageFromServer()).vide).toBe(false)
      expect(await sync.pushAllLocalToServer()).toEqual({ count: 0 }) // le serveur détient déjà des valeurs
      expect(serveur.de('POST')).toEqual([])
      expect(serveur.espace(COMPTE_A)).toEqual({ fixit_clients_a: [{ id: 'serveur' }] })
    })

    it('un autre compte se connecte pendant l’envoi : la suite ne part pas', async () => {
      for (let i = 0; i < 60; i++) window.localStorage.setItem(`fixit_cle_${i}`, String(i))
      const sync = await ouvrirLaPage()
      expect((await sync.hydrateStorageFromServer()).vide).toBe(true)
      let liberer: () => void = () => {}
      serveur.avantReponse = (appel) =>
        (appel.methode === 'POST' && serveur.de('POST').length === 1 ? new Promise<void>((ok) => { liberer = ok }) : undefined)

      const envoi = sync.pushAllLocalToServer()
      await vi.advanceTimersByTimeAsync(0) // premier envoi (50 clés) parti, réponse retenue
      connecter(COMPTE_B)
      await sync.hydrateStorageFromServer() // le compte B arrive pendant l'envoi du compte A
      liberer()

      expect(await envoi).toEqual({ count: 0 })
      // Les 10 clés restantes ne partent pas, ni pour A ni pour B.
      expect(serveur.de('POST').map(a => [a.compte, a.cles.length])).toEqual([[COMPTE_A, 50]])
    })
  })
})
