export type EtatAscenseur = 'conforme' | 'proche' | 'en retard'

/** Appareil du parc : dates « JJ/MM/AAAA » figées (non recalculées par rapport au jour courant). */
export type AscenseurDemo = [
  appareil: string,
  copropriete: string,
  entretien: string,
  dernierControle: string,
  prochainControle: string,
  etat: EtatAscenseur,
]

export const DEMO_PARC_ASCENSEURS: AscenseurDemo[] = [
  ['Ascenseur A', 'Le Méridien', 'Otis', '12/05/2026', '12/05/2027', 'conforme'],
  ['Ascenseur B', 'Le Méridien', 'Otis', '12/05/2026', '12/05/2027', 'conforme'],
  ['Ascenseur', 'Le Clos des Vignes', 'Kone', '03/03/2026', '03/03/2027', 'proche'],
  ['Ascenseur', 'Villa Montaigne', 'Schindler', '18/01/2024', '18/01/2026', 'en retard'],
]

export const PILL_PAR_ETAT_ASCENSEUR: Record<EtatAscenseur, 'sage' | 'amber' | 'rust'> = {
  conforme: 'sage',
  proche: 'amber',
  'en retard': 'rust',
}
