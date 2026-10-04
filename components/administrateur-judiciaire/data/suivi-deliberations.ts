export type StatutDeliberation = 'en cours' | 'proche' | 'en retard' | 'terminée'

export type LigneDeliberation = [
  deliberation: string,
  assemblee: string,
  responsable: string,
  echeance: string,
  statut: StatutDeliberation,
]

/** Ordre des lignes conservé (tableau sans clé de ligne : la clé est l'index). */
export const DEMO_SUIVI_DELIBERATIONS: LigneDeliberation[] = [
  ['Travaux de ravalement', 'AG 2025 · Le Méridien', 'Marc Léautaud', '30/06/2026', 'en cours'],
  ['Changement de prestataire ascenseur', 'AG 2025 · Le Méridien', 'Awa Diallo', '10/06/2026', 'proche'],
  ['Recouvrement des impayés', 'AG 2024 · Les Tilleuls', 'Camille Noël', '15/05/2026', 'en retard'],
  ['Approbation des comptes 2024', 'AG 2025 · Le Clos des Vignes', 'Julien Marchand', '—', 'terminée'],
  ['Réfection toiture', 'AG 2025 · Les Tilleuls', 'Marc Léautaud', '20/06/2026', 'en cours'],
]

export const PILL_PAR_STATUT_DELIBERATION: Record<StatutDeliberation, 'amber' | 'gold' | 'rust' | 'sage'> = {
  'en cours': 'amber',
  proche: 'gold',
  'en retard': 'rust',
  terminée: 'sage',
}
