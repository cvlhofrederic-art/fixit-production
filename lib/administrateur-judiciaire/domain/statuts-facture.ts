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
 *
 * Décision J9 de Hugo du 30/10/2026 — virement rejeté ou retourné après émission : la facture qu'il réglait revient à
 * l'état d'avant le paiement, avec la date et le motif du rejet (retourFactureApresRejet) ; le règlement, lui, passe
 * « Annulé » sous une écriture contraire (reglements-fournisseurs.ts, rejeterVirement). Hors de ce retour, « Réglée »
 * reste sans transition à la main.
 * 🔵 Déduit pour J9 :
 * - l'état d'avant est celui de la facture à son entrée dans l'ordre, l'ordre émis ne pouvant plus la reprendre : une
 *   facture « Réglée » revient « Bon à payer » (l'équivalent, côté facture, du « À régler » du règlement : prête pour un
 *   nouvel ordre) ; une facture « En attente » du solde après un acompte revient « Acompte à régler », pour le montant
 *   rejeté ; reste dû et statut de saisie sont rétablis (le montant rejeté redevient dû) ;
 * - une facture qui a déjà repris un cycle de règlement (bon à payer, acompte à régler, en règlement) est refusée : le
 *   cycle en cours est à défaire d'abord ; le montant rejeté ne dépasse jamais ce qui est réglé ; un même règlement ne se
 *   rejette qu'une fois, deux règlements successifs rejetés laissent deux rejets.
 * 🔴 Non établi pour J9 : après un rejet pour coordonnées bancaires (compte clos, IBAN erroné), la facture revenue
 * « Bon à payer » repartirait au prochain ordre vers les mêmes coordonnées ; faut-il un nouveau bon à payer, ou un
 * contrôle de l'IBAN avant de la reprendre ? Les validations du bon à payer (paiement-fournisseurs.ts), qui portent sur le
 * même montant, restent acquises ici.
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
  /** Virements rejetés ou retournés qui la réglaient (J9), du plus ancien au plus récent ; absent : aucun. */
  rejets?: RejetReglementFacture[]
}

/** Rejet ou retour, après émission, d'un virement qui réglait la facture (J9). */
export interface RejetReglementFacture {
  /** Règlement rejeté (reglements-fournisseurs.ts). */
  reglementId: string
  /** Jour où le rejet est constaté (AAAA-MM-JJ). */
  le: string
  /** Motif donné par la banque. */
  motif: string
  /** Montant du règlement rejeté, en centimes. */
  montantCentimes: number
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

/** J9 — statut d'avant le paiement rejeté : bon à payer pour une facture réglée, acompte pour le solde en attente. */
const RETOUR_APRES_REJET: Partial<Record<StatutReglementFacture, StatutReglementFacture>> = {
  Réglée: 'Bon à payer',
  'En attente': 'Acompte à régler',
}

function verifierRejet(facture: FactureAPayer, rejet: RejetReglementFacture): void {
  if (!rejet.reglementId.trim()) throw new Error(`Facture ${facture.id} : le règlement rejeté est attendu.`)
  if (!estDateIsoValide(rejet.le)) throw new Error(`Date du rejet invalide (${rejet.le}) : AAAA-MM-JJ attendu.`)
  if (!rejet.motif.trim()) throw new Error(`Facture ${facture.id} : motif du rejet attendu (motif donné par la banque).`)
  if (!Number.isInteger(rejet.montantCentimes) || rejet.montantCentimes <= 0)
    throw new Error(`Montant rejeté invalide (${rejet.montantCentimes}) : centimes entiers strictement positifs attendus.`)
  const deja = facture.rejets?.find((r) => r.reglementId === rejet.reglementId.trim())
  if (deja)
    throw new Error(`Facture ${facture.id} : règlement ${rejet.reglementId} déjà rejeté le ${deja.le} (${deja.motif}) ; un rejet ne s'enregistre qu'une fois.`)
}

/**
 * J9 — retour de la facture après le rejet ou le retour, après émission, du virement qui la réglait : « Réglée » revient
 * « Bon à payer », « En attente » (solde après un acompte) revient « Acompte à régler » pour le montant rejeté ; le
 * montant rejeté redevient dû, le statut de saisie suit (statutSaisieApresReglement), le rejet (règlement, date, motif,
 * montant) s'ajoute à ses rejets. Refuse une facture qui a repris un cycle de règlement, un montant supérieur au réglé
 * (total moins reste dû), un règlement déjà rejeté. Renvoie une copie.
 */
export function retourFactureApresRejet<F extends FactureAPayer>(
  facture: F,
  rejet: RejetReglementFacture,
  { totalTtcCentimes }: { totalTtcCentimes: number },
): F {
  verifierRejet(facture, rejet)
  const retour = RETOUR_APRES_REJET[facture.statutReglement]
  if (!retour)
    throw new Error(
      `Facture ${facture.id} « ${facture.statutReglement} » : un nouveau cycle de règlement est en cours ; le défaire avant d'enregistrer le rejet.`,
    )
  if (!Number.isInteger(totalTtcCentimes) || totalTtcCentimes < facture.resteDuCentimes)
    throw new Error(`Total de la facture ${facture.id} invalide (${totalTtcCentimes}) : centimes entiers, au moins le reste dû (${facture.resteDuCentimes}).`)
  const regleCentimes = totalTtcCentimes - facture.resteDuCentimes
  if (rejet.montantCentimes > regleCentimes)
    throw new Error(`Rejet de ${rejet.montantCentimes} centimes : plus que le réglé de la facture ${facture.id} (${regleCentimes} centimes).`)
  return {
    ...facture,
    statutReglement: retour,
    statutSaisie: statutSaisieApresReglement(totalTtcCentimes, regleCentimes - rejet.montantCentimes),
    resteDuCentimes: facture.resteDuCentimes + rejet.montantCentimes,
    ...(retour === 'Acompte à régler' ? { acompteCentimes: rejet.montantCentimes } : {}),
    rejets: [...(facture.rejets ?? []), { ...rejet, reglementId: rejet.reglementId.trim(), motif: rejet.motif.trim() }],
  }
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
  /** Compte payeur de la facture différent du compte de l'ordre (paiement-fournisseurs.ts). */
  | 'autre_compte_payeur'
  /** Facture sans compte payeur (paiement-fournisseurs.ts). */
  | 'compte_payeur_absent'
  /** Bon à payer sans le nombre de validations requis pour le montant à régler (paiement-fournisseurs.ts). */
  | 'bon_a_payer_incomplet'

export interface SelectionOrdre<F extends FactureAPayer = FactureAPayer> {
  retenues: F[]
  /** Montant retenu par facture : le reste dû, ou l'acompte (borné par le reste dû) pour une facture en acompte. */
  montants: { factureId: string; montantCentimes: number }[]
  ecartees: { factureId: string; motif: MotifEcart }[]
  totalCentimes: number
}

const STATUTS_REGLEMENT_SELECTIONNABLES: ReadonlySet<StatutReglementFacture> = new Set(['Bon à payer', 'Acompte à régler'])

/** Montant à régler d'une facture sélectionnable : l'acompte (borné) pour un acompte, sinon le reste dû. */
export const montantARegler = (facture: FactureAPayer): number =>
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
