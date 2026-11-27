// tests/lib/btp-geocodage.test.ts — position GPS d'une adresse de chantier (lib/btp/geocodage.ts, 16/11/2026).
// « Précise » = le numéro ou la rue saisis, dans la commune saisie : sinon le pointage automatique se déclencherait au
// mauvais endroit. Cas tirés de réponses réelles de la BAN relevées par la relecture (communes homonymes, lieux-dits,
// lotissements). Réponses simulées de la Base Adresse Nationale et de Nominatim ; adresses fictives.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { adresseComplete, decomposerAdresse, geocoderAdresse, lienCarte, normaliserLieu, numeroEtVoieSaisis, rueSansComplements, type AdresseChantier } from '@/lib/btp/geocodage'

type Reponse = { statut?: number; corps: unknown }
let reponses: Record<'ban' | 'osm', Reponse | Error>
let appels: string[]
/** Réponse de la BAN propre à une recherche (texte `q`) ; à défaut, `reponses.ban`. */
let banSelonRecherche: Record<string, Reponse | Error>
const rechercheBan = (url: string) => new URL(url).searchParams.get('q') ?? ''

interface Lieu { postcode?: string; city?: string; citycode?: string; oldcity?: string; lat?: number; lng?: number; housenumber?: string; street?: string }
/** Réponse BAN simulée ; par défaut le 1 rue des Lilas (la vraie BAN rend la voie, et le numéro d'un « housenumber »). */
const ban = (
  type: string,
  score: number,
  { postcode = '13008', city = 'Marseille', citycode, oldcity, lat = 43.25, lng = 5.38, housenumber = type === 'housenumber' ? '1' : undefined, street = 'Rue des Lilas' }: Lieu = {},
): Reponse => ({
  corps: { features: [{ geometry: { coordinates: [lng, lat] }, properties: { type, score, postcode, city, citycode, oldcity, housenumber, street } }] },
})
const osm = (placeRank: number, address: Record<string, string>, lat = '43.26', lon = '5.39'): Reponse => ({
  corps: [{ lat, lon, place_rank: placeRank, address }],
})
/** Une voie rendue par la BAN à une recherche de voies (type=street) ; `id` : « code INSEE_code de la voie ». */
const voieBan = (name: string, postcode: string, city: string, oldcity?: string, id?: string) =>
  ({ geometry: { coordinates: [5.38, 43.25] }, properties: { type: 'street', score: 0.69, name, street: name, postcode, city, oldcity, id } })
/** Voies d'une commune rendues par la BAN à une recherche de voies (type=street), clé = nom cherché (seuleVoieCompatible). */
const voies = (noms: string[], { postcode = '13001', city = 'Marseille' }: Lieu = {}): Reponse => ({
  corps: { features: noms.map(name => voieBan(name, postcode, city)) },
})

const LILAS = { adresse: '1 rue des Lilas', codePostal: '13008', ville: 'Marseille' }

beforeEach(() => {
  appels = []
  reponses = { ban: { corps: { features: [] } }, osm: { corps: [] } }
  banSelonRecherche = {}
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const adresse = String(url)
    appels.push(adresse)
    // Communes d'un nom (ville saisie sans code postal) : par défaut une seule commune de ce nom.
    const communeSeule = { corps: { features: [{ properties: { type: 'municipality', name: rechercheBan(adresse) } }] } }
    const parDefaut = adresse.includes('type=municipality') ? communeSeule : reponses.ban
    const reponse = adresse.includes('api-adresse.data.gouv.fr')
      ? (banSelonRecherche[rechercheBan(adresse)] ?? parDefaut)
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
    // Virgule après le numéro (26/11/2026) : la voie est aussi exigée (avant : réponse non comparée, donc précise).
    reponses.ban = ban('housenumber', 0.643, { housenumber: '3', street: 'Allée des buis' })
    expect((await geocoderAdresse(saisie('3, Allée des Acacias', '13008'), 'FR'))?.precise).toBe(false)
  })

  it('adresse à compléments : la voie du morceau numéroté est aussi exigée à la première recherche', async () => {
    // « Résidence Le Parc, 1 place de l'Église » à Chemillé-en-Anjou : la BAN rend la place de l'Église de Cossé (0,61) ;
    // la commune a trois places de l'Église (relevé du 26/11/2026) : le nom plus long n'est pas admis.
    reponses.ban = ban('housenumber', 0.608, { postcode: '49120', city: 'Chemillé-en-Anjou', housenumber: '1', street: 'Place de l\'Église de Cossé' })
    banSelonRecherche.eglise = voies(['Place de l\'Église de la Jumellière', 'Place de l\'Église de Cossé', 'Place de l\'Eglise de Sainte-Christine'], { postcode: '49120', city: 'Chemillé-en-Anjou' })
    expect((await geocoderAdresse(saisie('Résidence Le Parc, 1 place de l\'Église', '49120', 'Chemillé-en-Anjou'), 'FR'))?.precise).toBe(false)
    expect(appels.filter(a => a.includes('api-adresse.data.gouv.fr') && !a.includes('type=street'))).toHaveLength(2)
    // Les voies de la commune ne sont demandées qu'une fois, pour la première et la seconde réponse.
    expect(appels.filter(a => a.includes('type=street')).map(rechercheBan)).toEqual(['eglise'])
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
    reponses.ban = ban('housenumber', 0.9, { postcode: '13001', housenumber: '12', street: 'Rue de la republique' })
    expect((await geocoderAdresse(saisie('10 rue de la République'), 'FR'))?.precise).toBe(false)
    // Témoin : le bon numéro dans cette voie est précis (le refus ci-dessus tient bien au numéro).
    reponses.ban = ban('housenumber', 0.9, { postcode: '13001', housenumber: '10', street: 'Rue de la republique' })
    expect((await geocoderAdresse(saisie('10 rue de la République'), 'FR'))?.precise).toBe(true)
  })

  it('numéro absent de la BAN : le centre de la rue n’est jamais précis (avant : précis, même pour une avenue de plusieurs kilomètres)', async () => {
    // « 12 avenue du Prado » 13008 : la BAN ne connaît pas ce 12 (il est dans le 13006) et rend l'avenue (0,815, 26/11/2026).
    reponses.ban = ban('street', 0.815, { street: 'Avenue du prado' })
    for (const adresse of ['12 avenue du Prado', '12, avenue du Prado', 'avenue du Prado, 12']) {
      expect((await geocoderAdresse(saisie(adresse, '13008'), 'FR'))?.precise, adresse).toBe(false)
    }
    // Témoin : la même réponse reste précise pour la rue saisie sans numéro (règle antérieure inchangée).
    expect((await geocoderAdresse(saisie('avenue du Prado', '13008'), 'FR'))?.precise).toBe(true)
    // « 8 route départementale » : la BAN rend la Route Départementale 8 (0,837, Les Pennes-Mirabeau), pas le n° 8. Le 8 écrit
    // devant la voie est un numéro de rue ; écrit après, il est le numéro de la route (témoin).
    reponses.ban = ban('street', 0.837, { postcode: '13170', city: 'Les Pennes-Mirabeau', street: 'Route Départementale 8' })
    expect((await geocoderAdresse(saisie('8 route départementale', '13170', 'Les Pennes-Mirabeau'), 'FR'))?.precise).toBe(false)
    expect((await geocoderAdresse(saisie('Route Départementale 8', '13170', 'Les Pennes-Mirabeau'), 'FR'))?.precise).toBe(true)
    reponses.ban = ban('street', 0.8, { postcode: '13390', city: 'Auriol', street: 'Chemin de la Source' })
    expect((await geocoderAdresse(saisie('20 chemin de la Source', '13390', 'Auriol'), 'FR'))?.precise).toBe(false)
    // Nominatim : la rue sans le numéro saisi non plus.
    reponses.osm = osm(26, { road: 'Chemin de la Source', postcode: '13390', town: 'Auriol' })
    expect((await geocoderAdresse(saisie('20 chemin de la Source', '13390', 'Auriol'), 'FR'))?.precise).toBe(false)
  })

  /** Voie voisine : nom du cas, réponse de la BAN, voies de la commune (clé = nom cherché), saisie, résultat attendu. */
  type CasVoisin = [string, Reponse, string, Reponse | Error, AdresseChantier, boolean]
  const jugerVoisins = async (cas: CasVoisin[]) => {
    for (const [nom, reponse, cle, liste, entree, attendu] of cas) {
      reponses.ban = reponse
      banSelonRecherche[cle] = liste
      expect((await geocoderAdresse(entree, 'FR'))?.precise, nom).toBe(attendu)
    }
  }
  const REPUBLIQUE = ban('housenumber', 0.66, { postcode: '13001', housenumber: '10', street: 'Rue de la republique' })
  const PAIX = ban('housenumber', 0.648, { postcode: '13001', housenumber: '4', street: 'Rue de la paix marcel paul' })
  const AURIOL = { postcode: '13390', city: 'Auriol' }
  const CARRY = { postcode: '13620', city: 'Carry-le-Rouet' }

  it('type de voie oublié ou différent, nom officiel plus long : précis si la commune n’a qu’une voie de ce nom (26/11/2026)', async () => {
    await jugerVoisins([
      ['type oublié', REPUBLIQUE, 'republique', voies(['Rue de la republique']), saisie('10 République'), true],
      // Les voies sont cherchées par le dernier mot du nom (« jaures ») : quatrième relecture du 26/11/2026.
      ['autre type', ban('housenumber', 0.611, { postcode: '13400', city: 'Aubagne', housenumber: '15', street: 'Boulevard Jean Jaures' }),
        'jaures', voies(['Boulevard Jean Jaures'], { postcode: '13400', city: 'Aubagne' }), saisie('15 av Jean Jaurès', '13400', 'Aubagne'), true],
      // Nom double officiel (Marseille) : la BAN rend « Rue de la paix marcel paul », seule voie de ce nom dans le 13001.
      ['nom plus long', PAIX, 'paix', voies(['Rue de la paix marcel paul']), saisie('4 rue de la Paix'), true],
      // Sans code postal ni code INSEE dans la réponse : la ville est ajoutée à la recherche des voies, et vérifiée.
      ['sans code postal', PAIX, 'paix Marseille', voies(['Rue de la paix marcel paul']), { adresse: '4 rue de la Paix', ville: 'Marseille' }, true],
      ['sans code postal, autre ville', PAIX, 'paix Marseille', voies(['Rue de la paix marcel paul'], { city: 'Aubagne' }), { adresse: '4 rue de la Paix', ville: 'Marseille' }, false],
      // Sans code postal, avec le code INSEE que la vraie BAN rend toujours (celui d'un arrondissement à Marseille) : les voies
      // de toute la commune (13055).
      ['sans code postal, code INSEE', ban('housenumber', 0.648, { postcode: '13001', citycode: '13201', housenumber: '4', street: 'Rue de la paix marcel paul' }),
        'paix', voies(['Rue de la paix marcel paul']), { adresse: '4 rue de la Paix', ville: 'Marseille' }, true],
      // Témoin du refus de « 10 Alésia » plus bas : sans la villa d'Alésia, la rue d'Alésia serait admise.
      ['10 Alésia, seule voie', ban('housenumber', 0.703, { postcode: '75014', city: 'Paris', housenumber: '10', street: 'Rue d\'Alésia' }),
        'alesia', voies(['Rue d\'Alésia'], { postcode: '75014', city: 'Paris' }), saisie('10 Alésia', '75014', 'Paris'), true],
      // « Villa » et « Allées » sont des types de voie (Paris, Bordeaux).
      ['type oublié, villa', ban('housenumber', 0.7, { postcode: '75014', city: 'Paris', housenumber: '7', street: 'Villa Seurat' }),
        'seurat', voies(['Villa Seurat'], { postcode: '75014', city: 'Paris' }), saisie('7 Seurat', '75014', 'Paris'), true],
      ['type oublié, allées', ban('housenumber', 0.7, { postcode: '33000', city: 'Bordeaux', housenumber: '3', street: 'Allées de Tourny' }),
        'tourny', voies(['Allées de Tourny'], { postcode: '33000', city: 'Bordeaux' }), saisie('3 Tourny', '33000', 'Bordeaux'), true],
      // Témoin des refus « Mimosas » plus bas : seul, le nom nu numéroté reste une voie au type oublié.
      ['type oublié, sans autre voie', ban('housenumber', 0.706, { ...CARRY, housenumber: '12', street: 'Allée des Mimosas' }),
        'mimosas', voies(['Allée des Mimosas'], CARRY), saisie('12 Mimosas', '13620', 'Carry-le-Rouet'), true],
      // « Allée » et « allées » : un même type.
      ['allée pour allées', ban('housenumber', 0.7, { postcode: '33000', city: 'Bordeaux', housenumber: '3', street: 'Allées de Tourny' }),
        'tourny', voies(['Allées de Tourny'], { postcode: '33000', city: 'Bordeaux' }), saisie('3 allée de Tourny', '33000', 'Bordeaux'), true],
      // Ville saisie vérifiée : les voies sont cherchées dans la commune de la réponse (code INSEE de la BAN).
      ['commune de la réponse', ban('housenumber', 0.66, { postcode: '13001', citycode: '13201', housenumber: '10', street: 'Rue de la republique' }),
        'republique', voies(['Rue de la republique']), saisie('10 République'), true],
    ])
    const recherchesDeVoies = appels.filter(a => a.includes('type=street'))
    expect(recherchesDeVoies.map(rechercheBan)).toEqual(['republique', 'jaures', 'paix', 'paix Marseille', 'paix Marseille', 'paix', 'alesia', 'seurat', 'tourny', 'mimosas', 'tourny', 'republique'])
    expect(recherchesDeVoies[0]).toContain('&postcode=13001')
    expect(recherchesDeVoies[0]).not.toContain('citycode=')
    expect(recherchesDeVoies[3]).not.toContain('postcode=')
    expect(recherchesDeVoies[5]).toContain('&limit=50&citycode=13055')
    expect(recherchesDeVoies[5]).not.toContain('postcode=')
    expect(recherchesDeVoies[11]).toContain('&limit=50&postcode=13001&citycode=13055')
  })

  it('voie voisine : homonymes de toute la commune (Paris sans code postal) et voie plus courte tenue pour la même (quatrième relecture)', async () => {
    // « 10 Saint-Martin », Paris, sans code postal : la BAN rend le 10 rue Saint-Martin (4e, code 75104, 0,744) ; Paris a neuf
    // voies Saint-Martin (le 10 boulevard Saint-Martin à 1 366 m). Avant : vérifié dans le seul 4e, donc précis.
    const saintMartin = ban('housenumber', 0.744, { postcode: '75004', city: 'Paris', citycode: '75104', housenumber: '10', street: 'Rue Saint-Martin' })
    const paris = { postcode: '75004', city: 'Paris' }
    // « 4 rue du Général Leclerc », 75014 : la BAN rend le 4 avenue du Général Leclerc (0,746) ; le 14e a aussi la rue Leclerc
    // (un n° 4 à 325 m), que la saisie désigne aussi (titre omis).
    const leclerc = ban('housenumber', 0.746, { postcode: '75014', city: 'Paris', citycode: '75114', housenumber: '4', street: 'Avenue du Général Leclerc' })
    const quatorzieme = { postcode: '75014', city: 'Paris' }
    await jugerVoisins([
      ['Paris sans code postal', saintMartin, 'martin', voies(['Rue Saint-Martin', 'Boulevard Saint-Martin', 'Porte Saint-Martin'], paris), { adresse: '10 Saint-Martin', ville: 'Paris' }, false],
      ['Paris sans code postal, seule voie (témoin)', saintMartin, 'martin', voies(['Rue Saint-Martin'], paris), { adresse: '10 Saint-Martin', ville: 'Paris' }, true],
      ['voie plus courte', leclerc, 'leclerc', voies(['Avenue du Général Leclerc', 'Rue Leclerc'], quatorzieme), saisie('4 rue du Général Leclerc', '75014', 'Paris'), false],
      ['voie plus courte absente (témoin)', leclerc, 'leclerc', voies(['Avenue du Général Leclerc'], quatorzieme), saisie('4 rue du Général Leclerc', '75014', 'Paris'), true],
    ])
    const recherchesDeVoies = appels.filter(a => a.includes('type=street'))
    expect(recherchesDeVoies[0]).toContain('&limit=50&citycode=75056')
    expect(recherchesDeVoies[2]).toContain('&limit=50&postcode=75014&citycode=75056')
  })

  it('voie voisine refusée quand la commune a une autre voie qui répond à la saisie, ou si la vérification échoue', async () => {
    await jugerVoisins([
      ['deux voies Victor Hugo', ban('housenumber', 0.7, { postcode: '13001', housenumber: '10', street: 'Avenue Victor Hugo' }),
        'hugo', voies(['Avenue Victor Hugo', 'Place Victor Hugo']), saisie('10 Victor Hugo'), false],
      // « 2 Le Clos » à Auriol : la BAN rend le 2 rue du Clos ; la commune a aussi un chemin du Clos (relevé du 26/11/2026).
      ['2 Le Clos', ban('housenumber', 0.628, { ...AURIOL, housenumber: '2', street: 'Rue du Clos' }),
        'clos', voies(['Clos Cigalon', 'Chemin du Clos', 'Rue du Clos', 'Rue Clos Marie-Claire'], AURIOL), saisie('2 Le Clos', '13390', 'Auriol'), false],
      // « 3 rue du Clos » rendu dans la rue Clos Marie-Claire : rue du Clos et rue Clos des Trois Rois répondent aussi.
      ['3 rue du Clos', ban('housenumber', 0.7, { ...AURIOL, housenumber: '3', street: 'Rue Clos Marie-Claire' }),
        'clos', voies(['Rue du Clos', 'Rue Clos des Trois Rois', 'Rue Clos Marie-Claire'], AURIOL), saisie('3 rue du Clos', '13390', 'Auriol'), false],
      // Autre voie du même nom, quel que soit son type ou ses mots en plus (relecture du 26/11/2026, BAN réelle) : villa
      // d'Alésia (un 10 à 824 m), allées de Tourny (un 10 à 315 m), clos et résidence des Vignes, rue du Moulin Neuf.
      ['10 Alésia', ban('housenumber', 0.703, { postcode: '75014', city: 'Paris', housenumber: '10', street: 'Rue d\'Alésia' }),
        'alesia', voies(['Rue d\'Alésia', 'Villa d\'Alésia'], { postcode: '75014', city: 'Paris' }), saisie('10 Alésia', '75014', 'Paris'), false],
      ['10 Tourny', ban('housenumber', 0.712, { postcode: '33000', city: 'Bordeaux', housenumber: '10', street: 'Place Tourny' }),
        'tourny', voies(['Allées de Tourny', 'Place Tourny'], { postcode: '33000', city: 'Bordeaux' }), saisie('10 Tourny', '33000', 'Bordeaux'), false],
      ['4 rue des Vignes', ban('housenumber', 0.7, { postcode: '83550', city: 'Vidauban', housenumber: '4', street: 'Impasse des Vignes' }),
        'vignes', voies(['Clos des Vignes', 'Résidence les Vignes Blanches', 'Impasse des Vignes'], { postcode: '83550', city: 'Vidauban' }),
        saisie('4 rue des Vignes', '83550', 'Vidauban'), false],
      ['5 rue du Moulin', ban('housenumber', 0.7, { postcode: '13001', housenumber: '5', street: 'Rue du Moulin à Vent' }),
        'moulin', voies(['Rue du Moulin à Vent', 'Rue du Moulin Neuf']), saisie('5 rue du Moulin'), false],
      ['3 Gare', ban('housenumber', 0.7, { postcode: '13001', housenumber: '3', street: 'Rue de la Gare' }),
        'gare', voies(['Rue de la Gare', 'Petite Rue de la Gare']), saisie('3 Gare'), false],
      // Voie écrite dans un autre morceau : le nom numéroté n'est qu'un complément (contre-relecture du 26/11/2026, BAN réelle
      // à Carry-le-Rouet : le 12 allée des Mimosas est à 1,2 km du chemin saisi).
      ['villa numérotée, voie à côté', ban('housenumber', 0.652, { ...CARRY, housenumber: '12', street: 'Allée des Mimosas' }),
        'mimosas', voies(['Allée des Mimosas'], CARRY), saisie('Villa Les Mimosas n° 12, chemin des Vignes', '13620', 'Carry-le-Rouet'), false],
      ['nom numéroté, voie à côté', ban('housenumber', 0.706, { ...CARRY, housenumber: '12', street: 'Allée des Mimosas' }),
        'mimosas', voies(['Allée des Mimosas'], CARRY), saisie('12 Mimosas, chemin du Rivage', '13620', 'Carry-le-Rouet'), false],
      // Nom de lieu numéroté (article, hameau, lieu-dit) : pas une voie au type oublié ; type de voie de lotissement (square,
      // impasse) : jamais confondu avec un autre (troisième relecture du 26/11/2026, BAN réelle à Carry-le-Rouet : le 12
      // allée des Mimosas, seule voie de ce nom, rendu à 0,61-0,67).
      ...['12 Les Mimosas', '12 Hameau des Mimosas', '12 Le Hameau des Mimosas', '12 lieu-dit Les Mimosas', '12 Square des Mimosas', '12 impasse des Mimosas']
        .map((adresse): CasVoisin => [adresse, ban('housenumber', 0.639, { ...CARRY, housenumber: '12', street: 'Allée des Mimosas' }),
          'mimosas', voies(['Allée des Mimosas'], CARRY), saisie(adresse, '13620', 'Carry-le-Rouet'), false]),
      // Une villa ou une cité n'est jamais une voie d'un autre type.
      ['autre type, villa', ban('housenumber', 0.7, { postcode: '75014', city: 'Paris', housenumber: '10', street: 'Villa Seurat' }),
        'seurat', voies(['Villa Seurat'], { postcode: '75014', city: 'Paris' }), saisie('10 rue Seurat', '75014', 'Paris'), false],
      // Voie rendue absente de la liste, voie d'un autre code postal seulement, service en erreur ou en panne : refusé.
      ['voie rendue absente', REPUBLIQUE, 'republique', voies(['Place de la republique']), saisie('10 République'), false],
      ['autre code postal', REPUBLIQUE, 'republique', voies(['Rue de la republique'], { postcode: '13002' }), saisie('10 République'), false],
      ['erreur du service', REPUBLIQUE, 'republique', { statut: 503, corps: {} }, saisie('10 République'), false],
      ['panne', REPUBLIQUE, 'republique', new Error('délai dépassé'), saisie('10 République'), false],
    ])
    expect(console.warn).toHaveBeenCalledWith('[btp] vérification des voies de la commune impossible :', 'délai dépassé')
  })

  it('voies de la commune : une page pleine ne prouve rien ; code postal sans ville (troisième relecture du 26/11/2026)', async () => {
    // « 5 Moulin », 22400 Noyal : la recherche « moulin » du code postal (quinze communes) rend 23 voies ; une page de 20
    // coupait le Moulin de Cravia de Noyal (22e), qui fait refuser la rue du Moulin.
    const moulin = ban('housenumber', 0.64, { postcode: '22400', city: 'Noyal', housenumber: '5', street: 'Rue du Moulin' })
    const ailleurs = (nombre: number) => Array.from({ length: nombre }, (_, i) => voieBan(`Rue du Moulin ${i + 1}`, '22400', 'Lamballe-Armor'))
    const page = (nombre: number): Reponse => ({ corps: { features: [voieBan('Rue du Moulin', '22400', 'Noyal'), ...ailleurs(nombre)] } })
    await jugerVoisins([
      ['page pleine', moulin, 'moulin', page(49), saisie('5 Moulin', '22400', 'Noyal'), false],
      ['page incomplète (témoin)', moulin, 'moulin', page(48), saisie('5 Moulin', '22400', 'Noyal'), true],
    ])
    // Code postal sans ville : cinq communes du 22400 ont une rue de l'Église ; la BAN rend celle de Lamballe-Armor (0,958).
    // Avant : précis, peut-être dans une autre commune. Les doublons de la BAN dans une même commune comptent une fois.
    reponses.ban = ban('housenumber', 0.958, { postcode: '22400', city: 'Lamballe-Armor', citycode: '22093', oldcity: 'Planguenoual', housenumber: '5', street: 'Rue de l\'Eglise' })
    const rues = ['Lamballe-Armor', 'Saint-Alban', 'Saint-Alban', 'Hénansal', 'Coëtmieux', 'Quintenic'].map(city => voieBan('Rue de l’Eglise', '22400', city))
    banSelonRecherche.eglise = { corps: { features: [...rues, voieBan('Place de l\'Eglise', '22400', 'Andel')] } }
    expect((await geocoderAdresse({ adresse: '5 rue de l\'Église', codePostal: '22400' }, 'FR'))?.precise).toBe(false)
    // Voie voisine sans ville : cherchée dans tout le code postal, pas dans la seule commune de la réponse.
    appels = []
    expect((await geocoderAdresse({ adresse: '5 Eglise', codePostal: '22400' }, 'FR'))?.precise).toBe(false)
    const recherchesDeVoies = appels.filter(a => a.includes('type=street'))
    expect(recherchesDeVoies.length).toBeGreaterThan(0)
    expect(recherchesDeVoies.some(a => a.includes('citycode='))).toBe(false)
    // Témoins : la ville saisie suffit, sans recherche de voies ; une seule commune du code postal a cette rue : précis.
    appels = []
    expect((await geocoderAdresse(saisie('5 rue de l\'Église', '22400', 'Lamballe-Armor'), 'FR'))?.precise).toBe(true)
    expect(appels.some(a => a.includes('type=street'))).toBe(false)
    reponses.ban = ban('housenumber', 0.95, { postcode: '22400', city: 'Saint-Alban', housenumber: '5', street: 'Rue de l\'Eglise' })
    banSelonRecherche.eglise = { corps: { features: [rues[1], rues[2], voieBan('Place de l\'Eglise', '22400', 'Andel')] } }
    expect((await geocoderAdresse({ adresse: '5 rue de l\'Église', codePostal: '22400' }, 'FR'))?.precise).toBe(true)
    // Deux communes déléguées d'une commune nouvelle, même nom sans parenthèse : deux voies.
    reponses.ban = ban('housenumber', 0.95, { postcode: '49230', city: 'Sèvremoine', oldcity: 'Tillières', housenumber: '5', street: 'Rue de l\'Eglise' })
    banSelonRecherche.eglise = { corps: { features: [voieBan('Rue de l\'Eglise', '49230', 'Sèvremoine', 'Tillières'), voieBan('Rue de l\'Eglise', '49230', 'Sèvremoine', 'Torfou')] } }
    expect((await geocoderAdresse({ adresse: '5 rue de l\'Église', codePostal: '49230' }, 'FR'))?.precise).toBe(false)
    // Quatrième relecture : seules comptent les communes. Deux voies de même nom dans la même commune (« chemin de la Source »
    // et « Chemin Campagne la Source », Auriol seule dans le 13390) : précis, comme avec la ville. La parenthèse de la BAN
    // recopiée (« place de l'Église (Andrezé) ») désigne une seule des trois places : précis ; sans elle, refusé (témoin).
    reponses.ban = ban('street', 0.963, { postcode: '13390', city: 'Auriol', street: 'Chemin de la Source' })
    banSelonRecherche.source = voies(['Chemin de la Source', 'Chemin Campagne la Source'], AURIOL)
    expect((await geocoderAdresse({ adresse: 'chemin de la Source', codePostal: '13390' }, 'FR'))?.precise).toBe(true)
    banSelonRecherche.source = { corps: { features: [voieBan('Chemin de la Source', '13390', 'Auriol'), voieBan('Chemin de la Source', '13390', 'Roquevaire')] } }
    expect((await geocoderAdresse({ adresse: 'chemin de la Source', codePostal: '13390' }, 'FR'))?.precise).toBe(false)
    // La voie rendue doit être dans la liste ; une voie d'une autre commune que la saisie désigne aussi (titre omis) compte.
    banSelonRecherche.source = voies(['Chemin Campagne la Source'], AURIOL)
    expect((await geocoderAdresse({ adresse: 'chemin de la Source', codePostal: '13390' }, 'FR'))?.precise).toBe(false)
    reponses.ban = ban('housenumber', 0.95, { postcode: '22400', city: 'Noyal', housenumber: '4', street: 'Rue du Général Leclerc' })
    banSelonRecherche.leclerc = { corps: { features: [voieBan('Rue du Général Leclerc', '22400', 'Noyal'), voieBan('Rue Leclerc', '22400', 'Andel')] } }
    expect((await geocoderAdresse({ adresse: '4 rue du Général Leclerc', codePostal: '22400' }, 'FR'))?.precise).toBe(false)
    banSelonRecherche.leclerc = { corps: { features: [voieBan('Rue du Général Leclerc', '22400', 'Noyal')] } }
    expect((await geocoderAdresse({ adresse: '4 rue du Général Leclerc', codePostal: '22400' }, 'FR'))?.precise).toBe(true)
    // La même rue dans deux communes du code postal : deux voies, pas un doublon de la BAN.
    reponses.ban = ban('housenumber', 0.9, { postcode: '22400', city: 'Noyal', housenumber: '10', street: 'Rue de la République' })
    banSelonRecherche.republique = { corps: { features: [voieBan('Rue de la République', '22400', 'Noyal'), voieBan('Rue de la République', '22400', 'Andel')] } }
    expect((await geocoderAdresse({ adresse: '10 République', codePostal: '22400' }, 'FR'))?.precise).toBe(false)
    banSelonRecherche.republique = { corps: { features: [voieBan('Rue de la République', '22400', 'Noyal'), voieBan('Rue de la République', '22400', 'Noyal')] } }
    expect((await geocoderAdresse({ adresse: '10 République', codePostal: '22400' }, 'FR'))?.precise).toBe(true)
    // Ville saisie (commune nouvelle) : la même rue dans deux communes déléguées, sans parenthèse, compte deux fois.
    reponses.ban = ban('housenumber', 0.9, { postcode: '49230', city: 'Sèvremoine', oldcity: 'Tillières', housenumber: '5', street: 'Rue de l\'Eglise' })
    banSelonRecherche.eglise = { corps: { features: [voieBan('Rue de l\'Eglise', '49230', 'Sèvremoine', 'Tillières'), voieBan('Rue de l\'Eglise', '49230', 'Sèvremoine', 'Torfou')] } }
    expect((await geocoderAdresse(saisie('5 Eglise', '49230', 'Sèvremoine'), 'FR'))?.precise).toBe(false)
    reponses.ban = ban('housenumber', 0.96, { postcode: '49600', city: 'Beaupréau-en-Mauges', oldcity: 'Andrezé', housenumber: '1', street: 'Place de l\'Église (Andrezé)' })
    banSelonRecherche.eglise = { corps: { features: ['Andrezé', 'La Chapelle-du-Genêt', 'St Philbert-en-Mauges'].map(oldcity => voieBan(`Place de l'Église (${oldcity})`, '49600', 'Beaupréau-en-Mauges', oldcity)) } }
    expect((await geocoderAdresse({ adresse: '1 place de l\'Église (Andrezé)', codePostal: '49600' }, 'FR'))?.precise).toBe(true)
    expect((await geocoderAdresse({ adresse: '1 place de l\'Église', codePostal: '49600' }, 'FR'))?.precise).toBe(false)
  })

  it('cinquième relecture : nom qui finit par un nombre, voie que la saisie désigne, arrondissements, zone, page pleine', async () => {
    // « rue du 19 Mars 1962 », 31620 sans ville : six communes ont cette rue. Cherchée par « 1962 », la vraie BAN ne rend
    // aucune voie (elle lit un numéro) : Nominatim passait alors pour précis à Villaudric.
    banSelonRecherche['1962'] = { corps: { features: [] } }
    banSelonRecherche['19 mars 1962'] = { corps: { features: ['Fronton', 'Bouloc', 'Villaudric', 'Cépet'].map(city => voieBan('Rue du 19 Mars 1962', '31620', city)) } }
    reponses.ban = ban('street', 0.9, { postcode: '31620', city: 'Fronton', street: 'Rue du 19 Mars 1962' })
    reponses.osm = osm(26, { road: 'Rue du 19 Mars 1962', postcode: '31620', village: 'Villaudric' })
    expect((await geocoderAdresse({ adresse: 'rue du 19 Mars 1962', codePostal: '31620' }, 'FR'))?.precise).toBe(false)
    expect(appels.filter(a => a.includes('type=street')).map(rechercheBan)).toContain('19 mars 1962')
    // Témoin : une seule commune du code postal a cette rue : précis.
    banSelonRecherche['19 mars 1962'] = { corps: { features: [voieBan('Rue du 19 Mars 1962', '31620', 'Fronton')] } }
    expect((await geocoderAdresse({ adresse: 'rue du 19 Mars 1962', codePostal: '31620' }, 'FR'))?.precise).toBe(true)
    // « 12 rue Leclerc », 61500 sans ville : la BAN hésite (0,568) ; OSM rend le 12 rue du Général Leclerc (Sées), mais la
    // saisie désigne aussi la rue de la Division Leclerc (Saint-Gervais-du-Perron, 7,2 km).
    reponses.ban = ban('housenumber', 0.568, { postcode: '61500', city: 'Sées', housenumber: '12', street: 'Rue du Général Leclerc' })
    reponses.osm = osm(30, { house_number: '12', road: 'Rue du Général Leclerc', postcode: '61500', town: 'Sées' })
    banSelonRecherche.leclerc = { corps: { features: [voieBan('Rue du Général Leclerc', '61500', 'Sées'), voieBan('Rue de la Division Leclerc', '61500', 'Saint-Gervais-du-Perron')] } }
    expect((await geocoderAdresse({ adresse: '12 rue Leclerc', codePostal: '61500' }, 'FR'))?.precise).toBe(false)
    banSelonRecherche.leclerc = { corps: { features: [voieBan('Rue du Général Leclerc', '61500', 'Sées')] } }
    expect((await geocoderAdresse({ adresse: '12 rue Leclerc', codePostal: '61500' }, 'FR'))?.precise).toBe(true)
    // Sans ville, côté BAN : « 12 rue de Gaulle » rendu rue du Général de Gaulle, l'autre commune a une rue Charles de Gaulle.
    reponses.osm = { corps: [] }
    reponses.ban = ban('housenumber', 0.93, { postcode: '22400', city: 'Noyal', housenumber: '12', street: 'Rue du Général de Gaulle' })
    banSelonRecherche.gaulle = { corps: { features: [voieBan('Rue du Général de Gaulle', '22400', 'Noyal'), voieBan('Rue Charles de Gaulle', '22400', 'Andel')] } }
    expect((await geocoderAdresse({ adresse: '12 rue de Gaulle', codePostal: '22400' }, 'FR'))?.precise).toBe(false)
    // Marseille sans code postal : deux boulevards de la Gare (13014, 13015) sont deux voies, pas un doublon.
    reponses.ban = ban('housenumber', 0.8, { postcode: '13015', city: 'Marseille', citycode: '13215', housenumber: '12', street: 'Boulevard de la gare' })
    banSelonRecherche.gare = { corps: { features: [voieBan('Boulevard de la gare', '13015', 'Marseille'), voieBan('Boulevard de la gare', '13014', 'Marseille')] } }
    expect((await geocoderAdresse({ adresse: '12 Gare', ville: 'Marseille' }, 'FR'))?.precise).toBe(false)
    banSelonRecherche.gare = { corps: { features: [voieBan('Boulevard de la gare', '13015', 'Marseille')] } }
    expect((await geocoderAdresse({ adresse: '12 Gare', ville: 'Marseille' }, 'FR'))?.precise).toBe(true)
    // Voie « Zone Artisanale du Bosc », numérotée dans la BAN (Mudaison, 0,952) : précise, comme avant le 26/11.
    reponses.ban = ban('housenumber', 0.952, { postcode: '34130', city: 'Mudaison', housenumber: '2', street: 'Zone Artisanale du Bosc' })
    expect((await geocoderAdresse(saisie('2 Zone Artisanale du Bosc', '34130', 'Mudaison'), 'FR'))?.precise).toBe(true)
    // La zone écrite après la voie en est un complément : la voie s'arrête avant elle.
    reponses.ban = ban('housenumber', 0.9, { postcode: '34130', city: 'Mudaison', housenumber: '12', street: 'Rue des Artisans' })
    expect((await geocoderAdresse(saisie('12 rue des Artisans Zone Artisanale du Bosc', '34130', 'Mudaison'), 'FR'))?.precise).toBe(true)
    // Page pleine sans ville (« ville » touche toutes les voies de Villeneuve-d'Ascq) : refus voulu.
    reponses.ban = ban('housenumber', 0.972, { postcode: '59650', city: 'Villeneuve-d\'Ascq', housenumber: '1', street: 'Chaussée de l\'Hôtel de Ville' })
    banSelonRecherche.ville = { corps: { features: Array.from({ length: 50 }, (_, i) => voieBan(i === 0 ? 'Chaussée de l\'Hôtel de Ville' : `Rue ${i} de Villeneuve`, '59650', 'Villeneuve-d\'Ascq')) } }
    expect((await geocoderAdresse({ adresse: '1 chaussée de l\'Hôtel de Ville', codePostal: '59650' }, 'FR'))?.precise).toBe(false)
  })

  it('sixième relecture : lots écrits autrement, complément collé, commune homonyme, voie coupée par arrondissement', async () => {
    // « Lots du 12 jusqu'au 14 rue Paradis » : la BAN réelle rend le 14 (0,545), la seconde recherche « 14 rue Paradis » le
    // rendait précis (0,969). « rue Paradis lot 12, 13, 14 » : la rue (0,606), puis « 13 rue Paradis lot 12 » (0,719).
    reponses.ban = ban('housenumber', 0.545, { postcode: '13001', housenumber: '14', street: 'Rue paradis' })
    banSelonRecherche['14 rue Paradis 13001 Marseille'] = ban('housenumber', 0.969, { postcode: '13001', housenumber: '14', street: 'Rue paradis' })
    for (const adresse of ['Lots du 12 jusqu\'au 14 rue Paradis', 'Lots du n° 12 au n° 14 rue Paradis', 'rue Paradis lot 12, 13, 14']) {
      appels = []
      expect((await geocoderAdresse(saisie(adresse), 'FR'))?.precise, adresse).toBe(false)
      expect(appels.filter(a => a.includes('api-adresse.data.gouv.fr')), adresse).toHaveLength(1)
    }
    // « Lot12 avenue de la Capelette » (espace oubliée) : OSM rend l'avenue entière (rang 26) ; le 12 collé n'est pas expliqué.
    reponses.ban = ban('street', 0.773, { postcode: '13010', street: 'Avenue de la Capelette' })
    reponses.osm = osm(26, { road: 'Avenue de la Capelette', postcode: '13010', city: 'Marseille' })
    expect((await geocoderAdresse(saisie('Lot12 avenue de la Capelette', '13010'), 'FR'))?.precise).toBe(false)
    expect((await geocoderAdresse(saisie('Bât B2, avenue de la Capelette', '13010'), 'FR'))?.precise).toBe(false)
    // « 2, Zone Industrielle, rue Gay Lussac » (60870) : la BAN rend le 2 Zone Industrielle, à 425 m du 2 rue Gay Lussac.
    reponses.ban = ban('housenumber', 0.646, { postcode: '60870', city: 'Villers-Saint-Paul', housenumber: '2', street: 'Zone Industrielle' })
    reponses.osm = { corps: [] }
    expect((await geocoderAdresse(saisie('2, Zone Industrielle, rue Gay Lussac', '60870', 'Villers-Saint-Paul'), 'FR'))?.precise).toBe(false)
    // « 12 rue Leclerc France », 61500 sans ville : la voie est cherchée par « leclerc », pas par « france » (0 voie).
    reponses.ban = ban('housenumber', 0.504, { postcode: '61500', city: 'Sées', housenumber: '12', street: 'Rue du Général Leclerc' })
    reponses.osm = osm(30, { house_number: '12', road: 'Rue du Général Leclerc', postcode: '61500', town: 'Sées' })
    banSelonRecherche.france = { corps: { features: [] } }
    banSelonRecherche.leclerc = { corps: { features: [voieBan('Rue du Général Leclerc', '61500', 'Sées'), voieBan('Rue de la Division Leclerc', '61500', 'Saint-Gervais-du-Perron')] } }
    expect((await geocoderAdresse({ adresse: '12 rue Leclerc France', codePostal: '61500' }, 'FR'))?.precise).toBe(false)
    // La ville rendue par OSM, recopiée à la fin de la voie (« … Sées »), est retirée avant de chercher les voies.
    expect((await geocoderAdresse({ adresse: '12 rue Leclerc Sées', codePostal: '61500' }, 'FR'))?.precise).toBe(false)
    // Ville seule, sans code postal : douze communes « Sainte-Colombe » ; la BAN rend celle de Seine-et-Marne. Reconnue comme
    // commune déléguée (Val-de-Bonnieure), refusée aussi tant qu'une commune porte ce nom. Témoin : une seule commune.
    reponses.osm = { corps: [] }
    banSelonRecherche['Sainte-Colombe'] = { corps: { features: ['77650', '35134', '46120'].map(postcode => ({ properties: { type: 'municipality', name: 'Sainte-Colombe', postcode } })) } }
    reponses.ban = ban('housenumber', 0.949, { postcode: '77650', city: 'Sainte-Colombe', housenumber: '1', street: 'Place de l\'Église' })
    expect((await geocoderAdresse({ adresse: '1 place de l\'Église', ville: 'Sainte-Colombe' }, 'FR'))?.precise).toBe(false)
    reponses.ban = ban('housenumber', 0.942, { postcode: '16230', city: 'Val-de-Bonnieure', oldcity: 'Sainte-Colombe', housenumber: '1', street: 'Rue de l\'Église' })
    expect((await geocoderAdresse({ adresse: '1 rue de l\'Église', ville: 'Sainte-Colombe' }, 'FR'))?.precise).toBe(false)
    banSelonRecherche['Sainte-Colombe'] = { corps: { features: [{ properties: { type: 'municipality', name: 'Sainte-Colombe', postcode: '77650' } }] } }
    expect((await geocoderAdresse({ adresse: '1 rue de l\'Église', ville: 'Sainte-Colombe' }, 'FR'))?.precise).toBe(false)
    reponses.ban = ban('housenumber', 0.949, { postcode: '77650', city: 'Sainte-Colombe', housenumber: '1', street: 'Place de l\'Église' })
    expect((await geocoderAdresse({ adresse: '1 place de l\'Église', ville: 'Sainte-Colombe' }, 'FR'))?.precise).toBe(true)
    banSelonRecherche['Sainte-Colombe'] = new Error('délai dépassé')
    expect((await geocoderAdresse({ adresse: '1 place de l\'Église', ville: 'Sainte-Colombe' }, 'FR'))?.precise).toBe(false)
    // « 12 Jules Cantini », Marseille sans code postal : la BAN coupe l'avenue entre le 6e et le 8e sous un même code de voie
    // (13206_4930, 13208_4930) : une seule avenue.
    reponses.ban = ban('housenumber', 0.698, { postcode: '13006', city: 'Marseille', citycode: '13206', housenumber: '12', street: 'Avenue Jules Cantini' })
    banSelonRecherche.cantini = { corps: { features: [voieBan('Avenue Jules Cantini', '13006', 'Marseille', undefined, '13206_4930'), voieBan('Avenue Jules Cantini', '13008', 'Marseille', undefined, '13208_4930'), voieBan('Square Cantini', '13006', 'Marseille', undefined, '13206_1525')] } }
    expect((await geocoderAdresse({ adresse: '12 Jules Cantini', ville: 'Marseille' }, 'FR'))?.precise).toBe(true)
    banSelonRecherche.cantini = { corps: { features: [voieBan('Avenue Jules Cantini', '13006', 'Marseille', undefined, '13206_4930'), voieBan('Avenue Jules Cantini', '13008', 'Marseille', undefined, '13208_5021')] } }
    expect((await geocoderAdresse({ adresse: '12 Jules Cantini', ville: 'Marseille' }, 'FR'))?.precise).toBe(false)
  })

  it('septième relecture : ville seule homonyme par Nominatim, arrondissement d’OSM, codes de voie, villes refusées', async () => {
    // « 1 place de la Liberté », Valence sans code postal : trois communes Valence ; la BAN (le bon point, 26000) est refusée.
    // OSM rend la place de Bourg-lès-Valence (26500), avec l'arrondissement « Valence » en municipality : pas la ville.
    banSelonRecherche.Valence = { corps: { features: ['26000', '82400', '16460'].map(postcode => ({ properties: { type: 'municipality', name: 'Valence', postcode } })) } }
    reponses.ban = ban('housenumber', 0.958, { postcode: '26000', city: 'Valence', housenumber: '1', street: 'Place de la Liberte' })
    reponses.osm = osm(30, { house_number: '1', road: 'Place de la Liberté', postcode: '26500', town: 'Bourg-lès-Valence', municipality: 'Valence' })
    expect((await geocoderAdresse({ adresse: '1 place de la Liberté', ville: 'Valence' }, 'FR'))?.precise).toBe(false)
    // OSM dans l'une des trois Valence : refusé aussi, comme la BAN.
    reponses.osm = osm(30, { house_number: '1', road: 'Place de la Liberté', postcode: '26000', city: 'Valence' })
    banSelonRecherche['liberte Valence'] = { corps: { features: [voieBan('Place de la Liberte', '26000', 'Valence', undefined, '26362_5280')] } }
    expect((await geocoderAdresse({ adresse: '1 place de la Liberté', ville: 'Valence' }, 'FR'))?.precise).toBe(false)
    // Une seule Valence vaut ville (témoin).
    banSelonRecherche.Valence = { corps: { features: [{ properties: { type: 'municipality', name: 'Valence', postcode: '26000' } }] } }
    expect((await geocoderAdresse({ adresse: '1 place de la Liberté', ville: 'Valence' }, 'FR'))?.precise).toBe(true)
    // Même chose par Nominatim, la BAN muette : une seule Valence, OSM dans cette Valence (city) : précis.
    reponses.ban = { corps: { features: [] } }
    expect((await geocoderAdresse({ adresse: '1 place de la Liberté', ville: 'Valence' }, 'FR'))?.precise).toBe(true)
    // L'arrondissement d'OSM n'est pas la ville, même quand la BAN ne connaît aucune commune de ce nom exact.
    banSelonRecherche.Valence = { corps: { features: [{ properties: { type: 'municipality', name: 'Valence-d\'Albigeois', postcode: '81340' } }] } }
    reponses.osm = osm(30, { house_number: '1', road: 'Place de la Liberté', postcode: '26500', town: 'Bourg-lès-Valence', municipality: 'Valence' })
    expect((await geocoderAdresse({ adresse: '1 place de la Liberté', ville: 'Valence' }, 'FR'))?.precise).toBe(false)
    // Deux places de l'Église dans deux communes homonymes, au même code de voie (0060) : deux voies, pas un doublon (la ville
    // est tenue pour unique ici, pour éprouver le seul code de voie).
    banSelonRecherche.Valence = { corps: { features: [{ properties: { type: 'municipality', name: 'Valence', postcode: '82400' } }] } }
    reponses.ban = ban('municipality', 0.9, { postcode: '82400', city: 'Valence' })
    reponses.osm = osm(30, { house_number: '1', road: 'Place de l\'Église', postcode: '82400', town: 'Valence' })
    banSelonRecherche['eglise Valence'] = { corps: { features: [voieBan('Place de l\'Église', '82400', 'Valence', undefined, '82186_0060'), voieBan('Place de l\'Église', '16460', 'Valence', undefined, '16393_0060')] } }
    expect((await geocoderAdresse({ adresse: '1 place de l\'Église', ville: 'Valence' }, 'FR'))?.precise).toBe(false)
    // Page pleine de communes (« Saint-Étienne-… ») et nom de moins de trois lettres (la BAN répond 400) : refus voulu.
    reponses.osm = { corps: [] }
    banSelonRecherche['Saint-Étienne'] = { corps: { features: Array.from({ length: 50 }, (_, i) => ({ properties: { type: 'municipality', name: i === 0 ? 'Saint-Étienne' : `Saint-Étienne-de-${i}` } })) } }
    reponses.ban = ban('housenumber', 0.971, { postcode: '42000', city: 'Saint-Étienne', housenumber: '1', street: 'Place de l\'Hôtel de Ville' })
    expect((await geocoderAdresse({ adresse: '1 place de l\'Hôtel de Ville', ville: 'Saint-Étienne' }, 'FR'))?.precise).toBe(false)
    banSelonRecherche.Eu = { statut: 400, corps: { code: 400 } }
    reponses.ban = ban('housenumber', 0.964, { postcode: '76260', city: 'Eu', housenumber: '1', street: 'Rue de la République' })
    expect((await geocoderAdresse({ adresse: '1 rue de la République', ville: 'Eu' }, 'FR'))?.precise).toBe(false)
    expect((await geocoderAdresse({ adresse: '1 rue de la République', codePostal: '76260', ville: 'Eu' }, 'FR'))?.precise).toBe(true)
  })

  it('huitième relecture : code postal partagé, arrondissement d’OSM, commune déléguée par Nominatim, ligatures', async () => {
    // « 1 rue de l'Église », 10200 Bar-sur-Aube : la BAN rend le 1 rue de l'Europe de Bar-sur-Aube (refusé) ; OSM le n° 1 rue
    // de l'Église d'Éclance (village), avec l'arrondissement « Bar-sur-Aube » en municipality. Neuf villages du 10200 ont une
    // rue de l'Église, Bar-sur-Aube aucune (relevés du 27/11/2026). Avant : précis à Éclance, à 11 km.
    reponses.ban = ban('housenumber', 0.662, { postcode: '10200', city: 'Bar-sur-Aube', housenumber: '1', street: 'Rue de l\'Europe' })
    reponses.osm = osm(30, { house_number: '1', road: 'Rue de l\'Église', postcode: '10200', village: 'Éclance', municipality: 'Bar-sur-Aube' })
    banSelonRecherche.eglise = { corps: { features: ['Éclance', 'Thors', 'Urville', 'Bergères', 'Thil'].map(city => voieBan('Rue de l\'Église', '10200', city)) } }
    expect((await geocoderAdresse(saisie('1 rue de l\'Église', '10200', 'Bar-sur-Aube'), 'FR'))?.precise).toBe(false)
    // La commune rendue en city ou en town (bourg plus grand) : de même.
    for (const champ of ['city', 'town']) {
      reponses.osm = osm(30, { house_number: '1', road: 'Rue de l\'Église', postcode: '10200', [champ]: 'Éclance', municipality: 'Bar-sur-Aube' })
      expect((await geocoderAdresse(saisie('1 rue de l\'Église', '10200', 'Bar-sur-Aube'), 'FR'))?.precise, champ).toBe(false)
    }
    reponses.osm = osm(30, { house_number: '1', road: 'Rue de l\'Église', postcode: '10200', village: 'Éclance', municipality: 'Bar-sur-Aube' })
    // Code postal et ville écrits dans le champ adresse (adresse importée d'un devis) : de même.
    expect((await geocoderAdresse({ adresse: '1 rue de l\'Église 10200 Bar-sur-Aube' }, 'FR'))?.precise).toBe(false)
    // Témoin : le village saisi, qui n'a qu'une rue de l'Église.
    expect((await geocoderAdresse(saisie('1 rue de l\'Église', '10200', 'Éclance'), 'FR'))?.precise).toBe(true)
    // municipality est la commune quand la réponse n'en nomme aucune en city, town ou village (forme réelle de
    // Mauges-sur-Loire) ; avec un code postal seulement.
    reponses.ban = ban('municipality', 0.9, { postcode: '49410', city: 'Mauges-sur-Loire' })
    reponses.osm = osm(30, { house_number: '1', road: 'Place de l\'Église', postcode: '49410', city_district: 'Saint-Florent-le-Vieil', municipality: 'Mauges-sur-Loire' })
    banSelonRecherche.eglise = voies(['Place de l\'Église'], { postcode: '49410', city: 'Mauges-sur-Loire' })
    expect((await geocoderAdresse(saisie('1 place de l\'Église', '49410', 'Mauges-sur-Loire'), 'FR'))?.precise).toBe(true)
    expect((await geocoderAdresse({ adresse: '1 place de l\'Église', ville: 'Mauges-sur-Loire' }, 'FR'))?.precise).toBe(false)

    // « place de l'Église », La Jumellière sans code postal : la BAN rend sa place à 0,795 (sous 0,8) ; OSM la rend au même
    // point, en village de Chemillé-en-Anjou. Aucune commune ne s'appelle La Jumellière (commune déléguée), mais la BAN y connaît
    // la place : précis, comme avant la septième relecture.
    reponses.ban = ban('street', 0.795, { postcode: '49120', city: 'Chemillé-en-Anjou', oldcity: 'La Jumellière', street: 'Place de l\'Église de la Jumellière' })
    reponses.osm = osm(27, { road: 'Place de l\'Église', postcode: '49120', hamlet: 'Les Ratelières', village: 'La Jumellière', city: 'Chemillé-en-Anjou', municipality: 'Cholet' })
    banSelonRecherche['La Jumellière'] = { corps: { features: [] } }
    banSelonRecherche['eglise La Jumellière'] = { corps: { features: [voieBan('Place de l\'Église de la Jumellière', '49120', 'Chemillé-en-Anjou', 'La Jumellière', '49092_1990')] } }
    const jumelliere = { adresse: 'place de l\'Église', ville: 'La Jumellière' }
    expect((await geocoderAdresse(jumelliere, 'FR'))?.precise).toBe(true)
    // Sans commune de ce nom ni commune déléguée où la BAN connaît la voie (lieu-dit, quartier d'OSM : homonymes possibles) : non.
    banSelonRecherche['eglise La Jumellière'] = { corps: { features: [] } }
    expect((await geocoderAdresse(jumelliere, 'FR'))?.precise).toBe(false)
    reponses.ban = { corps: { features: [] } }
    reponses.osm = osm(26, { road: 'Rue des Lilas', postcode: '86300', hamlet: 'Les Granges', village: 'Chauvigny' })
    banSelonRecherche['Les Granges'] = { corps: { features: [] } }
    expect((await geocoderAdresse({ adresse: 'rue des Lilas', ville: 'Les Granges' }, 'FR'))?.precise).toBe(false)
    // Quartier d'OSM homonyme d'une commune (Saint-Barnabé, Marseille ; une commune Saint-Barnabé dans les Côtes-d'Armor) :
    // la ville saisie est cette commune, pas le quartier.
    reponses.osm = osm(30, { house_number: '1', road: 'Rue des Lilas', postcode: '13012', suburb: 'Saint-Barnabé', city: 'Marseille' })
    expect((await geocoderAdresse({ adresse: '1 rue des Lilas', ville: 'Saint-Barnabé' }, 'FR'))?.precise).toBe(false)
    // Par la BAN, commune déléguée saisie comme ville seule : aucune commune ne s'appelle Andrezé (la BAN propose Andrezel,
    // en Seine-et-Marne), la BAN la reconnaît (oldcity) : précis (relevé du 27/11/2026, 0,960).
    reponses.osm = { corps: [] }
    banSelonRecherche['Andrezé'] = { corps: { features: [{ properties: { type: 'municipality', name: 'Andrezel', postcode: '77390' } }] } }
    reponses.ban = ban('housenumber', 0.96, { postcode: '49600', city: 'Beaupréau-en-Mauges', oldcity: 'Andrezé', housenumber: '1', street: 'Place de l\'Église (Andrezé)' })
    expect((await geocoderAdresse({ adresse: '1 place de l\'Église', ville: 'Andrezé' }, 'FR'))?.precise).toBe(true)
    // Par la BAN : la ville de la réponse, sans commune de ce nom (ni commune déléguée reconnue) : non.
    reponses.osm = { corps: [] }
    banSelonRecherche.Valence = { corps: { features: [{ properties: { type: 'municipality', name: 'Valence-d\'Albigeois', postcode: '81340' } }] } }
    reponses.ban = ban('housenumber', 0.958, { postcode: '26000', city: 'Valence', housenumber: '1', street: 'Place de la Liberte' })
    expect((await geocoderAdresse({ adresse: '1 place de la Liberté', ville: 'Valence' }, 'FR'))?.precise).toBe(false)

    // « Marcq-en-Baroeul » : la BAN rend la bonne rue, dans « Marcq-en-Barœul » (relevé du 27/11/2026). Avant : jamais précis.
    reponses.ban = ban('street', 0.972, { postcode: '59700', city: 'Marcq-en-Barœul', street: 'Rue Nationale' })
    expect((await geocoderAdresse(saisie('rue Nationale', '59700', 'Marcq-en-Baroeul'), 'FR'))?.precise).toBe(true)
    // De même dans le nom de la voie, dans les deux sens.
    reponses.ban = ban('housenumber', 0.9, { postcode: '13001', housenumber: '1', street: 'Rue des Œillets' })
    expect((await geocoderAdresse(saisie('1 rue des Oeillets'), 'FR'))?.precise).toBe(true)
    reponses.ban = ban('housenumber', 0.9, { postcode: '13001', housenumber: '1', street: 'Rue des Oeillets' })
    expect((await geocoderAdresse(saisie('1 rue des Œillets'), 'FR'))?.precise).toBe(true)
  })

  it('neuvième relecture : commune déléguée homonyme, commune déléguée en village, parenthèse de la BAN', async () => {
    // « place de l'Église », Sainte-Christine sans code postal : une commune du Puy-de-Dôme (63390) et une commune déléguée de
    // Chemillé-en-Anjou (49120) ; la recherche des communes ne voit que la première. Les premières réponses de la BAN montrent
    // les deux places (relevé du 27/11/2026). Avant : précis dans le 63, à 312 km.
    const place63 = { geometry: { coordinates: [2.83614, 46.06663] }, properties: { type: 'street', score: 0.931, name: 'Place de l\'Eglise', street: 'Place de l\'Eglise', postcode: '63390', city: 'Sainte-Christine' } }
    const place49 = { geometry: { coordinates: [-0.84785, 47.28638] }, properties: { type: 'street', score: 0.797, name: 'Place de l\'Eglise de Sainte-Christine', street: 'Place de l\'Eglise de Sainte-Christine', postcode: '49120', city: 'Chemillé-en-Anjou', oldcity: 'Ste Christine' } }
    const sousLeSeuil = { ...place63, properties: { ...place63.properties, score: 0.75 } }
    const christine = { adresse: 'place de l\'Église', ville: 'Sainte-Christine' }
    reponses.ban = { corps: { features: [place63, place49] } }
    expect((await geocoderAdresse(christine, 'FR'))?.precise).toBe(false)
    expect(appels[0]).toContain('&limit=5')
    // Par Nominatim (la BAN sous son seuil) : de même.
    reponses.ban = { corps: { features: [sousLeSeuil, place49] } }
    reponses.osm = osm(26, { road: 'Place de l\'Église', postcode: '63390', village: 'Sainte-Christine', municipality: 'Riom' })
    expect((await geocoderAdresse(christine, 'FR'))?.precise).toBe(false)
    // Témoins : la seule place du 63 parmi les réponses, par la BAN puis par Nominatim : précis.
    reponses.ban = { corps: { features: [place63] } }
    expect((await geocoderAdresse(christine, 'FR'))?.precise).toBe(true)
    reponses.ban = { corps: { features: [sousLeSeuil] } }
    expect((await geocoderAdresse(christine, 'FR'))?.precise).toBe(true)
    // Ne comptent que les réponses dans une commune ou commune déléguée du nom saisi, et sur la voie saisie.
    const riom = { ...place49, properties: { ...place49.properties, postcode: '63200', city: 'Riom', oldcity: undefined } }
    const gare = { ...place49, properties: { ...place49.properties, name: 'Rue de la Gare', street: 'Rue de la Gare' } }
    reponses.ban = { corps: { features: [place63, riom, gare] } }
    expect((await geocoderAdresse(christine, 'FR'))?.precise).toBe(true)
    // Avec un code postal, une seule réponse demandée.
    appels = []
    await geocoderAdresse({ ...christine, codePostal: '63390' }, 'FR')
    expect(appels[0]).toContain('&limit=1&postcode=63390')

    // « rue de la Vieille Église », 49620 Mauges-sur-Loire : la BAN sous son seuil (0,7575) ; OSM rend la rue dans le village
    // de La Pommeraye, « Mauges-sur-Loire » en municipality (relevés du 27/11/2026). La BAN y connaît la rue, à La Pommeraye,
    // commune déléguée de Mauges-sur-Loire : précis, comme main (la huitième correction le refusait).
    reponses.ban = ban('street', 0.7575, { postcode: '49620', city: 'Mauges-sur-Loire', oldcity: 'La Pommeraye', street: 'Rue de la Vieille Église' })
    reponses.osm = osm(27, { road: 'Rue de la Vieille Église', postcode: '49620', village: 'La Pommeraye', municipality: 'Mauges-sur-Loire' })
    banSelonRecherche.eglise = { corps: { features: [voieBan('Rue de la Vieille Église', '49620', 'Mauges-sur-Loire', 'La Pommeraye')] } }
    expect((await geocoderAdresse(saisie('rue de la Vieille Église', '49620', 'Mauges-sur-Loire'), 'FR'))?.precise).toBe(true)
    // La rue connue dans une autre commune déléguée que le village d'OSM, ou une autre voie seulement dans ce village : non.
    banSelonRecherche.eglise = { corps: { features: [voieBan('Rue de la Vieille Église', '49620', 'Mauges-sur-Loire', 'Saint-Laurent-de-la-Plaine')] } }
    expect((await geocoderAdresse(saisie('rue de la Vieille Église', '49620', 'Mauges-sur-Loire'), 'FR'))?.precise).toBe(false)
    banSelonRecherche.eglise = { corps: { features: [voieBan('Place de l\'Église', '49620', 'Mauges-sur-Loire', 'La Pommeraye')] } }
    expect((await geocoderAdresse(saisie('rue de la Vieille Église', '49620', 'Mauges-sur-Loire'), 'FR'))?.precise).toBe(false)

    // « rue de la Mairie », 49660 Sèvremoine : la BAN écrit « Rue de la Mairie (Torfou) » (0,7245) ; OSM rend « Rue de la
    // Mairie » à Torfou (city_district), commune déléguée de Sèvremoine (relevés du 27/11/2026) : la même voie. Précis, comme
    // main ; la branche la comptait pour une autre voie.
    reponses.ban = ban('street', 0.7245, { postcode: '49660', city: 'Sèvremoine', oldcity: 'Torfou', street: 'Rue de la Mairie (Torfou)' })
    reponses.osm = osm(26, { road: 'Rue de la Mairie', postcode: '49660', city_district: 'Torfou', city: 'Sèvremoine' })
    banSelonRecherche.mairie = { corps: { features: [voieBan('Rue de la Mairie (Torfou)', '49660', 'Sèvremoine', 'Torfou')] } }
    expect((await geocoderAdresse(saisie('rue de la Mairie', '49660', 'Sèvremoine'), 'FR'))?.precise).toBe(true)
    // La parenthèse d'une autre commune déléguée que celle d'OSM : une autre voie, refusée.
    banSelonRecherche.mairie = { corps: { features: [voieBan('Rue de la Mairie (Tillières)', '49660', 'Sèvremoine', 'Tillières')] } }
    expect((await geocoderAdresse(saisie('rue de la Mairie', '49660', 'Sèvremoine'), 'FR'))?.precise).toBe(false)

    // « 3 rue Nationale », 49570 Mauges-sur-Loire : la BAN sous son seuil (0,5997, « Rue Nationale (Montjean-sur-Loire) ») ;
    // OSM rend le n° 3 au même point, dans le village de Montjean-sur-Loire : les deux règles ensemble.
    reponses.ban = ban('housenumber', 0.5997, { postcode: '49570', city: 'Mauges-sur-Loire', oldcity: 'Montjean-sur-Loire', housenumber: '3', street: 'Rue Nationale (Montjean-sur-Loire)' })
    reponses.osm = osm(30, { house_number: '3', road: 'Rue Nationale', postcode: '49570', village: 'Montjean-sur-Loire', municipality: 'Mauges-sur-Loire' })
    banSelonRecherche.nationale = { corps: { features: [voieBan('Rue Nationale (Montjean-sur-Loire)', '49570', 'Mauges-sur-Loire', 'Montjean-sur-Loire')] } }
    expect((await geocoderAdresse(saisie('3 rue Nationale', '49570', 'Mauges-sur-Loire'), 'FR'))?.precise).toBe(true)
  })

  it('dixième relecture : réponses de la seconde recherche, commune d’OSM, panne, Lille, ponctuation de tête', async () => {
    // « 1 place de l'Église, face à la mairie », Sainte-Christine sans code postal : la première recherche ne rend aucune des
    // deux places, la seconde (« 1 place de l'Église Sainte-Christine ») les rend toutes deux ; ses réponses comptent aussi
    // (relevé du 27/11/2026 ; avant : précis dans le 63, à 312 km).
    const n1en63 = { geometry: { coordinates: [2.836, 46.0667] }, properties: { type: 'housenumber', score: 0.931, housenumber: '1', name: '1 Place de l\'Eglise', street: 'Place de l\'Eglise', postcode: '63390', city: 'Sainte-Christine' } }
    const n1en49 = { geometry: { coordinates: [-0.8478, 47.2864] }, properties: { type: 'housenumber', score: 0.8003, housenumber: '1', name: '1 Place de l\'Eglise de Sainte-Christine', street: 'Place de l\'Eglise de Sainte-Christine', postcode: '49120', city: 'Chemillé-en-Anjou', oldcity: 'Ste Christine' } }
    const repere = { adresse: '1 place de l\'Église, face à la mairie', ville: 'Sainte-Christine' }
    banSelonRecherche['1 place de l\'Église Sainte-Christine'] = { corps: { features: [n1en63, n1en49] } }
    expect((await geocoderAdresse(repere, 'FR'))?.precise).toBe(false)
    // Témoin : la seconde recherche ne rend que le n° 1 du 63 : précis.
    banSelonRecherche['1 place de l\'Église Sainte-Christine'] = { corps: { features: [n1en63] } }
    expect((await geocoderAdresse(repere, 'FR'))?.precise).toBe(true)
    // L'homonyme vu à la première recherche (sous son seuil) compte encore à la seconde : les réponses s'ajoutent.
    banSelonRecherche['1 place de l\'Église, face à la mairie Sainte-Christine'] = { corps: { features: [{ ...n1en49, properties: { ...n1en49.properties, score: 0.5 } }] } }
    expect((await geocoderAdresse(repere, 'FR'))?.precise).toBe(false)

    // Par Nominatim : la BAN ne connaît que la place de la commune déléguée (0,797, sous le seuil) ; OSM rend celle du 63, la
    // seule commune de ce nom : ambiguë (scénario simulé de la dixième relecture).
    const place49 = { geometry: { coordinates: [-0.84785, 47.28638] }, properties: { type: 'street', score: 0.797, name: 'Place de l\'Eglise de Sainte-Christine', street: 'Place de l\'Eglise de Sainte-Christine', postcode: '49120', city: 'Chemillé-en-Anjou', oldcity: 'Ste Christine' } }
    const christine = { adresse: 'place de l\'Église', ville: 'Sainte-Christine' }
    reponses.ban = { corps: { features: [place49] } }
    reponses.osm = osm(26, { road: 'Place de l\'Église', postcode: '63390', village: 'Sainte-Christine', municipality: 'Riom' })
    expect((await geocoderAdresse(christine, 'FR'))?.precise).toBe(false)
    // Témoin : la BAN ne connaît aucune des deux places : la réponse d'OSM, dans la seule commune de ce nom, est admise.
    reponses.ban = { corps: { features: [] } }
    expect((await geocoderAdresse(christine, 'FR'))?.precise).toBe(true)
    // Recherche de la BAN en échec : rien ne dit que la ville soit sans homonyme, la réponse d'OSM est refusée (une panne vaut
    // oui) ; les voies se cherchent encore.
    banSelonRecherche['place de l\'Église Sainte-Christine'] = { statut: 503, corps: {} }
    banSelonRecherche['eglise Sainte-Christine'] = { corps: { features: [] } }
    expect((await geocoderAdresse(christine, 'FR'))?.precise).toBe(false)
    // Réponse de la BAN admise par types confondus (« Avenue de l'Église » pour « rue de l'Église », seule voie de ce nom dans
    // le 63) : sa commune compte aussi, face à la « Rue de l'Église » de la commune déléguée (scénario simulé).
    const avenue63 = { geometry: { coordinates: [2.836, 46.0667] }, properties: { type: 'housenumber', score: 0.9, housenumber: '1', name: '1 Avenue de l\'Église', street: 'Avenue de l\'Église', postcode: '63390', city: 'Sainte-Christine' } }
    const rue49 = { geometry: { coordinates: [-0.8478, 47.2864] }, properties: { type: 'housenumber', score: 0.8, housenumber: '1', name: '1 Rue de l\'Église', street: 'Rue de l\'Église', postcode: '49120', city: 'Chemillé-en-Anjou', oldcity: 'Ste Christine' } }
    banSelonRecherche['eglise Sainte-Christine'] = { corps: { features: [voieBan('Avenue de l\'Église', '63390', 'Sainte-Christine')] } }
    banSelonRecherche['1 rue de l\'Église Sainte-Christine'] = { corps: { features: [avenue63, rue49] } }
    reponses.osm = { corps: [] }
    expect((await geocoderAdresse({ adresse: '1 rue de l\'Église', ville: 'Sainte-Christine' }, 'FR'))?.precise).toBe(false)
    banSelonRecherche['1 rue de l\'Église Sainte-Christine'] = { corps: { features: [avenue63] } }
    expect((await geocoderAdresse({ adresse: '1 rue de l\'Église', ville: 'Sainte-Christine' }, 'FR'))?.precise).toBe(true)
    // Par Nominatim, à Lille : la BAN écrit « Lille/Lille » (commune à communes associées) ; c'est bien la commune d'OSM.
    banSelonRecherche['40 rue Pierre Legrand Lille'] = { corps: { features: [{ geometry: { coordinates: [3.08, 50.63] }, properties: { type: 'housenumber', score: 0.59, housenumber: '40', name: '40 Rue Pierre Legrand', street: 'Rue Pierre Legrand', postcode: '59000', city: 'Lille', oldcity: 'Lille' } }] } }
    banSelonRecherche['legrand Lille'] = { corps: { features: [voieBan('Rue Pierre Legrand', '59000', 'Lille', 'Lille')] } }
    reponses.osm = osm(30, { house_number: '40', road: 'Rue Pierre Legrand', postcode: '59000', suburb: 'Fives', city: 'Lille' })
    expect((await geocoderAdresse({ adresse: '40 rue Pierre Legrand', ville: 'Lille' }, 'FR'))?.precise).toBe(true)

    // Lille sans code postal : une rue présente aussi à Lomme ou à Hellemmes (communes associées) compte deux fois. Refus
    // voulu, qui demande le code postal (« 20 rue Faidherbe » : un n° 20 à Lille et un à Hellemmes, à 3,3 km ; « 15 rue Jules
    // Guesde » aussi, bien que le n° 15 n'existe qu'à Lille ; relevés du 27/11/2026).
    const codes: Record<string, string> = { Lille: '59000', Lomme: '59160', Hellemmes: '59260' }
    const guesde = (partie: string, score: number, numero?: string) => ({ geometry: { coordinates: [3.06, 50.63] }, properties: { type: numero ? 'housenumber' : 'street', score, housenumber: numero, name: `Rue Jules Guesde (${partie})`, street: `Rue Jules Guesde (${partie})`, postcode: codes[partie], city: 'Lille', oldcity: partie } })
    reponses.osm = { corps: [] }
    reponses.ban = { corps: { features: [guesde('Lille', 0.9819, '15'), guesde('Lomme', 0.6449), guesde('Hellemmes', 0.5784)] } }
    expect((await geocoderAdresse({ adresse: '15 rue Jules Guesde', ville: 'Lille' }, 'FR'))?.precise).toBe(false)
    // Témoin : la seule rue de Lille parmi les réponses : précis.
    reponses.ban = { corps: { features: [guesde('Lille', 0.9819, '15')] } }
    expect((await geocoderAdresse({ adresse: '15 rue Jules Guesde', ville: 'Lille' }, 'FR'))?.precise).toBe(true)

    // Ponctuation de tête retirée de la recherche (la BAN répond 400 sinon) et de la lecture.
    appels = []
    reponses.ban = ban('housenumber', 0.95)
    expect((await geocoderAdresse({ adresse: '- 1 rue des Lilas', codePostal: '13008', ville: 'Marseille' }, 'FR'))?.precise).toBe(true)
    expect(rechercheBan(appels[0])).toBe('1 rue des Lilas 13008 Marseille')
  })

  it('onzième relecture : voie ordinale, séparateur final, tiret collé, étage collé, position de repli dans la ville', async () => {
    // « 3 1ère Avenue », 94250 Gentilly : la BAN rend le n° 3 (0,957 ; relevé du 27/11/2026). La dixième correction le
    // refusait (voie qui commence par un chiffre).
    reponses.ban = ban('housenumber', 0.957, { postcode: '94250', city: 'Gentilly', housenumber: '3', street: '1ère Avenue' })
    expect((await geocoderAdresse(saisie('3 1ère Avenue', '94250', 'Gentilly'), 'FR'))?.precise).toBe(true)
    // « 12 rue Paradis – 13001 Marseille » (en-tête de devis Word), collé ou importé : la BAN rend le bon n° 12 (0,969).
    reponses.ban = ban('housenumber', 0.969, { postcode: '13001', housenumber: '12', street: 'Rue paradis' })
    expect((await geocoderAdresse({ adresse: '12 rue Paradis – 13001 Marseille' }, 'FR'))?.precise).toBe(true)
    expect((await geocoderAdresse({ adresse: '12 rue Paradis –', codePostal: '13001', ville: 'Marseille' }, 'FR'))?.precise).toBe(true)
    // « 12 -14 rue Paradis » : la BAN rend le n° 14 (0,802), une des deux bornes.
    reponses.ban = ban('housenumber', 0.802, { postcode: '13001', housenumber: '14', street: 'Rue paradis' })
    expect((await geocoderAdresse(saisie('12 -14 rue Paradis'), 'FR'))?.precise).toBe(true)
    // « 12 3e étage rue Paradis » : la BAN rend le n° 12 (0,685).
    reponses.ban = ban('housenumber', 0.685, { postcode: '13001', housenumber: '12', street: 'Rue paradis' })
    expect((await geocoderAdresse(saisie('12 3e étage rue Paradis'), 'FR'))?.precise).toBe(true)

    // Position de repli : « Maison de Mme X, 1 place de l'Église, près de la mairie », Sainte-Christine sans code postal. La
    // première recherche rend la place de la Mairie de Sainte-Christie-d'Armagnac (Gers, 0,42) ; la seconde, refusée à juste
    // titre (deux Sainte-Christine), rend celle du 63. Le repli, que la météo garde, est celui de la ville saisie (relevé du
    // 27/11/2026 ; avant : le Gers, à 338 km).
    const gers = { geometry: { coordinates: [-0.00851, 43.78468] }, properties: { type: 'housenumber', score: 0.4165, housenumber: '1', name: '1 Place de la Mairie', street: 'Place de la Mairie', postcode: '32370', city: 'Sainte-Christie-d\'Armagnac' } }
    const n1en63 = { geometry: { coordinates: [2.836, 46.0667] }, properties: { type: 'housenumber', score: 0.931, housenumber: '1', name: '1 Place de l\'Eglise', street: 'Place de l\'Eglise', postcode: '63390', city: 'Sainte-Christine' } }
    const n1en49 = { geometry: { coordinates: [-0.8478, 47.2864] }, properties: { type: 'housenumber', score: 0.8003, housenumber: '1', name: '1 Place de l\'Eglise de Sainte-Christine', street: 'Place de l\'Eglise de Sainte-Christine', postcode: '49120', city: 'Chemillé-en-Anjou', oldcity: 'Ste Christine' } }
    const repere = { adresse: 'Maison de Mme X, 1 place de l\'Église, près de la mairie', ville: 'Sainte-Christine' }
    banSelonRecherche['Maison de Mme X, 1 place de l\'Église, près de la mairie Sainte-Christine'] = { corps: { features: [gers] } }
    banSelonRecherche['1 place de l\'Église Sainte-Christine'] = { corps: { features: [n1en63, n1en49] } }
    reponses.osm = { corps: [] }
    expect(await geocoderAdresse(repere, 'FR')).toEqual({ latitude: 46.0667, longitude: 2.836, precise: false })
    // Témoin : aucune réponse dans la ville saisie, la première est gardée, comme avant.
    banSelonRecherche['1 place de l\'Église Sainte-Christine'] = { corps: { features: [] } }
    expect(await geocoderAdresse(repere, 'FR')).toEqual({ latitude: 43.78468, longitude: -0.00851, precise: false })
  })

  it('seconde recherche : un numéro seulement, jamais la rue entière (comme avant le 26/11 ; quatrième relecture)', async () => {
    // « Chemin rural n° 5 », 76290 : la BAN rend le chemin entier à 0,757 (sous 0,8) ; la seconde recherche « 5 Chemin rural »,
    // texte que la saisie n'a pas écrit, le rendait à 0,810, donc précis.
    const fontaine = { postcode: '76290', city: 'Fontaine-la-Mallet' }
    reponses.ban = ban('street', 0.757, { ...fontaine, street: 'Chemin Rural 5' })
    banSelonRecherche['5 Chemin rural 76290 Fontaine-la-Mallet'] = ban('street', 0.81, { ...fontaine, street: 'Chemin Rural 5' })
    expect((await geocoderAdresse(saisie('Chemin rural n° 5', '76290', 'Fontaine-la-Mallet'), 'FR'))?.precise).toBe(false)
    expect(appels.map(rechercheBan)).toContain('5 Chemin rural 76290 Fontaine-la-Mallet')
    // Plage de lots (« lots 12 à 14 ») : la seconde borne n'est pas un numéro de rue, pas de seconde recherche (BAN réelle :
    // 0,498, puis 0,969 pour « 14 rue Paradis »).
    appels = []
    reponses.ban = ban('housenumber', 0.498, { postcode: '13001', housenumber: '14', street: 'Rue paradis' })
    banSelonRecherche['14 rue Paradis 13001 Marseille'] = ban('housenumber', 0.969, { postcode: '13001', housenumber: '14', street: 'Rue paradis' })
    expect((await geocoderAdresse(saisie('Lotissement Les Oliviers lots 12 à 14 rue Paradis'), 'FR'))?.precise).toBe(false)
    expect(appels.filter(a => a.includes('api-adresse.data.gouv.fr'))).toHaveLength(1)
  })

  it('commune nouvelle : voies homonymes que la BAN distingue entre parenthèses (relecture du 26/11/2026, défaut antérieur)', async () => {
    // « 1 place de l'Église », 49600 : trois places de l'Église (Andrezé, La Chapelle-du-Genêt, St Philbert-en-Mauges), à
    // 3 à 5 km l'une de l'autre ; la BAN rend celle d'Andrezé (0,743). Avant : précis.
    const andreze = ban('housenumber', 0.743, { postcode: '49600', city: 'Beaupréau-en-Mauges', oldcity: 'Andrezé', housenumber: '1', street: 'Place de l\'Église (Andrezé)' })
    const places = voies(['Place de l\'Église (Andrezé)', 'Place de l\'Église (La Chapelle-du-Genêt)', 'Place de l\'Église (St Philbert-en-Mauges)'], { postcode: '49600', city: 'Beaupréau-en-Mauges' })
    await jugerVoisins([
      ['commune nouvelle', andreze, 'eglise', places, saisie('1 place de l\'Église', '49600', 'Beaupréau-en-Mauges'), false],
      // La commune déléguée saisie comme ville : c'est bien sa place, précise sans vérification des homonymes.
      ['commune déléguée saisie', andreze, 'eglise', places, saisie('1 place de l\'Église', '49600', 'Andrezé'), true],
      ['autre commune déléguée', andreze, 'eglise', places, saisie('1 place de l\'Église', '49600', 'La Chapelle-du-Genêt'), false],
      // Ou écrite entre parenthèses, comme la BAN (troisième relecture du 26/11/2026 ; avant le correctif : précis) ; une
      // autre parenthèse ne vaut pas.
      ['parenthèse recopiée', andreze, 'eglise', places, saisie('1 place de l\'Église (Andrezé)', '49600', 'Beaupréau-en-Mauges'), true],
      ['autre parenthèse', andreze, 'eglise', places, saisie('1 place de l\'Église (Jallais)', '49600', 'Beaupréau-en-Mauges'), false],
    ])
    // Secours OSM : sa « Place de l'Église » ne dit pas de quelle commune déléguée elle est ; refusée tant que la commune en
    // a trois, avec ou sans numéro (avant : précise, à 3 à 5 km peut-être du chantier). Forme réelle de la réponse d'OSM
    // (27/11/2026) : la commune nouvelle en city, la commune déléguée en city_district, l'arrondissement en municipality.
    reponses.osm = osm(30, { house_number: '1', road: 'Place de l\'Église', postcode: '49600', city_district: 'Andrezé', city: 'Beaupréau-en-Mauges', municipality: 'Cholet' })
    expect((await geocoderAdresse(saisie('1 place de l\'Église', '49600', 'Beaupréau-en-Mauges'), 'FR'))?.precise).toBe(false)
    reponses.ban = ban('municipality', 0.9, { postcode: '49600', city: 'Beaupréau-en-Mauges' })
    reponses.osm = osm(26, { road: 'Place de l\'Église', postcode: '49600', city_district: 'Andrezé', city: 'Beaupréau-en-Mauges', municipality: 'Cholet' })
    expect((await geocoderAdresse(saisie('place de l\'Église', '49600', 'Beaupréau-en-Mauges'), 'FR'))?.precise).toBe(false)
    // Témoin : une seule place de l'Église dans la commune, la réponse d'OSM est admise ; panne de la vérification : refusée.
    banSelonRecherche.eglise = voies(['Place de l\'Église'], { postcode: '49600', city: 'Beaupréau-en-Mauges' })
    expect((await geocoderAdresse(saisie('place de l\'Église', '49600', 'Beaupréau-en-Mauges'), 'FR'))?.precise).toBe(true)
    banSelonRecherche.eglise = new Error('délai dépassé')
    expect((await geocoderAdresse(saisie('place de l\'Église', '49600', 'Beaupréau-en-Mauges'), 'FR'))?.precise).toBe(false)
    // Complément en tête, sans numéro : les homonymes du nom rendu par OSM sont comptés aussi.
    banSelonRecherche.eglise = places
    expect((await geocoderAdresse(saisie('Résidence Le Parc, place de l\'Église', '49600', 'Beaupréau-en-Mauges'), 'FR'))?.precise).toBe(false)
  })

  it('commune nouvelle : homonymes à suffixe pour OSM, doublons de la BAN (contre-relecture du 26/11/2026)', async () => {
    // « place de l'Église », 49120 Chemillé-en-Anjou : OSM rend « Place de l'Église » (La Jumellière) ; la BAN y connaît trois
    // places « de la Jumellière », « de Cossé », « de Sainte-Christine », jusqu'à 13,7 km. Avant : précis.
    const chemille = { postcode: '49120', city: 'Chemillé-en-Anjou' }
    reponses.ban = ban('street', 0.753, { ...chemille, street: 'Rue de l\'Église' })
    reponses.osm = osm(27, { road: 'Place de l\'Église', postcode: '49120', hamlet: 'Les Ratelières', village: 'La Jumellière', city: 'Chemillé-en-Anjou', municipality: 'Cholet' })
    banSelonRecherche.eglise = voies(['Place de l\'Église de la Jumellière', 'Place de l\'Église de Cossé', 'Place de l\'Eglise de Sainte-Christine'], chemille)
    expect((await geocoderAdresse(saisie('place de l\'Église', '49120', 'Chemillé-en-Anjou'), 'FR'))?.precise).toBe(false)
    // Témoin : une seule voie qui prolonge le nom (« Rue de la Mairie de Saint-Lézin », à 40 m du point OSM).
    reponses.osm = osm(27, { road: 'Rue de la Mairie', postcode: '49120', city_district: 'Saint-Lézin', city: 'Chemillé-en-Anjou', municipality: 'Cholet' })
    banSelonRecherche.mairie = voies(['Rue de la Mairie de Saint-Lézin'], chemille)
    expect((await geocoderAdresse(saisie('rue de la Mairie', '49120', 'Chemillé-en-Anjou'), 'FR'))?.precise).toBe(true)
    // Doublon de la BAN (même nom, même commune déléguée, à 25 m) : une seule voie, l'adresse juste reste précise.
    reponses.ban = ban('housenumber', 0.769, { postcode: '49490', city: 'Noyant-Villages', oldcity: 'Noyant', housenumber: '1', street: 'Place de l\'église saint martin (Noyant)' })
    banSelonRecherche.martin = voies(['Place de l\'église saint martin (Noyant)', 'Place De l\'Eglise Saint Martin (Noyant)'], { postcode: '49490', city: 'Noyant-Villages' })
    expect((await geocoderAdresse(saisie('1 place de l\'église Saint Martin', '49490', 'Noyant-Villages'), 'FR'))?.precise).toBe(true)
    // Seule « Rue de l'Église » de la commune, à côté de places et d'une ruelle du même nom : précise (49230, configuration
    // relevée le 26/11/2026) ; seules les voies de même nom, parenthèse retirée, sont comptées.
    reponses.ban = ban('housenumber', 0.75, { postcode: '49230', city: 'Sèvremoine', oldcity: 'Tillières', housenumber: '2', street: 'Rue de l\'Église (Tillières)' })
    banSelonRecherche.eglise = voies(['Rue de l\'Église (Tillières)', 'Place de l\'Église (St Germain-sur-Moine)', 'Place de l\'Église (Montfaucon-Montigné)', 'Ruelle de l\'Église (Tillières)'], { postcode: '49230', city: 'Sèvremoine' })
    expect((await geocoderAdresse(saisie('2 rue de l\'Église', '49230', 'Sèvremoine'), 'FR'))?.precise).toBe(true)
  })

  it('numéro de rue mal lu : le centre de la rue n’est pas précis si un nombre de la saisie reste inexpliqué', async () => {
    // « 45–47 route des Camoins », non lu avant le 26/11, était précis au point OSM de la route, à 270 m du 47.
    reponses.ban = ban('municipality', 0.9, { postcode: '13011' })
    reponses.osm = osm(26, { road: 'Route des Camoins', postcode: '13011', city: 'Marseille' })
    expect((await geocoderAdresse(saisie('45+47 route des Camoins', '13011'), 'FR'))?.precise).toBe(false)
    // Témoin : la route saisie sans numéro reste précise (règle antérieure).
    expect((await geocoderAdresse(saisie('route des Camoins', '13011'), 'FR'))?.precise).toBe(true)
    // Le « n°5 » du nom d'un chemin rural n'est pas un numéro de rue : la rue entière reste précise.
    reponses.ban = ban('street', 0.9, { postcode: '13001', street: 'Chemin vicinal n°5' })
    expect((await geocoderAdresse(saisie('chemin vicinal n°5'), 'FR'))?.precise).toBe(true)
  })

  it('numéro d’un lot, d’un bâtiment ou d’une parcelle, même après « n° » ou « : » : jamais pris pour le numéro de rue', async () => {
    // « Lot n° 12 » : sans la règle, la seconde recherche « 12 rue de la République » rendait précis le numéro du lot.
    reponses.ban = ban('housenumber', 0.542, { postcode: '13001', housenumber: '12', street: 'Rue de la republique' })
    banSelonRecherche['12 rue de la République 13001 Marseille'] = ban('housenumber', 0.966, { postcode: '13001', housenumber: '12', street: 'Rue de la republique' })
    expect((await geocoderAdresse(saisie('Lotissement Les Oliviers Lot n° 12 rue de la République'), 'FR'))?.precise).toBe(false)
    expect(appels.filter(a => a.includes('api-adresse.data.gouv.fr'))).toHaveLength(1)
    // Témoin : un vrai numéro de rue derrière la résidence passe par la seconde recherche, et il est précis.
    expect((await geocoderAdresse(saisie('Lotissement Les Oliviers 12 rue de la République'), 'FR'))?.precise).toBe(true)
  })

  it('numéro d’un logement, d’une porte, d’un local ou d’un lot précédé d’un article : jamais le numéro de rue (troisième relecture)', async () => {
    // « Résidence Les Pins Logt 12 rue Paradis » : la BAN réelle rend le 12 rue Paradis à 0,508 ; sans la règle, la seconde
    // recherche « 12 rue Paradis » (0,969) rendait précis le numéro du logement. « Terrain du lot 12 » : 0,600 (26/11/2026).
    reponses.ban = ban('housenumber', 0.508, { postcode: '13001', housenumber: '12', street: 'Rue paradis' })
    banSelonRecherche['12 rue Paradis 13001 Marseille'] = ban('housenumber', 0.969, { postcode: '13001', housenumber: '12', street: 'Rue paradis' })
    for (const adresse of ['Résidence Les Pins Logt 12 rue Paradis', 'Terrain du lot 12 rue Paradis', 'Construction sur le lot 12 rue Paradis', 'Résidence Le Parc Pte 12 rue Paradis', 'Local commercial 12 rue Paradis']) {
      appels = []
      expect((await geocoderAdresse(saisie(adresse), 'FR'))?.precise, adresse).toBe(false)
      expect(appels.filter(a => a.includes('api-adresse.data.gouv.fr')), adresse).toHaveLength(1)
    }
    // Témoin : derrière un nom de résidence, le numéro de rue passe par la seconde recherche, et il est précis.
    expect((await geocoderAdresse(saisie('Résidence Les Pins 12 rue Paradis'), 'FR'))?.precise).toBe(true)
  })

  it('numéro écrit après la voie, rue entière rendue : seconde recherche « numéro voie » (troisième relecture)', async () => {
    // « cours Mirabeau, 10 » : la BAN réelle rend le cours (0,822, à 165 m du n° 10) ; « 10 cours Mirabeau », le n° 10 (0,977).
    const aix = { postcode: '13100', city: 'Aix-en-Provence' }
    reponses.ban = ban('street', 0.822, { ...aix, street: 'Cours Mirabeau' })
    banSelonRecherche['10 cours Mirabeau 13100 Aix-en-Provence'] = ban('housenumber', 0.977, { ...aix, lat: 43.5264, lng: 5.4472, housenumber: '10', street: 'Cours Mirabeau' })
    expect(await geocoderAdresse(saisie('cours Mirabeau, 10', '13100', 'Aix-en-Provence'), 'FR')).toEqual({ latitude: 43.5264, longitude: 5.4472, precise: true })
    expect(appels.map(rechercheBan)).toEqual(['cours Mirabeau, 10 13100 Aix-en-Provence', '10 cours Mirabeau 13100 Aix-en-Provence'])
    // Le numéro d'une route n'en devient pas un numéro de rue : la réponse à « 96 Route Départementale » est jugée pareil.
    reponses.ban = ban('street', 0.7, { postcode: '13390', city: 'Auriol', street: 'Route Départementale 96' })
    banSelonRecherche['96 Route Départementale 13390 Auriol'] = ban('housenumber', 0.9, { postcode: '13390', city: 'Auriol', housenumber: '96', street: 'Route Départementale 96' })
    expect((await geocoderAdresse(saisie('Route Départementale 96', '13390', 'Auriol'), 'FR'))?.precise).toBe(false)
  })

  it('autres écritures du numéro (26/11/2026) : plage, « n° », numéro après la voie, résidence sans séparateur', async () => {
    // « 10-12 rue de la République » : la BAN rend le 12 (0,815) ; « N° 10 » : le 10 (0,78).
    reponses.ban = ban('housenumber', 0.815, { postcode: '13001', housenumber: '12', street: 'Rue de la republique' })
    expect((await geocoderAdresse(saisie('10-12 rue de la République'), 'FR'))?.precise).toBe(true)
    expect((await geocoderAdresse(saisie('10-14 rue de la République'), 'FR'))?.precise).toBe(false)
    for (const adresse of ['10 - 12 rue de la République', '10, 12 rue de la République', '10–12 rue de la République', '10 & 12 rue de la République', '10 et 12 rue de la République']) {
      expect((await geocoderAdresse(saisie(adresse), 'FR'))?.precise, adresse).toBe(true)
    }
    reponses.ban = ban('housenumber', 0.78, { postcode: '13001', housenumber: '10', street: 'Rue de la republique' })
    for (const adresse of ['N° 10 rue de la République', '10, rue de la République', 'rue de la République 10', 'rue de la République, 10', '2e étage 10 rue de la République', '10, 2e étage, rue de la République']) {
      expect((await geocoderAdresse(saisie(adresse), 'FR'))?.precise, adresse).toBe(true)
    }
    // « Villa » est un type de voie à Paris (« 7 villa Seurat »), pas un complément.
    reponses.ban = ban('housenumber', 0.9, { postcode: '75014', city: 'Paris', housenumber: '7', street: 'Villa Seurat' })
    expect((await geocoderAdresse(saisie('7 villa Seurat', '75014', 'Paris'), 'FR'))?.precise).toBe(true)
    // Immeuble devant la rue, sans virgule : seconde recherche avec la rue seule (0,522 puis 0,97, relevés des 25 et 26/11).
    reponses.ban = ban('housenumber', 0.522, { postcode: '13006', housenumber: '3', street: 'Avenue du prado' })
    banSelonRecherche['3 avenue du Prado 13006 Marseille'] = ban('housenumber', 0.97, { postcode: '13006', lat: 43.2801, lng: 5.3901, housenumber: '3', street: 'Avenue du prado' })
    expect(await geocoderAdresse(saisie('Immeuble Le Méditerranée 3 avenue du Prado', '13006'), 'FR')).toEqual({ latitude: 43.2801, longitude: 5.3901, precise: true })
    // Voie collée au complément qui suit le numéro (troisième relecture) : la BAN réelle rend le 12 rue Saint-Ferréol (0,713).
    reponses.ban = ban('housenumber', 0.713, { postcode: '13001', housenumber: '12', street: 'Rue saint ferreol' })
    expect((await geocoderAdresse(saisie('12, 2e étage rue Saint-Ferréol'), 'FR'))?.precise).toBe(true)
  })

  it('réponse sans voie : imprécis', async () => {
    reponses.ban = ban('housenumber', 0.95, { street: '' })
    expect((await geocoderAdresse(LILAS, 'FR'))?.precise).toBe(false)
    reponses.ban = { corps: { features: [{ geometry: { coordinates: [5.38, 43.25] }, properties: { type: 'housenumber', score: 0.95, postcode: '13008', city: 'Marseille', housenumber: '1' } }] } }
    expect((await geocoderAdresse(LILAS, 'FR'))?.precise).toBe(false)
  })

  it('saisie sans numéro de rue : la rue entière reste admise (comme avant), un numéro trouvé ailleurs dans l’adresse jamais', async () => {
    reponses.ban = ban('street', 0.85, { street: 'Rue des Lilas' })
    expect((await geocoderAdresse({ ...LILAS, adresse: 'rue des Lilas' }, 'FR'))?.precise).toBe(true)
    // « Étage 2, rue Paradis » : la BAN lit « Étage 2 » comme le n° 2 (0,734, relevé du 26/11/2026). Avant : précis.
    reponses.ban = ban('housenumber', 0.734, { postcode: '13001', housenumber: '2', street: 'Rue paradis' })
    for (const adresse of ['Étage 2, rue Paradis', 'rue Paradis, étage 2', 'Bât 2, rue Paradis', 'Lot 2 rue Paradis', 'Appt 2, rue Paradis', 'rue Paradis']) {
      expect((await geocoderAdresse(saisie(adresse), 'FR'))?.precise, adresse).toBe(false)
    }
    // Nombre qui fait partie du nom de la voie, sans numéro de rue : « avenue du 8 Mai 1945 », « Route Départementale 560 ».
    reponses.ban = ban('housenumber', 0.8, { postcode: '13001', housenumber: '8', street: 'Avenue du 8 mai 1945' })
    expect((await geocoderAdresse(saisie('avenue du 8 Mai 1945'), 'FR'))?.precise).toBe(false)
    reponses.ban = ban('street', 0.9, { postcode: '13001', street: 'Avenue du 8 mai 1945' })
    expect((await geocoderAdresse(saisie('avenue du 8 Mai 1945'), 'FR'))?.precise).toBe(true)
    reponses.ban = ban('street', 0.9, { postcode: '13390', city: 'Auriol', street: 'Route Départementale 560' })
    expect((await geocoderAdresse(saisie('Route Départementale 560', '13390', 'Auriol'), 'FR'))?.precise).toBe(true)
    // Le même numéro devant la voie reste un numéro de rue (« 8 avenue du 8 Mai 1945 »).
    reponses.ban = ban('housenumber', 0.9, { postcode: '13001', housenumber: '8', street: 'Avenue du 8 mai 1945' })
    expect((await geocoderAdresse(saisie('8 avenue du 8 Mai 1945'), 'FR'))?.precise).toBe(true)
    // Écrit après la voie, un numéro que le nom contient déjà reste un numéro de rue (« avenue du 8 Mai 1945, 8 »).
    expect((await geocoderAdresse(saisie('avenue du 8 Mai 1945, 8'), 'FR'))?.precise).toBe(true)
    // Nominatim : un bâtiment numéroté, pour une saisie sans numéro de rue, n'est pas le chantier.
    reponses.ban = ban('municipality', 0.9)
    reponses.osm = osm(30, { house_number: '2', road: 'Rue Paradis', postcode: '13001', city: 'Marseille' })
    expect((await geocoderAdresse(saisie('Étage 2, rue Paradis'), 'FR'))?.precise).toBe(false)
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
    // Voie voisine (type oublié) : admise seulement après vérification des voies de la commune par la BAN, pas chez OSM.
    reponses.ban = ban('municipality', 0.9, { postcode: '13001' })
    reponses.osm = osm(30, { house_number: '10', road: 'Rue de la République', postcode: '13001', city: 'Marseille' })
    expect((await geocoderAdresse(saisie('10 République'), 'FR'))?.precise).toBe(false)
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
    // Nom plus long à la fin : refusé ici parce que la commune a aussi la voie au nom court (voir le cas admis plus bas).
    banSelonRecherche.clos = voies(['Rue du Clos', 'Rue Clos Marie-Claire'])
    banSelonRecherche.acacias = voies(['Allée des Acacias', 'Allée des Acacias Bleus'])
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
      // Nombre en plus dans le nom : une autre voie (« avenue du Mai 1945 » n'est pas « avenue du 8 Mai 1945 »).
      ['5 avenue du Mai 1945', '5', 'Avenue du 8 mai 1945'],
    ]
    for (const [adresse, housenumber, street] of cas) {
      reponses.ban = ban('housenumber', 0.7, { postcode: '13001', housenumber, street })
      expect((await geocoderAdresse(saisie(adresse), 'FR'))?.precise, adresse).toBe(false)
    }
    // Seule voie de ce nom dans la commune : le nom complet est admis ; un qualificatif en plus à la fin, jamais.
    banSelonRecherche.acacias = voies(['Allée des Acacias Bleus'])
    reponses.ban = ban('housenumber', 0.7, { postcode: '13001', housenumber: '3', street: 'Allée des Acacias Bleus' })
    expect((await geocoderAdresse(saisie('3 Allée des Acacias'), 'FR'))?.precise).toBe(true)
    banSelonRecherche.pont = voies(['Rue du Pont Neuf'])
    appels = []
    reponses.ban = ban('housenumber', 0.7, { postcode: '13001', housenumber: '5', street: 'Rue du Pont Neuf' })
    expect((await geocoderAdresse(saisie('5 rue du Pont'), 'FR'))?.precise).toBe(false)
    expect(appels.some(a => a.includes('type=street'))).toBe(false)
  })

  it('Portugal inchangé : Nominatim seul, sans comparaison de la voie', async () => {
    reponses.osm = osm(30, { road: 'Rua de Santa Catarina', postcode: '4000-447', city: 'Porto' }, '41.15', '-8.61')
    expect((await geocoderAdresse({ adresse: 'Rua Santa Catarina 100', codePostal: '4000-447', ville: 'Porto' }, 'PT'))?.precise).toBe(true)
    expect(appels).toHaveLength(1)
    // Un numéro rendu par OSM, que les règles françaises refuseraient (numéro de rue non lu à la française) : précis.
    reponses.osm = osm(30, { house_number: '100', road: 'Rua de Santa Catarina', postcode: '4000-447', city: 'Porto' }, '41.15', '-8.61')
    expect((await geocoderAdresse({ adresse: 'Rua de Santa Catarina 100', codePostal: '4000-447', ville: 'Porto' }, 'PT'))?.precise).toBe(true)
  })
})

describe('numeroEtVoieSaisis', () => {
  /** Numéros admis, voie et texte de la seconde recherche. */
  const lu = (rue: string) => {
    const lecture = numeroEtVoieSaisis(rue)
    return lecture && [lecture.numeros.join('|'), lecture.voie, lecture.texte]
  }

  it('rue en un morceau « numéro + nom », ou morceau numéroté d’une adresse à compléments', () => {
    expect(numeroEtVoieSaisis('3 Allée des Acacias')).toEqual({ numero: '3', numeros: ['3'], voie: 'Allée des Acacias', texte: '3 Allée des Acacias' })
    expect(numeroEtVoieSaisis('  4 bis   bd Longchamp ')).toEqual({ numero: '4 bis', numeros: ['4bis'], voie: 'bd Longchamp', texte: '4 bis bd Longchamp' })
    expect(numeroEtVoieSaisis('Résidence Le Parc, 10 rue de la République')?.texte).toBe('10 rue de la République')
  })

  it('autres écritures (26/11/2026) : virgule après le numéro, « n° », plage, indice, résidence sans séparateur, numéro après la voie', () => {
    expect(lu('10, rue des Lilas')).toEqual(['10', 'rue des Lilas', '10 rue des Lilas'])
    expect(lu('Résidence Le Lac, 10, rue des Lilas')).toEqual(['10', 'rue des Lilas', '10 rue des Lilas'])
    expect(lu('Le Méditerranée, 3 bis, avenue du Prado')).toEqual(['3bis', 'avenue du Prado', '3 bis avenue du Prado'])
    expect(lu('N° 10 rue de la République')).toEqual(['10', 'rue de la République', '10 rue de la République'])
    expect(lu('n°10, rue de la République')).toEqual(['10', 'rue de la République', '10 rue de la République'])
    expect(lu('10-12 rue de la République')).toEqual(['10|12', 'rue de la République', '10-12 rue de la République'])
    expect(lu('10 à 12 rue de la République')).toEqual(['10|12', 'rue de la République', '10 à 12 rue de la République'])
    expect(lu('12B rue des Lilas')).toEqual(['12b', 'rue des Lilas', '12B rue des Lilas'])
    expect(lu('12 B rue des Lilas')).toEqual(['12b', 'rue des Lilas', '12 B rue des Lilas'])
    expect(lu('Immeuble Le Méditerranée 3 avenue du Prado')).toEqual(['3', 'avenue du Prado', '3 avenue du Prado'])
    expect(lu('Résidence Les 4 Cours 10 rue Paradis')).toEqual(['10', 'rue Paradis', '10 rue Paradis'])
    expect(lu('Lot 5 12 rue des Lilas')).toEqual(['12', 'rue des Lilas', '12 rue des Lilas'])
    expect(lu('rue de la République 10')).toEqual(['10', 'rue de la République', '10 rue de la République'])
    expect(lu('rue de la République, 10')).toEqual(['10', 'rue de la République', '10 rue de la République'])
    expect(lu('rue de la République n° 10')).toEqual(['10', 'rue de la République', '10 rue de la République'])
    expect(lu('Lieu-dit Les Granges 2')).toEqual(['2', 'Lieu-dit Les Granges', '2 Lieu-dit Les Granges'])
    // Relecture du 26/11/2026 : plage en deux morceaux, tirets typographiques, « & », « et », étage déjà numéroté, villa.
    expect(lu('10 - 12 rue de la République')).toEqual(['10|12', 'rue de la République', '10-12 rue de la République'])
    expect(lu('10, 12 rue de la République')).toEqual(['10|12', 'rue de la République', '10-12 rue de la République'])
    expect(lu('10 – 12 rue de la République')).toEqual(['10|12', 'rue de la République', '10-12 rue de la République'])
    expect(lu('10–12 rue de la République')).toEqual(['10|12', 'rue de la République', '10–12 rue de la République'])
    expect(lu('10 & 12 rue de la République')).toEqual(['10|12', 'rue de la République', '10 & 12 rue de la République'])
    expect(lu('Résidence Les Pins 10 à 12 rue de la République')).toEqual(['10|12', 'rue de la République', '10 à 12 rue de la République'])
    expect(lu('2e étage 10 rue de la République')).toEqual(['10', 'rue de la République', '10 rue de la République'])
    expect(lu('Bâtiment B n° 3 rue de la République')).toEqual(['3', 'rue de la République', '3 rue de la République'])
    expect(lu('7 villa Seurat')).toEqual(['7', 'villa Seurat', '7 villa Seurat'])
    // Contre-relecture du 26/11/2026 : complément sauté après un numéro seul, mot du nom de la voie après un article, étage
    // déjà numéroté en abrégé.
    expect(lu('12, 2e étage, rue Paradis')).toEqual(['12', 'rue Paradis', '12 rue Paradis'])
    expect(lu('12, Résidence Les Pins, rue Paradis')).toEqual(['12', 'rue Paradis', '12 rue Paradis'])
    expect(lu('12, Bât B, rue Paradis')).toEqual(['12', 'rue Paradis', '12 rue Paradis'])
    expect(lu('rue de la Tour 5')).toEqual(['5', 'rue de la Tour', '5 rue de la Tour'])
    expect(lu('rue du Lot 8')).toEqual(['8', 'rue du Lot', '8 rue du Lot'])
    expect(lu('2e ét. 12 avenue Foch')).toEqual(['12', 'avenue Foch', '12 avenue Foch'])
    expect(lu('1er étg 12 rue Paradis')).toEqual(['12', 'rue Paradis', '12 rue Paradis'])
    // Troisième relecture du 26/11/2026 : voie collée au complément qui suit un numéro seul ; type de voie précédé d'un
    // article, nom d'une résidence ; initiale suivie d'un point (« B. ») : pas un mot abrégé ; article élidé après la voie.
    expect(lu('12, 2e étage rue Saint-Ferréol')).toEqual(['12', 'rue Saint-Ferréol', '12 rue Saint-Ferréol'])
    expect(lu('12, Bât B rue Paradis, Marseille')).toEqual(['12', 'rue Paradis', '12 rue Paradis'])
    expect(lu('12, Résidence Les Allées du Parc, rue Paradis')).toEqual(['12', 'rue Paradis', '12 rue Paradis'])
    expect(lu('Bât. B. 12 rue Paradis')).toEqual(['12', 'rue Paradis', '12 rue Paradis'])
    expect(lu('rue de l\'Îlot 3')).toEqual(['3', 'rue de l\'Îlot', '3 rue de l\'Îlot'])
  })

  it('pas de numéro de rue : null (le numéro d’un bâtiment, d’un lot, d’un étage ou d’un kilomètre n’en est pas un)', () => {
    expect(numeroEtVoieSaisis('rue des Lilas')).toBeNull()
    expect(numeroEtVoieSaisis('Bât 3, avenue du Prado')).toBeNull()
    expect(numeroEtVoieSaisis('2 étage')).toBeNull()
    expect(numeroEtVoieSaisis('3 bis')).toBeNull()
    expect(numeroEtVoieSaisis('')).toBeNull()
    expect(numeroEtVoieSaisis('Étage 2, rue Paradis')).toBeNull()
    expect(numeroEtVoieSaisis('rue Paradis, étage 2')).toBeNull()
    expect(numeroEtVoieSaisis('bâtiment 3 avenue du Prado')).toBeNull()
    expect(numeroEtVoieSaisis('Lot 12 rue de la République')).toBeNull()
    expect(numeroEtVoieSaisis('chemin de Saint-Pierre, Lot 5')).toBeNull()
    expect(numeroEtVoieSaisis('Route de Marseille km 12')).toBeNull()
    expect(numeroEtVoieSaisis('Résidence Les 4 Cours')).toBeNull()
    // Relecture du 26/11/2026 : « n° » ou ponctuation entre le complément et son numéro, abréviations, cadastre.
    for (const rue of [
      'Lot n° 2 rue Paradis', 'rue Paradis Lot n° 2', 'Lot : 2 rue Paradis', 'Lot: 2 rue Paradis', 'Lot no 12 rue Paradis',
      'Lot numéro 12 rue Paradis', 'Lotissement Les Oliviers Lot n° 12 rue de la République', 'Bât n° 3 avenue du Prado',
      'Appt n° 21 rue Paradis', 'Appart 2 rue Paradis', 'Bt 3 avenue du Prado', 'Ét. 2 rue Paradis', 'Log. 12 rue Paradis',
      'Parcelle cadastrée section B n° 10 rue de la République', 'Terrain cadastré AB 12 avenue du Prado',
      // Contre-relecture du 26/11/2026.
      'Lotissement Les Oliviers Lot n°: 12 rue de la République', 'Lot n ° 12 rue Paradis', 'Lot Nr 12 rue Paradis',
      'Lot / 12 rue Paradis', 'Référence cadastrale AB 12 rue de la République', 'Réf. cadastrale AB 12 rue Paradis',
      'Résidence Le Parc Lgt 12 rue de la République', 'Niv. 2 rue Paradis', 'Tour 5, rue Paradis',
      // Troisième relecture du 26/11/2026 : logements, portes, locaux abrégés ou non, mot abrégé inconnu, « num », complément
      // précédé d'un article au milieu d'un morceau (le lot 12, pas la rue du Lot), article élidé.
      'Résidence Les Pins Logt 12 rue Paradis', 'Logt. 12 rue Paradis', 'Logt n° 12 rue Paradis', 'LOGT 12 rue Paradis',
      'Lot num 12 rue Paradis', 'Résidence Le Parc Ap. 12 rue Paradis', 'Résidence Le Parc Ap 12 rue Paradis',
      'Pte 12 rue Paradis', 'Pav. 3 rue Paradis', 'Pav 3 rue Paradis',
      'Chbre 12 rue Paradis', 'Cellule 3 rue Paradis', 'Local commercial 3 rue Paradis', 'Tranche 3 rue Paradis',
      'Îlot 3 rue Paradis', 'Résidence Le Parc Empl. 12 rue Paradis', 'Terrain du lot 12 rue Paradis',
      'Construction sur le lot 12 rue Paradis', 'Le Lot 12 rue Paradis', 'Résidence Le Parc le Bâtiment 3 rue Paradis',
      'à l\'étage 2 rue Paradis', 'Résidence de la Tour 12 avenue Foch',
      // Quatrième relecture du 26/11/2026 : plage ou suite de numéros d'un complément (la seconde borne n'est pas le numéro
      // de rue), au pluriel, d'un morceau à l'autre ; commerces, hébergements, phases, parties d'une copropriété.
      'Lotissement Les Oliviers lots 12 à 14 rue Paradis', 'Lot 12 au 14 rue Paradis', 'Lots n° 12 à 14 rue Paradis',
      'Lot n°12 à n°14 rue Paradis', 'Bâtiments 3 & 4 avenue du Prado', 'Box 3 / 4 rue Paradis', 'Lgts 1 à 6 rue Paradis',
      'Locaux 3 à 5 rue Paradis', 'Caves 12 au 14 rue Paradis', 'Parkings 12 à 14 rue Paradis', 'lots 12 13 14 rue Paradis',
      'lots 12 ou 14 rue Paradis', 'lots 12 + 14 rue Paradis', 'lots 12 jusqu\'au 14 rue Paradis', 'Lots 12, 13, 14 rue Paradis',
      'Lots 12 - 14 rue Paradis', 'rue Paradis lot 12 à 14', 'Résidence Les Pins Magasin 12 rue Paradis',
      'Centre Les Arcades Boutique 12 avenue de la Gare', 'Camping Les Pins Bungalow 12 route de la Plage',
      'Lotissement Le Clos Phase 2 rue Paradis', 'Terrain 12 rue Paradis', 'Unité 3 rue Paradis', 'Module 3 rue Paradis',
      'Mobil-home 12 rue Paradis', 'Mobil home 12 rue Paradis', 'Duplex 12 rue Paradis', 'Secteur 3 rue Paradis',
      'Lot de copropriété n° 12 rue Paradis', 'Salle 3 rue Paradis', 'Stand 3 rue Paradis', 'Magasins 3 rue Paradis',
      'Niveaux 2 rue Paradis',
      // Cinquième relecture du 26/11/2026 : autres écritures d'une plage ou d'une énumération de lots ; partie numérotée d'une
      // zone ; refus voulus, du côté sûr (« au 12 » et « 3 A » ont la forme d'une plage, « Bâtiments 1 et 2, 12 » celle
      // d'une énumération).
      'Lotissement Les Oliviers lots du 12 au 14 rue Paradis', 'Lot du 12 au 14 rue Paradis', 'lots numéros 12 à 14 rue Paradis',
      'lots nos 12 à 14 rue Paradis', 'lots n°s 12 à 14 rue Paradis', 'Lots 12 jusqu\'à 14 rue Paradis', 'Lots 12 jusqu’à 14 rue Paradis',
      'Lots 12 jusque 14 rue Paradis', 'Lots 12 jusqu au 14 rue Paradis', 'lots 12 bis à 14 rue Paradis', 'lots 12- 14 rue Paradis',
      'lots 12/ 14 rue Paradis', 'Lotissement Les Oliviers, Lot 12, 13 et 14 rue Paradis', 'Lot 12, 13, 14 rue Paradis',
      'Lot 12 - 13 - 14 rue Paradis', 'Lots 12, 13 et 14 rue Paradis', 'Lots 12, 14 à 16 rue Paradis',
      'Lots 12 à 14, 16 et 18 rue Paradis', 'Lots 12, 13 et 14, 15 rue Paradis', 'Zone 3 rue Paradis', 'Bât 3 A 10 rue Paradis',
      'Bât 3 et 4 au 12 rue Paradis', 'Bâtiments 1 et 2, 12 rue Paradis', 'Lot 12- 14 rue Paradis', '12 Zone B',
      `Lots ${Array.from({ length: 100 }, (_, i) => i + 1).join(' à ')} rue Paradis`,
      // Au-delà de 200 caractères (ce que la BAN lit), aucune lecture.
      `Résidence ${'Les Pins '.repeat(25)}12 rue Paradis`,
      // Sixième relecture du 27/11/2026 : préposition devant d'autres écritures d'une plage ; « jusqu' au » ; suite finie
      // par une plage d'un bloc ou un indice ; énumération écrite après la voie ; « Boxes » ; complément collé ; texte en NFD ;
      // zone lue comme voie à côté d'une rue ; refus voulus du côté sûr (« rue Paradis lot 12, 13 », « Bât 3, 12 »).
      'Lots du 12 a 14 rue Paradis', 'Lots de 12 a 14 rue Paradis', 'Lot du 12 a 14 rue Paradis', 'Lots du 12 jusqu\'au 14 rue Paradis',
      'Lots du 12 ou 14 rue Paradis', 'Lots du 12 + 14 rue Paradis', 'Lots du n° 12 au n° 14 rue Paradis', 'Lots du n°12 au n°14 rue Paradis',
      'Lots des n°12 et n°14 rue Paradis', 'Lots du 12 - 14 rue Paradis', 'Lots 12 jusqu\' au 14 rue Paradis', 'Lots 12 jusqu\'aux 14 rue Paradis',
      'Lots 12-14, 16 rue Paradis', 'Lots 12/14, 16 rue Paradis', 'Lots 12, 13-14, 16 rue Paradis', 'Lots 12-14 16 rue Paradis',
      'Lots 12-14 & 16 rue Paradis', 'Lots 12-14 ou 16 rue Paradis', 'Lots 12 à 14 bis, 16 rue Paradis', 'Lots 12 bis, 14 rue Paradis',
      'Lots 12 B, 14 rue Paradis', 'rue Paradis lot 12, 13, 14', 'rue Paradis lot 12, 13 et 14', 'chemin des Vignes lot 3, 4 et 5',
      'rue Paradis Garages 3, 4', 'rue Paradis lot 12, 13', 'rue Paradis Bât 3, 12', 'Boxes 3 et 4 rue Paradis', 'Les boxes 3, 4 rue Paradis',
      'Lots12 à 14 rue Paradis', 'Lots 12 à 14 rue Paradis'.normalize('NFD'), '2, Zone Industrielle, rue Gay Lussac',
      // Huitième relecture du 27/11/2026 : après une préposition, une suite qui ne grandit pas reste une suite de lots (« 12 »
      // puis « 12 bis », suite décroissante) ; après une année, un numéro plus grand la continue (refus voulu, rare).
      'Lots du 12 - 12 bis rue Paradis', 'Lots du 12, 12 bis rue Paradis', 'Lots du 12 - 12B rue Paradis', 'Lots du 12A - 12B rue Paradis',
      'Lots du 12 bis - 12 ter rue Paradis', 'Maisons du 12 - 12 bis rue Paradis', 'Lots du 14, 12 rue Paradis',
      'Lots des 14, 12 et 10 rue Paradis', 'Lot du 14, 12, 13 rue Paradis', 'Logements de 1975, 2050 route de Grasse',
      // Neuvième relecture du 27/11/2026 : les mêmes suites tapées avec de simples espaces, ou avec un point collé au numéro.
      'Lots du 12 12 bis rue de la Gare', 'Lots du 12A 12B rue de la Gare', 'Lots des 14 12 et 10 rue Paradis', 'Lots du 12 14 rue Paradis',
      'Lots du 12 14, 16 rue Paradis', 'Lots du 12 : 12 bis rue Paradis', 'Lotissement Les Oliviers, lots du 12 14 rue Paradis',
      'Logements de 1975 2050 route de Grasse', 'Appartements du 12 14 rue Paradis', 'Lots 12. 14 rue Paradis', 'Lots 12. 13. 14 rue Paradis',
      'Lots du 12. 12 bis rue Paradis', 'Lots n° 12. 14 rue Paradis',
      // Dixième relecture du 27/11/2026 : complément collé à son numéro devant une ponctuation, deux-points collé.
      'Lots12, 14 rue Paradis', 'Lots12. 14 rue Paradis', 'Lots12, 13 et 14 rue Paradis', 'Lots12,14 rue Paradis', 'Lots 12: 14 rue Paradis',
      'Lots12: 14 rue Paradis', 'Bâts3, 12 rue Paradis',
      // Onzième relecture : seconde borne collée à son tiret dans une suite de compléments ; complément autre qu'un étage
      // numéroté entre le numéro et la voie (son numéro n'est pas celui de la rue).
      'Lots 12 -14, 16 rue Paradis', 'Lots 12 -14 rue Paradis', 'Bât 3 -4 rue Paradis', 'Appt 12 -14 rue Paradis',
      '2 étage rue Paradis', '3 bât. B rue Paradis', '12 3e étage',
    ]) expect(numeroEtVoieSaisis(rue), rue.slice(0, 60)).toBeNull()
    // Témoins : préposition d'un seul numéro, singuliers en s ou x, zones nommées (voies de la BAN), zone numérotée sautée.
    for (const [rue, texte] of <Array<[string, string]>>[
      ['Bâtiment du 12 rue Paradis', '12 rue Paradis'], ['Box 3, 12 rue Paradis', '12 rue Paradis'], ['Duplex 3, 12 rue Paradis', '12 rue Paradis'],
      ['Rés 2000, 12 rue Paradis', '12 rue Paradis'], ['Bât 3, 12, rue Paradis', '12 rue Paradis'], ['2 Zone Artisanale du Bosc', '2 Zone Artisanale du Bosc'],
      ['3 Zone Industrielle', '3 Zone Industrielle'], ['2 Terrain d\'Aviation', '2 Terrain d\'Aviation'], ['12, Zone Artisanale du Bosc', '12 Zone Artisanale du Bosc'],
      ['12, Zone B, rue Paradis', '12 rue Paradis'], ['Bât 3 B 10 rue Paradis', '10 rue Paradis'],
      // Sixième relecture : la plage d'un immeuble entier est celle de la rue ; nombre du nom de la voie, puis numéro.
      ['Immeuble du 10-12 rue Paradis', '10-12 rue Paradis'], ['Copropriété du 2 au 4 rue Paradis', '2 au 4 rue Paradis'],
      ['avenue du 8 Mai 1945, 8', '8 avenue du 8 Mai 1945'], ['Route Départementale 96, 12', '12 Route Départementale 96'],
      // Septième et huitième relectures : une année n'ouvre pas une plage de lots que le numéro suivant ne prolonge pas.
      ['Logements de 1975, 12 rue Paradis', '12 rue Paradis'], ['Maison de 1930, 10-12 rue Paradis', '10-12 rue Paradis'],
      ['Maisons de 1890, 4 bis rue Paradis', '4 bis rue Paradis'], ['Logements de 2005, 12 rue Paradis', '12 rue Paradis'],
      // Neuvième relecture : sans virgule ; au singulier, le second numéro est celui de la rue ; point collé à un numéro.
      ['Logements de 1975 12 rue Paradis', '12 rue Paradis'], ['Maison de 1930 10-12 rue Paradis', '10-12 rue Paradis'],
      ['Lot du 12 14 rue Paradis', '14 rue Paradis'], ['Immeuble du 12 14 rue Paradis', '14 rue Paradis'],
      ['12. rue Paradis', '12 rue Paradis'], ['Bât. 3. 12 rue Paradis', '12 rue Paradis'], ['Lot 12. 14 rue Paradis', '14 rue Paradis'],
      ['12 av. du Prado', '12 av. du Prado'], ['5 av. du Gal. Leclerc', '5 av. du Gal. Leclerc'], ['Rés. Les Pins 12 rue Paradis', '12 rue Paradis'],
      // Dixième relecture : deux numéros devant la voie, c'est le second qui la porte (la BAN le rend) ; numéro de liste ;
      // complément collé au singulier ; deux-points collé ; ponctuation de tête.
      ['12 14 rue Paradis', '14 rue Paradis'], ['1 3 place du Capitole', '3 place du Capitole'], ['150 152 avenue du Prado', '152 avenue du Prado'],
      ['1, Résidence Le Parc, 12 rue Paradis', '12 rue Paradis'], ['1. Résidence Le Parc, 12 rue Paradis', '12 rue Paradis'],
      ['Lot12, 14 rue Paradis', '14 rue Paradis'], ['Bât3, 12 rue Paradis', '12 rue Paradis'], ['Rés2000, 12 rue Paradis', '12 rue Paradis'],
      ['12: rue Paradis', '12 rue Paradis'], ['- 1 rue des Lilas', '1 rue des Lilas'], ['• 12 rue Paradis', '12 rue Paradis'],
      // Onzième relecture : voie qui commence par un ordinal ; seconde borne collée à son tiret ; étage numéroté entre le
      // numéro et la voie, sans virgule.
      ['3 1ère Avenue', '3 1ère Avenue'], ['3, 1ère Avenue', '3 1ère Avenue'], ['3 2ème Avenue', '3 2ème Avenue'], ['5 1ere Avenue', '5 1ere Avenue'],
      ['12 -14 rue Paradis', '12 -14 rue Paradis'], ['12 –14 rue Paradis', '12 –14 rue Paradis'],
      ['12 3e étage rue Paradis', '12 rue Paradis'], ['12 1er étage, rue Paradis', '12 rue Paradis'], ['12 1er étage rue Paradis', '12 rue Paradis'],
      ['12 3e étage gauche, rue Paradis', '12 rue Paradis'], ['1 12-14 rue Paradis', '12-14 rue Paradis'],
      // Un type de voie précédé d'un article est un nom de résidence, pas la voie (« Les Allées du Parc »).
      ['12 3e étage Les Allées du Parc, rue Paradis', '12 rue Paradis'],
    ]) expect(numeroEtVoieSaisis(rue)?.texte, rue).toBe(texte)
    // Témoins : au singulier, le numéro qui suit celui du complément est celui de la rue.
    expect(numeroEtVoieSaisis('Lot 5 12 rue des Lilas')?.texte).toBe('12 rue des Lilas')
    expect(numeroEtVoieSaisis('Lot 5, 12 rue des Lilas')?.texte).toBe('12 rue des Lilas')
    expect(numeroEtVoieSaisis('Bât 3 10 à 12 rue des Lilas')?.numeros).toEqual(['10', '12'])
  })

  it('voie collée à un complément : seulement si aucun morceau suivant ne commence par un type de voie (quatrième relecture)', () => {
    for (const rue of ['12, Résidence Villa Médicis, rue Paradis', '12, Résidence Square Monge, rue Paradis', '12, Résidence Le Parc Allée B, rue Paradis']) {
      expect(numeroEtVoieSaisis(rue)?.texte, rue).toBe('12 rue Paradis')
    }
    // Un lieu-dit écrit à la suite ne retire pas la voie collée.
    expect(numeroEtVoieSaisis('12, Bât B route de Lyon, Lieu-dit La Plaine')?.texte).toBe('12 route de Lyon')
    // Un type de voie précédé d'un article est un nom de résidence, pas une voie collée.
    expect(numeroEtVoieSaisis('12, Résidence Les Allées du Parc')).toBeNull()
    // Un complément qui commence par un type de voie n'est pas une voie nommée (cinquième relecture).
    for (const fin of ['Allée B', 'Villa 3', 'Place 14']) {
      expect(numeroEtVoieSaisis(`12, Résidence Le Parc rue Paradis, ${fin}`)?.texte, fin).toBe('12 rue Paradis')
    }
  })
})

describe('rueSansComplements', () => {
  const rue = (texte: string) => rueSansComplements(texte)?.texte ?? null

  it('garde le morceau qui commence par le numéro de rue ; résidence, bâtiment, immeuble et étage retirés, avant ou après', () => {
    expect(rueSansComplements('Résidence Les Pins, 10 rue de la République')).toEqual({ numero: '10', numeros: ['10'], voie: 'rue de la République', texte: '10 rue de la République' })
    expect(rue('Bât B, Résidence Le Parc, 10 rue de la République, Étage 2 Apt 3')).toBe('10 rue de la République')
    expect(rue('10 rue de la République, Étage 2 Apt 3')).toBe('10 rue de la République')
    expect(rue('Les Terrasses du Port - 12 quai du Port')).toBe('12 quai du Port')
    expect(rueSansComplements('Résidence 2000;  4 bis   allée des Pins')).toEqual({ numero: '4 bis', numeros: ['4bis'], voie: 'allée des Pins', texte: '4 bis allée des Pins' })
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
    // « 3 bis, avenue du Prado » : « bis » est l'indice du numéro, pas une voie.
    expect(rue('Le Méditerranée, 3 bis, avenue du Prado')).toBe('3 bis avenue du Prado')
  })

  it('adresse réduite au numéro et à la voie, ou sans numéro de rue : null (rien à retirer)', () => {
    expect(rue('10 rue de la République')).toBeNull()
    expect(rue('10, rue de la République')).toBeNull()
    expect(rue('N° 10 rue de la République')).toBeNull()
    // Numéro après la voie, sans complément : pas réécrit (« Route Départementale 96 » : 96 est le numéro de la route).
    expect(rue('rue de la République 10')).toBeNull()
    expect(rue('rue de la République, 10')).toBeNull()
    expect(rue('rue de la République; 10')).toBeNull()
    expect(rue('10 - 12 rue de la République')).toBeNull()
    expect(rue('Route Départementale 96')).toBeNull()
    expect(rue('Résidence Les Pins, rue de la République 10')).toBe('10 rue de la République')
    expect(rue('bâtiment 3 avenue du Prado')).toBeNull()
    expect(rue('Lotissement Les Oliviers, chemin de la Source')).toBeNull()
    expect(rue('Résidence Les Pins, Bât B')).toBeNull()
    expect(rue('')).toBeNull()
  })

  it('virgule après le numéro, résidence sans séparateur (26/11/2026, avant : première recherche seule)', () => {
    expect(rue('Résidence Le Lac, 10, rue des Lilas')).toBe('10 rue des Lilas')
    expect(rue('Immeuble Le Méditerranée 3 avenue du Prado')).toBe('3 avenue du Prado')
    expect(rue('Résidence Les Pins 10 rue de la République')).toBe('10 rue de la République')
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
    // Séparateur final d'un en-tête de devis (tiret long de Word, puce, deux-points, barre), collé ou importé (onzième
    // relecture du 27/11/2026) ; la parenthèse fermante reste ; au Portugal, rien ne change.
    for (const separateur of ['–', '—', '•', ':', '/']) {
      expect(decomposerAdresse({ adresse: `12 rue Paradis ${separateur} 13001 Marseille` }, 'FR'), separateur).toEqual({ rue: '12 rue Paradis', codePostal: '13001', ville: 'Marseille' })
    }
    expect(decomposerAdresse({ adresse: '12 rue Paradis –', codePostal: '13001', ville: 'Marseille' }, 'FR').rue).toBe('12 rue Paradis')
    expect(decomposerAdresse({ adresse: '« 12 rue Paradis »' }, 'FR').rue).toBe('12 rue Paradis')
    expect(decomposerAdresse({ adresse: '12 rue Paradis (Bât B)' }, 'FR').rue).toBe('12 rue Paradis (Bât B)')
    expect(decomposerAdresse({ adresse: 'Rua de Santa Catarina 100 –', ville: 'Porto' }, 'PT').rue).toBe('Rua de Santa Catarina 100 –')
  })

  it('noms de lieux comparables : accents, casse, tirets, « St » / « Ste »', () => {
    expect(normaliserLieu('Saint-Étienne')).toBe(normaliserLieu('st etienne'))
    expect(normaliserLieu('Sainte-Maxime')).toBe(normaliserLieu('Ste Maxime'))
    expect(normaliserLieu('Águeda')).toBe('agueda')
    // Ligatures (huitième relecture du 27/11/2026) : la forme NFD garde « œ » et « æ ».
    expect(normaliserLieu('Marcq-en-Barœul')).toBe(normaliserLieu('Marcq-en-Baroeul'))
    expect(normaliserLieu('Rue des Œillets')).toBe('rue des oeillets')
    expect(normaliserLieu('Lætitia')).toBe('laetitia')
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
