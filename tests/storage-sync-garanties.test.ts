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
  /** Clés que le serveur refuse (400), comme une valeur invalide : tout l'envoi qui en contient une est refusé. */
  refusees: new Set<string>(),
  /** Permet à un test de retenir une réponse. */
  avantReponse: null as null | ((appel: Appel) => Promise<void> | void),
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
  if (methode === 'GET') return reponse({ entries: commeLaBase(espace) })
  if (methode === 'POST') {
    if (corps.entries!.some(e => serveur.refusees.has(e.key))) return reponse({ error: 'Données invalides' }, 400)
    for (const e of corps.entries!) espace[e.key] = commeLaBase(e.value)
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
const lire = (cle: string) => window.localStorage.getItem(cle)
const etat = () => JSON.parse(lire(CLE_ETAT) ?? 'null') as { compte: string; comptes: string[]; attente: Record<string, string> } | null
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
  serveur.avantReponse = null
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

describe('garantie 3 — un envoi en échec est retenté, une valeur refusée ne bloque pas les autres', () => {
  it('une valeur refusée (400) dans un envoi groupé : les autres arrivent quand même, et rien ne boucle', async () => {
    serveur.refusees.add('fixit_piece_invalide_a')
    const sync = await ouvrirLaPage()
    await sync.hydrateStorageFromServer()

    window.localStorage.setItem('fixit_clients_a', '[1]')
    window.localStorage.setItem('fixit_piece_invalide_a', '"x"')
    window.localStorage.setItem('fixit_depenses_a', '[2]')
    await ecoulerDebounce()

    // Avant : le 400 faisait perdre en silence les trois valeurs.
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

  it('une suppression en échec (500) est retentée seule', async () => {
    serveur.espace(COMPTE_A).fixit_note_a = 'x'
    const sync = await ouvrirLaPage()
    await sync.hydrateStorageFromServer()
    serveur.panne.DELETE = 500
    window.localStorage.removeItem('fixit_note_a')
    await ecoulerDebounce()
    expect(serveur.espace(COMPTE_A)).toEqual({ fixit_note_a: 'x' })

    serveur.panne.DELETE = null
    await vi.advanceTimersByTimeAsync(5000)
    expect(serveur.espace(COMPTE_A)).toEqual({})
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
})
