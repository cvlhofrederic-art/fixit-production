export type ContratAssuranceDemo = [
  intitule: string,
  assureurEtReference: string,
  echeance: string,
  teinte: 'sage' | 'amber' | 'gold',
]

export const DEMO_CONTRATS_ASSURANCE: ContratAssuranceDemo[] = [
  ['Multirisque immeuble', 'Generali · police n° MRI-44120', 'Échéance 31/12/2026', 'sage'],
  ['RC du syndicat (obligatoire)', 'AXA · Loi ALUR art. 9-1', 'Échéance 31/12/2026', 'sage'],
  ['Dommages-ouvrage', 'SMABTP · travaux toiture Les Tilleuls', 'En cours de souscription', 'amber'],
  ['Protection juridique', 'MMA · contentieux copropriété', 'Échéance 30/06/2026', 'gold'],
]
