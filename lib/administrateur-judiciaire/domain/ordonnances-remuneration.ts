import {
  ajouterJours,
  ajouterMois,
  dateIsoVersFr,
  estDateIsoValide,
  reporterAuJourOuvrable,
  type OptionsJoursFeries,
} from '@/lib/administrateur-judiciaire/domain/dates'
import type { Regime } from '@/lib/administrateur-judiciaire/domain/fondements'

/**
 * Ordonnances de rémunération de l'administrateur (J67, R3 et R4 : recommandations validées par Hugo le 17/11/2026,
 * registre des décisions juridiques). Fonctions pures, montants HT en CENTIMES ENTIERS, dates ISO, sans écran ni table :
 * l'enregistrement des ordonnances est à brancher (écran : Frédéric). Utilisé par honoraires-facturation.ts (contrôle de
 * la facture, J67, R3) et honoraires-tableau.ts (émoluments taxés, perçus et restant à percevoir, J67, R4).
 *
 * Droit (textes lus sur Légifrance le 17/11/2026 ; lecture des textes, pas un avis d'avocat) :
 * - 🟢 Administrateur provisoire de l'art. 29-1 : hors le droit fixe de 1 500 € HT, qu'il perçoit dès que la décision le
 *   désignant est portée à sa connaissance, il n'est payé qu'en vertu des acomptes que le président du tribunal
 *   judiciaire fixe chaque année et de l'ordonnance qui arrête sa rémunération en fin de mission (D. 1967 art. 61-1-5, I
 *   à III ; arrêté du 8 octobre 2015, art. 4). À 500 lots et plus, pas de droit fixe : le juge fixe toute la rémunération,
 *   par dérogation aux art. 4 à 15 (arrêté, art. 3).
 * - 🟢 Syndic désigné par le juge (D. 1967 art. 46), administrateur provisoire faute de syndic (art. 47), administrateur
 *   ad hoc (art. 49) : la rémunération est fixée, sur justification de l'accomplissement de la mission, par le président
 *   de la juridiction qui l'a désigné (C. com. R. 814-27 ; mission « en matière civile » : déduction) ; il peut fixer une
 *   provision (R. 814-28). Aucun droit fixe.
 * - 🟢 Recours contre l'ordonnance de rémunération : CPC art. 714 à 718 (renvoi de D. 1967 art. 61-1-5, III, et de C. com.
 *   R. 814-27). Délai d'un mois (CPC art. 714) ; le délai et le recours exercé dans le délai sont suspensifs d'exécution
 *   (al. 3) ; tout intéressé peut le former (al. 1). Le délai ne court pas si la notification n'indique pas, ou indique
 *   mal, la voie de recours, son délai ou ses modalités (Cass. 2e civ., 3 mars 2016, n° 15-12.129) : d'où la case
 *   « notification avec la mention du recours », sans laquelle l'ordonnance de fin de mission est refusée. 🔵 Un recours
 *   formé hors délai n'est pas suspensif de plein droit : l'ordonnance reste refusée par prudence tant qu'il est pendant
 *   (J67, R3 : « tant qu'un recours est pendant »), avec une justification qui le dit.
 * - 🟢 Calcul du délai : il expire le jour du mois suivant qui porte le même quantième que la notification, à défaut le
 *   dernier jour du mois (CPC art. 641, al. 2), à minuit ; s'il expire un samedi, un dimanche ou un jour férié, il est
 *   prorogé au premier jour ouvrable suivant (CPC art. 642). L'ordonnance est exécutoire le lendemain.
 * - 🟢 J67, R3 : une ordonnance d'acompte (ou de provision) est utilisable dès sa notification ; le texte ne dit rien d'un
 *   recours contre elle. Par prudence, avant de prélever en vertu de l'ordonnance de fin de mission, le cabinet peut
 *   demander un certificat de non-recours au greffe de la cour d'appel (avertissement rendu).
 * - 🔵 L'ordonnance de fin de mission arrête la rémunération de toute la mission : exécutoire, elle remplace le droit fixe
 *   et les acomptes, qui s'imputent sur elle comme déjà facturés ; sinon, droit fixe et acomptes exécutoires. Une
 *   décision sur le recours remplace les montants de l'ordonnance. Une seule ordonnance de fin de mission par mandat.
 * - 🔵 Le plafond de 75 000 € HT des acomptes sur les droits proportionnels (61-1-5, II et III, al. 2 ; arrêté, art. 15)
 *   s'impose au juge qui fixe l'acompte : il n'est pas contrôlé ici.
 */

export const TYPES_ORDONNANCE_REMUNERATION = ['acompte', 'provision', 'fin_de_mission'] as const
export type TypeOrdonnanceRemuneration = (typeof TYPES_ORDONNANCE_REMUNERATION)[number]

/** 🟢 Droit fixe de l'AP de l'art. 29-1, en centimes HT (arrêté du 8 octobre 2015, art. 4 ; D. 1967 art. 61-1-5, I). */
export const DROIT_FIXE_AP_HT_CENTIMES = 150_000

/** 🟢 À partir de ce nombre de lots, l'entière rémunération de l'AP est fixée par le juge (arrêté du 8 octobre 2015, art. 3). */
export const SEUIL_LOTS_REMUNERATION_PAR_LE_JUGE = 500

/** 🟢 Délai de recours contre l'ordonnance de rémunération, en mois (CPC art. 714, auquel renvoient D. 1967 art. 61-1-5, III et C. com. R. 814-27). */
export const DELAI_RECOURS_ORDONNANCE_MOIS = 1

/**
 * J72 (b) ; J67, R5 (textes lus sur Légifrance le 17/11/2026) : fondement des frais du cabinet (timbres, recommandés,
 * copies, envois), à part de sa rémunération. Aucun texte du tarif n'en prévoit le remboursement ; le président les
 * arrête dans son ordonnance, avec la rémunération (« frais et débours » : Cass. 3e civ., 21 mai 2026, n° 24-20.377,
 * publié ; Cass. 2e civ., 3 mars 2016, n° 15-12.129). D. 1967 art. 61-1-5, II ne vise que les émoluments, et son III,
 * al. 2 ne parle des frais engagés que si les droits proportionnels des art. 11 à 13 de l'arrêté dépassent le seuil de
 * son art. 15 : ni l'un ni l'autre ne fonde ces frais (etapes-courrier.ts, honoraires-sinistre.ts).
 */
export const ARRET_FRAIS_ET_DEBOURS = 'Cass. 3e civ., 21/05/2026, n° 24-20.377'
export const SOURCE_FRAIS_ET_DEBOURS = `frais et débours arrêtés par l’ordonnance du président, ${ARRET_FRAIS_ET_DEBOURS} (J67, R5)`

/** Montants HT fixés par une ordonnance, ou par la décision rendue sur le recours, en centimes. */
export interface MontantsFixes {
  emolumentsHtCentimes: number
  fraisHtCentimes: number
}

export interface DecisionSurRecours extends MontantsFixes {
  date: string
}

export interface RecoursOrdonnance {
  /** Date du recours devant le premier président de la cour d'appel (CPC art. 714 à 718). */
  formeLe: string
  /** Décision rendue sur le recours ; null tant qu'il est pendant. Ses montants remplacent ceux de l'ordonnance. */
  decision: DecisionSurRecours | null
}

export interface OrdonnanceRemuneration extends MontantsFixes {
  id: string
  mandatId: string
  type: TypeOrdonnanceRemuneration
  /** Date de l'ordonnance. */
  date: string
  /** Date de sa notification au cabinet ; null tant qu'elle n'est pas notifiée. */
  dateNotification: string | null
  /** « Notification avec la mention du recours » (voie, délai, modalités) : sans elle, le délai de recours ne court pas. */
  mentionDuRecours: boolean
  recours: RecoursOrdonnance | null
}

/** Mandat judiciaire dont la rémunération est contrôlée : régime (null : ad hoc ou non reconnu) et nombre de lots. */
export interface MandatRemunere {
  regime: Regime | null
  /** Nombre de lots de la copropriété, lu pour l'AP de l'art. 29-1 seulement (droit fixe ; arrêté, art. 3). */
  nbLots: number
}

const TYPES_CONNUS: ReadonlySet<string> = new Set(TYPES_ORDONNANCE_REMUNERATION)
const LIBELLES_TYPE: Readonly<Record<TypeOrdonnanceRemuneration, string>> = {
  acompte: "Ordonnance d'acompte",
  provision: 'Ordonnance de provision',
  fin_de_mission: 'Ordonnance de fin de mission',
}
const fr = dateIsoVersFr

const CERTIFICAT_DE_NON_RECOURS =
  "Aucun recours enregistré, mais tout intéressé peut le former (CPC art. 714, al. 1) : par prudence, demander un " +
  'certificat de non-recours au greffe de la cour d’appel avant de prélever.'

/** Entier strictement positif (seuil de 500 lots de l'arrêté du 8 octobre 2015, art. 3). */
export function verifierNombreDeLots(nbLots: number): void {
  if (!Number.isInteger(nbLots) || nbLots <= 0) throw new Error(`Nombre de lots invalide (${nbLots}) : entier strictement positif attendu.`)
}

function verifierDate(date: string, quoi: string): void {
  if (!estDateIsoValide(date)) throw new Error(`${quoi} invalide (${date}) : AAAA-MM-JJ attendu.`)
}

function verifierMontants(montants: MontantsFixes, quoi: string): void {
  for (const montant of [montants.emolumentsHtCentimes, montants.fraisHtCentimes])
    if (!Number.isSafeInteger(montant) || montant < 0)
      throw new Error(`${quoi} : montant invalide (${montant}), centimes entiers positifs ou nuls attendus.`)
}

function verifierRecours(recours: RecoursOrdonnance, ordonnance: OrdonnanceRemuneration): void {
  verifierDate(recours.formeLe, 'Date du recours')
  if (recours.formeLe < ordonnance.date) throw new Error(`Ordonnance ${ordonnance.id} : recours formé avant l'ordonnance.`)
  if (recours.decision === null) return
  verifierDate(recours.decision.date, 'Date de la décision sur le recours')
  if (recours.decision.date < recours.formeLe) throw new Error(`Ordonnance ${ordonnance.id} : décision sur le recours antérieure au recours.`)
  verifierMontants(recours.decision, `Ordonnance ${ordonnance.id}, décision sur le recours`)
}

function verifierOrdonnance(ordonnance: OrdonnanceRemuneration): void {
  if (!ordonnance.id?.trim()) throw new Error('Ordonnance sans identifiant.')
  if (!TYPES_CONNUS.has(ordonnance.type)) throw new Error(`Ordonnance ${ordonnance.id} : type inconnu (« ${ordonnance.type} »).`)
  verifierDate(ordonnance.date, `Ordonnance ${ordonnance.id}, date`)
  verifierMontants(ordonnance, `Ordonnance ${ordonnance.id}`)
  if (ordonnance.dateNotification !== null) {
    verifierDate(ordonnance.dateNotification, `Ordonnance ${ordonnance.id}, date de notification`)
    if (ordonnance.dateNotification < ordonnance.date) throw new Error(`Ordonnance ${ordonnance.id} : notification antérieure à l'ordonnance.`)
  }
  if (ordonnance.recours !== null) verifierRecours(ordonnance.recours, ordonnance)
}

/** Ordonnances d'un même mandat, chacune une fois, une seule de fin de mission. */
function verifierOrdonnancesDuMandat(mandatId: string, ordonnances: readonly OrdonnanceRemuneration[]): void {
  const ids = new Set<string>()
  for (const ordonnance of ordonnances) {
    verifierOrdonnance(ordonnance)
    if (ordonnance.mandatId !== mandatId) throw new Error(`Ordonnance ${ordonnance.id} : elle vise un autre mandat (${ordonnance.mandatId}).`)
    if (ids.has(ordonnance.id)) throw new Error(`Ordonnance ${ordonnance.id} : fournie deux fois.`)
    ids.add(ordonnance.id)
  }
  if (ordonnances.filter((o) => o.type === 'fin_de_mission').length > 1)
    throw new Error(`Mandat ${mandatId} : une seule ordonnance de fin de mission attendue.`)
}

/**
 * Droit fixe dû sans ordonnance, en centimes HT : AP de l'art. 29-1 de moins de 500 lots seulement (D. 1967 art. 61-1-5,
 * I ; arrêté, art. 3 et 4) ; 0 sinon. Il est dû une fois, pour l'ensemble de la mission (61-1-5, I).
 */
export function droitFixeDu(mandat: MandatRemunere): number {
  if (mandat.regime !== 'ap291') return 0
  verifierNombreDeLots(mandat.nbLots)
  return mandat.nbLots < SEUIL_LOTS_REMUNERATION_PAR_LE_JUGE ? DROIT_FIXE_AP_HT_CENTIMES : 0
}

export interface DelaiDeRecours {
  /** Dernier jour du délai, à minuit, prorogé le cas échéant (CPC art. 641, al. 2, et 642). */
  finDuDelai: string
  /** Lendemain de la fin du délai : premier jour où l'ordonnance est exécutoire, faute de recours. */
  executableLe: string
  /** Vrai si la fin du délai tombait un samedi, un dimanche ou un jour férié (CPC art. 642). */
  reporte: boolean
  justification: string
}

/** Délai de recours contre une ordonnance de rémunération notifiée à cette date, avec sa justification (J67, R3). */
export function delaiDeRecours(dateNotification: string, options: OptionsJoursFeries = {}): DelaiDeRecours {
  verifierDate(dateNotification, 'Date de notification')
  const finSansReport = ajouterMois(dateNotification, DELAI_RECOURS_ORDONNANCE_MOIS)
  const finDuDelai = reporterAuJourOuvrable(finSansReport, options)
  const executableLe = ajouterJours(finDuDelai, 1)
  const reporte = finDuDelai !== finSansReport
  const report = reporte ? ` ; le ${fr(finSansReport)} n'est pas un jour ouvrable : délai prorogé (CPC art. 642)` : ''
  return {
    finDuDelai,
    executableLe,
    reporte,
    justification:
      `Recours d'un mois à compter de la notification du ${fr(dateNotification)} (CPC art. 714) : délai expirant le ` +
      `${fr(finDuDelai)} à minuit (même quantième, à défaut dernier jour du mois, CPC art. 641, al. 2${report}) ; le délai ` +
      `et le recours exercé dans le délai sont suspensifs d'exécution (CPC art. 714, al. 3) : ordonnance exécutoire à ` +
      `partir du ${fr(executableLe)}.`,
  }
}

export interface EtatOrdonnance {
  ordonnanceId: string
  type: TypeOrdonnanceRemuneration
  /** Utilisable à la date pour payer l'administrateur. */
  executable: boolean
  /** Montants retenus : ceux de la décision sur le recours rendue à la date, sinon ceux de l'ordonnance. */
  montants: MontantsFixes
  /** Pourquoi l'ordonnance est, ou n'est pas, utilisable ; pour la fin de mission, le calcul du délai de recours. */
  justification: string
  /** Fin de mission exécutoire sans recours enregistré : conseil du certificat de non-recours ; sinon null. */
  avertissement: string | null
}

const montantsDe = ({ emolumentsHtCentimes, fraisHtCentimes }: MontantsFixes): MontantsFixes => ({ emolumentsHtCentimes, fraisHtCentimes })

/** Décision sur le recours rendue au plus tard à la date (sans date : toute décision enregistrée). */
const decisionRendue = (ordonnance: OrdonnanceRemuneration, date: string | null): DecisionSurRecours | null => {
  const decision = ordonnance.recours?.decision ?? null
  return decision !== null && (date === null || decision.date <= date) ? decision : null
}

/**
 * Recours pendant à la date. Seul « le recours exercé dans le délai » est suspensif d'exécution (CPC art. 714, al. 3) ;
 * sans la mention du recours, le délai ne court pas, et tout recours est formé dans le délai. Un recours formé hors délai
 * n'est pas suspensif de plein droit : le refus est gardé par prudence tant qu'il est pendant (J67, R3).
 */
function justificationDuRecours(libelle: string, formeLe: string, delai: DelaiDeRecours | null): string {
  if (delai === null || formeLe <= delai.finDuDelai)
    return `${libelle} : recours formé le ${fr(formeLe)}, pendant, suspensif d'exécution (CPC art. 714, al. 3).`
  return (
    `${libelle} : recours formé hors délai le ${fr(formeLe)} (délai expiré le ${fr(delai.finDuDelai)}) : il n'est pas ` +
    "suspensif de plein droit (CPC art. 714, al. 3) ; refus gardé par prudence tant qu'il est pendant (J67, R3)."
  )
}

/** État de la fin de mission notifiée, sans décision sur le recours : recours pendant, mention absente, délai. */
function etatFinDeMission(ordonnance: OrdonnanceRemuneration, dateNotification: string, date: string, options: OptionsJoursFeries) {
  const libelle = `${LIBELLES_TYPE.fin_de_mission} du ${fr(ordonnance.date)}`
  const delai = ordonnance.mentionDuRecours ? delaiDeRecours(dateNotification, options) : null
  if (ordonnance.recours !== null && ordonnance.recours.formeLe <= date)
    return { executable: false, justification: justificationDuRecours(libelle, ordonnance.recours.formeLe, delai) }
  if (delai === null)
    return {
      executable: false,
      justification:
        `${libelle} notifiée le ${fr(dateNotification)} sans la mention de la voie de recours, de son délai et de ses ` +
        'modalités : le délai ne court pas (Cass. 2e civ., 3 mars 2016, n° 15-12.129) ; obtenir une notification régulière.',
    }
  if (date < delai.executableLe) return { executable: false, justification: `${libelle} : délai de recours en cours. ${delai.justification}` }
  return { executable: true, justification: `${libelle} : ${delai.justification}`, avertissement: CERTIFICAT_DE_NON_RECOURS }
}

/** État d'une ordonnance à une date : utilisable ou non, montants retenus et justification (J67, R3). */
export function etatOrdonnance(ordonnance: OrdonnanceRemuneration, date: string, options: OptionsJoursFeries = {}): EtatOrdonnance {
  verifierOrdonnance(ordonnance)
  verifierDate(date, 'Date du contrôle')
  const decision = decisionRendue(ordonnance, date)
  const base = { ordonnanceId: ordonnance.id, type: ordonnance.type, montants: montantsDe(decision ?? ordonnance), avertissement: null }
  const libelle = `${LIBELLES_TYPE[ordonnance.type]} du ${fr(ordonnance.date)}`
  const notification = ordonnance.dateNotification
  if (notification === null || notification > date)
    return { ...base, executable: false, justification: `${libelle} non notifiée au ${fr(date)} : elle ne couvre encore rien.` }
  if (decision !== null)
    return { ...base, executable: true, justification: `${libelle} : décision sur le recours du ${fr(decision.date)}, dont les montants sont retenus.` }
  if (ordonnance.type !== 'fin_de_mission')
    return { ...base, executable: true, justification: `${libelle}, notifiée le ${fr(notification)} : utilisable dès sa notification.` }
  return { ...base, ...etatFinDeMission(ordonnance, notification, date, options) }
}

export interface DroitsDuMandat extends MontantsFixes {
  /** Part des émoluments due au titre du droit fixe (0 : autre régime, 500 lots et plus, ou fin de mission retenue). */
  droitFixeHtCentimes: number
  /** Ordonnances retenues, dans l'ordre reçu. */
  ordonnanceIds: string[]
}

type Retenue = { ordonnanceId: string; type: TypeOrdonnanceRemuneration; montants: MontantsFixes }

/** La fin de mission retenue arrête toute la rémunération ; sinon, droit fixe et acomptes (ou provisions) s'ajoutent (🔵). */
function cumulerDroits(mandat: MandatRemunere, retenues: readonly Retenue[]): DroitsDuMandat {
  const finDeMission = retenues.find((r) => r.type === 'fin_de_mission')
  const droitFixe = droitFixeDu(mandat)
  if (finDeMission) return { ...finDeMission.montants, droitFixeHtCentimes: 0, ordonnanceIds: [finDeMission.ordonnanceId] }
  return {
    emolumentsHtCentimes: retenues.reduce((s, r) => s + r.montants.emolumentsHtCentimes, droitFixe),
    fraisHtCentimes: retenues.reduce((s, r) => s + r.montants.fraisHtCentimes, 0),
    droitFixeHtCentimes: droitFixe,
    ordonnanceIds: retenues.map((r) => r.ordonnanceId),
  }
}

export interface CouvertureOrdonnances extends DroitsDuMandat {
  date: string
  /** État de chaque ordonnance du mandat à la date, dans l'ordre reçu. */
  etats: EtatOrdonnance[]
}

/** Ce que le droit fixe et les ordonnances exécutoires couvrent à une date, en HT (J67, R3). */
export function couvertureAu(
  mandatId: string,
  mandat: MandatRemunere,
  ordonnances: readonly OrdonnanceRemuneration[],
  date: string,
  options: OptionsJoursFeries = {},
): CouvertureOrdonnances {
  verifierOrdonnancesDuMandat(mandatId, ordonnances)
  const etats = ordonnances.map((ordonnance) => etatOrdonnance(ordonnance, date, options))
  return { date, etats, ...cumulerDroits(mandat, etats.filter((etat) => etat.executable)) }
}

/** Montants fixés par l'ordonnance, ou par la décision rendue sur le recours s'il y en a une (J67, R4). */
export const montantsFixesPar = (ordonnance: OrdonnanceRemuneration): MontantsFixes => montantsDe(decisionRendue(ordonnance, null) ?? ordonnance)

/** Montants taxés : toutes les ordonnances rendues, notifiées ou non, avec la décision sur le recours s'il y en a une (J67, R4). */
export function droitsTaxes(mandatId: string, mandat: MandatRemunere, ordonnances: readonly OrdonnanceRemuneration[]): DroitsDuMandat {
  verifierOrdonnancesDuMandat(mandatId, ordonnances)
  return cumulerDroits(
    mandat,
    ordonnances.map((o) => ({ ordonnanceId: o.id, type: o.type, montants: montantsFixesPar(o) })),
  )
}
