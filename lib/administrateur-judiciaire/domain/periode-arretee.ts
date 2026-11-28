import { dateIsoVersFr } from '@/lib/administrateur-judiciaire/domain/dates'
import type { ArreteRapprochement } from '@/lib/administrateur-judiciaire/domain/rapprochement-bancaire'

/**
 * Période déjà arrêtée protégée (décision du 26/11/2026 du référent métier, PR 799, rb-04 A). Le solde compta d'un
 * arrêté clôturé est figé à la clôture (rb-03 A) : une ligne de relevé importée ensuite sur le compte, datée au plus
 * tard de cet arrêté, changerait après coup le solde de la période sans que l'arrêté le montre. L'import d'un tel relevé
 * est donc refusé, avec ce qu'il faut faire : déclôturer d'abord l'arrêté. Fonctions pures, sans écran ni base.
 * - Seul le dernier arrêté CLÔTURÉ du compte protège (toutes les lignes datées au plus tard de sa date, ce jour
 *   compris, comme le solde à la date de l'arrêté). Un arrêté en cours ne protège rien : son solde se recalcule
 *   jusqu'à la clôture. Un arrêté déclôturé est de nouveau en cours. Un arrêté abandonné n'arrive pas ici (autre type).
 * - Le relevé est refusé EN ENTIER, pas seulement les lignes concernées : les relevés importés ne sont mémorisés nulle
 *   part (point 10 de la PR 799), un import partiel suivi d'un second import après la déclôture ferait compter deux
 *   fois les lignes déjà entrées d'un relevé CFONB 120 ou camt.053 (leurs doublons ne sont pas écartés), et le solde
 *   contrôlé du relevé ne correspondrait plus aux lignes enregistrées.
 * - La déclôture est refusée tant qu'un arrêté est en cours sur le compte (decloturerArrete) : le motif nomme alors
 *   l'arrêté en cours à abandonner d'abord.
 * - Plusieurs arrêtés clôturés concernés (retour de relecture de la suite rb-04) : une ligne datée au plus tard d'un
 *   arrêté clôturé plus ancien entre aussi dans le solde figé de celui-là. Déclôturer le dernier ne suffit alors pas :
 *   seul le dernier arrêté clôturé se déclôture, et pas tant qu'un arrêté est en cours (decloturerArrete) ; l'arrêté
 *   déclôturé doit donc être abandonné, sans retour (abandonnerArrete), avant de déclôturer le précédent. Le motif le dit,
 *   au lieu de « déclôturer d'abord cet arrêté », qui menait à cet abandon sans l'annoncer. Libellé à valider par le
 *   référent métier.
 * Règle de gestion de VitFix, pas une règle de droit : ni le décret n° 2005-240 du 14/03/2005 ni l'arrêté du 14/03/2005
 * (comptes du syndicat) ne traitent du rapprochement bancaire ; l'intangibilité de l'art. 5 de l'arrêté vise la clôture
 * à la date d'arrêté des comptes de l'exercice (textes lus sur Légifrance le 27/11/2026 ; ni avis juridique ni comptable).
 */

/** Lignes d'un relevé datées dans la période arrêtée d'un compte. */
export interface LignesEnPeriodeArretee {
  /** Nombre de lignes datées au plus tard du dernier arrêté clôturé. */
  lignes: number
  /** Date de ce dernier arrêté clôturé (AAAA-MM-JJ). */
  dateArrete: string
  /** Date de l'arrêté en cours du compte, qui empêche la déclôture (AAAA-MM-JJ) ; null : aucun arrêté en cours. */
  arreteEnCours: string | null
  /**
   * Arrêtés clôturés du compte dont la période contient au moins une ligne, le dernier compris : ceux datés du jour de la
   * ligne la plus ancienne ou après. Tous sont à déclôturer pour importer le relevé ; 1 : le dernier suffit.
   */
  arretesConcernes: number
  /** Date du plus ancien de ces arrêtés (AAAA-MM-JJ) ; celle du dernier arrêté clôturé quand il est seul concerné. */
  plusAncienArrete: string
}

/** Dates des arrêtés clôturés d'un compte (AAAA-MM-JJ), de la plus ancienne à la plus récente. */
const datesDesClotures = (arretes: readonly ArreteRapprochement[], banqueId: string): string[] =>
  arretes
    .filter((arrete) => arrete.banqueId === banqueId && arrete.statut === 'Clôturé')
    .map((arrete) => arrete.dateArrete)
    .sort((a, b) => a.localeCompare(b))

/** Date du dernier arrêté clôturé d'un compte (AAAA-MM-JJ) ; null : aucune période arrêtée. */
export function dateDerniereCloture(arretes: readonly ArreteRapprochement[], banqueId: string): string | null {
  return datesDesClotures(arretes, banqueId).at(-1) ?? null
}

/**
 * Lignes datées au plus tard du dernier arrêté clôturé du compte, parmi les dates reçues (AAAA-MM-JJ, une par ligne
 * retenue) ; null : aucune, l'import est possible. Une date vide est comptée : l'écriture qu'elle donnerait entre dans
 * le solde de toute période (soldeCompteCentimes). Le constat compte aussi les arrêtés clôturés plus anciens dont la
 * période contient une ligne : leur solde figé changerait de la même façon.
 */
export function lignesEnPeriodeArretee(
  arretes: readonly ArreteRapprochement[],
  banqueId: string,
  dates: readonly string[],
): LignesEnPeriodeArretee | null {
  const clotures = datesDesClotures(arretes, banqueId)
  const dateArrete = clotures.at(-1)
  if (dateArrete === undefined) return null
  const enPeriode = dates.filter((date) => date <= dateArrete)
  if (enPeriode.length === 0) return null
  // Ligne la plus ancienne : tout arrêté clôturé daté de ce jour ou après la compte dans son solde.
  const plusAncienne = enPeriode.reduce((min, date) => (date < min ? date : min), enPeriode[0])
  const concernes = clotures.filter((date) => date >= plusAncienne)
  const enCours = arretes.find((arrete) => arrete.banqueId === banqueId && arrete.statut === 'En cours')
  return {
    lignes: enPeriode.length,
    dateArrete,
    arreteEnCours: enCours?.dateArrete ?? null,
    arretesConcernes: concernes.length,
    plusAncienArrete: concernes[0],
  }
}

/**
 * Motif du refus, tel que l'écran et la base le disent : lignes concernées, date de l'arrêté, quoi faire. Plusieurs
 * arrêtés clôturés concernés : leur nombre, le plus ancien, et ce que leur déclôture demande (voir l'en-tête).
 */
export function motifPeriodeArretee(constat: LignesEnPeriodeArretee): string {
  const dateArrete = dateIsoVersFr(constat.dateArrete)
  const lignes = constat.lignes > 1 ? `${constat.lignes} lignes sont datées` : `${constat.lignes} ligne est datée`
  if (constat.arretesConcernes > 1) {
    const dAbord = constat.arreteEnCours === null ? '' : `abandonner d’abord l’arrêté en cours du ${dateIsoVersFr(constat.arreteEnCours)}, puis `
    return (
      `${lignes} au plus tard du ${dateArrete}, date du dernier arrêté clôturé de ce compte, et ${constat.arretesConcernes} arrêtés ` +
      `clôturés sont concernés, jusqu’à celui du ${dateIsoVersFr(constat.plusAncienArrete)}. ` +
      'Aucune ligne du relevé n’est importée, et déclôturer le dernier arrêté ne suffit pas. Pour importer le relevé en entier : ' +
      `${dAbord}déclôturer ces arrêtés un par un, du plus récent au plus ancien, en abandonnant chaque arrêté déclôturé avant de ` +
      'déclôturer le précédent. Un abandon est définitif : l’arrêté abandonné est à refaire.'
    )
  }
  const quoiFaire =
    constat.arreteEnCours === null
      ? 'déclôturer d’abord cet arrêté'
      : `abandonner d’abord l’arrêté en cours du ${dateIsoVersFr(constat.arreteEnCours)}, déclôturer celui du ${dateArrete}`
  return (
    `${lignes} au plus tard du ${dateArrete}, date du dernier arrêté clôturé de ce compte. ` +
    `Aucune ligne du relevé n’est importée : ${quoiFaire}, puis importer le relevé en entier.`
  )
}

/** Refuse l'import d'un relevé dont une ligne est datée dans la période arrêtée du compte (erreur « Import refusé »). */
export function refuserImportEnPeriodeArretee(arretes: readonly ArreteRapprochement[], banqueId: string, dates: readonly string[]): void {
  const constat = lignesEnPeriodeArretee(arretes, banqueId, dates)
  if (constat) throw new Error(`Import refusé : ${motifPeriodeArretee(constat)}`)
}
