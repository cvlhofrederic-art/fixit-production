/** Chaînes identiques en PT et en FR acceptées pour le lot 05 (une justification par entrée). */
export const AUTORISES: string[] = [
  // ModContabTec : ligne de total du tableau « par prestataire » ; mot français identique
  // au portugais (la variante « Total » est déjà admise globalement).
  'TOTAL',
  // ModContabTec : libellé de priorité d'une intervention (« priorité urgente ») ; adjectif
  // français identique au portugais (la variante « Urgente » est déjà admise globalement).
  'urgente',
  // ModRelatorioMensal (démonstration) : sélecteur de mois ; « Mai » est le nom français du
  // mois, identique à l'abréviation portugaise relevée ailleurs dans l'instantané PT.
  'Mai',
]
