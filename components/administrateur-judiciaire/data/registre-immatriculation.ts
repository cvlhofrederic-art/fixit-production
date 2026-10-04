export type StatutImmatriculation = 'à jour' | 'à actualiser' | 'manquante'

/** Immatriculation au registre : lots en chaîne, colonne de mise à jour en texte libre (date ou mention). */
export type ImmatriculationDemo = [
  copropriete: string,
  numero: string,
  lots: string,
  derniereMiseAJour: string,
  statut: StatutImmatriculation,
]

export const DEMO_REGISTRE_IMMATRICULATION: ImmatriculationDemo[] = [
  ['Résidence Le Méridien', 'AA-1234-567', '36', '12/03/2026', 'à jour'],
  ['Le Clos des Vignes', 'BB-2345-678', '48', 'À mettre à jour', 'à actualiser'],
  ['Copropriété Les Tilleuls', 'CC-3456-789', '24', '05/05/2026', 'à jour'],
  ['Villa Montaigne', '—', '12', 'Non immatriculée', 'manquante'],
]

export const PILL_PAR_STATUT_IMMATRICULATION: Record<StatutImmatriculation, 'sage' | 'amber' | 'rust'> = {
  'à jour': 'sage',
  'à actualiser': 'amber',
  manquante: 'rust',
}
