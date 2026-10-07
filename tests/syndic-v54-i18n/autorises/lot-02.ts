/** Chaînes identiques en PT et en FR acceptées pour le lot 02 (une justification par entrée). */
export const AUTORISES: string[] = [
  // ModUrgencias (démonstration) : délais d'intervention ; « min » est l'abréviation
  // française de minute, identique au portugais.
  '2 min',
  '6 min',
  '9 min',
  '11 min',
  '18 min',
  // ModUrgencias et ModHistEdificio (démonstration) : nom de prestataire fictif conservé
  // tel quel en français (table de correspondance du brief : ElevaTech → ElevaTech).
  'ElevaTech',
  // ModElevadores (option du formulaire) et ModHistEdificio (pastille de conformité) :
  // mot français identique au portugais.
  'Conforme',
]
