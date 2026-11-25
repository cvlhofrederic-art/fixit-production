// tests/lib/btp-geocodage.test.ts — position GPS d'une adresse de chantier (lib/btp/geocodage.ts, 16/11/2026).
// « Précise » = le numéro ou la rue saisis, dans la commune saisie : sinon le pointage automatique se déclencherait au
// mauvais endroit. Cas tirés de réponses réelles de la BAN relevées par la relecture (communes homonymes, lieux-dits,
// lotissements). Réponses simulées de la Base Adresse Nationale et de Nominatim ; adresses fictives.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { adresseComplete, decomposerAdresse, geocoderAdresse, lienCarte, normaliserLieu, rueSansComplements } from '@/lib/btp/geocodage'

type Reponse = { statut?: number; corps: unknown }
let reponses: Record<'ban' | 'osm', Reponse | Error>
let appels: string[]
/** Réponse de la BAN propre à une recherche (texte `q`) ; à défaut, `reponses.ban`. */
let banSelonRecherche: Record<string, Reponse | Error>
const rechercheBan = (url: string) => new URL(url).searchParams.get('q') ?? ''

interface Lieu { postcode?: string; city?: string; lat?: number; lng?: number; housenumber?: string; street?: string }
const ban = (type: string, score: number, { postcode = '13008', city = 'Marseille', lat = 43.25, lng = 5.38, housenumber, street }: Lieu = {}): Reponse => ({
  corps: { features: [{ geometry: { coordinates: [lng, lat] }, properties: { type, score, postcode, city, housenumber, street } }] },
})
const osm = (placeRank: number, address: Record<string, string>, lat = '43.26', lon = '5.39'): Reponse => ({
  corps: [{ lat, lon, place_rank: placeRank, address }],
})

const LILAS = { adresse: '1 rue des Lilas', codePostal: '13008', ville: 'Marseille' }

beforeEach(() => {
  appels = []
  reponses = { ban: { corps: { features: [] } }, osm: { corps: [] } }
  banSelonRecherche = {}
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const adresse = String(url)
    appels.push(adresse)
    const reponse = adresse.includes('api-adresse.data.gouv.fr')
      ? (banSelonRecherche[rechercheBan(adresse)] ?? reponses.ban)
      : reponses.osm
    if (reponse instanceof Error) throw reponse
    return new Response(JSON.stringify(reponse.corps), { status: reponse.statut ?? 200 })
  })
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => { vi.restoreAllMocks() })

describe('geocoderAdresse — France (BAN)', () => {
  it('numéro trouvé dans la commune saisie : précis, BAN filtrée par le code postal, Nominatim pas appelé', async () => {
    reponses.ban = ban('housenumber', 0.92)
    expect(await geocoderAdresse(LILAS, 'FR')).toEqual({ latitude: 43.25, longitude: 5.38, precise: true })
    expect(appels).toHaveLength(1)
    expect(appels[0]).toContain(`q=${encodeURIComponent('1 rue des Lilas 13008 Marseille')}`)
    expect(appels[0]).toContain('&postcode=13008')
  })

  it('seuils de la BAN : numéro dès 0,6 ; rue sans numéro dès 0,8 (en dessous : rue voisine au nom ressemblant)', async () => {
    reponses.ban = ban('housenumber', 0.6)
    expect((await geocoderAdresse(LILAS, 'FR'))?.precise).toBe(true)
    reponses.ban = ban('housenumber', 0.59)
    expect(await geocoderAdresse(LILAS, 'FR')).toEqual({ latitude: 43.25, longitude: 5.38, precise: false })
    reponses.ban = ban('street', 0.8)
    expect((await geocoderAdresse({ ...LILAS, adresse: 'rue des Lilas' }, 'FR'))?.precise).toBe(true)
    reponses.ban = ban('street', 0.79)
    expect((await geocoderAdresse({ ...LILAS, adresse: 'rue des Lilas' }, 'FR'))?.precise).toBe(false)
    reponses.ban = ban('municipality', 0.99)
    expect((await geocoderAdresse(LILAS, 'FR'))?.precise).toBe(false)
  })

  it('cas réels : commune seule au nom répandu, lieu-dit, lotissement → jamais précis', async () => {
    // « Saint-Martin » seul : la BAN rend une rue Saint-Martin à Carcassonne (street, 0,96).
    reponses.ban = ban('street', 0.96, { postcode: '11000', city: 'Carcassonne', lat: 43.21, lng: 2.35 })
    expect((await geocoderAdresse({ adresse: '', ville: 'Saint-Martin' }, 'FR'))?.precise).toBe(false)
    // Lieu-dit « Les Pins » : la BAN rend le Chemin des Pignes, une autre rue (street, 0,56).
    reponses.ban = ban('street', 0.56, { postcode: '13360', city: 'Roquevaire' })
    expect((await geocoderAdresse({ adresse: 'Les Pins', codePostal: '13360', ville: 'Roquevaire' }, 'FR'))?.precise).toBe(false)
    // Lotissement : la BAN rend le Chemin des Oliviers (street, 0,51).
    reponses.ban = ban('street', 0.51, { postcode: '13390', city: 'Auriol' })
    expect((await geocoderAdresse({ adresse: 'Lotissement Les Oliviers', codePostal: '13390', ville: 'Auriol' }, 'FR'))?.precise).toBe(false)
  })

  it('commune vérifiée : autre code postal ou autre ville → imprécis ; ville écrite autrement (accents, « St ») → précis', async () => {
    reponses.ban = ban('housenumber', 0.95, { postcode: '13009' })
    expect((await geocoderAdresse(LILAS, 'FR'))?.precise).toBe(false)
    reponses.ban = ban('housenumber', 0.95, { postcode: '13008', city: 'Marseille' })
    expect((await geocoderAdresse({ adresse: '1 rue des Lilas', ville: 'Aubagne' }, 'FR'))?.precise).toBe(false)
    expect((await geocoderAdresse({ adresse: '1 rue des Lilas', codePostal: '13008', ville: 'Marseille 8e' }, 'FR'))?.precise).toBe(true)
    reponses.ban = ban('housenumber', 0.95, { postcode: '13310', city: 'Saint-Martin-de-Crau' })
    expect((await geocoderAdresse({ adresse: '3 chemin du Mas', ville: 'St Martin de Crau' }, 'FR'))?.precise).toBe(true)
  })

  it('commune seule, même bien retrouvée : jamais précis (la rue qui porte le nom de la commune n’est pas le chantier)', async () => {
    reponses.ban = ban('street', 0.96, { postcode: '32300', city: 'Saint-Martin' })
    expect((await geocoderAdresse({ adresse: '', codePostal: '32300', ville: 'Saint-Martin' }, 'FR'))?.precise).toBe(false)
  })

  it('rue sans code postal ni ville : impossible de vérifier la commune → imprécis', async () => {
    reponses.ban = ban('housenumber', 0.97)
    expect((await geocoderAdresse({ adresse: '1 rue des Lilas' }, 'FR'))?.precise).toBe(false)
  })

  it('adresse d’un devis importé, en une ligne : code postal et ville extraits et vérifiés', async () => {
    reponses.ban = ban('housenumber', 0.9)
    expect((await geocoderAdresse({ adresse: '1 rue des Lilas, 13008 Marseille' }, 'FR'))?.precise).toBe(true)
    expect(appels[0]).toContain(`q=${encodeURIComponent('1 rue des Lilas 13008 Marseille')}`)
    expect(appels[0]).toContain('&postcode=13008')
  })
})

describe('geocoderAdresse — nom de résidence ou de bâtiment devant la rue (France, 25/11/2026)', () => {
  // Scores relevés sur la BAN réelle le 25/11/2026 : « Immeuble Le Méditerranée, 3 avenue du Prado 13006 Marseille »
  // → numéro juste, score 0,52 ; « 3 avenue du Prado 13006 Marseille » → même numéro, 0,97.
  const PRADO = { adresse: 'Immeuble Le Méditerranée, 3 avenue du Prado', codePostal: '13006', ville: 'Marseille' }
  const PRADO_SEUL = '3 avenue du Prado 13006 Marseille'
  const PRADO_PEU_SUR = ban('housenumber', 0.52, { postcode: '13006', lat: 43.28, lng: 5.39, housenumber: '3', street: 'Avenue du Prado' })
  const prado = (lieu: Lieu = {}) =>
    ban('housenumber', 0.97, { postcode: '13006', lat: 43.2801, lng: 5.3901, housenumber: '3', street: 'Avenue du Prado', ...lieu })

  it('BAN peu sûre à cause de l’immeuble : seconde recherche avec la rue seule, précise, Nominatim pas appelé', async () => {
    reponses.ban = PRADO_PEU_SUR
    banSelonRecherche[PRADO_SEUL] = prado()
    expect(await geocoderAdresse(PRADO, 'FR')).toEqual({ latitude: 43.2801, longitude: 5.3901, precise: true })
    expect(appels.map(rechercheBan)).toEqual(['Immeuble Le Méditerranée, 3 avenue du Prado 13006 Marseille', PRADO_SEUL])
    expect(appels[1]).toContain('&postcode=13006')
  })

  it('adresse d’un devis importé : bâtiment, résidence et étage autour de la rue, code postal dans la même ligne', async () => {
    reponses.ban = ban('housenumber', 0.56, { postcode: '13001' })
    banSelonRecherche['10 rue de la République 13001 Marseille'] =
      ban('housenumber', 0.97, { postcode: '13001', housenumber: '10', street: 'Rue de la Republique' })
    const adresse = 'Bât B, Résidence Le Parc, 10 rue de la République, Étage 2 Apt 3, 13001 Marseille'
    expect((await geocoderAdresse({ adresse }, 'FR'))?.precise).toBe(true)
    expect(appels).toHaveLength(2)
  })

  it('voie abrégée, « bis » : comparée en toutes lettres à celle de la BAN', async () => {
    reponses.ban = PRADO_PEU_SUR
    banSelonRecherche['4 bis av. du Prado 13006 Marseille'] = prado({ housenumber: '4bis' })
    expect((await geocoderAdresse({ ...PRADO, adresse: 'Résidence Le Parc, 4 bis av. du Prado' }, 'FR'))?.precise).toBe(true)
  })

  it('BAN qui rend un autre numéro, une autre voie ou une rue entière : refusée, la première réponse reste, imprécise', async () => {
    reponses.ban = PRADO_PEU_SUR
    // « Résidence Le Lac, 2 Le Clos » : la BAN réelle rend le 2 rue du Clos (0,63), une autre voie.
    banSelonRecherche[PRADO_SEUL] = prado({ street: 'Rue du Clos' })
    expect(await geocoderAdresse(PRADO, 'FR')).toEqual({ latitude: 43.28, longitude: 5.39, precise: false })
    banSelonRecherche[PRADO_SEUL] = prado({ housenumber: '5' })
    expect((await geocoderAdresse(PRADO, 'FR'))?.precise).toBe(false)
    // Rue entière, même très sûre : son centre n'est pas le bâtiment du chantier.
    banSelonRecherche[PRADO_SEUL] = ban('street', 0.99, { postcode: '13006', housenumber: '3', street: 'Avenue du Prado' })
    expect((await geocoderAdresse(PRADO, 'FR'))?.precise).toBe(false)
  })

  it('rue seule retrouvée dans une autre commune ou un autre code postal : refusée, puis Nominatim avec l’adresse complète', async () => {
    reponses.ban = PRADO_PEU_SUR
    banSelonRecherche[PRADO_SEUL] = prado({ postcode: '13008', lat: 43.24, lng: 5.38 })
    expect(await geocoderAdresse(PRADO, 'FR')).toEqual({ latitude: 43.28, longitude: 5.39, precise: false })
    expect(appels).toHaveLength(3)
    expect(appels[2]).toContain('nominatim.openstreetmap.org')
    expect(appels[2]).toContain(encodeURIComponent('Immeuble Le Méditerranée, 3 avenue du Prado 13006 Marseille'))
    banSelonRecherche[PRADO_SEUL] = prado({ city: 'Aubagne', lat: 43.29, lng: 5.57 })
    expect((await geocoderAdresse(PRADO, 'FR'))?.precise).toBe(false)
  })

  it('rue seule encore peu sûre (numéro sous 0,6) : imprécis', async () => {
    reponses.ban = PRADO_PEU_SUR
    banSelonRecherche[PRADO_SEUL] = ban('housenumber', 0.59, { postcode: '13006', housenumber: '3', street: 'Avenue du Prado' })
    expect((await geocoderAdresse(PRADO, 'FR'))?.precise).toBe(false)
  })

  it('bâtiment, lot ou appartement numéroté sans numéro de rue : pas de seconde recherche (« Bât 3 » n’est pas le 3 de la rue)', async () => {
    reponses.ban = ban('housenumber', 0.55, { postcode: '13006' })
    for (const adresse of ['Résidence Le Parc, Bât 3, avenue du Prado', 'bâtiment 3 avenue du Prado', 'Lot 12, rue de la République', 'Appt 21, rue Paradis']) {
      appels = []
      expect((await geocoderAdresse({ adresse, codePostal: '13006', ville: 'Marseille' }, 'FR'))?.precise).toBe(false)
      expect(appels.filter(a => a.includes('api-adresse.data.gouv.fr'))).toHaveLength(1)
    }
  })

  it('panne de la seconde recherche : la première réponse reste et Nominatim est appelé', async () => {
    reponses.ban = PRADO_PEU_SUR
    banSelonRecherche[PRADO_SEUL] = new Error('délai dépassé')
    expect(await geocoderAdresse(PRADO, 'FR')).toEqual({ latitude: 43.28, longitude: 5.39, precise: false })
    expect(appels).toHaveLength(3)
    expect(console.warn).toHaveBeenCalledWith('[btp] seconde recherche de l’adresse impossible :', 'délai dépassé')
  })

  it('adresse sans complément : une seule recherche BAN, comme avant (puis Nominatim si elle est imprécise)', async () => {
    reponses.ban = ban('housenumber', 0.59)
    expect((await geocoderAdresse(LILAS, 'FR'))?.precise).toBe(false)
    expect(appels.filter(a => a.includes('api-adresse.data.gouv.fr'))).toHaveLength(1)
    expect(appels).toHaveLength(2)
  })

  it('première recherche déjà sûre : pas de seconde recherche', async () => {
    reponses.ban = ban('housenumber', 0.6, { postcode: '13006' })
    expect((await geocoderAdresse(PRADO, 'FR'))?.precise).toBe(true)
    expect(appels).toHaveLength(1)
  })

  it('Portugal inchangé : Nominatim seul, une recherche avec l’adresse complète', async () => {
    reponses.osm = osm(30, { road: 'Rua de Santa Catarina', postcode: '4000-447', city: 'Porto' }, '41.15', '-8.61')
    const edificio = { adresse: 'Edifício Miradouro, Rua de Santa Catarina 100', codePostal: '4000-447', ville: 'Porto' }
    expect((await geocoderAdresse(edificio, 'PT'))?.precise).toBe(true)
    expect(appels).toHaveLength(1)
    expect(appels[0]).toContain('nominatim.openstreetmap.org')
    expect(appels[0]).toContain(encodeURIComponent('Edifício Miradouro, Rua de Santa Catarina 100 4000-447 Porto'))
  })
})

describe('rueSansComplements', () => {
  const rue = (texte: string) => rueSansComplements(texte)?.texte ?? null

  it('garde le morceau qui commence par le numéro de rue ; résidence, bâtiment, immeuble et étage retirés, avant ou après', () => {
    expect(rueSansComplements('Résidence Les Pins, 10 rue de la République')).toEqual({ numero: '10', voie: 'rue de la République', texte: '10 rue de la République' })
    expect(rue('Bât B, Résidence Le Parc, 10 rue de la République, Étage 2 Apt 3')).toBe('10 rue de la République')
    expect(rue('10 rue de la République, Étage 2 Apt 3')).toBe('10 rue de la République')
    expect(rue('Les Terrasses du Port - 12 quai du Port')).toBe('12 quai du Port')
    expect(rueSansComplements('Résidence 2000;  4 bis   allée des Pins')).toEqual({ numero: '4 bis', voie: 'allée des Pins', texte: '4 bis allée des Pins' })
    expect(rue('Résidence Les 4 Cours, 10 rue Paradis')).toBe('10 rue Paradis')
    expect(rue('Résidence Le Lac, 10 La Canebière')).toBe('10 La Canebière')
    expect(rue('Résidence Le Lac, 2 étage, 12B rue des Lilas')).toBe('12B rue des Lilas')
  })

  it('numéro d’un bâtiment, d’un lot, d’un appartement, d’un étage, d’une boîte postale : jamais pris pour celui de la rue', () => {
    expect(rue('Résidence Le Parc, Bât 3, avenue du Prado')).toBeNull()
    expect(rue('Lotissement Le Clos, Lot 12, rue de la République')).toBeNull()
    expect(rue('Appt 21, rue Paradis')).toBeNull()
    expect(rue('Villa 7, chemin des Vignes')).toBeNull()
    expect(rue('BP 123, avenue du Prado')).toBeNull()
    expect(rue('Résidence Le Lac, 2 étage')).toBeNull()
    expect(rue('Le Clos, 3 bât. B')).toBeNull()
    // « 3 bis, avenue » : « bis » n'est pas une voie.
    expect(rue('Le Méditerranée, 3 bis, avenue du Prado')).toBeNull()
  })

  it('un seul morceau, ou rien qui commence par un numéro de rue : null (pas de seconde recherche)', () => {
    expect(rue('10 rue de la République')).toBeNull()
    expect(rue('Résidence Les Pins 10 rue de la République')).toBeNull()
    expect(rue('bâtiment 3 avenue du Prado')).toBeNull()
    expect(rue('Lotissement Les Oliviers, chemin de la Source')).toBeNull()
    expect(rue('Résidence Les Pins, Bât B')).toBeNull()
    expect(rue('')).toBeNull()
  })

  it('limites connues (première recherche seule, comme avant) : virgule après le numéro, résidence sans séparateur', () => {
    // « 10, rue des Lilas » est bien le numéro de la rue, mais un morceau « 10 » seul ne se distingue pas d'un numéro de
    // bâtiment : pas de seconde recherche. Les adresses importées d'un devis n'ont pas cette virgule.
    expect(rue('Résidence Le Lac, 10, rue des Lilas')).toBeNull()
    expect(rue('Immeuble Le Méditerranée 3 avenue du Prado')).toBeNull()
  })
})

describe('geocoderAdresse — Nominatim (secours en France, seul service au Portugal)', () => {
  it('France : BAN imprécise, Nominatim trouve le numéro dans la commune → sa position l’emporte', async () => {
    reponses.ban = ban('municipality', 0.95)
    reponses.osm = osm(30, { house_number: '1', road: 'Rue des Lilas', postcode: '13008', city: 'Marseille' })
    expect(await geocoderAdresse(LILAS, 'FR')).toEqual({ latitude: 43.26, longitude: 5.39, precise: true })
    expect(appels[1]).toContain('countrycodes=fr')
    expect(appels[1]).toContain('addressdetails=1')
    expect(appels[1]).toContain('accept-language=fr')
  })

  it('France : Nominatim dans une autre commune, ou trop vague → la meilleure réponse, marquée imprécise', async () => {
    reponses.ban = ban('municipality', 0.95)
    reponses.osm = osm(30, { road: 'Rue des Lilas', postcode: '84000', city: 'Avignon' })
    expect(await geocoderAdresse(LILAS, 'FR')).toEqual({ latitude: 43.25, longitude: 5.38, precise: false })
    reponses.ban = { corps: { features: [] } }
    reponses.osm = osm(16, { city: 'Marseille', postcode: '13008' })
    expect(await geocoderAdresse(LILAS, 'FR')).toEqual({ latitude: 43.26, longitude: 5.39, precise: false })
  })

  it('Portugal : Nominatim seul, limité au Portugal et en portugais ; code postal comparé sur ses quatre premiers chiffres', async () => {
    reponses.osm = osm(30, { road: 'Rua de Santa Catarina', postcode: '4000-447', city: 'Porto' }, '41.15', '-8.61')
    expect(await geocoderAdresse({ adresse: 'Rua de Santa Catarina 100', codePostal: '4000-447', ville: 'Porto' }, 'PT'))
      .toEqual({ latitude: 41.15, longitude: -8.61, precise: true })
    expect(appels).toHaveLength(1)
    expect(appels[0]).toContain('countrycodes=pt')
    expect(appels[0]).toContain('accept-language=pt')
    expect((await geocoderAdresse({ adresse: 'Rua de Santa Catarina 100', codePostal: '4000', ville: '' }, 'PT'))?.precise).toBe(true)
    expect((await geocoderAdresse({ adresse: 'Rua de Santa Catarina 100', codePostal: '4050-123' }, 'PT'))?.precise).toBe(false)
    // Concelho seul : le centre de la ville, imprécis.
    expect((await geocoderAdresse({ adresse: '', ville: 'Porto' }, 'PT'))?.precise).toBe(false)
  })

  it('adresse vide, rien trouvé, service en panne : null, sans lever', async () => {
    expect(await geocoderAdresse({ adresse: '  ', codePostal: null, ville: undefined }, 'FR')).toBeNull()
    expect(appels).toEqual([])
    expect(await geocoderAdresse({ ville: 'Nulle-Part' }, 'FR')).toBeNull()
    reponses.ban = new Error('réseau coupé')
    expect(await geocoderAdresse(LILAS, 'FR')).toBeNull()
    reponses.osm = { statut: 503, corps: {} }
    expect(await geocoderAdresse({ adresse: 'Rua X', ville: 'Porto' }, 'PT')).toBeNull()
  })
})

describe('adresse et carte', () => {
  it('décomposition : code postal et ville extraits de l’adresse ; au Portugal, seulement le code complet (pas une année)', () => {
    expect(decomposerAdresse({ adresse: '12 rue des Lilas, 13008 Marseille' }, 'FR')).toEqual({ rue: '12 rue des Lilas', codePostal: '13008', ville: 'Marseille' })
    expect(decomposerAdresse({ adresse: '12 rue des Lilas, 13008 Marseille', codePostal: '13008', ville: 'Marseille' }, 'FR'))
      .toEqual({ rue: '12 rue des Lilas', codePostal: '13008', ville: 'Marseille' })
    expect(decomposerAdresse({ adresse: 'Rua 25 de Abril 1974, 4000-123 Porto' }, 'PT')).toEqual({ rue: 'Rua 25 de Abril 1974', codePostal: '4000-123', ville: 'Porto' })
    expect(decomposerAdresse({ adresse: 'Rua 25 de Abril 1974', ville: 'Porto' }, 'PT')).toEqual({ rue: 'Rua 25 de Abril 1974', codePostal: '', ville: 'Porto' })
    // La ville recopiée dans le champ de la rue n'est pas une rue.
    expect(decomposerAdresse({ adresse: 'Marseille', ville: 'marseille' }, 'FR')).toEqual({ rue: '', codePostal: '', ville: 'marseille' })
  })

  it('noms de lieux comparables : accents, casse, tirets, « St » / « Ste »', () => {
    expect(normaliserLieu('Saint-Étienne')).toBe(normaliserLieu('st etienne'))
    expect(normaliserLieu('Sainte-Maxime')).toBe(normaliserLieu('Ste Maxime'))
    expect(normaliserLieu('Águeda')).toBe('agueda')
  })

  it('adresse complète : rue, code postal, ville, sans morceaux vides', () => {
    expect(adresseComplete({ adresse: ' 1 rue des Lilas ', codePostal: '13008', ville: 'Marseille' })).toBe('1 rue des Lilas 13008 Marseille')
    expect(adresseComplete({ adresse: '', codePostal: null, ville: 'Marseille' })).toBe('Marseille')
    expect(adresseComplete({})).toBe('')
  })

  it('lien OpenStreetMap centré sur la position', () => {
    expect(lienCarte(43.25, 5.38)).toBe('https://www.openstreetmap.org/?mlat=43.25&mlon=5.38#map=18/43.25/5.38')
  })
})
