/** Pièce d'intervention : date « JJ/MM/AAAA », transmission à la comptabilité. */
export type DocumentInterventionDemo = [
  document: string,
  intervention: string,
  copropriete: string,
  date: string,
  compta: 'transmis' | 'non transmis',
]

export const DEMO_DOCUMENTS_INTERVENTION: DocumentInterventionDemo[] = [
  ['Devis DEV-2026-018', 'Travaux toiture', 'Les Tilleuls', '28/05/2026', 'non transmis'],
  ['Facture FAC-2026-044', 'Entretien ascenseur', 'Le Méridien', '12/05/2026', 'transmis'],
  ['PV de réception', 'Étanchéité terrasse', 'Les Tilleuls', '29/04/2026', 'transmis'],
  ['Facture FAC-2026-051', 'Réparation fuite', 'Le Méridien', '04/06/2026', 'non transmis'],
  ["Bon d'intervention", 'Contrôle chaudière', 'Villa Montaigne', '20/03/2026', 'transmis'],
]
