/** Workflow de l'ordre de mission « Fuite colonne — Le Méridien » (canal de communication). */

export type EtatMissionFuite = 'signale' | 'reported' | 'compta'

export type StatutEtapeMission = 'done' | 'now' | 'todo'

export type EtapeMission = [libelle: string, date: string, statut: StatutEtapeMission]

/**
 * Étapes de la mission selon son état (« signale » par défaut) ; l'intervention est faite dès « reported ».
 * Remplace, pour la mission « mfuite », ses 4 étapes statiques.
 */
export const etapesWorkflowMissionFuite = (etat?: EtatMissionFuite | null): EtapeMission[] => {
  const etatCourant = etat || 'signale'
  const interventionFaite = etatCourant === 'reported' || etatCourant === 'compta'
  return [
    ['Signalement (app)', '19/06', 'done'],
    [
      'Dispatch gestionnaire',
      etatCourant === 'signale' ? 'En cours' : '19/06',
      etatCourant === 'signale' ? 'now' : 'done',
    ],
    [
      'Intervention artisan',
      interventionFaite ? '19/06' : '—',
      etatCourant === 'signale' ? 'todo' : interventionFaite ? 'done' : 'now',
    ],
    ['Validation artisan', interventionFaite ? '19/06' : '—', interventionFaite ? 'done' : 'todo'],
    [
      'Transmis comptabilité',
      etatCourant === 'compta' ? '19/06' : '—',
      etatCourant === 'compta' ? 'done' : 'todo',
    ],
  ]
}
