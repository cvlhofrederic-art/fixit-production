/**
 * Membre de l'équipe du cabinet. Le rôle est l'un des ROLES_EQUIPE_CABINET (« Direction / syndic judiciaire »,
 * « Gestionnaire de mandats »…) : c'est lui qui détermine les accès par défaut du membre.
 */
export type MembreEquipeDemo = [
  initiales: string,
  nom: string,
  role: string,
  email: string,
  teinte: 'gold' | 'sage' | 'amber',
]

export const DEMO_EQUIPE_CABINET: MembreEquipeDemo[] = [
  ['CD', 'Cabinet Delaunay', 'Direction / syndic judiciaire', 'direction@cabinet-delaunay.fr', 'gold'],
  ['AD', 'Awa Diallo', 'Gestionnaire de mandats', 'a.diallo@cabinet-delaunay.fr', 'sage'],
  ['ML', 'Marc Léautaud', 'Gestionnaire technique', 'm.leautaud@cabinet-delaunay.fr', 'sage'],
  ['CN', 'Camille Noël', 'Juriste', 'c.noel@cabinet-delaunay.fr', 'amber'],
  ['JM', 'Julien Marchand', 'Comptable', 'j.marchand@cabinet-delaunay.fr', 'sage'],
  ['SV', 'Sophie Vidal', 'Assistante', 's.vidal@cabinet-delaunay.fr', 'sage'],
]
