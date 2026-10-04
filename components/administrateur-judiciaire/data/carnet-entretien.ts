export type EtatInterventionCarnet = 'fait' | 'en cours' | 'planifié'

/**
 * Intervention du carnet d'entretien : date « JJ/MM/AAAA », coût en chaîne (« 480 € »).
 * Ces prestataires (Otis, Ent. Toitures Nord…) ne viennent pas de DEMO_PRESTATAIRES.
 */
export type InterventionCarnetDemo = [
  date: string,
  nature: string,
  copropriete: string,
  prestataire: string,
  cout: string,
  garantie: string,
  etat: EtatInterventionCarnet,
]

export const DEMO_CARNET_ENTRETIEN: InterventionCarnetDemo[] = [
  ['12/05/2026', 'Entretien ascenseur', 'Le Méridien', 'Otis', '480 €', 'Contrat', 'fait'],
  ['28/04/2026', 'Réfection étanchéité terrasse', 'Les Tilleuls', 'Ent. Toitures Nord', '3 200 €', '10 ans', 'fait'],
  ['16/06/2026', 'Travaux toiture (prévu)', 'Les Tilleuls', 'Ent. Toitures Nord', '18 400 €', '10 ans', 'planifié'],
  ['03/06/2026', 'Réparation fuite parking', 'Le Méridien', 'Plomberie Centrale', '620 €', '1 an', 'en cours'],
  ['20/03/2026', 'Contrôle chaudière collective', 'Villa Montaigne', 'ThermoServices', '390 €', 'Contrat', 'fait'],
]
