export type ProfilNps = 'promoteur' | 'passif' | 'détracteur'

/**
 * Satisfaction par prestataire : note et tendance en chaînes à virgule décimale ; codes des copropriétés où le
 * prestataire est intervenu (repris du carnet d'entretien de démonstration ; Élec Pro sur Le Clos des Vignes).
 */
export type NpsPrestataireDemo = [
  prestataire: string,
  note: string,
  tendance: string,
  profil: ProfilNps,
  coproprietes: readonly string[],
]

export const DEMO_NPS_PAR_PRESTATAIRE: NpsPrestataireDemo[] = [
  ['Otis (ascenseurs)', '9,2', '+0,3', 'promoteur', ['LM']],
  ['Ent. Toitures Nord', '8,1', '-0,4', 'passif', ['TL']],
  ['Plomberie Centrale', '7,4', '-0,8', 'passif', ['LM']],
  ['ThermoServices', '9,5', '+0,1', 'promoteur', ['VM']],
  ['Élec Pro', '6,2', '-1,2', 'détracteur', ['CV']],
]

export const PILL_PAR_PROFIL_NPS: Record<ProfilNps, 'sage' | 'amber' | 'rust'> = {
  promoteur: 'sage',
  passif: 'amber',
  détracteur: 'rust',
}
