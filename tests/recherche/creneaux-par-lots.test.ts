// @vitest-environment node
// tests/recherche/creneaux-par-lots.test.ts
//
// Page de recherche (/fr/recherche/, reprise par /pt/pesquisar/) : créneaux demandés par lots
// d'identifiants (lib/recherche/creneaux-par-lots.ts), réservations jamais lues depuis la page publique.
//
// Constat du 23/10/2026 en production (confirmé le 28/10, Sentry) : sur /pt/pesquisar/, availability et
// bookings partaient en une seule requête `.in('artisan_id', ids)` sur 758 identifiants (URL de 29,7 Ko →
// 400 ; 558 identifiants, 21,9 Ko → 200), et l'erreur était ignorée. Les requêtes passent ici par le vrai
// client supabase-js, branché sur une passerelle factice qui refuse les URL trop longues comme en production.

import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@supabase/supabase-js'
import type { Artisan } from '@/components/recherche/ArtisanCard'
import {
  COLONNES_DISPONIBILITES,
  TAILLE_LOT_IDS,
  chargerParLots,
  chargerParLotsDetaille,
  decouperEnLots,
  idsAvecAgenda,
  requeteDisponibilites,
  signalerErreurRecherche,
  type ReponseLot,
} from '@/lib/recherche/creneaux-par-lots'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

/** UUID v4 bien formé et déterministe (36 caractères, comme les id de profiles_artisan). */
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const plage = (debut: number, nombre: number) => Array.from({ length: nombre }, (_, i) => uuid(debut + i))

/** Au-delà, la passerelle factice répond 400 : entre les 21,9 Ko acceptés et les 29,7 Ko refusés en production. */
const LIMITE_PASSERELLE = 25_000
/** Critère d'acceptation du 28/10/2026 : aucune URL de requête de plus de 4 000 caractères. */
const LIMITE_URL = 4_000
/** Hôte de production, pour mesurer des URL de la même longueur que dans le navigateur. */
const HOTE_PROD = 'https://irluhepekbqgquveaett.supabase.co'

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
  const client = createClient(HOTE_PROD, 'cle-anon-de-test', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: passerelle },
  })
  return { client, urls }
}

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

  it('80 identifiants → un seul lot ; 81 → 80 puis 1', () => {
    expect(TAILLE_LOT_IDS).toBe(80)
    expect(decouperEnLots(plage(0, 80)).map((l) => l.length)).toEqual([80])
    expect(decouperEnLots(plage(0, 81)).map((l) => l.length)).toEqual([80, 1])
  })

  it('1 000 identifiants → 13 lots de 80 au plus, qui redonnent la liste dans l’ordre', () => {
    const ids = plage(0, 1000)
    const lots = decouperEnLots(ids)
    expect(lots.map((l) => l.length)).toEqual([...Array(12).fill(80), 40])
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

  it('758 fiches PT dont 12 avec compte → une seule requête availability, sans fiche importée', async () => {
    const fiches = plage(0, 758).map((id, i): Fiche =>
      i % 64 === 0 ? { id, user_id: `compte-${i}`, source: 'registered' } : { id, user_id: null, source: 'catalogue' },
    )
    const ids = idsAvecAgenda(fiches)
    expect(ids).toHaveLength(12)

    const { client, urls } = clientFactice()
    const dispo = await chargerParLots<Ligne>('availability', ids, (lot) => requeteDisponibilites(client, lot))

    expect(urls).toHaveLength(1)
    expect(idsDeLUrl(urls[0])).toEqual(ids)
    expect(urls[0].length).toBeLessThan(LIMITE_URL)
    expect(dispo.map((l) => l.artisan_id)).toEqual(ids)
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

  it('availability, 1 000 identifiants : 13 requêtes, aucune URL de 4 000 caractères ou plus, toutes les lignes', async () => {
    const ids = plage(0, 1000)
    const { client, urls } = clientFactice()

    const lignes = await chargerParLots<Ligne>('availability', ids, (lot) => requeteDisponibilites(client, lot))

    expect(urls).toHaveLength(13)
    for (const url of urls) {
      const u = new URL(url)
      expect(u.pathname).toBe('/rest/v1/availability')
      expect(url.length).toBeLessThan(LIMITE_URL)
      // Colonnes limitées à ce que la page lit, plus de select=*.
      expect(u.searchParams.get('select')).toBe(COLONNES_DISPONIBILITES)
    }
    // Chaque identifiant part une fois et une seule.
    expect(urls.flatMap(idsDeLUrl).sort()).toEqual([...ids].sort())
    // Lignes concaténées dans l'ordre des lots.
    expect(lignes.map((l) => l.artisan_id)).toEqual(ids)
    expect(consoleError).not.toHaveBeenCalled()
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('cas FR (80 identifiants au plus) : une seule requête, mêmes filtres qu’avant', async () => {
    const ids = plage(0, 40)
    const { client, urls } = clientFactice()

    await chargerParLots<Ligne>('availability', ids, (lot) => requeteDisponibilites(client, lot))

    expect(urls).toHaveLength(1)
    const params = new URL(urls[0]).searchParams
    expect(idsDeLUrl(urls[0])).toEqual(ids)
    expect(params.get('is_available')).toBe('eq.true')
    expect(params.get('or')).toBe('(slot_type.eq.rdv,slot_type.is.null)')
    expect(params.get('order')).toBe('day_of_week.asc')
  })

  it('aucun identifiant → aucune requête', async () => {
    const requete = vi.fn()
    await expect(chargerParLots<Ligne>('availability', [], requete)).resolves.toEqual([])
    await expect(chargerParLotsDetaille<Ligne>('availability', [], requete)).resolves.toEqual({ lignes: [], erreurs: [] })
    expect(requete).not.toHaveBeenCalled()
  })
})

describe('chargerParLots — erreurs', () => {
  const ids = plage(0, 200) // 3 lots : 80, 80, 40
  const reussite = (lot: string[]): ReponseLot<Ligne> => ({
    data: lot.map((id) => ({ id: `ligne-${id}`, artisan_id: id })),
    error: null,
  })

  it('un lot en erreur est journalisé, remonté à Sentry et compté ; les autres lots sont gardés', async () => {
    const resultat = await chargerParLotsDetaille<Ligne>('availability', ids, async (lot) =>
      lot[0] === ids[80]
        ? { data: null, error: { message: 'Bad Request', code: '', details: '', hint: '' } }
        : reussite(lot),
    )

    expect(resultat.lignes.map((l) => l.artisan_id)).toEqual([...ids.slice(0, 80), ...ids.slice(160)])
    expect(resultat.erreurs).toEqual([{ message: 'Bad Request', code: '', details: '', hint: '' }])
    expect(consoleError).toHaveBeenCalledTimes(1)
    expect(String(consoleError.mock.calls[0][0])).toContain('availability')
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    const [erreur, contexte] = vi.mocked(Sentry.captureException).mock.calls[0]
    expect(erreur).toBeInstanceOf(Error)
    expect((erreur as Error).message).toContain('Bad Request')
    expect(contexte).toMatchObject({
      tags: { feature: 'recherche', table: 'availability' },
      extra: { lot: 2, lots: 3, identifiants: 80 },
    })
  })

  it('le 400 de la passerelle n’est plus ignoré', async () => {
    const { client } = clientFactice()
    // Lot volontairement trop gros (758 d'un coup) : la passerelle répond 400.
    const resultat = await chargerParLotsDetaille<Ligne>('availability', plage(0, 758), (lot) => requeteDisponibilites(client, lot), 758)

    expect(resultat.lignes).toEqual([])
    expect(resultat.erreurs).toHaveLength(1)
    expect(consoleError).toHaveBeenCalledTimes(1)
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    expect(vi.mocked(Sentry.captureException).mock.calls[0][1]).toMatchObject({ tags: { table: 'availability' } })
  })

  it('une requête qui lève une exception ou rejette ne fait pas perdre les autres lots', async () => {
    const lignes = await chargerParLots<Ligne>('availability', ids, (lot) => {
      if (lot[0] === ids[0]) throw new Error('réseau coupé')
      if (lot[0] === ids[80]) return Promise.reject(new Error('délai dépassé'))
      return Promise.resolve(reussite(lot))
    })

    expect(lignes.map((l) => l.artisan_id)).toEqual(ids.slice(160))
    expect(consoleError).toHaveBeenCalledTimes(2)
    expect(Sentry.captureException).toHaveBeenCalledTimes(2)
    const messages = vi.mocked(Sentry.captureException).mock.calls.map(([e]) => (e as Error).message)
    expect(messages[0]).toContain('réseau coupé')
    expect(messages[1]).toContain('délai dépassé')
  })

  it('signalerErreurRecherche : journal + Sentry avec la table et le contexte, sans lever', () => {
    expect(() =>
      signalerErreurRecherche('profiles_artisan', { message: 'permission denied', code: '42501' }, { langue: 'pt' }),
    ).not.toThrow()
    expect(consoleError).toHaveBeenCalledTimes(1)
    expect(String(consoleError.mock.calls[0][0])).toContain('profiles_artisan')
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    const [erreur, contexte] = vi.mocked(Sentry.captureException).mock.calls[0]
    expect((erreur as Error).message).toBe('recherche profiles_artisan : permission denied')
    expect(contexte).toMatchObject({
      tags: { feature: 'recherche', table: 'profiles_artisan' },
      extra: { code: '42501', details: null, hint: null, langue: 'pt' },
    })
  })
})

describe('page de recherche : réservations jamais lues depuis la page publique', () => {
  const page = readFileSync(join(process.cwd(), 'app/fr/recherche/page.tsx'), 'utf8')
  const carte = readFileSync(join(process.cwd(), 'components/recherche/ArtisanCard.tsx'), 'utf8')

  it('la page ne lit plus bookings et passe par les lots détaillés', () => {
    expect(page).not.toMatch(/from\(['"]bookings['"]\)/)
    expect(page).not.toContain('requeteReservations')
    expect(page).not.toContain('allBookings')
    expect(page).toContain('idsAvecAgenda(')
    expect(page).toContain("chargerParLotsDetaille<Availability>('availability'")
    expect(page).toContain('signalerErreurRecherche(')
  })

  it('la carte ne reçoit plus de réservations', () => {
    expect(carte).not.toMatch(/bookings/i)
  })
})
