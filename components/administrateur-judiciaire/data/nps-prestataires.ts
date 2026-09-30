export type ProfilNps = 'promoteur' | 'passif' | 'détracteur'

/** Satisfaction par prestataire : note et tendance en chaînes à virgule décimale. */
export type NpsPrestataireDemo = [prestataire: string, note: string, tendance: string, profil: ProfilNps]

export const DEMO_NPS_PAR_PRESTATAIRE: NpsPrestataireDemo[] = [
  ['Otis (ascenseurs)', '9,2', '+0,3', 'promoteur'],
  ['Ent. Toitures Nord', '8,1', '-0,4', 'passif'],
  ['Plomberie Centrale', '7,4', '-0,8', 'passif'],
  ['ThermoServices', '9,5', '+0,1', 'promoteur'],
  ['Élec Pro', '6,2', '-1,2', 'détracteur'],
]

export const PILL_PAR_PROFIL_NPS: Record<ProfilNps, 'sage' | 'amber' | 'rust'> = {
  promoteur: 'sage',
  passif: 'amber',
  détracteur: 'rust',
}
