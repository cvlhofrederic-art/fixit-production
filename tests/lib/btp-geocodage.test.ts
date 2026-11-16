// tests/lib/btp-geocodage.test.ts — position GPS d'une adresse de chantier (lib/btp/geocodage.ts, 16/11/2026).
// Réponses simulées de la Base Adresse Nationale et de Nominatim ; adresses fictives.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { adresseComplete, geocoderAdresse, lienCarte } from '@/lib/btp/geocodage'

type Reponse = { statut?: number; corps: unknown }
let reponses: Record<'ban' | 'osm', Reponse | Error>
let appels: string[]

const ban = (type: string, score: number, lng = 5.38, lat = 43.25): Reponse => ({
  corps: { features: [{ geometry: { coordinates: [lng, lat] }, properties: { type, score } }] },
})
const osm = (placeRank: number, lat = '43.26', lon = '5.39'): Reponse => ({ corps: [{ lat, lon, place_rank: placeRank }] })

beforeEach(() => {
  appels = []
  reponses = { ban: { corps: { features: [] } }, osm: { corps: [] } }
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const adresse = String(url)
    appels.push(adresse)
    const reponse = adresse.includes('api-adresse.data.gouv.fr') ? reponses.ban : reponses.osm
    if (reponse instanceof Error) throw reponse
    return new Response(JSON.stringify(reponse.corps), { status: reponse.statut ?? 200 })
  })
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => { vi.restoreAllMocks() })

describe('geocoderAdresse', () => {
  it('France : un numéro ou une rue de la BAN (score suffisant) est précis, Nominatim n’est pas appelé', async () => {
    reponses.ban = ban('housenumber', 0.92)
    expect(await geocoderAdresse('1 rue des Lilas 13008 Marseille', 'FR')).toEqual({ latitude: 43.25, longitude: 5.38, precise: true })
    expect(appels).toHaveLength(1)
    reponses.ban = ban('street', 0.7)
    expect((await geocoderAdresse('rue des Lilas 13008 Marseille', 'FR'))?.precise).toBe(true)
  })

  it('France : centre de commune (ou score faible) dans la BAN → Nominatim ; s’il trouve la rue, sa position l’emporte', async () => {
    reponses.ban = ban('municipality', 0.95)
    reponses.osm = osm(30)
    expect(await geocoderAdresse('Chemin inconnu 13008 Marseille', 'FR')).toEqual({ latitude: 43.26, longitude: 5.39, precise: true })
    expect(appels[1]).toContain('countrycodes=fr')
    reponses.ban = ban('housenumber', 0.3)
    expect((await geocoderAdresse('1 rue mal écrite', 'FR'))?.precise).toBe(true)
  })

  it('France : ni l’une ni l’autre ne trouvent la rue → la meilleure réponse, marquée imprécise', async () => {
    reponses.ban = ban('municipality', 0.95)
    reponses.osm = osm(16)
    expect(await geocoderAdresse('Marseille', 'FR')).toEqual({ latitude: 43.25, longitude: 5.38, precise: false })
    reponses.ban = { corps: { features: [] } }
    expect(await geocoderAdresse('Marseille', 'FR')).toEqual({ latitude: 43.26, longitude: 5.39, precise: false })
  })

  it('Portugal : Nominatim seul, limité au Portugal (la BAN placerait l’adresse en France)', async () => {
    reponses.osm = osm(30, '41.15', '-8.61')
    expect(await geocoderAdresse('Rua de Santa Catarina 100 Porto', 'PT')).toEqual({ latitude: 41.15, longitude: -8.61, precise: true })
    expect(appels).toHaveLength(1)
    expect(appels[0]).toContain('nominatim.openstreetmap.org')
    expect(appels[0]).toContain('countrycodes=pt')
  })

  it('adresse vide, rien trouvé, service en panne : null, sans lever', async () => {
    expect(await geocoderAdresse('   ', 'FR')).toBeNull()
    expect(appels).toEqual([])
    expect(await geocoderAdresse('nulle part', 'FR')).toBeNull()
    reponses.ban = new Error('réseau coupé')
    expect(await geocoderAdresse('1 rue des Lilas', 'FR')).toBeNull()
    reponses.osm = { statut: 503, corps: {} }
    expect(await geocoderAdresse('Rua X', 'PT')).toBeNull()
  })
})

describe('adresse et carte', () => {
  it('adresse complète : rue, code postal, ville, sans morceaux vides', () => {
    expect(adresseComplete({ adresse: ' 1 rue des Lilas ', codePostal: '13008', ville: 'Marseille' })).toBe('1 rue des Lilas 13008 Marseille')
    expect(adresseComplete({ adresse: '', codePostal: null, ville: 'Marseille' })).toBe('Marseille')
    expect(adresseComplete({})).toBe('')
  })

  it('lien OpenStreetMap centré sur la position', () => {
    expect(lienCarte(43.25, 5.38)).toBe('https://www.openstreetmap.org/?mlat=43.25&mlon=5.38#map=18/43.25/5.38')
  })
})
