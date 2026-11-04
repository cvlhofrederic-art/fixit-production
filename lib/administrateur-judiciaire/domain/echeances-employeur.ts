import {
  ajouterJours,
  ajouterMois,
  composerDateIso,
  decomposerDateIso,
  ecartJours,
  estDateIsoValide,
  joursDansMois,
  reporterAuJourOuvrable,
  verifierAujourdhui,
  type OptionsJoursFeries,
} from '@/lib/administrateur-judiciaire/domain/dates'
import {
  controlerBulletinSalarie,
  estPeriodeValide,
  libellePeriode,
  netRegleParBulletin,
  reglementsEnVigueur,
  type BulletinPaie,
  type ObligationEmployeur,
  type ReglementPaie,
  type ReglementPaieEcrit,
  type SalarieSyndicat,
} from '@/lib/administrateur-judiciaire/domain/personnel-syndicat'
import type { ElementAFaire } from '@/lib/administrateur-judiciaire/domain/suivi-a-faire'
import type { Traitement } from '@/lib/administrateur-judiciaire/domain/traitements'

/**
 * Échéances du syndicat employeur (point 42 du bilan, vague 7) : DSN, versement des cotisations, adhésion au service de
 * santé au travail, visites médicales, DUERP, paiement du salaire, taxe sur les salaires. Fonctions pures, dates ISO,
 * montants en CENTIMES ENTIERS, sans écran ni table ; versElementsAFaire en fait des éléments du suivi « à faire ». La
 * paie elle-même (écritures, règlements) est dans personnel-syndicat.ts.
 *
 * Gestéam — 🟢 tranche 43 § 19 : le rôle « Gardien / employé d'immeuble » classe Déclaration DSN, DUERP, Attestation de
 * suivi médecine du travail, Arrêt maladie, Salaire et charges sociales ; la tranche conclut que le syndicat employeur a de
 * vraies obligations, distinctes des factures (tranche 43 § 10).
 *
 * Le droit — 🟢 lu sur Légifrance le 30/10/2026 :
 * - CSS L133-5-3, I : tout employeur adresse une déclaration sociale nominative ; R133-14, I (version du 01/07/2026) :
 *   elle « est adressée chaque mois au plus tard aux dates mentionnées à l'article R. 243-6 » ; « Si le délai imparti pour
 *   effectuer la déclaration sociale nominative expire un jour férié ou non ouvré, il est prorogé jusqu'au jour ouvrable
 *   suivant » ; elle est due « même si aucune rémunération n'a été versée », tant que l'employeur n'a pas demandé la
 *   radiation de son compte (ou obtenu la dispense) ; R243-6, II : le versement est effectué le mois suivant la période
 *   de travail, « au plus tard aux échéances suivantes » : le 5 (effectif d'au moins cinquante salariés et paie du même
 *   mois), le 15 dans les autres cas ; R243-6-1 : moins de onze salariés, option pour le versement trimestriel des
 *   cotisations « dans les quinze premiers jours du trimestre civil suivant », la DSN restant due à la date du 2° du II de
 *   R243-6 ; ni R243-6 ni R243-6-1 ne prévoient de report du versement ;
 * - C. trav. R7214-5 et R7214-6 : l'employeur d'un gardien adhère à un service de santé au travail interentreprises,
 *   adhésion « demandée dans le délai d'un mois à compter de l'engagement du premier salarié » ; L7211-3, 7° : surveillance
 *   médicale de droit commun (L7214-1, visite annuelle propre aux concierges, abrogé) ;
 * - C. trav. R4624-10 : visite d'information et de prévention « dans un délai qui n'excède pas trois mois à compter de la
 *   prise effective du poste de travail » ; R4624-16 : renouvellement selon une périodicité fixée par le médecin du
 *   travail, « qui ne peut excéder cinq ans » ; R4624-31 (version du 15/06/2026) : examen de reprise après un congé de
 *   maternité, une maladie professionnelle, un accident du travail d'au moins trente jours, une maladie ou un accident non
 *   professionnel d'au moins soixante jours, « au plus tard dans un délai de huit jours qui suivent cette reprise » ;
 * - CCN IDCC 1043, art. 13 (« En vigueur étendu ») : « examen médical périodique tous les 2 ans » ; visite de reprise
 *   « au plus tard dans un délai de 8 jours » après une maladie professionnelle, un congé maternité, un arrêt d'au moins
 *   30 jours pour maladie ou accident non professionnel ou pour accident du travail ; art. 22, 3 : « Le salaire est payé
 *   au plus tard le dernier jour du mois » ;
 * - C. trav. R4121-1 et L4121-3-1, II : l'employeur transcrit et met à jour le document unique (DUERP) ; R4121-2 : mise à
 *   jour « au moins chaque année dans les entreprises d'au moins onze salariés », et sur événement quel que soit
 *   l'effectif ; R4121-4 : conservé 40 ans ; L4121-3-1, VI : « transmis par l'employeur à chaque mise à jour » au service
 *   de prévention et de santé au travail ;
 * - CGI art. 231, 1 : la taxe sur les salaires est « à la charge des entreprises et organismes qui emploient ces
 *   salariés » ; art. 1679 : non due jusqu'à 1 200 € par an, décote des trois quarts de l'écart avec 2 040 € ; annexe
 *   III, art. 369, 1 : selon la taxe « acquittée l'année précédente », versement de la taxe due « à raison des
 *   rémunérations payées pendant l'année en cours » annuel (moins de 4 000 €), trimestriel (de 4 000 € à 10 000 €) ou
 *   mensuel (au-delà), dans les quinze premiers jours de la période suivante ; 369, 3 : déclaration annuelle au plus tard
 *   le 15 janvier ; 369, 5 : dispense de déclaration sous la franchise ; BOFiP BOI-TPS-TS-10-10-20 (doctrine), § 180 :
 *   pour l'exonération de l'art. 231, 1, le chiffre d'affaires « doit s'apprécier au regard de l'ensemble des recettes et
 *   autres produits, y compris ceux qui n'entrent pas dans le champ d'application de la TVA » ; § 220 : l'exonération des
 *   particuliers employeurs ne vaut pas pour les concierges des syndicats.
 *
 * 🔵 Déduit :
 * - Gestéam : aucun calcul de ces échéances observé dans les tranches relevées (tranche 38, réglage du Suivi : aucun bloc
 *   employeur) ;
 * - DSN : une échéance par mois non déclaré, du mois qui suit la dernière DSN (à défaut, du mois de la première entrée)
 *   au mois en cours, jusqu'au mois de la radiation ; 24 périodes détaillées au plus, les plus récentes ; les plus
 *   anciennes sont signalées par une échéance récapitulative (« à vérifier » si la dernière DSN n'est pas connue) ;
 *   « jour ouvrable suivant » lu comme le premier jour qui n'est ni samedi, ni dimanche, ni férié (reporterAuJourOuvrable :
 *   le samedi est « non ouvré ») ;
 * - versement des cotisations : le 5 ou le 15 du mois suivant (trimestriel : le 15 du mois qui suit le trimestre), sans
 *   report ; une seule échéance « DSN et versement » quand les deux dates coïncident, deux sinon (🔴 8) ;
 * - prise effective du poste = date d'entrée du salarié ; engagement du premier salarié = première entrée ;
 * - la prochaine visite saisie (fixée par le service de santé au travail) prime, sauf si une visite a eu lieu depuis (ou
 *   le jour même) : la visite périodique est alors calculée depuis la dernière ; sans visite connue : visite
 *   d'information et de prévention trois mois après l'entrée ; suivis adapté, renforcé ou de nuit (R4624-17, -18, -28)
 *   non distingués : la prochaine visite saisie les couvre ; salarié sorti : plus aucune visite à suivre, reprise comprise ;
 * - durée d'absence = jours écoulés du premier jour d'arrêt à la reprise ;
 * - DUERP absent : à établir dès la première entrée (aucun délai écrit) ; transmission au service de prévention et de
 *   santé au travail à la date de la mise à jour (aucun délai écrit) : à confirmer ;
 * - salaire à payer au dernier jour du mois du bulletin tant que les règlements du net en vigueur rattachés au bulletin
 *   ne le couvrent pas (en vigueur : traitement présent au grand livre fourni, sans annulation ; un virement rejeté puis
 *   annulé rouvre l'échéance) ; bulletins et règlements contrôlés à l'entrée (période, montants, syndicat, bulletin réglé
 *   connu et du même salarié, aucun bulletin réglé au-delà de son net, traitement de chaque règlement au grand livre) ;
 *   le règlement du net n'est écrit qu'une fois son bulletin constaté (personnel-syndicat.ts) : il ne peut donc pas solder
 *   le 421 en laissant « à payer » le bulletin déjà constaté ;
 * - taxe sur les salaires : le syndicat, employeur non assujetti à la TVA, en serait redevable, sans l'abattement de
 *   l'art. 1679 A (qui ne le vise pas) ; suivie seulement si le cabinet l'a décidé (taxeSalaires non nul), toujours à
 *   confirmer ; aucune exonération calculée ; échéance sans report (aucun texte lu) ; décote arrondie au centime ; du
 *   1er au 15 janvier, le versement porte sur l'année écoulée : sa périodicité suit la taxe acquittée deux ans plus tôt
 *   (art. 369, 1 : la taxe de l'année précédente fixe celle de l'année en cours) ; à défaut de ce montant, la période
 *   versée n'est pas préjugée.
 *
 * 🔴 Non établi (questions exactes pour Frédéric ou Hugo) :
 * 1. Hugo : pour la médecine du travail du gardien, faut-il retenir la CCN IDCC 1043, art. 13 (examen périodique tous les
 *    2 ans ; reprise après 30 jours d'arrêt pour maladie non professionnelle) ou le Code du travail (R4624-16 : au plus
 *    5 ans, délai fixé par le médecin ; R4624-31 : 60 jours) ? L'art. 13 renvoie à un R4624-18 dont le contenu a changé
 *    depuis 2017. Par défaut : la CCN (plus exigeante), réglable ; datesVisitePeriodique expose les deux dates.
 * 2. Frédéric ou Hugo : un syndicat de copropriétaires bénéficie-t-il de l'exonération de taxe sur les salaires du CGI
 *    art. 231, 1, al. 2 (chiffre d'affaires de l'année précédente au plus égal aux plafonds de l'art. 293 B, 85 000 € et
 *    37 500 €) ? Selon le BOFiP § 180 (doctrine), ce chiffre d'affaires comprend « l'ensemble des recettes et autres
 *    produits », même hors du champ de la TVA : les provisions appelées des copropriétaires en font-elles partie, de
 *    sorte que l'exonération ne joue que si le total des produits de l'année précédente reste sous ces plafonds ? Quelle
 *    est la pratique du cabinet ? L'art. 293 B est affiché à la fois en vigueur depuis le 01/03/2025 et « Abrogé par
 *    Ordonnance n° 2025-1247 du 17 décembre 2025 », sans date d'effet lisible.
 * 3. Hugo : sous onze salariés, le DUERP n'a pas d'échéance annuelle (R4121-2), seulement des mises à jour sur événement.
 *    Un rappel de gestion de 12 mois (réglable, désactivable) vous convient-il ?
 * 4. Comment calculer l'effectif (seuils de 11 et 50 salariés) ? CSS R130-1 non lu : l'effectif est fourni par
 *    l'appelant.
 * 5. Événements DSN (fin de contrat, arrêt sans subrogation) : délai fixé par un arrêté non lu (R133-14, II : il « ne peut
 *    excéder cinq jours ouvrés ») ; non calculé.
 * 6. R4624-31 dans sa version du 15/06/2026 vaut pour les arrêts délivrés à compter du lendemain de la publication du
 *    décret n° 2026-503 ; rédaction antérieure non lue : la visite de reprise d'un arrêt commencé avant le 15/06/2026 est
 *    à confirmer.
 * 7. Non suivis faute de texte lu : date du dépôt du DUERP sur le portail sous 150 salariés (L4121-3-1, V, B) ;
 *    contribution conventionnelle à la formation et date de collecte de la contribution au paritarisme (CCN art. 7, 6 :
 *    0,02 %). Hors champ : logement du gardien licencié (L7212-1, R7212-1 : trois mois) et remplaçant pendant les congés
 *    (L7213-2, R7213-8 : huit jours), qui demandent de distinguer gardien logé (catégorie B) et employé non logé (A).
 * 8. Hugo : le report au jour ouvrable suivant ne vise que la DSN (R133-14, I) ; aucun texte lu ne reporte le versement
 *    des cotisations (R243-6, II ; R243-6-1), alors que la majoration de retard court des dates limites d'exigibilité.
 *    VitFix affiche donc le versement au 5 ou au 15, même un samedi, un dimanche ou un jour férié. La pratique de l'Urssaf
 *    le reporte-t-elle, et faut-il suivre cette pratique ?
 *
 * Branchement à faire plus tard : suivi-a-faire.ts (sous PR) n'a pas de famille « personnel » ; versElementsAFaire range
 * donc ces échéances en « mandat / échéance légale », à basculer quand la famille existera. Écrans (Obligations, dossier
 * employeur) : Frédéric.
 */

export interface PeriodePaie {
  annee: number
  mois: number
}

export const MOTIFS_ARRET = ['maternite', 'maladie_professionnelle', 'accident_travail', 'non_professionnel'] as const
export type MotifArret = (typeof MOTIFS_ARRET)[number]

const LIBELLES_MOTIF_ARRET: Record<MotifArret, string> = {
  maternite: 'congé de maternité',
  maladie_professionnelle: 'maladie professionnelle',
  accident_travail: 'accident du travail',
  non_professionnel: 'maladie ou accident non professionnel',
}

export interface ArretTravail {
  id: string
  salarieId: string
  motif: MotifArret
  /** Premier jour d'absence. */
  du: string
  /** Reprise effective, ou prévue dès qu'elle est connue ; null : inconnue. */
  repriseLe: string | null
  /** Examen de reprise passé (ou dispense constatée) ; null : à faire. */
  visiteRepriseLe: string | null
}

export interface SuiviMedical {
  salarieId: string
  derniereVisiteLe: string | null
  /** Prochaine visite fixée par le service de prévention et de santé au travail. */
  prochaineLe: string | null
}

export const REFERENCES_MEDICALES = ['ccn_1043', 'code_du_travail'] as const
export type ReferenceMedicale = (typeof REFERENCES_MEDICALES)[number]
const REFERENCES_ADMISES: ReadonlySet<string> = new Set(REFERENCES_MEDICALES)

/** Réglages de suivi (🔴 1 et 3). */
export interface ReglagesSuiviEmployeur {
  referenceMedicale: ReferenceMedicale
  /** Rappel de gestion de la revue du DUERP sous onze salariés, en mois ; null : aucun rappel. */
  rappelDuerpMois: number | null
  alsaceMoselle: boolean
}

export const REGLAGES_SUIVI_EMPLOYEUR_PAR_DEFAUT: Readonly<ReglagesSuiviEmployeur> = {
  referenceMedicale: 'ccn_1043',
  rappelDuerpMois: 12,
  alsaceMoselle: false,
}

/** Taxe sur les salaires suivie (décision du cabinet, 🔴 2). */
export interface TaxeSalairesSuivie {
  /** Taxe acquittée l'année civile qui précède celle d'aujourd'hui : périodicité des versements de l'année en cours. */
  acquitteeAnneePrecedenteCentimes: number
  /** Taxe acquittée deux ans avant : périodicité du versement de janvier, qui porte sur l'année écoulée ; null : inconnue. */
  acquitteeDeuxAnsAvantCentimes?: number | null
}

export interface EtatEmployeur {
  /** D1 : le syndicat employeur (CCN IDCC 1043, art. 1er), propriétaire des comptes ; pas le mandat. */
  coproprieteId: string
  /** Salariés du syndicat, sortis compris. */
  salaries: readonly SalarieSyndicat[]
  /** Effectif du syndicat, fourni (🔴 4). */
  effectif: number
  /** Paie faite au cours du mois travaillé (CCN art. 22, 3 : au plus tard le dernier jour du mois). */
  paieDuMoisMeme: boolean
  /** Option pour le versement trimestriel des cotisations (moins de onze salariés, CSS R243-6-1). */
  versementTrimestrielCotisations: boolean
  derniereDsn: PeriodePaie | null
  /** Radiation du compte employeur demandée, ou dispense obtenue ; null : aucune. */
  radiationLe: string | null
  adhesionSanteTravailLe: string | null
  suivisMedicaux: readonly SuiviMedical[]
  arrets: readonly ArretTravail[]
  duerp: { misAJourLe: string | null; transmisLe: string | null }
  /**
   * Bulletins établis du syndicat, constatés ou non (le salaire est dû dès le bulletin) ; tout bulletin que désigne un
   * règlement du net doit y figurer (ce règlement n'a été écrit qu'après sa constatation : controlerReglementPaie).
   */
  bulletins: readonly BulletinPaie[]
  /** Règlements de paie écrits (traitementReglementPaie), annulés compris. */
  reglements: readonly ReglementPaieEcrit[]
  /**
   * Grand livre du syndicat, au moins les traitements des règlements et leurs annulations : un règlement ne solde le
   * salaire que si son traitement y figure sans annulation (reglementsEnVigueur).
   */
  traitements: readonly Pick<Traitement, 'id' | 'annule'>[]
  /** Taxe sur les salaires suivie ; null : non suivie. */
  taxeSalaires: TaxeSalairesSuivie | null
}

export type NatureEcheanceEmployeur = 'legale' | 'gestion'

export interface EcheanceEmployeur {
  obligation: ObligationEmployeur
  /** Clé stable, unique pour l'employeur. */
  cle: string
  libelle: string
  date: string
  salarieId: string | null
  /** « gestion » : rappel du cabinet, pas une échéance légale. */
  nature: NatureEcheanceEmployeur
  /** Repère juridique non confirmé (🔴) : jamais affiché comme un délai certain. */
  aConfirmer: boolean
  fondement: string
}

const SEUIL_DSN_LE_5 = 50
const SEUIL_ONZE_SALARIES = 11
const PERIODES_DSN_MAX = 24
/** CSS R243-6-1 : « dans les quinze premiers jours du trimestre civil suivant ». */
const JOUR_VERSEMENT_TRIMESTRIEL = 15
const MOIS_ADHESION_SANTE_TRAVAIL = 1
const MOIS_VISITE_INFORMATION = 3
const MOIS_VISITE_CCN = 24
const MOIS_VISITE_CODE_MAX = 60
const JOURS_VISITE_REPRISE = 8
const SEUIL_ACCIDENT_TRAVAIL_JOURS = 30
const SEUIL_NON_PROFESSIONNEL_JOURS: Record<ReferenceMedicale, number> = { ccn_1043: 30, code_du_travail: 60 }
/** Entrée en vigueur de la version lue de R4624-31 (décret n° 2026-503). */
const VIGUEUR_R4624_31 = composerDateIso(2026, 6, 15)
const MOIS_MISE_A_JOUR_DUERP = 12
const FONDEMENT_CCN_MEDECINE = 'CCN IDCC 1043, art. 13'
const FONDEMENT_DSN = 'CSS art. L133-5-3, R133-14, I et R243-6, II'
const FONDEMENT_DSN_TRIMESTRIEL = 'CSS art. L133-5-3, R133-14, I, R243-6, II et R243-6-1'

// ─── Outils de période ──────────────────────────────────────────────────────────────────────

const indexPeriode = ({ annee, mois }: PeriodePaie): number => annee * 12 + mois - 1
const periodeDeIndex = (index: number): PeriodePaie => ({ annee: Math.floor(index / 12), mois: (index % 12) + 1 })
const periodeDeDate = (dateIso: string): PeriodePaie => {
  const { a, m } = decomposerDateIso(dateIso)
  return { annee: a, mois: m }
}
const clePeriode = ({ annee, mois }: PeriodePaie): string => `${annee}-${String(mois).padStart(2, '0')}`
const periodeLue = ({ annee, mois }: PeriodePaie): string => libellePeriode(annee, mois)
const premiereDate = (dates: readonly string[]): string => [...dates].sort((a, b) => a.localeCompare(b))[0]
const nonSortis = (salaries: readonly SalarieSyndicat[], aujourdhui: string): SalarieSyndicat[] =>
  salaries.filter((s) => s.sortieLe === null || aujourdhui < s.sortieLe)

// ─── DSN et versement des cotisations ───────────────────────────────────────────────────────

/** CSS R243-6, II : le 5 pour un effectif d'au moins 50 salariés payés dans le mois, le 15 dans les autres cas. */
export const jourEcheanceDsn = (effectif: number, paieDuMoisMeme: boolean): 5 | 15 =>
  effectif >= SEUIL_DSN_LE_5 && paieDuMoisMeme ? 5 : 15

/** Échéance de la DSN d'une période : le 5 ou le 15 du mois suivant, prorogée au jour ouvrable suivant (R133-14, I). */
export function dateEcheanceDsn(
  periode: PeriodePaie,
  { effectif, paieDuMoisMeme }: Pick<EtatEmployeur, 'effectif' | 'paieDuMoisMeme'>,
  options: OptionsJoursFeries = {},
): string {
  const suivant = periodeDeIndex(indexPeriode(periode) + 1)
  return reporterAuJourOuvrable(composerDateIso(suivant.annee, suivant.mois, jourEcheanceDsn(effectif, paieDuMoisMeme)), options)
}

export interface VersementCotisations {
  date: string
  /** Complément du libellé de la DSN quand les deux échéances coïncident. */
  complement: string
  /** Libellé du versement seul. */
  libelle: string
  fondement: string
  fondementAvecDsn: string
}

/**
 * Versement des cotisations d'une période, sans report (R243-6, II ; R243-6-1 ; 🔴 8) : le 5 ou le 15 du mois suivant ;
 * en versement trimestriel, le 15 du mois qui suit le trimestre, porté par son dernier mois ; null : aucun versement.
 */
export function versementCotisations(
  periode: PeriodePaie,
  etat: Pick<EtatEmployeur, 'effectif' | 'paieDuMoisMeme' | 'versementTrimestrielCotisations'>,
): VersementCotisations | null {
  const suivant = periodeDeIndex(indexPeriode(periode) + 1)
  if (!etat.versementTrimestrielCotisations)
    return {
      date: composerDateIso(suivant.annee, suivant.mois, jourEcheanceDsn(etat.effectif, etat.paieDuMoisMeme)),
      complement: ' et versement des cotisations',
      libelle: `Versement des cotisations de ${periodeLue(periode)}`,
      fondement: 'CSS art. R243-6, II',
      fondementAvecDsn: FONDEMENT_DSN,
    }
  if (periode.mois % 3 !== 0) return null
  return {
    date: composerDateIso(suivant.annee, suivant.mois, JOUR_VERSEMENT_TRIMESTRIEL),
    complement: ' et versement des cotisations du trimestre',
    libelle: `Versement des cotisations du trimestre achevé en ${periodeLue(periode)}`,
    fondement: 'CSS art. R243-6-1',
    fondementAvecDsn: FONDEMENT_DSN_TRIMESTRIEL,
  }
}

const BASE_DSN = { obligation: 'dsn', salarieId: null, nature: 'legale', aConfirmer: false } as const

/** DSN d'une période et, s'il y en a un, versement des cotisations : une seule échéance si les deux dates coïncident. */
function echeancesPeriodeDsn(periode: PeriodePaie, etat: EtatEmployeur, options: OptionsJoursFeries): EcheanceEmployeur[] {
  const cle = clePeriode(periode)
  const date = dateEcheanceDsn(periode, etat, options)
  const versement = versementCotisations(periode, etat)
  if (versement?.date === date)
    return [{ ...BASE_DSN, cle: `dsn:${cle}`, libelle: `DSN de ${periodeLue(periode)}${versement.complement}`, date, fondement: versement.fondementAvecDsn }]
  const dsn: EcheanceEmployeur = { ...BASE_DSN, cle: `dsn:${cle}`, libelle: `DSN de ${periodeLue(periode)}`, date, fondement: FONDEMENT_DSN }
  if (versement === null) return [dsn]
  return [
    dsn,
    {
      ...BASE_DSN,
      obligation: 'versement_cotisations',
      cle: `cotisations:${cle}`,
      libelle: versement.libelle,
      date: versement.date,
      fondement: versement.fondement,
    },
  ]
}

function libelleDsnOmises(premiere: PeriodePaie, derniere: PeriodePaie, nombre: number, derniereConnue: boolean): string {
  const pluriel = nombre > 1
  const plage = pluriel ? `DSN de ${periodeLue(premiere)} à ${periodeLue(derniere)}` : `DSN de ${periodeLue(premiere)}`
  const decompte = pluriel ? `${nombre} périodes non détaillées` : '1 période non détaillée'
  if (!derniereConnue) return `${plage} à vérifier (${decompte}, dernière DSN inconnue)`
  const accord = pluriel ? 's' : ''
  return `${plage} non déclarée${accord} (${decompte})`
}

/** Périodes antérieures aux 24 détaillées : une échéance récapitulative, datée de la plus ancienne (jamais écartées en silence). */
function recapitulatifDsn(debut: number, premiereDetaillee: number, etat: EtatEmployeur, options: OptionsJoursFeries): EcheanceEmployeur[] {
  const nombre = premiereDetaillee - debut
  if (nombre <= 0) return []
  const premiere = periodeDeIndex(debut)
  const derniereConnue = etat.derniereDsn !== null
  return [
    {
      ...BASE_DSN,
      cle: 'dsn:anterieures',
      libelle: libelleDsnOmises(premiere, periodeDeIndex(premiereDetaillee - 1), nombre, derniereConnue),
      date: dateEcheanceDsn(premiere, etat, options),
      aConfirmer: !derniereConnue,
      fondement: FONDEMENT_DSN,
    },
  ]
}

function echeancesDsn(etat: EtatEmployeur, aujourdhui: string, reglages: ReglagesSuiviEmployeur): EcheanceEmployeur[] {
  const entrees = etat.salaries.map((s) => s.entreeLe).filter((date) => date <= aujourdhui)
  if (entrees.length === 0) return []
  const debut = etat.derniereDsn ? indexPeriode(etat.derniereDsn) + 1 : indexPeriode(periodeDeDate(premiereDate(entrees)))
  const courante = indexPeriode(periodeDeDate(aujourdhui))
  const fin = etat.radiationLe === null ? courante : Math.min(courante, indexPeriode(periodeDeDate(etat.radiationLe)))
  const premiereDetaillee = Math.max(debut, fin - PERIODES_DSN_MAX + 1)
  const options = { alsaceMoselle: reglages.alsaceMoselle }
  const echeances = recapitulatifDsn(debut, premiereDetaillee, etat, options)
  for (let index = premiereDetaillee; index <= fin; index++) echeances.push(...echeancesPeriodeDsn(periodeDeIndex(index), etat, options))
  return echeances
}

// ─── Santé au travail ───────────────────────────────────────────────────────────────────────

function echeancesAdhesion(etat: EtatEmployeur, aujourdhui: string): EcheanceEmployeur[] {
  if (etat.adhesionSanteTravailLe !== null || nonSortis(etat.salaries, aujourdhui).length === 0) return []
  return [
    {
      obligation: 'adhesion_sante_travail',
      cle: 'adhesion_sante_travail',
      libelle: 'Adhésion à un service de santé au travail interentreprises',
      date: ajouterMois(premiereDate(etat.salaries.map((s) => s.entreeLe)), MOIS_ADHESION_SANTE_TRAVAIL),
      salarieId: null,
      nature: 'legale',
      aConfirmer: false,
      fondement: 'C. trav. art. R7214-5 et R7214-6',
    },
  ]
}

/** Prochaine visite périodique selon la CCN (2 ans) et, au plus tard, selon le Code du travail (5 ans). */
export function datesVisitePeriodique(derniereVisiteLe: string): { ccn1043: string; codeDuTravailAuPlusTard: string } {
  return { ccn1043: ajouterMois(derniereVisiteLe, MOIS_VISITE_CCN), codeDuTravailAuPlusTard: ajouterMois(derniereVisiteLe, MOIS_VISITE_CODE_MAX) }
}

/** Prochaine visite fixée, retenue seulement si aucune visite n'a eu lieu depuis (une visite passée le jour prévu la solde). */
function prochaineVisiteRetenue(suivi: SuiviMedical | undefined): string | null {
  if (!suivi?.prochaineLe) return null
  if (suivi.derniereVisiteLe !== null && suivi.prochaineLe <= suivi.derniereVisiteLe) return null
  return suivi.prochaineLe
}

function echeanceMedicale(salarie: SalarieSyndicat, suivi: SuiviMedical | undefined, reglages: ReglagesSuiviEmployeur): EcheanceEmployeur {
  const base = { obligation: 'medecine_travail', cle: `medecine_travail:${salarie.id}`, salarieId: salarie.id, nature: 'legale' } as const
  const prochaine = prochaineVisiteRetenue(suivi)
  if (prochaine)
    return { ...base, libelle: 'Visite médicale fixée par le service de santé au travail', date: prochaine, aConfirmer: false, fondement: 'C. trav. art. R4624-16' }
  if (!suivi?.derniereVisiteLe)
    return {
      ...base,
      libelle: "Visite d'information et de prévention (embauche)",
      date: ajouterMois(salarie.entreeLe, MOIS_VISITE_INFORMATION),
      aConfirmer: false,
      fondement: 'C. trav. art. R4624-10',
    }
  const { ccn1043, codeDuTravailAuPlusTard } = datesVisitePeriodique(suivi.derniereVisiteLe)
  if (reglages.referenceMedicale === 'ccn_1043')
    return { ...base, libelle: 'Examen médical périodique (CCN : tous les 2 ans)', date: ccn1043, aConfirmer: true, fondement: FONDEMENT_CCN_MEDECINE }
  return {
    ...base,
    libelle: 'Renouvellement de la visite (au plus tard ; délai fixé par le médecin du travail)',
    date: codeDuTravailAuPlusTard,
    aConfirmer: true,
    fondement: 'C. trav. art. R4624-16',
  }
}

function echeancesMedecine(etat: EtatEmployeur, aujourdhui: string, reglages: ReglagesSuiviEmployeur): EcheanceEmployeur[] {
  const suivis = new Map(etat.suivisMedicaux.map((suivi) => [suivi.salarieId, suivi]))
  return nonSortis(etat.salaries, aujourdhui).map((s) => echeanceMedicale(s, suivis.get(s.id), reglages))
}

/** Examen de reprise exigé (R4624-31 ou CCN art. 13) ; date de reprise inconnue : rien à dater. */
export function visiteRepriseRequise(arret: Pick<ArretTravail, 'motif' | 'du' | 'repriseLe'>, reference: ReferenceMedicale): boolean {
  if (arret.repriseLe === null) return false
  const duree = ecartJours(arret.du, arret.repriseLe)
  if (arret.motif === 'accident_travail') return duree >= SEUIL_ACCIDENT_TRAVAIL_JOURS
  if (arret.motif === 'non_professionnel') return duree >= SEUIL_NON_PROFESSIONNEL_JOURS[reference]
  return true
}

type ArretARepris = ArretTravail & { repriseLe: string }

/** À confirmer : arrêt antérieur à la version lue de R4624-31 (🔴 6), ou reprise exigée par la seule CCN (🔴 1). */
const repriseAConfirmer = (arret: ArretARepris): boolean =>
  arret.du < VIGUEUR_R4624_31 ||
  (arret.motif === 'non_professionnel' && ecartJours(arret.du, arret.repriseLe) < SEUIL_NON_PROFESSIONNEL_JOURS.code_du_travail)

/** Visites de reprise des salariés encore en poste : un salarié sorti ne reprend plus (comme les autres visites). */
function echeancesReprise(etat: EtatEmployeur, aujourdhui: string, reglages: ReglagesSuiviEmployeur): EcheanceEmployeur[] {
  const presents: ReadonlySet<string> = new Set(nonSortis(etat.salaries, aujourdhui).map((s) => s.id))
  const fondement = reglages.referenceMedicale === 'ccn_1043' ? FONDEMENT_CCN_MEDECINE : 'C. trav. art. R4624-31'
  return etat.arrets
    .filter(
      (a): a is ArretARepris => presents.has(a.salarieId) && a.visiteRepriseLe === null && visiteRepriseRequise(a, reglages.referenceMedicale),
    )
    .map((a) => ({
      obligation: 'visite_reprise',
      cle: `visite_reprise:${a.id}`,
      libelle: `Examen de reprise du travail (${LIBELLES_MOTIF_ARRET[a.motif]})`,
      date: ajouterJours(a.repriseLe, JOURS_VISITE_REPRISE),
      salarieId: a.salarieId,
      nature: 'legale',
      aConfirmer: repriseAConfirmer(a),
      fondement,
    }))
}

// ─── DUERP ──────────────────────────────────────────────────────────────────────────────────

function revueDuerp(misAJourLe: string, effectif: number, reglages: ReglagesSuiviEmployeur): EcheanceEmployeur[] {
  const base = { obligation: 'duerp', salarieId: null } as const
  if (effectif >= SEUIL_ONZE_SALARIES)
    return [
      {
        ...base,
        cle: 'duerp:mise_a_jour',
        libelle: 'Mise à jour annuelle du DUERP',
        date: ajouterMois(misAJourLe, MOIS_MISE_A_JOUR_DUERP),
        nature: 'legale',
        aConfirmer: false,
        fondement: 'C. trav. art. R4121-2, 1°',
      },
    ]
  if (reglages.rappelDuerpMois === null) return []
  return [
    {
      ...base,
      cle: 'duerp:revue',
      libelle: 'Revue du DUERP (rappel de gestion : pas d’échéance annuelle sous onze salariés)',
      date: ajouterMois(misAJourLe, reglages.rappelDuerpMois),
      nature: 'gestion',
      aConfirmer: true,
      fondement: 'C. trav. art. R4121-2, 2° et 3°',
    },
  ]
}

function transmissionDuerp(misAJourLe: string, transmisLe: string | null): EcheanceEmployeur[] {
  if (transmisLe !== null && transmisLe >= misAJourLe) return []
  return [
    {
      obligation: 'duerp',
      cle: 'duerp:transmission',
      libelle: 'Transmission du DUERP mis à jour au service de prévention et de santé au travail',
      date: misAJourLe,
      salarieId: null,
      nature: 'legale',
      aConfirmer: true,
      fondement: 'C. trav. art. L4121-3-1, VI',
    },
  ]
}

function echeancesDuerp(etat: EtatEmployeur, aujourdhui: string, reglages: ReglagesSuiviEmployeur): EcheanceEmployeur[] {
  const presents = nonSortis(etat.salaries, aujourdhui)
  if (presents.length === 0) return []
  const { misAJourLe, transmisLe } = etat.duerp
  if (misAJourLe === null)
    return [
      {
        obligation: 'duerp',
        cle: 'duerp:etablir',
        libelle: 'DUERP à établir',
        date: premiereDate(presents.map((s) => s.entreeLe)),
        salarieId: null,
        nature: 'legale',
        aConfirmer: true,
        fondement: 'C. trav. art. R4121-1 et L4121-3-1, II',
      },
    ]
  return [...revueDuerp(misAJourLe, etat.effectif, reglages), ...transmissionDuerp(misAJourLe, transmisLe)]
}

// ─── Salaire ────────────────────────────────────────────────────────────────────────────────

/** Net réglé par bulletin, par les seuls règlements en vigueur (un règlement annulé ne solde plus le salaire). */
const netRegleEnVigueur = (etat: EtatEmployeur): Map<string, number> => netRegleParBulletin(reglementsEnVigueur(etat.reglements, etat.traitements))

function echeancesSalaire(etat: EtatEmployeur): EcheanceEmployeur[] {
  const regle = netRegleEnVigueur(etat)
  return etat.bulletins
    .filter((b) => b.netAPayerCentimes > (regle.get(b.id) ?? 0))
    .map((b) => ({
      obligation: 'salaire',
      cle: `salaire:${b.id}`,
      libelle: `Paiement du salaire de ${libellePeriode(b.annee, b.mois)}`,
      date: composerDateIso(b.annee, b.mois, joursDansMois(b.annee, b.mois)),
      salarieId: b.salarieId,
      nature: 'legale',
      aConfirmer: false,
      fondement: 'CCN IDCC 1043, art. 22, 3',
    }))
}

// ─── Taxe sur les salaires ──────────────────────────────────────────────────────────────────

export const FRANCHISE_TAXE_SALAIRES_CENTIMES = 120_000
export const PLAFOND_DECOTE_TAXE_SALAIRES_CENTIMES = 204_000
const SEUIL_TRIMESTRIEL_TAXE_CENTIMES = 400_000
const SEUIL_MENSUEL_TAXE_CENTIMES = 1_000_000
const JOUR_VERSEMENT_TAXE = 15

export type PeriodiciteTaxeSalaires = 'annuelle' | 'trimestrielle' | 'mensuelle'
const MOIS_PERIODE_TAXE: Record<PeriodiciteTaxeSalaires, number> = { annuelle: 12, trimestrielle: 3, mensuelle: 1 }
const FONDEMENT_VERSEMENT_TAXE: Record<PeriodiciteTaxeSalaires, string> = {
  annuelle: 'CGI, annexe III, art. 369, 1, a et 3',
  trimestrielle: 'CGI, annexe III, art. 369, 1, b',
  mensuelle: 'CGI, annexe III, art. 369, 1, c',
}

function verifierCentimes(montantCentimes: number, objet: string): void {
  if (!Number.isInteger(montantCentimes) || montantCentimes < 0)
    throw new Error(`${objet} de ${montantCentimes} : centimes entiers positifs ou nuls attendus.`)
}

/** CGI ann. III art. 369, 1 : selon la taxe acquittée l'année précédente. */
export function periodiciteTaxeSalaires(acquitteeAnneePrecedenteCentimes: number): PeriodiciteTaxeSalaires {
  verifierCentimes(acquitteeAnneePrecedenteCentimes, "Taxe sur les salaires de l'année précédente")
  if (acquitteeAnneePrecedenteCentimes < SEUIL_TRIMESTRIEL_TAXE_CENTIMES) return 'annuelle'
  return acquitteeAnneePrecedenteCentimes <= SEUIL_MENSUEL_TAXE_CENTIMES ? 'trimestrielle' : 'mensuelle'
}

/** CGI art. 1679 et ann. III art. 369, 5 : franchise, décote (arrondie au centime, 🔵) et dispense de déclaration. */
export function taxeSalairesExigible(montantAnnuelCentimes: number): {
  exigibleCentimes: number
  decoteCentimes: number
  declarationAnnuelleRequise: boolean
} {
  verifierCentimes(montantAnnuelCentimes, 'Taxe sur les salaires annuelle')
  if (montantAnnuelCentimes <= FRANCHISE_TAXE_SALAIRES_CENTIMES) return { exigibleCentimes: 0, decoteCentimes: 0, declarationAnnuelleRequise: false }
  const decoteCentimes =
    montantAnnuelCentimes < PLAFOND_DECOTE_TAXE_SALAIRES_CENTIMES ? Math.round((3 * (PLAFOND_DECOTE_TAXE_SALAIRES_CENTIMES - montantAnnuelCentimes)) / 4) : 0
  return { exigibleCentimes: montantAnnuelCentimes - decoteCentimes, decoteCentimes, declarationAnnuelleRequise: true }
}

/** Prochaine échéance (au plus tôt aujourd'hui) du versement d'une période, et premier jour de la période versée. */
function prochaineEcheanceTaxe(periodicite: PeriodiciteTaxeSalaires, aujourdhui: string): { date: string; debutPeriode: string } {
  const longueur = MOIS_PERIODE_TAXE[periodicite]
  const { a, m } = decomposerDateIso(aujourdhui)
  const debutCourante = composerDateIso(a, Math.floor((m - 1) / longueur) * longueur + 1, 1)
  const echeanceCourante = ajouterJours(debutCourante, JOUR_VERSEMENT_TAXE - 1)
  if (aujourdhui <= echeanceCourante) return { date: echeanceCourante, debutPeriode: ajouterMois(debutCourante, -longueur) }
  return { date: ajouterMois(echeanceCourante, longueur), debutPeriode: debutCourante }
}

function libellePeriodeTaxe(periodicite: PeriodiciteTaxeSalaires, debutPeriode: string): string {
  const { a, m } = decomposerDateIso(debutPeriode)
  if (periodicite === 'annuelle') return `de ${a}`
  if (periodicite === 'trimestrielle') return `du trimestre commencé en ${libellePeriode(a, m)}`
  return `de ${libellePeriode(a, m)}`
}

/**
 * Taxe qui fixe la périodicité du prochain versement (art. 369, 1) : celle de l'année précédente, sauf du 1er au 15
 * janvier, où le versement porte sur l'année écoulée et suit la taxe acquittée deux ans plus tôt ; null : non fournie.
 */
function taxeDeReference(taxe: TaxeSalairesSuivie, aujourdhui: string): { montantCentimes: number | null; annee: number } {
  const { a } = decomposerDateIso(aujourdhui)
  if (aujourdhui > composerDateIso(a, 1, JOUR_VERSEMENT_TAXE)) return { montantCentimes: taxe.acquitteeAnneePrecedenteCentimes, annee: a - 1 }
  return { montantCentimes: taxe.acquitteeDeuxAnsAvantCentimes ?? null, annee: a - 2 }
}

function echeancesTaxeSalaires(etat: EtatEmployeur, aujourdhui: string): EcheanceEmployeur[] {
  if (etat.taxeSalaires === null) return []
  const reference = taxeDeReference(etat.taxeSalaires, aujourdhui)
  const base = { obligation: 'taxe_salaires', salarieId: null, nature: 'legale', aConfirmer: true } as const
  const annuelle = prochaineEcheanceTaxe('annuelle', aujourdhui)
  const anneeDeclaree = decomposerDateIso(annuelle.debutPeriode).a
  const declaration: EcheanceEmployeur = {
    ...base,
    cle: `taxe_salaires:declaration:${anneeDeclaree}`,
    libelle: `Taxe sur les salaires de ${anneeDeclaree} : déclaration annuelle`,
    date: annuelle.date,
    fondement: 'CGI, annexe III, art. 369, 3',
  }
  if (reference.montantCentimes === null)
    return [
      declaration,
      {
        ...base,
        cle: `taxe_salaires:versement:${anneeDeclaree}`,
        libelle: `Taxe sur les salaires de ${anneeDeclaree} : versement du solde (périodicité selon la taxe acquittée en ${reference.annee}, non fournie)`,
        date: annuelle.date,
        fondement: 'CGI, annexe III, art. 369, 1',
      },
    ]
  const periodicite = periodiciteTaxeSalaires(reference.montantCentimes)
  if (periodicite === 'annuelle')
    return [
      {
        ...declaration,
        libelle: `Taxe sur les salaires de ${anneeDeclaree} : versement et déclaration annuelle`,
        fondement: FONDEMENT_VERSEMENT_TAXE.annuelle,
      },
    ]
  const versement = prochaineEcheanceTaxe(periodicite, aujourdhui)
  return [
    declaration,
    {
      ...base,
      cle: `taxe_salaires:versement:${clePeriode(periodeDeDate(versement.debutPeriode))}`,
      libelle: `Taxe sur les salaires ${libellePeriodeTaxe(periodicite, versement.debutPeriode)} : versement`,
      date: versement.date,
      fondement: FONDEMENT_VERSEMENT_TAXE[periodicite],
    },
  ]
}

// ─── Assemblage ─────────────────────────────────────────────────────────────────────────────

function verifierRattachements(etat: EtatEmployeur): void {
  const autre = etat.salaries.find((s) => s.coproprieteId !== etat.coproprieteId)
  if (autre) throw new Error(`Salarié ${autre.id} du syndicat ${autre.coproprieteId}, employeur : syndicat ${etat.coproprieteId} (D1).`)
  const ids = new Set(etat.salaries.map((s) => s.id))
  const inconnu = [...etat.suivisMedicaux, ...etat.arrets, ...etat.bulletins].find((x) => !ids.has(x.salarieId))
  if (inconnu) throw new Error(`Salarié ${inconnu.salarieId} inconnu de l'employeur (syndicat ${etat.coproprieteId}).`)
}

function verifierDates(etat: EtatEmployeur): void {
  const dates = [
    etat.radiationLe,
    etat.adhesionSanteTravailLe,
    etat.duerp.misAJourLe,
    etat.duerp.transmisLe,
    ...etat.suivisMedicaux.flatMap((s) => [s.derniereVisiteLe, s.prochaineLe]),
    ...etat.arrets.flatMap((a) => [a.du, a.repriseLe, a.visiteRepriseLe]),
    ...etat.reglements.map((r) => r.le),
  ]
  const invalide = dates.find((date) => date !== null && !estDateIsoValide(date))
  if (invalide !== undefined) throw new Error(`Date invalide (${invalide}) : AAAA-MM-JJ attendu.`)
  const arret = etat.arrets.find((a) => a.repriseLe !== null && a.repriseLe < a.du)
  if (arret) throw new Error(`Arrêt ${arret.id} : reprise avant le premier jour d'absence.`)
}

/** Chaque bulletin : période, montants, cohérence et période d'emploi (controlerBulletinSalarie). */
function verifierBulletins(etat: EtatEmployeur): void {
  const salaries = new Map(etat.salaries.map((s) => [s.id, s]))
  for (const b of etat.bulletins) {
    const salarie = salaries.get(b.salarieId)
    if (salarie === undefined) throw new Error(`Bulletin ${b.id} : salarié ${b.salarieId} inconnu.`)
    const anomalies = controlerBulletinSalarie(b, salarie)
    if (anomalies.length > 0) throw new Error(anomalies.map((a) => a.message).join(' '))
  }
}

/**
 * Règlement du syndicat employeur (D1), d'un montant strictement positif, d'un salarié connu et, pour le net, d'un
 * bulletin connu de ce salarié (un bulletin introuvable laisserait le vrai salaire « à payer », 421 soldé).
 */
function verifierReglement(r: ReglementPaie, etat: EtatEmployeur, salaries: ReadonlySet<string>, bulletins: ReadonlyMap<string, BulletinPaie>): void {
  if (r.coproprieteId !== etat.coproprieteId)
    throw new Error(`Règlement ${r.id} du syndicat ${r.coproprieteId}, employeur : syndicat ${etat.coproprieteId} (D1).`)
  if (!Number.isInteger(r.montantCentimes) || r.montantCentimes <= 0)
    throw new Error(`Règlement ${r.id} de ${r.montantCentimes} : centimes entiers strictement positifs attendus.`)
  if (r.salarieId !== null && !salaries.has(r.salarieId)) throw new Error(`Règlement ${r.id} : salarié ${r.salarieId} inconnu de l'employeur.`)
  if (r.nature !== 'salaire_net') return
  if (r.bulletinId === null) throw new Error(`Règlement ${r.id} du salaire net sans bulletin réglé.`)
  const bulletin = bulletins.get(r.bulletinId)
  if (bulletin === undefined) throw new Error(`Règlement ${r.id} : bulletin ${r.bulletinId} introuvable parmi les bulletins de l'employeur.`)
  if (bulletin.salarieId !== r.salarieId)
    throw new Error(`Règlement ${r.id} du salarié ${r.salarieId} imputé au bulletin ${bulletin.id} du salarié ${bulletin.salarieId}.`)
}

/**
 * Chaque règlement (verifierReglement), puis les règlements en vigueur : aucun bulletin réglé au-delà de son net (le
 * surplus, imputé au mauvais bulletin, laisserait un autre salaire « à payer » alors que le 421 est soldé).
 */
function verifierReglements(etat: EtatEmployeur): void {
  const salaries: ReadonlySet<string> = new Set(etat.salaries.map((s) => s.id))
  const bulletins: ReadonlyMap<string, BulletinPaie> = new Map(etat.bulletins.map((b) => [b.id, b]))
  for (const r of etat.reglements) verifierReglement(r, etat, salaries, bulletins)
  for (const [bulletinId, regle] of netRegleEnVigueur(etat)) {
    const net = bulletins.get(bulletinId)?.netAPayerCentimes ?? 0
    if (regle > net) throw new Error(`Bulletin ${bulletinId} : ${regle} centimes réglés pour un net à payer de ${net} centimes.`)
  }
}

function verifierTaxe(taxe: TaxeSalairesSuivie | null): void {
  if (taxe === null) return
  verifierCentimes(taxe.acquitteeAnneePrecedenteCentimes, "Taxe sur les salaires de l'année précédente")
  const deuxAnsAvant = taxe.acquitteeDeuxAnsAvantCentimes ?? null
  if (deuxAnsAvant !== null) verifierCentimes(deuxAnsAvant, 'Taxe sur les salaires de deux ans avant')
}

function verifierEtat(etat: EtatEmployeur): void {
  if (!etat.coproprieteId) throw new Error('Employeur : syndicat attendu (D1).')
  if (!Number.isInteger(etat.effectif) || etat.effectif < 0) throw new Error(`Effectif invalide (${etat.effectif}) : entier positif ou nul attendu.`)
  if (etat.versementTrimestrielCotisations && etat.effectif >= SEUIL_ONZE_SALARIES)
    throw new Error('Versement trimestriel des cotisations : réservé à un effectif de moins de 11 salariés (CSS art. R243-6-1).')
  if (etat.derniereDsn && !estPeriodeValide(etat.derniereDsn.annee, etat.derniereDsn.mois))
    throw new Error(`Dernière DSN invalide (${etat.derniereDsn.mois}/${etat.derniereDsn.annee}).`)
  verifierRattachements(etat)
  verifierDates(etat)
  verifierBulletins(etat)
  verifierReglements(etat)
  verifierTaxe(etat.taxeSalaires)
}

function verifierReglages(reglages: ReglagesSuiviEmployeur): void {
  if (!REFERENCES_ADMISES.has(reglages.referenceMedicale)) throw new Error(`Référence médicale inconnue : « ${reglages.referenceMedicale} ».`)
  const { rappelDuerpMois } = reglages
  if (rappelDuerpMois !== null && (!Number.isInteger(rappelDuerpMois) || rappelDuerpMois <= 0))
    throw new Error(`Durée du rappel du DUERP (${rappelDuerpMois} mois) : entier strictement positif, ou aucun rappel, attendu.`)
}

/** Toutes les échéances de l'employeur, triées par date (puis par clé). */
export function echeancesEmployeur(
  etat: EtatEmployeur,
  aujourdhui: string,
  reglages: ReglagesSuiviEmployeur = REGLAGES_SUIVI_EMPLOYEUR_PAR_DEFAUT,
): EcheanceEmployeur[] {
  verifierAujourdhui(aujourdhui)
  verifierEtat(etat)
  verifierReglages(reglages)
  return [
    ...echeancesDsn(etat, aujourdhui, reglages),
    ...echeancesAdhesion(etat, aujourdhui),
    ...echeancesMedecine(etat, aujourdhui, reglages),
    ...echeancesReprise(etat, aujourdhui, reglages),
    ...echeancesDuerp(etat, aujourdhui, reglages),
    ...echeancesSalaire(etat),
    ...echeancesTaxeSalaires(etat, aujourdhui),
  ].sort((x, y) => x.date.localeCompare(y.date) || x.cle.localeCompare(y.cle))
}

/**
 * Adaptateur vers le suivi « à faire » : famille « mandat », nature « échéance légale » (pas encore de famille
 * « personnel » dans suivi-a-faire.ts) ; un rappel de gestion est toujours « à confirmer ». mandatId : la mission qui
 * consulte le suivi (D1 : les échéances restent celles du syndicat).
 */
export function versElementsAFaire(echeances: readonly EcheanceEmployeur[], mandatId: string): ElementAFaire[] {
  return echeances.map((e) => ({
    id: `mandat:${mandatId}:employeur:${e.cle}`,
    famille: 'mandat',
    nature: 'echeance_legale',
    libelle: e.libelle,
    date: e.date,
    mandatId,
    objetId: e.salarieId,
    assigneId: null,
    aConfirmer: e.aConfirmer || e.nature === 'gestion',
  }))
}
