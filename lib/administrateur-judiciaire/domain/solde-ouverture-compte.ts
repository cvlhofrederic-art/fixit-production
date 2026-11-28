import { dateIsoVersFr, estDateIsoValide, messagePlausibilite, plausibiliteDate } from '@/lib/administrateur-judiciaire/domain/dates'
import { parserMontant } from '@/lib/administrateur-judiciaire/domain/import/csv'
import type { ArreteRapprochement } from '@/lib/administrateur-judiciaire/domain/rapprochement-bancaire'

/**
 * Solde d'ouverture d'un compte bancaire du syndicat (PR 799, point 2 : « Aucun solde d'ouverture » ; choix A validé par
 * le référent métier, décision du 26/11/2026 : « Saisir un solde d'ouverture (date et montant) pour chaque compte »).
 * Fonctions pures, montant en CENTIMES ENTIERS signés (négatif : découvert), date ISO (AAAA-MM-JJ), sans écran.
 *
 * Ce que dit le solde d'ouverture (réponse du référent métier du 28/11/2026, PR 848, point 2, choix B : « Passer au
 * solde de fin de journée : montant et date se recopient tels quels depuis le relevé ») : le solde du compte À LA FIN du
 * jour indiqué, les mouvements de ce jour compris. C'est ainsi qu'un relevé CFONB 120 ou camt.053 écrit son ancien
 * solde, daté de la veille de son premier jour. À partir de ce jour, le solde du compte est ce montant plus les lignes
 * de relevé datées APRÈS ce jour (db/sous-comptes-banque.ts, soldeCompteBancaireCentimes) ; les lignes datées de ce jour
 * ou d'avant sont tenues pour déjà comprises dans ce montant et n'y entrent pas une seconde fois : elles restent
 * importées, comptées et signalées (même réponse, point 3, choix A). Avant ce jour, le solde du compte n'est pas connu :
 * un arrêté n'y est pas ouvert (point 5). Facultatif : un compte ouvert pendant la mission part de zéro.
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
 *   dit alors d'abandonner d'abord cet arrêté en cours ;
 * - solde d'ouverture et arrêtés (réponses du référent métier du 28/11/2026, PR 848, points 4 et 5, choix A) : « un solde
 *   d'ouverture se date avant le premier arrêté du compte », et un arrêté daté avant lui est refusé, « solde inconnu
 *   avant le JJ/MM/AAAA ». Les deux règles disent la même chose de chaque côté : aucun arrêté qui compte n'est daté avant
 *   le solde d'ouverture de son compte. Un solde d'ouverture daté après un arrêté ferait sauter le solde du compte après
 *   une période rapprochée, sans écriture ni ligne de relevé (verifierChangementSoldeOuverture le refuse) ; un arrêté
 *   daté avant lui serait calculé sur un solde inconnu (refusArreteAvantOuverture, appliquée à l'ouverture et à la
 *   clôture par db/rapprochements.ts). Le même jour est admis des deux côtés : avec un solde de fin de journée, l'arrêté
 *   de ce jour a pour solde compta le solde d'ouverture lui-même. La réponse ne nommait que l'arrêté clôturé : l'arrêté
 *   en cours est traité de même, faute de quoi il resterait un arrêté en cours daté avant le solde d'ouverture, que sa
 *   clôture refuserait (choix à soumettre au référent métier) ;
 * - solde d'ouverture illisible (même réponse, point 8, choix A) : des champs enregistrés hors de l'écran, sans date ou
 *   mal formés, n'entrent toujours dans aucun solde, mais soldeOuvertureIllisible les reconnaît, pour que l'écran les
 *   signale par un bandeau au lieu de les ignorer en silence.
 */

/** Solde d'ouverture d'un compte : son solde à la fin du jour `au`, les mouvements de ce jour compris. */
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

/**
 * Vrai quand le compte porte un solde d'ouverture illisible : un des deux champs est renseigné, sans que l'ensemble ait
 * la forme d'un solde d'ouverture (montant sans date, date sans montant, centimes non entiers, date mal formée). Une
 * telle ligne ne peut venir que d'une écriture hors de l'écran. Champs absents ou à null : aucun solde d'ouverture, rien
 * à signaler.
 */
export function soldeOuvertureIllisible(compte: ChampsSoldeOuverture): boolean {
  const renseigne = (compte.soldeOuvertureCentimes ?? null) !== null || (compte.soldeOuvertureAu ?? null) !== null
  return renseigne && soldeOuvertureEnregistre(compte) === null
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

type ArreteDuCompte = ChangementSoldeOuverture['arretes'][number]

/** Règle dite à la fin du refus d'un solde d'ouverture daté après un arrêté du compte (mots du référent métier ; le même jour est admis). */
const REGLE_PREMIER_ARRETE = 'Un solde d’ouverture se date avant le premier arrêté du compte, ou le même jour.'

/**
 * Refus d'un solde d'ouverture daté après un arrêté du compte, clôturé ou en cours (réponse du référent métier du
 * 28/11/2026, PR 848, point 4, choix A : « Le refuser : un solde d'ouverture se date avant le premier arrêté du
 * compte ») ; null s'il est daté au plus tard du premier arrêté (le même jour est admis : solde de fin de journée), si le
 * compte n'a aucun arrêté qui compte, ou si le solde d'ouverture est retiré.
 */
function refusOuvertureApresArrete(apres: SoldeOuverture | null, arretes: readonly ArreteDuCompte[]): string | null {
  if (apres === null) return null
  const premier = arretes.reduce<ArreteDuCompte | null>((min, arrete) => (min === null || arrete.dateArrete < min.dateArrete ? arrete : min), null)
  if (premier === null || premier.dateArrete >= apres.au) return null
  const arrete = `${dateIsoVersFr(premier.dateArrete)}, ${premier.statut === 'En cours' ? 'en cours' : 'clôturé'}`
  return `Solde d’ouverture refusé : daté du ${dateIsoVersFr(apres.au)}, après le premier arrêté du compte (${arrete}). ${REGLE_PREMIER_ARRETE}`
}

/**
 * Refus d'un arrêté daté avant le solde d'ouverture de son compte (même réponse, point 5, choix A : « Le refuser :
 * "solde inconnu avant le JJ/MM/AAAA" ») ; null pour un arrêté daté du jour du solde d'ouverture (solde de fin de
 * journée : son solde compta est ce solde) ou d'après, et pour un compte sans solde d'ouverture. `dateArrete` :
 * AAAA-MM-JJ valide. Même forme que les règles communes des arrêtés (refus dit en texte, ou null) ; appliquée par
 * db/rapprochements.ts, qui lit le compte, à l'ouverture et à la clôture d'un arrêté.
 */
export function refusArreteAvantOuverture(dateArrete: string, ouverture: SoldeOuverture | null): string | null {
  if (ouverture === null || dateArrete >= ouverture.au) return null
  return `Arrêté daté du ${dateIsoVersFr(dateArrete)} : solde inconnu avant le ${dateIsoVersFr(ouverture.au)}, date du solde d’ouverture du compte.`
}

/**
 * Refuse, avec le message affiché, de saisir, modifier ou retirer le solde d'ouverture d'un compte clôturé, ou d'un compte
 * dont un arrêté clôturé couvre la date du solde d'ouverture, l'ancienne ou la nouvelle (arrêté daté de ce jour ou
 * d'après) : le solde compta figé de cet arrêté a été calculé avec l'ancien solde d'ouverture, ou sans le nouveau. Sans
 * changement, rien n'est refusé. Le refus dit la marche à suivre en entier : déclôturer, après avoir abandonné l'arrêté
 * en cours du compte s'il y en a un (tant qu'il existe, la déclôture est refusée elle aussi).
 * Refuse aussi, et d'abord, un solde d'ouverture daté APRÈS un arrêté du compte, clôturé ou en cours (réponse du
 * référent métier du 28/11/2026, PR 848, point 4, choix A ; voir l'en-tête) : la date elle-même est refusée, déclôturer
 * n'y changerait rien. Le refus nomme le premier arrêté du compte. Le même jour n'est pas « après ». Retirer le solde
 * d'ouverture, ou le laisser tel quel, n'est jamais refusé par cette règle.
 */
export function verifierChangementSoldeOuverture({ avant, apres, compteActif, arretes }: ChangementSoldeOuverture): void {
  if (memeSoldeOuverture(avant, apres)) return
  if (!compteActif) throw new Error('Compte bancaire clôturé : son solde d’ouverture ne se modifie plus.')
  const refusDate = refusOuvertureApresArrete(apres, arretes)
  if (refusDate) throw new Error(refusDate)
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
