// tests/lib/btp-geocodage.test.ts — position GPS d'une adresse de chantier (lib/btp/geocodage.ts, 16/11/2026).
// « Précise » = le numéro ou la rue saisis, dans la commune saisie : sinon le pointage automatique se déclencherait au
// mauvais endroit. Cas tirés de réponses réelles de la BAN relevées par la relecture (communes homonymes, lieux-dits,
// lotissements). Réponses simulées de la Base Adresse Nationale et de Nominatim ; adresses fictives.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { adresseComplete, decomposerAdresse, geocoderAdresse, lienCarte, normaliserLieu, numeroEtVoieSaisis, rueSansComplements } from '@/lib/btp/geocodage'

type Reponse = { statut?: number; corps: unknown }
let reponses: Record<'ban' | 'osm', Reponse | Error>
let appels: string[]
/** Réponse de la BAN propre à une recherche (texte `q`) ; à défaut, `reponses.ban`. */
let banSelonRecherche: Record<string, Reponse | Error>
const rechercheBan = (url: string) => new URL(url).searchParams.get('q') ?? ''

interface Lieu { postcode?: string; city?: string; lat?: number; lng?: number; housenumber?: string; street?: string }
/** Réponse BAN simulée ; par défaut le 1 rue des Lilas (la vraie BAN rend la voie, et le numéro d'un « housenumber »). */
const ban = (
  type: string,
  score: number,
  { postcode = '13008', city = 'Marseille', lat = 43.25, lng = 5.38, housenumber = type === 'housenumber' ? '1' : undefined, street = 'Rue des Lilas' }: Lieu = {},
): Reponse => ({
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
    reponses.ban = ban('housenumber', 0.95, { postcode: '13310', city: 'Saint-Martin-de-Crau', housenumber: '3', street: 'Chemin du Mas' })
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
    reponses.ban = ban('housenumber', 0.6, { postcode: '13006', housenumber: '3', street: 'Avenue du Prado' })
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

describe('geocoderAdresse — voie saisie retrouvée dans la réponse de la BAN (France, 25/11/2026)', () => {
  // Réponses relevées sur la BAN réelle le 25/11/2026 (score, numéro et voie rendus pour la saisie indiquée).
  const saisie = (adresse: string, codePostal = '13001', ville = 'Marseille') => ({ adresse, codePostal, ville })

  it('autre voie au nom ressemblant, même numéro : imprécis (avant : précis, donc pointage au mauvais endroit)', async () => {
    reponses.ban = ban('housenumber', 0.643, { housenumber: '3', street: 'Allée des buis' })
    expect((await geocoderAdresse(saisie('3 Allée des Acacias', '13008'), 'FR'))?.precise).toBe(false)
    reponses.ban = ban('housenumber', 0.684, { postcode: '13006', housenumber: '4', street: 'Cours julien' })
    expect((await geocoderAdresse(saisie('4 Cours', '13006'), 'FR'))?.precise).toBe(false)
    reponses.ban = ban('housenumber', 0.628, { postcode: '13390', city: 'Auriol', housenumber: '2', street: 'Rue du Clos' })
    expect((await geocoderAdresse(saisie('2 Le Clos', '13390', 'Auriol'), 'FR'))?.precise).toBe(false)
  })

  it('adresse à compléments : la voie du morceau numéroté est aussi exigée à la première recherche', async () => {
    // « Résidence Le Parc, 1 place de l'Église » à Chemillé-en-Anjou : la BAN rend la place de l'Église de Cossé (0,61).
    reponses.ban = ban('housenumber', 0.608, { postcode: '49120', city: 'Chemillé-en-Anjou', housenumber: '1', street: 'Place de l\'Église de Cossé' })
    expect((await geocoderAdresse(saisie('Résidence Le Parc, 1 place de l\'Église', '49120', 'Chemillé-en-Anjou'), 'FR'))?.precise).toBe(false)
    expect(appels.filter(a => a.includes('api-adresse.data.gouv.fr'))).toHaveLength(2)
  })

  it('même voie écrite autrement : précis (abréviations, titres, « St », articles, « Voie » de la BAN, ville recopiée)', async () => {
    const cas: Array<[string, string, string]> = [
      ['12 rue St Ferréol', '12', 'Rue saint ferreol'],
      ['58 La Canebière', '58', 'Voie la canebiere'],
      ['3 av. du Prado', '3', 'Avenue du prado'],
      ['5 av du Gal Leclerc', '5', 'Avenue du general leclerc'],
      ['10 rue Republique', '10', 'Rue de la republique'],
      ['10 rue de la République Marseille', '10', 'Rue de la republique'],
      ['4 bis bd Longchamp', '4bis', 'Boulevard longchamp'],
    ]
    for (const [adresse, housenumber, street] of cas) {
      reponses.ban = ban('housenumber', 0.7, { postcode: '13001', housenumber, street })
      expect((await geocoderAdresse(saisie(adresse), 'FR'))?.precise, adresse).toBe(true)
    }
  })

  it('voie qui porte le nom de la commune : pas confondue avec la ville recopiée (« route d’Aubagne » à Aubagne)', async () => {
    reponses.ban = ban('housenumber', 0.9, { postcode: '13400', city: 'Aubagne', housenumber: '8', street: 'Route d\'Aubagne' })
    expect((await geocoderAdresse(saisie('8 route d\'Aubagne', '13400', 'Aubagne'), 'FR'))?.precise).toBe(true)
  })

  it('numéro voisin dans la bonne voie : imprécis', async () => {
    reponses.ban = ban('housenumber', 0.9, { housenumber: '12', street: 'Rue de la republique' })
    expect((await geocoderAdresse(saisie('10 rue de la République'), 'FR'))?.precise).toBe(false)
  })

  it('numéro absent de la BAN : la rue entière reste admise si c’est la voie saisie (comportement antérieur), pas une autre', async () => {
    reponses.ban = ban('street', 0.8, { postcode: '13390', city: 'Auriol', street: 'Chemin de la Source' })
    expect((await geocoderAdresse(saisie('20 chemin de la Source', '13390', 'Auriol'), 'FR'))?.precise).toBe(true)
    reponses.ban = ban('street', 0.85, { postcode: '13390', city: 'Auriol', street: 'Chemin de la Sourde' })
    expect((await geocoderAdresse(saisie('20 chemin de la Source', '13390', 'Auriol'), 'FR'))?.precise).toBe(false)
  })

  it('limites assumées : type de voie oublié ou faux → imprécis (avant : précis par tolérance de la BAN)', async () => {
    reponses.ban = ban('housenumber', 0.66, { housenumber: '10', street: 'Rue de la republique' })
    expect((await geocoderAdresse(saisie('10 République'), 'FR'))?.precise).toBe(false)
    reponses.ban = ban('housenumber', 0.611, { postcode: '13400', city: 'Aubagne', housenumber: '15', street: 'Boulevard Jean Jaures' })
    expect((await geocoderAdresse(saisie('15 av Jean Jaurès', '13400', 'Aubagne'), 'FR'))?.precise).toBe(false)
    reponses.ban = ban('housenumber', 0.7, { housenumber: '10', street: 'Avenue Victor Hugo' })
    expect((await geocoderAdresse(saisie('10 Victor Hugo'), 'FR'))?.precise).toBe(false)
    // Nom double officiel (Marseille) : la BAN rend « Rue de la paix marcel paul » ; pas de règle sûre (« rue du Clos » ≠
    // « rue Clos Marie-Claire » à Auriol, deux voies), donc imprécis.
    reponses.ban = ban('housenumber', 0.648, { housenumber: '4', street: 'Rue de la paix marcel paul' })
    expect((await geocoderAdresse(saisie('4 rue de la Paix'), 'FR'))?.precise).toBe(false)
  })

  it('réponse sans voie : imprécis', async () => {
    reponses.ban = ban('housenumber', 0.95, { street: '' })
    expect((await geocoderAdresse(LILAS, 'FR'))?.precise).toBe(false)
    reponses.ban = { corps: { features: [{ geometry: { coordinates: [5.38, 43.25] }, properties: { type: 'housenumber', score: 0.95, postcode: '13008', city: 'Marseille', housenumber: '1' } }] } }
    expect((await geocoderAdresse(LILAS, 'FR'))?.precise).toBe(false)
  })

  it('saisie sans numéro de rue : réponse non comparée à la saisie (comportement antérieur ; le cas « Étage 2 » est un défaut connu, à inverser s’il est corrigé)', async () => {
    reponses.ban = ban('street', 0.85, { street: 'Rue des Lilas' })
    expect((await geocoderAdresse({ ...LILAS, adresse: 'rue des Lilas' }, 'FR'))?.precise).toBe(true)
    // « Étage 2, rue Paradis » : pas de morceau « numéro + voie », la BAN reste seule juge (défaut antérieur connu).
    reponses.ban = ban('housenumber', 0.734, { postcode: '13001', housenumber: '2', street: 'Rue paradis' })
    expect((await geocoderAdresse(saisie('Étage 2, rue Paradis'), 'FR'))?.precise).toBe(true)
  })

  it('secours Nominatim : la voie saisie est aussi exigée (« 4 Cours » : OSM rendait le 4 Cours Gouffé)', async () => {
    reponses.ban = ban('housenumber', 0.684, { postcode: '13006', housenumber: '4', street: 'Cours julien' })
    reponses.osm = osm(30, { house_number: '4', road: 'Cours Gouffé', postcode: '13006', city: 'Marseille' })
    expect((await geocoderAdresse(saisie('4 Cours', '13006'), 'FR'))?.precise).toBe(false)
    expect(appels[1]).toContain('nominatim.openstreetmap.org')
    // BAN sur une autre voie, OSM sur la bonne (numéro compris) : la position d'OSM l'emporte.
    reponses.ban = ban('housenumber', 0.643, { housenumber: '3', street: 'Allée des buis' })
    reponses.osm = osm(30, { house_number: '3', road: 'Allée des Acacias', postcode: '13008', city: 'Marseille' })
    expect(await geocoderAdresse(saisie('3 Allée des Acacias', '13008'), 'FR')).toEqual({ latitude: 43.26, longitude: 5.39, precise: true })
    reponses.osm = osm(30, { house_number: '5', road: 'Allée des Acacias', postcode: '13008', city: 'Marseille' })
    expect((await geocoderAdresse(saisie('3 Allée des Acacias', '13008'), 'FR'))?.precise).toBe(false)
  })

  it('saisies correctes courantes (relecture du 25/11/2026) : complément collé, lieu-dit, hameau, titre ou prénom omis', async () => {
    const cas: Array<[string, string, string, Lieu?]> = [
      ['10 rue de la République Bât B', '10', 'Rue de la republique'],
      ['10 rue de la République 2e étage', '10', 'Rue de la republique'],
      ['10 rue de la République appt 3', '10', 'Rue de la republique'],
      ['10 rue de la République (Bât B)', '10', 'Rue de la republique'],
      ['10 rue de la République Cedex', '10', 'Rue de la republique'],
      ['10 rue de la République France', '10', 'Rue de la republique'],
      ['2 Les Granges', '2', 'Lieu-dit les Granges'],
      ['2 lieu-dit Les Granges', '2', 'Lieu Dit les Granges'],
      ['3 Bénazeth', '3', 'Hameau de Bénazeth'],
      ['5 avenue Foch', '5', 'Avenue du maréchal Foch'],
      ['100 corniche Kennedy', '100', 'Corniche président john f kennedy'],
      ['12 av Hugo', '12', 'Avenue  Victor Hugo'],
      ['12 Grande Rue', '12', 'Grand\'Rue'],
      ['120 départementale 940', '120', 'Route Départementale 940'],
      ['8 avenue de France', '8', 'Avenue de France'],
      ['8 avenue du 1er Mai', '8', 'Avenue du 1er Mai'],
      ['8 Voie Romaine', '8', 'Voie Romaine'],
      ['10 rue de la République Résidence Le Parc', '10', 'Rue de la republique'],
      ['10 rue de la République Lot 5', '10', 'Rue de la republique'],
      ['10 rue de la République RDC', '10', 'Rue de la republique'],
      ['10 rue de la République chez M. Martin', '10', 'Rue de la republique'],
      ['8 rue du Lot', '8', 'Rue du Lot'],
      ['8 rue de la Vieille Porte', '8', 'Rue de la Vieille Porte'],
    ]
    for (const [adresse, housenumber, street] of cas) {
      reponses.ban = ban('housenumber', 0.65, { postcode: '13001', housenumber, street })
      expect((await geocoderAdresse(saisie(adresse), 'FR'))?.precise, adresse).toBe(true)
    }
  })

  it('seconde recherche (résidence devant) : le qualificatif en plus est refusé aussi (« 5 rue du Pont » → Petit Pont)', async () => {
    reponses.ban = ban('housenumber', 0.5, { postcode: '08200', city: 'Sedan', housenumber: '5', street: 'Rue du Petit Pont' })
    banSelonRecherche['5 rue du Pont 08200 Sedan'] = ban('housenumber', 0.707, { postcode: '08200', city: 'Sedan', housenumber: '5', street: 'Rue du Petit Pont' })
    expect((await geocoderAdresse(saisie('Résidence Les Pins, 5 rue du Pont', '08200', 'Sedan'), 'FR'))?.precise).toBe(false)
    expect(appels.filter(a => a.includes('api-adresse.data.gouv.fr'))).toHaveLength(2)
  })

  it('ville saisie avec l’arrondissement, recopiée en fin de rue : tolérée (« Marseille 6e », ville rendue « Marseille »)', async () => {
    reponses.ban = ban('housenumber', 0.656, { postcode: '13006', housenumber: '10', street: 'Boulevard baille' })
    expect((await geocoderAdresse(saisie('10 boulevard Baille Marseille', '13006', 'Marseille 6e'), 'FR'))?.precise).toBe(true)
  })

  it('voies proches mais différentes : refusées (autre fin de nom, mot en plus à la fin, lieu-dit homonyme)', async () => {
    const cas: Array<[string, string, string]> = [
      ['3 rue du Clos', '3', 'Rue Clos Marie-Claire'],
      ['3 Allée des Acacias', '3', 'Allée des Acacias Bleus'],
      ['5 Le Bourg', '5', 'Rue Boutron'],
      ['8 Voie Romaine', '8', 'Lieu-dit la Romaine'],
      ['8 avenue de Paris', '8', 'Avenue de la Porte d\'Italie'],
      // Qualificatif en plus : une autre voie (deux voies du 08200 ; relevé BAN du 25/11/2026).
      ['5 rue du Pont', '5', 'Rue du Petit Pont'],
      ['5 rue Saint-Jean', '5', 'Rue du petit saint jean'],
      ['5 Grande Rue', '5', 'Grande Rue Neuve'],
      // Complément coupé seulement s'il est suivi d'un mot : « rue de la Vieille Porte » n'est pas « rue Vieille ».
      ['8 rue de la Vieille Porte', '8', 'Rue Vieille'],
    ]
    for (const [adresse, housenumber, street] of cas) {
      reponses.ban = ban('housenumber', 0.7, { postcode: '13001', housenumber, street })
      expect((await geocoderAdresse(saisie(adresse), 'FR'))?.precise, adresse).toBe(false)
    }
  })

  it('Portugal inchangé : Nominatim seul, sans comparaison de la voie', async () => {
    reponses.osm = osm(30, { road: 'Rua de Santa Catarina', postcode: '4000-447', city: 'Porto' }, '41.15', '-8.61')
    expect((await geocoderAdresse({ adresse: 'Rua Santa Catarina 100', codePostal: '4000-447', ville: 'Porto' }, 'PT'))?.precise).toBe(true)
    expect(appels).toHaveLength(1)
  })
})

describe('numeroEtVoieSaisis', () => {
  it('rue en un morceau « numéro + nom », ou morceau numéroté d’une adresse à compléments', () => {
    expect(numeroEtVoieSaisis('3 Allée des Acacias')).toEqual({ numero: '3', voie: 'Allée des Acacias', texte: '3 Allée des Acacias' })
    expect(numeroEtVoieSaisis('  4 bis   bd Longchamp ')).toEqual({ numero: '4 bis', voie: 'bd Longchamp', texte: '4 bis bd Longchamp' })
    expect(numeroEtVoieSaisis('Résidence Le Parc, 10 rue de la République')?.texte).toBe('10 rue de la République')
  })

  it('pas de numéro de rue : null', () => {
    expect(numeroEtVoieSaisis('rue des Lilas')).toBeNull()
    expect(numeroEtVoieSaisis('Bât 3, avenue du Prado')).toBeNull()
    expect(numeroEtVoieSaisis('2 étage')).toBeNull()
    expect(numeroEtVoieSaisis('3 bis')).toBeNull()
    expect(numeroEtVoieSaisis('')).toBeNull()
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
