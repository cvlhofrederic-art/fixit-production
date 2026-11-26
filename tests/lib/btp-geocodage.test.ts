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
/** Une voie rendue par la BAN à une recherche de voies (type=street). */
const voieBan = (name: string, postcode: string, city: string, oldcity?: string) =>
  ({ geometry: { coordinates: [5.38, 43.25] }, properties: { type: 'street', score: 0.69, name, street: name, postcode, city, oldcity } })
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
      ['autre type', ban('housenumber', 0.611, { postcode: '13400', city: 'Aubagne', housenumber: '15', street: 'Boulevard Jean Jaures' }),
        'jean jaures', voies(['Boulevard Jean Jaures'], { postcode: '13400', city: 'Aubagne' }), saisie('15 av Jean Jaurès', '13400', 'Aubagne'), true],
      // Nom double officiel (Marseille) : la BAN rend « Rue de la paix marcel paul », seule voie de ce nom dans le 13001.
      ['nom plus long', PAIX, 'paix', voies(['Rue de la paix marcel paul']), saisie('4 rue de la Paix'), true],
      // Sans code postal : la ville est ajoutée à la recherche des voies, et vérifiée.
      ['sans code postal', PAIX, 'paix Marseille', voies(['Rue de la paix marcel paul']), { adresse: '4 rue de la Paix', ville: 'Marseille' }, true],
      ['sans code postal, autre ville', PAIX, 'paix Marseille', voies(['Rue de la paix marcel paul'], { city: 'Aubagne' }), { adresse: '4 rue de la Paix', ville: 'Marseille' }, false],
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
    expect(recherchesDeVoies.map(rechercheBan)).toEqual(['republique', 'jean jaures', 'paix', 'paix Marseille', 'paix Marseille', 'alesia', 'seurat', 'tourny', 'mimosas', 'tourny', 'republique'])
    expect(recherchesDeVoies[0]).toContain('&postcode=13001')
    expect(recherchesDeVoies[0]).not.toContain('citycode=')
    expect(recherchesDeVoies[3]).not.toContain('postcode=')
    expect(recherchesDeVoies[10]).toContain('&limit=50&postcode=13001&citycode=13201')
  })

  it('voie voisine refusée quand la commune a une autre voie qui répond à la saisie, ou si la vérification échoue', async () => {
    await jugerVoisins([
      ['deux voies Victor Hugo', ban('housenumber', 0.7, { postcode: '13001', housenumber: '10', street: 'Avenue Victor Hugo' }),
        'victor hugo', voies(['Avenue Victor Hugo', 'Place Victor Hugo']), saisie('10 Victor Hugo'), false],
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
    // a trois, avec ou sans numéro (avant : précise, à 3 à 5 km peut-être du chantier).
    reponses.osm = osm(30, { house_number: '1', road: 'Place de l\'Église', postcode: '49600', village: 'Andrezé', municipality: 'Beaupréau-en-Mauges' })
    expect((await geocoderAdresse(saisie('1 place de l\'Église', '49600', 'Beaupréau-en-Mauges'), 'FR'))?.precise).toBe(false)
    reponses.ban = ban('municipality', 0.9, { postcode: '49600', city: 'Beaupréau-en-Mauges' })
    reponses.osm = osm(26, { road: 'Place de l\'Église', postcode: '49600', village: 'Andrezé', municipality: 'Beaupréau-en-Mauges' })
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
    reponses.osm = osm(27, { road: 'Place de l\'Église', postcode: '49120', village: 'La Jumellière', municipality: 'Chemillé-en-Anjou' })
    banSelonRecherche.eglise = voies(['Place de l\'Église de la Jumellière', 'Place de l\'Église de Cossé', 'Place de l\'Eglise de Sainte-Christine'], chemille)
    expect((await geocoderAdresse(saisie('place de l\'Église', '49120', 'Chemillé-en-Anjou'), 'FR'))?.precise).toBe(false)
    // Témoin : une seule voie qui prolonge le nom (« Rue de la Mairie de Saint-Lézin », à 40 m du point OSM).
    reponses.osm = osm(27, { road: 'Rue de la Mairie', postcode: '49120', village: 'Saint-Lézin', municipality: 'Chemillé-en-Anjou' })
    banSelonRecherche.mairie = voies(['Rue de la Mairie de Saint-Lézin'], chemille)
    expect((await geocoderAdresse(saisie('rue de la Mairie', '49120', 'Chemillé-en-Anjou'), 'FR'))?.precise).toBe(true)
    // Doublon de la BAN (même nom, même commune déléguée, à 25 m) : une seule voie, l'adresse juste reste précise.
    reponses.ban = ban('housenumber', 0.769, { postcode: '49490', city: 'Noyant-Villages', oldcity: 'Noyant', housenumber: '1', street: 'Place de l\'église saint martin (Noyant)' })
    banSelonRecherche['eglise saint martin'] = voies(['Place de l\'église saint martin (Noyant)', 'Place De l\'Eglise Saint Martin (Noyant)'], { postcode: '49490', city: 'Noyant-Villages' })
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
    ]) expect(numeroEtVoieSaisis(rue), rue).toBeNull()
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
