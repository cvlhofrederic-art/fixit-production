export type StatutFactureSaisie = 'à valider' | 'validée' | 'anomalie'

export type FactureSaisieDemo = [
  numero: string,
  fournisseur: string,
  montant: string,
  poste: string,
  statut: StatutFactureSaisie,
]

export const DEMO_FACTURES_SAISIE_IA: FactureSaisieDemo[] = [
  ['FAC-2026-051', 'Plomberie Centrale', '620 €', 'Entretien', 'à valider'],
  ['FAC-2026-044', 'Otis', '480 €', 'Entretien', 'validée'],
  ['FAC-2026-038', 'Generali', '1 240 €', 'Assurances', 'validée'],
  ['FAC-2026-029', 'Élec Pro', '312 €', 'Énergie', 'anomalie'],
]

export const PILL_PAR_STATUT_FACTURE_SAISIE: Record<StatutFactureSaisie, 'amber' | 'sage' | 'rust'> = {
  'à valider': 'amber',
  validée: 'sage',
  anomalie: 'rust',
}
