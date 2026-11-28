/**
 * Remise commerciale des devis et factures (artisan et BTP Pro) — source unique du calcul.
 *
 * Deux niveaux, comme dans les logiciels de devis du bâtiment :
 *   - remise de ligne : champ `remise` d'une ligne, en % ou en € sur le montant de la ligne ;
 *   - remise globale : champ `remiseGlobale` du document, en % ou en € HT sur le total des lignes.
 *
 * Règles retenues :
 *   - la remise se calcule sur le HT, avant la TVA : les remises consenties directement au client
 *     sortent de la base d'imposition (CGI, art. 267, II-1°) et la facture les mentionne quand
 *     elles sont acquises (CGI, annexe II, art. 242 nonies A, I-9°) ;
 *   - une remise globale sur un document à plusieurs taux de TVA se répartit entre les taux au
 *     prorata de leurs bases (une remise de pied de facture électronique EN 16931 porte un taux) ;
 *   - les lignes `horsRemise` (déduction des acomptes d'une facture de solde) n'entrent pas dans la
 *     base de la remise globale : la remise porte sur les travaux, l'acompte se déduit ensuite ;
 *   - une remise en € réduit le montant sans en changer le signe (un avoir a des lignes négatives,
 *     sa remise l'est aussi) et ne dépasse jamais la base ; une remise en % est plafonnée à 100 %.
 *
 * Un document sans remise se calcule exactement comme avant : chaque fonction rend la valeur
 * d'origine quand la remise est absente, invalide ou nulle (documents déjà enregistrés inchangés).
 */
import { mulMoney, round2, toCents } from '@/lib/money'

export type TypeRemise = 'pourcentage' | 'montant'

/** Remise saisie : en % du montant, ou en euros HT. */
export interface Remise {
  type: TypeRemise
  valeur: number
}

/** Nombre saisi ou stocké : nombre, ou texte à la française (« 1 200,50 ») ; NaN sinon. */
function nombreSaisi(valeur: unknown): number {
  if (typeof valeur === 'number') return valeur
  if (typeof valeur === 'string') return Number(valeur.replace(/\s/g, '').replace(',', '.'))
  return Number.NaN
}

/** Lit une remise venue du stockage (forme libre) ; null si absente, invalide ou nulle. */
export function lireRemise(brut: unknown): Remise | null {
  if (!brut || typeof brut !== 'object') return null
  const { type, valeur } = brut as { type?: unknown; valeur?: unknown }
  if (type !== 'pourcentage' && type !== 'montant') return null
  const nombre = nombreSaisi(valeur)
  if (!Number.isFinite(nombre)) return null
  const absolu = Math.abs(nombre)
  if (type === 'pourcentage') {
    const pourcentage = Math.min(absolu, 100)
    return pourcentage > 0 ? { type, valeur: pourcentage } : null
  }
  const montant = round2(absolu)
  return montant > 0 ? { type, valeur: montant } : null
}

/** Montant de la remise sur `base` : même signe que la base, arrondi au centime, jamais au-delà de la base. */
export function montantRemise(base: number, remise: unknown): number {
  const r = lireRemise(remise)
  if (!r || !Number.isFinite(base) || base === 0) return 0
  if (r.type === 'pourcentage') return round2((base * r.valeur) / 100)
  return round2(Math.sign(base) * Math.min(r.valeur, Math.abs(base)))
}

/** Montant HT d'une ligne : quantité × prix unitaire (arrondi au centime), remise de la ligne déduite. */
export function montantNetLigne(qty: number, priceHT: number, remise?: unknown): number {
  const brut = mulMoney(qty || 0, priceHT || 0)
  const deduction = montantRemise(brut, remise)
  return deduction === 0 ? brut : round2(brut - deduction)
}

/** Division entière arrondie vers −∞ (le reste est toujours positif ou nul). */
function divisionPlancher(a: bigint, b: bigint): { quotient: bigint; reste: bigint } {
  let quotient = a / b
  let reste = a % b
  if (reste < BigInt(0)) {
    quotient -= BigInt(1)
    reste += b
  }
  return { quotient, reste }
}

/**
 * Répartit `montant` entre des bases au prorata, au centime près : la somme des parts vaut
 * exactement `montant`. Plus forts restes (à égalité : la base la plus forte, puis l'ordre reçu),
 * en arithmétique entière exacte. Un jeu de bases négatives (avoir) se répartit comme son opposé,
 * pour qu'un avoir solde sa facture taux par taux.
 */
export function repartirAuProrata(bases: number[], montant: number): number[] {
  const basesCents = bases.map(toCents)
  const totalCents = basesCents.reduce((somme, b) => somme + b, 0)
  const montantCents = toCents(montant)
  if (montantCents === 0 || totalCents === 0) return bases.map(() => 0)
  const sens = totalCents < 0 ? -1 : 1
  const total = BigInt(totalCents * sens)
  const aRepartir = BigInt(montantCents * sens)
  const bruts = basesCents.map((b, rang) => {
    const { quotient, reste } = divisionPlancher(aRepartir * BigInt(b * sens), total)
    return { rang, base: Math.abs(b), part: Number(quotient), reste }
  })
  let centimes = montantCents * sens - bruts.reduce((somme, b) => somme + b.part, 0)
  // Plus fort reste d'abord ; à égalité, la base la plus forte, puis l'ordre reçu.
  const comparer = (x: (typeof bruts)[number], y: (typeof bruts)[number]): number => {
    if (y.reste !== x.reste) return y.reste > x.reste ? 1 : -1
    return y.base - x.base || x.rang - y.rang
  }
  const ordre = [...bruts].sort(comparer)
  for (const b of ordre) {
    if (centimes <= 0) break
    b.part += 1
    centimes -= 1
  }
  // `|| 0` : jamais de « −0 » (il s'afficherait « −0,00 € »).
  return bruts.map((b) => (b.part * sens) / 100 || 0)
}

/** Ligne vue par le calcul de la remise globale. */
export interface LigneRemisable {
  totalHT: number
  tvaRate: number
  /** Ligne exclue de la base de la remise globale (déduction d'acompte). */
  horsRemise?: boolean
}

export interface BaseApresRemise {
  taux: number
  base: number
}

export interface ResultatRemiseGlobale {
  /** Total HT des lignes avant la remise globale (lignes hors remise comprises). */
  totalBrutHT: number
  /** Base de la remise globale : total HT des lignes qui y sont soumises. */
  baseRemiseHT: number
  /** Montant HT de la remise globale (même signe que sa base ; 0 sans remise). */
  remiseHT: number
  /** Total HT après la remise globale. */
  totalHT: number
  /** Bases HT par taux après la remise (taux 0 compris), par taux croissant. */
  bases: BaseApresRemise[]
}

const tauxDeLigne = (l: LigneRemisable): number => (Number.isFinite(l.tvaRate) ? l.tvaRate : 0)

/**
 * Applique une remise globale à des lignes : montant HT de la remise, puis bases HT par taux
 * après répartition au prorata. Sans remise, les bases sont les simples sommes par taux.
 */
export function appliquerRemiseGlobale(lignes: LigneRemisable[], remise: unknown): ResultatRemiseGlobale {
  const sures = (lignes || []).filter((l) => l && Number.isFinite(l.totalHT))
  const remisableParTaux = new Map<number, number>()
  const horsRemiseParTaux = new Map<number, number>()
  for (const l of sures) {
    const cible = l.horsRemise === true ? horsRemiseParTaux : remisableParTaux
    const taux = tauxDeLigne(l)
    cible.set(taux, (cible.get(taux) || 0) + toCents(l.totalHT))
    if (!remisableParTaux.has(taux)) remisableParTaux.set(taux, 0)
  }
  const taux = Array.from(remisableParTaux.keys()).sort((a, b) => a - b)
  const basesRemisables = taux.map((t) => (remisableParTaux.get(t) || 0) / 100)
  const baseRemiseHT = round2(taux.reduce((somme, t) => somme + (remisableParTaux.get(t) || 0), 0) / 100)
  const totalBrutHT = round2(baseRemiseHT + taux.reduce((somme, t) => somme + (horsRemiseParTaux.get(t) || 0), 0) / 100)
  const remiseHT = montantRemise(baseRemiseHT, remise)
  const parts = repartirAuProrata(basesRemisables, remiseHT)
  const bases = taux.map((t, i) => ({
    taux: t,
    base: round2(basesRemisables[i] - parts[i] + (horsRemiseParTaux.get(t) || 0) / 100),
  }))
  return { totalBrutHT, baseRemiseHT, remiseHT, totalHT: round2(totalBrutHT - remiseHT), bases }
}

/** TTC de bases par taux : chaque taux positif porte sa TVA arrondie au centime. */
function ttcDesBases(bases: BaseApresRemise[]): number {
  return round2(bases.reduce((somme, b) => somme + b.base + (b.taux > 0 ? mulMoney(b.base, b.taux / 100) : 0), 0))
}

/**
 * Remise HT (positive) qui fait baisser le TTC de `montantTTC` : saisie « en TTC » de la remise
 * globale, convertie en HT avant d'être enregistrée. Sans TVA facturée (franchise,
 * autoliquidation), le TTC est le HT. Avec plusieurs taux, la TVA arrondie par taux peut empêcher
 * de tomber au centime : on retient l'écart le plus faible, au plus près de l'estimation.
 */
export function remiseHTDepuisTTC(lignes: LigneRemisable[], montantTTC: number, avecTva: boolean): number {
  const sansRemise = appliquerRemiseGlobale(lignes, null)
  const plafond = Math.abs(sansRemise.baseRemiseHT)
  const cible = round2(Math.abs(montantTTC))
  if (plafond === 0 || cible === 0) return 0
  if (!avecTva) return Math.min(cible, plafond)
  const ttcAvant = ttcDesBases(sansRemise.bases)
  const ttcRemisable = Math.abs(ttcAvant - ttcDesBases(appliquerRemiseGlobale(lignes, { type: 'pourcentage', valeur: 100 }).bases))
  if (ttcRemisable === 0) return 0
  const estimation = round2(Math.min(plafond, (cible * plafond) / ttcRemisable))
  let meilleure = 0
  let meilleurEcart = Number.POSITIVE_INFINITY
  for (const pas of [0, -1, 1, -2, 2, -3, 3]) {
    const essai = round2(estimation + pas / 100)
    if (essai <= 0 || essai > plafond) continue
    const apres = appliquerRemiseGlobale(lignes, { type: 'montant', valeur: essai })
    const ecart = Math.abs(Math.abs(ttcAvant - ttcDesBases(apres.bases)) - cible)
    if (ecart < meilleurEcart - 1e-9) {
      meilleure = essai
      meilleurEcart = ecart
    }
  }
  return meilleure
}

/**
 * Baisse du TTC (positive) que produit une remise globale sur ces lignes ; sans TVA facturée,
 * baisse du HT. Sert à afficher en « € TTC » une remise enregistrée en HT.
 */
export function baisseTTCRemise(lignes: LigneRemisable[], remise: unknown, avecTva: boolean): number {
  const apres = appliquerRemiseGlobale(lignes, remise)
  if (!avecTva) return Math.abs(apres.remiseHT)
  return Math.abs(round2(ttcDesBases(appliquerRemiseGlobale(lignes, null).bases) - ttcDesBases(apres.bases)))
}

/**
 * Même remise exprimée dans l'autre unité, sur la même base (changement d'unité dans les
 * formulaires) : 150 € sur 1 000 € deviennent 15 %, et inversement. Le pourcentage n'est pas
 * arrondi (le formulaire l'affiche à deux décimales) : le montant déduit reste identique au
 * centime. Sans base, la valeur est gardée telle quelle.
 */
export function convertirRemise(remise: unknown, vers: TypeRemise, base: number): Remise | null {
  const r = lireRemise(remise)
  if (!r || r.type === vers) return r
  const assiette = Math.abs(base)
  if (!Number.isFinite(assiette) || assiette === 0) return lireRemise({ type: vers, valeur: r.valeur })
  if (vers === 'montant') return lireRemise({ type: 'montant', valeur: Math.abs(montantRemise(assiette, r)) })
  return remiseEnPourcentageExact(r, assiette)
}

/** Vrai si un pourcentage s'écrit exactement avec deux décimales au plus (sinon on affiche le montant). */
export function pourcentageLisible(valeur: number): boolean {
  return Math.abs(valeur * 100 - Math.round(valeur * 100)) < 1e-6
}

/**
 * Pourcentage exact (non arrondi) équivalant à une remise sur une base : appliqué à la même base,
 * il redonne le même montant au centime. Sert aux avoirs, où une remise en euros doit suivre les
 * lignes retirées ou réduites (avoir partiel). Une remise déjà en % est rendue telle quelle.
 */
export function remiseEnPourcentageExact(remise: unknown, base: number): Remise | null {
  const r = lireRemise(remise)
  if (!r || r.type === 'pourcentage') return r
  const assiette = Math.abs(base)
  if (!Number.isFinite(assiette) || assiette === 0) return r
  const exact = (Math.abs(montantRemise(assiette, r)) * 100) / assiette
  // Pourcentage rond au bruit flottant près (150 € sur 1 000 € → 15 %) : valeur propre, même montant.
  const rond = Math.round(exact * 100) / 100
  return lireRemise({ type: 'pourcentage', valeur: Math.abs(exact - rond) < 1e-9 ? rond : exact })
}

/**
 * Lignes ramenées au prix réellement facturé, pour les calculs qui partent des lignes (rentabilité
 * du devis) : total et prix unitaire après la remise globale (même proportion pour chaque ligne) ;
 * une ligne remisée prend pour prix unitaire son total net divisé par sa quantité, son prix saisi
 * étant celui d'avant sa remise. Sans aucune remise, lignes rendues telles quelles.
 */
export function lignesApresRemiseGlobale<T extends { totalHT: number; priceHT: number; qty?: number; remise?: unknown }>(
  lignes: T[], remiseHT: number, baseRemiseHT: number,
): T[] {
  const ratio = remiseHT && baseRemiseHT ? 1 - remiseHT / baseRemiseHT : 1
  if (ratio === 1 && !aUneRemiseDeLigne(lignes)) return lignes
  return lignes.map((l) => {
    const totalHT = ratio === 1 ? l.totalHT : round2(l.totalHT * ratio)
    let priceHT = l.priceHT
    if (lireRemise(l.remise) && l.qty) priceHT = Math.round((totalHT / l.qty) * 10_000) / 10_000
    else if (ratio !== 1) priceHT = Math.round(l.priceHT * ratio * 10_000) / 10_000
    return { ...l, totalHT, priceHT }
  })
}

/** Remise mise à l'échelle d'un document : une remise en euros suit le ratio, une remise en % ne bouge pas. */
export function remiseALEchelle(remise: Remise | undefined, ratio: number): Remise | undefined {
  if (!remise || remise.type !== 'montant') return remise
  return lireRemise({ type: 'montant', valeur: remise.valeur * ratio }) ?? undefined
}

/**
 * Lignes mises à l'échelle (mode « Acompte » du formulaire BTP : lignes pleines × pourcentage).
 * Sans remise : prix et total multipliés et arrondis, comme avant. Ligne remisée : total
 * recalculé depuis le prix et la remise mis à l'échelle, pour rester égal au total affiché.
 */
export function lignesALEchelle<T extends { qty?: number; priceHT?: number; totalHT?: number; remise?: Remise }>(lignes: T[], ratio: number): T[] {
  return lignes.map((l) => {
    const priceHT = round2((l.priceHT || 0) * ratio)
    if (!lireRemise(l.remise)) return { ...l, priceHT, totalHT: round2((l.totalHT || 0) * ratio) }
    const remise = remiseALEchelle(l.remise, ratio)
    return { ...l, priceHT, remise, totalHT: montantNetLigne(l.qty || 0, priceHT, remise) }
  })
}

/** Pourcentage à la française : « 5 », « 2,5 », « 33,33 ». */
export function formaterPourcentage(valeur: number): string {
  return (Math.round(valeur * 100) / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })
}

/** Libellé de la remise globale sur le document : « Remise commerciale (5 %) » ou « Remise commerciale ». */
export function libelleRemiseGlobale(remise: unknown, locale: 'fr' | 'pt' = 'fr'): string {
  const r = lireRemise(remise)
  const base = locale === 'pt' ? 'Desconto comercial' : 'Remise commerciale'
  // Pourcentage non rond (avoir d'une remise en €, conversion d'unité) : « 6,67 % » ne
  // correspondrait pas au montant imprimé à côté ; le libellé reste sans pourcentage.
  return r && r.type === 'pourcentage' && pourcentageLisible(r.valeur) ? `${base} (${formaterPourcentage(r.valeur)} %)` : base
}

/**
 * Texte de la colonne Remise d'une ligne dans les PDF : « -10 % » ou « -150,00 € » (vide sans
 * remise). Trait d'union ASCII : la police Helvetica des PDF n'a pas le signe moins Unicode.
 */
export function texteRemiseLigne(remise: unknown, formaterMontant: (montant: number) => string, brut?: number): string {
  const r = lireRemise(remise)
  if (!r) return ''
  // Pourcentage rond, ou montant inconnu faute de base : le pourcentage.
  if (r.type === 'pourcentage' && (pourcentageLisible(r.valeur) || brut === undefined)) return `-${formaterPourcentage(r.valeur)} %`
  // Montant réellement déduit : une remise de 150 € sur une ligne de 100 € n'en retire que 100, et un
  // pourcentage non rond (6,666… %) s'imprime par son montant exact plutôt qu'arrondi.
  const montant = brut === undefined ? r.valeur : Math.abs(montantRemise(brut, r))
  return montant ? `-${formaterMontant(montant)}` : ''
}

/** Vrai si au moins une ligne porte une remise (la colonne Remise du PDF n'apparaît qu'alors). */
export function aUneRemiseDeLigne(lignes: ReadonlyArray<unknown>): boolean {
  return (lignes || []).some((l) => !!l && typeof l === 'object' && lireRemise((l as { remise?: unknown }).remise) !== null)
}
