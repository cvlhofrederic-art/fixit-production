import { estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
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
 * N/Saisie, V/Enr., V/Réglée).
 * Priorités observées : 5 « À échéance AVEC contrôle de solde », 6 « Ne pas régler ». ⚪ Les autres codes ne sont pas
 * connus : une facture qui en porte un n'est jamais retenue automatiquement (motif « priorite_inconnue »).
 * 🔵 Cycle du statut de règlement DÉDUIT des valeurs : en attente → bon à payer (BAP) → en règlement (dans un ordre) →
 * réglée ; « acompte à régler » pour un acompte ; retour arrière possible tant que l'ordre n'est pas émis.
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
export const PRIORITES_REGLEMENT: Record<number, PrioriteReglement> = {
  5: { libelle: 'À échéance AVEC contrôle de solde', aEcheance: true, controleSolde: true, nePasRegler: false },
  6: { libelle: 'Ne pas régler', aEcheance: false, controleSolde: false, nePasRegler: true },
}

/** Lettres du mode observées dans la colonne Statut de Gestéam. */
const MODE_PAR_LETTRE: Record<string, ModeReglement> = { V: 'Virement', C: 'Chèque', N: 'Pas de règlement' }

/** Abréviations du statut de saisie observées dans la colonne Statut de Gestéam. */
const STATUT_PAR_ABREVIATION: Record<string, StatutSaisieFacture> = {
  Saisie: 'En saisie',
  'Enr.': 'Enregistrée',
  Réglée: 'Réglée',
}

/** Lit un code de la colonne Statut de Gestéam (« V/Enr. ») ; null pour une lettre ou une abréviation non observée. */
export function lireCodeStatutGesteam(code: string): { mode: ModeReglement; statutSaisie: StatutSaisieFacture } | null {
  const [lettre, abreviation, ...reste] = code.trim().split('/')
  if (reste.length > 0 || abreviation === undefined) return null
  const mode = MODE_PAR_LETTRE[lettre.trim()]
  const statutSaisie = STATUT_PAR_ABREVIATION[abreviation.trim()]
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
  fournisseurId: string
  mode: ModeReglement
  statutSaisie: StatutSaisieFacture
  comptabilisee: boolean
  statutReglement: StatutReglementFacture
  /** Code de priorité de règlement (référentiel numéroté). */
  priorite: number
  echeance: string
  resteDuCentimes: number
}

/** Transitions admises du statut de règlement (🔵 déduites). */
const TRANSITIONS: Record<StatutReglementFacture, readonly StatutReglementFacture[]> = {
  'En attente': ['Bon à payer', 'Acompte à régler'],
  'Acompte à régler': ['En règlement', 'Bon à payer', 'En attente'],
  'Bon à payer': ['En règlement', 'En attente'],
  'En règlement': ['Réglée', 'Bon à payer'],
  Réglée: [],
}

const STATUTS_SAISIE_PAYABLES: readonly StatutSaisieFacture[] = ['Enregistrée', 'Rgt. partiel']

/** Change le statut de règlement ; le bon à payer exige une facture enregistrée et comptabilisée. Renvoie une copie. */
export function changerStatutReglement<F extends FactureAPayer>(facture: F, nouveau: StatutReglementFacture): F {
  if (!TRANSITIONS[facture.statutReglement].includes(nouveau))
    throw new Error(`Transition refusée : « ${facture.statutReglement} » → « ${nouveau} ».`)
  if (nouveau === 'Bon à payer' || nouveau === 'Acompte à régler') {
    if (!STATUTS_SAISIE_PAYABLES.includes(facture.statutSaisie))
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
  | 'ne_pas_regler'
  | 'non_echue'
  | 'priorite_inconnue'
  | 'rien_a_regler'
  | 'solde_insuffisant'

export interface SelectionOrdre<F extends FactureAPayer = FactureAPayer> {
  retenues: F[]
  ecartees: { factureId: string; motif: MotifEcart }[]
  totalCentimes: number
}

/** Premier motif qui empêche la facture de partir dans un ordre de virement daté `date`, ou null. */
function motifEcart(facture: FactureAPayer, date: string): MotifEcart | null {
  if (facture.mode !== 'Virement') return 'mode'
  if (facture.statutReglement !== 'Bon à payer') return 'pas_de_bon_a_payer'
  if (!facture.comptabilisee) return 'non_comptabilisee'
  if (!STATUTS_SAISIE_PAYABLES.includes(facture.statutSaisie)) return 'non_enregistree'
  const priorite = PRIORITES_REGLEMENT[facture.priorite]
  if (priorite?.nePasRegler) return 'ne_pas_regler'
  if (facture.echeance > date) return 'non_echue'
  if (!priorite) return 'priorite_inconnue'
  if (facture.resteDuCentimes <= 0) return 'rien_a_regler'
  return null
}

/**
 * Factures à régler par un ordre de virement daté `date` : bon à payer, comptabilisées, enregistrées (ou en règlement
 * partiel), mode virement, échues, priorité connue autre que « ne pas régler », reste dû > 0 ; triées par échéance puis
 * identifiant. Une priorité « avec contrôle de solde » n'est retenue que si le solde disponible restant la couvre.
 */
export function selectionnerFacturesAPayer<F extends FactureAPayer>(
  factures: F[],
  { date, soldeDisponibleCentimes }: { date: string; soldeDisponibleCentimes: number },
): SelectionOrdre<F> {
  if (!estDateIsoValide(date)) throw new Error(`Date de l'ordre invalide (${date}) : AAAA-MM-JJ attendu.`)
  if (!Number.isInteger(soldeDisponibleCentimes)) throw new Error(`Solde disponible invalide (${soldeDisponibleCentimes}) : centimes entiers attendus.`)
  if (new Set(factures.map((f) => f.id)).size !== factures.length) throw new Error('Facture en double dans la sélection.')
  for (const f of factures) {
    if (!estDateIsoValide(f.echeance)) throw new Error(`Échéance invalide pour la facture ${f.id} (${f.echeance}).`)
    if (!Number.isInteger(f.resteDuCentimes)) throw new Error(`Reste dû invalide pour la facture ${f.id}.`)
  }
  const ecartees: SelectionOrdre<F>['ecartees'] = []
  const candidates: F[] = []
  for (const f of factures) {
    const motif = motifEcart(f, date)
    if (motif) ecartees.push({ factureId: f.id, motif })
    else candidates.push(f)
  }
  const retenues: F[] = []
  let disponible = soldeDisponibleCentimes
  for (const f of candidates.sort((a, b) => a.echeance.localeCompare(b.echeance) || a.id.localeCompare(b.id))) {
    if (PRIORITES_REGLEMENT[f.priorite].controleSolde && f.resteDuCentimes > disponible) {
      ecartees.push({ factureId: f.id, motif: 'solde_insuffisant' })
      continue
    }
    retenues.push(f)
    disponible -= f.resteDuCentimes
  }
  return { retenues, ecartees, totalCentimes: retenues.reduce((s, f) => s + f.resteDuCentimes, 0) }
}
