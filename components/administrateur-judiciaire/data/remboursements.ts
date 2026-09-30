export type RemboursementDemo = [
  coproprietaire: string,
  motif: string,
  montant: string,
  date: string,
  statut: 'à traiter' | 'réglé',
]

export const DEMO_REMBOURSEMENTS_COPROPRIETAIRES: RemboursementDemo[] = [
  ['M. Lefèvre', 'Solde créditeur après régularisation', '85 €', '—', 'à traiter'],
  ['Mme Olivier', 'Trop-perçu sur charges 2025', '142 €', '28/05/2026', 'réglé'],
  ['M. Bernard', 'Remboursement provision travaux', '340 €', '—', 'à traiter'],
  ['SCI Belvédère', 'Annulation appel erroné', '210 €', '15/05/2026', 'réglé'],
]
