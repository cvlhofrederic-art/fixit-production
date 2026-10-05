// Facture d'acompte BTP : UNE ligne de synthèse par taux de TVA (côté BTP Pro uniquement).
//
// buildAcomptePrefill (partagé avec le côté artisan, inchangé) recopie toutes les lignes du
// parent au pourcentage. Côté BTP, l'acompte porte une seule ligne par taux de TVA du devis :
// le taux figure sur chaque ligne et le total HT / la taxe ressortent par taux (CGI annexe II,
// art. 242 nonies A, I-8° et I-11°). En autoliquidation ou en franchise, aucune TVA n'est
// facturée : une seule ligne, sans taux.
//
// Tout est calculé en centimes entiers : la somme des lignes vaut exactement le pourcentage
// du total HT du parent, arrondi au centime (répartition au plus fort reste). La dernière
// échéance d'un échéancier (cumul de 100 %) est calculée par différence, taux par taux, pour
// que la somme des acomptes égale le devis au centime.

import { buildAcomptePrefill, type AcompteParams } from '@/lib/acompte-prefill'
import { buildDocumentLines } from '@/lib/devis-totals'
import { mulMoney, toCents } from '@/lib/money'
import { getMentionLegale, type TvaLocale, type TvaRegime } from '@/lib/tva-calculator'

type DocumentLike = Record<string, unknown>
type LigneLike = Record<string, unknown>

export interface BaseParTaux {
  /** Taux de TVA en % (0 = sans TVA). */
  taux: number
  /** Base HT en centimes. */
  baseCents: number
}

export interface LigneAcompteParTaux {
  id: number
  description: string
  lineDetail: string
  qty: number
  unit: string
  priceHT: number
  tvaRate: number
  totalHT: number
  source: 'manual'
}

/** Ce qui a déjà été facturé en acomptes sur le même parent (pour solder la dernière échéance). */
export interface AcomptesDejaFactures {
  /** Somme des pourcentages des acomptes déjà émis. */
  pourcentageCumule: number
  /** Bases HT déjà facturées, par taux. */
  basesParTaux: BaseParTaux[]
  /** Nombre d'acomptes déjà émis (borne l'écart d'arrondi admis sur la dernière échéance). */
  nombre?: number
}

export interface OptionsAcompteParTaux {
  locale?: TvaLocale
  dejaFacture?: AcomptesDejaFactures
}

/** Date du jour AAAA-MM-JJ dans le fuseau du poste (toISOString donnerait la veille entre minuit et 2 h). */
export function dateDuJourLocale(maintenant: Date = new Date()): string {
  const mois = String(maintenant.getMonth() + 1).padStart(2, '0')
  const jour = String(maintenant.getDate()).padStart(2, '0')
  return `${maintenant.getFullYear()}-${mois}-${jour}`
}

/** Régime de TVA effectif d'un document (même repli que le PDF V3 et la liste Factures). */
export function regimeTvaEffectif(doc: DocumentLike): TvaRegime {
  const regime = doc.regimeTva
  if (regime === 'classique' || regime === 'franchise_293b' || regime === 'autoliquidation_btp') return regime
  if (doc.autoliquidationBTP === true) return 'autoliquidation_btp'
  return doc.tvaEnabled === false ? 'franchise_293b' : 'classique'
}

const nombreFini = (valeur: unknown): valeur is number => typeof valeur === 'number' && Number.isFinite(valeur)

/**
 * Lignes d'un DEVIS BTP avec le total recalculé (quantité × prix unitaire). Le formulaire BTP
 * affiche et imprime quantité × prix ; le total stocké peut être périmé (prestation changée
 * après saisie de la quantité, import non arrondi). Une facture ou un acompte construits
 * sans relecture doivent porter le montant que l'utilisateur a vu sur son devis.
 */
export function recalculerTotauxLignes<T extends DocumentLike>(doc: T): T {
  return transformerLignes(doc, (l) => (nombreFini(l.qty) && nombreFini(l.priceHT) ? { ...l, totalHT: mulMoney(l.qty, l.priceHT) } : l))
}

/**
 * Applique une transformation à chaque ligne du document (sections et tables personnalisées).
 * Les entrées qui ne sont pas des lignes (null dans un document hérité) sont écartées.
 */
export function transformerLignes<T extends DocumentLike>(doc: T, transformer: (ligne: LigneLike) => LigneLike): T {
  const collection = (lignes: unknown[]): unknown[] =>
    lignes.filter((ligne) => ligne !== null && typeof ligne === 'object').map((ligne) => transformer(ligne as LigneLike))
  const copie: DocumentLike = { ...doc }
  for (const cle of ['lines', 'laborLines', 'materialLines', 'fraisLines']) {
    if (Array.isArray(doc[cle])) copie[cle] = collection(doc[cle] as unknown[])
  }
  if (Array.isArray(doc.customTables)) {
    copie.customTables = doc.customTables.map((table: unknown) =>
      table && typeof table === 'object' && Array.isArray((table as LigneLike).lines)
        ? { ...(table as LigneLike), lines: collection((table as LigneLike).lines as unknown[]) }
        : table,
    )
  }
  return copie as T
}

/**
 * Bases HT (centimes) par taux de TVA, sur le même périmètre que computeDocumentTotalHT
 * (sections masquées exclues, tables personnalisées aplaties). Devis : totaux de ligne
 * recalculés (quantité × prix) ; facture émise : totaux de ligne facturés. Hors régime
 * classique, aucune TVA n'est facturée : une seule base, au taux 0. Taux décroissants ;
 * bases nulles omises.
 */
export function basesHtParTaux(doc: DocumentLike): BaseParTaux[] {
  const classique = regimeTvaEffectif(doc) === 'classique'
  const source = doc.docType === 'devis' ? recalculerTotauxLignes(doc) : doc
  const parTaux = new Map<number, number>()
  for (const ligne of buildDocumentLines(source as Parameters<typeof buildDocumentLines>[0])) {
    const ht = ligne.totalHT ?? ligne.total_ht ?? ligne.total ?? 0
    const tauxBrut = Number(ligne.tvaRate ?? ligne.tva_rate ?? 0)
    const taux = classique && Number.isFinite(tauxBrut) && tauxBrut > 0 ? tauxBrut : 0
    parTaux.set(taux, (parTaux.get(taux) || 0) + toCents(Number(ht)))
  }
  return ordonnerBases(parTaux)
}

/** Somme de plusieurs jeux de bases, taux par taux (bases nulles omises, taux décroissants). */
export function additionnerBases(...jeux: BaseParTaux[][]): BaseParTaux[] {
  const parTaux = new Map<number, number>()
  for (const jeu of jeux) for (const b of jeu) parTaux.set(b.taux, (parTaux.get(b.taux) || 0) + b.baseCents)
  return ordonnerBases(parTaux)
}

function ordonnerBases(parTaux: Map<number, number>): BaseParTaux[] {
  return Array.from(parTaux.entries())
    .filter(([, baseCents]) => baseCents !== 0)
    .sort(([a], [b]) => b - a)
    .map(([taux, baseCents]) => ({ taux, baseCents }))
}

export const totalBasesCents = (bases: BaseParTaux[]): number => bases.reduce((somme, b) => somme + b.baseCents, 0)

/** Arrondi au plus proche d'un quotient d'entiers, demi vers l'extérieur (symétrique). */
function quotientArrondi(numerateur: number, denominateur: number): number {
  const signe = numerateur < 0 ? -1 : 1
  return signe * Math.floor((2 * Math.abs(numerateur) + denominateur) / (2 * denominateur))
}

/** Pourcentage ramené à deux décimales (le calcul se fait en centièmes de pour cent). */
export const arrondirPourcentage = (pourcentage: number): number => Math.round(pourcentage * 100) / 100

/**
 * Applique un pourcentage à des bases par taux. La somme des parts vaut exactement
 * l'arrondi au centime de (total × pourcentage) : chaque part est arrondie à l'inférieur puis
 * les centimes restants vont aux plus forts restes (à égalité : base la plus élevée, puis
 * taux le plus élevé).
 */
export function repartirPourcentageParTaux(bases: BaseParTaux[], pourcentage: number): BaseParTaux[] {
  const DENOMINATEUR = 10_000
  const pourcentageCentiemes = Math.round(pourcentage * 100)
  const cible = quotientArrondi(totalBasesCents(bases) * pourcentageCentiemes, DENOMINATEUR)
  const parts = bases.map((b) => {
    const produit = b.baseCents * pourcentageCentiemes
    const plancher = Math.floor(produit / DENOMINATEUR)
    return { taux: b.taux, baseCents: b.baseCents, part: plancher, reste: produit - plancher * DENOMINATEUR }
  })
  let centimesRestants = cible - parts.reduce((somme, p) => somme + p.part, 0)
  const parReste = [...parts].sort((a, b) => b.reste - a.reste || b.baseCents - a.baseCents || b.taux - a.taux)
  for (const p of parReste) {
    if (centimesRestants <= 0) break
    p.part += 1
    centimesRestants -= 1
  }
  return parts.map((p) => ({ taux: p.taux, baseCents: p.part }))
}

/**
 * Écart admis, par taux, entre le reliquat et le pourcentage annoncé sur la dernière échéance.
 * Les acomptes émis avant ce module arrondissaient chaque ligne du devis une à une : sur un
 * devis d'une quarantaine de lignes, leur cumul s'écarte de quelques dizaines de centimes.
 */
const TOLERANCE_RELIQUAT_CENTS = 50

/**
 * Parts d'un acompte par taux. Quand l'acompte porte le cumul des échéances à 100 %, il prend
 * le reliquat du parent (base − acomptes déjà facturés), taux par taux : des acomptes arrondis
 * un à un dépasseraient sinon le devis d'un ou deux centimes. Le reliquat ne sert qu'à absorber
 * ces arrondis : s'il s'écarte du pourcentage annoncé de plus de quelques dizaines de centimes
 * sur un taux (devis modifié, avoir partiel sur un acompte), on revient au calcul direct — le
 * libellé « Acompte de X % » reste vrai et la facture de solde reprend l'écart.
 */
function partsAcompte(bases: BaseParTaux[], pourcentage: number, dejaFacture?: AcomptesDejaFactures): BaseParTaux[] {
  const directes = repartirPourcentageParTaux(bases, pourcentage)
  if (!dejaFacture || dejaFacture.basesParTaux.length === 0) return directes
  if (Math.abs(dejaFacture.pourcentageCumule + pourcentage - 100) >= 0.005) return directes
  const tauxDuParent = new Set(bases.map((b) => b.taux))
  if (!dejaFacture.basesParTaux.every((b) => tauxDuParent.has(b.taux))) return directes
  const dejaParTaux = new Map(dejaFacture.basesParTaux.map((b) => [b.taux, b.baseCents]))
  const reliquat = bases.map((b) => ({ taux: b.taux, baseCents: b.baseCents - (dejaParTaux.get(b.taux) || 0) }))
  const toleranceCents = Math.max(TOLERANCE_RELIQUAT_CENTS, (dejaFacture.nombre ?? 0) + 1)
  const arrondiSeul = reliquat.every((r, i) => r.baseCents > 0 && Math.abs(r.baseCents - directes[i].baseCents) <= toleranceCents)
  return arrondiSeul ? reliquat : directes
}

/** Nombre à la française : virgule décimale, sans zéros inutiles (5,5 — 33,33 — 20). */
export function formaterNombre(valeur: number): string {
  return String(Math.round(valeur * 100) / 100).replace('.', ',')
}

/** Montant en euros depuis des centimes : « 10 000,00 » (espaces ordinaires, rendus tels quels par le PDF). */
export function formaterMontantCents(cents: number): string {
  const absolu = Math.abs(cents)
  const euros = String(Math.floor(absolu / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return `${cents < 0 ? '-' : ''}${euros},${String(absolu % 100).padStart(2, '0')}`
}

/** « 2026-09-12 » (ou date ISO complète) → « 12/09/2026 » ; chaîne vide si la date est absente. */
export function formaterDateCourte(date: unknown): string {
  const correspondance = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(date || ''))
  return correspondance ? `${correspondance[3]}/${correspondance[2]}/${correspondance[1]}` : ''
}

/** Référence du document parent : « Devis n° DEV-2026-009 du 12/09/2026 ». */
function referenceParent(parent: DocumentLike, locale: TvaLocale): string {
  const numero = String(parent.docNumber || '')
  const date = formaterDateCourte(parent.docDate)
  const estDevis = parent.docType === 'devis'
  if (locale === 'pt') {
    return `${estDevis ? 'Orçamento' : 'Fatura'} n.º ${numero}${date ? ` de ${date}` : ''}`
  }
  return `${estDevis ? 'Devis' : 'Facture'} n° ${numero}${date ? ` du ${date}` : ''}`
}

function designationAcompte(pourcentage: string, taux: number, regime: TvaRegime, locale: TvaLocale): string {
  if (locale === 'pt') {
    if (regime === 'autoliquidation_btp') return `Adiantamento de ${pourcentage} % por conta dos trabalhos — IVA - autoliquidação`
    if (regime === 'franchise_293b') return `Adiantamento de ${pourcentage} % por conta dos trabalhos`
    if (taux <= 0) return `Adiantamento de ${pourcentage} % por conta de operações não sujeitas a IVA`
    return `Adiantamento de ${pourcentage} % por conta dos trabalhos sujeitos a IVA à taxa de ${formaterNombre(taux)} %`
  }
  if (regime === 'autoliquidation_btp') return `Acompte de ${pourcentage} % sur travaux sous-traités — autoliquidation de la TVA`
  if (regime === 'franchise_293b') return `Acompte de ${pourcentage} % sur travaux`
  if (taux <= 0) return `Acompte de ${pourcentage} % sur prestations facturées sans TVA`
  return `Acompte de ${pourcentage} % sur travaux soumis à la TVA au taux de ${formaterNombre(taux)} %`
}

function detailAcompte(parent: DocumentLike, baseCents: number, regime: TvaRegime, taux: number, locale: TvaLocale): string {
  const reference = referenceParent(parent, locale)
  const aCeTaux = regime === 'classique' && taux > 0
  const montant = `${formaterMontantCents(baseCents)} €`
  // Deux lignes courtes : la colonne Désignation du PDF est étroite, une ligne longue serait
  // coupée au milieu du montant. En franchise, ni « HT » ni taux : aucune TVA n'est facturée.
  if (locale === 'pt') {
    if (regime === 'franchise_293b') return `${reference}\nMontante dos trabalhos: ${montant}`
    return `${reference}\nBase tributável${aCeTaux ? ' a esta taxa' : ''}: ${montant}`
  }
  if (regime === 'franchise_293b') return `${reference}\nMontant des travaux : ${montant}`
  return `${reference}\nBase HT${aCeTaux ? ' à ce taux' : ''} : ${montant}`
}

/**
 * Lignes d'une facture d'acompte : une par taux de TVA du parent (une seule, sans taux, en
 * autoliquidation ou en franchise). Tableau vide si le parent n'a aucun montant.
 */
export function buildAcompteLinesParTaux(
  parent: DocumentLike,
  pourcentage: number,
  options: OptionsAcompteParTaux = {},
): LigneAcompteParTaux[] {
  const locale = options.locale ?? 'fr'
  const regime = regimeTvaEffectif(parent)
  const taux2 = arrondirPourcentage(pourcentage)
  const bases = basesHtParTaux(parent)
  const parts = partsAcompte(bases, taux2, options.dejaFacture)
  const pourcentageTexte = formaterNombre(taux2)
  return parts
    .map((part, index) => ({ part, base: bases[index] }))
    .filter(({ part }) => part.baseCents !== 0)
    .map(({ part, base }, index) => ({
      id: index + 1,
      description: designationAcompte(pourcentageTexte, part.taux, regime, locale),
      lineDetail: detailAcompte(parent, base.baseCents, regime, part.taux, locale),
      qty: 1,
      unit: 'f',
      priceHT: part.baseCents / 100,
      tvaRate: part.taux,
      totalHT: part.baseCents / 100,
      source: 'manual' as const,
    }))
}

/**
 * Facture d'acompte BTP prête à émettre : métadonnées de buildAcomptePrefill (lien devis,
 * ordre, pourcentage, parent), lignes remplacées par une ligne par taux de TVA.
 */
export function buildAcompteParTauxPrefill(
  parent: DocumentLike,
  params: AcompteParams,
  options: OptionsAcompteParTaux = {},
): DocumentLike {
  const locale = options.locale ?? 'fr'
  const regime = regimeTvaEffectif(parent)
  const pourcentageArrondi = arrondirPourcentage(params.percentage)
  const pourcentage = formaterNombre(pourcentageArrondi)
  const titreParent = String(parent.docTitle || parent.docNumber || '')
  const reference = referenceParent(parent, locale)
  const mention = getMentionLegale(regime, locale)
  const estDevis = parent.docType === 'devis'
  const docTitle = locale === 'pt'
    ? `Adiantamento n.º ${params.ordre} de ${params.total} (${pourcentage} %) — ${titreParent}`
    : `Acompte n° ${params.ordre} sur ${params.total} (${pourcentage} %) — ${titreParent}`
  const referenceMinuscule = reference.charAt(0).toLowerCase() + reference.slice(1)
  const notes = locale === 'pt'
    ? `Adiantamento de ${pourcentage} % (n.º ${params.ordre} de ${params.total}) por conta ${estDevis ? 'do' : 'da'} ${referenceMinuscule}. Vencimento: ${params.declencheur}.`
    : `Acompte de ${pourcentage} % (n° ${params.ordre} sur ${params.total}) sur ${estDevis ? 'le' : 'la'} ${referenceMinuscule}. Échéance : ${params.declencheur}.`
  return {
    ...buildAcomptePrefill(parent, { ...params, percentage: pourcentageArrondi }),
    // Date d'émission dans le fuseau du poste, comme la facture émise directement.
    docDate: dateDuJourLocale(),
    lines: buildAcompteLinesParTaux(parent, pourcentageArrondi, options),
    laborLines: undefined,
    materialLines: [],
    fraisLines: [],
    fraisAnnexes: [],
    customTables: [],
    materialLinesEnabled: false,
    fraisLinesEnabled: false,
    linesName: locale === 'pt' ? 'Adiantamento' : 'Acompte',
    // Une remise héritée serait déduite en entier du total de l'acompte par le PDF.
    discount: '',
    regimeTva: regime,
    docTitle,
    notes: mention ? `${notes} ${mention}` : notes,
  }
}
