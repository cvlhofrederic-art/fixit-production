import { genererId } from '@/lib/administrateur-judiciaire/db/ids'
import { repoBanques, repoRapprochements } from '@/lib/administrateur-judiciaire/db/repositories'
import type { OptionsEcriture } from '@/lib/administrateur-judiciaire/db/repository'
import { ajDb, type Ecriture, type Rapprochement } from '@/lib/administrateur-judiciaire/db/schema'
import { compteBanque, soldeCompteCentimes } from '@/lib/administrateur-judiciaire/db/sous-comptes-banque'
import { estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import { refuserImportEnPeriodeArretee } from '@/lib/administrateur-judiciaire/domain/periode-arretee'
import {
  abandonnerArrete,
  cloturerArrete,
  decloturerArrete,
  ouvrirArrete,
  refusArretesIllisibles,
  STATUT_ARRETE_ABANDONNE,
  type ArreteAbandonne,
  type ArreteRapprochement,
  type StatutArrete,
} from '@/lib/administrateur-judiciaire/domain/rapprochement-bancaire'
import { AUJOURDHUI_ISO } from '@/lib/administrateur-judiciaire/mode'

/**
 * Arrêtés de rapprochement d'un compte bancaire, écrits par l'écran « Banque et recouvrement » (« Nouvel arrêté »,
 * « Clôturer », « Déclôturer », « Abandonner l'arrêté ») dans la table locale existante « rapprochements » (index
 * `bancaireId`) : aucune nouvelle table, aucun changement de version. Champs de l'arrêté non indexés, sous la forme du
 * domaine, sauf l'identifiant du compte (`bancaireId` en base, `banqueId` dans le domaine). Volontairement hors du store
 * (sa forme est figée par l'oracle de la base locale), comme db/sinistres.ts et db/comptes-bancaires.ts.
 * Les règles sont celles du domaine (rapprochement-bancaire.ts), qui lève l'erreur affichée : un seul arrêté en cours
 * par compte, date postérieure au dernier, clôture à l'équilibre, déclôture du dernier arrêté clôturé, abandon d'un
 * arrêté en cours seulement ; et deux règles jusqu'ici propres à l'écran (décision du 26/11/2026, rb-16 A) : date
 * d'arrêté ni future ni improbable, aucune écriture tant qu'un arrêté illisible reste sur le compte. Chaque écriture
 * relit les arrêtés du compte dans sa transaction : deux écritures qui se chevauchent passent l'une après l'autre.
 * Solde compta : celui du sous-compte 512 du compte à la date de l'arrêté (db/sous-comptes-banque.ts) ; aucune
 * écriture : 0. Décision du 26/11/2026 (PR 799, rb-01 C et rb-03 A) : il n'est plus figé à l'ouverture. Tant que
 * l'arrêté est en cours, la valeur enregistrée n'est que celle de l'ouverture : le solde qui vaut est recalculé sur les
 * écritures connues (avecSoldeComptaCourant), à l'écran comme à la clôture, qui l'enregistre et le fige. Un relevé
 * importé après l'ouverture, daté au plus tard de l'arrêté, y entre donc.
 * Arrêté abandonné (décision du 26/11/2026, rb-01 A) : la ligne reste en base avec ses montants, statut « Abandonné »,
 * l'écriture étant tracée au journal d'activité comme les autres (repository). Elle est lue à part (`abandonnes`) :
 * aucune règle ne la reçoit, elle ne compte ni comme arrêté en cours, ni comme dernier arrêté, ni dans un solde.
 * Réponse du référent métier du 28/11/2026 (corrections de la PR 799, cr-01 A) : l'écran affiche les arrêtés abandonnés
 * dans « Arrêtés du compte », statut « Abandonné », sans rien en calculer ; un arrêté clôturé puis déclôturé s'abandonne
 * comme tout arrêté en cours, et la confirmation le dit (arreteDejaCloture, lu dans le journal d'activité).
 * Aucun élément n'est encore rattaché à l'arrêté (côté compta indépendant du relevé non branché) : `elements` reste vide.
 * Période arrêtée protégée (décision du 26/11/2026, rb-04 A) : refuserImportSurPeriodeArretee, appelée par l'import d'un
 * relevé dans sa transaction d'écriture, refuse le relevé dont une ligne est datée au plus tard du dernier arrêté clôturé
 * du compte (domain/periode-arretee.ts). Comme les autres écritures, elle refuse aussi tant qu'un arrêté illisible reste
 * sur le compte (arretesSurs).
 */

export interface ArretesLus {
  /** Arrêtés lisibles du compte qui comptent (en cours, clôturés), par date. */
  arretes: ArreteRapprochement[]
  /** Arrêtés abandonnés lisibles du compte, par date : gardés pour mémoire, hors de toute règle. */
  abandonnes: ArreteAbandonne[]
  /** Lignes du compte qui n'ont pas la forme d'un arrêté (écrites hors de l'écran) : ni affichées ni modifiées. */
  illisibles: number
}

type ArreteLu = ArreteRapprochement | ArreteAbandonne

const STATUTS: readonly unknown[] = ['En cours', 'Clôturé'] satisfies StatutArrete[]

const estCentimes = (valeur: unknown): valeur is number => typeof valeur === 'number' && Number.isInteger(valeur)
const estStatut = (valeur: unknown): valeur is StatutArrete => STATUTS.includes(valeur)
const estAbandonne = (arrete: ArreteLu): arrete is ArreteAbandonne => arrete.statut === STATUT_ARRETE_ABANDONNE
const parDate = (a: ArreteLu, b: ArreteLu): number => a.dateArrete.localeCompare(b.dateArrete)

/** Arrêté d'une ligne de la base, abandonné ou non ; null si elle n'en a pas la forme. */
function versDomaine(ligne: Rapprochement): ArreteLu | null {
  const { dateArrete, soldeBanqueCentimes, soldeComptaCentimes, statut } = ligne
  if (!estDateIsoValide(dateArrete) || !estCentimes(soldeBanqueCentimes) || !estCentimes(soldeComptaCentimes)) return null
  if (!estStatut(statut) && statut !== STATUT_ARRETE_ABANDONNE) return null
  return {
    id: ligne.id,
    banqueId: ligne.bancaireId,
    dateArrete,
    soldeBanqueCentimes,
    soldeComptaCentimes,
    statut,
    elements: Array.isArray(ligne.elements) ? ligne.elements : [],
  }
}

/** Arrêtés d'un compte, lisibles par date (ceux qui comptent, et les abandonnés à part), et nombre de lignes illisibles. */
export async function listerArretes(banqueId: string): Promise<ArretesLus> {
  const lignes = await ajDb.rapprochements.where('bancaireId').equals(banqueId).toArray()
  const lus = lignes.map(versDomaine).filter((arrete): arrete is ArreteLu => arrete !== null)
  return {
    arretes: lus.filter((arrete): arrete is ArreteRapprochement => !estAbandonne(arrete)).sort(parDate),
    abandonnes: lus.filter(estAbandonne).sort(parDate),
    illisibles: lignes.length - lus.length,
  }
}

/** Statut porté par un état du journal d'activité (ligne d'arrêté avant ou après une écriture) ; null : aucun. */
const statutJournalise = (etat: unknown): unknown => (typeof etat === 'object' && etat !== null && 'statut' in etat ? etat.statut : null)

/**
 * Vrai si l'arrêté a déjà été clôturé une fois (réponse du référent métier du 28/11/2026, corrections de la PR 799,
 * cr-01 A). Un arrêté déclôturé redevient « En cours » : sa ligne ne dit plus qu'il a été clôturé. Le journal d'activité,
 * lui, garde chaque écriture de la ligne avec son état après (repository, entité « rapprochements ») : c'est lui qui est
 * lu, sans rien ajouter à la ligne ni à la base. Lecture seule, pour la confirmation de l'abandon, qui dit alors que
 * l'arrêté perd sa période arrêtée ; aucune règle n'en dépend. Arrêté inconnu, ou jamais clôturé : faux.
 */
export async function arreteDejaCloture(id: string): Promise<boolean> {
  const entrees = await ajDb.activityLog.where('entiteId').equals(id).toArray()
  return entrees.some((entree) => entree.entite === 'rapprochements' && statutJournalise(entree.apres) === 'Clôturé')
}

/**
 * Arrêtés du compte, refusés tant qu'une ligne illisible pourrait cacher un arrêté en cours, plus récent ou clôturé. La
 * règle et son message sont ceux du domaine (refusArretesIllisibles, décision du 26/11/2026, rb-16 A) ; c'est ici, seul
 * endroit qui lit les lignes de la base, qu'elle s'applique : toute écriture sur les arrêtés d'un compte, et l'import
 * d'un relevé, passe par cette lecture.
 */
async function arretesSurs(banqueId: string): Promise<ArreteRapprochement[]> {
  const { arretes, illisibles } = await listerArretes(banqueId)
  const refus = refusArretesIllisibles(illisibles)
  if (refus) throw new Error(refus)
  return arretes
}

/**
 * Refuse l'import, sur un compte, d'un relevé dont une ligne est datée au plus tard du dernier arrêté clôturé de ce
 * compte (décision du 26/11/2026, rb-04 A ; règle et message du domaine). `dates` : date de chaque ligne à écrire
 * (AAAA-MM-JJ). Le contrôle qui fait foi est celui fait DANS la transaction qui écrit les lignes (importerReleve du
 * store), la table « rapprochements » dans sa portée : une clôture faite entre-temps ailleurs (autre onglet) passe avant
 * ou après elle, jamais au milieu. Les arrêtés lus sont ceux qui comptent : un arrêté abandonné ne protège rien.
 * Arrêté illisible sur le compte (écrit hors de l'écran) : l'import est refusé tant qu'il reste, quelles que soient les
 * dates, comme l'ouverture, la clôture, la déclôture et l'abandon (retour de relecture de la suite rb-04, à confirmer
 * par le référent métier). Une ligne clôturée mais mal formée ne dit pas quelle période elle arrête : la laisser de côté
 * laisserait entrer une ligne dans une période peut-être arrêtée.
 */
export async function refuserImportSurPeriodeArretee(banqueId: string, dates: readonly string[]): Promise<void> {
  refuserImportEnPeriodeArretee(await arretesSurs(banqueId), banqueId, dates)
}

/** Solde compta d'un compte bancaire à une date (ce jour compris) : celui de son sous-compte 512 ; aucune écriture : 0. */
const soldeComptaAu = (ecritures: readonly Pick<Ecriture, 'compte' | 'montant' | 'sens' | 'date'>[], banqueId: string, date: string): number =>
  soldeCompteCentimes(ecritures, compteBanque(banqueId), date) ?? 0

/**
 * Arrêté avec le solde compta qui vaut (décision du 26/11/2026, rb-01 C et rb-03 A) : recalculé sur les écritures
 * reçues, à la date de l'arrêté, tant qu'il est en cours ; celui enregistré, figé, une fois clôturé (l'arrêté est alors
 * rendu tel quel). Fonction pure : l'écran l'applique aux écritures qu'il affiche, la clôture à celles de la base.
 */
export function avecSoldeComptaCourant(
  arrete: ArreteRapprochement,
  ecritures: readonly Pick<Ecriture, 'compte' | 'montant' | 'sens' | 'date'>[],
): ArreteRapprochement {
  if (arrete.statut !== 'En cours') return arrete
  return { ...arrete, soldeComptaCentimes: soldeComptaAu(ecritures, arrete.banqueId, arrete.dateArrete) }
}

export interface SaisieArrete {
  /** AAAA-MM-JJ. */
  dateArrete: string
  /** Solde du relevé de la banque à cette date, en centimes entiers signés. */
  soldeBanqueCentimes: number
}

/**
 * Ouvre un arrêté « En cours » sur un compte actif ; solde compta du moment, recalculé ensuite (voir l'en-tête). La date
 * est refusée après le jour de l'application (date figée en démonstration), comme à l'écran (ouvrirArrete, rb-16 A) :
 * ce jour n'est pas un paramètre, aucun appelant ne peut assouplir la règle.
 */
export async function ouvrirArreteCompte(banqueId: string, saisie: SaisieArrete, options: OptionsEcriture = {}): Promise<ArreteRapprochement> {
  return ajDb.transaction('rw', [ajDb.rapprochements, ajDb.banques, ajDb.ecritures, ajDb.activityLog], async () => {
    const compte = await repoBanques.get(banqueId)
    if (!compte) throw new Error(`Compte bancaire introuvable (id=${banqueId}).`)
    if (compte.actif === false) throw new Error('Compte bancaire clôturé : aucun nouvel arrêté.')
    const existants = await arretesSurs(banqueId)
    // Date invalide : solde provisoire sans objet, ouvrirArrete refuse la saisie.
    const soldeComptaCentimes = estDateIsoValide(saisie.dateArrete) ? soldeComptaAu(await ajDb.ecritures.toArray(), banqueId, saisie.dateArrete) : 0
    const arrete = ouvrirArrete(existants, { id: genererId(), banqueId, ...saisie, soldeComptaCentimes }, AUJOURDHUI_ISO)
    const { id, banqueId: bancaireId, ...champs } = arrete
    await repoRapprochements.create({ bancaireId, ...champs }, { id, actor: options.actor ?? null })
    return arrete
  })
}

/** Arrêté lisible qui compte d'après son identifiant, avec les arrêtés de son compte ; un arrêté abandonné est refusé. */
async function arreteEtSonCompte(id: string): Promise<{ arrete: ArreteRapprochement; duCompte: ArreteRapprochement[] }> {
  const ligne = await repoRapprochements.get(id)
  if (!ligne) throw new Error(`Arrêté introuvable : « ${id} ».`)
  if (ligne.statut === STATUT_ARRETE_ABANDONNE) throw new Error('Arrêté abandonné : ni clôture, ni déclôture, ni nouvel abandon.')
  const duCompte = await arretesSurs(ligne.bancaireId)
  const arrete = duCompte.find((candidat) => candidat.id === id)
  if (!arrete) throw new Error(`Arrêté illisible : « ${id} ».`)
  return { arrete, duCompte }
}

/**
 * Clôture un arrêté en cours, à l'équilibre seulement (cloturerArrete), sur le solde compta recalculé dans la
 * transaction ; ce solde est enregistré avec la clôture, puis ne bouge plus.
 */
export async function cloturerArreteCompte(id: string, options: OptionsEcriture = {}): Promise<ArreteRapprochement> {
  return ajDb.transaction('rw', [ajDb.rapprochements, ajDb.ecritures, ajDb.activityLog], async () => {
    const { arrete } = await arreteEtSonCompte(id)
    const cloture = cloturerArrete(avecSoldeComptaCourant(arrete, await ajDb.ecritures.toArray()))
    await repoRapprochements.update(
      id,
      { statut: cloture.statut, soldeComptaCentimes: cloture.soldeComptaCentimes },
      { actor: options.actor ?? null },
    )
    return cloture
  })
}

/** Déclôture le dernier arrêté clôturé d'un compte sans arrêté en cours (decloturerArrete) : son solde compta se recalcule de nouveau. */
export async function decloturerArreteCompte(id: string, options: OptionsEcriture = {}): Promise<ArreteRapprochement> {
  return ajDb.transaction('rw', [ajDb.rapprochements, ajDb.activityLog], async () => {
    const { duCompte } = await arreteEtSonCompte(id)
    const rouvert = decloturerArrete(duCompte, id)
    await repoRapprochements.update(id, { statut: rouvert.statut }, { actor: options.actor ?? null })
    return rouvert
  })
}

/**
 * Abandonne un arrêté en cours (abandonnerArrete) : la ligne est gardée, statut « Abandonné », jamais effacée ; le
 * compte n'a plus d'arrêté en cours, un nouvel arrêté peut s'y ouvrir. Sans retour : aucune écriture ne reprend un
 * arrêté abandonné.
 */
export async function abandonnerArreteCompte(id: string, options: OptionsEcriture = {}): Promise<ArreteAbandonne> {
  return ajDb.transaction('rw', [ajDb.rapprochements, ajDb.activityLog], async () => {
    const { arrete } = await arreteEtSonCompte(id)
    const abandonne = abandonnerArrete(arrete)
    await repoRapprochements.update(id, { statut: abandonne.statut }, { actor: options.actor ?? null })
    return abandonne
  })
}
