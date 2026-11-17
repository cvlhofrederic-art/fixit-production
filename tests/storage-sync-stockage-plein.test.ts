/**
 * Stockage du navigateur plein (pièces jointes en base64 qui atteignent le quota) : une écriture qui agrandirait le
 * stockage lève QuotaExceededError, mais la lecture, la suppression et la réécriture plus courte marchent encore.
 * Le miroir, la migration vers le serveur et l'hydratation n'ont pas besoin d'agrandir le stockage : ils restent
 * actifs, comme avant le lot 5 Sentry (relecture de la PR #574). Le stockage bloqué (SecurityError) est couvert par
 * tests/stockage-navigateur-bloque.test.tsx.
 *
 * Le localStorage de jsdom transforme l'affectation `localStorage.setItem = …` en une clé « setItem » : le miroir ne
 * s'y pose pas. window.localStorage est donc remplacé ici par un objet ordinaire qui applique la règle de quota des
 * navigateurs (et de jsdom) : une écriture n'échoue que si elle fait dépasser le quota.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Jeton simulé : storage-sync le lit par lib/auth/jeton-acces.ts, qui s'appuie sur le client applicatif partagé.
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'jeton-test' } }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}))

const JETON = 'jeton-test'
const PIECE_KBIS = `data:application/pdf;base64,${'A'.repeat(2000)}`

let entreesServeur: Record<string, unknown> = {}
const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
  (init?.method ?? 'GET') === 'GET'
    ? new Response(JSON.stringify({ entries: entreesServeur }), { status: 200 })
    : new Response(JSON.stringify({ success: true }), { status: 200 }),
)

function appels(methode: 'GET' | 'POST' | 'DELETE') {
  return fetchMock.mock.calls.filter(([, init]) => (init?.method ?? 'GET') === methode)
}

function corps(methode: 'POST' | 'DELETE'): Record<string, unknown> {
  const [premier] = appels(methode)
  return JSON.parse(String(premier?.[1]?.body)) as Record<string, unknown>
}

let descripteurOrigine: PropertyDescriptor | undefined

/** Remplace window.localStorage par un stockage rempli jusqu'au quota : sa taille (clés + valeurs) ne peut plus croître. */
function installerStockagePlein(entrees: Record<string, string>): void {
  const valeurs = new Map(Object.entries(entrees))
  const taille = () => Array.from(valeurs).reduce((total, [cle, valeur]) => total + cle.length + valeur.length, 0)
  const quota = taille()
  const stockagePlein = {
    get length() {
      return valeurs.size
    },
    key: (index: number) => Array.from(valeurs.keys())[index] ?? null,
    getItem: (cle: string) => valeurs.get(cle) ?? null,
    setItem: (cle: string, valeur: string) => {
      const ancienne = valeurs.get(cle)
      const apres = taille() - (ancienne === undefined ? 0 : cle.length + ancienne.length) + cle.length + valeur.length
      if (apres > quota) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
      valeurs.set(cle, valeur)
    },
    removeItem: (cle: string) => {
      valeurs.delete(cle)
    },
    clear: () => {
      valeurs.clear()
    },
  }
  Object.defineProperty(window, 'localStorage', { configurable: true, value: stockagePlein })
}

beforeEach(() => {
  // Modules neufs : drapeau `installed` de storage-sync, cache de la sonde de safe-storage, session de jeton-acces.
  vi.resetModules()
  entreesServeur = {}
  fetchMock.mockClear()
  vi.stubGlobal('fetch', fetchMock)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  descripteurOrigine = Object.getOwnPropertyDescriptor(window, 'localStorage')
})

afterEach(() => {
  if (descripteurOrigine) Object.defineProperty(window, 'localStorage', descripteurOrigine)
  else delete (window as unknown as Record<string, unknown>).localStorage
  descripteurOrigine = undefined
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('stockage du navigateur plein (QuotaExceededError dès qu’une écriture l’agrandirait)', () => {
  it('pushAllLocalToServer lit les clés fixit_* et les envoie au serveur avec le jeton', async () => {
    installerStockagePlein({
      fixit_clients_abc: JSON.stringify([{ id: 1, nom: 'Dupont' }]),
      fixit_piece_kbis_abc: PIECE_KBIS,
      autre_app: 'hors synchronisation',
    })
    // Précondition : le stockage simulé refuse bien la sonde d'écriture.
    const { isStorageAvailable } = await import('@/lib/safe-storage')
    expect(isStorageAvailable('local')).toBe(false)

    const { pushAllLocalToServer } = await import('@/lib/storage-sync')
    await expect(pushAllLocalToServer()).resolves.toEqual({ count: 2 })

    expect(appels('POST')).toHaveLength(1)
    expect(appels('POST')[0][1]?.headers).toMatchObject({ Authorization: `Bearer ${JETON}` })
    expect(corps('POST').entries).toEqual([
      { key: 'fixit_clients_abc', value: [{ id: 1, nom: 'Dupont' }] },
      { key: 'fixit_piece_kbis_abc', value: PIECE_KBIS },
    ])
  })

  it('installStorageSync pose le miroir sans l’avertissement « miroir désactivé »', async () => {
    installerStockagePlein({ fixit_clients_abc: '[]' })
    const setItemAvant = window.localStorage.setItem
    const { installStorageSync } = await import('@/lib/storage-sync')

    expect(() => installStorageSync()).not.toThrow()

    const avertissements = vi.mocked(console.warn).mock.calls.flat().map(String).join('\n')
    expect(avertissements).not.toContain('miroir désactivé')
    expect(avertissements).not.toContain('[storage-sync]')
    expect(window.localStorage.setItem).not.toBe(setItemAvant)
  })

  it('le miroir réplique une suppression et une réécriture plus courte, et rien pour une écriture refusée', async () => {
    const clients = [{ id: 1, nom: 'Dupont' }, { id: 2, nom: 'Martin' }]
    installerStockagePlein({ fixit_clients_abc: JSON.stringify(clients), fixit_piece_kbis_abc: PIECE_KBIS })
    const { installStorageSync } = await import('@/lib/storage-sync')
    installStorageSync()

    // Une écriture qui agrandirait le stockage lève comme sans miroir et n'est pas mise en file.
    expect(() => window.localStorage.setItem('fixit_nouvelle_cle_abc', 'x')).toThrow('quota')
    // Réécriture plus courte et suppression réussissent sur un stockage plein : elles doivent atteindre le serveur,
    // sinon la donnée supprimée revient depuis le serveur sur un autre appareil.
    window.localStorage.setItem('fixit_clients_abc', JSON.stringify(clients.slice(0, 1)))
    window.localStorage.removeItem('fixit_piece_kbis_abc')

    await vi.waitFor(
      () => {
        expect(appels('POST')).toHaveLength(1)
        expect(appels('DELETE')).toHaveLength(1)
      },
      { timeout: 3000, interval: 50 },
    )
    expect(corps('POST').entries).toEqual([{ key: 'fixit_clients_abc', value: clients.slice(0, 1) }])
    expect(corps('DELETE').keys).toEqual(['fixit_piece_kbis_abc'])
    expect(appels('DELETE')[0][1]?.headers).toMatchObject({ Authorization: `Bearer ${JETON}` })
  })

  it('hydrateStorageFromServer interroge le serveur et réécrit les valeurs qui tiennent dans le stockage', async () => {
    installerStockagePlein({
      fixit_absences_abc: JSON.stringify([{ date: '2026-10-01' }]),
      fixit_piece_kbis_abc: PIECE_KBIS,
    })
    entreesServeur = {
      // Même longueur que la valeur locale : la réécriture passe sur un stockage plein.
      fixit_absences_abc: [{ date: '2026-10-02' }],
      // Clé absente de l'appareil : elle agrandirait le stockage, son écriture est refusée et ignorée.
      fixit_modules_artisan_abc: ['planning'],
    }
    const { hydrateStorageFromServer } = await import('@/lib/storage-sync')

    // count > 0 : Providers ne relance pas la migration, qui écraserait sur le serveur les données des autres appareils.
    await expect(hydrateStorageFromServer()).resolves.toEqual({ count: 1 })
    expect(appels('GET')).toHaveLength(1)
    expect(appels('GET')[0][1]?.headers).toMatchObject({ Authorization: `Bearer ${JETON}` })
    expect(window.localStorage.getItem('fixit_absences_abc')).toBe(JSON.stringify([{ date: '2026-10-02' }]))
    expect(window.localStorage.getItem('fixit_modules_artisan_abc')).toBeNull()
  })
})
