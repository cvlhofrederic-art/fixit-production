// ── Dictionnaire matériaux : recherche manuelle ──────────────────────────────
//
// L'artisan tape un mot-clé (« infiltracao fachada », « silicone », « espatula dentada ») et obtient
// les situations et les matériaux qui correspondent. La recherche ignore la casse, les accents, les
// pluriels courants et une faute de frappe par mot ; elle reconnaît un mot en cours de saisie.
// Une taille ou une contenance tapée (« 6 mm », « 280 ml ») départage les résultats sans en écarter.
// Tout se fait dans le navigateur, sur les données du dictionnaire : aucun appel réseau.

import type { Dictionnaire, Materiau, MateriauDeSituation, Situation } from './types'

export type LangueRecherche = Dictionnaire['langue']

/** Minuscules, sans accents ni ponctuation, espaces simples ; « m² » s'écrit « m2 », comme on le tape. */
export function normaliser(texte: string): string {
  return texte
    .toLowerCase()
    .replaceAll('²', '2')
    .replaceAll('³', '3')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// Mots vides de chaque langue, déjà normalisés. Un dictionnaire n'applique que ceux de sa langue : en portugais,
// « lã » (laine) se normalise en « la », qui n'y est pas un mot vide.
const MOTS_VIDES: Readonly<Record<LangueRecherche, ReadonlySet<string>>> = {
  pt: new Set([
    'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas', 'de', 'da', 'do', 'das', 'dos', 'em', 'na', 'no', 'nas', 'nos',
    'e', 'ou', 'com', 'para', 'por', 'pelo', 'pela', 'que', 'se', 'ao', 'aos', 'como',
  ]),
  fr: new Set([
    'a', 'le', 'la', 'les', 'un', 'une', 'de', 'du', 'des', 'en', 'dans', 'et', 'ou', 'avec', 'pour', 'par', 'sur', 'au',
    'aux', 'qui', 'que', 'se',
  ]),
}

// Unités de mesure qu'on tape collées au nombre (« 6mm », « 280ml », « 15l », « 50m », « 750g ») : séparées pour se
// comparer aux données, où le nombre et l'unité sont deux mots (« 15 L »). Une unité d'une lettre tombe ensuite avec
// les lettres isolées : le nombre seul reste, comme pour « 15 l ».
const MESURE_COLLEE = /^(\d+)(mm2|mm|cm|ml|cl|kg|lt|m2|m3|l|m|g)$/
const UNITES: ReadonlySet<string> = new Set(['mm', 'cm', 'ml', 'cl', 'kg', 'lt', 'mm2', 'm2', 'm3'])

/** Au plus autant de mots utiles par saisie : un texte collé dans la recherche ne fige pas l'écran. */
export const MOTS_RECHERCHE_MAX = 12

/**
 * Points qu'une mesure non exigée ajoute au plus à une fiche, où qu'elle la trouve : elle départage, elle ne classe
 * pas (« parafuso MM », pour métal-métal, ne passe pas devant les brocas quand on tape « brocas 6 mm »).
 */
export const POINTS_MESURE_MAX = 1

/** Un nombre ou une unité : il départage les résultats mais n'est jamais exigé. */
export function estMesure(mot: string): boolean {
  return /^\d+$/.test(mot) || UNITES.has(mot)
}

/** Forme de comparaison d'un mot : pluriels portugais et français courants ramenés au singulier. */
export function racine(mot: string): string {
  if (mot.length < 4) return mot
  if (mot.endsWith('oes') || mot.endsWith('aes')) return `${mot.slice(0, -3)}ao`
  if (mot.endsWith('eis') && mot.length > 4) return `${mot.slice(0, -3)}el`
  if (mot.endsWith('ais') && mot.length > 4) return `${mot.slice(0, -3)}al`
  if (mot.endsWith('s')) return mot.slice(0, -1)
  if (mot.endsWith('x') && mot.length > 4) return mot.slice(0, -1)
  return mot
}

/**
 * Mots utiles d'un texte : normalisés, sans mots vides de la langue ni lettres isolées (un chiffre seul compte :
 * « 8 mm »), mesures collées séparées (« 6mm » → « 6 », « mm »), au singulier.
 */
export function motsUtiles(texte: string, langue: LangueRecherche = 'pt'): string[] {
  const mots = normaliser(texte)
    .split(' ')
    .flatMap((m) => {
      const mesure = MESURE_COLLEE.exec(m)
      return mesure ? [mesure[1], mesure[2]] : [m]
    })
    .filter((m) => m.length > 1 || (m >= '0' && m <= '9'))
  const vides = MOTS_VIDES[langue]
  const utiles = mots.filter((m) => !vides.has(m))
  // Une requête faite uniquement de mots vides (« para ») reste cherchable.
  return (utiles.length > 0 ? utiles : mots).map(racine)
}

/** Distance d'édition bornée : renvoie `max + 1` dès que la distance dépasse `max`. */
function distanceBornee(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let precedente = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const courante = [i]
    let minimumLigne = i
    for (let j = 1; j <= b.length; j++) {
      const cout = a[i - 1] === b[j - 1] ? 0 : 1
      const valeur = Math.min(precedente[j] + 1, courante[j - 1] + 1, precedente[j - 1] + cout)
      courante.push(valeur)
      if (valeur < minimumLigne) minimumLigne = valeur
    }
    if (minimumLigne > max) return max + 1
    precedente = courante
  }
  return precedente[b.length]
}

/** Longueur du début commun à deux mots. */
function debutCommun(a: string, b: string): number {
  const max = Math.min(a.length, b.length)
  let i = 0
  while (i < max && a[i] === b[i]) i++
  return i
}

/**
 * Qualité de la correspondance entre un mot cherché et un mot indexé : 1 exact, 0 aucun rapport.
 * Entre les deux : mot en cours de saisie (début du mot indexé), faute de frappe, puis mots de la même
 * famille (« impermeabilizar » / « impermeabilizacao ») reconnus à leur long début commun.
 * Un nombre ne se compare qu'à l'identique : « 6 » ne vaut pas « 60 ».
 */
export function qualite(cherche: string, indexe: string): number {
  if (cherche === indexe) return 1
  if (/^\d+$/.test(cherche)) return 0
  if (indexe.startsWith(cherche)) return 0.8
  if (cherche.length >= 5) {
    const tolerance = cherche.length >= 9 ? 2 : 1
    if (distanceBornee(cherche, indexe, tolerance) <= tolerance) return 0.6
  }
  const plusCourt = Math.min(cherche.length, indexe.length)
  if (plusCourt >= 7 && debutCommun(cherche, indexe) >= Math.max(6, Math.ceil(plusCourt * 0.65))) return 0.5
  return 0
}

/** Champs pondérés d'une fiche (titre 10, mots-clés 8…), partagés par l'index et par les tests qui le vérifient. */
export interface ChampRecherche {
  poids: number
  mots: string[]
}

function champ(langue: LangueRecherche, poids: number, ...textes: Array<string | undefined>): ChampRecherche {
  return { poids, mots: textes.flatMap((t) => (t ? motsUtiles(t, langue) : [])) }
}

/** Champs d'une fiche de situation. */
export function champsSituation(dico: Dictionnaire, s: Situation, materiauParId: ReadonlyMap<string, Materiau>): ChampRecherche[] {
  const langue = dico.langue
  return [
    champ(langue, 10, s.titre),
    champ(langue, 8, ...s.motsCles),
    champ(langue, 3, dico.domaines.find((d) => d.id === s.domaine)?.nom),
    champ(langue, 2, s.description),
    champ(langue, 1, ...s.etapes.flatMap((e) => e.materiaux.map((l) => materiauParId.get(l.id)?.nom))),
  ]
}

/** Champs d'une fiche de matériau. Du conditionnement, seules les tailles et contenances comptent (« 280 ml »). */
export function champsMateriau(dico: Dictionnaire, m: Materiau): ChampRecherche[] {
  const langue = dico.langue
  const famille = dico.familles.find((f) => f.id === m.famille)
  const sousFamille = famille?.sousFamilles.find((sf) => sf.id === m.sousFamille)
  const mesures = m.conditionnement ? motsUtiles(m.conditionnement, langue).filter(estMesure) : []
  return [
    champ(langue, 10, m.nom),
    champ(langue, 8, ...m.aussiAppele, ...(m.aussiCherche ?? [])),
    champ(langue, 6, m.recherche),
    champ(langue, 5, sousFamille?.nom),
    champ(langue, 4, famille?.nom),
    champ(langue, 2, m.usage),
    champ(langue, 1, m.aSavoir),
    { poids: 1, mots: mesures },
  ]
}

// ── Index ──
// Plutôt que de comparer chaque mot tapé à chaque mot de chaque fiche (des centaines de milliers de comparaisons
// avec fautes de frappe à chaque lettre tapée), l'index garde le vocabulaire une seule fois : un mot tapé est
// comparé aux mots distincts du dictionnaire, puis les fiches qui contiennent les mots reconnus sont lues dans des
// listes préparées (« postings »). Le classement est le même que la comparaison mot à mot : pour chaque fiche, la
// meilleure valeur « poids du champ × qualité du mot » (vérifié par tests/dictionnaire-materiaux/recherche-index.test.ts).

interface Corpus<T> {
  elements: T[]
  /** Titre réduit à ses mots utiles, pour reconnaître une requête qui le reprend tel quel. */
  titres: string[]
  /** Libellé de tri à score égal. */
  libelles: string[]
  /** Pour un mot du vocabulaire (par son numéro) : les fiches qui le contiennent, avec le poids de leur meilleur champ. */
  postings: Map<number, Array<readonly [fiche: number, poids: number]>>
}

interface Index {
  langue: LangueRecherche
  vocabulaire: string[]
  situations: Corpus<Situation>
  materiaux: Corpus<Materiau>
  /** Mots du vocabulaire reconnus pour un mot tapé (numéro, qualité), gardés entre deux frappes. */
  correspondances: Map<string, Array<readonly [mot: number, qualite: number]>>
}

const TAILLE_MAX_CACHE = 500

function construireCorpus<T>(
  elements: T[],
  decrire: (element: T) => { titre: string; champs: ChampRecherche[] },
  langue: LangueRecherche,
  numeroDe: (mot: string) => number,
): Corpus<T> {
  const titres: string[] = []
  const libelles: string[] = []
  const postings = new Map<number, Array<readonly [number, number]>>()
  elements.forEach((element, fiche) => {
    const { titre, champs } = decrire(element)
    titres.push(motsUtiles(titre, langue).join(' '))
    libelles.push(titre)
    // Un mot présent dans plusieurs champs compte avec le poids du plus fort.
    const meilleurPoids = new Map<number, number>()
    for (const c of champs) {
      for (const mot of c.mots) {
        const numero = numeroDe(mot)
        if ((meilleurPoids.get(numero) ?? 0) < c.poids) meilleurPoids.set(numero, c.poids)
      }
    }
    for (const [numero, poids] of meilleurPoids) {
      const liste = postings.get(numero)
      if (liste) liste.push([fiche, poids])
      else postings.set(numero, [[fiche, poids]])
    }
  })
  return { elements, titres, libelles, postings }
}

function construireIndex(dico: Dictionnaire): Index {
  const materiauParId = new Map(dico.materiaux.map((m) => [m.id, m]))
  const vocabulaire: string[] = []
  const numeros = new Map<string, number>()
  const numeroDe = (mot: string): number => {
    let numero = numeros.get(mot)
    if (numero === undefined) {
      numero = vocabulaire.length
      vocabulaire.push(mot)
      numeros.set(mot, numero)
    }
    return numero
  }
  const situations = construireCorpus(dico.situations, (s) => ({ titre: s.titre, champs: champsSituation(dico, s, materiauParId) }), dico.langue, numeroDe)
  const materiaux = construireCorpus(dico.materiaux, (m) => ({ titre: m.nom, champs: champsMateriau(dico, m) }), dico.langue, numeroDe)
  return { langue: dico.langue, vocabulaire, situations, materiaux, correspondances: new Map() }
}

const INDEX = new WeakMap<Dictionnaire, Index>()

function indexDe(dico: Dictionnaire): Index {
  let index = INDEX.get(dico)
  if (!index) {
    index = construireIndex(dico)
    INDEX.set(dico, index)
  }
  return index
}

/** Mots du vocabulaire qui correspondent à un mot tapé, avec la qualité de la correspondance. */
function correspondancesDe(index: Index, mot: string): Array<readonly [number, number]> {
  const connues = index.correspondances.get(mot)
  if (connues) return connues
  const trouvees: Array<readonly [number, number]> = []
  index.vocabulaire.forEach((indexe, numero) => {
    const q = qualite(mot, indexe)
    if (q > 0) trouvees.push([numero, q])
  })
  if (index.correspondances.size >= TAILLE_MAX_CACHE) index.correspondances.clear()
  index.correspondances.set(mot, trouvees)
  return trouvees
}

export interface ResultatRecherche<T> {
  element: T
  score: number
}

/**
 * Mots de la saisie qu'une fiche doit tous contenir : tous sauf les mesures (nombres et unités), qui ne font que
 * départager. Une saisie faite seulement de mesures (« 8 mm ») les exige toutes.
 */
export function motsExiges(mots: string[]): boolean[] {
  const exiges = mots.map((m) => !estMesure(m))
  return exiges.some(Boolean) ? exiges : mots.map(() => true)
}

/** Meilleure contribution d'un mot tapé dans chaque fiche du corpus, dans `meilleure` (0 : le mot n'y est pas). */
function contributionsDuMot<T>(index: Index, corpus: Corpus<T>, mot: string, meilleure: Float64Array): void {
  meilleure.fill(0)
  for (const [numero, q] of correspondancesDe(index, mot)) {
    for (const [fiche, poids] of corpus.postings.get(numero) ?? []) {
      const valeur = poids * q
      if (valeur > meilleure[fiche]) meilleure[fiche] = valeur
    }
  }
}

/** Ajoute aux fiches la contribution d'un mot ; un mot exigé compte comme trouvé, une mesure ne fait que départager. */
function ajouterLeMot(meilleure: Float64Array, exige: boolean, scores: Float64Array, trouves: Uint16Array): void {
  const plafond = exige ? Number.POSITIVE_INFINITY : POINTS_MESURE_MAX
  for (let fiche = 0; fiche < meilleure.length; fiche++) {
    if (meilleure[fiche] === 0) continue
    if (exige) trouves[fiche]++
    scores[fiche] += Math.min(meilleure[fiche], plafond)
  }
}

/** La requête reprend le titre (« infiltracao fachada » pour « Infiltração em fachada ») : en tête. */
function bonusDeTitre(titre: string, requete: string): number {
  if (titre === requete) return 30
  return titre.startsWith(requete) ? 15 : 0
}

function classer<T>(index: Index, corpus: Corpus<T>, mots: string[], limite: number): Array<ResultatRecherche<T>> {
  const total = corpus.elements.length
  const exiges = motsExiges(mots)
  const nombreExiges = exiges.filter(Boolean).length
  const scores = new Float64Array(total)
  const trouves = new Uint16Array(total)
  const meilleure = new Float64Array(total)
  mots.forEach((mot, rang) => {
    contributionsDuMot(index, corpus, mot, meilleure)
    ajouterLeMot(meilleure, exiges[rang], scores, trouves)
  })

  // Le titre se compare aux mots exigés seulement : « silicone 280 ml » met en tête les fiches « Silicone … ».
  const requete = mots.filter((_, rang) => exiges[rang]).join(' ')
  const notes: Array<{ fiche: number; score: number; trouves: number }> = []
  for (let fiche = 0; fiche < total; fiche++) {
    if (trouves[fiche] > 0) {
      notes.push({ fiche, score: scores[fiche] + bonusDeTitre(corpus.titres[fiche], requete), trouves: trouves[fiche] })
    }
  }
  // Tous les mots exigés d'abord ; si aucune fiche ne les réunit, celles qui en contiennent le plus.
  const completes = notes.filter((n) => n.trouves === nombreExiges)
  const retenues = completes.length > 0 ? completes : notes
  retenues.sort((a, b) => b.trouves - a.trouves || b.score - a.score || corpus.libelles[a.fiche].localeCompare(corpus.libelles[b.fiche]))
  return retenues.slice(0, limite).map((n) => ({ element: corpus.elements[n.fiche], score: n.score }))
}

export interface ResultatsDictionnaire {
  situations: Array<ResultatRecherche<Situation>>
  materiaux: Array<ResultatRecherche<Materiau>>
}

export interface OptionsRecherche {
  limiteSituations?: number
  limiteMateriaux?: number
}

/** Mots utiles d'une saisie de recherche, dans la langue du dictionnaire, bornés à MOTS_RECHERCHE_MAX. */
export function motsDeLaSaisie(dico: Dictionnaire, saisie: string): string[] {
  return motsUtiles(saisie, dico.langue).slice(0, MOTS_RECHERCHE_MAX)
}

/** Situations et matériaux du dictionnaire qui correspondent à la saisie, les plus proches d'abord. */
export function rechercher(dico: Dictionnaire, saisie: string, options: OptionsRecherche = {}): ResultatsDictionnaire {
  const mots = motsDeLaSaisie(dico, saisie)
  if (mots.length === 0) return { situations: [], materiaux: [] }
  const index = indexDe(dico)
  return {
    situations: classer(index, index.situations, mots, options.limiteSituations ?? 12),
    materiaux: classer(index, index.materiaux, mots, options.limiteMateriaux ?? 24),
  }
}

export interface LigneMateriau extends Omit<MateriauDeSituation, 'id'> {
  materiau: Materiau
}

export interface EtapeResolue {
  titre: string
  lignes: LigneMateriau[]
}

/** Étapes d'une liste (fiche de situation ou réponse de l'IA) avec leurs matériaux retrouvés au catalogue. */
export function resoudreEtapes(
  dico: Dictionnaire,
  etapes: ReadonlyArray<{ titre: string; materiaux: ReadonlyArray<MateriauDeSituation> }>,
): EtapeResolue[] {
  const materiauParId = new Map(dico.materiaux.map((m) => [m.id, m]))
  return etapes
    .map((etape) => ({
      titre: etape.titre,
      lignes: etape.materiaux.flatMap((ligne): LigneMateriau[] => {
        const materiau = materiauParId.get(ligne.id)
        return materiau ? [{ materiau, note: ligne.note, optionnel: ligne.optionnel }] : []
      }),
    }))
    .filter((etape) => etape.lignes.length > 0)
}

/** Situations du dictionnaire qui emploient ce matériau. */
export function situationsUtilisant(dico: Dictionnaire, idMateriau: string): Situation[] {
  return dico.situations.filter((s) => s.etapes.some((e) => e.materiaux.some((l) => l.id === idMateriau)))
}

/** Liste des matériaux en texte simple, pour le presse-papiers (liste de courses). */
export function listeEnTexte(titre: string, etapes: EtapeResolue[], mentionOptionnel: string): string {
  const lignes = [titre]
  for (const etape of etapes) {
    lignes.push('', `${etape.titre} :`)
    for (const ligne of etape.lignes) {
      const optionnel = ligne.optionnel ? ` (${mentionOptionnel})` : ''
      const note = ligne.note ? ` — ${ligne.note}` : ''
      lignes.push(`- ${ligne.materiau.nom}${optionnel}${note}`)
    }
  }
  return lignes.join('\n')
}
