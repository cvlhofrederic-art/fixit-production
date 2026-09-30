/** Rôles de travail dans le cabinet (sélecteur de la barre du haut, files d'actions, automatisations). */
export const ROLES_CABINET = ['Direction', 'Secrétariat', 'Gestion', 'Comptabilité', 'Juridique'] as const

export type RoleCabinet = (typeof ROLES_CABINET)[number]

/** Libellé affiché pour chaque rôle (salutation du cockpit, circuit de validation). */
export const LIBELLES_ROLES_CABINET: Record<RoleCabinet, string> = {
  Direction: 'Direction du cabinet',
  Secrétariat: 'Secrétariat',
  Gestion: 'Gestionnaire',
  Comptabilité: 'Comptabilité',
  Juridique: 'Pôle juridique',
}
