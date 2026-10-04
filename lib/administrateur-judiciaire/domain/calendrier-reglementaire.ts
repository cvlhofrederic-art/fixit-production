import { joursAvantDateFr } from '@/lib/administrateur-judiciaire/domain/dates'

export type StatutEcheanceReglementaire = 'conforme' | 'en retard' | 'proche' | 'à venir'

/**
 * Statut d'une échéance du calendrier réglementaire au jour courant de l'application : « conforme » est conservé,
 * sinon en retard (date passée), proche (30 jours au plus) ou à venir (y compris date absente ou invalide).
 */
export const statutEcheanceReglementaire = (dateFr: string, statutInitial: string): StatutEcheanceReglementaire => {
  if (statutInitial === 'conforme') return 'conforme'
  const jours = joursAvantDateFr(dateFr)
  return jours == null ? 'à venir' : jours < 0 ? 'en retard' : jours <= 30 ? 'proche' : 'à venir'
}
