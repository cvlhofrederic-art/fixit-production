// ── AJ Signalement — diffusion : bâtiments et étages ciblables (PR 3, lot 2) ────────────────────────────────────────
//
// Cahier PR 3 § 3.6. Bâtiment et étage sont saisis librement par les déclarants (formulaire public) : « RDC », « 0 »,
// « 1er » et « 1 » coexistent, la liste « batiments » de la fiche n'est pas reliée aux signalements. Retenu :
//   1. la base rend les couples bruts distincts (bâtiment, étage), rognés par btrim (signalements_qr_diffusion_valeurs) ;
//   2. ici seulement, ils sont regroupés par une normalisation unique : normaliserBatimentQr (existante, semblables.ts)
//      et normaliserEtageQr ; l'écran ne propose que les valeurs réellement présentes, avec leurs variantes ;
//   3. l'écran renvoie des CLÉS ; le serveur relit les couples et reconvertit la clé en valeurs brutes EXACTES
//      (valeursBrutesDiffusionQr), que le SQL compare telles quelles : la normalisation n'existe qu'à un endroit ;
//   4. aucun nombre de destinataires n'est additionné ici (une personne sous deux variantes serait comptée deux fois) :
//      il vient de l'aperçu SQL.
// Le bâtiment et l'étage sont ceux du déclarant (où il habite), jamais la zone signalée. Le libellé écrit dans
// l'e-mail vient de la fiche, ou d'une variante qui passe le contrôle du texte (controlerTexteDiffusionQr) après
// nettoyage ; sinon l'auteur l'écrit (libelleASaisir), sous le même contrôle.

import { controlerTexteDiffusionQr, nettoyerLigneDiffusionQr } from '@/lib/aj-signalement/diffusion-texte'
import { normaliserBatimentQr } from '@/lib/aj-signalement/semblables'
import type { LangueSignalementQr } from '@/lib/aj-signalement/types'

/** Les quatre portées d'une diffusion (cahier § 3.2). */
export type PorteeDiffusionQr = 'copropriete' | 'batiment' | 'etage' | 'signalement'

/**
 * Ligne rendue par signalements_qr_diffusion_valeurs (couple brut rogné, distinct) ; nb_adresses = nombre d'adresses
 * du couple, qui classe les variantes (1 s'il manque ou n'est pas un entier positif ; un bigint lu en texte est accepté).
 */
export interface CoupleValeursQr {
  batiment: string | null
  etage: string | null
  nb_adresses?: number | string | null
}

export interface EtageCiblableQr {
  cle: string
  /** Libellé écrit dans l'e-mail ; null quand l'auteur doit l'écrire. */
  libelle: string | null
  libelleASaisir: boolean
  /** Valeurs brutes regroupées sous cette clé, de la plus fréquente à la moins fréquente. */
  variantes: string[]
}

export interface BatimentCiblableQr extends EtageCiblableQr {
  etages: EtageCiblableQr[]
  /**
   * Adresses de ce bâtiment sans étage lisible (somme indicative des couples : une personne sous deux variantes y
   * compte deux fois) ; atteintes par le bâtiment, jamais par un étage.
   */
  sansEtage: number
}

export interface ValeursCiblablesQr {
  batiments: BatimentCiblableQr[]
  /**
   * Adresses sans bâtiment lisible (somme indicative, comme sansEtage) : atteintes seulement par « toute la
   * copropriété » ou un signalement précis. Le nombre exact de destinataires vient toujours de l'aperçu SQL.
   */
  sansBatiment: number
  porteeParDefaut: Extract<PorteeDiffusionQr, 'batiment' | 'copropriete'>
}

export interface OptionsValeursCiblablesQr {
  /** Numéros déclarés par le cabinet : un libellé qui en contient un autre n'est pas retenu. */
  telephonesAutorises?: readonly string[]
}

/** Clés choisies à l'écran, reconverties par le serveur en valeurs brutes. */
export type PerimetreClesDiffusionQr =
  | { portee: 'batiment'; batiment: string }
  | { portee: 'etage'; batiment: string; etage: string }

/**
 * Valeurs brutes exactes à passer au SQL : bâtiment → p_batiments seul ; étage → couples en deux tableaux de même
 * longueur (p_batiments[i], p_etages[i]), lus par unnest(p_batiments, p_etages).
 */
export interface ValeursBrutesDiffusionQr {
  batiments: string[]
  etages: string[]
}

/** Longueur maximale d'une clé (schéma de la route, cahier § 4.2). */
const CLE_MAX = 60
/** Longueur maximale d'un libellé de bâtiment ou d'étage écrit dans l'e-mail. */
const LIBELLE_MAX = 50

/** Libellé d'une saisie libre, avant contrôle : contrôles et invisibles retirés, espaces réduites, 50 caractères. */
export function nettoyerLibelleDiffusionQr(saisie: string): string {
  return nettoyerLigneDiffusionQr(saisie, LIBELLE_MAX)
}

// ── Étage ──

const MOTS_ETAGE = new Set(['etage', 'etages', 'et', 'andar', 'piso', 'niveau', 'niv'])
const MOTS_POSITION = new Set([
  'gauche', 'droite', 'g', 'd', 'fond', 'esq', 'esquerdo', 'esquerda', 'dto', 'dta', 'direito', 'direita', 'frente',
])
const SUFFIXES_ORDINAUX = new Set(['er', 'ere', 're', 'e', 'eme', 'ieme', 'em', 'me', 'o', 'a', '°'])
// Une Map, pas un objet : « constructor » ou « toString » ne doivent rien lire du prototype.
const ORDINAUX: ReadonlyMap<string, number> = new Map(Object.entries({
  premier: 1, premiere: 1, deuxieme: 2, second: 2, seconde: 2, troisieme: 3, quatrieme: 4, cinquieme: 5,
  sixieme: 6, septieme: 7, huitieme: 8, neuvieme: 9, dixieme: 10,
  primeiro: 1, primeira: 1, segundo: 2, segunda: 2, terceiro: 3, terceira: 3, quarto: 4, quarta: 4, quinto: 5,
  quinta: 5, sexto: 6, sexta: 6, setimo: 7, setima: 7, oitavo: 8, oitava: 8, nono: 9, nona: 9, decimo: 10, decima: 10,
}))
const REZ_DE_CHAUSSEE = ['rdc', 'rc', 'r c', 'rez de chaussee', 'rez chaussee', 'res do chao', 'res de chao', 'r chao']
  .map((suite) => suite.split(' '))
const SOUS_SOL = ['ss', 's sol', 'sous sol', 'soussol', 'cave', 'caves', 'subsolo'].map((suite) => suite.split(' '))

/** NFKC (« º » → « o », pleine chasse → ASCII), tirets ramenés à « - », minuscules, sans accents. */
function formeEtage(saisie: string): string {
  return saisie.normalize('NFKC').replace(/[\u2010-\u2015\u2212\uFE63\uFF0D]/g, '-')
    .toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
}

/** Nombre de mots de la plus longue suite de `suites` qui commence au mot i (0 si aucune). */
function longueurSuite(mots: readonly string[], i: number, suites: readonly string[][]): number {
  let longueur = 0
  for (const suite of suites) {
    if (suite.length > longueur && suite.every((mot, k) => mots[i + k] === mot)) longueur = suite.length
  }
  return longueur
}

const nombre = (mot: string | undefined): number | null => (mot !== undefined && /^-?\d+$/.test(mot) ? Number.parseInt(mot, 10) : null)

/** Niveau lu après un mot « sous-sol » : « ss2 », « sous-sol -2 » → -2 ; seul → -1. */
function lireSousSol(mots: readonly string[], i: number): { valeur: number; suite: number } {
  const n = nombre(mots[i])
  return n !== null && n !== 0 ? { valeur: -Math.abs(n), suite: i + 1 } : { valeur: -1, suite: i }
}

/** Niveau écrit en chiffres ou en lettres, suffixe ordinal facultatif, puis « sous-sol » facultatif (« 2e sous-sol »). */
function lireNumero(mots: readonly string[], i: number): { valeur: number; suite: number } | null {
  const chiffres = nombre(mots[i])
  const n = chiffres ?? ORDINAUX.get(mots[i] ?? '') ?? null
  if (n === null) return null
  let suite = i + 1
  if (chiffres !== null && SUFFIXES_ORDINAUX.has(mots[suite] ?? '')) suite += 1
  const sousSol = longueurSuite(mots, suite, SOUS_SOL)
  return sousSol > 0 && n > 0 ? { valeur: -n, suite: suite + sousSol } : { valeur: n, suite }
}

/** Niveau reconnu, ou null : mot d'étage facultatif, niveau, mot d'étage facultatif, un mot de position au plus. */
function lireNiveau(mots: readonly string[]): number | null {
  let i = mots.length > 1 && MOTS_ETAGE.has(mots[0]) ? 1 : 0
  const rdc = longueurSuite(mots, i, REZ_DE_CHAUSSEE)
  const sousSol = longueurSuite(mots, i, SOUS_SOL)
  let lu: { valeur: number; suite: number } | null
  if (rdc > 0) lu = { valeur: 0, suite: i + rdc }
  else if (sousSol > 0) lu = lireSousSol(mots, i + sousSol)
  else lu = lireNumero(mots, i)
  if (lu === null) return null
  i = lu.suite
  if (MOTS_ETAGE.has(mots[i] ?? '')) i += 1
  if (MOTS_POSITION.has(mots[i] ?? '')) i += 1
  return i === mots.length ? lu.valeur : null
}

/**
 * Étage saisi → clé de regroupement : « 0 » (RDC, rez-de-chaussée, r/c, rés-do-chão, 0, 00), « -n » (SS, sous-sol,
 * s/sol, cave, -1 ; « ss2 », « -2 » → -2), « n » pour un niveau écrit en chiffres (suffixe ordinal « 1er », « 2ème »,
 * « 3º », « 4.º andar », « 5 piso ») ou en lettres (« premier » à « dixième », « primeiro » à « décimo »), suivi au
 * plus d'un mot de position (gauche, droite, G, D, esq., dto., fond). Tout le reste → la saisie nettoyée (minuscules,
 * sans accents, ponctuation et espaces réduites), comme sa propre clé (« mezzanine ») ; rien à lire → ''.
 */
export function normaliserEtageQr(saisie: string): string {
  const forme = formeEtage(saisie)
  const mots = forme.match(/-?\d+|\p{L}+|°/gu) ?? []
  const niveau = mots.length > 0 ? lireNiveau(mots) : null
  if (niveau !== null) return String(niveau)   // String(-0) vaut « 0 »
  return forme.replace(/[^\p{L}\p{N}]+/gu, ' ').trim().slice(0, CLE_MAX).trim()
}

/** Libellé d'une clé d'étage numérique ; null pour une clé de saisie libre (son libellé vient de la saisie). */
export function libelleEtageDiffusionQr(cle: string, langue: LangueSignalementQr): string | null {
  if (!/^-?\d+$/.test(cle)) return null
  const n = Number.parseInt(cle, 10)
  if (n === 0) return langue === 'pt' ? 'rés-do-chão' : 'rez-de-chaussée'
  if (n < 0) return langue === 'pt' ? `piso ${n}` : `sous-sol (${n})`
  if (langue === 'pt') return `${n}.º andar`
  return `${n}${n === 1 ? 'er' : 'e'} étage`
}

// ── Regroupement ──

interface Groupe {
  variantes: Map<string, number>
  etages: Map<string, Map<string, number>>
  sansEtage: number
}

function poids({ nb_adresses }: CoupleValeursQr): number {
  const nb = Number(nb_adresses ?? 1)
  return Number.isInteger(nb) && nb > 0 ? nb : 1
}

function ajouter(compte: Map<string, number>, valeur: string, nb: number): void {
  compte.set(valeur, (compte.get(valeur) ?? 0) + nb)
}

/** Variantes de la plus fréquente à la moins fréquente, puis par ordre alphabétique (sortie stable). */
function variantesTriees(compte: ReadonlyMap<string, number>): string[] {
  return [...compte.entries()]
    .sort(([va, na], [vb, nb]) => nb - na || va.localeCompare(vb, 'fr'))
    .map(([valeur]) => valeur)
}

/** Première variante qui, nettoyée, passe le contrôle du texte ; aucune → l'auteur écrit le libellé. */
function libelleDesVariantes(variantes: readonly string[], telephonesAutorises: readonly string[]): Pick<EtageCiblableQr, 'libelle' | 'libelleASaisir'> {
  for (const variante of variantes) {
    const controle = controlerTexteDiffusionQr(nettoyerLibelleDiffusionQr(variante), { nature: 'libelle', telephonesAutorises })
    if (controle.ok) return { libelle: controle.texte, libelleASaisir: false }
  }
  return { libelle: null, libelleASaisir: true }
}

/** Libellé d'un bâtiment : le nom de la fiche dont la clé correspond, sinon une variante affichable. */
function libelleBatiment(cle: string, variantes: readonly string[], fiche: readonly string[], telephonesAutorises: readonly string[]): Pick<EtageCiblableQr, 'libelle' | 'libelleASaisir'> {
  for (const nom of fiche) {
    const propre = nettoyerLibelleDiffusionQr(nom)
    if (propre !== '' && normaliserBatimentQr(nom) === cle) return { libelle: propre, libelleASaisir: false }
  }
  return libelleDesVariantes(variantes, telephonesAutorises)
}

/** Étages : niveaux numériques croissants (sous-sols, rez-de-chaussée, étages), puis saisies libres par ordre alphabétique. */
function comparerClesEtage(a: string, b: string): number {
  const na = /^-?\d+$/.test(a) ? Number.parseInt(a, 10) : null
  const nb = /^-?\d+$/.test(b) ? Number.parseInt(b, 10) : null
  if (na !== null && nb !== null) return na - nb
  if (na !== null) return -1
  if (nb !== null) return 1
  return a.localeCompare(b, 'fr')
}

function etagesCiblables(etages: ReadonlyMap<string, ReadonlyMap<string, number>>, langue: LangueSignalementQr, telephonesAutorises: readonly string[]): EtageCiblableQr[] {
  return [...etages.keys()].sort(comparerClesEtage).map((cle) => {
    const variantes = variantesTriees(etages.get(cle) ?? new Map<string, number>())
    const calcule = libelleEtageDiffusionQr(cle, langue)
    const libelle = calcule === null ? libelleDesVariantes(variantes, telephonesAutorises) : { libelle: calcule, libelleASaisir: false }
    return { cle, ...libelle, variantes }
  })
}

function regrouper(couples: readonly CoupleValeursQr[]): { groupes: Map<string, Groupe>; sansBatiment: number } {
  const groupes = new Map<string, Groupe>()
  let sansBatiment = 0
  for (const couple of couples) {
    const nb = poids(couple)
    const batiment = couple.batiment ?? ''
    const cle = normaliserBatimentQr(batiment)
    if (cle === '') {
      sansBatiment += nb
      continue
    }
    const groupe = groupes.get(cle) ?? { variantes: new Map<string, number>(), etages: new Map<string, Map<string, number>>(), sansEtage: 0 }
    groupes.set(cle, groupe)
    ajouter(groupe.variantes, batiment, nb)
    const etage = couple.etage ?? ''
    const cleEtage = normaliserEtageQr(etage)
    if (cleEtage === '') {
      groupe.sansEtage += nb
      continue
    }
    const compte = groupe.etages.get(cleEtage) ?? new Map<string, number>()
    groupe.etages.set(cleEtage, compte)
    ajouter(compte, etage, nb)
  }
  return { groupes, sansBatiment }
}

/** Portée présélectionnée : « Un bâtiment » dès que deux groupes de bâtiment sont présents (la fiche ne compte pas). */
export function porteeParDefautDiffusionQr(valeurs: Pick<ValeursCiblablesQr, 'batiments'>): ValeursCiblablesQr['porteeParDefaut'] {
  return valeurs.batiments.length >= 2 ? 'batiment' : 'copropriete'
}

/**
 * Bâtiments et étages proposés à l'écran, regroupés depuis les couples présents : clé, libellé écrit dans l'e-mail
 * (fiche, sinon variante contrôlée, sinon à saisir), variantes ; « sans bâtiment » à part ; portée par défaut.
 * `langue` est celle du cabinet (celle de la diffusion), pour les libellés d'étage.
 */
export function valeursCiblablesQr(
  couples: readonly CoupleValeursQr[], batimentsFiche: readonly string[], langue: LangueSignalementQr,
  options: OptionsValeursCiblablesQr = {},
): ValeursCiblablesQr {
  const telephonesAutorises = options.telephonesAutorises ?? []
  const { groupes, sansBatiment } = regrouper(couples)
  const batiments = [...groupes.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'fr', { numeric: true }))
    .map(([cle, groupe]): BatimentCiblableQr => {
      const variantes = variantesTriees(groupe.variantes)
      return {
        cle,
        ...libelleBatiment(cle, variantes, batimentsFiche, telephonesAutorises),
        variantes,
        etages: etagesCiblables(groupe.etages, langue, telephonesAutorises),
        sansEtage: groupe.sansEtage,
      }
    })
  return { batiments, sansBatiment, porteeParDefaut: porteeParDefautDiffusionQr({ batiments }) }
}

/**
 * Clé(s) choisie(s) à l'écran → valeurs brutes exactes, sans aucune transformation (le SQL compare btrim(batiment) et
 * btrim(etage) à ces valeurs, déjà rognées par la base). Clé inconnue, « sans bâtiment » ou « sans étage » → null
 * (la route répond 409 perimetre_change). Ordre : celui des couples reçus, sans doublon.
 */
export function valeursBrutesDiffusionQr(couples: readonly CoupleValeursQr[], perimetre: PerimetreClesDiffusionQr): ValeursBrutesDiffusionQr | null {
  if (perimetre.batiment === '') return null
  const duBatiment = couples.filter((c): c is CoupleValeursQr & { batiment: string } =>
    c.batiment !== null && normaliserBatimentQr(c.batiment) === perimetre.batiment)
  const resultat = perimetre.portee === 'batiment'
    ? { batiments: [...new Set(duBatiment.map((c) => c.batiment))], etages: [] }
    : couplesDeLEtage(duBatiment, perimetre.etage)
  return resultat.batiments.length > 0 ? resultat : null
}

/** Couples bruts distincts d'un groupe d'étage, en deux tableaux parallèles ; clé vide (« sans étage ») → aucun. */
function couplesDeLEtage(couples: ReadonlyArray<CoupleValeursQr & { batiment: string }>, cleEtage: string): ValeursBrutesDiffusionQr {
  const resultat: ValeursBrutesDiffusionQr = { batiments: [], etages: [] }
  if (cleEtage === '') return resultat
  const vus = new Set<string>()
  for (const { batiment, etage } of couples) {
    const couple = JSON.stringify([batiment, etage])
    if (etage === null || vus.has(couple) || normaliserEtageQr(etage) !== cleEtage) continue
    vus.add(couple)
    resultat.batiments.push(batiment)
    resultat.etages.push(etage)
  }
  return resultat
}

// ── Libellé du périmètre ──

/** Premiers mots qui nomment déjà le bâtiment : « Bât. B », « Tour Nord » ne reçoivent pas « Bâtiment » devant. */
const MOTS_NOM_BATIMENT = new Set([
  'batiment', 'bat', 'bloc', 'bloco', 'immeuble', 'residence', 'tour', 'torre', 'entree', 'escalier', 'pavillon', 'villa',
  'edificio', 'predio',
])

export type PerimetreLibellesDiffusionQr =
  | { portee: 'copropriete' }
  | { portee: 'batiment'; batiment: string }
  | { portee: 'etage'; batiment: string; etage: string }
  | { portee: 'signalement' }

const TEXTES_PERIMETRE: Readonly<Record<LangueSignalementQr, { copropriete: string; signalement: string; batiment: string }>> = {
  fr: { copropriete: 'Toute la copropriété', signalement: 'Déclarants du signalement', batiment: 'Bâtiment' },
  pt: { copropriete: 'Todo o condomínio', signalement: 'Quem comunicou a ocorrência', batiment: 'Bloco' },
}

function nomBatiment(libelle: string, langue: LangueSignalementQr): string {
  const premier = /\p{L}+/u.exec(libelle.toLowerCase().normalize('NFD').replace(/\p{M}/gu, ''))?.[0] ?? ''
  return MOTS_NOM_BATIMENT.has(premier) ? libelle : `${TEXTES_PERIMETRE[langue].batiment} ${libelle}`
}

/**
 * Libellé du périmètre (gardé dans la diffusion, montré dans la confirmation tel qu'il sera écrit dans l'e-mail) :
 * « Toute la copropriété », « Bâtiment B », « Bâtiment B · 3e étage », « Déclarants du signalement ». Les libellés de
 * bâtiment et d'étage sont ceux de valeursCiblablesQr (ou saisis par l'auteur, contrôlés).
 */
export function libellePerimetreDiffusionQr(langue: LangueSignalementQr, perimetre: PerimetreLibellesDiffusionQr): string {
  const textes = TEXTES_PERIMETRE[langue]
  switch (perimetre.portee) {
    case 'copropriete': return textes.copropriete
    case 'signalement': return textes.signalement
    case 'batiment': return nomBatiment(perimetre.batiment, langue)
    case 'etage': return `${nomBatiment(perimetre.batiment, langue)} · ${perimetre.etage}`
  }
}
