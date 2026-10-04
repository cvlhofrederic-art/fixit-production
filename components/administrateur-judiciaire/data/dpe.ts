/** Étiquette énergétique et sa teinte : A et B sage, C et D gold, E amber, F et G rust. */
export type EtiquetteDpe = [classe: string, teinte: 'sage' | 'gold' | 'amber' | 'rust']

export const ECHELLE_ETIQUETTES_DPE: EtiquetteDpe[] = [
  ['A', 'sage'],
  ['B', 'sage'],
  ['C', 'gold'],
  ['D', 'gold'],
  ['E', 'amber'],
  ['F', 'rust'],
  ['G', 'rust'],
]

export type DpeCoproprieteDemo = [copropriete: string, classe: string, statut: string, teinte: 'sage' | 'amber' | 'rust']

export const DEMO_DPE_COPROPRIETES: DpeCoproprieteDemo[] = [
  ['Le Méridien', 'D', "Valide jusqu'en 2031", 'sage'],
  ['Le Clos des Vignes', 'E', 'Audit énergétique recommandé', 'amber'],
  ['Les Tilleuls', 'F', 'Passoire — travaux à prévoir', 'rust'],
  ['Villa Montaigne', 'C', "Valide jusqu'en 2030", 'sage'],
]
