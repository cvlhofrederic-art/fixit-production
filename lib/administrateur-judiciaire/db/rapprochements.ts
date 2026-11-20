import { genererId } from '@/lib/administrateur-judiciaire/db/ids'
import { repoBanques, repoRapprochements } from '@/lib/administrateur-judiciaire/db/repositories'
import type { OptionsEcriture } from '@/lib/administrateur-judiciaire/db/repository'
import { ajDb, type Rapprochement } from '@/lib/administrateur-judiciaire/db/schema'
import { compteBanque, soldeCompteCentimes } from '@/lib/administrateur-judiciaire/db/sous-comptes-banque'
import { estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import {
  cloturerArrete,
  decloturerArrete,
  ouvrirArrete,
  type ArreteRapprochement,
  type StatutArrete,
} from '@/lib/administrateur-judiciaire/domain/rapprochement-bancaire'

/**
 * Arrêtés de rapprochement d'un compte bancaire, écrits par l'écran « Banque et recouvrement » (« Nouvel arrêté »,
 * « Clôturer », « Déclôturer ») dans la table locale existante « rapprochements » (index `bancaireId`) : aucune nouvelle
 * table, aucun changement de version. Champs de l'arrêté non indexés, sous la forme du domaine, sauf l'identifiant du
 * compte (`bancaireId` en base, `banqueId` dans le domaine). Volontairement hors du store (sa forme est figée par
 * l'oracle de la base locale), comme db/sinistres.ts et db/comptes-bancaires.ts.
 * Les règles sont celles du domaine (rapprochement-bancaire.ts), qui lève l'erreur affichée : un seul arrêté en cours
 * par compte, date postérieure au dernier, clôture à l'équilibre, déclôture du dernier arrêté clôturé. Chaque écriture
 * relit les arrêtés du compte dans sa transaction : deux écritures qui se chevauchent passent l'une après l'autre.
 * Solde compta : celui du sous-compte 512 du compte à la date de l'arrêté (db/sous-comptes-banque.ts), figé à
 * l'ouverture ; aucune écriture : 0. Aucun élément n'est encore rattaché à l'arrêté (côté compta indépendant du relevé
 * non branché) : `elements` reste vide.
 */

export interface ArretesLus {
  /** Arrêtés lisibles du compte, par date. */
  arretes: ArreteRapprochement[]
  /** Lignes du compte qui n'ont pas la forme d'un arrêté (écrites hors de l'écran) : ni affichées ni modifiées. */
  illisibles: number
}

const STATUTS: readonly unknown[] = ['En cours', 'Clôturé'] satisfies StatutArrete[]

const estCentimes = (valeur: unknown): valeur is number => typeof valeur === 'number' && Number.isInteger(valeur)
const estStatut = (valeur: unknown): valeur is StatutArrete => STATUTS.includes(valeur)

/** Arrêté du domaine d'une ligne de la base ; null si elle n'en a pas la forme. */
function versDomaine(ligne: Rapprochement): ArreteRapprochement | null {
  const { dateArrete, soldeBanqueCentimes, soldeComptaCentimes, statut } = ligne
  if (!estDateIsoValide(dateArrete) || !estCentimes(soldeBanqueCentimes) || !estCentimes(soldeComptaCentimes) || !estStatut(statut))
    return null
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

/** Arrêtés d'un compte, lisibles par date, et nombre de lignes illisibles. */
export async function listerArretes(banqueId: string): Promise<ArretesLus> {
  const lignes = await ajDb.rapprochements.where('bancaireId').equals(banqueId).toArray()
  const arretes = lignes.map(versDomaine).filter((arrete): arrete is ArreteRapprochement => arrete !== null)
  arretes.sort((a, b) => a.dateArrete.localeCompare(b.dateArrete))
  return { arretes, illisibles: lignes.length - arretes.length }
}

/** Arrêtés du compte, refusés tant qu'une ligne illisible pourrait cacher un arrêté en cours ou plus récent. */
async function arretesSurs(banqueId: string): Promise<ArreteRapprochement[]> {
  const { arretes, illisibles } = await listerArretes(banqueId)
  if (illisibles > 0) {
    const s = illisibles > 1 ? 's' : ''
    throw new Error(`${illisibles} arrêté${s} illisible${s} sur ce compte (écrit${s} hors de l’écran) : à reprendre dans la base locale d’abord.`)
  }
  return arretes
}

export interface SaisieArrete {
  /** AAAA-MM-JJ. */
  dateArrete: string
  /** Solde du relevé de la banque à cette date, en centimes entiers signés. */
  soldeBanqueCentimes: number
}

/** Ouvre un arrêté « En cours » sur un compte actif ; solde compta calculé (voir l'en-tête). */
export async function ouvrirArreteCompte(banqueId: string, saisie: SaisieArrete, options: OptionsEcriture = {}): Promise<ArreteRapprochement> {
  return ajDb.transaction('rw', [ajDb.rapprochements, ajDb.banques, ajDb.ecritures, ajDb.activityLog], async () => {
    const compte = await repoBanques.get(banqueId)
    if (!compte) throw new Error(`Compte bancaire introuvable (id=${banqueId}).`)
    if (compte.actif === false) throw new Error('Compte bancaire clôturé : aucun nouvel arrêté.')
    const existants = await arretesSurs(banqueId)
    // Date invalide : solde provisoire sans objet, ouvrirArrete refuse la saisie.
    const soldeComptaCentimes = estDateIsoValide(saisie.dateArrete)
      ? (soldeCompteCentimes(await ajDb.ecritures.toArray(), compteBanque(banqueId), saisie.dateArrete) ?? 0)
      : 0
    const arrete = ouvrirArrete(existants, { id: genererId(), banqueId, ...saisie, soldeComptaCentimes })
    const { id, banqueId: bancaireId, ...champs } = arrete
    await repoRapprochements.create({ bancaireId, ...champs }, { id, actor: options.actor ?? null })
    return arrete
  })
}

/** Arrêté lisible d'après son identifiant, avec les arrêtés de son compte. */
async function arreteEtSonCompte(id: string): Promise<{ arrete: ArreteRapprochement; duCompte: ArreteRapprochement[] }> {
  const ligne = await repoRapprochements.get(id)
  if (!ligne) throw new Error(`Arrêté introuvable : « ${id} ».`)
  const duCompte = await arretesSurs(ligne.bancaireId)
  const arrete = duCompte.find((candidat) => candidat.id === id)
  if (!arrete) throw new Error(`Arrêté illisible : « ${id} ».`)
  return { arrete, duCompte }
}

/** Clôture un arrêté à l'équilibre seulement (cloturerArrete). */
export async function cloturerArreteCompte(id: string, options: OptionsEcriture = {}): Promise<ArreteRapprochement> {
  return ajDb.transaction('rw', [ajDb.rapprochements, ajDb.activityLog], async () => {
    const { arrete } = await arreteEtSonCompte(id)
    const cloture = cloturerArrete(arrete)
    await repoRapprochements.update(id, { statut: cloture.statut }, { actor: options.actor ?? null })
    return cloture
  })
}

/** Déclôture le dernier arrêté clôturé d'un compte sans arrêté en cours (decloturerArrete). */
export async function decloturerArreteCompte(id: string, options: OptionsEcriture = {}): Promise<ArreteRapprochement> {
  return ajDb.transaction('rw', [ajDb.rapprochements, ajDb.activityLog], async () => {
    const { duCompte } = await arreteEtSonCompte(id)
    const rouvert = decloturerArrete(duCompte, id)
    await repoRapprochements.update(id, { statut: rouvert.statut }, { actor: options.actor ?? null })
    return rouvert
  })
}
