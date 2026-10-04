export type PrioriteDoleance = 'Urgente' | 'Haute' | 'Moyenne' | 'Basse'

export type StatutDoleance = 'Ouverte' | 'En cours' | 'Résolue'

/** Doléance : la teinte de priorité vaut '' pour « Moyenne » (pastille neutre) ; date de signalement « JJ/MM ». */
export type DoleanceDemo = [
  objet: string,
  copropriete: string,
  priorite: PrioriteDoleance,
  teintePriorite: 'rust' | 'amber' | '' | 'sage',
  statut: StatutDoleance,
  description: string,
  dateSignalement: string,
]

export const DEMO_DOLEANCES: DoleanceDemo[] = [
  [
    'Fuite en sous-sol (parking)',
    'Le Méridien',
    'Urgente',
    'rust',
    'En cours',
    'Infiltration repérée près du local technique, plombier mandaté.',
    '03/06',
  ],
  [
    "Ascenseur à l'arrêt",
    'Le Méridien',
    'Urgente',
    'rust',
    'Ouverte',
    'Panne signalée par plusieurs copropriétaires, contrat de maintenance activé.',
    '04/06',
  ],
  [
    'Éclairage hall défaillant',
    'Villa Montaigne',
    'Haute',
    'amber',
    'En cours',
    'Minuterie HS, remplacement du détecteur planifié.',
    '01/06',
  ],
  [
    'Nuisances sonores nocturnes',
    'Le Clos des Vignes',
    'Moyenne',
    '',
    'Ouverte',
    "Plainte d'un copropriétaire, rappel du règlement à diffuser.",
    '30/05',
  ],
  [
    'Porte de garage bloquée',
    'Les Tilleuls',
    'Haute',
    'amber',
    'Résolue',
    'Moteur réinitialisé par le prestataire.',
    '28/05',
  ],
  ['Boîtes aux lettres dégradées', 'Villa Montaigne', 'Basse', 'sage', 'Résolue', 'Réparation effectuée.', '25/05'],
]
