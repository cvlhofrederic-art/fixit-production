// @vitest-environment node
// tests/recherche/creneaux-par-lots.test.ts
//
// Page de recherche (/fr/recherche/, reprise par /pt/pesquisar/) : créneaux et réservations demandés
// par lots d'identifiants (lib/recherche/creneaux-par-lots.ts).
//
// Constat du 23/10/2026 en production : sur /pt/pesquisar/, availability et bookings partaient en une
// seule requête `.in('artisan_id', ids)` sur 758 identifiants (URL de 29,7 Ko → 400 ; 558 identifiants,
// 21,9 Ko → 200), et l'erreur était ignorée. Les requêtes passent ici par le vrai client supabase-js,
// branché sur une passerelle factice qui refuse les URL trop longues comme en production.

import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@supabase/supabase-js'
import type { Artisan } from '@/components/recherche/ArtisanCard'
import {
  TAILLE_LOT_IDS,
  chargerParLots,
  decouperEnLots,
  idsAvecAgenda,
  requeteDisponibilites,
  requeteReservations,
  type ReponseLot,
} from '@/lib/recherche/creneaux-par-lots'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

/** UUID v4 bien formé et déterministe (36 caractères, comme les id de profiles_artisan). */
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const plage = (debut: number, nombre: number) => Array.from({ length: nombre }, (_, i) => uuid(debut + i))

/** Au-delà, la passerelle factice répond 400 : entre les 21,9 Ko acceptés et les 29,7 Ko refusés en production. */
const LIMITE_PASSERELLE = 25_000
/** Plafond visé pour une URL d'appel. */
const HUIT_KO = 8 * 1024

function idsDeLUrl(url: string): string[] {
  const filtre = new URL(url).searchParams.get('artisan_id') ?? ''
  const valeurs = /^in\.\((.*)\)$/.exec(filtre)
  return valeurs ? valeurs[1].split(',') : []
}

/** Client supabase-js réel dont le fetch est une passerelle factice : une ligne par identifiant demandé. */
function clientFactice() {
  const urls: string[] = []
  const passerelle = vi.fn(async (entree: RequestInfo | URL): Promise<Response> => {
    const url = typeof entree === 'string' ? entree : entree instanceof URL ? entree.href : entree.url
    urls.push(url)
    if (url.length > LIMITE_PASSERELLE) {
      return new Response('Bad Request', { status: 400, statusText: 'Bad Request' })
    }
    const lignes = idsDeLUrl(url).map((id) => ({ id: `ligne-${id}`, artisan_id: id }))
    return new Response(JSON.stringify(lignes), { status: 200, headers: { 'Content-Type': 'application/json' } })
  })
  const client = createClient('https://exemple.supabase.co', 'cle-anon-de-test', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: passerelle },
  })
  return { client, urls }
}

type ClientFactice = ReturnType<typeof clientFactice>['client']
type Ligne = { id: string; artisan_id: string }

let consoleError: MockInstance<typeof console.error>

beforeEach(() => {
  vi.mocked(Sentry.captureException).mockClear()
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  consoleError.mockRestore()
})

describe('decouperEnLots', () => {
  it('liste vide → aucun lot', () => {
    expect(decouperEnLots([])).toEqual([])
  })

  it('150 identifiants → un seul lot ; 151 → 150 puis 1', () => {
    expect(TAILLE_LOT_IDS).toBe(150)
    expect(decouperEnLots(plage(0, 150)).map((l) => l.length)).toEqual([150])
    expect(decouperEnLots(plage(0, 151)).map((l) => l.length)).toEqual([150, 1])
  })

  it('1 000 identifiants → 7 lots de 150 au plus, qui redonnent la liste dans l’ordre', () => {
    const ids = plage(0, 1000)
    const lots = decouperEnLots(ids)
    expect(lots.map((l) => l.length)).toEqual([150, 150, 150, 150, 150, 150, 100])
    expect(lots.flat()).toEqual(ids)
  })

  it('taille de lot explicite', () => {
    expect(decouperEnLots([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })

  it('taille de lot invalide → RangeError', () => {
    expect(() => decouperEnLots([1], 0)).toThrow(RangeError)
    expect(() => decouperEnLots([1], -3)).toThrow(RangeError)
    expect(() => decouperEnLots([1], 1.5)).toThrow(RangeError)
  })
})

describe('idsAvecAgenda — filtre des fiches sans compte', () => {
  // Fiches telles que la page les construit : profiles_artisan → 'registered' si user_id, sinon
  // 'catalogue' ; artisans_catalogue → id `cat_…`, 'catalogue' ; fiche VITFIX épinglée (PT) → 'vitfix'.
  type Fiche = Pick<Artisan, 'id' | 'source' | 'user_id'>
  const inscrit: Fiche = { id: uuid(1), user_id: 'compte-1', source: 'registered' }
  const importeeSansCompte: Fiche = { id: uuid(2), user_id: null, source: 'catalogue' }
  const sansColonneUserId: Fiche = { id: uuid(3), source: 'catalogue' }
  const ficheCatalogue: Fiche = { id: 'cat_42', source: 'catalogue' }
  const ficheVitfix: Fiche = { id: 'vitfix-destaque', source: 'vitfix' }
  const registeredSansCompte: Fiche = { id: uuid(4), user_id: null, source: 'registered' }
  const catalogueAvecCompte: Fiche = { id: uuid(5), user_id: 'compte-5', source: 'catalogue' }

  it('ne garde que les fiches inscrites liées à un compte', () => {
    expect(
      idsAvecAgenda([
        inscrit,
        importeeSansCompte,
        sansColonneUserId,
        ficheCatalogue,
        ficheVitfix,
        registeredSansCompte,
        catalogueAvecCompte,
      ]),
    ).toEqual([uuid(1)])
  })

  it('sans doublon, dans l’ordre d’origine', () => {
    const autre: Fiche = { id: uuid(9), user_id: 'compte-9', source: 'registered' }
    expect(idsAvecAgenda([autre, inscrit, autre, importeeSansCompte, inscrit])).toEqual([uuid(9), uuid(1)])
  })

  it('aucune fiche avec compte → aucun identifiant (la page ne lance alors aucune requête)', () => {
    expect(idsAvecAgenda([importeeSansCompte, ficheCatalogue, ficheVitfix])).toEqual([])
  })

  it('758 fiches PT dont 12 avec compte → une seule requête par table, sans fiche importée', async () => {
    const fiches = plage(0, 758).map((id, i): Fiche =>
      i % 64 === 0 ? { id, user_id: `compte-${i}`, source: 'registered' } : { id, user_id: null, source: 'catalogue' },
    )
    const ids = idsAvecAgenda(fiches)
    expect(ids).toHaveLength(12)

    const { client, urls } = clientFactice()
    const dispo = await chargerParLots<Ligne>('availability', ids, (lot) => requeteDisponibilites(client, lot))
    const resa = await chargerParLots<Ligne>('bookings', ids, (lot) => requeteReservations(client, lot, '2026-10-23'))

    expect(urls).toHaveLength(2)
    for (const url of urls) expect(idsDeLUrl(url)).toEqual(ids)
    expect(dispo.map((l) => l.artisan_id)).toEqual(ids)
    expect(resa.map((l) => l.artisan_id)).toEqual(ids)
  })
})

describe('chargerParLots avec supabase-js', () => {
  it('reproduit le 400 : l’ancienne requête unique sur 758 identifiants fait une URL de près de 30 Ko', async () => {
    const { client, urls } = clientFactice()
    const { data, error } = await client
      .from('availability')
      .select('*')
      .in('artisan_id', plage(0, 758))
      .eq('is_available', true)
      .or('slot_type.eq.rdv,slot_type.is.null')
      .order('day_of_week')

    expect(urls[0].length).toBeGreaterThan(29_000)
    expect(error).not.toBeNull()
    expect(data).toBeNull()
  })

  async function verifierMilleIdentifiants(
    table: string,
    requete: (client: ClientFactice, lot: string[]) => PromiseLike<ReponseLot<Ligne>>,
  ) {
    const ids = plage(0, 1000)
    const { client, urls } = clientFactice()

    const lignes = await chargerParLots<Ligne>(table, ids, (lot) => requete(client, lot))

    expect(urls).toHaveLength(7)
    for (const url of urls) {
      expect(new URL(url).pathname).toBe(`/rest/v1/${table}`)
      expect(url.length).toBeLessThan(HUIT_KO)
    }
    // Chaque identifiant part une fois et une seule.
    expect(urls.flatMap(idsDeLUrl).sort()).toEqual([...ids].sort())
    // Lignes concaténées dans l'ordre des lots.
    expect(lignes.map((l) => l.artisan_id)).toEqual(ids)
    expect(consoleError).not.toHaveBeenCalled()
    expect(Sentry.captureException).not.toHaveBeenCalled()
  }

  it('availability, 1 000 identifiants : 7 requêtes, aucune URL au-delà de 8 Ko, toutes les lignes', async () => {
    await verifierMilleIdentifiants('availability', (client, lot) => requeteDisponibilites(client, lot))
  })

  it('bookings, 1 000 identifiants : 7 requêtes, aucune URL au-delà de 8 Ko, toutes les lignes', async () => {
    await verifierMilleIdentifiants('bookings', (client, lot) => requeteReservations(client, lot, '2026-10-23'))
  })

  it('cas FR (150 identifiants au plus) : une seule requête par table, identique à l’ancienne', async () => {
    const ids = plage(0, 40)
    const { client, urls } = clientFactice()

    await chargerParLots<Ligne>('availability', ids, (lot) => requeteDisponibilites(client, lot))
    await chargerParLots<Ligne>('bookings', ids, (lot) => requeteReservations(client, lot, '2026-10-23'))
    // Requêtes de la page avant correction, telles qu'elles étaient écrites.
    await client
      .from('availability')
      .select('*')
      .in('artisan_id', ids)
      .eq('is_available', true)
      .or('slot_type.eq.rdv,slot_type.is.null')
      .order('day_of_week')
    await client
      .from('bookings')
      .select('*')
      .in('artisan_id', ids)
      .gte('booking_date', '2026-10-23')
      .in('status', ['confirmed', 'pending'])

    expect(urls).toHaveLength(4)
    expect(urls[0]).toBe(urls[2])
    expect(urls[1]).toBe(urls[3])
  })

  it('aucun identifiant → aucune requête', async () => {
    const requete = vi.fn()
    await expect(chargerParLots<Ligne>('availability', [], requete)).resolves.toEqual([])
    expect(requete).not.toHaveBeenCalled()
  })
})

describe('chargerParLots — erreurs', () => {
  const ids = plage(0, 400) // 3 lots : 150, 150, 100
  const reussite = (lot: string[]): ReponseLot<Ligne> => ({
    data: lot.map((id) => ({ id: `ligne-${id}`, artisan_id: id })),
    error: null,
  })

  it('un lot en erreur est journalisé et remonté à Sentry ; les autres lots sont gardés', async () => {
    const lignes = await chargerParLots<Ligne>('availability', ids, async (lot) =>
      lot[0] === ids[150]
        ? { data: null, error: { message: 'Bad Request', code: '', details: '', hint: '' } }
        : reussite(lot),
    )

    expect(lignes.map((l) => l.artisan_id)).toEqual([...ids.slice(0, 150), ...ids.slice(300)])
    expect(consoleError).toHaveBeenCalledTimes(1)
    expect(String(consoleError.mock.calls[0][0])).toContain('availability')
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    const [erreur, contexte] = vi.mocked(Sentry.captureException).mock.calls[0]
    expect(erreur).toBeInstanceOf(Error)
    expect((erreur as Error).message).toContain('Bad Request')
    expect(contexte).toMatchObject({
      tags: { feature: 'recherche', table: 'availability' },
      extra: { lot: 2, lots: 3, identifiants: 150 },
    })
  })

  it('le 400 de la passerelle n’est plus ignoré', async () => {
    const { client } = clientFactice()
    // Lots volontairement trop gros (758 d'un coup) : la passerelle répond 400.
    const lignes = await chargerParLots<Ligne>('bookings', plage(0, 758), (lot) => requeteReservations(client, lot, '2026-10-23'), 758)

    expect(lignes).toEqual([])
    expect(consoleError).toHaveBeenCalledTimes(1)
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    expect(vi.mocked(Sentry.captureException).mock.calls[0][1]).toMatchObject({ tags: { table: 'bookings' } })
  })

  it('une requête qui lève une exception ou rejette ne fait pas perdre les autres lots', async () => {
    const lignes = await chargerParLots<Ligne>('bookings', ids, (lot) => {
      if (lot[0] === ids[0]) throw new Error('réseau coupé')
      if (lot[0] === ids[150]) return Promise.reject(new Error('délai dépassé'))
      return Promise.resolve(reussite(lot))
    })

    expect(lignes.map((l) => l.artisan_id)).toEqual(ids.slice(300))
    expect(consoleError).toHaveBeenCalledTimes(2)
    expect(Sentry.captureException).toHaveBeenCalledTimes(2)
    const messages = vi.mocked(Sentry.captureException).mock.calls.map(([e]) => (e as Error).message)
    expect(messages[0]).toContain('réseau coupé')
    expect(messages[1]).toContain('délai dépassé')
  })
})
