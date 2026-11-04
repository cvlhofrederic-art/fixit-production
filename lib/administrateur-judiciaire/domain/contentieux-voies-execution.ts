import {
  ajouterMois,
  dateIsoVersFr,
  estDateIsoValide,
  messagePlausibilite,
  plausibiliteDate,
  verifierAujourdhui,
  type PlausibiliteDate,
} from '@/lib/administrateur-judiciaire/domain/dates'
import type { PouvoirsAgConfies } from '@/lib/administrateur-judiciaire/domain/decisions-annuelles-ag'
import type { Regime } from '@/lib/administrateur-judiciaire/domain/fondements'
import { LIBELLES_ETATS_RESOLUTION, type Resolution } from '@/lib/administrateur-judiciaire/domain/resolutions-ag'

/**
 * Voies d'exécution, hypothèque, mise à prix et décision liée d'un contentieux (point 56 du bilan Gestéam). Fonctions
 * pures, dates ISO (AAAA-MM-JJ), montants en CENTIMES ENTIERS, sans écran ni table : le contentieux n'est pas persisté
 * (aucune table des contentieux) ; l'assemblée et la résolution liées sont lues par l'appelant (tables `ags` et
 * `resolutions`, inchangées). Le dossier est typé par sa structure : ce module n'importe pas contentieux.ts, qui l'importe.
 *
 * Gestéam — 🟢 lu :
 * - tranche 42, fiche contentieux réelle, onglet Règlements : bloc Hypothèque (Date, Montant, « Mise à prix par l'AG
 *   (€) ») ; bloc Voie d'exécution (case Saisie immobilière avec Engagée le, Audience éventuelle et Adjudication ; cases
 *   Saisie mobilière, Saisie attribution, Saisie arrêt salaire, Saisie arrêt loyer et Échéancier ; Expulsion, date) ;
 *   listes Assemblée et Résolution, qui rattachent le dossier à la décision d'AG qui l'autorise. Le montant des sommes
 *   estimées définitivement perdues manque dans Gestéam ;
 * - tranche 31, onglet Projet : le point d'ordre du jour porte « Dossier (2 listes) », type et fiche. Le lien existe dans
 *   les deux sens : une seule relation { agId, resolutionId } suffit ;
 * - tranche 28 : fiche (Date, N°, Type, Statut, Objet, Phase, Clos le, Mandat, Débiteur et Lots, Montant demandé, Mise en
 *   demeure) ; la phase la plus avancée avant la clôture est « Exécution en cours » ;
 * - tranche 43 : § 22, famille Contentieux, modèles « SI » (avocat transmission dossier, CARPA quittance distribution du
 *   prix de vente, résolution PV AG) ; § 15, nature de demande « Huissier - exécution forcée » ; § 19, « Procuration
 *   main-levée hypothèque ».
 *
 * Le droit — 🟢 lu sur Légifrance le 30/10/2026 (versions en vigueur à cette date) :
 * - D. 1967 art. 55, al. 1 : le syndic n'agit en justice au nom du syndicat qu'autorisé par une décision de l'AG ; al. 3 :
 *   pas d'autorisation pour le recouvrement de créance, la mise en œuvre des voies d'exécution forcée « à l'exception de
 *   la saisie en vue de la vente d'un lot », les mesures conservatoires, le référé et la défense ; al. 2 : seuls les
 *   copropriétaires peuvent se prévaloir de l'absence d'autorisation ; al. 4 : le syndic rend compte à la prochaine AG des
 *   actions introduites ;
 * - D. 1967 art. 11, I, 11° : pour la validité de la décision, le projet de résolution, notifié au plus tard avec l'ordre
 *   du jour, mentionne la saisie immobilière du lot, le montant de la mise à prix et le montant des sommes estimées
 *   définitivement perdues ;
 * - L. 1965 art. 19 : hypothèque légale du syndicat, inscrite après une mise en demeure restée infructueuse ou dès que le
 *   copropriétaire invoque l'art. 33 (al. 1), par le syndic sans autorisation préalable de l'AG (al. 2) ; aucune
 *   inscription pour des créances exigibles depuis plus de cinq ans (al. 4) ; privilège sur les meubles garnissant les
 *   lieux et sur les sommes dues par le locataire à son bailleur (al. 5) ;
 * - L. 1965 art. 19-2 : la saisie d'une créance à exécution successive (loyer) se poursuit jusqu'à l'extinction de la
 *   créance du syndicat (al. 4) ; au vote qui autorise la saisie en vue de la vente de son lot, la voix du copropriétaire
 *   débiteur n'est pas comptée et il ne peut recevoir mandat (al. 5) ;
 * - CPCE art. L. 322-6 : la mise à prix est fixée par le créancier poursuivant ; le débiteur peut faire fixer par le juge
 *   une autre mise à prix en cas d'insuffisance manifeste ; à défaut d'enchère, le poursuivant est déclaré adjudicataire
 *   d'office à ce montant. R. 322-41 : garantie de l'enchérisseur, 10 % de la mise à prix, au moins 3 000 €. L. 322-13 :
 *   le jugement d'adjudication est un titre d'expulsion contre le saisi. L. 411-1 : l'expulsion exige une décision de
 *   justice ou un procès-verbal de conciliation exécutoire, et un commandement de libérer les locaux ;
 * - CPCE art. L. 211-1 (saisie-attribution) et L. 212-1 et suivants (saisie des rémunérations, dans le code depuis le
 *   01/07/2025) : « Saisie arrêt salaire » et « Saisie arrêt loyer » sont l'ancienne terminologie ;
 * - L. 1965 art. 29-1, I, al. 2 : l'administrateur provisoire reçoit tous les pouvoirs du syndic et tout ou partie des
 *   pouvoirs de l'AG (sauf art. 26 a et b) ; l'AG garde ceux qui ne sont pas compris dans sa mission ; D. 1967 art.
 *   62-8 : ses décisions sont portées à leur date au registre.
 *
 * Le droit — 🟢 lu dans la base juridique du cabinet (versions en vigueur) le 30/10/2026 :
 * - D. 1967 art. 62-7 (décret 2019-966, en vigueur depuis le 01/01/2020) : investi de tout ou partie des pouvoirs de
 *   l'AG, l'administrateur provisoire recueille, sauf urgence, l'avis du conseil syndical avant de prendre à ce titre ses
 *   décisions (al. 1) ; il peut convoquer les copropriétaires pour les informer et les entendre (al. 2) ; à ces occasions,
 *   il précise le mode de financement des décisions envisagées (al. 3) ;
 * - CPCE art. L. 311-2 : la saisie immobilière est ouverte au créancier muni d'un titre exécutoire constatant une
 *   créance liquide et exigible. CPCE art. R. 321-3, 2° (relevé de la relecture, recoupé par le BOFiP ; non relu sur
 *   Légifrance) : le commandement valant saisie indique la date et la nature de ce titre ;
 * - L. 1965 art. 19, al. 1 : aucun délai entre la mise en demeure et l'inscription de l'hypothèque.
 *
 * 🔵 Déduit :
 * - la saisie immobilière est ENGAGÉE dès qu'une de ses dates (Engagée le, Audience éventuelle, Adjudication) est saisie ;
 *   cochée sans date, elle se prépare (projet de résolution) et n'exige encore rien ; son PREMIER ACTE est la date la
 *   plus ancienne des trois, nommée par le libellé de son champ ;
 * - REFUS STRUCTUREL à la création du dossier (contentieux.creerDossierContentieux → exigerAutorisationVente) : une saisie
 *   immobilière engagée sans décision liée (résolution d'AG, ou décision de l'administrateur provisoire) ou sans les deux
 *   montants est refusée. Les quatre autres saisies, l'expulsion et l'hypothèque n'exigent rien (art. 55, al. 3 ; L. 1965
 *   art. 19, al. 2) ;
 * - CONTRÔLE DE FOND (controlerAutorisationSaisieVente, sur le modèle de fonds-travaux.controlerAffectationFondsTravaux) :
 *   décision prise au plus tard le jour du premier acte de la saisie ; résolution adoptée, assemblée de la même
 *   copropriété ; décision de l'administrateur provisoire, datée comme au registre (art. 62-8), admise seulement sous le
 *   régime de l'art. 29-1, selon les pouvoirs de l'AG que l'ordonnance lui confie (même lecture que
 *   decisions-annuelles-ag.ts) ; le régime et les pouvoirs confiés sont ceux en vigueur à la date de la décision ; une
 *   résolution votée alors que l'ordonnance confie tous les pouvoirs de l'AG à l'administrateur provisoire est refusée :
 *   l'AG ne les a plus (art. 29-1, I, al. 2). Le refus est un garde-fou de gestion, pas une nullité constatée au profit
 *   du débiteur (art. 55, al. 2) ;
 * - la décision admise de l'administrateur provisoire rappelle l'art. 62-7 (avis du conseil syndical sauf urgence, mode
 *   de financement) : aucune donnée ne permet de le contrôler ;
 * - le titre exécutoire de la saisie immobilière et de l'expulsion se lit sur les jalons Jugement et Ordonnance du même
 *   dossier (et l'adjudication pour l'expulsion) : un titre venu d'un autre dossier reste possible, d'où un signalement à
 *   confirmer ;
 * - la mise en demeure précède l'inscription de l'hypothèque d'au moins un jour : datée du jour même, elle n'a pu
 *   « rester infructueuse » ; VitFix n'impose pas d'autre délai ;
 * - cinq ans de l'art. 19, al. 4 comptés de date à date depuis l'exigibilité ; sans quantième identique (29 février), le
 *   dernier jour du mois (dates.ajouterMois) ;
 * - la mise à prix et les sommes estimées définitivement perdues sont des DONNÉES saisies, telles que votées (aucun texte
 *   n'en fixe le calcul). Gestéam range la mise à prix dans le bloc Hypothèque ; VitFix la range avec les sommes perdues
 *   (`venteLot`), parce que le même projet de résolution porte les deux ;
 * - une saisie cochée, une saisie immobilière engagée ou une expulsion datée met le dossier « Exécution en cours »
 *   (executionEngagee) ; l'hypothèque est une sûreté, pas une exécution ; la case « Échéancier » est conservée sans effet
 *   (question posée dans contentieux.ts) ; « Saisie mobilière » désigne la saisie-vente (article non relu) ;
 * - la désignation d'un administrateur provisoire arrête les exécutions des créanciers DU syndicat (L. 1965 art. 29-3, I,
 *   al. 3), pas celles du syndicat contre un copropriétaire : elle ne bloque pas la saisie ;
 * - garantie de l'enchérisseur arrondie au centime supérieur (le texte ne dit rien de l'arrondi).
 *
 * 🔴 Non établi — questions exactes :
 * 1. (Frédéric ou Hugo) La décision qui autorise la saisie en vue de la vente se prend-elle à la majorité de l'art. 24
 *    (règle par défaut, L. 1965 art. 24, I : aucun texte spécial lu) ou de l'art. 25 ? Une résolution soumise à l'art. 24
 *    est admise, à confirmer (`aConfirmer`).
 * 2. (Frédéric) L'administrateur provisoire de l'art. 29-1 investi des pouvoirs de l'AG décide de la saisie sans vote de
 *    l'assemblée, après avis du conseil syndical sauf urgence (D. 1967 art. 62-7, al. 1 ; 🔵) : sa décision inscrite au
 *    registre doit-elle porter la mise à prix et les sommes estimées définitivement perdues, alors que l'art. 11, I, 11°
 *    vise les projets notifiés avec l'ordre du jour d'une AG ? VitFix exige les deux montants dans les deux cas.
 * 3. (Hugo) Dans Gestéam, la « Mise à prix par l'AG » du bloc Hypothèque se saisit-elle sans que la case Saisie
 *    immobilière soit cochée ? L'Assemblée et la Résolution du dossier servent-elles aussi à autoriser une action hors
 *    recouvrement (art. 55, al. 1) ?
 * 4. (Frédéric) Quel plafond appliquer au montant de l'hypothèque : les cinq ans de l'art. 19, al. 4, ou l'année courante
 *    et les quatre dernières années échues de C. civ. art. 2402, 3° (visé par l'art. 19-1) ? VitFix n'applique que l'al. 4
 *    (postesHorsInscriptionHypotheque).
 * 5. (Hugo) Audience éventuelle, Adjudication et Expulsion : dates fixées à l'avance ou constats ? « Audience éventuelle »
 *    est-elle l'audience d'orientation (CPCE R. 322-15) ? « Engagée le » est-elle la signification du commandement de
 *    payer valant saisie (R. 321-1) ? VitFix admet une audience et une adjudication futures, pas une expulsion.
 * 6. (Frédéric) Une mise à prix ou des sommes perdues égales à 0 € sont-elles admises ? VitFix accepte un montant ≥ 0.
 * 7. (Frédéric) Faut-il un second champ pour la mise à prix fixée par le juge (CPCE L. 322-6, al. 2), distincte de la
 *    mise à prix initiale votée ? VitFix n'en garde qu'une.
 * 8. (Frédéric) Libellés : ceux de Gestéam (« Saisie arrêt salaire », « Saisie arrêt loyer ») ou ceux du code (saisie des
 *    rémunérations, saisie-attribution) ? VitFix garde ceux de Gestéam et donne la désignation du code.
 *
 * Branchements à faire plus tard (fichiers d'autres PR, écran) : suivi « à faire » (audience d'adjudication à venir,
 * saisie en vue de la vente non autorisée ; NATURES_SUIVI.contentieux est figé) ; compte rendu à la prochaine AG des
 * actions introduites (art. 55, al. 4) ; décompte des voix sans le débiteur (art. 19-2, al. 5, module AG) ; notification
 * du projet avec l'ordre du jour (art. 11, I) ; reglementsSurContentieux par le compteId du dossier ; registre des
 * décisions de l'administrateur provisoire (art. 62-8 : référence et date) et avis du conseil syndical (art. 62-7) ; table
 * des contentieux et onglet Règlements (Frédéric).
 */

// ─── Référentiel des saisies (tenu à part du point 29) ─────────────────────────────────────────────────────────────

/** Cases de saisie du bloc Voie d'exécution (tranche 42), avec la désignation et l'article du code quand ils sont lus. */
export const SAISIES_EXECUTION = [
  { cle: 'mobiliere', libelle: 'Saisie mobilière', designationCode: 'Saisie-vente', fondement: null },
  { cle: 'attribution', libelle: 'Saisie attribution', designationCode: 'Saisie-attribution', fondement: 'CPCE art. L. 211-1' },
  {
    cle: 'arretSalaire',
    libelle: 'Saisie arrêt salaire',
    designationCode: 'Saisie des rémunérations',
    fondement: 'CPCE art. L. 212-1 et suivants',
  },
  {
    cle: 'arretLoyer',
    libelle: 'Saisie arrêt loyer',
    designationCode: 'Saisie-attribution des loyers dus au copropriétaire',
    fondement: 'CPCE art. L. 211-1 ; L. 1965 art. 19, al. 5 et 19-2, al. 4',
  },
] as const
export type SaisieExecution = (typeof SAISIES_EXECUTION)[number]['cle']

const CLES_SAISIES: ReadonlySet<string> = new Set(SAISIES_EXECUTION.map((s) => s.cle))

// ─── Types ───────────────────────────────────────────────────────────────────────────────────────────────────────

export interface SaisieImmobiliere {
  /** « Engagée le ». */
  engageeLe: string | null
  /** « Audience éventuelle ». */
  audienceLe: string | null
  /** « Adjudication ». */
  adjudicationLe: string | null
}

export interface HypothequeContentieux {
  /** « Date » du bloc Hypothèque : inscription. */
  inscriteLe: string | null
  /** « Montant » garanti. */
  montantCentimes: number | null
}

/** Montants du projet de résolution qui autorise la saisie immobilière (D. 1967 art. 11, I, 11°). */
export interface VenteLot {
  /** « Mise à prix par l'AG » (CPCE L. 322-6 : fixée par le créancier poursuivant). */
  miseAPrixCentimes: number | null
  /** Sommes estimées définitivement perdues : absentes de Gestéam. */
  sommesEstimeesPerduesCentimes: number | null
}

export interface VoiesExecutionContentieux {
  /** Case Saisie immobilière ; null : non cochée. */
  saisieImmobiliere: SaisieImmobiliere | null
  /** Cases cochées, dans l'ordre du référentiel. */
  saisies: readonly SaisieExecution[]
  /** Case « Échéancier » : conservée sans effet. */
  caseEcheancier: boolean
  expulsionLe: string | null
  hypotheque: HypothequeContentieux | null
  venteLot: VenteLot | null
}

export interface SaisieVoiesExecution {
  saisieImmobiliere?: Partial<SaisieImmobiliere> | null
  saisies?: readonly string[]
  caseEcheancier?: boolean
  expulsionLe?: string | null
  hypotheque?: Partial<HypothequeContentieux> | null
  venteLot?: Partial<VenteLot> | null
}

export const SANS_VOIES_EXECUTION: Readonly<VoiesExecutionContentieux> = Object.freeze({
  saisieImmobiliere: null,
  saisies: Object.freeze([]),
  caseEcheancier: false,
  expulsionLe: null,
  hypotheque: null,
  venteLot: null,
})

/**
 * Décision qui autorise le contentieux : résolution d'une assemblée (listes Assemblée et Résolution de la fiche ; sa date
 * est celle de l'assemblée, lue par l'appelant), ou décision de l'administrateur provisoire de l'art. 29-1 portée à sa
 * date au registre (D. 1967 art. 62-8). Même forme que decisions-annuelles-ag.SourceDecisionAnnuelle, plus la date de la
 * décision de l'administrateur provisoire, qu'aucune table ne donne.
 */
export type SourceDecisionContentieux =
  | { origine: 'assemblee'; agId: string; resolutionId: string }
  | { origine: 'administrateur'; reference: string; date: string }

// ─── Création ────────────────────────────────────────────────────────────────────────────────────────────────────

const estAbsent = (valeur: unknown): valeur is null | undefined => valeur === undefined || valeur === null

function dateOuNull(champ: string, valeur: unknown): string | null {
  if (estAbsent(valeur)) return null
  if (!estDateIsoValide(valeur)) throw new Error(`Date invalide pour « ${champ} » (${String(valeur)}) : AAAA-MM-JJ attendu.`)
  return valeur
}

function centimesOuNull(champ: string, valeur: unknown): number | null {
  if (estAbsent(valeur)) return null
  if (typeof valeur !== 'number' || !Number.isInteger(valeur) || valeur < 0)
    throw new Error(`Montant invalide pour « ${champ} » (${String(valeur)}) : centimes entiers positifs ou nuls attendus.`)
  return valeur
}

const saisieImmobiliereNormalisee = (saisie: Partial<SaisieImmobiliere> | null | undefined): SaisieImmobiliere | null =>
  estAbsent(saisie)
    ? null
    : {
        engageeLe: dateOuNull('Engagée le', saisie.engageeLe),
        audienceLe: dateOuNull('Audience éventuelle', saisie.audienceLe),
        adjudicationLe: dateOuNull('Adjudication', saisie.adjudicationLe),
      }

function saisiesNormalisees(saisies: readonly string[] | undefined): SaisieExecution[] {
  const cochees = new Set(saisies ?? [])
  for (const cle of cochees) if (!CLES_SAISIES.has(cle)) throw new Error(`Saisie inconnue : « ${cle} ».`)
  return SAISIES_EXECUTION.map((s) => s.cle).filter((cle) => cochees.has(cle))
}

const hypothequeNormalisee = (saisie: Partial<HypothequeContentieux> | null | undefined): HypothequeContentieux | null =>
  estAbsent(saisie)
    ? null
    : {
        inscriteLe: dateOuNull("Hypothèque (date d'inscription)", saisie.inscriteLe),
        montantCentimes: centimesOuNull('Hypothèque (montant)', saisie.montantCentimes),
      }

const venteLotNormalisee = (saisie: Partial<VenteLot> | null | undefined): VenteLot | null =>
  estAbsent(saisie)
    ? null
    : {
        miseAPrixCentimes: centimesOuNull('Mise à prix', saisie.miseAPrixCentimes),
        sommesEstimeesPerduesCentimes: centimesOuNull('Sommes estimées définitivement perdues', saisie.sommesEstimeesPerduesCentimes),
      }

/**
 * Normalise le bloc Voie d'exécution et l'hypothèque : saisies sans doublon dans l'ordre du référentiel, champs absents →
 * null. Refuse une saisie inconnue, une date non ISO, un montant qui n'est pas un entier de centimes ≥ 0.
 */
export function creerVoiesExecution(saisie: SaisieVoiesExecution): VoiesExecutionContentieux {
  const caseEcheancier = saisie.caseEcheancier ?? false
  if (typeof caseEcheancier !== 'boolean')
    throw new Error(`Case « Échéancier » invalide (${String(caseEcheancier)}) : oui ou non attendu.`)
  return {
    saisieImmobiliere: saisieImmobiliereNormalisee(saisie.saisieImmobiliere),
    saisies: saisiesNormalisees(saisie.saisies),
    caseEcheancier,
    expulsionLe: dateOuNull('Expulsion', saisie.expulsionLe),
    hypotheque: hypothequeNormalisee(saisie.hypotheque),
    venteLot: venteLotNormalisee(saisie.venteLot),
  }
}

/** Date de la décision de l'administrateur provisoire, vérifiée (erreur si elle n'est pas ISO). */
function dateDecisionAdministrateur(date: unknown): string {
  if (!estDateIsoValide(date))
    throw new Error(
      `Décision de l'administrateur provisoire : date de la décision invalide (${String(date)}) : AAAA-MM-JJ attendu (portée à sa date au registre, D. 1967 art. 62-8).`,
    )
  return date
}

/** Décision liée, identifiants rognés. Refuse un identifiant vide, une date de décision non ISO ou une origine inconnue. */
export function creerDecisionContentieux(saisie: SourceDecisionContentieux): SourceDecisionContentieux {
  if (saisie?.origine === 'assemblee') {
    const agId = saisie.agId?.trim() ?? ''
    const resolutionId = saisie.resolutionId?.trim() ?? ''
    if (agId === '' || resolutionId === '')
      throw new Error("Décision d'assemblée : l'assemblée et la résolution qui autorisent le contentieux sont attendues.")
    return { origine: 'assemblee', agId, resolutionId }
  }
  if (saisie?.origine === 'administrateur') {
    const reference = saisie.reference?.trim() ?? ''
    if (reference === '')
      throw new Error("Décision de l'administrateur provisoire : référence de la décision attendue (registre, D. 1967 art. 62-8).")
    return { origine: 'administrateur', reference, date: dateDecisionAdministrateur(saisie.date) }
  }
  throw new Error(
    `Origine de la décision inconnue (${String((saisie as { origine?: unknown } | null)?.origine)}) : assemblée ou administrateur provisoire attendus.`,
  )
}

// ─── Engagement et refus structurel ──────────────────────────────────────────────────────────────────────────────

export type ChampDateVoieExecution = 'engageeLe' | 'audienceLe' | 'adjudicationLe' | 'expulsionLe' | 'inscriteLe'

/** Libellé accordé et date fixée à l'avance (future admise) ou constat (🔴 5). */
const DATES_VOIES: Record<ChampDateVoieExecution, { datee: string; futurAdmis: boolean }> = {
  engageeLe: { datee: 'Engagement de la saisie immobilière daté', futurAdmis: false },
  audienceLe: { datee: 'Audience de saisie immobilière datée', futurAdmis: true },
  adjudicationLe: { datee: 'Adjudication datée', futurAdmis: true },
  expulsionLe: { datee: 'Expulsion datée', futurAdmis: false },
  inscriteLe: { datee: "Inscription de l'hypothèque datée", futurAdmis: false },
}

/** Acte daté de la saisie immobilière : champ de la fiche et date. */
interface ActeSaisie {
  champ: keyof SaisieImmobiliere
  date: string
}

const CHAMPS_SAISIE_IMMOBILIERE: readonly (keyof SaisieImmobiliere)[] = ['engageeLe', 'audienceLe', 'adjudicationLe']

/** Premier acte daté de la saisie immobilière (date la plus ancienne ; à égalité, ordre de la fiche) ; null : aucun. */
function premierActeSaisie(saisie: SaisieImmobiliere | null): ActeSaisie | null {
  if (saisie === null) return null
  let premier: ActeSaisie | null = null
  for (const champ of CHAMPS_SAISIE_IMMOBILIERE) {
    const date = saisie[champ]
    if (date !== null && (premier === null || date < premier.date)) premier = { champ, date }
  }
  return premier
}

/** Acte nommé par le libellé de son champ : « Audience de saisie immobilière datée du 01/03/2026 ». */
const libelleActe = ({ champ, date }: ActeSaisie): string => `${DATES_VOIES[champ].datee} du ${dateIsoVersFr(date)}`

/** Saisie en vue de la vente engagée (🔵) : case cochée et au moins une de ses dates saisie. */
export function saisieVenteEngagee(voies: VoiesExecutionContentieux | null | undefined): boolean {
  return premierActeSaisie(voies?.saisieImmobiliere ?? null) !== null
}

/** Mesure d'exécution en cours (🔵) : saisie cochée, saisie immobilière engagée ou expulsion datée. */
export function executionEngagee(voies: VoiesExecutionContentieux | null | undefined): boolean {
  if (estAbsent(voies)) return false
  return voies.saisies.length > 0 || voies.expulsionLe !== null || saisieVenteEngagee(voies)
}

const FONDEMENT_AUTORISATION = 'D. 1967 art. 55, al. 1 et 3'
const FONDEMENT_MONTANTS = 'D. 1967 art. 11, I, 11°'
const FONDEMENT_POUVOIRS_AP = 'L. 1965 art. 29-1, I, al. 2 ; D. 1967 art. 62-8'
const FONDEMENT_DECISION_AP = 'L. 1965 art. 29-1, I, al. 2 ; D. 1967 art. 62-7 et 62-8'

/** Montants du projet de résolution manquants, au singulier de la phrase (« sans mise à prix »). */
function montantsManquants(venteLot: VenteLot | null): string[] {
  const manquants: string[] = []
  if (estAbsent(venteLot?.miseAPrixCentimes)) manquants.push('mise à prix')
  if (estAbsent(venteLot?.sommesEstimeesPerduesCentimes)) manquants.push('sommes estimées définitivement perdues')
  return manquants
}

const messageMontants = (sujet: string, manquants: readonly string[]): string =>
  `${sujet} sans ${manquants.join(' et ')} : le projet de résolution qui l'autorise en mentionne le montant (${FONDEMENT_MONTANTS}).`

/**
 * Refus structurel (appelé par contentieux.creerDossierContentieux) : une saisie immobilière engagée exige une décision
 * liée et les deux montants du projet de résolution. Les autres voies d'exécution n'exigent rien (art. 55, al. 3).
 */
export function exigerAutorisationVente(
  voies: VoiesExecutionContentieux | null | undefined,
  decision: SourceDecisionContentieux | null | undefined,
): void {
  if (!saisieVenteEngagee(voies)) return
  if (estAbsent(decision))
    throw new Error(
      `Saisie immobilière engagée sans décision liée : rattacher la résolution d'assemblée qui l'autorise, ou la décision de l'administrateur provisoire investi des pouvoirs de l'assemblée (${FONDEMENT_AUTORISATION}).`,
    )
  const manquants = montantsManquants(voies?.venteLot ?? null)
  if (manquants.length > 0) throw new Error(messageMontants('Saisie immobilière engagée', manquants))
}

// ─── Contrôle de fond ────────────────────────────────────────────────────────────────────────────────────────────

/** Assemblée liée, lue par l'appelant ; `date` en ISO (dates.dateVersIso pour la table `ags`). */
export interface AssembleeLiee {
  id: string
  coproprieteId: string
  date: string
}

export interface ContexteAutorisationVente {
  /** Résolution désignée par la décision « assemblée » ; absente ou null : à rattacher. */
  resolution?: Resolution | null
  /** Assemblée désignée par la décision « assemblée » ; absente ou null : à rattacher. */
  assemblee?: AssembleeLiee | null
  /**
   * Régime du mandat de justice en vigueur à la date de la décision (assemblée, ou décision de l'administrateur
   * provisoire) ; absent ou null : aucun ou inconnu.
   */
  regime?: Regime | null
  /** Avec le régime 'ap291' : pouvoirs de l'assemblée confiés à l'administrateur provisoire, à la même date. */
  pouvoirsAgConfies?: PouvoirsAgConfies | null
}

/** Dossier lu par le contrôle, typé par sa structure (contentieux.DossierContentieux y répond). */
export interface DossierVoiesExecution {
  coproprieteId: string
  voiesExecution?: VoiesExecutionContentieux
  decision?: SourceDecisionContentieux | null
}

export type CauseAutorisationVente =
  | 'non_requise'
  | 'admise'
  | 'pouvoirs_ag_a_verifier'
  | 'decision_manquante'
  | 'montants_manquants'
  | 'resolution_a_rattacher'
  | 'assemblee_autre_copropriete'
  | 'resolution_non_adoptee'
  | 'decision_apres_engagement'
  | 'pouvoir_ag_confie_a_l_administrateur'
  | 'pouvoirs_ag_non_etablis'
  | 'pouvoirs_ag_non_confies'

export interface ResultatAutorisationVente {
  autorise: boolean
  cause: CauseAutorisationVente
  motif: string
  fondement: string
  /** Admise sous réserve d'une question ouverte (majorité, étendue des pouvoirs confiés). */
  aConfirmer: boolean
  /**
   * Points que le module ne contrôle pas, pour une décision admise : décompte des voix et notification du projet (résolution
   * d'AG) ; avis du conseil syndical et mode de financement (décision de l'administrateur provisoire).
   */
  rappels: string[]
}

const CAUSES_AUTORISANTES: ReadonlySet<CauseAutorisationVente> = new Set(['non_requise', 'admise', 'pouvoirs_ag_a_verifier'])

const resultat = (
  cause: CauseAutorisationVente,
  motif: string,
  fondement: string,
  options: { aConfirmer?: boolean; rappels?: string[] } = {},
): ResultatAutorisationVente => ({
  autorise: CAUSES_AUTORISANTES.has(cause),
  cause,
  motif,
  fondement,
  aConfirmer: options.aConfirmer ?? false,
  rappels: options.rappels ?? [],
})

export const RAPPELS_RESOLUTION_VENTE: readonly string[] = Object.freeze([
  "Au vote, la voix du copropriétaire débiteur n'est pas comptée et il ne peut recevoir mandat (L. 1965 art. 19-2, al. 5) : décompte à vérifier au procès-verbal.",
  "Le projet de résolution doit avoir été notifié au plus tard avec l'ordre du jour (D. 1967 art. 11, I, 11°) : notification non contrôlée ici.",
])

export const RAPPELS_DECISION_ADMINISTRATEUR: readonly string[] = Object.freeze([
  "L'avis du conseil syndical est recueilli avant la décision, sauf urgence (D. 1967 art. 62-7, al. 1) : avis non contrôlé ici.",
  "Le mode de financement de la décision est précisé lors de la consultation du conseil syndical ou des copropriétaires (D. 1967 art. 62-7, al. 3) : non contrôlé ici.",
])

/** La résolution et l'assemblée fournies doivent être celles du lien : sinon, erreur d'appel. */
function verifierContexteDuLien(decision: SourceDecisionContentieux | null, contexte: ContexteAutorisationVente): void {
  const { resolution = null, assemblee = null } = contexte
  if (decision?.origine !== 'assemblee') {
    if (resolution !== null || assemblee !== null)
      throw new Error("Résolution ou assemblée fournie, mais le dossier n'est lié à aucune résolution d'assemblée.")
    return
  }
  if (resolution !== null && (resolution.id !== decision.resolutionId || resolution.agId !== decision.agId))
    throw new Error(
      `La résolution fournie (${resolution.agId} / ${resolution.id}) n'est pas celle du dossier (${decision.agId} / ${decision.resolutionId}).`,
    )
  if (assemblee !== null && assemblee.id !== decision.agId)
    throw new Error(`L'assemblée fournie (${assemblee.id}) n'est pas celle du dossier (${decision.agId}).`)
  if (assemblee !== null && !estDateIsoValide(assemblee.date))
    throw new Error(`Date de l'assemblée invalide (${assemblee.date}) : AAAA-MM-JJ attendu.`)
}

/**
 * Refus si le premier acte daté de la saisie précède la décision qui l'autorise ; null sinon. `decision` la désigne
 * (« l'assemblée du 10/04/2026 »).
 */
function decisionTardive(
  saisie: SaisieImmobiliere,
  dateDecision: string,
  decision: string,
  fondement: string,
): ResultatAutorisationVente | null {
  const premier = premierActeSaisie(saisie)
  if (premier === null || premier.date >= dateDecision) return null
  return resultat(
    'decision_apres_engagement',
    `${libelleActe(premier)}, avant ${decision} qui l'autorise : le syndic n'agit qu'autorisé (al. 1) ; seuls les copropriétaires peuvent se prévaloir de ce défaut d'autorisation (al. 2).`,
    fondement,
  )
}

/** Étendue des pouvoirs de l'assemblée confiés à l'administrateur provisoire ; « inconnue » : non saisie. */
type EtendueSousAp = PouvoirsAgConfies | 'inconnue'

/** Étendue sous le régime de l'art. 29-1, à la date de la décision ; null : hors de ce régime. */
const etendueSousAp = ({ regime = null, pouvoirsAgConfies = null }: ContexteAutorisationVente): EtendueSousAp | null =>
  regime === 'ap291' ? (pouvoirsAgConfies ?? 'inconnue') : null

/** Résolution d'AG votée sous administrateur provisoire de l'art. 29-1 : l'AG ne garde que les pouvoirs hors de sa mission. */
const RESOLUTION_SOUS_AP: Record<'partie' | 'inconnue', string> = {
  partie: "L'administrateur provisoire a reçu une partie des pouvoirs de l'assemblée : vérifier que l'ordonnance laisse celui-ci à l'assemblée.",
  inconnue:
    "L'étendue des pouvoirs de l'assemblée confiés à l'administrateur provisoire n'est pas établie : vérifier que l'assemblée a gardé celui-ci.",
}

const RESOLUTION_AG_DESSAISIE =
  "Résolution votée alors que l'ordonnance confie tous les pouvoirs de l'assemblée (hors art. 26 a et b) à l'administrateur provisoire : l'assemblée ne garde que ceux qui ne sont pas compris dans sa mission ; la décision de saisir en vue de la vente revient à l'administrateur provisoire, portée à sa date au registre."

const MAJORITE_A_CONFIRMER =
  "Résolution soumise à la majorité de l'art. 24 : à confirmer, aucun texte lu ne dit si la saisie en vue de la vente se vote à la majorité de l'art. 24 ou de l'art. 25."

/**
 * Résolution adoptée, de la même copropriété, votée à temps : refusée si l'ordonnance confiait alors tous les pouvoirs de
 * l'assemblée à l'administrateur provisoire ; sinon admise, sous réserve du régime et de la majorité.
 */
function admissionResolution(resolution: Resolution, contexte: ContexteAutorisationVente): ResultatAutorisationVente {
  const etendue = etendueSousAp(contexte)
  if (etendue === 'tous')
    return resultat('pouvoir_ag_confie_a_l_administrateur', RESOLUTION_AG_DESSAISIE, `${FONDEMENT_AUTORISATION} ; ${FONDEMENT_POUVOIRS_AP}`)
  const sousAp = etendue === 'partie' || etendue === 'inconnue'
  const majoriteDouteuse = resolution.majorite === 'art24'
  const notes = [`Saisie immobilière autorisée par la résolution n° ${resolution.numero}, adoptée.`]
  if (sousAp) notes.push(RESOLUTION_SOUS_AP[etendue])
  if (majoriteDouteuse) notes.push(MAJORITE_A_CONFIRMER)
  return resultat(
    sousAp ? 'pouvoirs_ag_a_verifier' : 'admise',
    notes.join(' '),
    sousAp ? `${FONDEMENT_AUTORISATION} ; ${FONDEMENT_POUVOIRS_AP}` : FONDEMENT_AUTORISATION,
    { aConfirmer: sousAp || majoriteDouteuse, rappels: [...RAPPELS_RESOLUTION_VENTE] },
  )
}

function controlerResolution(
  coproprieteId: string,
  saisie: SaisieImmobiliere,
  decision: Extract<SourceDecisionContentieux, { origine: 'assemblee' }>,
  contexte: ContexteAutorisationVente,
): ResultatAutorisationVente {
  const { resolution = null, assemblee = null } = contexte
  if (resolution === null || assemblee === null)
    return resultat(
      'resolution_a_rattacher',
      `Saisie immobilière : rattacher l'assemblée ${decision.agId} et la résolution ${decision.resolutionId} pour contrôler l'autorisation.`,
      FONDEMENT_AUTORISATION,
    )
  if (assemblee.coproprieteId !== coproprieteId)
    return resultat('assemblee_autre_copropriete', "Saisie immobilière autorisée par l'assemblée d'une autre copropriété.", FONDEMENT_AUTORISATION)
  if (resolution.etat !== 'adoptee')
    return resultat(
      'resolution_non_adoptee',
      `Saisie immobilière : la résolution n° ${resolution.numero} est ${LIBELLES_ETATS_RESOLUTION[resolution.etat]} ; seule une résolution adoptée l'autorise.`,
      FONDEMENT_AUTORISATION,
    )
  const tardive = decisionTardive(saisie, assemblee.date, `l'assemblée du ${dateIsoVersFr(assemblee.date)}`, FONDEMENT_AUTORISATION)
  return tardive ?? admissionResolution(resolution, contexte)
}

/** Décision de l'administrateur provisoire hors de l'art. 29-1, ou sans les pouvoirs de l'assemblée (établis ou non). */
const ADMINISTRATEUR_SANS_POUVOIRS = {
  regimeInconnu:
    "Décision hors assemblée, sans mandat de justice renseigné : seul l'administrateur provisoire de l'art. 29-1 reçoit des pouvoirs de l'assemblée ; la saisie en vue de la vente exige une résolution d'assemblée.",
  autreRegime:
    "Décision hors assemblée : seul l'administrateur provisoire de l'art. 29-1 reçoit des pouvoirs de l'assemblée ; la saisie en vue de la vente exige une résolution d'assemblée.",
  aucun:
    "Administrateur provisoire : l'ordonnance ne lui confie aucun pouvoir de l'assemblée ; la saisie en vue de la vente exige une résolution de l'assemblée qu'il convoque et préside.",
  inconnue:
    "Administrateur provisoire : l'étendue des pouvoirs de l'assemblée confiés par l'ordonnance n'est pas établie ; à défaut, la saisie en vue de la vente exige une résolution d'assemblée.",
}

/**
 * Pouvoirs de l'administrateur provisoire à la date de sa décision : non établis (régime ou étendue non renseignés), non
 * confiés (autre régime, ou aucun pouvoir de l'AG), tous ou une partie. Admise, la décision reçoit les rappels de l'art.
 * 62-7.
 */
function admissionDecisionAdministrateur(contexte: ContexteAutorisationVente): ResultatAutorisationVente {
  const regime = contexte.regime ?? null
  if (regime === null) return resultat('pouvoirs_ag_non_etablis', ADMINISTRATEUR_SANS_POUVOIRS.regimeInconnu, FONDEMENT_POUVOIRS_AP)
  if (regime !== 'ap291') return resultat('pouvoirs_ag_non_confies', ADMINISTRATEUR_SANS_POUVOIRS.autreRegime, FONDEMENT_POUVOIRS_AP)
  const etendue = etendueSousAp(contexte)
  if (etendue === 'inconnue') return resultat('pouvoirs_ag_non_etablis', ADMINISTRATEUR_SANS_POUVOIRS.inconnue, FONDEMENT_POUVOIRS_AP)
  if (etendue === 'aucun') return resultat('pouvoirs_ag_non_confies', ADMINISTRATEUR_SANS_POUVOIRS.aucun, FONDEMENT_POUVOIRS_AP)
  const rappels = [...RAPPELS_DECISION_ADMINISTRATEUR]
  if (etendue === 'tous')
    return resultat(
      'admise',
      "Saisie immobilière décidée par l'administrateur provisoire, investi de tous les pouvoirs de l'assemblée.",
      FONDEMENT_DECISION_AP,
      { rappels },
    )
  return resultat(
    'pouvoirs_ag_a_verifier',
    "Administrateur provisoire investi d'une partie des pouvoirs de l'assemblée : vérifier que l'ordonnance lui confie celui-ci ; à défaut, l'assemblée qu'il convoque et préside décide.",
    FONDEMENT_DECISION_AP,
    { aConfirmer: true, rappels },
  )
}

/** Décision de l'administrateur provisoire : prise au plus tard le jour du premier acte de la saisie, puis ses pouvoirs. */
function controlerDecisionAdministrateur(
  saisie: SaisieImmobiliere,
  decision: Extract<SourceDecisionContentieux, { origine: 'administrateur' }>,
  contexte: ContexteAutorisationVente,
): ResultatAutorisationVente {
  const date = dateDecisionAdministrateur(decision.date)
  const tardive = decisionTardive(
    saisie,
    date,
    `la décision de l'administrateur provisoire du ${dateIsoVersFr(date)}`,
    `${FONDEMENT_AUTORISATION} ; ${FONDEMENT_POUVOIRS_AP}`,
  )
  return tardive ?? admissionDecisionAdministrateur(contexte)
}

/**
 * Autorisation de la saisie en vue de la vente d'un lot : non requise sans saisie immobilière ; sinon décision liée,
 * montants du projet de résolution, puis résolution adoptée (assemblée de la même copropriété, tenue au plus tard le jour
 * du premier acte de la saisie, sans que l'ordonnance ait alors confié tous ses pouvoirs à l'administrateur provisoire)
 * ou décision de l'administrateur provisoire investi des pouvoirs de l'AG, prise au plus tard ce même jour. Lève une
 * erreur si la résolution ou l'assemblée fournie n'est pas celle du lien, ou si la décision de l'administrateur
 * provisoire n'est pas datée (erreur d'appel).
 */
export function controlerAutorisationSaisieVente(
  dossier: DossierVoiesExecution,
  contexte: ContexteAutorisationVente = {},
): ResultatAutorisationVente {
  const decision = dossier.decision ?? null
  verifierContexteDuLien(decision, contexte)
  const saisie = dossier.voiesExecution?.saisieImmobiliere ?? null
  if (saisie === null)
    return resultat(
      'non_requise',
      "Aucune saisie en vue de la vente d'un lot : les autres voies d'exécution, l'expulsion et l'hypothèque n'exigent pas d'autorisation de l'assemblée.",
      'D. 1967 art. 55, al. 3 ; L. 1965 art. 19, al. 2',
    )
  if (decision === null)
    return resultat(
      'decision_manquante',
      "Saisie immobilière sans décision liée : rattacher la résolution d'assemblée qui l'autorise, ou la décision de l'administrateur provisoire investi des pouvoirs de l'assemblée.",
      FONDEMENT_AUTORISATION,
    )
  const manquants = montantsManquants(dossier.voiesExecution?.venteLot ?? null)
  if (manquants.length > 0) return resultat('montants_manquants', messageMontants('Saisie immobilière', manquants), FONDEMENT_MONTANTS)
  return decision.origine === 'assemblee'
    ? controlerResolution(dossier.coproprieteId, saisie, decision, contexte)
    : controlerDecisionAdministrateur(saisie, decision, contexte)
}

/** « Engagée le » encore vide, et la date ne suit pas l'audience ou l'adjudication déjà datée ; sinon erreur. */
function verifierEngageable(actuelle: SaisieImmobiliere | null, engageeLe: string): void {
  if (actuelle?.engageeLe) throw new Error(`Saisie immobilière déjà engagée le ${dateIsoVersFr(actuelle.engageeLe)}.`)
  const premier = premierActeSaisie(actuelle)
  if (premier !== null && premier.date < engageeLe)
    throw new Error(
      `Saisie immobilière non engagée au ${dateIsoVersFr(engageeLe)} : ${libelleActe(premier).toLowerCase()} ; l'engagement précède l'audience et l'adjudication.`,
    )
}

/**
 * Engage la saisie immobilière à la date donnée (case cochée au besoin) et renvoie une copie. Complète aussi « Engagée
 * le » d'une saisie déjà datée par son audience ou son adjudication (anomalie engagement_non_date). Lève une erreur si
 * « Engagée le » est déjà daté, si la date est invalide ou postérieure à l'audience ou à l'adjudication déjà datée, ou si
 * controlerAutorisationSaisieVente ne l'autorise pas. C'est le refus du bilan : pas de saisie en vue de la vente sans
 * décision liée portant les deux montants.
 */
export function engagerSaisieImmobiliere<D extends DossierVoiesExecution>(
  dossier: D,
  engageeLe: string,
  contexte: ContexteAutorisationVente = {},
): D {
  if (!estDateIsoValide(engageeLe)) throw new Error(`Date d'engagement invalide (${engageeLe}) : AAAA-MM-JJ attendu.`)
  const voies = dossier.voiesExecution ?? SANS_VOIES_EXECUTION
  const actuelle = voies.saisieImmobiliere
  verifierEngageable(actuelle, engageeLe)
  const saisieImmobiliere: SaisieImmobiliere = { audienceLe: null, adjudicationLe: null, ...actuelle, engageeLe }
  const suivant: D = { ...dossier, voiesExecution: { ...voies, saisies: [...voies.saisies], saisieImmobiliere } }
  const controle = controlerAutorisationSaisieVente(suivant, contexte)
  if (!controle.autorise) throw new Error(`Saisie immobilière non engagée. ${controle.motif} (${controle.fondement})`)
  return suivant
}

// ─── Dates ───────────────────────────────────────────────────────────────────────────────────────────────────────

export type CodeAnomalieVoiesExecution =
  | 'date_non_plausible'
  | 'ordre_saisie_immobiliere'
  | 'engagement_avant_ouverture'
  | 'engagement_non_date'
  | 'saisie_sans_titre'
  | 'hypotheque_sans_mise_en_demeure'
  | 'expulsion_sans_titre'

export interface AnomalieVoiesExecution {
  code: CodeAnomalieVoiesExecution
  champ: ChampDateVoieExecution
  message: string
  aConfirmer: boolean
  /** Nature de l'anomalie de date (`date_non_plausible` seulement). */
  nature?: PlausibiliteDate
}

/** Dossier lu par le contrôle des dates, typé par sa structure. */
export interface DossierDatesVoiesExecution {
  dateOuverture: string
  jalons?: Partial<Record<'miseEnDemeure' | 'ordonnance' | 'jugement', string>>
  voiesExecution?: VoiesExecutionContentieux
}

const anomalie = (
  code: CodeAnomalieVoiesExecution,
  champ: ChampDateVoieExecution,
  message: string,
  aConfirmer = false,
): AnomalieVoiesExecution => ({ code, champ, message, aConfirmer })

function datesSaisies(voies: VoiesExecutionContentieux): [ChampDateVoieExecution, string | null][] {
  const saisie = voies.saisieImmobiliere
  return [
    ['engageeLe', saisie?.engageeLe ?? null],
    ['audienceLe', saisie?.audienceLe ?? null],
    ['adjudicationLe', saisie?.adjudicationLe ?? null],
    ['expulsionLe', voies.expulsionLe],
    ['inscriteLe', voies.hypotheque?.inscriteLe ?? null],
  ]
}

function anomaliesPlausibilite(voies: VoiesExecutionContentieux, aujourdhui: string): AnomalieVoiesExecution[] {
  const anomalies: AnomalieVoiesExecution[] = []
  for (const [champ, date] of datesSaisies(voies)) {
    const { datee, futurAdmis } = DATES_VOIES[champ]
    const nature = date === null ? null : plausibiliteDate(date, aujourdhui, { futurAdmis })
    if (date !== null && nature !== null)
      anomalies.push({ ...anomalie('date_non_plausible', champ, messagePlausibilite(datee, date, nature)), nature })
  }
  return anomalies
}

/** Paires (avant, après) de la saisie immobilière dont l'ordre s'impose quand les deux dates existent. */
const ORDRE_SAISIE: [keyof SaisieImmobiliere, keyof SaisieImmobiliere][] = [
  ['engageeLe', 'audienceLe'],
  ['audienceLe', 'adjudicationLe'],
  ['engageeLe', 'adjudicationLe'],
]

function anomaliesOrdreSaisie(saisie: SaisieImmobiliere): AnomalieVoiesExecution[] {
  const anomalies: AnomalieVoiesExecution[] = []
  const signales = new Set<string>()
  for (const [avant, apres] of ORDRE_SAISIE) {
    const dAvant = saisie[avant]
    const dApres = saisie[apres]
    if (dAvant !== null && dApres !== null && dApres < dAvant && !signales.has(apres)) {
      signales.add(apres)
      anomalies.push(
        anomalie('ordre_saisie_immobiliere', apres, `${DATES_VOIES[apres].datee} avant : ${DATES_VOIES[avant].datee.toLowerCase()}.`),
      )
    }
  }
  return anomalies
}

/** Un des titres (jugement, ordonnance, adjudication) est-il daté au plus tard ce jour-là ? */
const titreAuPlusTard = (titres: readonly (string | null | undefined)[], date: string): boolean =>
  titres.some((titre) => !estAbsent(titre) && titre <= date)

/** Saisie immobilière sans jugement ni ordonnance du dossier datés au plus tard à son premier acte (à confirmer). */
function anomaliesSaisieSansTitre(saisie: SaisieImmobiliere, jalons: DossierDatesVoiesExecution['jalons']): AnomalieVoiesExecution[] {
  const premier = premierActeSaisie(saisie)
  if (premier === null || titreAuPlusTard([jalons?.jugement, jalons?.ordonnance], premier.date)) return []
  return [
    anomalie(
      'saisie_sans_titre',
      premier.champ,
      `${libelleActe(premier)} sans jugement ni ordonnance datés au plus tard ce jour-là : la saisie immobilière exige un titre exécutoire constatant une créance liquide et exigible (CPCE L. 311-2), dont le commandement valant saisie indique la date et la nature (R. 321-3, 2°).`,
      true,
    ),
  ]
}

function anomaliesSaisieImmobiliere(
  saisie: SaisieImmobiliere | null,
  dateOuverture: string,
  jalons: DossierDatesVoiesExecution['jalons'],
): AnomalieVoiesExecution[] {
  if (saisie === null) return []
  const anomalies = anomaliesOrdreSaisie(saisie)
  if (saisie.engageeLe !== null && saisie.engageeLe < dateOuverture)
    anomalies.push(anomalie('engagement_avant_ouverture', 'engageeLe', "Saisie immobilière engagée avant l'ouverture du dossier."))
  if (saisie.engageeLe === null && (saisie.audienceLe !== null || saisie.adjudicationLe !== null))
    anomalies.push(
      anomalie(
        'engagement_non_date',
        'engageeLe',
        "Audience ou adjudication datée sans date d'engagement de la saisie immobilière (« Engagée le »).",
      ),
    )
  return [...anomalies, ...anomaliesSaisieSansTitre(saisie, jalons)]
}

function anomaliesHypotheque(
  hypotheque: HypothequeContentieux | null,
  jalons: DossierDatesVoiesExecution['jalons'],
): AnomalieVoiesExecution[] {
  const inscriteLe = hypotheque?.inscriteLe ?? null
  const miseEnDemeure = jalons?.miseEnDemeure ?? null
  if (inscriteLe === null || (miseEnDemeure !== null && miseEnDemeure < inscriteLe)) return []
  return [
    anomalie(
      'hypotheque_sans_mise_en_demeure',
      'inscriteLe',
      `Hypothèque inscrite le ${dateIsoVersFr(inscriteLe)} sans mise en demeure datée avant elle : l'inscription suit une mise en demeure restée infructueuse (datée du jour même, elle n'a pu le rester), sauf si le copropriétaire invoque l'art. 33 (L. 1965 art. 19, al. 1).`,
      true,
    ),
  ]
}

function anomaliesExpulsion(voies: VoiesExecutionContentieux, jalons: DossierDatesVoiesExecution['jalons']): AnomalieVoiesExecution[] {
  const expulsionLe = voies.expulsionLe
  if (expulsionLe === null) return []
  if (titreAuPlusTard([jalons?.jugement, jalons?.ordonnance, voies.saisieImmobiliere?.adjudicationLe], expulsionLe)) return []
  return [
    anomalie(
      'expulsion_sans_titre',
      'expulsionLe',
      "Expulsion datée sans jugement, ordonnance ni adjudication antérieurs : elle exige une décision de justice ou un procès-verbal de conciliation exécutoire (CPCE L. 411-1) ; le jugement d'adjudication en tient lieu contre le saisi (L. 322-13).",
      true,
    ),
  ]
}

/**
 * Dates des voies d'exécution et de l'hypothèque : plausibilité par rapport à `aujourdhui` (audience et adjudication
 * peuvent être futures), ordre de la saisie immobilière, engagement après l'ouverture, titre (jugement ou ordonnance)
 * avant le premier acte de la saisie immobilière, mise en demeure au plus tard la veille de l'hypothèque, titre avant
 * l'expulsion. Signale, ne refuse pas ; lève une erreur si `aujourdhui` est invalide.
 */
export function controlerDatesVoiesExecution(dossier: DossierDatesVoiesExecution, aujourdhui: string): AnomalieVoiesExecution[] {
  verifierAujourdhui(aujourdhui)
  const voies = dossier.voiesExecution
  if (voies === undefined) return []
  return [
    ...anomaliesPlausibilite(voies, aujourdhui),
    ...anomaliesSaisieImmobiliere(voies.saisieImmobiliere, dossier.dateOuverture, dossier.jalons),
    ...anomaliesHypotheque(voies.hypotheque, dossier.jalons),
    ...anomaliesExpulsion(voies, dossier.jalons),
  ]
}

// ─── Mise à prix et hypothèque ───────────────────────────────────────────────────────────────────────────────────

/** Plancher de la garantie de l'enchérisseur : 3 000 € (CPCE R. 322-41, al. 1). */
export const GARANTIE_ENCHERE_MINIMUM_CENTIMES = 300_000

/** Garantie de l'enchérisseur : 10 % de la mise à prix (centime supérieur, 🔵), au moins 3 000 € (CPCE R. 322-41). */
export function garantieEnchereCentimes(miseAPrixCentimes: number): number {
  const miseAPrix = centimesOuNull('Mise à prix', miseAPrixCentimes)
  if (miseAPrix === null) throw new Error('Mise à prix attendue.')
  return Math.max(Math.ceil(miseAPrix / 10), GARANTIE_ENCHERE_MINIMUM_CENTIMES)
}

/** Au-delà, une créance exigible ne peut plus être inscrite (L. 1965 art. 19, al. 4). */
export const ANNEES_INSCRIPTION_HYPOTHEQUE_MAX = 5

/**
 * Postes exigibles depuis plus de cinq ans à la date d'inscription : aucune inscription, même complémentaire, ne peut
 * les garantir (L. 1965 art. 19, al. 4 ; articulation avec C. civ. art. 2402, 3° : 🔴 4). Les cinq ans se comptent de
 * date à date depuis l'exigibilité (sans quantième identique, le dernier jour du mois : dates.ajouterMois) ; exigible
 * depuis cinq ans pile, le poste reste inscriptible. Renvoie leurs identifiants. Les postes sont typés par leur structure
 * (imputation-encaissements.PosteDette y répond).
 */
export function postesHorsInscriptionHypotheque(
  inscriteLe: string,
  postes: readonly { id: string; exigibilite: string }[],
): string[] {
  if (!estDateIsoValide(inscriteLe))
    throw new Error(`Date d'inscription de l'hypothèque invalide (${inscriteLe}) : AAAA-MM-JJ attendu.`)
  for (const poste of postes)
    if (!estDateIsoValide(poste.exigibilite))
      throw new Error(`Exigibilité du poste « ${poste.id} » invalide (${poste.exigibilite}) : AAAA-MM-JJ attendu.`)
  const mois = 12 * ANNEES_INSCRIPTION_HYPOTHEQUE_MAX
  return postes.filter((poste) => ajouterMois(poste.exigibilite, mois) < inscriteLe).map((poste) => poste.id)
}
