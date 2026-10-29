import { repartirAuxPlusFortsRestes } from '@/lib/administrateur-judiciaire/domain/arrondis'
import {
  ajouterMois,
  composerDateIso,
  dateIsoVersFr,
  decomposerDateIso,
  estDateIsoValide,
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
 * 🔵 Déduit du texte (non écrit en toutes lettres) :
 * - le syndic décide seul des travaux urgents (art. 18), pas de l'usage du fonds : aucune disposition ne lui permet d'y
 *   puiser sans décision d'affectation de l'assemblée ;
 * - pour une opération de travaux (travaux-operations.ts), la résolution qui vote les travaux et leur financement par le
 *   fonds vaut décision d'affectation, à défaut d'une décision d'affectation distincte ;
 * - les deux planchers d'une copropriété dotée d'un PPT jouent ensemble : le plus élevé s'impose ;
 * - un montant supérieur adopté au second vote de l'art. 25-1 (majorité de l'art. 24) est régulier ;
 * - hors des seuils du II, la cotisation reste due : une suspension votée en deçà est signalée, à confirmer ;
 * - seule l'année de construction connue : la réception est supposée faite au plus tard le 31/12 de cette année.
 *
 * 🔴 Non établi :
 * - assiette des 2,5 % : le texte dit « montant des travaux prévus dans le plan adopté », sans dire s'il s'agit du total
 *   du plan ou d'une tranche annuelle, ni ce qui vaut quand l'assemblée n'adopte qu'une partie du plan ; VitFix prend le
 *   montant des travaux adoptés, fourni par l'appelant. Plan non renseigné (« inconnu ») : seul le plancher de 5 % est
 *   contrôlé, et les résultats sont marqués à confirmer ;
 * - vote d'une cotisation fixée au minimum (de plein droit, ou vote art. 24) ; durée et reprise d'une suspension ;
 * - régime antérieur : avant l'entrée en vigueur applicable, l'ancien art. 14-2 (fonds cinq ans après la réception,
 *   dispenses) n'est pas modélisé, la réponse est « à établir » ; sort des fonds constitués sous ce régime (immeubles de
 *   cinq à dix ans, petites copropriétés dispensées) ;
 * - affectation par clé : le contrôle des parties communes spéciales attend la part du fonds par lot (point 20 du bilan).
 *
 * Gestéam — appels de type « Fonds travaux non remb. », compte 10500, sur la clé des provisions (le plus souvent la clé
 * générale), observés à 5 % du budget en quatre trimestres arrondis chacun au centime (tranche 43 § 23) ; aucun contrôle
 * du plancher ni de la suspension vu.
 * Champ « Montant bloqué € », onglet Réglages d'un compte de nature « Fonds travaux » (tranches 25 et 26) : sens DÉDUIT,
 * non observé, très probablement l'amélioration 5.4.20 « Fonds travaux : Trésorerie mini ». Dans VitFix : paramètre de
 * GESTION, modifiable, jamais présenté comme une règle légale.
 * 🔴 Non observé : l'effet de ce champ dans Gestéam (blocage à la saisie, simple alerte, ou affichage).
 */

const FONDEMENT_I = citerFondement(refLoi1965('14-2-1, I'))
const FONDEMENT_II = citerFondement(refLoi1965('14-2-1, II'))
const FONDEMENT_29_14 = citerFondement(refLoi1965('29-14'))
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
const OUVERTS_PAR_LE_JUGE: readonly ObjetDecaissementFondsTravaux[] = ['charges_courantes', 'frais_contentieux']

export interface DecaissementFondsTravaux {
  objet: ObjetDecaissementFondsTravaux
  montantCentimes: number
  /** Référence de la décision d'assemblée qui affecte le fonds à la dépense ; null si absente. */
  decisionAg: string | null
  /** Référence de l'ordonnance du juge (art. 29-14, 2°) ; exigée pour l'usage judiciaire du fonds. */
  autorisationJuge?: string | null
}

export type CauseAffectation = 'admis' | 'exclu' | 'decision_manquante' | 'autorisation_manquante'

export interface ResultatAffectation {
  autorise: boolean
  cause: CauseAffectation
  motif: string
  fondement: string
}

/**
 * Contrôle d'affectation (le droit) : un décaissement sur le fonds de travaux n'est admis que pour une dépense du I,
 * sur décision d'affectation de l'assemblée, ou pour l'usage judiciaire de l'art. 29-14, 2°, sur ordonnance du juge.
 * Lève une erreur sur une saisie invalide (montant, objet inconnu) ; renvoie un refus motivé sinon.
 */
export function controlerAffectationFondsTravaux(decaissement: DecaissementFondsTravaux): ResultatAffectation {
  verifierCentimes(decaissement.montantCentimes, true)
  if (!Object.hasOwn(AFFECTATION_FONDS_TRAVAUX, decaissement.objet))
    throw new Error(`Objet de décaissement inconnu : « ${decaissement.objet} ».`)
  const affectation: { libelle: string; admis: boolean; base: BaseAffectation | null } =
    AFFECTATION_FONDS_TRAVAUX[decaissement.objet]
  const resultat = (cause: CauseAffectation, motif: string, fondement = FONDEMENT_I): ResultatAffectation => ({
    autorise: cause === 'admis',
    cause,
    motif,
    fondement,
  })
  if (!affectation.admis) {
    let motif = `${affectation.libelle} : dépense exclue du fonds de travaux, réservé aux dépenses de l'art. 14-2-1, I (1° à 4°). À imputer sur un autre compte.`
    if (decaissement.objet === 'travaux_amelioration')
      motif += ' Ils ne peuvent être financés par le fonds que s’ils figurent au plan pluriannuel de travaux adopté (2°).'
    if (OUVERTS_PAR_LE_JUGE.includes(decaissement.objet))
      motif += ' En administration provisoire, seul le juge peut ouvrir cet usage (art. 29-14, 2° : redressement ou gestion courante).'
    return resultat('exclu', motif)
  }
  if (affectation.base === 'autorisation_juge') {
    if (!decaissement.autorisationJuge?.trim())
      return resultat(
        'autorisation_manquante',
        `${affectation.libelle} : rattacher l'ordonnance du juge qui autorise l'administrateur provisoire à utiliser le fonds.`,
        FONDEMENT_29_14,
      )
    return resultat('admis', `${affectation.libelle} : usage autorisé par le juge.`, FONDEMENT_29_14)
  }
  if (!decaissement.decisionAg?.trim()) {
    let motif = `${affectation.libelle} : rattacher la décision d'assemblée qui affecte le fonds à cette dépense (à la même majorité que la dépense) avant de décaisser.`
    if (decaissement.objet === 'travaux_urgents') motif += ' Le syndic décide seul des travaux urgents, pas de l’usage du fonds.'
    return resultat('decision_manquante', motif)
  }
  return resultat('admis', `${affectation.libelle} : affectation admise.`)
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

const entreeEnVigueur = (nbLots: number): string => {
  const palier = ENTREE_EN_VIGUEUR_FONDS_TRAVAUX.find((e) => nbLots >= e.lotsAuMoins) ?? ENTREE_EN_VIGUEUR_FONDS_TRAVAUX[2]
  return composerDateIso(palier.annee, 1, 1)
}
const PREMIERE_ENTREE = composerDateIso(ENTREE_EN_VIGUEUR_FONDS_TRAVAUX[0].annee, 1, 1)
const DERNIERE_ENTREE = composerDateIso(ENTREE_EN_VIGUEUR_FONDS_TRAVAUX[2].annee, 1, 1)
const plusTardive = (a: string, b: string): string => (a > b ? a : b)

export interface SaisieObligationFondsTravaux {
  /** Immeuble à destination totale ou partielle d'habitation ; null si non renseigné. */
  destinationHabitation: boolean | null
  /** Réception des travaux de construction de l'immeuble (AAAA-MM-JJ) ; null si inconnue. */
  dateReception: string | null
  /** Repli quand la réception est inconnue (Gestéam : fiche immeuble, onglet Techn., « Construction (année) »). */
  anneeConstruction?: number | null
  /** Lots à usage de logements, de bureaux ou de commerces (caves et parkings exclus) ; null si inconnu. */
  nbLotsPrincipaux: number | null
}

export interface ObligationFondsTravaux {
  /** null : impossible à établir avec les données fournies. */
  obligatoire: boolean | null
  /** Date à partir de laquelle le fonds est obligatoire ; null si inconnue ou sans objet. */
  depuis: string | null
  aConfirmer: boolean
  motif: string
  fondements: string[]
}

/** Le syndicat doit-il constituer un fonds de travaux à la date `date` ? */
export function obligationFondsTravaux(saisie: SaisieObligationFondsTravaux, date: string): ObligationFondsTravaux {
  if (!estDateIsoValide(date)) throw new Error(`Date invalide (${date}) : AAAA-MM-JJ attendu.`)
  const { destinationHabitation, dateReception, nbLotsPrincipaux } = saisie
  const anneeConstruction = saisie.anneeConstruction ?? null
  if (dateReception !== null && !estDateIsoValide(dateReception))
    throw new Error(`Date de réception invalide (${dateReception}) : AAAA-MM-JJ attendu.`)
  if (nbLotsPrincipaux !== null && (!Number.isInteger(nbLotsPrincipaux) || nbLotsPrincipaux < 0))
    throw new Error(`Nombre de lots invalide (${nbLotsPrincipaux}) : entier positif ou nul attendu.`)
  if (anneeConstruction !== null && (!Number.isInteger(anneeConstruction) || anneeConstruction < 1 || anneeConstruction > decomposerDateIso(date).a))
    throw new Error(`Année de construction invalide (${anneeConstruction}) : année entière, au plus celle de la date de contrôle.`)
  const fondements = [FONDEMENT_I, FONDEMENT_ENTREE_EN_VIGUEUR]
  const reponse = (obligatoire: boolean | null, depuis: string | null, aConfirmer: boolean, motif: string) => ({
    obligatoire,
    depuis,
    aConfirmer,
    motif,
    fondements,
  })

  if (destinationHabitation === false)
    return reponse(false, null, false, "Immeuble sans destination d'habitation : le fonds de travaux n'est pas obligatoire.")
  if (destinationHabitation === null)
    return reponse(
      null,
      null,
      true,
      "Destination de l'immeuble à renseigner : le fonds n'est obligatoire que si l'immeuble est, même en partie, à usage d'habitation.",
    )

  let reception: string
  let receptionSupposee = ''
  if (dateReception !== null) reception = dateReception
  else if (anneeConstruction !== null) {
    reception = composerDateIso(anneeConstruction, 12, 31)
    receptionSupposee = ` Réception supposée au plus tard le 31/12 de l'année de construction (${anneeConstruction}) : à confirmer.`
  } else
    return reponse(
      null,
      null,
      true,
      `Date de réception des travaux de construction à renseigner : le fonds est obligatoire ${ANNEES_AVANT_FONDS_TRAVAUX} ans après.`,
    )
  const finDelai = ajouterMois(reception, 12 * ANNEES_AVANT_FONDS_TRAVAUX)
  const supposee = receptionSupposee !== ''
  const sansDispense = " Aucune dispense : celles de l'ancien art. 14-2 (moins de dix lots, DTG sans besoin de travaux) ont disparu."
  const regimeAnterieur = (entree: string) =>
    reponse(
      null,
      null,
      true,
      `Avant le ${dateIsoVersFr(entree)}, l'ancien art. 14-2 s'appliquait (fonds cinq ans après la réception, dispenses) : régime non modélisé, à établir.${receptionSupposee}`,
    )

  if (nbLotsPrincipaux === null) {
    const auPlusTard = plusTardive(DERNIERE_ENTREE, finDelai)
    const incertain = plusTardive(PREMIERE_ENTREE, finDelai) !== auPlusTard
    const lots = ' (nombre de lots à usage de logements, de bureaux ou de commerces non renseigné)'
    if (date >= auPlusTard)
      return reponse(
        true,
        auPlusTard,
        incertain || supposee,
        `Fonds de travaux obligatoire ${incertain ? 'au plus tard ' : ''}depuis le ${dateIsoVersFr(auPlusTard)}${incertain ? lots : ''}.${sansDispense}${receptionSupposee}`,
      )
    if (date < DERNIERE_ENTREE) return regimeAnterieur(DERNIERE_ENTREE)
    return reponse(
      false,
      finDelai,
      supposee,
      `Fonds de travaux pas encore obligatoire : il le sera le ${dateIsoVersFr(finDelai)}, ${ANNEES_AVANT_FONDS_TRAVAUX} ans après la réception.${receptionSupposee}`,
    )
  }

  const entree = entreeEnVigueur(nbLotsPrincipaux)
  if (date < entree) return regimeAnterieur(entree)
  const depuis = plusTardive(entree, finDelai)
  const detail = `le plus tardif entre l'entrée en vigueur pour ${nbLotsPrincipaux} lots (${dateIsoVersFr(entree)}) et la fin des ${ANNEES_AVANT_FONDS_TRAVAUX} ans après la réception (${dateIsoVersFr(finDelai)})`
  if (date >= depuis)
    return reponse(true, depuis, supposee, `Fonds de travaux obligatoire depuis le ${dateIsoVersFr(depuis)} (${detail}).${sansDispense}${receptionSupposee}`)
  /** Fonds déjà dû sous l'ancien art. 14-2 (cinq ans après la réception) au jour de l'entrée en vigueur : transition non établie. */
  const transition = ajouterMois(reception, 12 * 5) <= entree
  return reponse(
    false,
    depuis,
    supposee || transition,
    `Fonds de travaux pas encore obligatoire : il le sera le ${dateIsoVersFr(depuis)} (${detail}).${
      transition ? " Un fonds a pu être constitué sous l'ancien art. 14-2 (cinq ans après la réception) : son sort transitoire n'est pas établi." : ''
    }${receptionSupposee}`,
  )
}

// ─── Cotisation ──────────────────────────────────────────────────────────────────────────────────────────────────

/** Plan pluriannuel adopté dont le montant des travaux n'est pas renseigné : distinct de « aucun plan adopté » (null). */
export const PPT_INCONNU = 'inconnu' as const

export interface AssietteCotisationFondsTravaux {
  /** Budget prévisionnel voté (art. 14-1 : dépenses courantes, hors travaux). */
  budgetPrevisionnelCentimes: number
  /**
   * Montant des travaux prévus dans le plan pluriannuel adopté ; null : aucun plan adopté ; PPT_INCONNU : on ne sait pas
   * (les résultats sont alors à confirmer). 🔴 Assiette : voir l'en-tête.
   */
  travauxPptAdopteCentimes: number | null | typeof PPT_INCONNU
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
  typeof assiette.travauxPptAdopteCentimes === 'number' ? assiette.travauxPptAdopteCentimes : null
const pptInconnu = (assiette: AssietteCotisationFondsTravaux): boolean => assiette.travauxPptAdopteCentimes === PPT_INCONNU

const verifierAssiette = (assiette: AssietteCotisationFondsTravaux): void => {
  verifierCentimes(assiette.budgetPrevisionnelCentimes, false)
  const ppt = assiette.travauxPptAdopteCentimes
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

const MAJORITES_DE_TOUS: readonly TypeMajorite[] = ['art25', 'art26', 'unanimite']

export interface DecisionCotisationFondsTravaux {
  cotisationAnnuelleCentimes: number
  /** Majorité à laquelle le montant a été voté ; absente ou null : non contrôlée. */
  majorite?: TypeMajorite | null
  /** Montant adopté au second vote de l'art. 25-1 (majorité de l'art. 24), le premier ayant réuni le tiers des voix. */
  secondVoteArt25_1?: boolean
  /** Suspension des cotisations : votée par l'assemblée (II) ou ordonnée par le juge (art. 29-14, 1°). */
  suspension?: { origine: 'ag' | 'juge_29_14'; reference: string } | null
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
    if (!suspension.reference?.trim())
      throw new Error('Suspension des cotisations : référence de la décision (assemblée ou juge) attendue.')
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
  const plancher = minimum.retenu === 'ppt' ? '2,5 % des travaux du plan adopté' : '5 % du budget prévisionnel'
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
      message: `Plan pluriannuel de travaux non renseigné : s'il est adopté, la cotisation annuelle doit aussi atteindre 2,5 % de ses travaux.`,
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
