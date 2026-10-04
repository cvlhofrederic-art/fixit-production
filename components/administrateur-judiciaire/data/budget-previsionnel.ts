/** Part d'un poste dans le budget prévisionnel (fraction de 1). */
export type PartPosteBudget = [poste: string, part: number]

/** Répartition par poste : la somme des parts vaut 1 ; l'ordre du tableau est l'ordre d'affichage. */
export const REPARTITION_POSTES_BUDGET: PartPosteBudget[] = [
  ['Entretien & maintenance', 0.34],
  ['Honoraires syndic', 0.16],
  ['Assurances', 0.1],
  ['Énergie & fluides', 0.26],
  ['Espaces verts', 0.06],
  ['Provisions diverses', 0.08],
]
