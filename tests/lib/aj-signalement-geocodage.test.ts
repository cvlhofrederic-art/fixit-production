// @vitest-environment node
// tests/lib/aj-signalement-geocodage.test.ts
//
// Géocodage inverse auprès du service officiel de l'État (Géoplateforme IGN, qui reprend l'API Adresse de la Base
// Adresse Nationale) : https://data.geopf.fr/geocodage/reverse, jamais l'ancienne api-adresse.data.gouv.fr.
//   - requête : lon et lat arrondis à 5 décimales, index=address, limit=1, délai maximal, hors traçage Sentry ;
//   - libellé composé (nom + code postal + commune), sans le suffixe « ,arrondissement » des rues et lieux-dits ;
//   - toute panne (400, 429, 500, aucune adresse, JSON illisible, délai dépassé) donne null, jamais d'exception ;
//   - ni les coordonnées ni l'URL ne sont écrites au logger.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  warn: vi.fn(), error: vi.fn(), info: vi.fn(),
  suppressTracing: vi.fn(<T,>(rappel: () => T): T => rappel()),
}))
vi.mock('@sentry/nextjs', () => ({ suppressTracing: h.suppressTracing, captureException: vi.fn(), withScope: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { warn: h.warn, error: h.error, info: h.info, debug: vi.fn() } }))

import {
  DECIMALES_COORDONNEES_QR, DELAI_GEOCODAGE_MS, URL_GEOCODAGE_INVERSE, arrondirCoordonneeQr, geocoderInverse, libelleAdresseBan,
} from '@/lib/aj-signalement/geocodage'

const LATITUDE = 43.2512345678
const LONGITUDE = 5.4198765432

const collection = (properties: Record<string, unknown> | null) => ({
  type: 'FeatureCollection',
  features: properties ? [{ type: 'Feature', geometry: { type: 'Point', coordinates: [5.41988, 43.25123] }, properties }] : [],
})
const reponse = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { 'content-type': 'application/json' } })
const fetchQuiRend = (r: () => Response | Promise<Response>) => vi.fn(async (_url: string, _init?: RequestInit) => r())

const NUMERO = { type: 'housenumber', label: '56 Avenue de la Panouse 13009 Marseille', name: '56 Avenue de la Panouse', postcode: '13009', city: 'Marseille' }

beforeEach(() => {
  h.warn.mockClear()
  h.error.mockClear()
  h.info.mockClear()
  h.suppressTracing.mockClear()
})

describe('service appelé', () => {
  it('URL officielle de la Géoplateforme, délai de 4 secondes, 5 décimales', () => {
    expect(URL_GEOCODAGE_INVERSE).toBe('https://data.geopf.fr/geocodage/reverse')
    expect(DELAI_GEOCODAGE_MS).toBe(4000)
    expect(DECIMALES_COORDONNEES_QR).toBe(5)
    expect(arrondirCoordonneeQr(LATITUDE)).toBe(43.25123)
    expect(arrondirCoordonneeQr(LONGITUDE)).toBe(5.41988)
    expect(arrondirCoordonneeQr(-0.000004)).toBe(0)
  })

  it('requête : coordonnées arrondies, index=address, limit=1, délai, hors traçage Sentry ; jamais l’ancienne URL', async () => {
    const fetchImpl = fetchQuiRend(() => reponse(collection(NUMERO)))
    expect(await geocoderInverse(LATITUDE, LONGITUDE, fetchImpl as unknown as typeof fetch)).toBe('56 Avenue de la Panouse 13009 Marseille')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0]
    const u = new URL(url)
    expect(`${u.origin}${u.pathname}`).toBe(URL_GEOCODAGE_INVERSE)
    expect(u.searchParams.get('lat')).toBe('43.25123')
    expect(u.searchParams.get('lon')).toBe('5.41988')
    expect(u.searchParams.get('index')).toBe('address')
    expect(u.searchParams.get('limit')).toBe('1')
    expect(url).not.toContain('api-adresse.data.gouv.fr')
    expect(init?.signal).toBeInstanceOf(AbortSignal)
    expect(h.suppressTracing).toHaveBeenCalledTimes(1)
  })
})

describe('libellé de l’adresse', () => {
  it('numéro : nom, code postal et commune', () => {
    expect(libelleAdresseBan(NUMERO)).toBe('56 Avenue de la Panouse 13009 Marseille')
  })

  it('rue et lieu-dit : composé, sans le suffixe « ,arrondissement » du label', () => {
    expect(libelleAdresseBan({
      type: 'street', label: 'Parvis Notre-Dame Place Jean-Paul II 75004 Paris,Paris 4e Arrondissement',
      name: 'Parvis Notre-Dame Place Jean-Paul II', postcode: '75004', city: 'Paris', district: 'Paris 4e Arrondissement',
    })).toBe('Parvis Notre-Dame Place Jean-Paul II 75004 Paris')
    expect(libelleAdresseBan({
      type: 'locality', label: 'Résidence le Parc des Cèdres 13009 Marseille,Marseille 9e Arrondissement',
      name: 'Résidence le Parc des Cèdres', postcode: '13009', city: 'Marseille',
    })).toBe('Résidence le Parc des Cèdres 13009 Marseille')
  })

  it('commune seule : code postal et commune ; label coupé à la première virgule en dernier recours', () => {
    expect(libelleAdresseBan({ type: 'municipality', label: 'Cassis', name: 'Cassis', postcode: '13260', city: 'Cassis' })).toBe('13260 Cassis')
    expect(libelleAdresseBan({ label: 'Allée des Pins 13009 Marseille,Marseille 9e Arrondissement' })).toBe('Allée des Pins 13009 Marseille')
  })

  it('espaces réduits, 300 caractères au plus ; rien d’exploitable → null', () => {
    expect(libelleAdresseBan({ type: 'street', name: '  Rue   des  Lilas ', postcode: ' 13009', city: 'Marseille  ' })).toBe('Rue des Lilas 13009 Marseille')
    expect(libelleAdresseBan({ type: 'street', name: 'x'.repeat(400), postcode: '13009', city: 'Marseille' })?.length).toBe(300)
    expect(libelleAdresseBan({})).toBeNull()
    expect(libelleAdresseBan(null)).toBeNull()
    expect(libelleAdresseBan('Rue des Lilas')).toBeNull()
    expect(libelleAdresseBan({ label: 42, name: ['x'] })).toBeNull()
  })
})

describe('pannes : null, jamais d’exception, rien de la position au logger', () => {
  it.each([
    ['aucune adresse (hors de France, en mer)', () => reponse(collection(null))],
    ['400 (coordonnées hors limites)', () => reponse({ code: 400, message: 'Failed parsing query' }, 400)],
    ['429 (50 requêtes par seconde et par IP)', () => reponse({ message: 'Too Many Requests' }, 429)],
    ['500', () => reponse({}, 500)],
    ['JSON illisible', () => new Response('<html>Erreur</html>', { status: 200 })],
    ['réponse inattendue', () => reponse({ features: 'non' })],
  ])('%s → null', async (_cas, r) => {
    expect(await geocoderInverse(LATITUDE, LONGITUDE, fetchQuiRend(r) as unknown as typeof fetch)).toBeNull()
    const journal = JSON.stringify([h.warn.mock.calls, h.error.mock.calls, h.info.mock.calls])
    expect(journal).not.toContain('43.25')
    expect(journal).not.toContain('5.41')
    expect(journal).not.toContain('geopf')
  })

  it('délai dépassé ou réseau coupé (exception de fetch) → null, journalisé par le nom de l’erreur seulement', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new DOMException(`The operation was aborted: ${URL_GEOCODAGE_INVERSE}?lon=5.41988&lat=43.25123`, 'TimeoutError')
    })
    expect(await geocoderInverse(LATITUDE, LONGITUDE, fetchImpl as unknown as typeof fetch)).toBeNull()
    expect(h.warn).toHaveBeenCalledTimes(1)
    const journal = JSON.stringify(h.warn.mock.calls)
    expect(journal).toContain('TimeoutError')
    expect(journal).not.toContain('43.25')
    expect(journal).not.toContain('5.41')
  })

  it('statut d’échec journalisé sans l’URL', async () => {
    await geocoderInverse(LATITUDE, LONGITUDE, fetchQuiRend(() => reponse({}, 429)) as unknown as typeof fetch)
    expect(h.warn).toHaveBeenCalledWith(expect.stringContaining('géocodage'), { statut: 429 })
  })
})
