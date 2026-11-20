import { validerIban } from '@/lib/administrateur-judiciaire/domain/comptes-bancaires'
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
 *
 * Décisions du 20/11/2026 (partie C des questions ouvertes du code, recommandations acceptées) :
 * - Décision du 20/11/2026 (partie C, F71) : la facture d'une intervention « Contestée » s'enregistre (demandes.ts,
 *   alertesRattachementFacture), mais son bon à payer est refusé tant que la contestation n'est pas levée
 *   (FactureAPayer.interventionContestee, tirée des demandes par contestationDeLaFacture ; delivrerBap de
 *   paiement-fournisseurs.ts passe par changerStatutReglement) ; une facture déjà « Bon à payer » quand l'intervention
 *   est contestée n'entre dans aucun ordre (motif « intervention_contestee ») : payer ferait perdre au syndicat son moyen
 *   de pression ;
 * - Décision du 20/11/2026 (partie C, F84) : après l'action « Annuler le règlement » (reglements-fournisseurs.ts,
 *   annulerReglement : motif obligatoire, écriture contraire, règlement « Annulé »), la facture revient à son état d'avant
 *   le paiement, « Bon à payer » ou « Acompte à régler », avec le motif (retourFactureApresAnnulation, même circuit que
 *   J9) ; elle se paie ensuite par un nouveau règlement. Le délai de validité d'un chèque n'est pas calculé (non vérifié) ;
 * - Décision du 20/11/2026 (partie C, F92) : après un rejet pour coordonnées (compte clos, IBAN faux, titulaire inconnu :
 *   categorieRejet, catégorie saisie ou déduite du motif), la facture revient « Bon à payer » mais n'entre dans aucun
 *   nouvel ordre tant que l'IBAN n'est pas changé ou confirmé (motif « iban_a_confirmer ») : renvoyer vers un compte clos
 *   échouerait encore, et un changement d'IBAN est le moment classique des fraudes au faux fournisseur. La confirmation est
 *   faite par une autre personne que celle qui a saisi l'IBAN, avec sa source (courrier de l'entreprise, RIB), et tracée
 *   (verifierIbanApresRejet) ; les autres motifs de rejet suivent J9 sans changement ; les validations du bon à payer
 *   (paiement-fournisseurs.ts), qui portent sur le même montant, restent acquises.
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
  /**
   * Intervention contestée de la demande qui porte la facture (Décision du 20/11/2026, partie C, F71 ;
   * demandes.contestationDeLaFacture) : ni bon à payer ni nouvel ordre tant qu'elle n'est pas levée ; absent ou null : aucune.
   */
  interventionContestee?: { demandeId: string } | null
  /** Règlements annulés qui la réglaient (Décision du 20/11/2026, partie C, F84), du plus ancien au plus récent ; absent : aucun. */
  annulations?: AnnulationReglementFacture[]
  /** IBAN changés ou confirmés après un rejet pour coordonnées (Décision du 20/11/2026, partie C, F92) ; absent : aucun. */
  verificationsIban?: VerificationIban[]
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
  /** Coordonnées bancaires en cause, ou autre motif (F92) ; absent : déduit du motif (categorieRejet). */
  categorie?: CategorieRejet
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

/** Statuts qui avancent vers le paiement : bon à payer, acompte à régler, entrée dans un ordre. */
const VERS_LE_PAIEMENT: ReadonlySet<StatutReglementFacture> = new Set(['Bon à payer', 'Acompte à régler', 'En règlement'])

/**
 * Décision du 20/11/2026 (partie C, F71) : intervention contestée, ni bon à payer ni nouvel ordre tant que la
 * contestation n'est pas levée ; la sortie d'un ordre non émis reste possible.
 */
function verifierSansContestation(facture: FactureAPayer, nouveau: StatutReglementFacture): void {
  const contestation = facture.interventionContestee ?? null
  if (contestation === null || !VERS_LE_PAIEMENT.has(nouveau) || facture.statutReglement === 'En règlement') return
  const quoi = nouveau === 'En règlement' ? 'Ordre de virement refusé' : 'Bon à payer refusé'
  throw new Error(
    `${quoi} : l'intervention de la demande ${contestation.demandeId} est contestée (facture ${facture.id}) ; lever la contestation d'abord (stade suivant, avec un motif) — Décision du 20/11/2026 (partie C, F71).`,
  )
}

/**
 * Décision du 20/11/2026 (partie C, F92) : après un rejet pour coordonnées, la facture revenue « Bon à payer » n'entre
 * dans aucun nouvel ordre tant que l'IBAN n'est pas changé ou confirmé (verifierIbanApresRejet).
 */
function verifierIbanPourOrdre(facture: FactureAPayer, nouveau: StatutReglementFacture): void {
  if (nouveau !== 'En règlement') return
  const rejet = ibanAVerifier(facture)
  if (rejet === null) return
  throw new Error(
    `Ordre de virement refusé : facture ${facture.id} revenue après un rejet pour coordonnées du ${rejet.le} (${rejet.motif}) ; IBAN à changer ou confirmer par une autre personne que celle qui l'a saisi, avec sa source — Décision du 20/11/2026 (partie C, F92).`,
  )
}

/**
 * Change le statut de règlement ; le bon à payer (ou l'acompte à régler) exige une facture enregistrée et comptabilisée,
 * et sans intervention contestée (Décision du 20/11/2026, partie C, F71), comme l'entrée dans un ordre. Pour une facture
 * « En règlement », le statut de l'ordre qui la porte est requis. Renvoie une copie.
 */
export function changerStatutReglement<F extends FactureAPayer>(
  facture: F,
  nouveau: StatutReglementFacture,
  { ordre }: { ordre?: StatutOrdre } = {},
): F {
  if (!TRANSITIONS[facture.statutReglement].includes(nouveau))
    throw new Error(`Transition refusée : « ${facture.statutReglement} » → « ${nouveau} ».`)
  controlerSortieOrdre(facture, nouveau, ordre)
  verifierSansContestation(facture, nouveau)
  verifierIbanPourOrdre(facture, nouveau)
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
  return {
    ...facture,
    ...etatAvantPaiement(facture, rejet.montantCentimes, totalTtcCentimes, { evenement: 'le rejet', libelle: 'Rejet' }),
    rejets: [...(facture.rejets ?? []), { ...rejet, reglementId: rejet.reglementId.trim(), motif: rejet.motif.trim() }],
  }
}

/**
 * État d'avant le paiement (J9 ; aussi Décision du 20/11/2026, partie C, F84) : « Réglée » revient « Bon à payer »,
 * « En attente » revient « Acompte à régler » pour le montant ; le montant redevient dû, le statut de saisie suit.
 */
function etatAvantPaiement(
  facture: FactureAPayer,
  montantCentimes: number,
  totalTtcCentimes: number,
  { evenement, libelle }: { evenement: string; libelle: string },
): Pick<FactureAPayer, 'statutReglement' | 'statutSaisie' | 'resteDuCentimes' | 'acompteCentimes'> {
  const retour = RETOUR_APRES_REJET[facture.statutReglement]
  if (!retour)
    throw new Error(
      `Facture ${facture.id} « ${facture.statutReglement} » : un nouveau cycle de règlement est en cours ; le défaire avant d'enregistrer ${evenement}.`,
    )
  if (!Number.isInteger(totalTtcCentimes) || totalTtcCentimes < facture.resteDuCentimes)
    throw new Error(`Total de la facture ${facture.id} invalide (${totalTtcCentimes}) : centimes entiers, au moins le reste dû (${facture.resteDuCentimes}).`)
  const regleCentimes = totalTtcCentimes - facture.resteDuCentimes
  if (montantCentimes > regleCentimes)
    throw new Error(`${libelle} de ${montantCentimes} centimes : plus que le réglé de la facture ${facture.id} (${regleCentimes} centimes).`)
  return {
    statutReglement: retour,
    statutSaisie: statutSaisieApresReglement(totalTtcCentimes, regleCentimes - montantCentimes),
    resteDuCentimes: facture.resteDuCentimes + montantCentimes,
    ...(retour === 'Acompte à régler' ? { acompteCentimes: montantCentimes } : {}),
  }
}

// ─── Annulation d'un règlement autre qu'un virement rejeté (Décision du 20/11/2026, partie C, F84) ─────

/** Libellé de l'action décidée (F84) : une seule action pour tout règlement payé autre qu'un virement rejeté. */
export const LIBELLE_ACTION_ANNULER_REGLEMENT = 'Annuler le règlement'

/** Motifs de l'action « Annuler le règlement » (F84) ; le délai de validité d'un chèque n'est pas calculé (non vérifié). */
export const MOTIFS_ANNULATION_REGLEMENT = ['cheque_perdu', 'opposition', 'cheque_jamais_encaisse', 'prelevement_conteste', 'erreur_ecriture'] as const
export type MotifAnnulationReglement = (typeof MOTIFS_ANNULATION_REGLEMENT)[number]

/** Libellés des motifs, tels que la décision les nomme (F84). */
export const LIBELLES_MOTIF_ANNULATION_REGLEMENT: Readonly<Record<MotifAnnulationReglement, string>> = {
  cheque_perdu: 'Chèque perdu',
  opposition: 'Opposition',
  cheque_jamais_encaisse: 'Chèque jamais encaissé',
  prelevement_conteste: 'Prélèvement contesté',
  erreur_ecriture: "Erreur d'écriture",
}

/** Annulation d'un règlement qui réglait la facture (F84 ; reglements-fournisseurs.ts, annulerReglement). */
export interface AnnulationReglementFacture {
  reglementId: string
  /** Date de l'annulation. */
  le: string
  motif: MotifAnnulationReglement
  montantCentimes: number
}

export function verifierMotifAnnulation(motif: string): void {
  if (!(MOTIFS_ANNULATION_REGLEMENT as readonly string[]).includes(motif))
    throw new Error(`Motif d'annulation « ${motif} » : ${MOTIFS_ANNULATION_REGLEMENT.join(', ')} attendu (Décision du 20/11/2026, partie C, F84).`)
}

function verifierAnnulation(facture: FactureAPayer, annulation: AnnulationReglementFacture): void {
  if (!annulation.reglementId.trim()) throw new Error(`Facture ${facture.id} : le règlement annulé est attendu.`)
  if (!estDateIsoValide(annulation.le)) throw new Error(`Date de l'annulation invalide (${annulation.le}) : AAAA-MM-JJ attendu.`)
  verifierMotifAnnulation(annulation.motif)
  if (!Number.isInteger(annulation.montantCentimes) || annulation.montantCentimes <= 0)
    throw new Error(`Montant annulé invalide (${annulation.montantCentimes}) : centimes entiers strictement positifs attendus.`)
  const id = annulation.reglementId.trim()
  if (facture.annulations?.some((a) => a.reglementId === id) || facture.rejets?.some((r) => r.reglementId === id))
    throw new Error(`Facture ${facture.id} : règlement ${id} déjà annulé ou rejeté ; une annulation ne s'enregistre qu'une fois.`)
}

/**
 * Décision du 20/11/2026 (partie C, F84) : après « Annuler le règlement » (chèque perdu, opposition, chèque jamais
 * encaissé, prélèvement contesté, erreur d'écriture), la facture revient à son état d'avant le paiement (« Bon à payer »,
 * ou « Acompte à régler »), avec le motif (annulations) ; elle se paie ensuite par un nouveau règlement. Mêmes contrôles
 * que le retour après un rejet (J9). Renvoie une copie.
 */
export function retourFactureApresAnnulation<F extends FactureAPayer>(
  facture: F,
  annulation: AnnulationReglementFacture,
  { totalTtcCentimes }: { totalTtcCentimes: number },
): F {
  verifierAnnulation(facture, annulation)
  return {
    ...facture,
    ...etatAvantPaiement(facture, annulation.montantCentimes, totalTtcCentimes, { evenement: "l'annulation", libelle: 'Annulation' }),
    annulations: [...(facture.annulations ?? []), { ...annulation, reglementId: annulation.reglementId.trim() }],
  }
}

// ─── IBAN après un rejet pour coordonnées (Décision du 20/11/2026, partie C, F92) ────────────

export const CATEGORIES_REJET = ['coordonnees', 'autre'] as const
export type CategorieRejet = (typeof CATEGORIES_REJET)[number]

/**
 * Motif qui porte sur les coordonnées bancaires (compte clos, IBAN faux, titulaire inconnu…), lu dans le texte de la
 * banque, ou code de motif SEPA d'un retour sur les coordonnées (🔵 déduit) : AC01 (n° de compte incorrect), AC04 (compte
 * clos), AC06 (compte bloqué), BE01 (titulaire différent), RC01 (BIC incorrect).
 */
const MOTIF_COORDONNEES = /compte\s+(clos|cl[oô]tur|ferm|inconnu|bloqu)|\biban\b|\bbic\b|titulaire|coordonn|\b(AC01|AC04|AC06|BE01|RC01)\b/i

/** Catégorie du rejet : celle saisie, sinon déduite du motif (F92) ; les autres motifs suivent J9 sans changement. */
export const categorieRejet = (rejet: Pick<RejetReglementFacture, 'motif' | 'categorie'>): CategorieRejet =>
  rejet.categorie ?? (MOTIF_COORDONNEES.test(rejet.motif) ? 'coordonnees' : 'autre')

export const SOURCES_VERIFICATION_IBAN = ['courrier_entreprise', 'rib'] as const
export type SourceVerificationIban = (typeof SOURCES_VERIFICATION_IBAN)[number]

/** Libellés des sources de la confirmation, tels que la décision les nomme (F92). */
export const LIBELLES_SOURCE_VERIFICATION_IBAN: Readonly<Record<SourceVerificationIban, string>> = {
  courrier_entreprise: "Courrier de l'entreprise",
  rib: 'RIB',
}

/** IBAN changé ou confirmé après un rejet pour coordonnées, à quatre yeux, avec sa source (F92). */
export interface VerificationIban {
  nature: 'changement' | 'confirmation'
  iban: string
  /** Collaborateur qui a saisi l'IBAN. */
  saisiPar: string
  /** Collaborateur qui confirme : une autre personne. */
  confirmePar: string
  source: SourceVerificationIban
  /** Pièce de la source (courrier de l'entreprise, RIB) ; null : non numérisée. */
  pieceId: string | null
  le: string
}

/** Dernier rejet pour coordonnées de la facture (F92) ; null : aucun. */
const dernierRejetCoordonnees = (facture: Pick<FactureAPayer, 'rejets'>): RejetReglementFacture | null =>
  (facture.rejets ?? []).filter((r) => categorieRejet(r) === 'coordonnees').at(-1) ?? null

/** Dernier rejet pour coordonnées de la facture qui attend encore son IBAN changé ou confirmé (F92) ; null sinon. */
export function ibanAVerifier(facture: Pick<FactureAPayer, 'rejets' | 'verificationsIban'>): RejetReglementFacture | null {
  const dernier = dernierRejetCoordonnees(facture)
  if (dernier === null) return null
  return (facture.verificationsIban ?? []).some((v) => v.le >= dernier.le) ? null : dernier
}

/**
 * IBAN changé ou confirmé après le dernier rejet pour coordonnées (F92) : la dernière vérification datée de ce rejet ou
 * après ; null : aucun rejet pour coordonnées, ou IBAN encore à vérifier (ibanAVerifier).
 */
export function ibanVerifieApresRejet(facture: Pick<FactureAPayer, 'rejets' | 'verificationsIban'>): VerificationIban | null {
  const dernier = dernierRejetCoordonnees(facture)
  if (dernier === null) return null
  return (facture.verificationsIban ?? []).filter((v) => v.le >= dernier.le).at(-1) ?? null
}

/**
 * Décision du 20/11/2026 (partie C, F92) : après un rejet pour coordonnées, l'IBAN se change ou se confirme par une autre
 * personne que celle qui l'a saisi, avec sa source (courrier de l'entreprise, RIB), au plus tôt le jour du rejet ; la
 * vérification est tracée (verificationsIban). Renvoie une copie.
 */
export function verifierIbanApresRejet<F extends FactureAPayer>(facture: F, verification: VerificationIban): F {
  const rejet = ibanAVerifier(facture)
  if (rejet === null) throw new Error(`Facture ${facture.id} : aucun rejet pour coordonnées n'attend de vérification de l'IBAN.`)
  if (!['changement', 'confirmation'].includes(verification.nature)) throw new Error(`Vérification de l'IBAN « ${verification.nature} » : changement ou confirmation attendu.`)
  if (!validerIban(verification.iban)) throw new Error(`Vérification de l'IBAN : IBAN invalide (${verification.iban}).`)
  if (!(SOURCES_VERIFICATION_IBAN as readonly string[]).includes(verification.source))
    throw new Error(`Vérification de l'IBAN : source « ${verification.source} » inconnue (courrier de l'entreprise ou RIB attendu).`)
  const saisiPar = verification.saisiPar.trim()
  const confirmePar = verification.confirmePar.trim()
  if (!saisiPar || !confirmePar || saisiPar === confirmePar)
    throw new Error(`Vérification de l'IBAN : confirmée par une autre personne que celle qui l'a saisi (quatre yeux) — Décision du 20/11/2026 (partie C, F92).`)
  if (!estDateIsoValide(verification.le) || verification.le < rejet.le)
    throw new Error(`Vérification de l'IBAN du ${verification.le} : date AAAA-MM-JJ attendue, jamais avant le rejet du ${rejet.le}.`)
  return { ...facture, verificationsIban: [...(facture.verificationsIban ?? []), { ...verification, saisiPar, confirmePar }] }
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
  /** Intervention contestée de la demande qui porte la facture (Décision du 20/11/2026, partie C, F71). */
  | 'intervention_contestee'
  /** Revenue après un rejet pour coordonnées, IBAN pas encore changé ou confirmé (Décision du 20/11/2026, partie C, F92). */
  | 'iban_a_confirmer'

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

/**
 * Motif tiré du circuit de la facture : mode, bon à payer, intervention contestée (Décision du 20/11/2026, partie C, F71),
 * comptabilisation et saisie ; null s'il n'y en a pas.
 */
function motifCircuit(facture: FactureAPayer): MotifEcart | null {
  if (facture.mode !== 'Virement') return 'mode'
  if (!STATUTS_REGLEMENT_SELECTIONNABLES.has(facture.statutReglement)) return 'pas_de_bon_a_payer'
  if ((facture.interventionContestee ?? null) !== null) return 'intervention_contestee'
  if (ibanAVerifier(facture) !== null) return 'iban_a_confirmer'
  if (!facture.comptabilisee) return 'non_comptabilisee'
  if (!STATUTS_SAISIE_PAYABLES.has(facture.statutSaisie)) return 'non_enregistree'
  return null
}

/** Premier motif qui empêche la facture de partir dans un ordre de virement daté `date`, ou null. */
function motifEcart(facture: FactureAPayer, date: string): MotifEcart | null {
  const circuit = motifCircuit(facture)
  if (circuit !== null) return circuit
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
