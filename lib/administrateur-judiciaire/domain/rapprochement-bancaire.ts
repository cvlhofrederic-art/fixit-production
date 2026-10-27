import { estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'

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
 */

export type StatutArrete = 'En cours' | 'Clôturé'

export interface ElementRapprochement {
  id: string
  /** Ligne du relevé (« banque ») ou écriture du compte 512 (« compta »). */
  cote: 'banque' | 'compta'
  montantCentimes: number
  /** false = en suspens ; « auto » = rapproché par le moteur ; « manuel » = pointé par le gestionnaire. */
  rapproche: false | 'auto' | 'manuel'
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

/** Ouvre un arrêté : un seul « En cours » par compte, date postérieure au dernier arrêté du compte. */
export function ouvrirArrete(
  existants: ArreteRapprochement[],
  saisie: Pick<ArreteRapprochement, 'id' | 'banqueId' | 'dateArrete' | 'soldeBanqueCentimes' | 'soldeComptaCentimes'>,
): ArreteRapprochement {
  if (!estDateIsoValide(saisie.dateArrete)) throw new Error(`Date d'arrêté invalide (${saisie.dateArrete}) : AAAA-MM-JJ attendu.`)
  for (const [nom, montant] of [
    ['solde banque', saisie.soldeBanqueCentimes],
    ['solde compta', saisie.soldeComptaCentimes],
  ] as const)
    if (!Number.isInteger(montant)) throw new Error(`${nom} invalide (${montant}) : centimes entiers attendus.`)
  const duCompte = existants.filter((a) => a.banqueId === saisie.banqueId)
  if (duCompte.some((a) => a.statut === 'En cours')) throw new Error('Un arrêté est déjà en cours sur ce compte : le clôturer d’abord.')
  const dernier = duCompte.reduce<string | null>((max, a) => (max === null || a.dateArrete > max ? a.dateArrete : max), null)
  if (dernier && saisie.dateArrete <= dernier) throw new Error(`Date d'arrêté non postérieure au dernier arrêté du compte (${dernier}).`)
  return { ...saisie, statut: 'En cours', elements: [] }
}

/** Clôture un arrêté à l'équilibre seulement. */
export function cloturerArrete(arrete: ArreteRapprochement): ArreteRapprochement {
  const { equilibre, ecartCentimes } = etatArrete(arrete)
  if (!equilibre) throw new Error(`Clôture refusée : arrêté non équilibré (écart ${ecartCentimes} centimes).`)
  return { ...arrete, statut: 'Clôturé' }
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
