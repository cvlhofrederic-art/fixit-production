/** Chaînes identiques en PT et en FR acceptées pour le lot 03 (une justification par entrée). */
export const AUTORISES: string[] = [
  // ModCanal (participants de la mission) : le PT affiche déjà le mot français
  // « Gestionnaire » comme nom du gestionnaire du cabinet ; correct en français.
  'Gestionnaire',
  // ModCanal (filtre de la liste des missions) : adjectif français au féminin pluriel
  // (« missions urgentes »), identique au portugais.
  'Urgentes',
  // ModPlaneamento (durée des créneaux, aperçu et chapeau) : « min » est l'abréviation
  // française de minute, identique au portugais.
  '30 min',
]
