import { repartirAuxPlusFortsRestes } from '@/lib/administrateur-judiciaire/domain/arrondis'
import {
  ajouterJours,
  ajouterMois,
  composerDateIso,
  dateIsoVersFr,
  decomposerDateIso,
  estDateIsoValide,
  verifierAujourdhui,
} from '@/lib/administrateur-judiciaire/domain/dates'
import { citerFondement } from '@/lib/administrateur-judiciaire/domain/fondements'
import { refLoi1965 } from '@/lib/administrateur-judiciaire/domain/delais-legaux'
import { formatEurosCentimes } from '@/lib/administrateur-judiciaire/domain/format'
import type { TypeMajorite } from '@/lib/administrateur-judiciaire/domain/majorites-ag'
import type { EcheanceAppel } from '@/lib/administrateur-judiciaire/domain/repartition-appels'
import type { NaturePlanComptable } from '@/lib/data/referentiels-gesteam-judiciaire'

/**
 * Fonds de travaux (décision J4 du 09/10/2026, tranchée le 28/10/2026). Fonctions pures, montants en CENTIMES ENTIERS,
 * dates ISO (AAAA-MM-JJ), sans écran.
 *
 * Le droit — 🟢 texte officiel relu sur Légifrance le 29/10/2026 : L. 1965 art. 14-2-1, créé par la loi n° 2021-1104 du
 * 22 août 2021 (art. 171) et jamais modifié depuis (version unique en vigueur depuis le 01/01/2023).
 * - Obligation (I, al. 1) : immeuble à destination totale ou partielle d'habitation, au terme de DIX ans après la
 *   réception des travaux de construction (l'ancien art. 14-2 disait cinq). Entrée en vigueur selon le nombre de lots à
 *   usage de logements, de bureaux ou de commerces (loi n° 2021-1104, art. 171, VI) : plus de 200 lots le 01/01/2023, de
 *   51 à 200 le 01/01/2024, 50 au plus le 01/01/2025. Plus AUCUNE dispense : celles de l'ancien art. 14-2 (moins de dix
 *   lots à l'unanimité, DTG sans besoin de travaux) n'ont pas été reprises ; la dispense liée au DTG ne vaut plus que pour
 *   le projet de PPT (art. 14-2, I).
 * - Affectation (I, 1° à 4°) : élaboration du projet de PPT (et du DTG) ; travaux du PPT adopté ; travaux urgents décidés
 *   par le syndic (art. 18, I, al. 3) ; travaux de sauvegarde, de santé et de sécurité des occupants ou d'économies
 *   d'énergie non prévus au plan. L'assemblée affecte les sommes à la même majorité que la dépense, en tenant compte des
 *   parties communes spéciales et des clés de répartition (I, al. 7 — le I compte un chapeau, les 1° à 4°, puis quatre
 *   alinéas).
 * - Cotisation annuelle obligatoire (I, al. 6 et 8) : au moins 5 % du budget prévisionnel (art. 14-1) ; avec un PPT
 *   adopté, au moins 2,5 % des travaux du plan ET 5 % du budget ; un montant supérieur se vote à la majorité des voix de
 *   tous les copropriétaires (I, al. 9). Chacun la verse selon les modalités des provisions du budget (I, al. 6), au
 *   prorata des valeurs relatives des parties privatives de l'art. 5 (art. 10, al. 2).
 * - Suspension (II) : l'assemblée doit SE PRONONCER quand le fonds excède le budget prévisionnel et, avec un PPT adopté,
 *   en outre 50 % des travaux du plan (conditions cumulatives). Rien d'automatique : c'est un plafond de réflexion, pas un
 *   plancher. Aucun texte n'impose de solde minimum : le fonds peut tomber à zéro après un chantier.
 * - Sort à la vente (III) : sommes attachées aux lots, acquises au syndicat dès leur versement, jamais remboursées.
 * - Administration provisoire (art. 29-14) : le juge peut suspendre les cotisations quand l'immeuble fait l'objet d'un
 *   plan de sauvegarde (1°), et autoriser l'administrateur provisoire à utiliser le fonds pour le redressement ou la
 *   gestion courante (2°).
 *
 * Décisions du 03/11/2026 (registre des décisions juridiques, J30 ; question 21 de la liste) :
 * - J30 : l'ordonnance de l'art. 29-14, 2° (autorisationJuge) n'est plus un texte libre. Forme exigée : juridiction, date
 *   et n° de l'ordonnance (OrdonnanceJuge), chacun obligatoire ; date ISO valide, jamais postérieure à aujourd'hui. Il en
 *   manque un, ou la date est invalide ou future : refus motivé (cause « reference_invalide »), qui nomme ce qui manque.
 *   Pour la décision d'affectation de l'assemblée (decisionAg) : date de l'AG et n° de la résolution
 *   (DecisionAffectationAg), mêmes règles ; cette déclinaison est confirmée par J42 (ci-dessous).
 *   Lecture et saisie sont distinctes. Une nouvelle saisie (option `nouvelleSaisie`, passée par virement-interne.ts) en
 *   texte libre est refusée, motif « forme incomplète » à l'appui. Une valeur enregistrée avant J30 en texte libre reste
 *   lisible (lireOrdonnanceJuge, lireDecisionAffectationAg) et admise comme avant, jamais rejetée en silence : le
 *   contrôle la signale « forme incomplète » (formeIncomplete), avec ce qui manque. Un texte blanc vaut absence. La date
 *   du jour est exigée dès qu'une forme structurée est contrôlée ; un calcul sur des valeurs enregistrées passe
 *   `aujourdhui: null` (forme contrôlée, date non comparée au jour).
 *
 * Décisions du 06/11/2026 (registre des décisions juridiques, J42 ; PR #643, suite de J30) :
 * - J42 : la décision d'affectation de l'AG prend la forme date de l'AG + n° de la résolution, obligatoires ; un texte
 *   libre est refusé pour toute nouvelle saisie. L'interprétation de J30 est confirmée : la marque de doute de cette
 *   déclinaison est retirée ici et dans virement-interne.ts, avis-appel.ts et fonds-travaux-lots.ts, comportement
 *   inchangé (mêmes refus, mêmes causes, mêmes motifs, même lecture des valeurs enregistrées avant J30) : le motif d'un
 *   refus garde « forme attendue » pour la décision de l'AG et « forme exigée » pour l'ordonnance (CadreForme.exigence).
 *
 * Décisions du 17/11/2026 (registre des décisions juridiques, J67 ; recommandations validées en bloc ; textes
 * relus sur Légifrance le 17/11/2026) :
 * - J67, R84 : l'assiette des 2,5 % est le montant total des travaux de la partie du plan adoptée par l'assemblée, toutes
 *   années confondues (« montant des travaux prévus dans le plan adopté », I, al. 8 ; le plan porte sur dix ans et
 *   l'assemblée en adopte « tout ou partie », art. 14-2, I, 4°, et II) ; jamais une tranche annuelle ; les travaux non
 *   adoptés n'y entrent pas. L'entrée est renommée totalTravauxPlanAdopteCentimes ; calcul inchangé.
 * - J67, R85 : le minimum s'applique de plein droit, sans vote (« ne peut être inférieur à ») : au moins 5 % du budget
 *   voté et, avec un plan adopté, au moins 2,5 % de ses travaux, les deux à la fois ; seul un montant supérieur se vote
 *   (majorité de l'art. 25, I, al. 9) (cotisationAnnuelleDue ; plan non renseigné : aConfirmer, et motif complété comme
 *   l'anomalie plancher_ppt_a_verifier). La suspension se vote à la majorité de l'art. 24 (le II ne
 *   fixe pas de majorité), ou vient d'une ordonnance (art. 29-14, 1°, plan de sauvegarde) ; elle a un début et, si la
 *   décision la fixe, une fin. Votée sans période, elle dure jusqu'à l'assemblée générale annuelle suivante ; votée par
 *   l'assemblée, elle cesse dès qu'une condition du II n'est plus remplie, contrôlée à chaque exercice ; à sa fin, alerte
 *   « reprise des cotisations » (etatSuspensionCotisationsFondsTravaux). Enregistrement de la suspension (début, fin,
 *   date de l'AG suivante) : à brancher.
 * - J67, R86 : avant l'entrée en vigueur applicable (loi n° 2021-1104, art. 171, VI), l'ancien art. 14-2 s'applique
 *   (rédactions du 01/01/2017 au 25/11/2018 et du 25/11/2018 au 01/01/2023, relues) : fonds constitué cinq ans après la
 *   réception, cotisation d'au moins 5 % du budget, dispenses (moins de dix lots, par décision unanime de l'assemblée ;
 *   diagnostic technique global sans besoin de travaux dans les dix ans) ; avant le 01/01/2017, aucun fonds de travaux
 *   légal. Le fonds constitué sous l'ancien régime continue tel quel (même compte 105, mêmes parts par lot :
 *   fonds-travaux-lots.ts ne remet rien à zéro). Immeuble de cinq à dix ans à l'entrée en vigueur : le fonds existant
 *   reste et ne sert qu'aux dépenses du I ; la cotisation n'est obligatoire qu'à dix ans (alerte
 *   immeuble_moins_de_dix_ans). Petite copropriété dispensée : aucun fonds avant l'entrée en vigueur, obligation ensuite
 *   (J4) ; la dispense « moins de dix lots » est refusée à partir de dix lots principaux. Nombre de lots inconnu : avant
 *   le 01/01/2023, l'ancien art. 14-2 répond quel que soit ce nombre (seule la date d'une obligation à venir peut en
 *   dépendre) ; ensuite, continuité et alerte dès que les cinq ans tombent avant le 01/01/2023. Avant le 01/01/2017, la
 *   réponse « aucun fonds » ne dépend d'aucune autre donnée. Aucun texte transitoire lu : c'est une lecture, validée.
 *   Enregistrement de la dispense : à brancher.
 *
 * 🔵 Déduit du texte (non écrit en toutes lettres) :
 * - le syndic décide seul des travaux urgents (art. 18), pas de l'usage du fonds : aucune disposition ne lui permet d'y
 *   puiser sans décision d'affectation de l'assemblée ;
 * - pour une opération de travaux (travaux-operations.ts), la résolution qui vote les travaux et leur financement par le
 *   fonds vaut décision d'affectation, à défaut d'une décision d'affectation distincte ;
 * - les deux planchers d'une copropriété dotée d'un PPT jouent ensemble : le plus élevé s'impose ;
 * - un montant supérieur adopté au second vote de l'art. 25-1 (majorité de l'art. 24) est régulier ;
 * - hors des seuils du II, la cotisation reste due : une suspension votée en deçà est signalée, à confirmer ;
 * - seule l'année de construction connue : la réception est supposée faite au plus tard le 31/12 de cette année ;
 * - plan non renseigné (« inconnu ») : seul le plancher de 5 % est contrôlé, et les résultats sont marqués à confirmer.
 *
 * Décisions du 20/11/2026 (partie C du relevé des questions ouvertes du code, recommandations acceptées par le
 * responsable du projet) :
 * - Décision du 20/11/2026 (partie C, F93) : affectation par clé, la part du fonds par lot et la déduction d'un emploi
 *   sont dans fonds-travaux-lots.ts (point 20 du bilan). Aucun texte ne fixe la méthode ; la loi donne la direction
 *   (l'affectation « tient compte » des clés, I, al. 7 ; sommes « attachées aux lots », III) : par défaut, chaque lot de
 *   la clé de la dépense supporte sa quote-part en tantièmes de cette clé, dans la limite de sa part disponible ; ce qui
 *   dépasse n'est jamais pris sur les autres lots, il est signalé « reste à appeler auprès de ce lot » ; le prorata des
 *   parts reste une option, et le mode « tantièmes » ne rend plus de part négative ;
 * - Décision du 20/11/2026 (partie C, F96) : sous l'art. 29-1, la décision de l'administrateur provisoire qui affecte le
 *   fonds se saisit dans une troisième forme structurée, « décision de l'administrateur provisoire »
 *   (DecisionAdministrateurProvisoire, dans decisionAg) : (a) l'ordonnance de l'art. 29-1 (juridiction, date, n°) et la
 *   case « pouvoirs de l'AG confiés » ; (b) la date et le n° de la décision au registre des décisions, où elle est
 *   mentionnée « à leur date » (D. 1967 art. 62-8) ; (c) l'avis du conseil syndical ou le constat d'urgence (D. 1967 art.
 *   62-7 ; J16, J46). La date comparée à la dépense est celle de la décision (b) (fonds-travaux-lots.ts). Case non cochée :
 *   refus, il faut un vote de l'assemblée ou une ordonnance de l'art. 29-14, 2° (J67, R81 et R82) ; décision antérieure à
 *   l'ordonnance qui confie les pouvoirs : refus. Les pouvoirs des a et b de l'art. 26 restent exclus (art. 29-1, I),
 *   l'affectation du fonds n'en fait pas partie.
 *
 * Gestéam — appels de type « Fonds travaux non remb. », compte 10500, sur la clé des provisions (le plus souvent la clé
 * générale), observés à 5 % du budget en quatre trimestres arrondis chacun au centime (tranche 43 § 23) ; aucun contrôle
 * du plancher ni de la suspension vu.
 * Champ « Montant bloqué € », onglet Réglages d'un compte de nature « Fonds travaux » (tranches 25 et 26) : sens DÉDUIT,
 * non observé, très probablement l'amélioration 5.4.20 « Fonds travaux : Trésorerie mini ». Dans VitFix : paramètre de
 * GESTION, modifiable, jamais présenté comme une règle légale.
 * 🔴 Non observé : l'effet de ce champ dans Gestéam (blocage à la saisie, simple alerte, ou affichage).
 *
 * Branchements à faire (J30) : virement-interne.ts refuse le texte libre à la création (nouvelleSaisie) et expose le
 * signalement des valeurs enregistrées (affectation.formeIncomplete) ; fonds-travaux-lots.ts et avis-appel.ts
 * reçoivent la forme structurée et la contrôlent comme valeur enregistrée (`aujourdhui: null`), et signalent le texte
 * libre par une anomalie non bloquante (emploi_forme_incomplete, emploi_fonds_forme_incomplete) ; fonds-travaux-lots.ts
 * rapproche en outre la date de l'AG d'une décision structurée de celle de l'emploi. travaux-operations.ts, hors de ce
 * lot, saisit encore décision et ordonnance en texte libre, fabrique un texte à partir de la résolution de l'opération
 * et perd le signalement (etatPartFondsTravaux ne rend que autorise et motif) : sa saisie recevra la forme structurée.
 */

const FONDEMENT_I = citerFondement(refLoi1965('14-2-1, I'))
const FONDEMENT_II = citerFondement(refLoi1965('14-2-1, II'))
const FONDEMENT_29_14 = citerFondement(refLoi1965('29-14'))
const FONDEMENT_29_14_1 = citerFondement(refLoi1965('29-14, 1°'))
const FONDEMENT_I_ET_III = citerFondement(refLoi1965('14-2-1, I et III'))
const FONDEMENT_ENTREE_EN_VIGUEUR = 'Loi n° 2021-1104 du 22 août 2021, art. 171, VI'

/**
 * Les cinq natures de fonds du plan comptable (NATURE_PLAN_COMPTABLE, bloc Copropriété) : cinq natures distinctes,
 * à ne jamais fusionner sous un seul « fonds ». « Comptes bloqués » est une autre nature, sans lien avec le fonds.
 */
export const NATURES_FONDS = [
  'Fonds, avance de trésorerie',
  'Fonds de prévoyance',
  'Fonds de réserve',
  'Fonds de solidarité',
  'Fonds travaux',
] as const satisfies readonly NaturePlanComptable[]
export type NatureFonds = (typeof NATURES_FONDS)[number]

const eur = (centimes: number): string => formatEurosCentimes(centimes / 100)

const verifierCentimes = (montant: number, strictementPositif: boolean): void => {
  if (!Number.isInteger(montant) || montant < 0 || (strictementPositif && montant === 0))
    throw new Error(
      `Montant invalide (${montant}) : centimes entiers ${strictementPositif ? 'strictement positifs' : 'positifs ou nuls'} attendus.`,
    )
}

/** Division entière arrondie au centime supérieur : un plancher « ne peut être inférieur ». */
const diviserParExces = (montant: number, diviseur: number): number => {
  const reste = montant % diviseur
  return (montant - reste) / diviseur + (reste > 0 ? 1 : 0)
}

// ─── Affectation ─────────────────────────────────────────────────────────────────────────────────────────────────

/** Ce qui ouvre l'usage du fonds : décision d'affectation de l'assemblée (I, al. 7), ou autorisation du juge (29-14). */
type BaseAffectation = 'affectation_ag' | 'autorisation_juge'

/**
 * Objet d'un décaissement imputé au fonds de travaux : les quatre dépenses du I (numérotées comme le texte), l'usage
 * judiciaire de l'art. 29-14, 2°, puis les exclusions.
 */
export const AFFECTATION_FONDS_TRAVAUX = {
  elaboration_ppt_dtg: {
    libelle: 'Élaboration du projet de plan pluriannuel de travaux et, le cas échéant, du diagnostic technique global',
    admis: true,
    alinea: '1°',
    base: 'affectation_ag',
  },
  travaux_ppt: {
    libelle: "Travaux prévus dans le plan pluriannuel de travaux adopté par l'assemblée",
    admis: true,
    alinea: '2°',
    base: 'affectation_ag',
  },
  travaux_urgents: {
    libelle: "Travaux décidés par le syndic en cas d'urgence (art. 18, I, al. 3)",
    admis: true,
    alinea: '3°',
    base: 'affectation_ag',
  },
  travaux_hors_ppt: {
    libelle:
      "Travaux de sauvegarde de l'immeuble, de santé et de sécurité des occupants ou d'économies d'énergie, non prévus au plan",
    admis: true,
    alinea: '4°',
    base: 'affectation_ag',
  },
  redressement_29_14: {
    libelle: 'Actions de redressement ou maintien de la gestion courante, en administration provisoire (art. 29-14, 2°)',
    admis: true,
    alinea: null,
    base: 'autorisation_juge',
  },
  travaux_amelioration: { libelle: "Travaux d'amélioration ou d'agrément non prévus au plan", admis: false, alinea: null, base: null },
  charges_courantes: { libelle: 'Charges courantes', admis: false, alinea: null, base: null },
  compensation_impaye: { libelle: "Compensation d'un impayé de copropriétaire", admis: false, alinea: null, base: null },
  frais_contentieux: { libelle: 'Frais de contentieux du syndicat', admis: false, alinea: null, base: null },
  travaux_privatifs: { libelle: 'Travaux privatifs', admis: false, alinea: null, base: null },
} as const satisfies Record<
  string,
  { libelle: string; admis: boolean; alinea: '1°' | '2°' | '3°' | '4°' | null; base: BaseAffectation | null }
>
export type ObjetDecaissementFondsTravaux = keyof typeof AFFECTATION_FONDS_TRAVAUX

/** Exclusions qu'une ordonnance de l'art. 29-14, 2° peut ouvrir à l'administrateur provisoire. */
const OUVERTS_PAR_LE_JUGE: ReadonlySet<ObjetDecaissementFondsTravaux> = new Set(['charges_courantes', 'frais_contentieux'])

/**
 * Objet de l'ordonnance de l'art. 29-14, 2° (J67, R58) : actions de redressement, maintien de la gestion courante, ou
 * opérations nommées. Lu et contrôlé dans sa forme ; il ne change pas les objets de décaissement admis.
 */
export const OBJETS_ORDONNANCE_FONDS_TRAVAUX = ['redressement', 'gestion_courante', 'operations_nommees'] as const
export type ObjetOrdonnanceFondsTravaux = (typeof OBJETS_ORDONNANCE_FONDS_TRAVAUX)[number]
const OBJETS_ORDONNANCE_CONNUS: ReadonlySet<string> = new Set(OBJETS_ORDONNANCE_FONDS_TRAVAUX)

/** Ordonnance du juge (art. 29-14, 2°), forme exigée par la décision J30 : juridiction, date et n°, chacun obligatoire. */
export interface OrdonnanceJuge {
  juridiction: string
  /** Date de l'ordonnance (AAAA-MM-JJ), jamais postérieure à aujourd'hui. */
  date: string
  numero: string
  /**
   * Montant jusqu'auquel l'ordonnance autorise l'usage du fonds, s'il y en a un (J67, R58 : l'art. 29-14, 2° n'en fixe
   * aucun, l'ordonnance fixe l'étendue de l'autorisation) ; aucun emploi ne le dépasse. Absent : aucun montant écrit.
   */
  montantMaximumCentimes?: number | null
  /** Objet de l'autorisation (J67, R58) ; absent : non saisi. */
  objet?: ObjetOrdonnanceFondsTravaux | null
}

/** Décision d'affectation de l'assemblée (I, al. 7) : date de l'AG et n° de la résolution, obligatoires (J30, J42). */
export interface DecisionAffectationAg {
  /** Date de l'assemblée (AAAA-MM-JJ), jamais postérieure à aujourd'hui. */
  dateAg: string
  numeroResolution: string
}

/** Ce qui permet à l'administrateur provisoire de décider sans assemblée (D. 1967 art. 62-7 ; J16, J46). */
export const AVIS_OU_URGENCE_DECISION_AP = {
  avis_conseil_syndical: { libelle: 'avis du conseil syndical du' },
  constat_urgence: { libelle: 'urgence constatée le' },
} as const satisfies Record<string, { libelle: string }>
export type AvisOuUrgenceDecisionAp = keyof typeof AVIS_OU_URGENCE_DECISION_AP

/**
 * Décision de l'administrateur provisoire qui affecte le fonds sous l'art. 29-1 (décision du 20/11/2026, partie C, F96) :
 * troisième forme structurée, à côté de la décision de l'assemblée et de l'ordonnance de l'art. 29-14, 2°. Sous l'art.
 * 29-1, ce n'est pas l'ordonnance qui affecte le fonds : c'est l'administrateur qui décide, avec les pouvoirs de
 * l'assemblée qu'elle lui confie ; la saisir comme une décision d'AG serait faux (pas d'AG, pas de résolution).
 */
export interface DecisionAdministrateurProvisoire {
  forme: 'decision_administrateur_provisoire'
  /** (a) Ordonnance de l'art. 29-1 qui confie les pouvoirs de l'assemblée : juridiction, date, n° (comme J30). */
  ordonnance: { juridiction: string; date: string; numero: string }
  /** (a) Case « pouvoirs de l'AG confiés » : sans elle, la décision ne tient pas lieu d'affectation. */
  pouvoirsAgConfies: boolean
  /** (b) La décision : sa date (comparée à la dépense) et son n° au registre des décisions (D. 1967 art. 62-8). */
  decision: { date: string; numeroRegistre: string }
  /** (c) Avis du conseil syndical, ou constat d'urgence (D. 1967 art. 62-7 ; J16, J46), daté. */
  avisOuUrgence: { nature: AvisOuUrgenceDecisionAp; date: string }
}

/** La décision d'affectation est une décision de l'administrateur provisoire (F96), non une décision de l'assemblée. */
export function estDecisionAdministrateurProvisoire(valeur: unknown): valeur is DecisionAdministrateurProvisoire {
  return typeof valeur === 'object' && valeur !== null && (valeur as { forme?: unknown }).forme === 'decision_administrateur_provisoire'
}

/**
 * Référence saisie avant la décision J30 : texte libre, lu et signalé « forme incomplète », jamais rejeté en silence ;
 * refusé pour une nouvelle saisie (OptionsControleAffectation.nouvelleSaisie).
 */
export type TexteLibreAncien = string

export interface DecaissementFondsTravaux {
  objet: ObjetDecaissementFondsTravaux
  montantCentimes: number
  /**
   * Décision qui affecte le fonds à la dépense : de l'assemblée (J30 : date de l'AG et n° de la résolution), ou de
   * l'administrateur provisoire sous l'art. 29-1 (F96) ; null si absente.
   */
  decisionAg: DecisionAffectationAg | DecisionAdministrateurProvisoire | TexteLibreAncien | null
  /** Ordonnance du juge (art. 29-14, 2° ; J30 : juridiction, date, n°) ; exigée pour l'usage judiciaire du fonds. */
  autorisationJuge?: OrdonnanceJuge | TexteLibreAncien | null
}

/** Lecture d'une référence enregistrée : absente, complète, ou incomplète (texte libre ancien, champ manquant ou invalide). */
export type LectureReference<T> =
  | { forme: 'absente' }
  | { forme: 'complete'; valeur: T }
  | { forme: 'incomplete'; texte: string | null; manquants: string[] }

interface ChampForme<T> {
  cle: keyof T & string
  libelle: string
  date: boolean
}

/** Forme exigée d'une référence : ses champs et leur désignation dans les messages. */
interface CadreForme<T> {
  nom: string
  /** Libellé du motif : « forme exigée » (ordonnance) ou « forme attendue » (décision de l'AG), gardés par J42. */
  exigence: string
  description: string
  champs: readonly ChampForme<T>[]
  designer: (valeur: T) => string
}

const CADRE_ORDONNANCE: CadreForme<OrdonnanceJuge> = {
  nom: 'Ordonnance du juge (art. 29-14, 2°)',
  exigence: 'forme exigée',
  description: "juridiction, date et n° de l'ordonnance",
  champs: [
    { cle: 'juridiction', libelle: 'juridiction', date: false },
    { cle: 'date', libelle: "date de l'ordonnance", date: true },
    { cle: 'numero', libelle: "n° de l'ordonnance", date: false },
  ],
  designer: (o) => `ordonnance n° ${o.numero} du ${dateIsoVersFr(o.date)}, ${o.juridiction}`,
}

const CADRE_DECISION_AG: CadreForme<DecisionAffectationAg> = {
  nom: "Décision d'affectation de l'assemblée",
  exigence: 'forme attendue',
  description: "date de l'assemblée et n° de la résolution",
  champs: [
    { cle: 'dateAg', libelle: "date de l'assemblée", date: true },
    { cle: 'numeroResolution', libelle: 'n° de la résolution', date: false },
  ],
  designer: (d) => `résolution n° ${d.numeroResolution} de l'assemblée du ${dateIsoVersFr(d.dateAg)}`,
}

/** Champ lu, rogné ; message de ce qui manque s'il est vide, d'un autre type ou, pour une date, hors AAAA-MM-JJ. */
function lireChamp(brut: unknown, champ: { libelle: string; date: boolean }): { texte: string } | { manque: string } {
  const texte = typeof brut === 'string' ? brut.trim() : ''
  if (texte === '') return { manque: champ.libelle }
  if (champ.date && !estDateIsoValide(texte)) return { manque: `${champ.libelle} au format AAAA-MM-JJ` }
  return { texte }
}

function lireReference<T>(valeur: T | TexteLibreAncien | null | undefined, cadre: CadreForme<T>): LectureReference<T> {
  if (valeur === null || valeur === undefined) return { forme: 'absente' }
  if (typeof valeur === 'string') {
    const texte = valeur.trim()
    if (texte === '') return { forme: 'absente' }
    return { forme: 'incomplete', texte, manquants: cadre.champs.map((c) => c.libelle) }
  }
  const lu: Partial<Record<keyof T & string, string>> = {}
  const manquants: string[] = []
  for (const champ of cadre.champs) {
    const resultatChamp = lireChamp((valeur as Record<string, unknown>)[champ.cle], champ)
    if ('manque' in resultatChamp) manquants.push(resultatChamp.manque)
    else lu[champ.cle] = resultatChamp.texte
  }
  if (manquants.length > 0) return { forme: 'incomplete', texte: null, manquants }
  return { forme: 'complete', valeur: lu as T }
}

/** Ordonnance enregistrée (structurée, ou texte libre d'avant J30), lue sans jamais être rejetée. */
export function lireOrdonnanceJuge(valeur: OrdonnanceJuge | TexteLibreAncien | null | undefined): LectureReference<OrdonnanceJuge> {
  return lireReference(valeur, CADRE_ORDONNANCE)
}

/** Décision d'affectation enregistrée (structurée, ou texte libre d'avant J30), lue sans jamais être rejetée. */
export function lireDecisionAffectationAg(
  valeur: DecisionAffectationAg | TexteLibreAncien | null | undefined,
): LectureReference<DecisionAffectationAg> {
  return lireReference(valeur, CADRE_DECISION_AG)
}

// ─── Décision de l'administrateur provisoire (décision du 20/11/2026, partie C, F96) ─────────────────────────────────

const CADRE_ORDONNANCE_29_1: CadreForme<DecisionAdministrateurProvisoire['ordonnance']> = {
  nom: "Ordonnance de l'art. 29-1",
  exigence: 'forme attendue',
  description: "juridiction, date et n° de l'ordonnance de l'art. 29-1",
  champs: [
    { cle: 'juridiction', libelle: "juridiction de l'ordonnance de l'art. 29-1", date: false },
    { cle: 'date', libelle: "date de l'ordonnance de l'art. 29-1", date: true },
    { cle: 'numero', libelle: "n° de l'ordonnance de l'art. 29-1", date: false },
  ],
  designer: (o) => `ordonnance n° ${o.numero} du ${dateIsoVersFr(o.date)}, ${o.juridiction}`,
}

const CADRE_DECISION_AP: CadreForme<DecisionAdministrateurProvisoire['decision']> = {
  nom: "Décision de l'administrateur provisoire",
  exigence: 'forme attendue',
  description: 'date et n° de la décision au registre des décisions',
  champs: [
    { cle: 'date', libelle: 'date de la décision', date: true },
    { cle: 'numeroRegistre', libelle: 'n° de la décision au registre', date: false },
  ],
  designer: (d) => `décision n° ${d.numeroRegistre} du registre de l'administrateur provisoire, du ${dateIsoVersFr(d.date)}`,
}

const CADRE_AVIS_OU_URGENCE: CadreForme<{ date: string }> = {
  nom: "Avis du conseil syndical ou constat d'urgence",
  exigence: 'forme attendue',
  description: "date de l'avis du conseil syndical ou du constat d'urgence",
  champs: [{ cle: 'date', libelle: "date de l'avis du conseil syndical ou du constat d'urgence", date: true }],
  designer: (a) => dateIsoVersFr(a.date),
}

/** Forme attendue de la décision de l'administrateur provisoire (F96), pour les motifs. */
const FORME_DECISION_AP =
  "forme attendue : ordonnance de l'art. 29-1 (juridiction, date, n°) et case « pouvoirs de l'AG confiés », date et n° de la décision au registre des décisions, avis du conseil syndical ou constat d'urgence (date)"

const FONDEMENT_DECISION_AP = `${FONDEMENT_I} ; ${citerFondement(refLoi1965('29-1, I'))}`

/** Nature de l'avis ou du constat, connue ; null sinon. */
const natureAvisOuUrgence = (nature: unknown): AvisOuUrgenceDecisionAp | null =>
  typeof nature === 'string' && Object.hasOwn(AVIS_OU_URGENCE_DECISION_AP, nature) ? (nature as AvisOuUrgenceDecisionAp) : null

/** Ce qui manque à une partie de la décision : tous ses champs si elle est absente, ceux qui manquent si elle est incomplète. */
function manquantsDe<T>(lecture: LectureReference<T>, cadre: CadreForme<T>): string[] {
  if (lecture.forme === 'absente') return cadre.champs.map((c) => c.libelle)
  return lecture.forme === 'incomplete' ? lecture.manquants : []
}

/**
 * Décision de l'administrateur provisoire enregistrée (F96), lue sans jamais être rejetée : complète quand l'ordonnance
 * de l'art. 29-1, la case « pouvoirs de l'AG confiés », la décision au registre et l'avis ou le constat d'urgence sont
 * saisis ; incomplète sinon, avec ce qui manque.
 */
export function lireDecisionAdministrateurProvisoire(valeur: DecisionAdministrateurProvisoire): LectureReference<DecisionAdministrateurProvisoire> {
  const ordonnance = lireReference(valeur.ordonnance, CADRE_ORDONNANCE_29_1)
  const decision = lireReference(valeur.decision, CADRE_DECISION_AP)
  const avis = lireReference(valeur.avisOuUrgence, CADRE_AVIS_OU_URGENCE)
  const nature = natureAvisOuUrgence(valeur.avisOuUrgence?.nature)
  const manquants = [
    ...manquantsDe(ordonnance, CADRE_ORDONNANCE_29_1),
    ...(typeof valeur.pouvoirsAgConfies === 'boolean' ? [] : ["case « pouvoirs de l'AG confiés »"]),
    ...manquantsDe(decision, CADRE_DECISION_AP),
    ...(nature === null ? ["nature : avis du conseil syndical ou constat d'urgence"] : []),
    ...manquantsDe(avis, CADRE_AVIS_OU_URGENCE),
  ]
  if (ordonnance.forme !== 'complete' || decision.forme !== 'complete' || avis.forme !== 'complete' || nature === null || manquants.length > 0)
    return { forme: 'incomplete', texte: null, manquants }
  return {
    forme: 'complete',
    valeur: { forme: valeur.forme, ordonnance: ordonnance.valeur, pouvoirsAgConfies: valeur.pouvoirsAgConfies, decision: decision.valeur, avisOuUrgence: { nature, date: avis.valeur.date } },
  }
}

/** Première date d'une décision complète postérieure au jour (ordonnance, décision, avis ou constat) ; null sinon. */
function datePosterieureDeLaDecisionAp(d: DecisionAdministrateurProvisoire, aujourdhui: string | null | undefined): string | null {
  return (
    datePosterieure(d.ordonnance, CADRE_ORDONNANCE_29_1, aujourdhui) ??
    datePosterieure(d.decision, CADRE_DECISION_AP, aujourdhui) ??
    datePosterieure(d.avisOuUrgence, CADRE_AVIS_OU_URGENCE, aujourdhui)
  )
}

/**
 * Contrôle de la décision de l'administrateur provisoire qui affecte le fonds (décision du 20/11/2026, partie C, F96) :
 * forme incomplète, date postérieure au jour (sauf `aujourdhui: null`), ou décision antérieure à l'ordonnance qui lui
 * confie les pouvoirs de l'assemblée : refus « reference_invalide » ; case « pouvoirs de l'AG confiés » non cochée :
 * refus « decision_manquante » (il faut un vote de l'assemblée ou une ordonnance de l'art. 29-14, 2° : J67, R81 et R82) ;
 * admise sinon. Les pouvoirs des a et b de l'art. 26 restent exclus, l'affectation du fonds n'en fait pas partie.
 */
function controlerDecisionAdministrateurProvisoire(
  libelle: string,
  valeur: DecisionAdministrateurProvisoire,
  { aujourdhui }: OptionsControleAffectation,
): ResultatAffectation {
  const lecture = lireDecisionAdministrateurProvisoire(valeur)
  if (lecture.forme !== 'complete') {
    const manquants = lecture.forme === 'incomplete' ? lecture.manquants : []
    return resultatAffectation('reference_invalide', `${libelle} : ${CADRE_DECISION_AP.nom} incomplète (manque : ${manquants.join(', ')}) ; ${FORME_DECISION_AP}.`, FONDEMENT_DECISION_AP)
  }
  const d = lecture.valeur
  if (!d.pouvoirsAgConfies)
    return resultatAffectation(
      'decision_manquante',
      `${libelle} : ${CADRE_ORDONNANCE_29_1.designer(d.ordonnance)} sans les pouvoirs de l'assemblée (case « pouvoirs de l'AG confiés » non cochée) ; la décision de l'administrateur provisoire ne tient pas lieu d'affectation du fonds : il faut un vote de l'assemblée ou une ordonnance de l'art. 29-14, 2° (décision du 20/11/2026, partie C, F96).`,
      FONDEMENT_DECISION_AP,
    )
  const future = datePosterieureDeLaDecisionAp(d, aujourdhui)
  if (future) return resultatAffectation('reference_invalide', `${libelle} : ${CADRE_DECISION_AP.nom} : ${future} ; ${FORME_DECISION_AP}.`, FONDEMENT_DECISION_AP)
  if (d.decision.date < d.ordonnance.date)
    return resultatAffectation(
      'reference_invalide',
      `${libelle} : ${CADRE_DECISION_AP.designer(d.decision)} antérieure à l'ordonnance de l'art. 29-1 (${CADRE_ORDONNANCE_29_1.designer(d.ordonnance)}) qui lui confie les pouvoirs de l'assemblée.`,
      FONDEMENT_DECISION_AP,
    )
  const avis = `${AVIS_OU_URGENCE_DECISION_AP[d.avisOuUrgence.nature].libelle} ${dateIsoVersFr(d.avisOuUrgence.date)}`
  return resultatAffectation(
    'admis',
    `${libelle} : affectation admise (${CADRE_DECISION_AP.designer(d.decision)} ; ${CADRE_ORDONNANCE_29_1.designer(d.ordonnance)} ; ${avis}).`,
    FONDEMENT_DECISION_AP,
  )
}

export type CauseAffectation =
  | 'admis'
  | 'exclu'
  | 'decision_manquante'
  | 'autorisation_manquante'
  | 'reference_invalide'
  | 'au_dela_de_l_ordonnance'

/** Référence admise mais saisie en texte libre avant J30 : ce qui manque à la forme exigée. */
export interface FormeIncomplete {
  code: 'forme_incomplete'
  texte: string
  manquants: string[]
  message: string
}

export interface ResultatAffectation {
  autorise: boolean
  cause: CauseAffectation
  motif: string
  fondement: string
  /** Décision ou ordonnance admise mais en texte libre d'avant J30 ; null sinon. */
  formeIncomplete: FormeIncomplete | null
}

const resultatAffectation = (
  cause: CauseAffectation,
  motif: string,
  fondement = FONDEMENT_I,
  formeIncomplete: FormeIncomplete | null = null,
): ResultatAffectation => ({ autorise: cause === 'admis', cause, motif, fondement, formeIncomplete })

/**
 * Contexte du contrôle d'affectation (J30).
 * - `aujourdhui` : date du jour (AAAA-MM-JJ) d'une saisie ; une décision ou une ordonnance structurée datée après elle
 *   est refusée. Exigée dès qu'une forme structurée est contrôlée. `null` : calcul sur une valeur déjà enregistrée
 *   (parts du fonds par lot, avis d'appel), dont la date n'est pas comparée au jour ; la forme reste contrôlée.
 * - `nouvelleSaisie` : la référence est saisie maintenant ; un texte libre est alors refusé, motif « forme incomplète » à
 *   l'appui. Absent ou faux : valeur enregistrée, dont le texte libre d'avant J30 est admis et signalé.
 * - `dejaEmployeSousOrdonnanceCentimes` : emplois déjà faits sous la même ordonnance, avant ce décaissement (toutes
 *   opérations, gestion courante comprise), fournis par l'appelant ; absent : zéro, seul ce décaissement est comparé au
 *   montant de l'ordonnance (J67, R58).
 */
export interface OptionsControleAffectation {
  aujourdhui?: string | null
  nouvelleSaisie?: boolean
  dejaEmployeSousOrdonnanceCentimes?: number
}

/** Contrôle de la forme d'une référence présente : refus motivé, ou admission (avec la désignation ou le signalement). */
type ControleReference = { refus: string } | { refus: null; designation: string; formeIncomplete: FormeIncomplete | null }

function datePosterieure<T>(valeur: T, cadre: CadreForme<T>, aujourdhui: string | null | undefined): string | null {
  if (aujourdhui === null) return null
  if (aujourdhui === undefined)
    throw new Error(`${cadre.nom} : date du jour attendue pour vérifier que sa date n'est pas postérieure à aujourd'hui.`)
  verifierAujourdhui(aujourdhui)
  const champ = cadre.champs.find((c) => c.date && String(valeur[c.cle]) > aujourdhui)
  return champ ? `${champ.libelle} (${dateIsoVersFr(String(valeur[champ.cle]))}) postérieure à aujourd'hui` : null
}

/** Forme structurée à qui il manque un champ : refus ; texte libre : refus pour une nouvelle saisie, signalement sinon. */
function controlerFormeIncomplete(
  { texte, manquants }: Extract<LectureReference<unknown>, { forme: 'incomplete' }>,
  nom: string,
  exigee: string,
  nouvelleSaisie: boolean,
): ControleReference {
  if (texte === null) return { refus: `${nom} incomplète (manque : ${manquants.join(', ')}) ; ${exigee}.` }
  const enTexteLibre = `${nom} saisie en texte libre (« ${texte} ») : forme incomplète`
  if (nouvelleSaisie) return { refus: `${enTexteLibre}, refusée pour une nouvelle saisie ; ${exigee}.` }
  const message = `${enTexteLibre} ; à compléter (${exigee}).`
  return { refus: null, designation: '', formeIncomplete: { code: 'forme_incomplete', texte, manquants, message } }
}

function controlerReference<T>(
  lecture: Exclude<LectureReference<T>, { forme: 'absente' }>,
  cadre: CadreForme<T>,
  { aujourdhui, nouvelleSaisie = false }: OptionsControleAffectation,
): ControleReference {
  const exigee = `${cadre.exigence} : ${cadre.description}`
  if (lecture.forme === 'incomplete') return controlerFormeIncomplete(lecture, cadre.nom, exigee, nouvelleSaisie)
  const future = datePosterieure(lecture.valeur, cadre, aujourdhui)
  if (future) return { refus: `${cadre.nom} : ${future} ; ${exigee}.` }
  return { refus: null, designation: ` (${cadre.designer(lecture.valeur)})`, formeIncomplete: null }
}

function motifExclusion(objet: ObjetDecaissementFondsTravaux, libelle: string): string {
  let motif = `${libelle} : dépense exclue du fonds de travaux, réservé aux dépenses de l'art. 14-2-1, I (1° à 4°). À imputer sur un autre compte.`
  if (objet === 'travaux_amelioration')
    motif += ' Ils ne peuvent être financés par le fonds que s’ils figurent au plan pluriannuel de travaux adopté (2°).'
  if (OUVERTS_PAR_LE_JUGE.has(objet))
    motif += ' En administration provisoire, seul le juge peut ouvrir cet usage (art. 29-14, 2° : redressement ou gestion courante).'
  return motif
}

/**
 * Montant et objet d'une ordonnance structurée (J67, R58) : objet inconnu ou montant qui n'est pas en centimes entiers
 * strictement positifs, refus « reference_invalide » ; emploi qui, ajouté aux emplois déjà faits sous cette ordonnance,
 * dépasse son montant, refus « au_dela_de_l_ordonnance » ; null sinon (texte libre ou aucun montant écrit compris).
 */
function refusDuMontantDeLOrdonnance(
  valeur: DecaissementFondsTravaux['autorisationJuge'],
  montantCentimes: number,
  dejaEmploye: number,
): { cause: CauseAffectation; motif: string } | null {
  if (valeur === null || valeur === undefined || typeof valeur === 'string') return null
  const { montantMaximumCentimes: maximum = null, objet = null } = valeur
  if (objet !== null && !OBJETS_ORDONNANCE_CONNUS.has(objet))
    return { cause: 'reference_invalide', motif: `objet de l'ordonnance inconnu « ${objet} » (redressement, gestion courante ou opérations nommées).` }
  if (maximum === null) return null
  if (!Number.isInteger(maximum) || maximum <= 0)
    return { cause: 'reference_invalide', motif: `montant de l'ordonnance invalide (${maximum}) : centimes entiers strictement positifs attendus.` }
  if (dejaEmploye + montantCentimes <= maximum) return null
  return {
    cause: 'au_dela_de_l_ordonnance',
    motif: `usage autorisé jusqu'à ${eur(maximum)} ; emploi de ${eur(montantCentimes)} après ${eur(dejaEmploye)} déjà employés sous cette ordonnance : au-delà de son montant, refusé (J67, R58).`,
  }
}

function controlerOrdonnance(
  libelle: string,
  { autorisationJuge: valeur, montantCentimes }: Pick<DecaissementFondsTravaux, 'autorisationJuge' | 'montantCentimes'>,
  options: OptionsControleAffectation,
): ResultatAffectation {
  const lecture = lireOrdonnanceJuge(valeur)
  if (lecture.forme === 'absente')
    return resultatAffectation(
      'autorisation_manquante',
      `${libelle} : rattacher l'ordonnance du juge qui autorise l'administrateur provisoire à utiliser le fonds (${CADRE_ORDONNANCE.description}).`,
      FONDEMENT_29_14,
    )
  const controle = controlerReference(lecture, CADRE_ORDONNANCE, options)
  if (controle.refus !== null) return resultatAffectation('reference_invalide', `${libelle} : ${controle.refus}`, FONDEMENT_29_14)
  const auDela = refusDuMontantDeLOrdonnance(valeur, montantCentimes, options.dejaEmployeSousOrdonnanceCentimes ?? 0)
  if (auDela) return resultatAffectation(auDela.cause, `${libelle}${controle.designation} : ${auDela.motif}`, FONDEMENT_29_14)
  return resultatAffectation('admis', `${libelle} : usage autorisé par le juge${controle.designation}.`, FONDEMENT_29_14, controle.formeIncomplete)
}

function controlerDecisionAg(
  objet: ObjetDecaissementFondsTravaux,
  libelle: string,
  valeur: DecaissementFondsTravaux['decisionAg'],
  options: OptionsControleAffectation,
): ResultatAffectation {
  if (estDecisionAdministrateurProvisoire(valeur)) return controlerDecisionAdministrateurProvisoire(libelle, valeur, options)
  const lecture = lireDecisionAffectationAg(valeur)
  if (lecture.forme === 'absente') {
    let motif = `${libelle} : rattacher la décision d'assemblée qui affecte le fonds à cette dépense (à la même majorité que la dépense) avant de décaisser.`
    if (objet === 'travaux_urgents') motif += ' Le syndic décide seul des travaux urgents, pas de l’usage du fonds.'
    return resultatAffectation('decision_manquante', motif)
  }
  const controle = controlerReference(lecture, CADRE_DECISION_AG, options)
  if (controle.refus !== null) return resultatAffectation('reference_invalide', `${libelle} : ${controle.refus}`)
  return resultatAffectation('admis', `${libelle} : affectation admise${controle.designation}.`, FONDEMENT_I, controle.formeIncomplete)
}

/**
 * Contrôle d'affectation (le droit) : un décaissement sur le fonds de travaux n'est admis que pour une dépense du I,
 * sur décision d'affectation de l'assemblée (ou de l'administrateur provisoire qui en a les pouvoirs, forme structurée
 * de F96), ou pour l'usage judiciaire de l'art. 29-14, 2°, sur ordonnance du juge.
 * Décision et ordonnance en forme structurée (J30) : un champ manquant, une date invalide ou postérieure à
 * `aujourdhui` (sauf `aujourdhui: null`) est refusé, motif à l'appui. En texte libre : refusées pour une nouvelle
 * saisie (`nouvelleSaisie`) ; valeur enregistrée avant J30 : admises, signalées « forme incomplète ». Ordonnance qui
 * porte un montant : aucun emploi ne le dépasse, emplois déjà faits sous elle compris (J67, R58).
 * Lève une erreur sur une saisie invalide (montant, déjà employé, objet inconnu) et, pour une forme structurée, si
 * `aujourdhui` manque ou est invalide ; renvoie un refus motivé sinon.
 */
export function controlerAffectationFondsTravaux(
  decaissement: DecaissementFondsTravaux,
  options: OptionsControleAffectation = {},
): ResultatAffectation {
  verifierCentimes(decaissement.montantCentimes, true)
  verifierCentimes(options.dejaEmployeSousOrdonnanceCentimes ?? 0, false)
  if (!Object.hasOwn(AFFECTATION_FONDS_TRAVAUX, decaissement.objet))
    throw new Error(`Objet de décaissement inconnu : « ${decaissement.objet} ».`)
  const affectation: { libelle: string; admis: boolean; base: BaseAffectation | null } =
    AFFECTATION_FONDS_TRAVAUX[decaissement.objet]
  if (!affectation.admis) return resultatAffectation('exclu', motifExclusion(decaissement.objet, affectation.libelle))
  if (affectation.base === 'autorisation_juge') return controlerOrdonnance(affectation.libelle, decaissement, options)
  return controlerDecisionAg(decaissement.objet, affectation.libelle, decaissement.decisionAg, options)
}

// ─── Obligation ──────────────────────────────────────────────────────────────────────────────────────────────────

/** Le fonds se constitue au terme de cette période après la réception des travaux de construction (I, al. 1). */
export const ANNEES_AVANT_FONDS_TRAVAUX = 10

/** Loi n° 2021-1104, art. 171, VI : année d'entrée en vigueur (au 1er janvier) selon les lots principaux. */
export const ENTREE_EN_VIGUEUR_FONDS_TRAVAUX = [
  { lotsAuMoins: 201, annee: 2023 },
  { lotsAuMoins: 51, annee: 2024 },
  { lotsAuMoins: 0, annee: 2025 },
] as const

/**
 * J67, R86 et R87 — création du fonds de travaux légal : L. 1965 art. 14-2, rédaction issue de la loi n° 2014-366, art.
 * 58, en vigueur le 01/01/2017 (la rédaction du 01/01/2002 au 01/01/2017 ne parle d'aucun fonds). Avant : aucun fonds.
 */
export const CREATION_FONDS_TRAVAUX = composerDateIso(2017, 1, 1)

/** J67, R86 — ancien art. 14-2 (rédactions du 01/01/2017 au 01/01/2023) : fonds constitué cinq ans après la réception. */
export const ANNEES_AVANT_FONDS_ANCIEN_14_2 = 5

const entreeEnVigueur = (nbLots: number): string => {
  const palier = ENTREE_EN_VIGUEUR_FONDS_TRAVAUX.find((e) => nbLots >= e.lotsAuMoins) ?? ENTREE_EN_VIGUEUR_FONDS_TRAVAUX[2]
  return composerDateIso(palier.annee, 1, 1)
}
const PREMIERE_ENTREE = composerDateIso(ENTREE_EN_VIGUEUR_FONDS_TRAVAUX[0].annee, 1, 1)
const DERNIERE_ENTREE = composerDateIso(ENTREE_EN_VIGUEUR_FONDS_TRAVAUX[2].annee, 1, 1)
const plusTardive = (a: string, b: string): string => (a > b ? a : b)

/** Fondement cité pour une date antérieure à la création du fonds de travaux légal (J67, R86 et R87). */
export const FONDEMENT_CREATION_FONDS_TRAVAUX = `L. 1965 art. 14-2, rédaction issue de la loi n° 2014-366, art. 58 (fonds de travaux créé le ${dateIsoVersFr(CREATION_FONDS_TRAVAUX)})`
const FONDEMENT_ANCIEN_14_2 = `L. 1965 art. 14-2 (rédactions en vigueur du ${dateIsoVersFr(CREATION_FONDS_TRAVAUX)} au ${dateIsoVersFr(PREMIERE_ENTREE)})`

/**
 * J67, R86 — dispenses de l'ancien art. 14-2 : moins de dix lots, par décision unanime de l'assemblée ; diagnostic
 * technique global sans besoin de travaux dans les dix prochaines années. Elles ne valent plus depuis l'art. 14-2-1 (J4).
 */
export const DISPENSES_ANCIEN_14_2 = {
  moins_de_dix_lots_unanimite: { libelle: "moins de dix lots, par décision unanime de l'assemblée" },
  dtg_sans_besoin_de_travaux: { libelle: 'diagnostic technique global sans besoin de travaux dans les dix ans' },
} as const satisfies Record<string, { libelle: string }>
export type DispenseAncien14_2 = keyof typeof DISPENSES_ANCIEN_14_2

/**
 * J67, R86 — ancien art. 14-2, II : la dispense par décision unanime n'est ouverte qu'à l'immeuble de « moins de dix lots ».
 * Les lots principaux comptent parmi les lots de l'immeuble : à partir de ce nombre de lots principaux, elle est impossible.
 */
export const LOTS_FERMANT_DISPENSE_ANCIEN_14_2 = 10

export interface SaisieObligationFondsTravaux {
  /** Immeuble à destination totale ou partielle d'habitation ; null si non renseigné. */
  destinationHabitation: boolean | null
  /** Réception des travaux de construction de l'immeuble (AAAA-MM-JJ) ; null si inconnue. */
  dateReception: string | null
  /** Repli quand la réception est inconnue (Gestéam : fiche immeuble, onglet Techn., « Construction (année) »). */
  anneeConstruction?: number | null
  /** Lots à usage de logements, de bureaux ou de commerces (caves et parkings exclus) ; null si inconnu. */
  nbLotsPrincipaux: number | null
  /**
   * J67, R86 — dispense de l'ancien art. 14-2, avant l'entrée en vigueur de l'art. 14-2-1 ; « aucune » : pas de dispense ;
   * absente ou null : non renseignée (l'obligation de l'ancien régime vaut alors « sauf dispense », à confirmer).
   */
  dispenseAncien14_2?: DispenseAncien14_2 | 'aucune' | null
}

/** Régime du fonds à la date : aucun fonds légal, ancien art. 14-2, art. 14-2-1 ; null : à établir. */
export type RegimeFondsTravaux = 'aucun_fonds' | 'ancien_14_2' | 'art_14_2_1'

/** J67, R86 — alerte sur le passage de l'ancien art. 14-2 à l'art. 14-2-1. */
export interface AlerteObligationFondsTravaux {
  code: 'immeuble_moins_de_dix_ans'
  message: string
  fondement: string
}

export interface ObligationFondsTravaux {
  /** null : impossible à établir avec les données fournies. */
  obligatoire: boolean | null
  /** Date à partir de laquelle le fonds est obligatoire ; null si inconnue ou sans objet. */
  depuis: string | null
  aConfirmer: boolean
  motif: string
  fondements: string[]
  /** Régime du fonds à la date (J67, R86) ; null : à établir. */
  regime: RegimeFondsTravaux | null
  alertes: AlerteObligationFondsTravaux[]
}

/** Réception retenue : la date connue, ou le 31/12 de l'année de construction (supposée, à confirmer). */
interface ContexteObligation {
  date: string
  reception: string
  /** Mention à ajouter au motif quand la réception est supposée ; vide sinon. */
  receptionSupposee: string
  dispense: DispenseAncien14_2 | 'aucune' | null
}

const FONDEMENTS_REGIME: Record<RegimeFondsTravaux | 'a_etablir', string[]> = {
  aucun_fonds: [FONDEMENT_CREATION_FONDS_TRAVAUX],
  ancien_14_2: [FONDEMENT_ANCIEN_14_2, FONDEMENT_ENTREE_EN_VIGUEUR],
  art_14_2_1: [FONDEMENT_I, FONDEMENT_ENTREE_EN_VIGUEUR],
  a_etablir: [FONDEMENT_I, FONDEMENT_ENTREE_EN_VIGUEUR],
}

const reponse = (
  regime: RegimeFondsTravaux | null,
  champs: Pick<ObligationFondsTravaux, 'obligatoire' | 'depuis' | 'aConfirmer' | 'motif'>,
  alertes: AlerteObligationFondsTravaux[] = [],
): ObligationFondsTravaux => ({ ...champs, fondements: [...FONDEMENTS_REGIME[regime ?? 'a_etablir']], regime, alertes })

const estDispense = (ctx: ContexteObligation): boolean => ctx.dispense !== null && ctx.dispense !== 'aucune'
const finDixAns = (ctx: ContexteObligation): string => ajouterMois(ctx.reception, 12 * ANNEES_AVANT_FONDS_TRAVAUX)
const finCinqAns = (ctx: ContexteObligation): string => ajouterMois(ctx.reception, 12 * ANNEES_AVANT_FONDS_ANCIEN_14_2)
const SANS_DISPENSE = " Aucune dispense : celles de l'ancien art. 14-2 (moins de dix lots, DTG sans besoin de travaux) ont disparu."
/** Obligation de l'ancien art. 14-2 : cinq ans après la réception, au plus tôt à la création du fonds légal. */
const debutAncien14_2 = (ctx: ContexteObligation): string => plusTardive(CREATION_FONDS_TRAVAUX, finCinqAns(ctx))
const libelleDispense = (ctx: ContexteObligation): string => DISPENSES_ANCIEN_14_2[ctx.dispense as DispenseAncien14_2].libelle
/**
 * J67, R86 (b) — un fonds a pu être constitué sous l'ancien art. 14-2 : cinq ans atteints avant l'entrée en vigueur
 * `entree` de l'art. 14-2-1, sans dispense.
 */
const fondsAncienPossible = (ctx: ContexteObligation, entree: string): boolean => !estDispense(ctx) && finCinqAns(ctx) < entree
const CONTINUITE_FONDS_ANCIEN = " Le fonds constitué sous l'ancien art. 14-2 continue tel quel (mêmes parts par lot)."
const RENSEIGNER_LOTS = 'renseigner le nombre de lots à usage de logements, de bureaux ou de commerces'
const PLAGE_ENTREES = `entre le ${dateIsoVersFr(PREMIERE_ENTREE)} et le ${dateIsoVersFr(DERNIERE_ENTREE)}, selon le nombre de lots`

/**
 * J67, R86 (c) — immeuble de moins de dix ans à l'entrée en vigueur de l'art. 14-2-1 (`quand` : sa date, ou la plage selon
 * le nombre de lots) : le fonds de l'ancien régime reste ; la cotisation n'est obligatoire qu'à dix ans, le `depuis`.
 */
const alerteMoinsDeDixAns = (quand: string, depuis: string): AlerteObligationFondsTravaux => ({
  code: 'immeuble_moins_de_dix_ans',
  message: `Immeuble de moins de dix ans à l'entrée en vigueur de l'art. 14-2-1 (${quand}) : le fonds constitué sous l'ancien art. 14-2, s'il existe, reste au syndicat, tel quel (mêmes parts par lot), et ne sert qu'aux dépenses de l'art. 14-2-1, I ; la cotisation n'est obligatoire qu'à dix ans, le ${dateIsoVersFr(depuis)} (J67, R86).`,
  fondement: FONDEMENT_I_ET_III,
})

function verifierSaisieObligation(saisie: SaisieObligationFondsTravaux, date: string): void {
  if (!estDateIsoValide(date)) throw new Error(`Date invalide (${date}) : AAAA-MM-JJ attendu.`)
  const { dateReception, nbLotsPrincipaux } = saisie
  const anneeConstruction = saisie.anneeConstruction ?? null
  if (dateReception !== null && !estDateIsoValide(dateReception))
    throw new Error(`Date de réception invalide (${dateReception}) : AAAA-MM-JJ attendu.`)
  if (nbLotsPrincipaux !== null && (!Number.isInteger(nbLotsPrincipaux) || nbLotsPrincipaux < 0))
    throw new Error(`Nombre de lots invalide (${nbLotsPrincipaux}) : entier positif ou nul attendu.`)
  if (anneeConstruction !== null && (!Number.isInteger(anneeConstruction) || anneeConstruction < 1 || anneeConstruction > decomposerDateIso(date).a))
    throw new Error(`Année de construction invalide (${anneeConstruction}) : année entière, au plus celle de la date de contrôle.`)
  const dispense = saisie.dispenseAncien14_2 ?? null
  if (dispense !== null && dispense !== 'aucune' && !Object.hasOwn(DISPENSES_ANCIEN_14_2, dispense))
    throw new Error(`Dispense de l'ancien art. 14-2 inconnue : « ${dispense} ».`)
  if (dispense === 'moins_de_dix_lots_unanimite' && nbLotsPrincipaux !== null && nbLotsPrincipaux >= LOTS_FERMANT_DISPENSE_ANCIEN_14_2)
    throw new Error(
      `Dispense de l'ancien art. 14-2 « ${DISPENSES_ANCIEN_14_2.moins_de_dix_lots_unanimite.libelle} » impossible avec ${nbLotsPrincipaux} lots principaux : ils comptent parmi les lots de l'immeuble.`,
    )
}

/** Réception connue, ou supposée au 31/12 de l'année de construction ; null sans l'une ni l'autre. */
function contexteObligation(saisie: SaisieObligationFondsTravaux, date: string): ContexteObligation | null {
  const dispense = saisie.dispenseAncien14_2 ?? null
  if (saisie.dateReception !== null) return { date, reception: saisie.dateReception, receptionSupposee: '', dispense }
  const annee = saisie.anneeConstruction ?? null
  if (annee === null) return null
  return {
    date,
    reception: composerDateIso(annee, 12, 31),
    receptionSupposee: ` Réception supposée au plus tard le 31/12 de l'année de construction (${annee}) : à confirmer.`,
    dispense,
  }
}

/**
 * J67, R86 — avant l'entrée en vigueur `entree` de l'art. 14-2-1 : l'ancien art. 14-2. Fonds constitué cinq ans après la
 * réception (au plus tôt le 01/01/2017), sauf dispense ; obligation née après l'entrée en vigueur : le nouveau régime
 * (dix ans) en donne la date.
 */
function obligationAncien14_2(ctx: ContexteObligation, entree: string): ObligationFondsTravaux {
  const supposee = ctx.receptionSupposee !== ''
  const depuisNouveau = plusTardive(entree, finDixAns(ctx))
  const nouveau = `obligatoire le ${dateIsoVersFr(depuisNouveau)}, sous l'art. 14-2-1 (entrée en vigueur le ${dateIsoVersFr(entree)}, ${ANNEES_AVANT_FONDS_TRAVAUX} ans après la réception)`
  if (estDispense(ctx))
    return reponse('ancien_14_2', {
      obligatoire: false,
      depuis: depuisNouveau,
      aConfirmer: supposee,
      motif: `Aucun fonds obligatoire avant le ${dateIsoVersFr(entree)} : dispense de l'ancien art. 14-2 (${libelleDispense(ctx)}) ; ensuite, plus aucune dispense : ${nouveau}.${ctx.receptionSupposee}`,
    })
  const depuisAncien = debutAncien14_2(ctx)
  if (depuisAncien >= entree)
    return reponse('ancien_14_2', {
      obligatoire: false,
      depuis: depuisNouveau,
      aConfirmer: supposee,
      motif: `Fonds de travaux pas encore obligatoire : les cinq ans de l'ancien art. 14-2 (le ${dateIsoVersFr(depuisAncien)}) ne sont pas atteints avant l'entrée en vigueur de l'art. 14-2-1 ; ${nouveau}.${ctx.receptionSupposee}`,
    })
  const sansDispenseConnue = ctx.dispense === null
  const sauf = sansDispenseConnue ? ` ; sauf dispense (${Object.values(DISPENSES_ANCIEN_14_2).map((d) => d.libelle).join(' ; ')}) : à renseigner` : ''
  const regle = `sous l'ancien art. 14-2 (fonds constitué ${ANNEES_AVANT_FONDS_ANCIEN_14_2} ans après la réception, cotisation d'au moins 5 % du budget prévisionnel)`
  if (ctx.date >= depuisAncien)
    return reponse('ancien_14_2', {
      obligatoire: true,
      depuis: depuisAncien,
      aConfirmer: supposee || sansDispenseConnue,
      motif: `Fonds de travaux obligatoire depuis le ${dateIsoVersFr(depuisAncien)}, ${regle}${sauf}.${ctx.receptionSupposee}`,
    })
  return reponse('ancien_14_2', {
    obligatoire: false,
    depuis: depuisAncien,
    aConfirmer: supposee || sansDispenseConnue,
    motif: `Fonds de travaux pas encore obligatoire : il le sera le ${dateIsoVersFr(depuisAncien)}, ${regle}${sauf}.${ctx.receptionSupposee}`,
  })
}

/**
 * Depuis l'entrée en vigueur `entree` de l'art. 14-2-1 : fonds obligatoire dix ans après la réception. Un fonds a pu être
 * constitué sous l'ancien art. 14-2 (cinq ans atteints avant l'entrée en vigueur, sans dispense) : il continue tel quel ;
 * immeuble de moins de dix ans : alerte (J67, R86).
 */
function obligationArt14_2_1(ctx: ContexteObligation, entree: string): ObligationFondsTravaux {
  const fin = finDixAns(ctx)
  const depuis = plusTardive(entree, fin)
  const supposee = ctx.receptionSupposee !== ''
  const fondsAncien = fondsAncienPossible(ctx, entree)
  const detail = `le plus tardif entre l'entrée en vigueur (${dateIsoVersFr(entree)}) et la fin des ${ANNEES_AVANT_FONDS_TRAVAUX} ans après la réception (${dateIsoVersFr(fin)})`
  if (ctx.date >= depuis)
    return reponse('art_14_2_1', {
      obligatoire: true,
      depuis,
      aConfirmer: supposee,
      motif: `Fonds de travaux obligatoire depuis le ${dateIsoVersFr(depuis)} (${detail}).${SANS_DISPENSE}${fondsAncien ? CONTINUITE_FONDS_ANCIEN : ''}${ctx.receptionSupposee}`,
    })
  const alertes = fondsAncien ? [alerteMoinsDeDixAns(`le ${dateIsoVersFr(entree)}`, depuis)] : []
  return reponse(
    'art_14_2_1',
    {
      obligatoire: false,
      depuis,
      aConfirmer: supposee,
      motif: `Fonds de travaux pas encore obligatoire : il le sera le ${dateIsoVersFr(depuis)} (${detail}).${ctx.receptionSupposee}`,
    },
    alertes,
  )
}

/**
 * J67, R86 (a) — nombre de lots inconnu, avant le 01/01/2023 : l'ancien art. 14-2 s'applique, quel que soit ce nombre,
 * puisque l'art. 14-2-1 n'entre en vigueur qu'à partir de cette date. Cinq ans atteints avant le 01/01/2023, sans dispense :
 * la réponse ne dépend pas du nombre de lots. Sinon (dispense, ou cinq ans atteints le 01/01/2023 ou après), le fonds
 * n'est pas obligatoire à la date ; seule la date à laquelle il le deviendra dépend du nombre de lots.
 */
function obligationAncienLotsInconnus(ctx: ContexteObligation): ObligationFondsTravaux {
  const depuisAncien = debutAncien14_2(ctx)
  if (!estDispense(ctx) && depuisAncien < PREMIERE_ENTREE) return obligationAncien14_2(ctx, PREMIERE_ENTREE)
  const raison = estDispense(ctx)
    ? `dispense de l'ancien art. 14-2 (${libelleDispense(ctx)}), jusqu'à l'entrée en vigueur de l'art. 14-2-1`
    : `les cinq ans de l'ancien art. 14-2 ne sont atteints que le ${dateIsoVersFr(depuisAncien)}`
  return reponse('ancien_14_2', {
    obligatoire: false,
    depuis: null,
    aConfirmer: true,
    motif: `Fonds de travaux pas obligatoire au ${dateIsoVersFr(ctx.date)} : ${raison}. La date à laquelle il le deviendra dépend de l'entrée en vigueur de l'art. 14-2-1 (${PLAGE_ENTREES}) : ${RENSEIGNER_LOTS}.${ctx.receptionSupposee}`,
  })
}

/**
 * Nombre de lots inconnu : l'entrée en vigueur se situe entre le 01/01/2023 et le 01/01/2025. Cinq ans atteints avant le
 * 01/01/2023, sans dispense : un fonds a pu être constitué sous l'ancien art. 14-2, quel que soit ce nombre (J67, R86 :
 * continuité, alerte « immeuble de moins de dix ans »).
 */
function obligationLotsInconnus(ctx: ContexteObligation): ObligationFondsTravaux {
  if (ctx.date < PREMIERE_ENTREE) return obligationAncienLotsInconnus(ctx)
  const fin = finDixAns(ctx)
  const auPlusTard = plusTardive(DERNIERE_ENTREE, fin)
  const supposee = ctx.receptionSupposee !== ''
  const fondsAncien = fondsAncienPossible(ctx, PREMIERE_ENTREE)
  if (ctx.date >= auPlusTard) {
    const incertain = plusTardive(PREMIERE_ENTREE, fin) !== auPlusTard
    const lots = ' (nombre de lots à usage de logements, de bureaux ou de commerces non renseigné)'
    return reponse('art_14_2_1', {
      obligatoire: true,
      depuis: auPlusTard,
      aConfirmer: incertain || supposee,
      motif: `Fonds de travaux obligatoire ${incertain ? 'au plus tard ' : ''}depuis le ${dateIsoVersFr(auPlusTard)}${incertain ? lots : ''}.${SANS_DISPENSE}${fondsAncien ? CONTINUITE_FONDS_ANCIEN : ''}${ctx.receptionSupposee}`,
    })
  }
  if (ctx.date < DERNIERE_ENTREE)
    return reponse(null, {
      obligatoire: null,
      depuis: null,
      aConfirmer: true,
      motif: `Entre le ${dateIsoVersFr(PREMIERE_ENTREE)} et le ${dateIsoVersFr(DERNIERE_ENTREE)}, l'ancien art. 14-2 ou l'art. 14-2-1 s'applique selon le nombre de lots : ${RENSEIGNER_LOTS}.${ctx.receptionSupposee}`,
    })
  // Depuis le 01/01/2025, l'art. 14-2-1 est en vigueur quel que soit le nombre de lots, et les dix ans ne sont pas atteints.
  return reponse(
    'art_14_2_1',
    {
      obligatoire: false,
      depuis: fin,
      aConfirmer: supposee,
      motif: `Fonds de travaux pas encore obligatoire : il le sera le ${dateIsoVersFr(fin)}, ${ANNEES_AVANT_FONDS_TRAVAUX} ans après la réception.${ctx.receptionSupposee}`,
    },
    fondsAncien ? [alerteMoinsDeDixAns(PLAGE_ENTREES, fin)] : [],
  )
}

/** Le syndicat doit-il constituer un fonds de travaux à la date `date` ? Régime à la date et alertes (J67, R86). */
export function obligationFondsTravaux(saisie: SaisieObligationFondsTravaux, date: string): ObligationFondsTravaux {
  verifierSaisieObligation(saisie, date)
  // Avant le 01/01/2017, aucun fonds légal : la réponse ne dépend ni de la destination, ni de la réception (J67, R86 et R87).
  if (date < CREATION_FONDS_TRAVAUX)
    return reponse('aucun_fonds', {
      obligatoire: false,
      depuis: null,
      aConfirmer: false,
      motif: `Aucun fonds de travaux légal avant le ${dateIsoVersFr(CREATION_FONDS_TRAVAUX)} (J67, R86).`,
    })
  if (saisie.destinationHabitation === false)
    return reponse(null, { obligatoire: false, depuis: null, aConfirmer: false, motif: "Immeuble sans destination d'habitation : le fonds de travaux n'est pas obligatoire." })
  if (saisie.destinationHabitation === null)
    return reponse(null, {
      obligatoire: null,
      depuis: null,
      aConfirmer: true,
      motif: "Destination de l'immeuble à renseigner : le fonds n'est obligatoire que si l'immeuble est, même en partie, à usage d'habitation.",
    })
  const ctx = contexteObligation(saisie, date)
  if (ctx === null)
    return reponse(null, {
      obligatoire: null,
      depuis: null,
      aConfirmer: true,
      motif: `Date de réception des travaux de construction à renseigner : le fonds est obligatoire ${ANNEES_AVANT_FONDS_TRAVAUX} ans après.`,
    })
  if (saisie.nbLotsPrincipaux === null) return obligationLotsInconnus(ctx)
  const entree = entreeEnVigueur(saisie.nbLotsPrincipaux)
  return date < entree ? obligationAncien14_2(ctx, entree) : obligationArt14_2_1(ctx, entree)
}

// ─── Cotisation ──────────────────────────────────────────────────────────────────────────────────────────────────

/** Plan pluriannuel adopté dont le montant des travaux n'est pas renseigné : distinct de « aucun plan adopté » (null). */
export const PPT_INCONNU = 'inconnu' as const

export interface AssietteCotisationFondsTravaux {
  /** Budget prévisionnel voté (art. 14-1 : dépenses courantes, hors travaux). */
  budgetPrevisionnelCentimes: number
  /**
   * Montant total des travaux du plan adopté (toutes années) : la partie du plan pluriannuel que l'assemblée a adoptée,
   * toutes années confondues, jamais une tranche annuelle ; les travaux non adoptés n'y entrent pas (J67, R84 ; I, al.
   * 8). null : aucun plan adopté ; PPT_INCONNU : on ne sait pas (les résultats sont alors à confirmer).
   */
  totalTravauxPlanAdopteCentimes: number | null | typeof PPT_INCONNU
}

export interface CotisationMinimale {
  minimumCentimes: number
  cinqPourcentBudgetCentimes: number
  deuxEtDemiPourcentPptCentimes: number | null
  /** Plancher qui s'impose : 5 % du budget, ou 2,5 % des travaux du plan quand il est plus élevé. */
  retenu: 'budget' | 'ppt'
  /** Plan non renseigné : le plancher de 2,5 % n'a pas pu être pris en compte. */
  aConfirmer: boolean
  fondement: string
}

const montantPpt = (assiette: AssietteCotisationFondsTravaux): number | null =>
  typeof assiette.totalTravauxPlanAdopteCentimes === 'number' ? assiette.totalTravauxPlanAdopteCentimes : null
const pptInconnu = (assiette: AssietteCotisationFondsTravaux): boolean => assiette.totalTravauxPlanAdopteCentimes === PPT_INCONNU

const verifierAssiette = (assiette: AssietteCotisationFondsTravaux): void => {
  verifierCentimes(assiette.budgetPrevisionnelCentimes, false)
  const ppt = assiette.totalTravauxPlanAdopteCentimes
  if (ppt !== null && ppt !== PPT_INCONNU) verifierCentimes(ppt, false)
}

/** Cotisation annuelle minimale (I, al. 8), arrondie au centime supérieur. */
export function cotisationMinimaleFondsTravaux(assiette: AssietteCotisationFondsTravaux): CotisationMinimale {
  verifierAssiette(assiette)
  const cinqPourcentBudgetCentimes = diviserParExces(assiette.budgetPrevisionnelCentimes, 20)
  const ppt = montantPpt(assiette)
  const deuxEtDemiPourcentPptCentimes = ppt === null ? null : diviserParExces(ppt, 40)
  const retenu = deuxEtDemiPourcentPptCentimes !== null && deuxEtDemiPourcentPptCentimes > cinqPourcentBudgetCentimes ? 'ppt' : 'budget'
  return {
    minimumCentimes: retenu === 'ppt' ? (deuxEtDemiPourcentPptCentimes as number) : cinqPourcentBudgetCentimes,
    cinqPourcentBudgetCentimes,
    deuxEtDemiPourcentPptCentimes,
    retenu,
    aConfirmer: pptInconnu(assiette),
    fondement: FONDEMENT_I,
  }
}

/** Plancher qui s'impose, en clair. */
const libellePlancher = (minimum: CotisationMinimale): string =>
  minimum.retenu === 'ppt' ? '2,5 % des travaux du plan adopté' : '5 % du budget prévisionnel'

export interface CotisationDue {
  cotisationCentimes: number
  /** « minimum_de_plein_droit » : rien de voté, ou un montant inférieur au minimum ; « vote » : montant voté, au moins le minimum. */
  origine: 'minimum_de_plein_droit' | 'vote'
  minimum: CotisationMinimale
  motif: string
  fondement: string
  /** Plan pluriannuel non renseigné : le plancher de 2,5 % de ses travaux n'a pas pu être pris en compte (minimum.aConfirmer). */
  aConfirmer: boolean
}

/** Plan non renseigné : le plancher de 2,5 % reste à vérifier (cotisation due, contrôle de la cotisation votée). */
const PLANCHER_PPT_A_VERIFIER = "Plan pluriannuel de travaux non renseigné : s'il est adopté, la cotisation annuelle doit aussi atteindre 2,5 % de ses travaux."

/**
 * J67, R85 — cotisation annuelle due pour un exercice : le minimum s'applique de plein droit, sans vote (« ne peut être
 * inférieur à », I, al. 8 : 5 % du budget et, avec un plan adopté, 2,5 % de ses travaux) ; seul un montant supérieur se
 * vote (I, al. 9). `montantVoteCentimes` : le montant voté, ou null si rien n'est voté. Un montant voté inférieur au
 * minimum laisse le minimum dû (controlerCotisationFondsTravaux le signale).
 */
export function cotisationAnnuelleDue(assiette: AssietteCotisationFondsTravaux, montantVoteCentimes: number | null): CotisationDue {
  if (montantVoteCentimes !== null) verifierCentimes(montantVoteCentimes, false)
  const minimum = cotisationMinimaleFondsTravaux(assiette)
  const plancher = `${eur(minimum.minimumCentimes)} (${libellePlancher(minimum)})`
  const reserve = minimum.aConfirmer ? ` ${PLANCHER_PPT_A_VERIFIER}` : ''
  const commun = { minimum, fondement: FONDEMENT_I, aConfirmer: minimum.aConfirmer }
  if (montantVoteCentimes !== null && montantVoteCentimes >= minimum.minimumCentimes)
    return { ...commun, cotisationCentimes: montantVoteCentimes, origine: 'vote', motif: `Montant voté de ${eur(montantVoteCentimes)}, au moins égal au minimum légal de ${plancher}.${reserve}` }
  const motif =
    montantVoteCentimes === null
      ? `Aucun montant voté : le minimum légal de ${plancher} est dû de plein droit, sans vote.`
      : `Montant voté de ${eur(montantVoteCentimes)} inférieur au minimum légal : le minimum de ${plancher} reste dû, de plein droit, sans vote.`
  return { ...commun, cotisationCentimes: minimum.minimumCentimes, origine: 'minimum_de_plein_droit', motif: `${motif}${reserve}` }
}

const MAJORITES_DE_TOUS: readonly TypeMajorite[] = ['art25', 'art26', 'unanimite']

/**
 * J67, R85 — suspension des cotisations au fonds : votée par l'assemblée (II, à la majorité de l'art. 24) ou ordonnée par
 * le juge (art. 29-14, 1°, plan de sauvegarde).
 */
export interface SuspensionCotisationsFondsTravaux {
  origine: 'ag' | 'juge_29_14'
  /** Référence de la décision (résolution, ordonnance). */
  reference: string
  /** Premier jour de la suspension (AAAA-MM-JJ) : date de la décision, ou début de la période votée. */
  debut: string
  /** Dernier jour de la période votée ou ordonnée (AAAA-MM-JJ) ; absente ou null : sans période. */
  fin?: string | null
}

function verifierSuspension(suspension: SuspensionCotisationsFondsTravaux): void {
  if (!suspension.reference?.trim())
    throw new Error('Suspension des cotisations : référence de la décision (assemblée ou juge) attendue.')
  if (!estDateIsoValide(suspension.debut))
    throw new Error(`Suspension des cotisations : date de début invalide (${suspension.debut}), AAAA-MM-JJ attendu.`)
  const fin = suspension.fin ?? null
  if (fin !== null && !estDateIsoValide(fin)) throw new Error(`Suspension des cotisations : date de fin invalide (${fin}), AAAA-MM-JJ attendu.`)
  if (fin !== null && fin < suspension.debut)
    throw new Error(`Suspension des cotisations : fin (${dateIsoVersFr(fin)}) antérieure au début (${dateIsoVersFr(suspension.debut)}).`)
}

export interface DecisionCotisationFondsTravaux {
  cotisationAnnuelleCentimes: number
  /** Majorité à laquelle le montant a été voté ; absente ou null : non contrôlée. */
  majorite?: TypeMajorite | null
  /** Montant adopté au second vote de l'art. 25-1 (majorité de l'art. 24), le premier ayant réuni le tiers des voix. */
  secondVoteArt25_1?: boolean
  /** Suspension des cotisations : votée par l'assemblée (II) ou ordonnée par le juge (art. 29-14, 1°). */
  suspension?: SuspensionCotisationsFondsTravaux | null
  /** Solde du fonds à la date du vote de la suspension ; absent ou null : seuils à vérifier. */
  soldeFondsCentimes?: number | null
}

export type CodeAnomalieCotisation =
  | 'cotisation_sous_minimum'
  | 'plancher_ppt_a_verifier'
  | 'majorite_insuffisante'
  | 'suspension_hors_seuils'
  | 'suspension_seuils_a_verifier'

export interface AnomalieCotisationFondsTravaux {
  code: CodeAnomalieCotisation
  message: string
  fondement: string
  aConfirmer: boolean
}

/**
 * Seuils de suspension (II) : le fonds excède le budget prévisionnel et, avec un plan adopté, en outre la moitié de ses
 * travaux. null : on ne peut pas conclure (plan non renseigné alors que le budget est dépassé).
 */
const seuilsDeSuspensionAtteints = (solde: number, assiette: AssietteCotisationFondsTravaux): boolean | null => {
  if (solde <= assiette.budgetPrevisionnelCentimes) return false
  if (pptInconnu(assiette)) return null
  const ppt = montantPpt(assiette)
  return ppt === null || solde * 2 > ppt
}

const libelleSeuils = (assiette: AssietteCotisationFondsTravaux): string => {
  const ppt = montantPpt(assiette)
  const budget = `le budget prévisionnel (${eur(assiette.budgetPrevisionnelCentimes)})`
  if (pptInconnu(assiette)) return `${budget} et, si un plan pluriannuel est adopté, la moitié de ses travaux (plan non renseigné)`
  return ppt === null ? budget : `${budget} et la moitié des travaux du plan adopté (travaux : ${eur(ppt)})`
}

/**
 * Contrôle de la cotisation annuelle votée : plancher légal, majorité d'un montant supérieur, régularité d'une
 * suspension. Lève une erreur sur une saisie invalide ; renvoie les anomalies (vide si tout va bien).
 */
export function controlerCotisationFondsTravaux(
  decision: DecisionCotisationFondsTravaux,
  assiette: AssietteCotisationFondsTravaux,
): AnomalieCotisationFondsTravaux[] {
  verifierCentimes(decision.cotisationAnnuelleCentimes, false)
  const solde = decision.soldeFondsCentimes ?? null
  if (solde !== null) verifierCentimes(solde, false)
  const minimum = cotisationMinimaleFondsTravaux(assiette)

  const { suspension } = decision
  if (suspension) {
    verifierSuspension(suspension)
    if (suspension.origine === 'juge_29_14') return []
    const atteints = solde === null ? null : seuilsDeSuspensionAtteints(solde, assiette)
    if (atteints === true) return []
    if (atteints === null)
      return [
        {
          code: 'suspension_seuils_a_verifier',
          message: `Suspension votée par l'assemblée : vérifier qu'à la date du vote le fonds excédait ${libelleSeuils(assiette)}.`,
          fondement: FONDEMENT_II,
          aConfirmer: true,
        },
      ]
    return [
      {
        code: 'suspension_hors_seuils',
        message: `Suspension votée alors que le fonds (${eur(solde as number)}) n'excède pas ${libelleSeuils(assiette)} : hors de ces seuils, la cotisation annuelle reste due (lecture du texte à confirmer).`,
        fondement: FONDEMENT_II,
        aConfirmer: true,
      },
    ]
  }

  const anomalies: AnomalieCotisationFondsTravaux[] = []
  const cotisation = decision.cotisationAnnuelleCentimes
  const plancher = libellePlancher(minimum)
  if (cotisation < minimum.minimumCentimes)
    anomalies.push({
      code: 'cotisation_sous_minimum',
      message: `Cotisation annuelle de ${eur(cotisation)} inférieure au minimum légal de ${eur(minimum.minimumCentimes)} (${plancher}).`,
      fondement: FONDEMENT_I,
      aConfirmer: false,
    })
  else if (minimum.aConfirmer)
    anomalies.push({
      code: 'plancher_ppt_a_verifier',
      message: PLANCHER_PPT_A_VERIFIER,
      fondement: FONDEMENT_I,
      aConfirmer: true,
    })
  const majorite = decision.majorite ?? null
  const majoriteSuffisante =
    majorite === null || MAJORITES_DE_TOUS.includes(majorite) || (majorite === 'art24' && decision.secondVoteArt25_1 === true)
  if (cotisation > minimum.minimumCentimes && !majoriteSuffisante)
    anomalies.push({
      code: 'majorite_insuffisante',
      message: `Cotisation de ${eur(cotisation)}, supérieure au minimum de ${eur(minimum.minimumCentimes)} : elle se vote à la majorité des voix de tous les copropriétaires (art. 25), ou au second vote de l'art. 25-1.`,
      fondement: FONDEMENT_I,
      aConfirmer: minimum.aConfirmer,
    })
  return anomalies
}

export interface AlerteSuspensionFondsTravaux {
  code: 'ag_doit_se_prononcer_suspension'
  message: string
  fondement: string
  /** Plan non renseigné : le seuil des 50 % de ses travaux n'a pas pu être vérifié. */
  aConfirmer: boolean
}

/** Alerte quand l'assemblée doit se prononcer sur la suspension des cotisations (II) ; null sous les seuils. */
export function questionSuspensionFondsTravaux({
  soldeFondsCentimes,
  ...assiette
}: AssietteCotisationFondsTravaux & { soldeFondsCentimes: number }): AlerteSuspensionFondsTravaux | null {
  verifierCentimes(soldeFondsCentimes, false)
  verifierAssiette(assiette)
  const atteints = seuilsDeSuspensionAtteints(soldeFondsCentimes, assiette)
  if (atteints === false) return null
  return {
    code: 'ag_doit_se_prononcer_suspension',
    message: `Le fonds de travaux (${eur(soldeFondsCentimes)}) excède ${libelleSeuils(assiette)} : porter à l'ordre du jour de la prochaine assemblée la question de la suspension des cotisations. L'assemblée doit se prononcer ; la suspension n'est pas automatique.`,
    fondement: FONDEMENT_II,
    aConfirmer: atteints === null,
  }
}

/** J67, R85 — fin d'une suspension : les cotisations au fonds reprennent. */
export interface AlerteRepriseCotisations {
  code: 'reprise_des_cotisations'
  message: string
  fondement: string
}

export interface EtatSuspensionCotisations {
  /** La cotisation est suspendue à la date. */
  suspendue: boolean
  /** Dernier jour connu de la suspension (fin de la période ; veille de l'AG annuelle suivante) ; null s'il n'est pas connu. */
  jusquAu: string | null
  motif: string
  fondement: string
  /** Suspension terminée à la date : alerte « reprise des cotisations » ; null sinon. */
  alerte: AlerteRepriseCotisations | null
  aConfirmer: boolean
}

export interface ControleSuspensionCotisations {
  suspension: SuspensionCotisationsFondsTravaux
  /** Date du contrôle (AAAA-MM-JJ) : à chaque exercice, à son ouverture ou à l'appel de la cotisation. */
  date: string
  /** Suspension votée sans période : date de l'AG annuelle qui suit le vote ; absente ou null : pas encore connue. */
  dateAgAnnuelleSuivante?: string | null
  /** Solde du fonds à la date ; null : seuils du II à vérifier. */
  soldeFondsCentimes: number | null
  /** Budget prévisionnel et plan adopté de l'exercice contrôlé. */
  assiette: AssietteCotisationFondsTravaux
}

/** Dernier jour de la suspension, et ce qui le fixe : la période, ou l'AG annuelle suivante (votée sans période). */
function termeDeLaSuspension(
  suspension: SuspensionCotisationsFondsTravaux,
  agSuivante: string | null,
): { jusquAu: string | null; finPar: string } {
  const fin = suspension.fin ?? null
  const periode = suspension.origine === 'ag' ? 'la période votée' : 'la période fixée par l’ordonnance'
  if (fin !== null) return { jusquAu: fin, finPar: `${periode} a pris fin le ${dateIsoVersFr(fin)}` }
  if (suspension.origine === 'ag' && agSuivante !== null)
    return { jusquAu: ajouterJours(agSuivante, -1), finPar: `la suspension, votée sans période, a pris fin à l'assemblée générale annuelle du ${dateIsoVersFr(agSuivante)}` }
  return { jusquAu: null, finPar: '' }
}

function verifierControleSuspension({ suspension, date, dateAgAnnuelleSuivante, soldeFondsCentimes, assiette }: ControleSuspensionCotisations): void {
  if (!estDateIsoValide(date)) throw new Error(`Date du contrôle invalide (${date}) : AAAA-MM-JJ attendu.`)
  verifierSuspension(suspension)
  verifierAssiette(assiette)
  if (soldeFondsCentimes !== null) verifierCentimes(soldeFondsCentimes, false)
  const ag = dateAgAnnuelleSuivante ?? null
  if (ag !== null && (!estDateIsoValide(ag) || ag <= suspension.debut))
    throw new Error(
      `Suspension des cotisations : date de l'assemblée générale annuelle suivante invalide (${ag}) ; AAAA-MM-JJ, postérieure au début de la suspension, attendue.`,
    )
}

/**
 * J67, R85 — la suspension des cotisations s'applique-t-elle à `date` ? Elle commence à son début. Elle vaut pour la
 * période votée ou ordonnée ; votée sans période, jusqu'à l'AG annuelle suivante (exclue) ; ordonnée sans période, son
 * terme est à vérifier. Votée par l'assemblée, elle cesse en outre dès qu'une condition du II n'est plus remplie (le fonds
 * n'excède plus le budget prévisionnel et, avec un plan adopté, la moitié de ses travaux), contrôlée à chaque exercice ;
 * l'ordonnance (art. 29-14, 1°) n'y est pas soumise. Fin atteinte : alerte « reprise des cotisations ».
 */
export function etatSuspensionCotisationsFondsTravaux(controle: ControleSuspensionCotisations): EtatSuspensionCotisations {
  verifierControleSuspension(controle)
  const { suspension, date, soldeFondsCentimes, assiette } = controle
  const fondement = suspension.origine === 'ag' ? FONDEMENT_II : FONDEMENT_29_14_1
  const decision = `Suspension des cotisations ${suspension.origine === 'ag' ? "votée par l'assemblée" : 'ordonnée par le juge'} (${suspension.reference.trim()})`
  const { jusquAu, finPar } = termeDeLaSuspension(suspension, controle.dateAgAnnuelleSuivante ?? null)
  const reprise = (cause: string): EtatSuspensionCotisations => ({
    suspendue: false,
    jusquAu,
    motif: `${decision} : ${cause}.`,
    fondement,
    alerte: { code: 'reprise_des_cotisations', message: `Reprise des cotisations au fonds de travaux : ${cause} ; appeler la cotisation de l'exercice.`, fondement },
    aConfirmer: false,
  })
  if (date < suspension.debut)
    return { suspendue: false, jusquAu, motif: `${decision} : elle commence le ${dateIsoVersFr(suspension.debut)}.`, fondement, alerte: null, aConfirmer: false }
  if (jusquAu !== null && date > jusquAu) return reprise(finPar)
  const atteints = suspension.origine === 'ag' && soldeFondsCentimes !== null ? seuilsDeSuspensionAtteints(soldeFondsCentimes, assiette) : null
  if (atteints === false)
    return reprise(`le fonds (${eur(soldeFondsCentimes as number)}) n'excède plus ${libelleSeuils(assiette)} : une condition du II n'est plus remplie`)
  const aVerifier: string[] = []
  if (jusquAu === null)
    aVerifier.push(suspension.origine === 'ag' ? "date de l'assemblée générale annuelle suivante à renseigner" : "terme fixé par l'ordonnance à vérifier")
  if (suspension.origine === 'ag' && atteints === null) aVerifier.push(`seuils du II à vérifier (${libelleSeuils(assiette)})`)
  const jusqua = jusquAu === null ? '' : ` jusqu'au ${dateIsoVersFr(jusquAu)}`
  return {
    suspendue: true,
    jusquAu,
    motif: `${decision} : en cours${jusqua}${aVerifier.length > 0 ? ` ; ${aVerifier.join(' ; ')}` : ''}.`,
    fondement,
    alerte: null,
    aConfirmer: aVerifier.length > 0,
  }
}

const pgcd = (a: number, b: number): number => (b === 0 ? a : pgcd(b, a % b))

/**
 * Échéances « fonds_travaux » de la cotisation annuelle d'un exercice, selon les modalités des provisions du budget
 * (I, al. 6) : mêmes dates d'exigibilité, au prorata de chaque provision, sans centime perdu ni créé (plus forts restes ;
 * Gestéam arrondit chaque trimestre). La clé est fournie par l'appelant : celle des valeurs relatives des parties
 * privatives de l'art. 5 (art. 10, al. 2 : tantièmes généraux, ou spéciaux pour des parties communes spéciales) ;
 * Gestéam appelle le plus souvent sur la clé générale des provisions.
 */
export function echeancesCotisationFondsTravaux({
  coproprieteId,
  cleId,
  exercice,
  cotisationAnnuelleCentimes,
  provisions,
}: {
  coproprieteId: string
  cleId: string
  /** Libellé de l'exercice (« 2026 », « 2026 - 2027 »), repris dans l'identifiant et le libellé des échéances. */
  exercice: string
  cotisationAnnuelleCentimes: number
  provisions: { exigibilite: string; montantCentimes: number }[]
}): EcheanceAppel[] {
  verifierCentimes(cotisationAnnuelleCentimes, false)
  if (!exercice.trim()) throw new Error('Exercice attendu pour libeller les appels de cotisation.')
  if (provisions.length === 0)
    throw new Error('Aucune provision du budget : la cotisation au fonds de travaux s’appelle selon les mêmes modalités.')
  for (const p of provisions) {
    if (!estDateIsoValide(p.exigibilite)) throw new Error(`Date d'exigibilité invalide (${p.exigibilite}) : AAAA-MM-JJ attendu.`)
    verifierCentimes(p.montantCentimes, false)
  }
  const diviseur = provisions.reduce((d, p) => pgcd(d, p.montantCentimes), 0)
  if (diviseur === 0) throw new Error('Provisions du budget toutes nulles : impossible de répartir la cotisation au fonds de travaux.')
  if (cotisationAnnuelleCentimes === 0) return []
  const parts = repartirAuxPlusFortsRestes(
    cotisationAnnuelleCentimes,
    provisions.map((p) => p.montantCentimes / diviseur),
  )
  return provisions.map((p, i) => ({
    id: `FT-${exercice}-${i + 1}`,
    coproprieteId,
    cleId,
    exigibilite: p.exigibilite,
    libelle: `Fonds de travaux ${exercice} — appel n° ${i + 1}`,
    montantCentimes: parts[i],
    nature: 'fonds_travaux' as const,
    compteContrepartie: '10500',
  }))
}

// ─── « Montant bloqué » : règle de gestion ──────────────────────────────────────────────────────────────────────

/** Paramétrage de gestion du compte fonds travaux (reprise du « Montant bloqué € » de Gestéam). */
export interface ReglagesFondsTravaux {
  /** Plancher de gestion en centimes ; 0 = pas de plancher. Sens DÉDUIT (trésorerie minimale), aucune portée légale. */
  montantBloqueCentimes: number
}

export function creerReglagesFondsTravaux(saisie: Partial<ReglagesFondsTravaux>): ReglagesFondsTravaux {
  const montantBloqueCentimes = saisie.montantBloqueCentimes ?? 0
  verifierCentimes(montantBloqueCentimes, false)
  return { montantBloqueCentimes }
}

/** Alerte de GESTION : sans champ `fondement`, et son message ne cite aucun texte. */
export interface AlerteSeuilFondsTravaux {
  code: 'sous_montant_bloque'
  ecartCentimes: number
  message: string
}

/** Signale un solde du fonds de travaux passé sous le plancher fixé par le cabinet ; null sans plancher ou au-dessus. */
export function controlerSeuilFondsTravaux(
  soldeCentimes: number,
  reglages: ReglagesFondsTravaux,
): AlerteSeuilFondsTravaux | null {
  const { montantBloqueCentimes } = reglages
  if (montantBloqueCentimes === 0 || soldeCentimes >= montantBloqueCentimes) return null
  return {
    code: 'sous_montant_bloque',
    ecartCentimes: montantBloqueCentimes - soldeCentimes,
    message:
      "Solde du fonds de travaux sous le montant bloqué fixé par le cabinet. C'est un garde-fou de gestion interne, modifiable : aucun texte n'impose de solde minimum sur ce fonds.",
  }
}
