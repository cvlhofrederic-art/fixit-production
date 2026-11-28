/**
 * Remboursement à un copropriétaire, avec le code de sa copropriété (filtre du sélecteur du haut de page), repris
 * de son compte extranet (DEMO_COMPTES_EXTRANET : « Le Méridien · lot 12 », « Villa Montaigne · lot 4 »…).
 */
export type RemboursementDemo = [
  coproprietaire: string,
  motif: string,
  montant: string,
  date: string,
  statut: 'à traiter' | 'réglé',
  codeCopropriete: string,
]

export const DEMO_REMBOURSEMENTS_COPROPRIETAIRES: RemboursementDemo[] = [
  ['M. Lefèvre', 'Solde créditeur après régularisation', '85 €', '—', 'à traiter', 'VM'],
  ['Mme Olivier', 'Trop-perçu sur charges 2025', '142 €', '28/05/2026', 'réglé', 'LM'],
  ['M. Bernard', 'Remboursement provision travaux', '340 €', '—', 'à traiter', 'LM'],
  ['SCI Belvédère', 'Annulation appel erroné', '210 €', '15/05/2026', 'réglé', 'CV'],
]
