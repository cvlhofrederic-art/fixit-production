import { estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import type { StatutOrdre } from '@/lib/administrateur-judiciaire/domain/ordres-banque'
import type { ModeReglement } from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Statuts d'une facture fournisseur et sélection pour un ordre de virement (cartographie Gestéam, tranche 43 § 3).
 * Fonctions pures, montants en CENTIMES ENTIERS, dates ISO, sans écran.
 *
 * Gestéam porte TROIS AXES distincts sur une facture :
 * - le statut de SAISIE : Pré-saisie · En saisie · Enregistrée · Rgt. partiel · Réglée · Non réglée ;
 * - le statut COMPTABLE : comptabilisée ou non ;
 * - le statut de RÈGLEMENT : En attente · Acompte à régler · Bon à payer · En règlement · Réglée.
 * S'y ajoutent le MODE de règlement (MODE_REGLEMENT) et une PRIORITÉ numérotée, qui décide si un ordre de virement prend la
 * facture. La colonne « Statut » de la liste se lit « <lettre du mode> / <statut de saisie> » (V/Saisie, C/Saisie,
 * N/Saisie, V/Enr., V/Réglée). ⚪ D'autres abréviations ont été lues en passant (« V/Règl. », « V/Rég. », « C/Rég. »,
 * « V/Err. ») sans être confirmées : elles restent illisibles (null) plutôt que devinées.
 * Priorités observées : 5 « À échéance AVEC contrôle de solde », 6 « Ne pas régler ». ⚪ Les autres codes ne sont pas
 * connus : une facture qui en porte un n'est jamais retenue automatiquement (motif « priorite_inconnue »).
 * 🔵 Cycle du statut de règlement DÉDUIT des valeurs : en attente → bon à payer (BAP) ou acompte à régler → en règlement
 * (dans un ordre) → réglée (ou, après un acompte, retour en attente pour le solde). Une facture ne sort d'un ordre que
 * tant qu'il n'est pas émis, et n'est réputée payée qu'une fois l'ordre émis.
 * Le compte bancaire payeur (syndicat, compte séparé, fonds de travaux — D-BANQUE, J4) est choisi par l'appelant, qui ne
 * passe que les factures de ce compte et son solde disponible.
 */

export const STATUTS_SAISIE_FACTURE = ['Pré-saisie', 'En saisie', 'Enregistrée', 'Rgt. partiel', 'Réglée', 'Non réglée'] as const
export type StatutSaisieFacture = (typeof STATUTS_SAISIE_FACTURE)[number]

export const STATUTS_REGLEMENT_FACTURE = ['En attente', 'Acompte à régler', 'Bon à payer', 'En règlement', 'Réglée'] as const
export type StatutReglementFacture = (typeof STATUTS_REGLEMENT_FACTURE)[number]

export interface PrioriteReglement {
  libelle: string
  /** Réglée seulement à partir de son échéance. */
  aEcheance: boolean
  /** Réglée seulement si le solde disponible du compte bancaire la couvre. */
  controleSolde: boolean
  nePasRegler: boolean
}

/** Priorités de règlement observées (référentiel numéroté de Gestéam, liste incomplète). */
export const PRIORITES_REGLEMENT: ReadonlyMap<number, PrioriteReglement> = new Map([
  [5, { libelle: 'À échéance AVEC contrôle de solde', aEcheance: true, controleSolde: true, nePasRegler: false }],
  [6, { libelle: 'Ne pas régler', aEcheance: false, controleSolde: false, nePasRegler: true }],
])

/** Lettres du mode observées dans la colonne Statut de Gestéam. */
const MODE_PAR_LETTRE: ReadonlyMap<string, ModeReglement> = new Map([
  ['V', 'Virement'],
  ['C', 'Chèque'],
  ['N', 'Pas de règlement'],
])

/** Abréviations du statut de saisie observées et confirmées dans la colonne Statut de Gestéam. */
const STATUT_PAR_ABREVIATION: ReadonlyMap<string, StatutSaisieFacture> = new Map([
  ['Saisie', 'En saisie'],
  ['Enr.', 'Enregistrée'],
  ['Réglée', 'Réglée'],
])

/** Lit un code de la colonne Statut de Gestéam (« V/Enr. ») ; null pour une lettre ou une abréviation non confirmée. */
export function lireCodeStatutGesteam(code: string): { mode: ModeReglement; statutSaisie: StatutSaisieFacture } | null {
  const [lettre, abreviation, ...reste] = code.normalize('NFC').trim().split('/')
  if (reste.length > 0 || abreviation === undefined) return null
  const mode = MODE_PAR_LETTRE.get(lettre.trim())
  const statutSaisie = STATUT_PAR_ABREVIATION.get(abreviation.trim())
  return mode && statutSaisie ? { mode, statutSaisie } : null
}

/** Statut de saisie d'une facture enregistrée selon ce qui en est réglé. */
export function statutSaisieApresReglement(totalTtcCentimes: number, regleCentimes: number): StatutSaisieFacture {
  if (!Number.isInteger(regleCentimes) || regleCentimes < 0 || regleCentimes > totalTtcCentimes)
    throw new Error(`Réglé invalide (${regleCentimes}) : entre 0 et le total de la facture (${totalTtcCentimes}).`)
  if (regleCentimes === 0) return 'Enregistrée'
  return regleCentimes === totalTtcCentimes ? 'Réglée' : 'Rgt. partiel'
}

export interface FactureAPayer {
  id: string
  /** Fournisseur (prestataire) : même nom de champ que la table `factures` du schéma. */
  prestataireId: string
  mode: ModeReglement
  statutSaisie: StatutSaisieFacture
  comptabilisee: boolean
  statutReglement: StatutReglementFacture
  /** Code de priorité de règlement (référentiel numéroté). */
  priorite: number
  echeance: string
  resteDuCentimes: number
  /** Montant de l'acompte à régler, pour une facture en « Acompte à régler ». */
  acompteCentimes?: number
}

/** Transitions admises du statut de règlement (🔵 déduites). */
const TRANSITIONS: Record<StatutReglementFacture, readonly StatutReglementFacture[]> = {
  'En attente': ['Bon à payer', 'Acompte à régler'],
  'Acompte à régler': ['En règlement', 'Bon à payer', 'En attente'],
  'Bon à payer': ['En règlement', 'En attente'],
  'En règlement': ['Réglée', 'En attente', 'Bon à payer', 'Acompte à régler'],
  Réglée: [],
}

/** Depuis « En règlement » : sortie de l'ordre (avant émission) ou paiement constaté (après émission). */
const SORTIES_ORDRE: ReadonlySet<StatutReglementFacture> = new Set(['Bon à payer', 'Acompte à régler'])
const PAIEMENTS_ORDRE: ReadonlySet<StatutReglementFacture> = new Set(['Réglée', 'En attente'])

const STATUTS_SAISIE_PAYABLES: ReadonlySet<StatutSaisieFacture> = new Set(['Enregistrée', 'Rgt. partiel'])

function controlerSortieOrdre(facture: FactureAPayer, nouveau: StatutReglementFacture, ordre: StatutOrdre | undefined): void {
  if (facture.statutReglement !== 'En règlement') return
  if (ordre === undefined)
    throw new Error(`Facture ${facture.id} en règlement : le statut de son ordre de virement est requis.`)
  if (SORTIES_ORDRE.has(nouveau) && ordre === 'Émis')
    throw new Error(`Facture ${facture.id} : son ordre est déjà émis, elle ne peut plus en sortir (risque de double paiement).`)
  if (PAIEMENTS_ORDRE.has(nouveau) && ordre !== 'Émis')
    throw new Error(`Facture ${facture.id} : son ordre n'est pas émis, elle ne peut pas être réputée payée.`)
}

/**
 * Change le statut de règlement ; le bon à payer (ou l'acompte à régler) exige une facture enregistrée et comptabilisée.
 * Pour une facture « En règlement », le statut de l'ordre qui la porte est requis. Renvoie une copie.
 */
export function changerStatutReglement<F extends FactureAPayer>(
  facture: F,
  nouveau: StatutReglementFacture,
  { ordre }: { ordre?: StatutOrdre } = {},
): F {
  if (!TRANSITIONS[facture.statutReglement].includes(nouveau))
    throw new Error(`Transition refusée : « ${facture.statutReglement} » → « ${nouveau} ».`)
  controlerSortieOrdre(facture, nouveau, ordre)
  if (nouveau === 'Bon à payer' || nouveau === 'Acompte à régler') {
    if (!STATUTS_SAISIE_PAYABLES.has(facture.statutSaisie))
      throw new Error(`Bon à payer refusé : la facture ${facture.id} n'est pas enregistrée (${facture.statutSaisie}).`)
    if (!facture.comptabilisee) throw new Error(`Bon à payer refusé : la facture ${facture.id} n'est pas comptabilisée.`)
  }
  return { ...facture, statutReglement: nouveau }
}

export type MotifEcart =
  | 'mode'
  | 'pas_de_bon_a_payer'
  | 'non_comptabilisee'
  | 'non_enregistree'
  | 'donnee_invalide'
  | 'priorite_inconnue'
  | 'ne_pas_regler'
  | 'rien_a_regler'
  | 'acompte_sans_montant'
  | 'non_echue'
  | 'solde_insuffisant'

export interface SelectionOrdre<F extends FactureAPayer = FactureAPayer> {
  retenues: F[]
  /** Montant retenu par facture : le reste dû, ou l'acompte (borné par le reste dû) pour une facture en acompte. */
  montants: { factureId: string; montantCentimes: number }[]
  ecartees: { factureId: string; motif: MotifEcart }[]
  totalCentimes: number
}

const STATUTS_REGLEMENT_SELECTIONNABLES: ReadonlySet<StatutReglementFacture> = new Set(['Bon à payer', 'Acompte à régler'])

/** Montant à régler d'une facture sélectionnable : l'acompte (borné) pour un acompte, sinon le reste dû. */
const montantARegler = (facture: FactureAPayer): number =>
  facture.statutReglement === 'Acompte à régler'
    ? Math.min(facture.acompteCentimes ?? 0, facture.resteDuCentimes)
    : facture.resteDuCentimes

/** Premier motif qui empêche la facture de partir dans un ordre de virement daté `date`, ou null. */
function motifEcart(facture: FactureAPayer, date: string): MotifEcart | null {
  if (facture.mode !== 'Virement') return 'mode'
  if (!STATUTS_REGLEMENT_SELECTIONNABLES.has(facture.statutReglement)) return 'pas_de_bon_a_payer'
  if (!facture.comptabilisee) return 'non_comptabilisee'
  if (!STATUTS_SAISIE_PAYABLES.has(facture.statutSaisie)) return 'non_enregistree'
  if (!estDateIsoValide(facture.echeance) || !Number.isInteger(facture.resteDuCentimes)) return 'donnee_invalide'
  const priorite = PRIORITES_REGLEMENT.get(facture.priorite)
  if (!priorite) return 'priorite_inconnue'
  if (priorite.nePasRegler) return 'ne_pas_regler'
  if (facture.resteDuCentimes <= 0) return 'rien_a_regler'
  if (facture.statutReglement === 'Acompte à régler' && montantARegler(facture) <= 0) return 'acompte_sans_montant'
  if (priorite.aEcheance && facture.echeance > date) return 'non_echue'
  return null
}

/**
 * Plafonne au solde disponible des candidates déjà triées : dès qu'une facture « avec contrôle de solde » n'est pas
 * couverte, elle et toutes les suivantes de même contrôle sont écartées (aucune facture plus récente payée avant une plus
 * ancienne).
 */
function plafonnerAuSolde<F extends FactureAPayer>(candidates: F[], soldeDisponibleCentimes: number): SelectionOrdre<F> {
  const selection: SelectionOrdre<F> = { retenues: [], montants: [], ecartees: [], totalCentimes: 0 }
  let disponible = soldeDisponibleCentimes
  let soldeEpuise = false
  for (const f of candidates) {
    const montant = montantARegler(f)
    const controle = PRIORITES_REGLEMENT.get(f.priorite)?.controleSolde === true
    soldeEpuise = soldeEpuise || (controle && montant > disponible)
    if (controle && soldeEpuise) {
      selection.ecartees.push({ factureId: f.id, motif: 'solde_insuffisant' })
      continue
    }
    selection.retenues.push(f)
    selection.montants.push({ factureId: f.id, montantCentimes: montant })
    selection.totalCentimes += montant
    disponible -= montant
  }
  return selection
}

/**
 * Factures à régler par un ordre de virement daté `date` : bon à payer (ou acompte à régler), comptabilisées,
 * enregistrées (ou en règlement partiel), mode virement, priorité connue autre que « ne pas régler », échues si la
 * priorité l'exige ; triées par échéance puis identifiant, puis plafonnées au solde disponible (`plafonnerAuSolde`).
 * Une facture aux données invalides est écartée (« donnee_invalide ») sans bloquer les autres.
 */
export function selectionnerFacturesAPayer<F extends FactureAPayer>(
  factures: F[],
  { date, soldeDisponibleCentimes }: { date: string; soldeDisponibleCentimes: number },
): SelectionOrdre<F> {
  if (!estDateIsoValide(date)) throw new Error(`Date de l'ordre invalide (${date}) : AAAA-MM-JJ attendu.`)
  if (!Number.isInteger(soldeDisponibleCentimes))
    throw new Error(`Solde disponible invalide (${soldeDisponibleCentimes}) : centimes entiers attendus.`)
  if (new Set(factures.map((f) => f.id)).size !== factures.length) throw new Error('Facture en double dans la sélection.')
  const ecartees: SelectionOrdre<F>['ecartees'] = []
  const candidates: F[] = []
  for (const f of factures) {
    const motif = motifEcart(f, date)
    if (motif) ecartees.push({ factureId: f.id, motif })
    else candidates.push(f)
  }
  candidates.sort((a, b) => a.echeance.localeCompare(b.echeance) || a.id.localeCompare(b.id))
  const selection = plafonnerAuSolde(candidates, soldeDisponibleCentimes)
  return { ...selection, ecartees: [...ecartees, ...selection.ecartees] }
}
