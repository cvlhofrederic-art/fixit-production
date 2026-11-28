import { dateIsoVersFr, estDateIsoValide, messagePlausibilite, plausibiliteDate } from '@/lib/administrateur-judiciaire/domain/dates'
import { parserMontant } from '@/lib/administrateur-judiciaire/domain/import/csv'
import type { ArreteRapprochement } from '@/lib/administrateur-judiciaire/domain/rapprochement-bancaire'

/**
 * Solde d'ouverture d'un compte bancaire du syndicat (PR 799, point 2 : « Aucun solde d'ouverture » ; choix A validé par
 * le référent métier, décision du 26/11/2026 : « Saisir un solde d'ouverture (date et montant) pour chaque compte »).
 * Fonctions pures, montant en CENTIMES ENTIERS signés (négatif : découvert), date ISO (AAAA-MM-JJ), sans écran.
 *
 * Ce que dit le solde d'ouverture : le solde du compte AU DÉBUT du jour indiqué, avant les mouvements de ce jour (le
 * solde de fin de la veille). À partir de ce jour, le solde du compte est ce montant plus les lignes de relevé datées de
 * ce jour ou d'après (db/sous-comptes-banque.ts, soldeCompteBancaireCentimes) ; les lignes datées avant sont tenues pour
 * déjà comprises dans ce montant et n'y entrent pas une seconde fois (elles sont comptées et signalées). Avant ce jour,
 * rien ne change : le solde reste la somme des lignes importées. Facultatif : un compte ouvert pendant la mission part
 * de zéro.
 *
 * Représentation retenue : deux champs du compte (table « banques », non indexés), lus par les calculs. AUCUNE écriture
 * n'est passée au journal. Ce n'est ni un avis juridique ni un avis comptable ; raisons, textes lus sur Légifrance le
 * 27/11/2026 (versions en vigueur à cette date) :
 * - arrêté du 14 mars 2005 relatif aux comptes du syndicat des copropriétaires, art. 1 : « Les écritures sont passées
 *   selon le système dit "en partie double" ». Une écriture d'ouverture au seul compte 512 demande donc une contrepartie ;
 * - même arrêté, art. 7 (version du 31/12/2020) et art. 8 : la nomenclature est fermée (classes 1 à 7), sans compte de
 *   bilan d'ouverture. La contrepartie exacte d'un solde de banque repris est l'ensemble des autres soldes repris du
 *   gestionnaire précédent (copropriétaires 450, fournisseurs 40, provisions et avances de la classe 1), c'est-à-dire
 *   l'état financier après répartition (décret n° 2005-240 du 14 mars 2005, art. 8 et annexe 1) et l'état des comptes
 *   que l'ancien syndic remet après apurement et clôture, la situation de trésorerie et les références des comptes
 *   bancaires étant dues sous quinze jours (loi n° 65-557 du 10 juillet 1965, art. 18-2, version du 11/04/2024). Le
 *   module ne reprend pas encore ces soldes ;
 * - à défaut, la seule contrepartie disponible serait le compte 47 « Compte d'attente » (471, 472), que l'art. 10 du même
 *   arrêté veut « soldé à la fin de l'exercice ou à défaut justifié ligne à ligne », et une écriture passée ne se corrige
 *   que par « une écriture contraire » (art. 5). Y loger le solde d'ouverture, ou choisir un autre compte, est une
 *   pratique du cabinet, qui n'est pas arrêtée.
 * Le choix le plus prudent est donc de ne rien écrire au journal tant que la reprise des soldes n'existe pas : le solde
 * d'ouverture est une donnée du compte, modifiable tant qu'aucun arrêté clôturé ne repose sur elle. Quand la reprise
 * comptable (à-nouveaux de tous les comptes) sera faite, il deviendra la ligne 512 de cette écriture équilibrée. Point à
 * soumettre au référent métier.
 *
 * Règles :
 * - saisie (lireSaisieSoldeOuverture) : montant et date vont ensemble ; date valide, ni après aujourd'hui ni d'une année
 *   improbable (un solde d'ouverture constate un solde passé, comme un arrêté) ;
 * - changement (verifierChangementSoldeOuverture) : refusé sur un compte clôturé, et tant qu'un arrêté clôturé couvre la
 *   date du solde d'ouverture (l'ancienne ou la nouvelle) : son solde compta figé repose sur lui, il faut le déclôturer
 *   d'abord. Un arrêté en cours se recalcule ; un arrêté abandonné ne compte dans aucune règle. La déclôture étant
 *   refusée tant qu'un arrêté est en cours sur le compte (domain/rapprochement-bancaire.ts, decloturerArrete), le refus
 *   dit alors d'abandonner d'abord cet arrêté en cours.
 *
 * Point ouvert, à faire trancher par le référent métier (relecture du 27/11/2026) : un solde d'ouverture daté APRÈS un
 * arrêté clôturé est accepté sans contrôle. Le solde du compte à la date de cet arrêté est pourtant connu (son solde
 * banque, égal au solde compta à la clôture) : un solde d'ouverture qui ne le prolonge pas fait sauter le solde du compte
 * après une période rapprochée, sans écriture ni ligne de relevé. Trois règles possibles, aucune n'est retenue ici :
 * refuser un solde d'ouverture daté après le dernier arrêté clôturé du compte ; exiger qu'il soit égal au solde banque
 * de cet arrêté plus les lignes importées entre les deux dates (ce qui refuse aussi le cas, possible, d'un relevé
 * intermédiaire jamais importé) ; l'accepter avec un avertissement à l'écran. Même question, à l'envers, pour la clôture
 * d'un arrêté daté avant un solde d'ouverture déjà saisi.
 */

/** Solde d'ouverture d'un compte : son solde au début du jour `au`, avant les mouvements de ce jour. */
export interface SoldeOuverture {
  /** Centimes entiers signés ; négatif : découvert. */
  centimes: number
  /** AAAA-MM-JJ. */
  au: string
}

/** Saisie du formulaire : montant en euros (« 1 234,56 », « -35,5 ») et date du champ date (AAAA-MM-JJ) ; vides : aucun. */
export interface SaisieSoldeOuverture {
  montant: string | null
  au: string | null
}

/** Montant saisi en euros → centimes entiers signés ; illisible ou plus de deux décimales : null. */
function centimesSaisis(texte: string): number | null {
  const euros = parserMontant(texte)
  if (euros === null) return null
  const centimes = Math.round(euros * 100)
  return Math.abs(euros * 100 - centimes) < 1e-6 ? centimes : null
}

/**
 * Solde d'ouverture d'une saisie, ou null quand le montant et la date sont vides (aucun solde d'ouverture). Lève l'erreur
 * affichée : montant sans date ou date sans montant, montant illisible, date invalide, après `aujourdhui` ou d'une année
 * improbable.
 */
export function lireSaisieSoldeOuverture(saisie: SaisieSoldeOuverture | null, aujourdhui: string): SoldeOuverture | null {
  const montant = (saisie?.montant ?? '').trim()
  const au = (saisie?.au ?? '').trim()
  if (montant === '' && au === '') return null
  if (montant === '') throw new Error('Solde d’ouverture : montant à saisir, ou vider la date.')
  if (au === '') throw new Error('Solde d’ouverture : date à saisir (champ « au »), ou vider le montant.')
  const centimes = centimesSaisis(montant)
  if (centimes === null)
    throw new Error('Solde d’ouverture illisible : montant en euros attendu (ex. 1 234,56 ; négatif pour un découvert).')
  if (!estDateIsoValide(au)) throw new Error('Date du solde d’ouverture invalide : JJ/MM/AAAA attendu.')
  const anomalie = plausibiliteDate(au, aujourdhui, { futurAdmis: false })
  if (anomalie) throw new Error(messagePlausibilite('Solde d’ouverture daté', au, anomalie))
  return { centimes, au }
}

/** Champs du compte qui portent son solde d'ouverture (table « banques »). */
export interface ChampsSoldeOuverture {
  soldeOuvertureCentimes?: unknown
  soldeOuvertureAu?: unknown
}

/**
 * Solde d'ouverture enregistré sur un compte ; null quand le compte n'en a pas, ou quand ses champs n'en ont pas la forme
 * (centimes entiers et date valide ensemble : une ligne écrite hors de l'écran n'entre dans aucun solde).
 */
export function soldeOuvertureEnregistre(compte: ChampsSoldeOuverture): SoldeOuverture | null {
  const { soldeOuvertureCentimes: centimes, soldeOuvertureAu: au } = compte
  if (typeof centimes !== 'number' || !Number.isInteger(centimes)) return null
  if (typeof au !== 'string' || !estDateIsoValide(au)) return null
  return { centimes, au }
}

/** Même solde d'ouverture : même montant et même date, ou aucun des deux côtés. */
export const memeSoldeOuverture = (a: SoldeOuverture | null, b: SoldeOuverture | null): boolean =>
  a === null || b === null ? a === b : a.centimes === b.centimes && a.au === b.au

export interface ChangementSoldeOuverture {
  /** Solde d'ouverture enregistré ; null : aucun. */
  avant: SoldeOuverture | null
  /** Solde d'ouverture demandé ; null : aucun (suppression). */
  apres: SoldeOuverture | null
  /** Compte clôturé : false. */
  compteActif: boolean
  /** Arrêtés du compte qui comptent (en cours, clôturés) ; jamais les arrêtés abandonnés. Un seul est en cours, au plus. */
  arretes: readonly Pick<ArreteRapprochement, 'dateArrete' | 'statut'>[]
}

/**
 * Refuse, avec le message affiché, de saisir, modifier ou retirer le solde d'ouverture d'un compte clôturé, ou d'un compte
 * dont un arrêté clôturé couvre la date du solde d'ouverture, l'ancienne ou la nouvelle (arrêté daté de ce jour ou
 * d'après) : le solde compta figé de cet arrêté a été calculé avec l'ancien solde d'ouverture, ou sans le nouveau. Sans
 * changement, rien n'est refusé. Le refus dit la marche à suivre en entier : déclôturer, après avoir abandonné l'arrêté
 * en cours du compte s'il y en a un (tant qu'il existe, la déclôture est refusée elle aussi).
 */
export function verifierChangementSoldeOuverture({ avant, apres, compteActif, arretes }: ChangementSoldeOuverture): void {
  if (memeSoldeOuverture(avant, apres)) return
  if (!compteActif) throw new Error('Compte bancaire clôturé : son solde d’ouverture ne se modifie plus.')
  const dates = [avant?.au, apres?.au].filter((date): date is string => date !== undefined)
  const premiere = dates.reduce((min, date) => (date < min ? date : min), dates[0])
  const couvrants = arretes
    .filter((arrete) => arrete.statut === 'Clôturé' && arrete.dateArrete >= premiere)
    .map((arrete) => arrete.dateArrete)
    .sort((a, b) => b.localeCompare(a))
  if (couvrants.length === 0) return
  const dernier = dateIsoVersFr(couvrants[0])
  const enCours = arretes.find((arrete) => arrete.statut === 'En cours')
  const apresAbandon = enCours ? ` (après avoir abandonné l’arrêté en cours du ${dateIsoVersFr(enCours.dateArrete)})` : ''
  throw new Error(
    couvrants.length === 1
      ? `Solde d’ouverture non modifié : l’arrêté clôturé du ${dernier} couvre sa date. Déclôturer d’abord cet arrêté${apresAbandon}.`
      : `Solde d’ouverture non modifié : ${couvrants.length} arrêtés clôturés couvrent sa date. Les déclôturer d’abord, en commençant par celui du ${dernier}${apresAbandon}.`,
  )
}
