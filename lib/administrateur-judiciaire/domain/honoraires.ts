/** Étapes de la procédure de taxation des honoraires (stepper de l'écran Honoraires & taxation). */
export const ETAPES_TAXATION = [
  'Diligences',
  'État de frais',
  'Requête en taxation',
  'Ordonnance de taxation',
  'Recouvrement',
] as const

export type EtapeTaxation = (typeof ETAPES_TAXATION)[number]
