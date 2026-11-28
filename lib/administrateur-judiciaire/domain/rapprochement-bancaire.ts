import { estDateIsoValide, messagePlausibilite, plausibiliteDate } from '@/lib/administrateur-judiciaire/domain/dates'
import { formatEurosCentimes } from '@/lib/administrateur-judiciaire/domain/format'

/**
 * Rapprochement bancaire par arrêtés successifs (cartographie Gestéam, tranche 29). Fonctions pures, montants en
 * CENTIMES ENTIERS signés (+ entrée, − sortie, du point de vue du syndicat), sans écran.
 *
 * D1 (27/10/2026) — le compte rapproché est un compte bancaire du SYNDICAT.
 *
 * Gestéam — « Liste des rapprochements bancaires » : No compte · Libellé · Sld.banque · Sld.compta · Date · Équilibre ·
 * Rap% · Man% · Statut (En cours / Clôturé) ; boutons Nouveau, Déclôturer, Éléments rapprochés, Lancer le
 * rapprochement. Un arrêté environ tous les dix jours, un seul en cours.
 *
 * Équilibre : solde banque − éléments de banque non rapprochés = solde compta − éléments comptables non rapprochés
 * (les suspens de chaque côté sont ce que l'autre côté n'a pas encore enregistré).
 *
 * Décision du 26/11/2026 (PR 799, rb-01 A) — un arrêté « En cours » mal saisi s'abandonne (abandonnerArrete) : absent de
 * Gestéam, règle de gestion VitFix. L'arrêté abandonné est d'un autre type (ArreteAbandonne) : aucune règle de ce
 * fichier ni de rapprochement-pieces.ts ne le reçoit, il n'entre donc dans aucun solde ni aucune période arrêtée.
 *
 * Décision du 26/11/2026 (PR 799, rb-16 A) — deux règles, jusqu'ici propres à l'écran, sont ici, pour toute écriture des
 * arrêtés quel que soit l'écran : date d'arrêté ni future ni improbable (refusDateArrete, appliquée par ouvrirArrete) ;
 * aucune écriture tant qu'un arrêté illisible reste sur le compte (refusArretesIllisibles : la règle et son message,
 * appliqués par db/rapprochements.ts, seul à lire les lignes de la base).
 */

/** Statuts d'un arrêté qui compte ; l'arrêté abandonné porte STATUT_ARRETE_ABANDONNE, hors de ce type. */
export type StatutArrete = 'En cours' | 'Clôturé'

export const STATUT_ARRETE_ABANDONNE = 'Abandonné'

/** Nature d'une pièce soldée par un élément rapproché : règlement (sortie, point 38) ou encaissement (entrée, point 16). */
export type TypePieceRapprochee = 'reglement' | 'encaissement'

/** Pièce que l'élément solde ; lue par rapprochement-pieces.ts pour propager le statut « Rapproché ». */
export interface PieceRapprochee {
  type: TypePieceRapprochee
  id: string
}

export interface ElementRapprochement {
  id: string
  /** Ligne du relevé (« banque ») ou écriture du compte 512 (« compta »). */
  cote: 'banque' | 'compta'
  montantCentimes: number
  /** false = en suspens ; « auto » = rapproché par le moteur ; « manuel » = pointé par le gestionnaire. */
  rapproche: false | 'auto' | 'manuel'
  /** Date d'opération (AAAA-MM-JJ) : date de la ligne du relevé ou de l'écriture. */
  date?: string
  /** Jour du rapprochement (AAAA-MM-JJ) ; exigé par suspensA pour un élément rapproché ; null tant qu'il est en suspens. */
  rapprocheLe?: string | null
  /**
   * Pièces soldées par l'élément (ligne de virement groupé : tous ses règlements, voir LigneVirement.reglementIds) ;
   * absent : aucune. Facultatif et sans effet sur l'état de l'arrêté.
   */
  pieces?: PieceRapprochee[]
}

export interface ArreteRapprochement {
  id: string
  banqueId: string
  dateArrete: string
  soldeBanqueCentimes: number
  soldeComptaCentimes: number
  statut: StatutArrete
  elements: ElementRapprochement[]
}

export interface EtatArrete {
  soldeBanqueAjusteCentimes: number
  soldeComptaAjusteCentimes: number
  ecartCentimes: number
  equilibre: boolean
  suspensBanque: number
  suspensCompta: number
  tauxAutoPct: number
  tauxManuelPct: number
}

const somme = (elements: ElementRapprochement[]) => elements.reduce((s, e) => s + e.montantCentimes, 0)
const pct = (n: number, total: number) => (total ? Math.round((n / total) * 1000) / 10 : 0)

export function etatArrete(arrete: ArreteRapprochement): EtatArrete {
  const suspens = (cote: ElementRapprochement['cote']) => arrete.elements.filter((e) => e.cote === cote && e.rapproche === false)
  const soldeBanqueAjusteCentimes = arrete.soldeBanqueCentimes - somme(suspens('banque'))
  const soldeComptaAjusteCentimes = arrete.soldeComptaCentimes - somme(suspens('compta'))
  const ecartCentimes = soldeBanqueAjusteCentimes - soldeComptaAjusteCentimes
  const total = arrete.elements.length
  return {
    soldeBanqueAjusteCentimes,
    soldeComptaAjusteCentimes,
    ecartCentimes,
    equilibre: ecartCentimes === 0,
    suspensBanque: suspens('banque').length,
    suspensCompta: suspens('compta').length,
    tauxAutoPct: pct(arrete.elements.filter((e) => e.rapproche === 'auto').length, total),
    tauxManuelPct: pct(arrete.elements.filter((e) => e.rapproche === 'manuel').length, total),
  }
}

/**
 * Règle commune (décision du 26/11/2026, PR 799, rb-16 A ; jusqu'ici propre à l'écran) : un arrêté constate un solde
 * passé, sa date n'est donc ni future ni d'une année improbable (plausibiliteDate). `dateArrete` et `aujourdhui` :
 * AAAA-MM-JJ valides, sinon une erreur est levée. null si la date est plausible, sinon le refus, dit comme à l'écran.
 */
export function refusDateArrete(dateArrete: string, aujourdhui: string): string | null {
  const anomalie = plausibiliteDate(dateArrete, aujourdhui, { futurAdmis: false })
  return anomalie ? messagePlausibilite('Arrêté daté', dateArrete, anomalie) : null
}

/**
 * Règle commune (même décision, rb-16 A) : une ligne de la base sans la forme d'un arrêté (écrite hors de l'écran)
 * pourrait cacher un arrêté en cours, plus récent ou clôturé. Tant qu'il en reste une sur le compte, aucune écriture sur
 * ses arrêtés (ouverture, clôture, déclôture, abandon…). `illisibles` : nombre de ces lignes sur le compte. null s'il n'y
 * en a aucune, sinon le refus. Seule la base lit ces lignes : c'est elle qui l'applique (db/rapprochements.ts,
 * arretesSurs), l'écran s'en sert pour désactiver ses boutons.
 */
export function refusArretesIllisibles(illisibles: number): string | null {
  if (!Number.isInteger(illisibles) || illisibles < 0) throw new Error(`Nombre d'arrêtés illisibles invalide (${illisibles}).`)
  if (illisibles === 0) return null
  const s = illisibles > 1 ? 's' : ''
  return `${illisibles} arrêté${s} illisible${s} sur ce compte (écrit${s} hors de l’écran) : à reprendre dans la base locale d’abord.`
}

/**
 * Ouvre un arrêté : un seul « En cours » par compte, date postérieure au dernier arrêté du compte, ni future ni d'une
 * année improbable au jour `aujourdhui` (AAAA-MM-JJ valide, sinon erreur ; refusDateArrete). Ce dernier refus est levé
 * après les autres : un arrêté déjà en cours, ou une date non postérieure, gardent leur message. L'écran contrôle la
 * date en premier (arretes-vue.ts) : une faute de frappe sur l'année y est dite comme telle.
 */
export function ouvrirArrete(
  existants: ArreteRapprochement[],
  saisie: Pick<ArreteRapprochement, 'id' | 'banqueId' | 'dateArrete' | 'soldeBanqueCentimes' | 'soldeComptaCentimes'>,
  aujourdhui: string,
): ArreteRapprochement {
  if (!estDateIsoValide(saisie.dateArrete)) throw new Error(`Date d'arrêté invalide (${saisie.dateArrete}) : AAAA-MM-JJ attendu.`)
  // Calculé d'abord (un jour de référence invalide lève tout de suite), levé en dernier.
  const refusDate = refusDateArrete(saisie.dateArrete, aujourdhui)
  for (const [nom, montant] of [
    ['solde banque', saisie.soldeBanqueCentimes],
    ['solde compta', saisie.soldeComptaCentimes],
  ] as const)
    if (!Number.isInteger(montant)) throw new Error(`${nom} invalide (${montant}) : centimes entiers attendus.`)
  const duCompte = existants.filter((a) => a.banqueId === saisie.banqueId)
  if (duCompte.some((a) => a.statut === 'En cours')) throw new Error('Un arrêté est déjà en cours sur ce compte : le clôturer d’abord.')
  const dernier = duCompte.reduce<string | null>((max, a) => (max === null || a.dateArrete > max ? a.dateArrete : max), null)
  if (dernier && saisie.dateArrete <= dernier) throw new Error(`Date d'arrêté non postérieure au dernier arrêté du compte (${dernier}).`)
  if (refusDate) throw new Error(refusDate)
  return { ...saisie, statut: 'En cours', elements: [] }
}

/**
 * Clôture un arrêté en cours, à l'équilibre seulement. Un arrêté déjà clôturé est refusé : ses soldes sont figés à la
 * clôture (décision du 26/11/2026, rb-03 A), seule une déclôture le rouvre.
 * Le calcul de la base (cloturerArreteCompte : solde compta recalculé dans la transaction) fait foi ; l'écran n'en montre
 * qu'une estimation. L'écart est dit en euros, comme dans le panneau (espaces insécables U+00A0, jamais U+202F).
 */
export function cloturerArrete(arrete: ArreteRapprochement): ArreteRapprochement {
  if (arrete.statut !== 'En cours') throw new Error('Clôture refusée : arrêté déjà clôturé.')
  const { equilibre, ecartCentimes } = etatArrete(arrete)
  if (!equilibre) {
    const ecart = formatEurosCentimes(ecartCentimes / 100).replaceAll(' ', ' ')
    throw new Error(`Clôture refusée : arrêté non équilibré (écart ${ecart}).`)
  }
  return { ...arrete, statut: 'Clôturé' }
}

/** Arrêté abandonné : gardé pour mémoire avec ses montants, hors de toute règle (voir l'en-tête). */
export interface ArreteAbandonne extends Omit<ArreteRapprochement, 'statut'> {
  statut: typeof STATUT_ARRETE_ABANDONNE
}

/**
 * Abandonne un arrêté « En cours » mal saisi (solde banque ou date erronés) : décision du 26/11/2026, rb-01 A. Jamais un
 * arrêté clôturé. Refusé tant qu'un élément y est pointé : les pièces pointées sont « Rapproché » (J8), un pointage ne
 * se perd pas sans bruit ; les éléments en suspens, eux, ne valent que pour cet arrêté.
 */
export function abandonnerArrete(arrete: ArreteRapprochement): ArreteAbandonne {
  if (arrete.statut !== 'En cours')
    throw new Error(`Abandon refusé : seul un arrêté en cours peut être abandonné (arrêté « ${arrete.statut} »).`)
  const pointes = arrete.elements.filter((element) => element.rapproche !== false).length
  if (pointes > 0) {
    const s = pointes > 1 ? 's' : ''
    throw new Error(`Abandon refusé : ${pointes} élément${s} pointé${s} sur cet arrêté, à dépointer d’abord.`)
  }
  return { ...arrete, statut: STATUT_ARRETE_ABANDONNE }
}

export interface SuspensALaDate {
  banque: ElementRapprochement[]
  compta: ElementRapprochement[]
  totalBanqueCentimes: number
  totalComptaCentimes: number
}

/**
 * Jour à partir duquel un élément n'est plus en suspens ; null s'il ne l'est jamais. Exige la date de rapprochement d'un
 * élément rapproché, postérieure ou égale à son opération (règle partagée par suspensA et rapprochement-pieces.ts).
 */
export function finDuSuspens(e: ElementRapprochement & { date: string }): string | null {
  if (e.rapproche === false) return null
  if (e.rapprocheLe == null)
    throw new Error(`Élément « ${e.id} » rapproché sans date de rapprochement (AAAA-MM-JJ attendu) : ses suspens passés ne peuvent pas être calculés.`)
  if (!estDateIsoValide(e.rapprocheLe)) throw new Error(`Élément « ${e.id} » : date de rapprochement invalide (${e.rapprocheLe}), AAAA-MM-JJ attendu.`)
  if (e.rapprocheLe < e.date) throw new Error(`Élément « ${e.id} » : rapproché le ${e.rapprocheLe}, antérieur à son opération (${e.date}).`)
  return e.rapprocheLe
}

/**
 * Mouvements bancaires en suspens à une date (point 40 du bilan 2 ; Gestéam, tranche 43 § 20, particularité des
 * mouvements) : opérés au plus tard ce jour et pas encore rapprochés ce jour-là, côté banque et côté compta. 🔵 Le jour
 * du rapprochement, l'élément n'est plus en suspens. Chaque élément doit porter sa date d'opération et, s'il est
 * rapproché, sa date de rapprochement : sans elle, sa contrepartie a pu être enregistrée plus tard et le suspens serait
 * perdu sans bruit.
 */
export function suspensA(elements: ElementRapprochement[], date: string): SuspensALaDate {
  if (!estDateIsoValide(date)) throw new Error(`Date invalide (${date}) : AAAA-MM-JJ attendu.`)
  const enSuspens = elements.filter((e) => {
    if (e.date === undefined || !estDateIsoValide(e.date))
      throw new Error(`Élément « ${e.id} » sans date d'opération valide (AAAA-MM-JJ attendu).`)
    const fin = finDuSuspens({ ...e, date: e.date })
    return e.date <= date && (fin === null || date < fin)
  })
  const banque = enSuspens.filter((e) => e.cote === 'banque')
  const compta = enSuspens.filter((e) => e.cote === 'compta')
  return { banque, compta, totalBanqueCentimes: somme(banque), totalComptaCentimes: somme(compta) }
}

/** Déclôture le dernier arrêté clôturé d'un compte, à condition qu'aucun arrêté ne soit en cours sur ce compte. */
export function decloturerArrete(arretes: ArreteRapprochement[], id: string): ArreteRapprochement {
  const cible = arretes.find((a) => a.id === id)
  if (!cible) throw new Error(`Arrêté introuvable : « ${id} ».`)
  const duCompte = arretes.filter((a) => a.banqueId === cible.banqueId)
  if (duCompte.some((a) => a.statut === 'En cours')) throw new Error('Déclôture refusée : un arrêté est en cours sur ce compte.')
  const dernier = duCompte.filter((a) => a.statut === 'Clôturé').sort((a, b) => b.dateArrete.localeCompare(a.dateArrete))[0]
  if (dernier?.id !== id) throw new Error('Déclôture refusée : seul le dernier arrêté clôturé du compte peut être déclôturé.')
  return { ...cible, statut: 'En cours' }
}

/**
 * Contrôle avant la clôture d'un compte bancaire (réponse du référent métier du 28/11/2026, PR 857, point 1, choix A) :
 * refusée tant qu'un arrêté du compte est en cours, avec ce qu'il faut faire d'abord (le clôturer ou l'abandonner). Sur
 * un compte clôturé, les arrêtés sont en lecture seule : l'arrêté resterait « En cours » pour toujours. Règle de gestion
 * VitFix. Les arrêtés clôturés ne bloquent pas ; un arrêté abandonné n'est pas reçu (autre type).
 */
export function verifierClotureCompteBancaire(banqueId: string, arretes: readonly ArreteRapprochement[]): void {
  if (arretes.some((a) => a.banqueId === banqueId && a.statut === 'En cours'))
    throw new Error('Un arrêté est en cours sur ce compte : le clôturer ou l’abandonner d’abord.')
}
