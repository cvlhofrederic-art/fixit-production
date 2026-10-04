/** Pouvoir pour l'assemblée : voix en chaîne ; un pouvoir en blanc a pour mandataire « — (en blanc) ». */
export type PouvoirAgDemo = [
  copropriete: string,
  mandant: string,
  mandataire: string,
  voix: string,
  statut: 'reçu' | 'à attribuer',
]

export const DEMO_POUVOIRS_AG: PouvoirAgDemo[] = [
  ['Le Méridien', 'M. Bernard (lot 12)', 'Awa Diallo', '42', 'reçu'],
  ['Le Méridien', 'Mme Olivier (lot 23)', 'P. Renaud (cons. synd.)', '38', 'reçu'],
  ['Le Clos des Vignes', 'SCI Belvédère', '— (en blanc)', '120', 'à attribuer'],
  ['Villa Montaigne', 'M. Lefèvre (lot 4)', 'C. Noël', '95', 'reçu'],
]
