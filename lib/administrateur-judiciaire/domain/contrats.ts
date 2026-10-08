import { estDateIsoValide } from '@/lib/administrateur-judiciaire/domain/dates'
import type { StatutContrat } from '@/lib/administrateur-judiciaire/domain/referentiels-vitfix'

/**
 * Contrats de la copropriété (intégration Gestéam, T14). Gestéam porte deux fenêtres de dates distinctes, qui ne
 * servent pas à la même chose : la fenêtre de tacite reconduction, et la fenêtre de mise en concurrence. Seule la
 * seconde répond à « quels contrats remettre en concurrence ».
 */

export interface ContratFenetres {
  id: string
  statut?: StatutContrat
  concurrenceDu?: string | null
  concurrenceAu?: string | null
}

/**
 * Contrats « En cours » dont la fenêtre de mise en concurrence contient la date (bornes incluses). Un contrat sans
 * fenêtre complète n'est pas retenu. Un contrat sans statut est traité comme en cours (contrats saisis avant
 * l'intégration). Lève une erreur si la date n'est pas AAAA-MM-JJ.
 */
export function contratsARemettreEnConcurrence<T extends ContratFenetres>(contrats: T[], dateIso: string): T[] {
  if (!estDateIsoValide(dateIso)) throw new Error(`Date invalide : « ${dateIso} » (attendu AAAA-MM-JJ).`)
  return contrats.filter(
    (contrat) =>
      (contrat.statut ?? 'En cours') === 'En cours' &&
      !!contrat.concurrenceDu &&
      !!contrat.concurrenceAu &&
      contrat.concurrenceDu <= dateIso &&
      dateIso <= contrat.concurrenceAu,
  )
}
