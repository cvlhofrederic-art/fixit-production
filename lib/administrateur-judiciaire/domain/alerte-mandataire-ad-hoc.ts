import type { LotEnregistre } from '@/lib/administrateur-judiciaire/domain/coproprietes'
import { ajouterJours, ajouterMois, dateIsoVersFr, estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import type { DecisionAnnuelle } from '@/lib/administrateur-judiciaire/domain/decisions-annuelles-ag'
import type { Exercice } from '@/lib/administrateur-judiciaire/domain/exercices-budgets'
import type { Regime } from '@/lib/administrateur-judiciaire/domain/fondements'
import { formatEurosCentimes } from '@/lib/administrateur-judiciaire/domain/format'
import { ETATS_RESOLUTION, type EtatResolution } from '@/lib/administrateur-judiciaire/domain/resolutions-ag'

/**
 * Alerte de l'art. 29-1 A de la loi du 10 juillet 1965 : information du conseil syndical et saisine du juge pour la
 * désignation d'un mandataire ad hoc (décision J7 de Hugo du 30/10/2026). Fonction pure, montants en CENTIMES ENTIERS,
 * dates ISO (AAAA-MM-JJ), sans écran ni table : les sommes exigibles, les votes et la requête viennent de l'appelant.
 *
 * Le droit — 🟢 textes relus sur Légifrance le 30/10/2026 :
 * - L. 1965 art. 29-1 A (version en vigueur depuis le 11/04/2024, loi n° 2024-322, art. 18), al. 1 : « Lorsqu'à la
 *   clôture des comptes les impayés atteignent 25 % des sommes exigibles en vertu des articles 14-1 et 14-2-1 ou en
 *   l'absence de vote de l'assemblée générale sur l'approbation des comptes depuis au moins deux ans », le syndic en
 *   informe le conseil syndical et saisit sur requête le juge d'une demande de désignation d'un mandataire ad hoc ; « Pour
 *   les copropriétés de plus de deux cents lots, le pourcentage des impayés déclenchant la saisine est fixé à 15 %. » ;
 * - al. 2 : « En l'absence d'action du syndic dans un délai d'un mois à compter de la clôture des comptes », en l'absence
 *   de syndic, ou en l'absence de vote de l'assemblée sur l'approbation des comptes depuis au moins deux ans, le juge peut
 *   être saisi de la même demande par des copropriétaires représentant ensemble au moins 15 % des voix du syndicat ou le
 *   président du conseil syndical (1°), un créancier de factures d'abonnement et de fourniture d'eau ou d'énergie ou de
 *   travaux votés et exécutés, sous conditions (2°), le représentant de l'État ou le procureur de la République (3°), le
 *   maire (4°), le président de l'EPCI compétent en matière d'habitat (5°) ; dernier alinéa : dans les cas du premier
 *   alinéa et des 1° et 2°, le représentant de l'État, le maire et le président de l'EPCI sont informés de la saisine par
 *   le ou les demandeurs ;
 * - L. 1965 art. 14-1 (en vigueur depuis le 01/01/2023, loi n° 2021-1104, art. 171), I : budget prévisionnel et
 *   provisions, « La provision est exigible le premier jour de chaque trimestre ou le premier jour de la période fixée
 *   par l'assemblée générale » ; II : « Ne sont pas comprises dans le budget prévisionnel les dépenses du syndicat pour
 *   travaux, dont la liste est fixée par décret en Conseil d'Etat. Les sommes afférentes à ces dépenses sont exigibles
 *   selon les modalités votées par l'assemblée générale. » ; art. 14-2 : plan pluriannuel de travaux (I : « A
 *   l'expiration d'un délai de quinze ans à compter de la date de réception des travaux de construction de l'immeuble,
 *   un projet de plan pluriannuel de travaux est élaboré […] ») ;
 * - D. 1967 art. 61-2 : ne sont pas impayées, pour le premier alinéa de l'art. 29-1 A, « les sommes devenues exigibles
 *   dans le mois précédant la date de clôture de l'exercice » ; art. 61-3 : la demande est portée devant le président du
 *   tribunal judiciaire du lieu de situation de l'immeuble ; art. 61-4 : pour l'information du conseil syndical, le syndic
 *   adresse sans délai à chacun de ses membres l'état des impayés avant répartition à la date de la clôture de l'exercice
 *   comptable ; art. 61-5 : l'information du dernier alinéa se fait par l'envoi d'une copie de la requête ou de
 *   l'assignation ;
 * - L. 1965 art. 29-1, I, al. 2 : l'administrateur provisoire reçoit « tous les pouvoirs du syndic dont le mandat cesse de
 *   plein droit sans indemnité » et, selon l'ordonnance, tout ou partie de ceux de l'assemblée générale, hors ceux des a
 *   et b de l'art. 26, et du conseil syndical ; II, al. 2 : le président du tribunal judiciaire peut imputer tout ou partie des frais
 *   de l'administration provisoire au syndic qui n'a pas saisi sur requête le juge d'une demande de désignation d'un
 *   mandataire ad hoc dans les conditions de l'art. 29-1 A, après audition du syndic et du conseil syndical, sur le
 *   rapport de l'administrateur provisoire ; art. 29-1 B : le mandataire ad hoc remet son rapport dans un délai de trois
 *   mois renouvelable une fois, et la procédure peut conduire à la désignation d'un administrateur provisoire (art. 29-1) ;
 *   art. 29-1, III : le mandataire ad hoc peut être désigné administrateur provisoire si le syndicat a fait l'objet de la
 *   procédure des art. 29-1 A et 29-1 B.
 * Seuils et durées : paramètres (PARAMETRES_ALERTE_29_1_A), chacun avec son article.
 *
 * 🔵 Déduit :
 * - « atteignent » : égal ou supérieur au seuil, comparé en centimes entiers sans arrondi ; « plus de deux cents lots » :
 *   201 lots et au-delà ;
 * - la « clôture des comptes » est la clôture de l'exercice comptable (D. 1967 art. 61-2 et 61-4) ; à une date, le
 *   constat porte sur le dernier exercice clos avant elle : chaque clôture le renouvelle ;
 * - sommes exigibles en vertu de l'art. 14-1 : provisions du budget prévisionnel (I) et appels de travaux hors budget (II),
 *   exigibles selon les modalités votées par l'assemblée ; de l'art. 14-2-1 : cotisations au fonds de travaux ; l'art.
 *   14-2, devenu le plan pluriannuel de travaux, ne rend aucune somme exigible ; une autre somme ne compte pas, pas plus
 *   qu'une somme exigible après la clôture ;
 * - « dans le mois précédant la date de clôture » : exigibles après le même quantième du mois précédent, jour de la
 *   clôture compris (clôture au 31 décembre : du 1er au 31 décembre) ; ces sommes restent dans les sommes exigibles, seul
 *   leur impayé est écarté (le décret ne vise que les sommes « impayées ») ;
 * - un vote de rejet est un vote : le texte vise l'absence de vote sur l'approbation, non l'absence d'approbation ; une
 *   résolution à voter, en attente de second vote ou reportée n'est pas un vote ; la décision de l'administrateur
 *   provisoire n'est pas un vote de l'assemblée ; les deux ans sont atteints au même quantième deux ans après le dernier
 *   vote (borné en fin de mois : 29/02 → 28/02) ;
 * - saisine par les personnes de l'al. 2 : pour les impayés, au lendemain du mois laissé au syndic après la clôture, sauf
 *   si le syndic a saisi le juge dans ce mois (« En l'absence d'action du syndic dans un délai d'un mois ») — requête
 *   datée du jour de la clôture au dernier jour de ce délai, enregistrée au plus tard à la date de référence ; pour les
 *   comptes, dès les deux ans atteints, même si le syndic a agi (l'al. 2 ouvre aussi la saisine « en l'absence de
 *   vote ») ; sans syndic (administrateur provisoire d'un syndicat qui en est dépourvu, D. 1967 art. 47, ou de l'art.
 *   29-1, dont la désignation fait cesser le mandat du syndic), dès la clôture ;
 * - une requête au juge se lit critère par critère : enregistrée au plus tard à la date de référence, elle traite les
 *   impayés si elle date du jour de la clôture qui les constate ou d'après, les comptes si elle date du jour où les deux
 *   ans sont atteints ou d'après ; une requête plus ancienne ne couvre pas un déclenchement postérieur (impayés d'une
 *   clôture suivante, notamment) ; l'alerte n'est traitée que si chaque critère atteint l'est, et le suivi garde la date
 *   du plus tôt des critères non traités ;
 * - information du conseil syndical : l'état des impayés avant répartition à la date de la clôture (D. 1967 art. 61-4)
 *   l'accompagne quel que soit le critère atteint, le décret visant l'information « mentionnée au premier alinéa », qui
 *   couvre les deux critères ;
 * - copie de la requête au représentant de l'État, au maire et au président de l'EPCI (art. 29-1 A, dernier alinéa ; D.
 *   1967 art. 61-5) : due par le syndic qui saisit le juge, dès la requête (le texte ne fixe pas de délai) ; la requête
 *   traite l'alerte, la copie reste due tant qu'elle n'est pas enregistrée comme adressée au plus tard à la date de
 *   référence ;
 * - syndic désigné par le président du tribunal judiciaire (D. 1967 art. 46) : il est le syndic, l'obligation lui
 *   incombe.
 *
 * Décisions de Hugo du 17/11/2026 (J67 du registre des décisions juridiques ; textes relus sur Légifrance le 17/11/2026) :
 * - J67, R31 : période des sommes exigibles (le texte ne la fixe pas) : au dénominateur, les sommes devenues exigibles
 *   au cours de l'exercice clos (les provisions sont votées et appelées par exercice : art. 14-1, I ; art. 14-2-1, I) ;
 *   au numérateur, tous les impayés à la clôture, arriérés des exercices antérieurs compris, moins ceux du dernier mois
 *   (D. 1967 art. 61-2). C'est la lecture de l'état des impayés « à la date de la clôture de l'exercice comptable »
 *   (art. 61-4), la plus protectrice : le calcul est gardé, les arriérés ne rendent plus l'alerte « à confirmer », leur
 *   montant reste dans le message. Avec de gros arriérés, le rapport peut dépasser 100 %.
 * - J67, R32 : tous les lots de l'état descriptif de division, lots secondaires compris (caves, parkings) : tout lot
 *   comporte une partie privative et une quote-part de parties communes (L. 1965 art. 1, I) ; quand la loi ne compte que
 *   certains lots, elle le dit (art. 41-8 : « lots à usage de logements, de bureaux ou de commerces »). C'est aussi la
 *   lecture la plus prudente (plus de syndicats passent au seuil de 15 %). Le nombre saisi reste celui du seuil ; quand
 *   la liste des lots du syndicat est fournie, elle est comptée et l'écart est signalé (ecartLots).
 *
 * Décision J67, R30 de Hugo (17/11/2026 ; textes relus le 17/11/2026 : L. 1965 art. 29-1 A, 29-1 B et 29-1, I à III ;
 * D. 1967 art. 46, 47, 61-2, 61-4, 61-5, 62-2, 62-7 et 62-11). Aucun texte ne règle le cas des administrateurs
 * provisoires : lecture déduite des textes, aConfirmer gardé (pas de texte) ; le résultat porte le régime et le cadre.
 * - administrateur provisoire de l'art. 29-1 (cadre « compte_rendu_au_juge ») : il a reçu tous les pouvoirs du syndic
 *   (art. 29-1, I, al. 2), mais le juge qui l'a nommé est déjà saisi et suit la mission ; le mandataire ad hoc est
 *   l'étape AVANT l'administration provisoire (art. 29-1 B ; art. 29-1, III). Ni requête au juge ni copie de la requête :
 *   le constat est porté au prochain compte rendu au juge (D. 1967 art. 62-11) ; si le conseil syndical garde ses
 *   pouvoirs, l'état des impayés avant répartition lui est adressé (art. 61-4). Le constat des exercices d'avant la
 *   désignation peut fonder l'imputation des frais au syndic qui n'a pas saisi le juge (art. 29-1, II, al. 2) ; s'il a
 *   reçu de l'ordonnance le pouvoir d'approuver les comptes (art. 29-1, I : « tout ou partie des pouvoirs de l'assemblée
 *   générale des copropriétaires », hors a et b de l'art. 26), il les approuve sans vote de l'assemblée : sa décision
 *   n'est pas un vote, le critère des deux ans reste calculé sur les votes de l'assemblée, et son message dit « comptes
 *   approuvés par l'administrateur provisoire le … » (decisions, origine « administrateur ») ;
 * - administrateur provisoire de l'art. 47, syndicat dépourvu de syndic (cadre « signalement_au_juge ») : il n'est pas le
 *   syndic ; « en l'absence de syndic », l'al. 2 ouvre la saisine aux personnes qu'il énumère, dès la clôture. Seuil
 *   atteint : à signaler au juge ; requête possible pour un administrateur provisoire de l'art. 29-1, après consultation
 *   du conseil syndical (D. 1967 art. 62-2) ; pas de copie de requête. Si l'ordonnance lui confère expressément les
 *   pouvoirs du syndic (entrée ordonnanceConferePouvoirsDuSyndic), l'obligation du syndic s'applique (cadre
 *   « obligation_du_syndic ») ;
 * - syndic désigné (D. 1967 art. 46) : inchangé.
 *
 * 🔴 Non établi (à trancher par Frédéric ou Hugo) :
 * - aucun vote connu sur l'approbation des comptes : depuis quand compter les deux ans ? Le critère reste non établi tant
 *   que la date de la dernière assemblée qui s'est prononcée n'est pas saisie.
 */

export interface ParametresAlerte291A {
  /** L. 1965 art. 29-1 A, al. 1 : impayés à 25 % des sommes exigibles. */
  seuilPourcent: number
  /** Art. 29-1 A, al. 1 : 15 % pour les copropriétés de plus de deux cents lots. */
  seuilGrandeCoproprietePourcent: number
  /** Art. 29-1 A, al. 1 : « plus de deux cents lots ». */
  lotsGrandeCopropriete: number
  /** Art. 29-1 A, al. 1 et 2 : absence de vote sur l'approbation des comptes « depuis au moins deux ans ». */
  sansVoteMois: number
  /** Art. 29-1 A, al. 2 : action du syndic « dans un délai d'un mois à compter de la clôture des comptes ». */
  delaiSyndicMois: number
  /** D. 1967 art. 61-2 : sommes devenues exigibles « dans le mois précédant la date de clôture », non impayées. */
  moisNonImpayesAvantCloture: number
}

export const PARAMETRES_ALERTE_29_1_A: Readonly<ParametresAlerte291A> = {
  seuilPourcent: 25,
  seuilGrandeCoproprietePourcent: 15,
  lotsGrandeCopropriete: 200,
  sansVoteMois: 24,
  delaiSyndicMois: 1,
  moisNonImpayesAvantCloture: 1,
}

/**
 * Provision du budget prévisionnel (L. 1965 art. 14-1, I), appel de travaux hors budget (art. 14-1, II), cotisation au
 * fonds de travaux (art. 14-2-1), autre somme (hors assiette).
 */
export const NATURES_SOMME_EXIGIBLE = ['provision_budget', 'travaux_hors_budget', 'cotisation_fonds_travaux', 'autre'] as const
export type NatureSommeExigible = (typeof NATURES_SOMME_EXIGIBLE)[number]

/** Sommes exigibles « en vertu des articles 14-1 et 14-2-1 » : art. 14-1, I et II, et art. 14-2-1. */
const NATURES_COMPTEES: ReadonlySet<NatureSommeExigible> = new Set<NatureSommeExigible>([
  'provision_budget',
  'travaux_hors_budget',
  'cotisation_fonds_travaux',
])

export interface SommeExigible {
  nature: NatureSommeExigible
  exigibleLe: string
  montantCentimes: number
  /** Reste impayé à la date de clôture (état des impayés avant répartition, D. 1967 art. 61-4). */
  impayeCentimes: number
}

export interface ExerciceAlerte {
  id: string
  exercice: Exercice
  /** Sommes appelées, arriérés des exercices antérieurs compris, et leur impayé à la clôture ; absent ou null : non saisies. */
  sommes?: readonly SommeExigible[] | null
}

export interface VoteApprobationComptes {
  /** Date de l'assemblée qui s'est prononcée. */
  date: string
  /** Adoptée ou rejetée : un vote ; à voter, second vote à tenir ou reportée : pas un vote. */
  etat: EtatResolution
}

export interface EntreeAlerteMandataireAdHoc {
  /** D1 : le syndicat. */
  coproprieteId: string
  /**
   * J67, R32 — nombre de lots du syndicat : tous les lots de l'état descriptif de division, lots secondaires compris
   * (caves, parkings ; L. 1965 art. 1, I). C'est lui qui fixe le seuil (25 %, ou 15 % au-delà de deux cents lots).
   */
  nombreLots: number
  /** J67, R32 — lots du syndicat, quand la liste est connue : comptés pour signaler un écart ; absents, null ou vides : non fournis. */
  lots?: readonly Pick<LotEnregistre, 'id' | 'coproprieteId'>[] | null
  exercices?: readonly ExerciceAlerte[]
  /** Votes de l'assemblée sur l'approbation des comptes (résolution et date de l'assemblée). */
  votes?: readonly VoteApprobationComptes[]
  /** Décisions annuelles : une approbation des comptes adoptée par l'assemblée est un vote. */
  decisions?: readonly DecisionAnnuelle[]
  /** Régime du mandat de justice en cours ; absent ou null : aucun (syndic). */
  regime?: Regime | null
  /**
   * Administrateur provisoire de l'art. 47 : l'ordonnance lui confère expressément les pouvoirs du syndic, l'obligation
   * du syndic s'applique (J67, R30) ; absent : non. Sans objet pour un autre régime.
   */
  ordonnanceConferePouvoirsDuSyndic?: boolean
  /** Requête au président du tribunal judiciaire pour la désignation d'un mandataire ad hoc ; absente ou null : aucune. */
  saisineLe?: string | null
  /**
   * Envoi de la copie de la requête au représentant de l'État, au maire et au président de l'EPCI (art. 29-1 A, dernier
   * alinéa ; D. 1967 art. 61-5) ; absent ou null : non adressée. Jamais avant la requête.
   */
  copieRequeteAdresseeLe?: string | null
}

export type EtatCritere291A = 'atteint' | 'non_atteint' | 'non_etabli'

export interface CritereImpayes291A {
  etat: EtatCritere291A
  exerciceId: string | null
  cloture: string | null
  seuilPourcent: number
  /** Sommes des art. 14-1 et 14-2-1 devenues exigibles au cours de l'exercice clos. */
  exigiblesCentimes: number
  /** Impayés retenus à la clôture, arriérés compris, hors sommes du dernier mois. */
  impayesCentimes: number
  /** Impayés des sommes devenues exigibles dans le mois précédant la clôture, écartés (D. 1967 art. 61-2). */
  ecartesCentimes: number
  /** Part des impayés retenus qui vient d'exercices antérieurs (comptée : J67, R31). */
  arrieresCentimes: number
  message: string
  /** Atteint, et couvert par une requête au juge datée du jour de la clôture ou d'après, au plus tard à la date de référence. */
  traite: boolean
}

export interface CritereComptes291A {
  etat: EtatCritere291A
  dernierVoteLe: string | null
  /** Date à laquelle le délai sans vote est atteint ; null : aucun vote connu. */
  atteintLe: string | null
  /** Dernière approbation des comptes par décision de l'administrateur provisoire (pas un vote) ; null : aucune. */
  approuvesParAdministrateurLe: string | null
  message: string
  /** Atteint, et couvert par une requête au juge datée du jour où le délai est atteint ou d'après, au plus tard à la date de référence. */
  traite: boolean
}

/**
 * Ce que le suivi propose (J67, R30) : l'obligation du syndic (syndic, syndic désigné, administrateur de l'art. 47
 * investi des pouvoirs du syndic) ; le constat au prochain compte rendu au juge (administrateur de l'art. 29-1) ; le
 * signalement au juge, requête possible (administrateur de l'art. 47).
 */
export type CadreAlerte291A = 'obligation_du_syndic' | 'compte_rendu_au_juge' | 'signalement_au_juge'

export interface AlerteMandataireAdHoc {
  coproprieteId: string
  /** Régime du mandat de justice en cours ; null : syndic. */
  regime: Regime | null
  cadre: CadreAlerte291A
  date: string
  declenchee: boolean
  /** Date du premier critère atteint ; null : aucun. */
  declencheeLe: string | null
  /** Requête au juge enregistrée depuis le déclenchement de chaque critère atteint (critère par critère). */
  saisineFaite: boolean
  /** Date du plus tôt des critères atteints que la requête ne couvre pas ; null : aucun. */
  aTraiterLe: string | null
  /**
   * Date à partir de laquelle les personnes de l'al. 2 peuvent saisir le juge ; null : aucun critère n'ouvre leur saisine
   * (aucun atteint, ou seuls les impayés et le syndic a saisi le juge dans le mois de la clôture).
   */
  saisineParDautresLe: string | null
  /**
   * Copie de la requête à adresser au représentant de l'État, au maire et au président de l'EPCI (D. 1967 art. 61-5), due
   * depuis la requête ; null : aucune requête enregistrée à la date, copie adressée, ou cadre sans obligation du syndic
   * (J67, R30).
   */
  copieRequeteDueLe: string | null
  impayes: CritereImpayes291A
  comptes: CritereComptes291A
  /** Constats des critères atteints ; vide si l'alerte n'est pas déclenchée. */
  message: string
  /** Ce que prévoit le texte selon le régime. */
  conduite: string
  fondement: string
  /**
   * Administrateur provisoire sans les pouvoirs du syndic (lecture déduite, J67, R30) ; les arriérés ne rendent plus
   * l'alerte à confirmer (J67, R31).
   */
  aConfirmer: boolean
  /** J67, R32 — nombre de lots de la liste du syndicat, quand elle est fournie ; null : liste non fournie. */
  lotsDeLaListe: number | null
  /** J67, R32 — écart entre le nombre de lots saisi et la liste ; null : aucun écart, ou liste non fournie. */
  ecartLots: string | null
}

const fr = dateIsoVersFr
const euros = (centimes: number): string => formatEurosCentimes(centimes / 100)
const estAbsent = (valeur: unknown): boolean => valeur === undefined || valeur === null

function verifierDate(valeur: unknown, quoi: string): asserts valeur is string {
  if (!estDateIsoValide(valeur)) throw new Error(`${quoi} invalide (${String(valeur)}) : AAAA-MM-JJ attendu.`)
}

const POURCENTAGES: ReadonlySet<keyof ParametresAlerte291A> = new Set<keyof ParametresAlerte291A>([
  'seuilPourcent',
  'seuilGrandeCoproprietePourcent',
])

function verifierParametres(parametres: ParametresAlerte291A): void {
  for (const [nom, valeur] of Object.entries(parametres) as [keyof ParametresAlerte291A, number][]) {
    const borneBasse = POURCENTAGES.has(nom) ? 1 : 0
    const borneHaute = POURCENTAGES.has(nom) ? 100 : Number.MAX_SAFE_INTEGER
    if (!Number.isInteger(valeur) || valeur < borneBasse || valeur > borneHaute)
      throw new Error(`Paramètre de l'alerte de l'art. 29-1 A invalide (${nom} = ${valeur}) : entier de ${borneBasse} à ${borneHaute} attendu.`)
  }
}

function verifierSomme(somme: SommeExigible, nomExercice: string): void {
  verifierDate(somme?.exigibleLe, `Exercice ${nomExercice} : date d'exigibilité`)
  if (!(NATURES_SOMME_EXIGIBLE as readonly string[]).includes(somme.nature))
    throw new Error(`Exercice ${nomExercice} : nature de somme inconnue « ${String(somme.nature)} » (${NATURES_SOMME_EXIGIBLE.join(', ')}).`)
  const { montantCentimes: montant, impayeCentimes: impaye } = somme
  if (!Number.isInteger(montant) || montant < 0)
    throw new Error(`Exercice ${nomExercice} : montant invalide (${montant}) : centimes entiers positifs attendus.`)
  if (!Number.isInteger(impaye) || impaye < 0 || impaye > montant)
    throw new Error(`Exercice ${nomExercice} : impayé invalide (${impaye}) : centimes entiers de 0 au montant (${montant}) attendus.`)
}

function verifierExercice({ id, exercice, sommes }: ExerciceAlerte, coproprieteId: string): void {
  if (!id?.trim()) throw new Error(`Exercice ${exercice.nom} sans identifiant : l'alerte désigne l'exercice dont elle tient le constat.`)
  if (exercice.coproprieteId !== coproprieteId) throw new Error(`Exercice ${exercice.nom} d'un autre syndicat que celui de l'alerte.`)
  for (const somme of sommes ?? []) verifierSomme(somme, exercice.nom)
}

function verifierVote(vote: VoteApprobationComptes): void {
  verifierDate(vote?.date, "Date du vote sur l'approbation des comptes")
  if (!(ETATS_RESOLUTION as readonly string[]).includes(vote.etat))
    throw new Error(`Vote du ${fr(vote.date)} : état de résolution inconnu « ${String(vote.etat)} ».`)
}

function verifierEntree(entree: EntreeAlerteMandataireAdHoc): void {
  if (!entree.coproprieteId?.trim()) throw new Error("Alerte de l'art. 29-1 A sans syndicat : D1 la rattache à la copropriété.")
  if (!Number.isInteger(entree.nombreLots) || entree.nombreLots < 1)
    throw new Error(`Nombre de lots invalide (${entree.nombreLots}) : entier ≥ 1 attendu.`)
  for (const exercice of entree.exercices ?? []) verifierExercice(exercice, entree.coproprieteId)
  for (const vote of entree.votes ?? []) verifierVote(vote)
  for (const decision of entree.decisions ?? [])
    if (decision.coproprieteId !== entree.coproprieteId) throw new Error(`Décision ${decision.id} d'un autre syndicat que celui de l'alerte.`)
  for (const lot of entree.lots ?? [])
    if (lot.coproprieteId !== entree.coproprieteId) throw new Error(`Lot ${lot.id} d'un autre syndicat que celui de l'alerte.`)
  if (entree.ordonnanceConferePouvoirsDuSyndic && entree.regime !== 'ap47')
    throw new Error("Pouvoirs du syndic conférés par l'ordonnance : sans objet hors administration provisoire de l'art. 47 (D. 1967 art. 47).")
  verifierRequete(entree)
}

/** Requête au juge et copie de la requête (D. 1967 art. 61-5) : dates valides, copie jamais sans requête ni avant elle. */
function verifierRequete({ saisineLe, copieRequeteAdresseeLe: copie }: EntreeAlerteMandataireAdHoc): void {
  if (!estAbsent(saisineLe)) verifierDate(saisineLe, 'Date de la requête au juge')
  if (estAbsent(copie)) return
  verifierDate(copie, "Date d'envoi de la copie de la requête")
  const requete = saisineLe ?? null
  if (requete === null) throw new Error(`Copie de la requête adressée le ${fr(copie)} sans requête au juge enregistrée.`)
  if (copie < requete) throw new Error(`Copie de la requête adressée le ${fr(copie)}, avant la requête du ${fr(requete)}.`)
}

const plusTot = (dates: readonly (string | null)[]): string | null =>
  dates.filter((d): d is string => d !== null).reduce<string | null>((a, b) => (a === null || b < a ? b : a), null)

// ─── Critère des impayés ────────────────────────────────────────────────────────────────────

interface Assiette {
  exigibles: number
  impayes: number
  ecartes: number
  arrieres: number
}

/** Sommes des art. 14-1 et 14-2-1 exigibles à la clôture : exigibles de l'exercice, impayés retenus, écartés, arriérés. */
function assiette(sommes: readonly SommeExigible[], exercice: Exercice, parametres: ParametresAlerte291A): Assiette {
  const debutDernierMois = ajouterMois(exercice.cloture, -parametres.moisNonImpayesAvantCloture)
  const total: Assiette = { exigibles: 0, impayes: 0, ecartes: 0, arrieres: 0 }
  for (const somme of sommes) {
    if (!NATURES_COMPTEES.has(somme.nature) || somme.exigibleLe > exercice.cloture) continue
    const anterieure = somme.exigibleLe < exercice.ouverture
    if (!anterieure) total.exigibles += somme.montantCentimes
    if (somme.exigibleLe > debutDernierMois) total.ecartes += somme.impayeCentimes
    else {
      total.impayes += somme.impayeCentimes
      if (anterieure) total.arrieres += somme.impayeCentimes
    }
  }
  return total
}

function messageImpayes(exercice: Exercice, total: Assiette, seuil: number): string {
  const pourcent = Math.floor((total.impayes * 100) / total.exigibles)
  const precisions = [
    total.ecartes > 0 ? `hors ${euros(total.ecartes)} devenus exigibles dans le mois précédant la clôture` : null,
    total.arrieres > 0 ? `dont ${euros(total.arrieres)} d'arriérés des exercices antérieurs` : null,
  ].filter((p): p is string => p !== null)
  const suite = precisions.length > 0 ? `, ${precisions.join(', ')}` : ''
  return `Impayés à la clôture du ${fr(exercice.cloture)} (exercice ${exercice.nom}) : ${euros(total.impayes)} pour ${euros(total.exigibles)} de sommes exigibles, soit ${pourcent} % (seuil ${seuil} %)${suite}.`
}

const seuilApplicable = (nombreLots: number, parametres: ParametresAlerte291A): number =>
  nombreLots > parametres.lotsGrandeCopropriete ? parametres.seuilGrandeCoproprietePourcent : parametres.seuilPourcent

/**
 * J67, R32 — lots de la liste du syndicat (un lot cité deux fois compte une fois) et écart avec le nombre saisi, qui reste
 * celui du seuil ; le seuil de la liste est dit quand il diffère. Liste vide : non fournie (une copropriété compte au
 * moins deux lots ; une liste pas encore chargée ne doit pas donner un faux écart).
 */
function controleNombreLots(entree: EntreeAlerteMandataireAdHoc, parametres: ParametresAlerte291A): Pick<AlerteMandataireAdHoc, 'lotsDeLaListe' | 'ecartLots'> {
  const lots = entree.lots ?? []
  if (lots.length === 0) return { lotsDeLaListe: null, ecartLots: null }
  const lotsDeLaListe = new Set(lots.map((lot) => lot.id)).size
  if (lotsDeLaListe === entree.nombreLots) return { lotsDeLaListe, ecartLots: null }
  const seuilDeLaListe = seuilApplicable(lotsDeLaListe, parametres)
  const borne = `${lotsDeLaListe > parametres.lotsGrandeCopropriete ? 'plus de' : 'au plus'} ${parametres.lotsGrandeCopropriete} lots`
  const autreSeuil =
    seuilDeLaListe === seuilApplicable(entree.nombreLots, parametres) ? '' : ` Avec la liste, le seuil serait de ${seuilDeLaListe} % (${borne}).`
  return {
    lotsDeLaListe,
    ecartLots: `Nombre de lots saisi : ${entree.nombreLots} ; liste des lots du syndicat : ${lotsDeLaListe}. Tous les lots comptent, caves et parkings compris (L. 1965 art. 1, I, et art. 29-1 A, al. 1 ; J67, R32) : vérifier le nombre saisi.${autreSeuil}`,
  }
}

function dernierExerciceClos(exercices: readonly ExerciceAlerte[], date: string): ExerciceAlerte | null {
  const clos = exercices.filter((e) => e.exercice.cloture < date).sort((a, b) => a.exercice.cloture.localeCompare(b.exercice.cloture))
  return clos.at(-1) ?? null
}

/** Constat d'un critère avant la lecture de la requête au juge. */
type Constat<C> = Omit<C, 'traite'>

function critereImpayes(entree: EntreeAlerteMandataireAdHoc, date: string, parametres: ParametresAlerte291A): Constat<CritereImpayes291A> {
  const seuilPourcent = seuilApplicable(entree.nombreLots, parametres)
  const clos = dernierExerciceClos(entree.exercices ?? [], date)
  const sansMontant = { seuilPourcent, exigiblesCentimes: 0, impayesCentimes: 0, ecartesCentimes: 0, arrieresCentimes: 0 }
  if (clos === null)
    return {
      ...sansMontant,
      etat: 'non_etabli',
      exerciceId: null,
      cloture: null,
      message: `Aucun exercice clos avant le ${fr(date)} : impayés à la clôture non établis.`,
    }
  const { exercice } = clos
  const reperes = { exerciceId: clos.id, cloture: exercice.cloture }
  if (estAbsent(clos.sommes))
    return {
      ...sansMontant,
      ...reperes,
      etat: 'non_etabli',
      message: `Exercice ${exercice.nom} clos le ${fr(exercice.cloture)} : sommes exigibles et impayés à la clôture non saisis.`,
    }
  const total = assiette(clos.sommes ?? [], exercice, parametres)
  const montants = { exigiblesCentimes: total.exigibles, impayesCentimes: total.impayes, ecartesCentimes: total.ecartes, arrieresCentimes: total.arrieres }
  if (total.exigibles === 0)
    return {
      ...sansMontant,
      ...reperes,
      ...montants,
      etat: 'non_etabli',
      message: `Exercice ${exercice.nom} clos le ${fr(exercice.cloture)} : aucune somme exigible en vertu des art. 14-1 et 14-2-1 au cours de l'exercice.`,
    }
  return {
    ...reperes,
    ...montants,
    seuilPourcent,
    etat: total.impayes * 100 >= total.exigibles * seuilPourcent ? 'atteint' : 'non_atteint',
    message: messageImpayes(exercice, total, seuilPourcent),
  }
}

// ─── Critère des comptes ────────────────────────────────────────────────────────────────────

const ETATS_VOTE: ReadonlySet<EtatResolution> = new Set<EtatResolution>(['adoptee', 'rejetee'])

/** Dates des votes de l'assemblée sur l'approbation des comptes, au plus tard à la date de référence. */
function datesDeVote(entree: EntreeAlerteMandataireAdHoc, date: string): string[] {
  const votes = (entree.votes ?? []).filter((v) => ETATS_VOTE.has(v.etat)).map((v) => v.date)
  const decisions = (entree.decisions ?? [])
    .filter((d) => d.type === 'approbation_comptes' && d.source.origine === 'assemblee')
    .map((d) => d.date)
  return [...votes, ...decisions].filter((d) => d <= date)
}

/** Dernière approbation des comptes par décision de l'administrateur provisoire, au plus tard à la date de référence. */
function approbationParAdministrateur(entree: EntreeAlerteMandataireAdHoc, date: string): string | null {
  const dates = (entree.decisions ?? [])
    .filter((d) => d.type === 'approbation_comptes' && d.source.origine === 'administrateur' && d.date <= date)
    .map((d) => d.date)
  return dates.reduce<string | null>((a, b) => (a === null || b > a ? b : a), null)
}

/** J67, R30 : comptes approuvés par l'administrateur provisoire, affiché au lieu de « sans vote depuis deux ans ». */
const prefixeApprobationAp = (le: string): string =>
  `Comptes approuvés par l'administrateur provisoire le ${fr(le)} (décision de l'administrateur, pas un vote de l'assemblée)`

const SUITE_AUCUN_VOTE =
  "vote de l'assemblée sur l'approbation des comptes n'est connu : saisir la date de la dernière assemblée qui s'est prononcée (adoption ou rejet)."

function critereComptes(entree: EntreeAlerteMandataireAdHoc, date: string, parametres: ParametresAlerte291A): Constat<CritereComptes291A> {
  const dates = datesDeVote(entree, date)
  const approuvesParAdministrateurLe = approbationParAdministrateur(entree, date)
  if (dates.length === 0)
    return {
      etat: 'non_etabli',
      dernierVoteLe: null,
      atteintLe: null,
      approuvesParAdministrateurLe,
      message:
        approuvesParAdministrateurLe === null
          ? `Aucun ${SUITE_AUCUN_VOTE}`
          : `${prefixeApprobationAp(approuvesParAdministrateurLe)} ; aucun ${SUITE_AUCUN_VOTE}`,
    }
  const dernier = dates.reduce((a, b) => (b > a ? b : a), dates[0])
  const atteintLe = ajouterMois(dernier, parametres.sansVoteMois)
  const duree = `${parametres.sansVoteMois} mois sans vote`
  const parAdministrateurDepuis = approuvesParAdministrateurLe !== null && approuvesParAdministrateurLe > dernier
  if (date >= atteintLe)
    return {
      etat: 'atteint',
      dernierVoteLe: dernier,
      atteintLe,
      approuvesParAdministrateurLe,
      message: parAdministrateurDepuis
        ? `${prefixeApprobationAp(approuvesParAdministrateurLe)} ; dernier vote de l'assemblée sur l'approbation des comptes le ${fr(dernier)}.`
        : `Aucun vote de l'assemblée sur l'approbation des comptes depuis le ${fr(dernier)} : ${duree} atteints le ${fr(atteintLe)}.`,
    }
  return {
    etat: 'non_atteint',
    dernierVoteLe: dernier,
    atteintLe,
    approuvesParAdministrateurLe,
    message: `Dernier vote de l'assemblée sur l'approbation des comptes le ${fr(dernier)} : sans nouveau vote, ${duree} atteints le ${fr(atteintLe)}.`,
  }
}

// ─── Conduite selon le régime ───────────────────────────────────────────────────────────────

interface Conduite {
  cadre: CadreAlerte291A
  texte: string
  fondement: string
  aConfirmer: boolean
  /** Sans syndic : la saisine par les personnes de l'al. 2 n'attend pas le mois laissé au syndic. */
  sansSyndic: boolean
}

const OBLIGATION_DU_SYNDIC =
  "informer le conseil syndical en adressant sans délai à chacun de ses membres l'état des impayés avant répartition à la date de la clôture de l'exercice comptable, saisir sur requête le président du tribunal judiciaire du lieu de l'immeuble d'une demande de désignation d'un mandataire ad hoc et adresser une copie de la requête au représentant de l'État dans le département, au maire de la commune où est implanté l'immeuble et au président de l'EPCI compétent en matière d'habitat"

const FONDEMENT_SYNDIC = 'L. 1965 art. 29-1 A, al. 1 et dernier alinéa ; D. 1967 art. 61-2 à 61-5'

const SAISINE_PAR_D_AUTRES =
  "le juge peut être saisi par des copropriétaires représentant ensemble au moins 15 % des voix ou le président du conseil syndical, un créancier sous les conditions du 2°, le représentant de l'État ou le procureur de la République, le maire, le président de l'EPCI compétent en matière d'habitat"

const A_CONFIRMER_J67_R30 = 'Lecture déduite des textes, à confirmer (J67, R30).'

const CONDUITES: Record<Regime | 'syndic' | 'ap47_pouvoirs_du_syndic', Conduite> = {
  syndic: {
    cadre: 'obligation_du_syndic',
    texte: `Le syndic doit ${OBLIGATION_DU_SYNDIC}.`,
    fondement: FONDEMENT_SYNDIC,
    aConfirmer: false,
    sansSyndic: false,
  },
  sj: {
    cadre: 'obligation_du_syndic',
    texte: `Syndic désigné par le président du tribunal judiciaire : il est le syndic et doit ${OBLIGATION_DU_SYNDIC}.`,
    fondement: `${FONDEMENT_SYNDIC} ; D. 1967 art. 46`,
    aConfirmer: false,
    sansSyndic: false,
  },
  ap291: {
    cadre: 'compte_rendu_au_juge',
    texte: `Administrateur provisoire de l'art. 29-1 : pas d'alerte de l'art. 29-1 A à faire, ni requête au juge ni copie de la requête ; reporter le constat dans le prochain compte rendu au juge (D. 1967 art. 62-11) ; si le conseil syndical garde ses pouvoirs, lui adresser l'état des impayés avant répartition (D. 1967 art. 61-4). Le constat peut servir à l'imputation au syndic de tout ou partie des frais de l'administration provisoire, s'il n'a pas saisi le juge dans les conditions de l'art. 29-1 A (art. 29-1, II, al. 2). ${A_CONFIRMER_J67_R30}`,
    fondement: 'L. 1965 art. 29-1 A ; art. 29-1, I, al. 2 et II, al. 2 ; D. 1967 art. 61-4 et 62-11',
    aConfirmer: true,
    sansSyndic: true,
  },
  ap47: {
    cadre: 'signalement_au_juge',
    texte: `Administrateur provisoire d'un syndicat dépourvu de syndic : pas d'obligation écrite ; seuil atteint : à signaler au juge qui a désigné l'administrateur et au conseil syndical ; requête possible au président du tribunal judiciaire pour la désignation d'un administrateur provisoire de l'art. 29-1, après consultation du conseil syndical (D. 1967 art. 62-2). En l'absence de syndic, ${SAISINE_PAR_D_AUTRES}, dès la clôture. ${A_CONFIRMER_J67_R30}`,
    fondement: 'L. 1965 art. 29-1 A, al. 2 ; D. 1967 art. 47 et 62-2',
    aConfirmer: true,
    sansSyndic: true,
  },
  ap47_pouvoirs_du_syndic: {
    cadre: 'obligation_du_syndic',
    texte: `Administrateur provisoire d'un syndicat dépourvu de syndic, investi par l'ordonnance des pouvoirs du syndic : il doit ${OBLIGATION_DU_SYNDIC} (J67, R30).`,
    fondement: `${FONDEMENT_SYNDIC} ; D. 1967 art. 47`,
    aConfirmer: false,
    sansSyndic: true,
  },
}

const conduiteDe = ({ regime, ordonnanceConferePouvoirsDuSyndic }: EntreeAlerteMandataireAdHoc): Conduite =>
  regime === 'ap47' && ordonnanceConferePouvoirsDuSyndic ? CONDUITES.ap47_pouvoirs_du_syndic : CONDUITES[regime ?? 'syndic']

/**
 * Saisine par les personnes de l'al. 2 au titre des impayés : dès la clôture sans syndic ; sinon au lendemain du mois
 * laissé au syndic, sauf requête de sa part dans ce mois (« En l'absence d'action du syndic dans un délai d'un mois »).
 */
function saisineParDautresImpayes(
  impayes: CritereImpayes291A,
  sansSyndic: boolean,
  saisineLe: string | null,
  parametres: ParametresAlerte291A,
): string | null {
  if (impayes.etat !== 'atteint' || impayes.cloture === null) return null
  if (sansSyndic) return impayes.cloture
  const finDuDelai = ajouterMois(impayes.cloture, parametres.delaiSyndicMois)
  const actionDuSyndic = impayes.traite && saisineLe !== null && saisineLe <= finDuDelai
  return actionDuSyndic ? null : ajouterJours(finDuDelai, 1)
}

/** Copie de la requête (D. 1967 art. 61-5) : due dès la requête enregistrée à la date, tant qu'elle n'est pas adressée à cette date. */
function copieRequeteDue(saisineLe: string | null, adresseeLe: string | null, date: string): string | null {
  if (saisineLe === null || saisineLe > date) return null
  return adresseeLe !== null && adresseeLe <= date ? null : saisineLe
}

/** Critère atteint le jour `le`, couvert par une requête enregistrée ce jour-là ou après, au plus tard à la date de référence. */
function couvertParRequete(etat: EtatCritere291A, le: string | null, saisineLe: string | null, date: string): boolean {
  return etat === 'atteint' && le !== null && saisineLe !== null && le <= saisineLe && saisineLe <= date
}

/**
 * Alerte de l'art. 29-1 A à une date : impayés à la clôture du dernier exercice clos (seuil de 25 %, 15 % au-delà de deux
 * cents lots, sommes du dernier mois écartées) et absence de vote de l'assemblée sur l'approbation des comptes depuis au
 * moins deux ans (un rejet est un vote). Renvoie chaque critère et s'il est traité, la date du déclenchement, celle du
 * plus tôt des critères non traités, la requête éventuelle (lue critère par critère), la date d'ouverture de la saisine
 * aux personnes de l'al. 2, la copie de la requête encore due au représentant de l'État, au maire et au président de
 * l'EPCI (seulement dans le cadre de l'obligation du syndic), le régime, le cadre et ce que prévoit le texte selon le
 * régime (J67, R30). Lève une erreur sur une saisie invalide ou des éléments d'un autre syndicat.
 */
export function alerteMandataireAdHoc(
  entree: EntreeAlerteMandataireAdHoc,
  date: string,
  parametres: ParametresAlerte291A = PARAMETRES_ALERTE_29_1_A,
): AlerteMandataireAdHoc {
  verifierDate(date, 'Date de référence')
  verifierParametres(parametres)
  verifierEntree(entree)
  const saisineLe = entree.saisineLe ?? null
  const constatImpayes = critereImpayes(entree, date, parametres)
  const constatComptes = critereComptes(entree, date, parametres)
  const impayes: CritereImpayes291A = { ...constatImpayes, traite: couvertParRequete(constatImpayes.etat, constatImpayes.cloture, saisineLe, date) }
  const comptes: CritereComptes291A = { ...constatComptes, traite: couvertParRequete(constatComptes.etat, constatComptes.atteintLe, saisineLe, date) }
  const conduite = conduiteDe(entree)
  /** Critères atteints et jour de leur déclenchement : clôture pour les impayés, terme du délai sans vote pour les comptes. */
  const atteints = [
    { critere: impayes, le: impayes.cloture },
    { critere: comptes, le: comptes.atteintLe },
  ].filter(({ critere }) => critere.etat === 'atteint')
  const declencheeLe = plusTot(atteints.map(({ le }) => le))
  return {
    coproprieteId: entree.coproprieteId,
    regime: entree.regime ?? null,
    cadre: conduite.cadre,
    date,
    declenchee: declencheeLe !== null,
    declencheeLe,
    saisineFaite: atteints.length > 0 && atteints.every(({ critere }) => critere.traite),
    aTraiterLe: plusTot(atteints.filter(({ critere }) => !critere.traite).map(({ le }) => le)),
    saisineParDautresLe: plusTot([
      comptes.etat === 'atteint' ? comptes.atteintLe : null,
      saisineParDautresImpayes(impayes, conduite.sansSyndic, saisineLe, parametres),
    ]),
    copieRequeteDueLe: conduite.cadre === 'obligation_du_syndic' ? copieRequeteDue(saisineLe, entree.copieRequeteAdresseeLe ?? null, date) : null,
    impayes,
    comptes,
    message: atteints.map(({ critere }) => critere.message).join(' '),
    conduite: conduite.texte,
    fondement: conduite.fondement,
    aConfirmer: conduite.aConfirmer,
    ...controleNombreLots(entree, parametres),
  }
}
