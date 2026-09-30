export type EtatVisiteTechnique = 'ok' | 'à surveiller' | 'déficient'

export type VisiteTechniqueDemo = [
  copropriete: string,
  date: string,
  objet: string,
  constat: string,
  etat: EtatVisiteTechnique,
]

export const DEMO_VISITES_TECHNIQUES: VisiteTechniqueDemo[] = [
  ['Le Méridien', '02/06/2026', 'Toiture-terrasse', 'Étanchéité à surveiller', 'à surveiller'],
  ['Les Tilleuls', '28/05/2026', 'Toiture', 'Tuiles déplacées, infiltration', 'déficient'],
  ['Le Clos des Vignes', '20/05/2026', 'Parties communes', 'Conforme', 'ok'],
  ['Villa Montaigne', '15/05/2026', 'Façade', 'Fissures superficielles', 'à surveiller'],
]

export const PILL_PAR_ETAT_VISITE_TECHNIQUE: Record<EtatVisiteTechnique, 'sage' | 'amber' | 'rust'> = {
  ok: 'sage',
  'à surveiller': 'amber',
  déficient: 'rust',
}
