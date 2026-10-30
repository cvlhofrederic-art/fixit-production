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
 * - D. 1967 art. 61-2 : ne sont pas impayées, pour le premier alinéa de l'art. 29-1 A, « les sommes devenues exigibles
 *   dans le mois précédant la date de clôture de l'exercice » ; art. 61-3 : la demande est portée devant le président du
 *   tribunal judiciaire du lieu de situation de l'immeuble ; art. 61-4 : pour l'information du conseil syndical, le syndic
 *   adresse sans délai à chacun de ses membres l'état des impayés avant répartition à la date de la clôture de l'exercice
 *   comptable ; art. 61-5 : l'information du dernier alinéa se fait par l'envoi d'une copie de la requête ou de
 *   l'assignation ;
 * - L. 1965 art. 29-1, I, al. 2 : l'administrateur provisoire reçoit « tous les pouvoirs du syndic dont le mandat cesse de
 *   plein droit sans indemnité » ; II, al. 2 : le président du tribunal judiciaire peut imputer tout ou partie des frais
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
 * - sommes exigibles en vertu de l'art. 14-1 : provisions du budget prévisionnel ; de l'art. 14-2-1 : cotisations au
 *   fonds de travaux ; les autres (dépenses hors budget de l'art. 14-2, notamment) ne comptent pas, pas plus qu'une somme
 *   exigible après la clôture ;
 * - « dans le mois précédant la date de clôture » : exigibles après le même quantième du mois précédent, jour de la
 *   clôture compris (clôture au 31 décembre : du 1er au 31 décembre) ; ces sommes restent dans les sommes exigibles, seul
 *   leur impayé est écarté (le décret ne vise que les sommes « impayées ») ;
 * - un vote de rejet est un vote : le texte vise l'absence de vote sur l'approbation, non l'absence d'approbation ; une
 *   résolution à voter, en attente de second vote ou reportée n'est pas un vote ; la décision de l'administrateur
 *   provisoire n'est pas un vote de l'assemblée ; les deux ans sont atteints au même quantième deux ans après le dernier
 *   vote (borné en fin de mois : 29/02 → 28/02) ;
 * - saisine par les personnes de l'al. 2 : au lendemain du mois laissé au syndic après la clôture pour les impayés ; dès
 *   les deux ans atteints pour les comptes ; sans syndic (administrateur provisoire d'un syndicat qui en est dépourvu, D.
 *   1967 art. 47, ou de l'art. 29-1, dont la désignation fait cesser le mandat du syndic), dès la clôture ;
 * - une requête au juge enregistrée le jour du déclenchement ou après, et au plus tard à la date de référence, traite
 *   l'alerte ;
 * - syndic désigné par le président du tribunal judiciaire (D. 1967 art. 46) : il est le syndic, l'obligation lui
 *   incombe.
 *
 * 🔴 Non établi (à trancher par Frédéric ou Hugo) :
 * - période des sommes exigibles : le texte ne la fixe pas ; VitFix retient celles devenues exigibles au cours de
 *   l'exercice clos et compte dans les impayés tous les impayés à la clôture, arriérés des exercices antérieurs compris
 *   (lecture la plus protectrice) ; quand il y en a, l'alerte est à confirmer ;
 * - « lots » : tous les lots, ou les seuls lots principaux ? Le texte ne le précise pas ; VitFix prend le nombre fourni ;
 * - aucun vote connu sur l'approbation des comptes : depuis quand compter les deux ans ? Le critère reste non établi tant
 *   que la date de la dernière assemblée qui s'est prononcée n'est pas saisie ;
 * - administrateur provisoire de l'art. 29-1 : il a reçu tous les pouvoirs du syndic (art. 29-1, I, al. 2), mais aucun
 *   texte relu ne dit si l'obligation de l'art. 29-1 A lui incombe, alors que le juge est déjà saisi et que la procédure du
 *   mandataire ad hoc précède l'administration provisoire (art. 29-1 B ; art. 29-1, III) ; investi de tous les pouvoirs de
 *   l'assemblée, il approuve les comptes sans vote de celle-ci : le critère des deux ans joue-t-il encore ? VitFix établit
 *   le constat, utile aussi à l'imputation des frais au syndic défaillant (art. 29-1, II, al. 2), sans en tirer
 *   d'obligation ;
 * - administrateur provisoire de l'art. 47 (syndicat dépourvu de syndic) : en l'absence de syndic, l'al. 2 ouvre la
 *   saisine aux personnes qu'il énumère ; aucun texte relu ne dit si l'obligation du syndic incombe à l'administrateur
 *   provisoire, dont la mission est celle de l'ordonnance.
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

/** Provision du budget (L. 1965 art. 14-1), cotisation au fonds de travaux (art. 14-2-1), autre somme (hors assiette). */
export const NATURES_SOMME_EXIGIBLE = ['provision_budget', 'cotisation_fonds_travaux', 'autre'] as const
export type NatureSommeExigible = (typeof NATURES_SOMME_EXIGIBLE)[number]

/** Sommes exigibles « en vertu des articles 14-1 et 14-2-1 ». */
const NATURES_COMPTEES: readonly NatureSommeExigible[] = ['provision_budget', 'cotisation_fonds_travaux']

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
  nombreLots: number
  exercices?: readonly ExerciceAlerte[]
  /** Votes de l'assemblée sur l'approbation des comptes (résolution et date de l'assemblée). */
  votes?: readonly VoteApprobationComptes[]
  /** Décisions annuelles : une approbation des comptes adoptée par l'assemblée est un vote. */
  decisions?: readonly DecisionAnnuelle[]
  /** Régime du mandat de justice en cours ; absent ou null : aucun (syndic). */
  regime?: Regime | null
  /** Requête au président du tribunal judiciaire pour la désignation d'un mandataire ad hoc ; absente ou null : aucune. */
  saisineLe?: string | null
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
  /** Part des impayés retenus qui vient d'exercices antérieurs (🔴 assiette à confirmer). */
  arrieresCentimes: number
  message: string
}

export interface CritereComptes291A {
  etat: EtatCritere291A
  dernierVoteLe: string | null
  /** Date à laquelle le délai sans vote est atteint ; null : aucun vote connu. */
  atteintLe: string | null
  message: string
}

export interface AlerteMandataireAdHoc {
  coproprieteId: string
  date: string
  declenchee: boolean
  /** Date du premier critère atteint ; null : aucun. */
  declencheeLe: string | null
  /** Requête au juge enregistrée depuis le déclenchement. */
  saisineFaite: boolean
  /** Date à partir de laquelle les personnes de l'al. 2 peuvent saisir le juge ; null : aucun critère atteint. */
  saisineParDautresLe: string | null
  impayes: CritereImpayes291A
  comptes: CritereComptes291A
  /** Constats des critères atteints ; vide si l'alerte n'est pas déclenchée. */
  message: string
  /** Ce que prévoit le texte selon le régime. */
  conduite: string
  fondement: string
  /** Point 🔴 en jeu : mandat de justice sans texte, ou arriérés comptés dans les impayés. */
  aConfirmer: boolean
}

const fr = dateIsoVersFr
const euros = (centimes: number): string => formatEurosCentimes(centimes / 100)
const estAbsent = (valeur: unknown): boolean => valeur === undefined || valeur === null

function verifierDate(valeur: unknown, quoi: string): asserts valeur is string {
  if (!estDateIsoValide(valeur)) throw new Error(`${quoi} invalide (${String(valeur)}) : AAAA-MM-JJ attendu.`)
}

const POURCENTAGES: readonly (keyof ParametresAlerte291A)[] = ['seuilPourcent', 'seuilGrandeCoproprietePourcent']

function verifierParametres(parametres: ParametresAlerte291A): void {
  for (const [nom, valeur] of Object.entries(parametres) as [keyof ParametresAlerte291A, number][]) {
    const borneBasse = POURCENTAGES.includes(nom) ? 1 : 0
    const borneHaute = POURCENTAGES.includes(nom) ? 100 : Number.MAX_SAFE_INTEGER
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
  if (!estAbsent(entree.saisineLe)) verifierDate(entree.saisineLe, 'Date de la requête au juge')
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
    if (!NATURES_COMPTEES.includes(somme.nature) || somme.exigibleLe > exercice.cloture) continue
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
    total.arrieres > 0 ? `dont ${euros(total.arrieres)} d'arriérés des exercices antérieurs (assiette à confirmer)` : null,
  ].filter((p): p is string => p !== null)
  const suite = precisions.length > 0 ? `, ${precisions.join(', ')}` : ''
  return `Impayés à la clôture du ${fr(exercice.cloture)} (exercice ${exercice.nom}) : ${euros(total.impayes)} pour ${euros(total.exigibles)} de sommes exigibles, soit ${pourcent} % (seuil ${seuil} %)${suite}.`
}

const seuilApplicable = (nombreLots: number, parametres: ParametresAlerte291A): number =>
  nombreLots > parametres.lotsGrandeCopropriete ? parametres.seuilGrandeCoproprietePourcent : parametres.seuilPourcent

function dernierExerciceClos(exercices: readonly ExerciceAlerte[], date: string): ExerciceAlerte | null {
  const clos = exercices.filter((e) => e.exercice.cloture < date).sort((a, b) => a.exercice.cloture.localeCompare(b.exercice.cloture))
  return clos.at(-1) ?? null
}

function critereImpayes(entree: EntreeAlerteMandataireAdHoc, date: string, parametres: ParametresAlerte291A): CritereImpayes291A {
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

const ETATS_VOTE: readonly EtatResolution[] = ['adoptee', 'rejetee']

/** Dates des votes de l'assemblée sur l'approbation des comptes, au plus tard à la date de référence. */
function datesDeVote(entree: EntreeAlerteMandataireAdHoc, date: string): string[] {
  const votes = (entree.votes ?? []).filter((v) => ETATS_VOTE.includes(v.etat)).map((v) => v.date)
  const decisions = (entree.decisions ?? [])
    .filter((d) => d.type === 'approbation_comptes' && d.source.origine === 'assemblee')
    .map((d) => d.date)
  return [...votes, ...decisions].filter((d) => d <= date)
}

function critereComptes(entree: EntreeAlerteMandataireAdHoc, date: string, parametres: ParametresAlerte291A): CritereComptes291A {
  const dates = datesDeVote(entree, date)
  if (dates.length === 0)
    return {
      etat: 'non_etabli',
      dernierVoteLe: null,
      atteintLe: null,
      message:
        "Aucun vote de l'assemblée sur l'approbation des comptes n'est connu : saisir la date de la dernière assemblée qui s'est prononcée (adoption ou rejet).",
    }
  const dernier = dates.reduce((a, b) => (b > a ? b : a))
  const atteintLe = ajouterMois(dernier, parametres.sansVoteMois)
  const duree = `${parametres.sansVoteMois} mois sans vote`
  if (date >= atteintLe)
    return {
      etat: 'atteint',
      dernierVoteLe: dernier,
      atteintLe,
      message: `Aucun vote de l'assemblée sur l'approbation des comptes depuis le ${fr(dernier)} : ${duree} atteints le ${fr(atteintLe)}.`,
    }
  return {
    etat: 'non_atteint',
    dernierVoteLe: dernier,
    atteintLe,
    message: `Dernier vote de l'assemblée sur l'approbation des comptes le ${fr(dernier)} : sans nouveau vote, ${duree} atteints le ${fr(atteintLe)}.`,
  }
}

// ─── Conduite selon le régime ───────────────────────────────────────────────────────────────

interface Conduite {
  texte: string
  fondement: string
  aConfirmer: boolean
  /** Sans syndic : la saisine par les personnes de l'al. 2 n'attend pas le mois laissé au syndic. */
  sansSyndic: boolean
}

const OBLIGATION_DU_SYNDIC =
  "informer le conseil syndical — pour les impayés, adresser sans délai à chacun de ses membres l'état des impayés avant répartition à la date de la clôture — et saisir sur requête le président du tribunal judiciaire du lieu de l'immeuble d'une demande de désignation d'un mandataire ad hoc"

const FONDEMENT_SYNDIC = 'L. 1965 art. 29-1 A, al. 1 ; D. 1967 art. 61-2 à 61-4'

const SAISINE_PAR_D_AUTRES =
  "le juge peut être saisi par des copropriétaires représentant ensemble au moins 15 % des voix ou le président du conseil syndical, un créancier sous les conditions du 2°, le représentant de l'État ou le procureur de la République, le maire, le président de l'EPCI compétent en matière d'habitat"

const CONDUITES: Record<Regime | 'syndic', Conduite> = {
  syndic: {
    texte: `Le syndic doit ${OBLIGATION_DU_SYNDIC}.`,
    fondement: FONDEMENT_SYNDIC,
    aConfirmer: false,
    sansSyndic: false,
  },
  sj: {
    texte: `Syndic désigné par le président du tribunal judiciaire : il est le syndic et doit ${OBLIGATION_DU_SYNDIC}.`,
    fondement: `${FONDEMENT_SYNDIC} ; D. 1967 art. 46`,
    aConfirmer: false,
    sansSyndic: false,
  },
  ap291: {
    texte:
      "Administrateur provisoire de l'art. 29-1 : il a reçu tous les pouvoirs du syndic, dont le mandat a cessé ; aucun texte relu ne dit si l'obligation de l'art. 29-1 A lui incombe, alors que le juge est déjà saisi (à confirmer). Le président du tribunal judiciaire peut imputer au syndic tout ou partie des frais de l'administration provisoire s'il n'a pas saisi le juge dans les conditions de l'art. 29-1 A, sur le rapport de l'administrateur provisoire.",
    fondement: 'L. 1965 art. 29-1 A ; art. 29-1, I, al. 2 et II, al. 2',
    aConfirmer: true,
    sansSyndic: true,
  },
  ap47: {
    texte: `Administrateur provisoire d'un syndicat dépourvu de syndic : en l'absence de syndic, ${SAISINE_PAR_D_AUTRES} ; aucun texte relu ne dit si l'obligation du syndic incombe à l'administrateur provisoire, dont la mission est celle de l'ordonnance (à confirmer).`,
    fondement: 'L. 1965 art. 29-1 A, al. 2 ; D. 1967 art. 47',
    aConfirmer: true,
    sansSyndic: true,
  },
}

/** Saisine par les personnes de l'al. 2 : impayés, au lendemain du mois laissé au syndic (dès la clôture sans syndic) ; comptes, dès les deux ans. */
function saisineParDautres(
  impayes: CritereImpayes291A,
  comptes: CritereComptes291A,
  conduite: Conduite,
  parametres: ParametresAlerte291A,
): string | null {
  const dates: (string | null)[] = []
  if (comptes.etat === 'atteint') dates.push(comptes.atteintLe)
  if (impayes.etat === 'atteint' && impayes.cloture !== null)
    dates.push(conduite.sansSyndic ? impayes.cloture : ajouterJours(ajouterMois(impayes.cloture, parametres.delaiSyndicMois), 1))
  return plusTot(dates)
}

/**
 * Alerte de l'art. 29-1 A à une date : impayés à la clôture du dernier exercice clos (seuil de 25 %, 15 % au-delà de deux
 * cents lots, sommes du dernier mois écartées) et absence de vote de l'assemblée sur l'approbation des comptes depuis au
 * moins deux ans (un rejet est un vote). Renvoie chaque critère, la date du déclenchement, la requête éventuelle, la date
 * d'ouverture de la saisine aux personnes de l'al. 2 et ce que prévoit le texte selon le régime. Lève une erreur sur une
 * saisie invalide ou des éléments d'un autre syndicat.
 */
export function alerteMandataireAdHoc(
  entree: EntreeAlerteMandataireAdHoc,
  date: string,
  parametres: ParametresAlerte291A = PARAMETRES_ALERTE_29_1_A,
): AlerteMandataireAdHoc {
  verifierDate(date, 'Date de référence')
  verifierParametres(parametres)
  verifierEntree(entree)
  const impayes = critereImpayes(entree, date, parametres)
  const comptes = critereComptes(entree, date, parametres)
  const conduite = CONDUITES[entree.regime ?? 'syndic']
  const atteints = [impayes, comptes].filter((c) => c.etat === 'atteint')
  const declencheeLe = plusTot([impayes.etat === 'atteint' ? impayes.cloture : null, comptes.etat === 'atteint' ? comptes.atteintLe : null])
  const saisineLe = entree.saisineLe ?? null
  return {
    coproprieteId: entree.coproprieteId,
    date,
    declenchee: declencheeLe !== null,
    declencheeLe,
    saisineFaite: declencheeLe !== null && saisineLe !== null && declencheeLe <= saisineLe && saisineLe <= date,
    saisineParDautresLe: saisineParDautres(impayes, comptes, conduite, parametres),
    impayes,
    comptes,
    message: atteints.map((c) => c.message).join(' '),
    conduite: conduite.texte,
    fondement: conduite.fondement,
    aConfirmer: conduite.aConfirmer || impayes.arrieresCentimes > 0,
  }
}
