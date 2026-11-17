/**
 * Contrat d'assurance de démonstration. `copros` : codes des copropriétés couvertes (écran affiché selon la copropriété
 * choisie dans le sélecteur du haut de page) ; multirisque et RC du syndicat couvrent les quatre copropriétés de
 * démonstration, dommages-ouvrage et protection juridique Les Tilleuls seulement.
 */
export type ContratAssuranceDemo = [
  intitule: string,
  assureurEtReference: string,
  echeance: string,
  teinte: 'sage' | 'amber' | 'gold',
  copros: readonly string[],
]

export const DEMO_CONTRATS_ASSURANCE: ContratAssuranceDemo[] = [
  ['Multirisque immeuble', 'Generali · police n° MRI-44120', 'Échéance 31/12/2026', 'sage', ['LM', 'CV', 'TL', 'VM']],
  ['RC du syndicat (obligatoire)', 'AXA · Loi ALUR art. 9-1', 'Échéance 31/12/2026', 'sage', ['LM', 'CV', 'TL', 'VM']],
  ['Dommages-ouvrage', 'SMABTP · travaux toiture Les Tilleuls', 'En cours de souscription', 'amber', ['TL']],
  ['Protection juridique', 'MMA · contentieux copropriété', 'Échéance 30/06/2026', 'gold', ['TL']],
]
