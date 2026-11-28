// tests/storage-sync-regroupement.test.ts — lot 8 Sentry du 28/10/2026 : moins de requêtes /api/user-storage.
//   - l'hydratation depuis le serveur n'est jamais renvoyée en POST ;
//   - une valeur identique à la dernière synchronisée n'est pas renvoyée ;
//   - les clés modifiées d'un même enchaînement partent en un seul POST (jusqu'à 50 clés / 4 Mo).
// Relecture de la PR #581 :
//   - une écriture faite avant la réponse de l'hydratation ne part pas écraser la valeur du serveur ;
//   - rien n'est posté pendant l'hydratation (flush, envoi keepalive), même quand elle échoue ou se chevauche ;
//   - un aller-retour A → B → A n'envoie jamais B, y compris pendant le POST de B (réussi ou en échec).
// Audit des fondations du 11/11/2026 : rien ne part avant une restauration réussie (les tests « amorcent » donc le
// miroir comme le fait Providers), une restauration en échec est retentée seule, un envoi en échec aussi.
// Relecture du 14/11/2026 : le nouvel essai d'un envoi relit d'abord le serveur (une lecture, puis l'envoi 1,5 s plus
// tard), et une réponse sans la liste des valeurs n'est plus tenue pour un serveur vide.
// Le cœur du miroir (enregistrerEcritureMiroir, appelé par le setItem intercepté) est appelé directement, avec la
// valeur d'avant l'écriture ; l'interception elle-même est couverte par tests/storage-sync-garanties.test.ts.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const mockGetSession = vi.fn()
vi.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession: mockGetSession } } }))

const originalFetch = globalThis.fetch
const mockFetch = vi.fn()
const FAKE_TOKEN = 'jeton-de-test'
const reponse = (contenu: unknown, status = 200) => new Response(JSON.stringify(contenu), { status })
const estUnGet = (init?: RequestInit) => !init?.method || init.method === 'GET'
/** Serveur par défaut : il ne détient rien (GET) et accepte tout (POST, DELETE). */
const reponseParDefaut = (init?: RequestInit) => reponse(estUnGet(init) ? { entries: {} } : { success: true })

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  mockGetSession.mockResolvedValue({ data: { session: { access_token: FAKE_TOKEN } } })
  mockFetch.mockImplementation(async (_url: unknown, init?: RequestInit) => reponseParDefaut(init))
  ;(globalThis as unknown as { fetch: typeof fetch }).fetch = mockFetch as unknown as typeof fetch
  window.localStorage.clear()
})

afterEach(async () => {
  // Débranche le miroir du module chargé par le test : minuteurs arrêtés, plus aucune écriture interceptée.
  ;(await import('@/lib/storage-sync')).reinitialiserMiroirPourTests()
  mockGetSession.mockResolvedValue({ data: { session: null } })
  ;(globalThis as unknown as { fetch: typeof fetch }).fetch = originalFetch
})

const attendreFlush = () => new Promise((r) => setTimeout(r, 1700))
const appelsPost = () => mockFetch.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === 'POST')
const corps = (appel: unknown[]) => JSON.parse((appel[1] as RequestInit).body as string) as { entries: Array<{ key: string; value: unknown }> }
const valeursPostees = (cle: string) => appelsPost().flatMap((a) => corps(a).entries.filter((e) => e.key === cle).map((e) => e.value))

type ModuleSync = typeof import('@/lib/storage-sync')

/** Ce que fait le setItem intercepté d'un navigateur : valeur d'avant, écriture locale, puis miroir. */
function ecrire(sync: ModuleSync, cle: string, valeur: string): void {
  const avant = window.localStorage.getItem(cle)
  window.localStorage.setItem(cle, valeur)
  sync.enregistrerEcritureMiroir(cle, valeur, avant)
}

/** Restauration réussie (le serveur ne détient rien, sauf réponse simulée par le test) : les envois sont permis. */
async function amorcer(sync: ModuleSync): Promise<void> {
  expect((await sync.hydrateStorageFromServer()).ok).toBe(true)
}

/** Réponse du serveur retenue jusqu'à ce que le test la donne (ou la fasse échouer). */
function differee<T>() {
  let resoudre!: (valeur: T) => void
  let rejeter!: (raison: unknown) => void
  const promesse = new Promise<T>((ok, ko) => {
    resoudre = ok
    rejeter = ko
  })
  return { promesse, resoudre, rejeter }
}

// Nouveaux cas : minuteurs simulés (setTimeout seulement), le debounce de 1,5 s s'écoule sans attente réelle.
const minuteursSimules = () => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
const ecoulerDebounce = () => vi.advanceTimersByTimeAsync(1600)
/** Nouvel essai d'un envoi en échec : 5 s d'attente, relecture du serveur, puis l'envoi (debounce). */
async function nouvelEssai(): Promise<void> {
  await vi.advanceTimersByTimeAsync(5000)
  await ecoulerDebounce()
}

describe('storage-sync — hydratation sans renvoi', () => {
  it('les valeurs reçues du serveur ne repartent pas en POST ; une valeur identique non plus ; une autre, oui', async () => {
    mockFetch.mockImplementation(async (_url: unknown, init?: RequestInit) => {
      if (!init?.method || init.method === 'GET') {
        return new Response(JSON.stringify({ entries: { fixit_clients_x: [{ id: 1 }], fixit_prefs: 'sombre' } }), { status: 200 })
      }
      return new Response(JSON.stringify({ success: true }), { status: 200 })
    })
    const sync = await import('@/lib/storage-sync')
    const { installStorageSync, hydrateStorageFromServer, enregistrerEcritureMiroir } = sync
    installStorageSync()
    // Écriture du montage captée par le miroir avant la réponse du serveur (valeur par défaut) : le serveur gagne,
    // elle ne part pas. Miroir simulé : sans cette écriture, ce volet ne pouvait pas échouer sous jsdom.
    ecrire(sync, 'fixit_prefs', 'clair')
    const resultat = await hydrateStorageFromServer()
    expect(resultat.count).toBe(2)
    expect(window.localStorage.getItem('fixit_prefs')).toBe('sombre')

    await attendreFlush()
    expect(appelsPost()).toHaveLength(0)

    // Réécriture de la même valeur par l'application : rien à envoyer.
    enregistrerEcritureMiroir('fixit_prefs', 'sombre')
    await attendreFlush()
    expect(appelsPost()).toHaveLength(0)

    // Valeur différente : envoyée.
    enregistrerEcritureMiroir('fixit_prefs', 'clair')
    await attendreFlush()
    expect(appelsPost()).toHaveLength(1)
    expect(corps(appelsPost()[0]).entries).toEqual([{ key: 'fixit_prefs', value: 'clair' }])
  })
})

describe('storage-sync — un seul POST par enchaînement', () => {
  it('25 clés écrites au montage partent dans un seul POST, avec le Bearer', async () => {
    const sync = await import('@/lib/storage-sync')
    const { enregistrerEcritureMiroir } = sync
    await amorcer(sync)
    for (let i = 0; i < 25; i++) enregistrerEcritureMiroir(`fixit_cle_${i}`, JSON.stringify({ i }))
    await attendreFlush()
    expect(appelsPost()).toHaveLength(1)
    expect(corps(appelsPost()[0]).entries).toHaveLength(25)
    expect(((appelsPost()[0][1] as RequestInit).headers as Record<string, string>).Authorization).toBe(`Bearer ${FAKE_TOKEN}`)
  })

  it('au-delà de 50 clés, ou de 4 Mo, le flush se découpe en plusieurs POST', async () => {
    const sync = await import('@/lib/storage-sync')
    const { enregistrerEcritureMiroir } = sync
    await amorcer(sync)
    for (let i = 0; i < 60; i++) enregistrerEcritureMiroir(`fixit_cle_${i}`, String(i))
    await attendreFlush()
    expect(appelsPost().map((a) => corps(a).entries.length)).toEqual([50, 10])

    mockFetch.mockClear()
    enregistrerEcritureMiroir('fixit_gros_1', JSON.stringify({ d: 'x'.repeat(3_000_000) }))
    enregistrerEcritureMiroir('fixit_gros_2', JSON.stringify({ d: 'y'.repeat(3_000_000) }))
    await attendreFlush()
    expect(appelsPost().map((a) => corps(a).entries.length)).toEqual([1, 1])
  })

  it('une valeur envoyée avec succès puis réécrite à l’identique n’est pas renvoyée ; après suppression, si', async () => {
    // Écritures faites dans le stockage, comme par le setItem intercepté : la confirmation d'un envoi regarde si une
    // valeur plus récente écrite ici reste en place dans le navigateur (relectures des 15 et 16/11/2026).
    const sync = await import('@/lib/storage-sync')
    const { enregistrerSuppressionMiroir } = sync
    await amorcer(sync)
    ecrire(sync, 'fixit_a', '1')
    await attendreFlush()
    expect(appelsPost()).toHaveLength(1)
    ecrire(sync, 'fixit_a', '1')
    await attendreFlush()
    expect(appelsPost()).toHaveLength(1)
    window.localStorage.removeItem('fixit_a')
    enregistrerSuppressionMiroir('fixit_a', '1')
    ecrire(sync, 'fixit_a', '1')
    await attendreFlush()
    expect(appelsPost()).toHaveLength(2)
    expect(corps(appelsPost()[1]).entries).toEqual([{ key: 'fixit_a', value: 1 }])
  })

  it('les clés hors fixit_ et les drapeaux transitoires ne sont jamais envoyés', async () => {
    const sync = await import('@/lib/storage-sync')
    const { enregistrerEcritureMiroir } = sync
    await amorcer(sync)
    enregistrerEcritureMiroir('sb-auth-token', 'secret')
    enregistrerEcritureMiroir('fixit_clean_v6_x', '1')
    enregistrerEcritureMiroir('fixit_user_storage_migrated_v1', '1')
    await attendreFlush()
    expect(appelsPost()).toHaveLength(0)
  })
})

describe('storage-sync — envois retenus pendant l’hydratation', () => {
  beforeEach(() => {
    minuteursSimules()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('un flush déclenché pendant l’hydratation ne poste rien avant la fin, puis seules les clés absentes du serveur partent', async () => {
    const get = differee<Response>()
    mockFetch.mockImplementation((_url: unknown, init?: RequestInit) => (estUnGet(init) ? get.promesse : Promise.resolve(reponse({ success: true }))))
    const sync = await import('@/lib/storage-sync')
    sync.installStorageSync()
    // Montage : jeu par défaut de la bibliothèque (clé que le serveur a) et une clé que le serveur n'a pas.
    ecrire(sync, 'fixit_bibliotheque_x', JSON.stringify([{ id: 'defaut' }]))
    ecrire(sync, 'fixit_nouvelle_cle', JSON.stringify({ locale: true }))
    const hydratation = sync.hydrateStorageFromServer()

    await ecoulerDebounce() // le minuteur du flush tombe pendant l'hydratation
    window.dispatchEvent(new Event('beforeunload')) // envoi keepalive de fermeture d'onglet : retenu lui aussi
    await vi.advanceTimersByTimeAsync(0)
    expect(appelsPost()).toHaveLength(0)

    get.resoudre(reponse({ entries: { fixit_bibliotheque_x: [{ id: 'saisie-sur-un-autre-appareil' }] } }))
    expect((await hydratation).count).toBe(1)
    await ecoulerDebounce()
    expect(appelsPost()).toHaveLength(1)
    expect(corps(appelsPost()[0]).entries).toEqual([{ key: 'fixit_nouvelle_cle', value: { locale: true } }])
    expect(JSON.parse(window.localStorage.getItem('fixit_bibliotheque_x')!)).toEqual([{ id: 'saisie-sur-un-autre-appareil' }])
  })

  it('deux hydratations qui se chevauchent (bootstrap puis INITIAL_SESSION) : rien ne part avant la fin de la seconde', async () => {
    const gets = [differee<Response>(), differee<Response>()]
    let numeroGet = 0
    mockFetch.mockImplementation((_url: unknown, init?: RequestInit) => (estUnGet(init) ? gets[numeroGet++].promesse : Promise.resolve(reponse({ success: true }))))
    const sync = await import('@/lib/storage-sync')
    const premiere = sync.hydrateStorageFromServer()
    const seconde = sync.hydrateStorageFromServer()
    ecrire(sync, 'fixit_nouvelle_cle', '"locale"')

    gets[0].resoudre(reponse({ entries: {} }))
    await premiere
    await ecoulerDebounce()
    expect(appelsPost()).toHaveLength(0)

    gets[1].resoudre(reponse({ entries: {} }))
    await seconde
    await ecoulerDebounce()
    expect(valeursPostees('fixit_nouvelle_cle')).toEqual(['locale'])
  })

  // Avant le 11/11/2026, une restauration en échec levait la retenue : les écritures du montage (jeux par défaut
  // compris) partaient alors par-dessus les données du serveur, qu'on n'avait pas pu lire.
  it.each([
    ['réseau coupé', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['401', () => Promise.resolve(reponse({ error: 'Non autorisé' }, 401))],
    ['429', () => Promise.resolve(reponse({ error: 'Trop de requêtes' }, 429))],
    ['500', () => Promise.resolve(reponse({ error: 'Erreur lors du chargement' }, 500))],
  ])('une restauration en échec (%s) ne lève pas la retenue : rien ne part, elle est retentée, puis l’écriture part', async (_cas, echec) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const get = differee<void>()
    let numeroGet = 0
    mockFetch.mockImplementation(async (_url: unknown, init?: RequestInit) => {
      if (!estUnGet(init)) return reponse({ success: true })
      if (++numeroGet > 1) return reponse({ entries: {} })
      await get.promesse
      return echec()
    })
    const sync = await import('@/lib/storage-sync')
    const hydratation = sync.hydrateStorageFromServer()
    ecrire(sync, 'fixit_nouvelle_cle', '"locale"')
    await ecoulerDebounce()
    expect(appelsPost()).toHaveLength(0)

    get.resoudre()
    expect(await hydratation).toMatchObject({ count: 0, ok: false })
    await ecoulerDebounce()
    await ecoulerDebounce()
    expect(appelsPost()).toHaveLength(0) // l'échec n'a rien libéré
    expect(numeroGet).toBe(1)

    await vi.advanceTimersByTimeAsync(2000) // 5 s après l'échec : nouvel essai de restauration, réussi
    expect(numeroGet).toBe(2)
    await ecoulerDebounce()
    expect(valeursPostees('fixit_nouvelle_cle')).toEqual(['locale'])
    vi.mocked(console.warn).mockRestore()
  })
})

describe('storage-sync — aller-retour de valeur (A → B → A)', () => {
  beforeEach(() => {
    minuteursSimules()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('après la synchronisation de A, un aller-retour B puis A avant le flush n’envoie jamais B', async () => {
    const sync = await import('@/lib/storage-sync')
    await amorcer(sync)
    ecrire(sync, 'fixit_modules_x', 'A')
    await ecoulerDebounce()
    expect(valeursPostees('fixit_modules_x')).toEqual(['A'])

    // Double-clic sur une bascule de module : B puis retour à A.
    ecrire(sync, 'fixit_modules_x', 'B')
    ecrire(sync, 'fixit_modules_x', 'A')
    await ecoulerDebounce()
    const envoyees = valeursPostees('fixit_modules_x')
    expect(envoyees).not.toContain('B')
    expect(envoyees[envoyees.length - 1]).toBe('A')
  })

  it('A réécrite pendant le POST de B : A finit par être envoyée', async () => {
    const postB = differee<Response>()
    let numeroPost = 0
    mockFetch.mockImplementation((_url: unknown, init?: RequestInit) =>
      init?.method === 'POST' && ++numeroPost === 2 ? postB.promesse : Promise.resolve(reponseParDefaut(init)))
    const sync = await import('@/lib/storage-sync')
    await amorcer(sync)
    ecrire(sync, 'fixit_dispo_x', 'A')
    await ecoulerDebounce()
    ecrire(sync, 'fixit_dispo_x', 'B')
    await ecoulerDebounce() // POST de B parti, réponse pas encore arrivée
    expect(valeursPostees('fixit_dispo_x')).toEqual(['A', 'B'])

    ecrire(sync, 'fixit_dispo_x', 'A') // retour arrière (toggleDayService) pendant le POST de B
    postB.resoudre(reponse({ success: true }))
    await ecoulerDebounce()
    expect(valeursPostees('fixit_dispo_x')).toEqual(['A', 'B', 'A'])
  })

  it('POST de B en échec (réseau) pendant le retour à A : A part au nouvel essai, B n’est pas remise en attente', async () => {
    const postB = differee<Response>()
    let numeroPost = 0
    mockFetch.mockImplementation((_url: unknown, init?: RequestInit) =>
      init?.method === 'POST' && ++numeroPost === 2 ? postB.promesse : Promise.resolve(reponseParDefaut(init)))
    const sync = await import('@/lib/storage-sync')
    await amorcer(sync)
    ecrire(sync, 'fixit_dispo_x', 'A')
    await ecoulerDebounce()
    ecrire(sync, 'fixit_dispo_x', 'B')
    await ecoulerDebounce()
    ecrire(sync, 'fixit_dispo_x', 'A')
    postB.rejeter(new TypeError('Failed to fetch'))
    await ecoulerDebounce()
    // Après un échec, le miroir attend 5 s avant le nouvel essai : pas d'envoi à chaque frappe pendant une panne.
    expect(valeursPostees('fixit_dispo_x')).toEqual(['A', 'B'])
    await nouvelEssai()
    expect(valeursPostees('fixit_dispo_x')).toEqual(['A', 'B', 'A'])

    // Le flush suivant ne renvoie pas B.
    ecrire(sync, 'fixit_autre', '1')
    await ecoulerDebounce()
    expect(valeursPostees('fixit_dispo_x')).toEqual(['A', 'B', 'A'])
    expect(valeursPostees('fixit_autre')).toEqual([1])
  })

  it('POST en échec sans réécriture : la valeur repart seule (5 s, relecture du serveur, envoi), sans attendre une autre écriture', async () => {
    let numeroPost = 0
    mockFetch.mockImplementation((_url: unknown, init?: RequestInit) =>
      init?.method === 'POST' && ++numeroPost === 1 ? Promise.reject(new TypeError('Failed to fetch')) : Promise.resolve(reponseParDefaut(init)))
    const sync = await import('@/lib/storage-sync')
    await amorcer(sync)
    ecrire(sync, 'fixit_dispo_x', 'B')
    await ecoulerDebounce() // premier POST en échec : B remise en attente, nouvel essai programmé
    expect(valeursPostees('fixit_dispo_x')).toEqual(['B'])
    const lectures = mockFetch.mock.calls.filter((c) => estUnGet(c[1] as RequestInit | undefined)).length
    await nouvelEssai()
    expect(mockFetch.mock.calls.filter((c) => estUnGet(c[1] as RequestInit | undefined))).toHaveLength(lectures + 1)
    expect(valeursPostees('fixit_dispo_x')).toEqual(['B', 'B'])
  })

  it.each([429, 500, 401])('POST refusé par une réponse %i : la valeur est remise en attente et repart (avant : perdue en silence)', async (statut) => {
    let numeroPost = 0
    mockFetch.mockImplementation((_url: unknown, init?: RequestInit) =>
      init?.method === 'POST' && ++numeroPost === 1 ? Promise.resolve(reponse({ error: 'indisponible' }, statut)) : Promise.resolve(reponseParDefaut(init)))
    const sync = await import('@/lib/storage-sync')
    await amorcer(sync)
    ecrire(sync, 'fixit_clients_x', JSON.stringify([{ id: 1 }]))
    await ecoulerDebounce()
    expect(valeursPostees('fixit_clients_x')).toHaveLength(1)
    await nouvelEssai()
    expect(valeursPostees('fixit_clients_x')).toEqual([[{ id: 1 }], [{ id: 1 }]])
  })
})
