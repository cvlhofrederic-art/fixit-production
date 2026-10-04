import type { RoleCabinet } from '@/lib/administrateur-judiciaire/domain/roles-cabinet'

/**
 * Collaborateur suivi dans l'écran de charge. `nom` correspond exactement au champ `resp` de DEMO_PORTEFEUILLE_MANDATS,
 * `taskRole` au champ `role` de DEMO_TACHES.
 */
export interface CollaborateurCharge {
  nom: string
  role: string
  taskRole: RoleCabinet
}

export const DEMO_COLLABORATEURS_CHARGE: CollaborateurCharge[] = [
  { nom: 'Awa Diallo', role: 'Gestionnaire', taskRole: 'Gestion' },
  { nom: 'Marc Léautaud', role: 'Gestionnaire', taskRole: 'Gestion' },
  { nom: 'Camille Noël', role: 'Juriste copropriété', taskRole: 'Juridique' },
  { nom: 'Julien Marchand', role: 'Comptable', taskRole: 'Comptabilité' },
  { nom: 'Sophie Vidal', role: 'Assistante', taskRole: 'Secrétariat' },
]
