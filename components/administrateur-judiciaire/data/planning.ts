export type CleJour = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export type CouleurEvenement = 'gold' | 'sage' | 'amber' | 'rust' | 'green'

/** Membre affiché dans le planning : `id` (initiales) sert de clé, de texte d'avatar et de propriétaire des événements. */
export interface MembrePlanning {
  id: string
  name: string
  role: string
  accent: 'gold' | 'sage' | 'amber'
}

export const DEMO_EQUIPE_PLANNING: MembrePlanning[] = [
  { id: 'CD', name: 'Cabinet Delaunay', role: 'Direction', accent: 'gold' },
  { id: 'AD', name: 'Awa Diallo', role: 'Gestionnaire', accent: 'sage' },
  { id: 'ML', name: 'Marc Léautaud', role: 'Gestionnaire', accent: 'sage' },
  { id: 'CN', name: 'Camille Noël', role: 'Juriste', accent: 'amber' },
  { id: 'JM', name: 'Julien Marchand', role: 'Comptable', accent: 'sage' },
  { id: 'SV', name: 'Sophie Vidal', role: 'Assistante', accent: 'sage' },
]

/** Jour de la semaine affichée : `date` est le jour du mois (semaine figée du 8 au 14 juin). */
export interface JourPlanning {
  key: CleJour
  short: string
  long: string
  date: string
}

export const JOURS_SEMAINE_PLANNING: JourPlanning[] = [
  { key: 'mon', short: 'Lun', long: 'Lundi', date: '08' },
  { key: 'tue', short: 'Mar', long: 'Mardi', date: '09' },
  { key: 'wed', short: 'Mer', long: 'Mercredi', date: '10' },
  { key: 'thu', short: 'Jeu', long: 'Jeudi', date: '11' },
  { key: 'fri', short: 'Ven', long: 'Vendredi', date: '12' },
  { key: 'sat', short: 'Sam', long: 'Samedi', date: '13' },
  { key: 'sun', short: 'Dim', long: 'Dimanche', date: '14' },
]

/** Événement du planning : heures « HH:MM », `owner` = id d'un membre de DEMO_EQUIPE_PLANNING. */
export interface EvenementPlanning {
  id: number
  day: CleJour
  start: string
  end: string
  label: string
  kind: CouleurEvenement
  owner: string
}

/** Ordre du tableau = ordre d'affichage (pas de tri). L'événement 12 tombe un samedi. */
export const DEMO_EVENEMENTS_PLANNING: EvenementPlanning[] = [
  {
    id: 1,
    day: 'mon',
    start: '09:00',
    end: '10:30',
    label: 'Convocation AG — Le Clos des Vignes',
    kind: 'gold',
    owner: 'CN',
  },
  {
    id: 2,
    day: 'mon',
    start: '14:00',
    end: '16:00',
    label: 'Visite technique — Les Tilleuls (toiture)',
    kind: 'sage',
    owner: 'ML',
  },
  {
    id: 3,
    day: 'tue',
    start: '10:00',
    end: '11:00',
    label: 'Conseil syndical — Le Méridien',
    kind: 'gold',
    owner: 'AD',
  },
  {
    id: 4,
    day: 'tue',
    start: '15:00',
    end: '16:00',
    label: 'Mise en demeure — SCI Belvédère',
    kind: 'amber',
    owner: 'JM',
  },
  {
    id: 5,
    day: 'wed',
    start: '09:00',
    end: '11:00',
    label: 'Inspection ascenseur — Le Méridien',
    kind: 'amber',
    owner: 'ML',
  },
  {
    id: 6,
    day: 'wed',
    start: '15:00',
    end: '16:30',
    label: 'Réunion copropriétaires — Villa Montaigne',
    kind: 'gold',
    owner: 'CN',
  },
  {
    id: 7,
    day: 'thu',
    start: '08:30',
    end: '09:30',
    label: 'Notification ordonnance — Villa Montaigne',
    kind: 'sage',
    owner: 'SV',
  },
  {
    id: 8,
    day: 'thu',
    start: '11:00',
    end: '12:00',
    label: 'Rapprochement bancaire (compte séparé)',
    kind: 'amber',
    owner: 'JM',
  },
  {
    id: 9,
    day: 'thu',
    start: '16:00',
    end: '17:00',
    label: 'Dépôt requête en prorogation — Les Tilleuls',
    kind: 'rust',
    owner: 'CN',
  },
  {
    id: 10,
    day: 'fri',
    start: '10:00',
    end: '12:00',
    label: 'AG élective — Le Clos des Vignes',
    kind: 'gold',
    owner: 'CD',
  },
  {
    id: 11,
    day: 'fri',
    start: '15:00',
    end: '16:00',
    label: 'État de frais & taxation — Le Méridien',
    kind: 'amber',
    owner: 'JM',
  },
  {
    id: 12,
    day: 'sat',
    start: '10:00',
    end: '11:30',
    label: "Réunion d'information copropriétaires",
    kind: 'rust',
    owner: 'AD',
  },
]

export interface ReglagesPlanning {
  workingDays: CleJour[]
  startHour: number
  endHour: number
  slotMinutes: number
}

/** Réglages par défaut (valeur initiale et « Réinitialiser ») : ne jamais muter, copier `workingDays`. */
export const REGLAGES_PLANNING_DEFAUT: ReglagesPlanning = {
  workingDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
  startHour: 8,
  endHour: 19,
  slotMinutes: 60,
}

export const PILL_PAR_COULEUR_EVENEMENT: Record<CouleurEvenement, 'gold' | 'sage' | 'amber' | 'rust'> = {
  gold: 'gold',
  sage: 'sage',
  amber: 'amber',
  rust: 'rust',
  green: 'sage',
}
