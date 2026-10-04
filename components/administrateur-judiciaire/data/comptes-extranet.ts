/** Compte extranet : solde signé en chaîne (« +340 € », « -1 240 € ») avec des espaces ordinaires. */
export type CompteExtranetDemo = [nom: string, email: string, lot: string, solde: string, acces: 'actif' | 'inactif']

export const DEMO_COMPTES_EXTRANET: CompteExtranetDemo[] = [
  ['M. Bernard', 'j.bernard@email.fr', 'Le Méridien · lot 12', '+340 €', 'actif'],
  ['Mme Olivier', 'm.olivier@email.fr', 'Le Méridien · lot 23', '0 €', 'actif'],
  ['SCI Belvédère', 'contact@sci-belvedere.fr', 'Le Clos des Vignes · lot 5', '-1 240 €', 'inactif'],
  ['M. Lefèvre', 'p.lefevre@email.fr', 'Villa Montaigne · lot 4', '+85 €', 'actif'],
  ['Mme Garnier', 'c.garnier@email.fr', 'Les Tilleuls · lot 9', '-420 €', 'actif'],
]
