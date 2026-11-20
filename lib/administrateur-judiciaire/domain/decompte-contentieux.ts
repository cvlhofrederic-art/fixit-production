import { ajouterJours, ajouterMois, dateIsoVersFr, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import type { Demande } from '@/lib/administrateur-judiciaire/domain/demandes'
import { formatEurosCentimes } from '@/lib/administrateur-judiciaire/domain/format'
import type { PosteCreance } from '@/lib/administrateur-judiciaire/domain/postes-creance'
import type { PhaseContentieux, TypeContentieux } from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Décompte et échéancier d'un dossier contentieux (cartographie Gestéam, tranche 42 : onglet Règlements). Fonctions
 * pures, montants en CENTIMES ENTIERS, dates ISO (AAAA-MM-JJ), sans écran.
 *
 * Gestéam — Jugement : montant demandé · indemnités · principal · dépens · article 700 · intérêts légaux · dommages
 * int. → montant dû ; total règlement → solde dû ; chèques à disposition, chèques promis. Échéancier : en N fois,
 * montant, tous les N <unité>, prochain le ; grille Date · Statut · Montant.
 *
 * Le montant demandé se reconstitue depuis les postes de la créance (`PosteCreance`, décision J3) : ce module ne recrée
 * pas le principal. Tant qu'aucune condamnation n'est saisie (`jugement: null`), le montant dû est le montant demandé ;
 * ensuite, la somme des postes du jugement (🔵 déduit de l'écran Gestéam, non observé sur un dossier jugé chiffré).
 * Le décompte est DATÉ : la demande ou la condamnation est arrêtée à une date ; les règlements datés de ce jour ou avant
 * sont réputés déjà pris en compte (par le juge, ou dans la demande) et ne sont pas déduits une seconde fois — ils sont
 * listés à part, à vérifier. Le montant dû n'inclut pas ce qui court après l'arrêté (intérêts postérieurs, frais
 * d'exécution) : ce n'est ni une assiette d'intérêts ni un décompte d'exécution. Seuls les frais du commissaire de justice
 * payés par le syndicat s'ajoutent au solde, sous leur poste propre (ci-dessous).
 *
 * Décision de Hugo du 17/11/2026 (J67, R48 ; L. 1965 art. 10-1 et CPCE art. L. 111-8 lus sur Légifrance le 17/11/2026) :
 * sont imputables au seul copropriétaire concerné « les frais nécessaires exposés par le syndicat [...] pour le
 * recouvrement d'une créance justifiée à l'encontre d'un copropriétaire ainsi que les droits et émoluments des actes des
 * huissiers de justice et le droit de recouvrement ou d'encaissement à la charge du débiteur » (L. 1965 art. 10-1, a ;
 * les huissiers sont aujourd'hui des commissaires de justice) ; les frais de l'exécution forcée sont à la charge du
 * débiteur, sauf s'ils n'étaient manifestement pas nécessaires (CPCE art. L. 111-8). La facture du commissaire de justice
 * rattachée à une demande « Huissier - exécution forcée » (demandes.ts) du dossier de recouvrement, et payée par le
 * syndicat, se reporte au décompte du débiteur sous le poste POSTE_FRAIS_COMMISSAIRE_JUSTICE
 * (fraisCommissaireJusticeAReporter, puis SaisieDecompte.fraisRecouvrement), hors montant dû, en plus du solde. Quatre
 * garde-fous : (1) créance justifiée : dossier de recouvrement ouvert ; (2) pas de double compte : les frais que le
 * commissaire de justice a déjà recouvrés auprès du débiteur ne se reportent pas ; (3) seule la part « à la charge du
 * débiteur » se reporte : la part du droit de recouvrement ou d'encaissement laissée au créancier (CPCE art. L. 111-8)
 * reste au syndicat, la facture se ventile ; (4) si le juge donne raison au copropriétaire, la créance n'était pas
 * justifiée : le report tombe (alerte), et il est dispensé de toute participation à la dépense commune des frais de
 * procédure (art. 10-1, avant-dernier al.), sauf décision contraire du juge (dernier al.). La ventilation de la facture et
 * les frais déjà recouvrés sont des données nouvelles : enregistrement à brancher ; écran : Frédéric.
 * Les règlements s'imputent globalement : l'imputation poste par poste (C. civ. art. 1342-10 et 1343-1) n'est pas faite ici.
 * 🔵 Unités de périodicité de l'échéancier : la liste Gestéam n'a pas été ouverte (jours, semaines, mois retenus).
 */

/** Postes du jugement, dans l'ordre de la fiche Gestéam. */
export const POSTES_JUGEMENT = [
  { cle: 'indemnites', libelle: 'Indemnités' },
  { cle: 'principal', libelle: 'Principal' },
  { cle: 'depens', libelle: 'Dépens' },
  { cle: 'article700', libelle: 'Article 700 du CPC' },
  { cle: 'interetsLegaux', libelle: 'Intérêts légaux' },
  { cle: 'dommagesInterets', libelle: 'Dommages-intérêts' },
] as const
export type PosteJugement = (typeof POSTES_JUGEMENT)[number]['cle']
export type CondamnationCentimes = Record<PosteJugement, number>

export interface ReglementDebiteur {
  id: string
  date: string
  montantCentimes: number
}

export interface Condamnation {
  postes: CondamnationCentimes
  /** Date d'arrêté du décompte retenue par la décision ; à défaut, date de la décision. */
  arreteLe: string
}

/** Poste propre des frais du commissaire de justice reportés au décompte du débiteur (J67, R48). */
export const POSTE_FRAIS_COMMISSAIRE_JUSTICE = 'Frais de recouvrement (art. 10-1 a) : actes du commissaire de justice' as const

const FONDEMENT_FRAIS_RECOUVREMENT = 'L. 1965 art. 10-1, a ; CPCE art. L. 111-8'

/** Frais du commissaire de justice reportés au décompte du débiteur (fraisCommissaireJusticeAReporter). */
export interface FraisRecouvrementReporte {
  factureId: string
  /** Demande « Huissier - exécution forcée » qui porte la facture. */
  demandeId: string
  poste: typeof POSTE_FRAIS_COMMISSAIRE_JUSTICE
  /** Paiement de la facture par le syndicat. */
  payeeLe: string
  /** Part à la charge du débiteur, moins ce que le commissaire de justice a déjà recouvré auprès de lui. */
  montantCentimes: number
  fondement: string
  justification: string
}

export interface SaisieDecompte {
  montantDemandeCentimes: number
  /** Date d'arrêté du montant demandé (mise en demeure, assignation) ; null : tous les règlements s'en déduisent. */
  demandeArreteeLe: string | null
  /** Condamnation ; null tant qu'aucune n'est saisie. */
  jugement: Condamnation | null
  reglements: ReglementDebiteur[]
  chequesADispositionCentimes: number
  chequesPromisCentimes: number
  /** Frais du commissaire de justice reportés (J67, R48) ; absent : aucun. */
  fraisRecouvrement?: readonly FraisRecouvrementReporte[]
}

export interface Decompte {
  base: 'demande' | 'jugement'
  /** Date d'arrêté de la base ; null pour une demande non datée. */
  arreteLe: string | null
  montantDemandeCentimes: number
  montantDuCentimes: number
  /** Règlements postérieurs à l'arrêté, seuls déduits. */
  totalReglementsCentimes: number
  /** Règlements datés de l'arrêté ou avant : réputés déjà pris en compte, non déduits, à vérifier. */
  reglementsAnterieurs: ReglementDebiteur[]
  /** Poste POSTE_FRAIS_COMMISSAIRE_JUSTICE : frais reportés, hors montant dû, ajoutés au solde (J67, R48). */
  fraisRecouvrementCentimes: number
  /**
   * Montant dû, plus les frais de recouvrement reportés, moins les règlements déduits ; négatif : excédent sur la créance
   * du dossier (à imputer sur le compte du copropriétaire).
   */
  soldeDuCentimes: number
  chequesADispositionCentimes: number
  chequesPromisCentimes: number
  /** 🔵 Solde restant une fois encaissés les chèques à disposition et promis. */
  soldeApresChequesCentimes: number
}

const verifierCentimes = (libelle: string, montant: number): void => {
  if (!Number.isInteger(montant) || montant < 0)
    throw new Error(`${libelle} invalide (${montant}) : centimes entiers positifs attendus.`)
}

const verifierDate = (libelle: string, date: string): void => {
  if (!estDateIsoValide(date)) throw new Error(`Date invalide pour ${libelle} (${date}) : AAAA-MM-JJ attendu.`)
}

const somme = (montants: number[]): number => montants.reduce((total, montant) => total + montant, 0)

/** Contrôle TOUS les règlements (identifiant unique, date ISO, montant > 0), avant tout tri par date. */
function verifierReglements(reglements: ReglementDebiteur[]): void {
  const vus = new Set<string>()
  for (const reglement of reglements) {
    if (vus.has(reglement.id)) throw new Error(`Règlement compté deux fois (id=${reglement.id}).`)
    vus.add(reglement.id)
    verifierDate(`le règlement ${reglement.id}`, reglement.date)
    if (!Number.isInteger(reglement.montantCentimes) || reglement.montantCentimes <= 0)
      throw new Error(`Montant du règlement ${reglement.id} invalide (${reglement.montantCentimes}) : centimes entiers > 0 attendus.`)
  }
}

const totalReglements = (reglements: ReglementDebiteur[]): number => somme(reglements.map((r) => r.montantCentimes))

/** Montant demandé reconstitué depuis les postes de la créance (décision J3). */
export const totalPostesCreance = (postes: PosteCreance[]): number => somme(postes.map((poste) => poste.montantCentimes))

/** Écart entre le montant demandé du dossier et ses postes de créance : positif si le dossier demande davantage. */
export const ecartMontantDemande = (montantDemandeCentimes: number, postes: PosteCreance[]): number =>
  montantDemandeCentimes - totalPostesCreance(postes)

function verifierSaisieDecompte(saisie: SaisieDecompte): void {
  verifierCentimes('Montant demandé', saisie.montantDemandeCentimes)
  verifierCentimes('Montant des chèques à disposition', saisie.chequesADispositionCentimes)
  verifierCentimes('Montant des chèques promis', saisie.chequesPromisCentimes)
  if (saisie.demandeArreteeLe !== null) verifierDate("l'arrêté de la demande", saisie.demandeArreteeLe)
  if (saisie.jugement) {
    verifierDate("l'arrêté du jugement", saisie.jugement.arreteLe)
    for (const { cle, libelle } of POSTES_JUGEMENT) verifierCentimes(`Poste « ${libelle} »`, saisie.jugement.postes[cle])
  }
  verifierReglements(saisie.reglements)
  verifierFraisReportes(saisie.fraisRecouvrement ?? [])
}

/** Frais reportés : une facture une seule fois, montant en centimes entiers > 0, date de paiement ISO. */
function verifierFraisReportes(frais: readonly FraisRecouvrementReporte[]): void {
  const vues = new Set<string>()
  for (const ligne of frais) {
    if (vues.has(ligne.factureId)) throw new Error(`Facture du commissaire de justice comptée deux fois au décompte (id=${ligne.factureId}).`)
    vues.add(ligne.factureId)
    verifierDate(`le paiement de la facture ${ligne.factureId}`, ligne.payeeLe)
    if (!Number.isInteger(ligne.montantCentimes) || ligne.montantCentimes <= 0)
      throw new Error(`Frais reportés de la facture ${ligne.factureId} invalides (${ligne.montantCentimes}) : centimes entiers > 0 attendus.`)
  }
}

/**
 * Décompte du dossier : montant dû (demande ou condamnation) arrêté à sa date, règlements postérieurs déduits,
 * règlements antérieurs listés à part, solde, projection des chèques.
 */
export function calculerDecompte(saisie: SaisieDecompte): Decompte {
  verifierSaisieDecompte(saisie)
  const { jugement } = saisie
  const montantDuCentimes = jugement
    ? somme(POSTES_JUGEMENT.map(({ cle }) => jugement.postes[cle]))
    : saisie.montantDemandeCentimes
  const arreteLe = jugement ? jugement.arreteLe : saisie.demandeArreteeLe
  const anterieur = (r: ReglementDebiteur) => arreteLe !== null && r.date <= arreteLe
  const totalReglementsCentimes = totalReglements(saisie.reglements.filter((r) => !anterieur(r)))
  const fraisRecouvrementCentimes = somme((saisie.fraisRecouvrement ?? []).map((ligne) => ligne.montantCentimes))
  const soldeDuCentimes = montantDuCentimes + fraisRecouvrementCentimes - totalReglementsCentimes
  return {
    base: jugement ? 'jugement' : 'demande',
    arreteLe,
    montantDemandeCentimes: saisie.montantDemandeCentimes,
    montantDuCentimes,
    totalReglementsCentimes,
    reglementsAnterieurs: saisie.reglements.filter(anterieur),
    fraisRecouvrementCentimes,
    soldeDuCentimes,
    chequesADispositionCentimes: saisie.chequesADispositionCentimes,
    chequesPromisCentimes: saisie.chequesPromisCentimes,
    soldeApresChequesCentimes: soldeDuCentimes - saisie.chequesADispositionCentimes - saisie.chequesPromisCentimes,
  }
}

// ─── Frais du commissaire de justice (J67, R48) ─────────────────────────────────────────────

/** Facture du commissaire de justice, ventilée entre débiteur et créancier (enregistrement : à brancher). */
export interface FactureCommissaireJustice {
  factureId: string
  /** Montant de la facture payée par le syndicat. */
  montantCentimes: number
  /** Part du droit de recouvrement ou d'encaissement laissée à la charge du créancier (CPCE art. L. 111-8) : reste au syndicat. */
  partCreancierCentimes: number
  /** Frais que le commissaire de justice a déjà recouvrés auprès du débiteur : jamais comptés deux fois. */
  dejaRecouvresCentimes: number
  /** Paiement par le syndicat ; null : facture non payée. */
  payeeLe: string | null
}

/** Dossier contentieux que la demande d'exécution forcée exécute (contentieux.ts), et ce que le juge a dit de la créance. */
export interface DossierRecouvrementDuDebiteur {
  id: string
  type: TypeContentieux
  phase: PhaseContentieux
  dateCloture: string | null
  /** Le juge a statué sur la créance : en faveur du syndicat, du copropriétaire ; null : pas encore. */
  decisionJuge: 'syndicat' | 'coproprietaire' | null
}

export interface AlerteFraisRecouvrement {
  code: 'facture_non_payee' | 'creance_non_justifiee' | 'creance_rejetee_par_le_juge' | 'frais_deja_recouvres'
  message: string
  fondement: string
}

export interface ReportFraisCommissaireJustice {
  /** Ligne à reporter au décompte du débiteur (SaisieDecompte.fraisRecouvrement) ; null : rien à reporter, voir les alertes. */
  report: FraisRecouvrementReporte | null
  /** Part de la facture laissée au créancier : elle reste au syndicat. */
  resteAuSyndicatCentimes: number
  alertes: AlerteFraisRecouvrement[]
}

type DemandeExecutionForcee = Pick<Demande, 'id' | 'executionForcee' | 'dossier' | 'factureIds'>

const TYPE_RECOUVREMENT: TypeContentieux = 'Recouvrement de charges/loyer'

const eurosFrais = (centimes: number): string => formatEurosCentimes(centimes / 100)

const alerteFrais = (code: AlerteFraisRecouvrement['code'], message: string): AlerteFraisRecouvrement => ({
  code,
  message,
  fondement: FONDEMENT_FRAIS_RECOUVREMENT,
})

/** La facture appartient à une demande d'exécution forcée de ce dossier ; ses montants sont cohérents. */
function verifierFactureCommissaire(demande: DemandeExecutionForcee, facture: FactureCommissaireJustice, dossier: DossierRecouvrementDuDebiteur): void {
  if (!demande.executionForcee) throw new Error(`Demande ${demande.id} : seule une demande d'exécution forcée porte la facture du commissaire de justice.`)
  if (demande.dossier?.type !== 'Contentieux' || demande.dossier.id !== dossier.id)
    throw new Error(`Demande ${demande.id} : elle n'exécute pas le dossier contentieux ${dossier.id}.`)
  if (!demande.factureIds.includes(facture.factureId)) throw new Error(`Facture ${facture.factureId} non rattachée à la demande ${demande.id}.`)
  verifierCentimes('Montant de la facture', facture.montantCentimes)
  verifierCentimes('Part du créancier', facture.partCreancierCentimes)
  verifierCentimes('Frais déjà recouvrés', facture.dejaRecouvresCentimes)
  if (facture.payeeLe !== null) verifierDate(`le paiement de la facture ${facture.factureId}`, facture.payeeLe)
  if (facture.partCreancierCentimes > facture.montantCentimes)
    throw new Error(`Facture ${facture.factureId} : part du créancier supérieure au montant de la facture.`)
  if (facture.dejaRecouvresCentimes > facture.montantCentimes - facture.partCreancierCentimes)
    throw new Error(`Facture ${facture.factureId} : frais déjà recouvrés supérieurs à la part à la charge du débiteur.`)
}

/** Pourquoi rien ne se reporte (facture non payée, garde-fous 4 et 1) ; null : le report est possible. */
function refusReport(facture: FactureCommissaireJustice, dossier: DossierRecouvrementDuDebiteur): AlerteFraisRecouvrement | null {
  if (facture.payeeLe === null)
    return alerteFrais('facture_non_payee', `Facture ${facture.factureId} non payée par le syndicat : rien à reporter au décompte du débiteur tant qu'elle ne l'est pas.`)
  if (dossier.decisionJuge === 'coproprietaire')
    return alerteFrais(
      'creance_rejetee_par_le_juge',
      `Le juge a donné raison au copropriétaire (dossier ${dossier.id}) : la créance n'était pas justifiée, les frais du commissaire de justice ne lui sont pas imputés ; il est en plus dispensé de toute participation à la dépense commune des frais de procédure (L. 1965 art. 10-1, avant-dernier al.), sauf décision contraire du juge (dernier al.) : vérifier la répartition.`,
    )
  if (dossier.type !== TYPE_RECOUVREMENT || dossier.phase === 'Clos' || dossier.dateCloture !== null)
    return alerteFrais(
      'creance_non_justifiee',
      `Dossier ${dossier.id} (${dossier.type}, ${dossier.phase}) : seuls les frais du recouvrement d'une créance justifiée, dossier de recouvrement ouvert, sont imputables au copropriétaire ; rien n'est reporté.`,
    )
  return null
}

/**
 * Part de la facture du commissaire de justice à reporter au décompte du débiteur (J67, R48 ; L. 1965 art. 10-1, a ;
 * CPCE art. L. 111-8) : montant de la facture, moins la part laissée au créancier (reste au syndicat), moins les frais
 * déjà recouvrés auprès du débiteur ; seulement pour une facture payée par le syndicat, d'un dossier de recouvrement
 * ouvert, quand le juge n'a pas donné raison au copropriétaire. Lève une erreur si la demande n'est pas l'exécution
 * forcée de ce dossier, si la facture ne lui est pas rattachée, ou si la ventilation est incohérente.
 */
export function fraisCommissaireJusticeAReporter(
  demande: DemandeExecutionForcee,
  facture: FactureCommissaireJustice,
  dossier: DossierRecouvrementDuDebiteur,
): ReportFraisCommissaireJustice {
  verifierFactureCommissaire(demande, facture, dossier)
  const resteAuSyndicatCentimes = facture.partCreancierCentimes
  const refus = refusReport(facture, dossier)
  if (refus !== null || facture.payeeLe === null) return { report: null, resteAuSyndicatCentimes, alertes: refus === null ? [] : [refus] }
  const partDebiteur = facture.montantCentimes - facture.partCreancierCentimes
  const montantCentimes = partDebiteur - facture.dejaRecouvresCentimes
  if (montantCentimes === 0)
    return {
      report: null,
      resteAuSyndicatCentimes,
      alertes: [
        alerteFrais(
          'frais_deja_recouvres',
          `Facture ${facture.factureId} : le commissaire de justice a déjà recouvré ces frais auprès du débiteur ; rien à reporter (pas de double compte).`,
        ),
      ],
    }
  const justification = `Facture ${facture.factureId} de ${eurosFrais(facture.montantCentimes)}, payée le ${dateIsoVersFr(facture.payeeLe)} : part à la charge du débiteur ${eurosFrais(partDebiteur)} (part laissée au créancier : ${eurosFrais(facture.partCreancierCentimes)}), moins ${eurosFrais(facture.dejaRecouvresCentimes)} déjà recouvrés par le commissaire de justice : ${eurosFrais(montantCentimes)} reportés au décompte (${FONDEMENT_FRAIS_RECOUVREMENT}).`
  return {
    report: {
      factureId: facture.factureId,
      demandeId: demande.id,
      poste: POSTE_FRAIS_COMMISSAIRE_JUSTICE,
      payeeLe: facture.payeeLe,
      montantCentimes,
      fondement: FONDEMENT_FRAIS_RECOUVREMENT,
      justification,
    },
    resteAuSyndicatCentimes,
    alertes: [],
  }
}

export const UNITES_PERIODICITE = ['jours', 'semaines', 'mois'] as const
export type UnitePeriodicite = (typeof UNITES_PERIODICITE)[number]

export interface Periodicite {
  nombre: number
  tousLes: number
  unite: UnitePeriodicite
  premiereLe: string
}

export interface PlanEcheancier extends Periodicite {
  /** Montant de chaque échéance. */
  montantCentimes: number
}

export interface EcheanceDebiteur {
  rang: number
  date: string
  montantCentimes: number
}

function verifierPeriodicite(periodicite: Periodicite): void {
  if (!Number.isInteger(periodicite.nombre) || periodicite.nombre < 1)
    throw new Error(`Nombre d'échéances invalide (${periodicite.nombre}) : entier ≥ 1 attendu.`)
  if (!Number.isInteger(periodicite.tousLes) || periodicite.tousLes < 1)
    throw new Error(`Périodicité invalide (tous les ${periodicite.tousLes}) : entier ≥ 1 attendu.`)
  if (!(UNITES_PERIODICITE as readonly string[]).includes(periodicite.unite))
    throw new Error(`Unité de périodicité inconnue : « ${periodicite.unite} ».`)
  verifierDate('la première échéance', periodicite.premiereLe)
}

/** Date de l'échéance de rang `rang` (1 = la première), calculée depuis la première pour éviter toute dérive. */
function dateEcheance(periodicite: Periodicite, rang: number): string {
  const pas = periodicite.tousLes * (rang - 1)
  if (periodicite.unite === 'mois') return ajouterMois(periodicite.premiereLe, pas)
  return ajouterJours(periodicite.premiereLe, periodicite.unite === 'semaines' ? pas * 7 : pas)
}

/** Échéancier Gestéam : N échéances d'un même montant, tous les N jours, semaines ou mois. */
export function genererEcheancier(plan: PlanEcheancier): EcheanceDebiteur[] {
  verifierPeriodicite(plan)
  if (!Number.isInteger(plan.montantCentimes) || plan.montantCentimes <= 0)
    throw new Error(`Montant d'échéance invalide (${plan.montantCentimes}) : centimes entiers > 0 attendus.`)
  return Array.from({ length: plan.nombre }, (_, index) => ({
    rang: index + 1,
    date: dateEcheance(plan, index + 1),
    montantCentimes: plan.montantCentimes,
  }))
}

/** Échelonne un solde en N échéances égales ; l'arrondi va sur la dernière. */
export function echelonner(totalCentimes: number, periodicite: Periodicite): EcheanceDebiteur[] {
  verifierPeriodicite(periodicite)
  verifierCentimes('Montant à échelonner', totalCentimes)
  const courant = Math.floor(totalCentimes / periodicite.nombre)
  if (courant < 1)
    throw new Error(`Impossible d'échelonner ${totalCentimes} centimes en ${periodicite.nombre} fois : échéance inférieure à 1 centime.`)
  return Array.from({ length: periodicite.nombre }, (_, index) => ({
    rang: index + 1,
    date: dateEcheance(periodicite, index + 1),
    montantCentimes: index === periodicite.nombre - 1 ? totalCentimes - courant * (periodicite.nombre - 1) : courant,
  }))
}

export type StatutEcheance = 'payee' | 'partielle' | 'impayee' | 'a_venir'

export interface EcheanceSuivie extends EcheanceDebiteur {
  payeCentimes: number
  statut: StatutEcheance
}

export interface SuiviEcheancier {
  echeances: EcheanceSuivie[]
  /** Première échéance non soldée qui n'est pas encore échue ; null si toutes sont soldées ou échues. */
  prochaine: EcheanceSuivie | null
  /** Reste dû sur les échéances échues (date antérieure à aujourd'hui). */
  impayesCentimes: number
  /** Vrai si aucune échéance échue ne reste à payer. */
  respecte: boolean
  /** Règlements au-delà du total de l'échéancier. */
  excedentCentimes: number
}

const statutEcheance = (montant: number, paye: number, echue: boolean): StatutEcheance => {
  if (paye >= montant) return 'payee'
  if (paye > 0) return 'partielle'
  return echue ? 'impayee' : 'a_venir'
}

/** Contrôle des échéances reçues : rang entier unique, date ISO, montant entier > 0. */
function verifierEcheances(echeances: EcheanceDebiteur[]): void {
  const rangs = new Set<number>()
  for (const echeance of echeances) {
    if (!Number.isInteger(echeance.rang) || rangs.has(echeance.rang))
      throw new Error(`Rang d'échéance invalide ou en double (${echeance.rang}).`)
    rangs.add(echeance.rang)
    verifierDate(`l'échéance ${echeance.rang}`, echeance.date)
    if (!Number.isInteger(echeance.montantCentimes) || echeance.montantCentimes <= 0)
      throw new Error(`Montant de l'échéance ${echeance.rang} invalide (${echeance.montantCentimes}) : centimes entiers > 0 attendus.`)
  }
}

/**
 * Suivi de l'échéancier à `aujourdhui` : les règlements reçus jusqu'à ce jour (à passer : ceux faits au titre de
 * l'échéancier) s'imputent dans l'ordre des échéances. Une échéance du jour n'est pas encore impayée. Tous les
 * règlements sont contrôlés avant d'écarter ceux datés après aujourd'hui.
 */
export function suivreEcheancier(
  echeances: EcheanceDebiteur[],
  reglements: ReglementDebiteur[],
  aujourdhui: string,
): SuiviEcheancier {
  verifierDate("aujourd'hui", aujourdhui)
  verifierEcheances(echeances)
  verifierReglements(reglements)
  let disponible = totalReglements(reglements.filter((reglement) => reglement.date <= aujourdhui))
  const suivies = [...echeances]
    .sort((a, b) => a.rang - b.rang)
    .map((echeance): EcheanceSuivie => {
      const payeCentimes = Math.min(disponible, echeance.montantCentimes)
      disponible -= payeCentimes
      return { ...echeance, payeCentimes, statut: statutEcheance(echeance.montantCentimes, payeCentimes, echeance.date < aujourdhui) }
    })
  const impayesCentimes = somme(
    suivies.filter((e) => e.date < aujourdhui).map((e) => e.montantCentimes - e.payeCentimes),
  )
  return {
    echeances: suivies,
    prochaine: suivies.find((e) => e.statut !== 'payee' && e.date >= aujourdhui) ?? null,
    impayesCentimes,
    respecte: impayesCentimes === 0,
    excedentCentimes: disponible,
  }
}

/** Délais de grâce : report ou échelonnement « dans la limite de deux années » (C. civ. art. 1343-5). */
export const DUREE_MAX_DELAIS_GRACE_MOIS = 24

/**
 * Origine de l'échéancier. Seuls les délais de grâce accordés par le juge sont bornés à deux ans ; un protocole
 * amiable, un accord homologué ou un plan de surendettement (régime propre, C. consom.) ne le sont pas ici.
 */
export const ORIGINES_ECHEANCIER = ['amiable', 'accord_homologue', 'delais_grace', 'surendettement'] as const
export type OrigineEcheancier = (typeof ORIGINES_ECHEANCIER)[number]

export interface DecisionEcheancier {
  origine: OrigineEcheancier
  decideLe: string
  /** Délais de grâce : jugement contradictoire (délai compté du jugement) ; sinon, de la notification (CPC art. 511). */
  contradictoire?: boolean
  notifieeLe?: string | null
}

export interface AlerteEcheancier {
  code: 'delais_grace_depasses' | 'premiere_avant_decision' | 'point_de_depart_inconnu'
  message: string
}

/** Point de départ des délais de grâce : le jugement s'il est contradictoire, sinon sa notification ; null si inconnu. */
function departDelaisGrace(decision: DecisionEcheancier): string | null {
  if (decision.contradictoire === true) return decision.decideLe
  return decision.notifieeLe ?? null
}

/**
 * Contrôles d'un échéancier : première échéance postérieure à la décision qui le fixe ; pour des délais de grâce,
 * dernière échéance au plus tard DUREE_MAX_DELAIS_GRACE_MOIS mois après leur point de départ (jugement contradictoire,
 * sinon notification ; alerte si ce point de départ est inconnu).
 */
export function controlerEcheancier(echeances: EcheanceDebiteur[], decision: DecisionEcheancier): AlerteEcheancier[] {
  if (!(ORIGINES_ECHEANCIER as readonly string[]).includes(decision.origine))
    throw new Error(`Origine d'échéancier inconnue : « ${decision.origine} ».`)
  verifierDate('la décision', decision.decideLe)
  if (decision.notifieeLe) verifierDate('la notification', decision.notifieeLe)
  verifierEcheances(echeances)
  const dates = echeances.map((e) => e.date).sort((a, b) => a.localeCompare(b))
  const premiere = dates[0]
  const derniere = dates.at(-1)
  if (premiere === undefined || derniere === undefined) return []
  const alertes: AlerteEcheancier[] = []
  if (premiere < decision.decideLe)
    alertes.push({ code: 'premiere_avant_decision', message: "Première échéance antérieure à la décision qui fixe l'échéancier." })
  if (decision.origine !== 'delais_grace') return alertes
  const depart = departDelaisGrace(decision)
  if (depart === null)
    alertes.push({
      code: 'point_de_depart_inconnu',
      message: 'Délais de grâce : jugement non contradictoire sans date de notification, point de départ inconnu (CPC art. 511).',
    })
  else if (derniere > ajouterMois(depart, DUREE_MAX_DELAIS_GRACE_MOIS))
    alertes.push({
      code: 'delais_grace_depasses',
      message: `Dernière échéance au-delà de ${DUREE_MAX_DELAIS_GRACE_MOIS} mois après le point de départ : délais de grâce limités à deux ans (C. civ. art. 1343-5).`,
    })
  return alertes
}
