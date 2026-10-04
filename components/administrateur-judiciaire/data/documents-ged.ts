/** Document de la GED : date « JJ/MM/AAAA ». */
export type DocumentGedDemo = [nom: string, type: string, copropriete: string, auteur: string, date: string]

export const DEMO_DOCUMENTS_GED: DocumentGedDemo[] = [
  ['Ordonnance de désignation', 'Juridique', 'Le Méridien', 'Greffe TJ Nanterre', '12/03/2026'],
  ['Procès-verbal AG 2025', 'Assemblée', 'Le Clos des Vignes', 'Cabinet Delaunay', '15/04/2025'],
  ['Devis toiture', 'Technique', 'Les Tilleuls', 'Ent. Toitures Nord', '28/05/2026'],
  ['Contrat ascenseur', 'Contrat', 'Le Méridien', 'Otis', '01/01/2026'],
  ['État daté', 'Comptabilité', 'Villa Montaigne', 'Cabinet Delaunay', '02/06/2026'],
]
