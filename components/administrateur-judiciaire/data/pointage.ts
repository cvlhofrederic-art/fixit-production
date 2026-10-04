/** Position GPS en degrés décimaux. */
export interface PositionGps {
  lat: number
  lng: number
}

/** Site pointable. Les adresses diffèrent volontairement de celles de DEMO_COPROPRIETES. */
export interface SitePointage {
  code: string
  nom: string
  adresse: string
  lat: number
  lng: number
}

export const DEMO_SITES_POINTAGE: SitePointage[] = [
  { code: 'LM', nom: 'Résidence Le Méridien', adresse: '14 rue du Parc, 92000 Nanterre', lat: 48.8924, lng: 2.2069 },
  {
    code: 'CV',
    nom: 'Le Clos des Vignes',
    adresse: '5 av. des Vignes, 92500 Rueil-Malmaison',
    lat: 48.8801,
    lng: 2.1825,
  },
  {
    code: 'TL',
    nom: 'Copropriété Les Tilleuls',
    adresse: '8 allée des Tilleuls, 92500 Rueil-Malmaison',
    lat: 48.8767,
    lng: 2.1798,
  },
  { code: 'VM', nom: 'Villa Montaigne', adresse: '3 villa Montaigne, 92200 Neuilly-sur-Seine', lat: 48.8846, lng: 2.27 },
]

/** Position du cabinet : état initial et retour après « Quitter le site ». */
export const POSITION_CABINET_POINTAGE: PositionGps = {
  lat: 48.869,
  lng: 2.238,
}

/** Cumul initial des minutes passées sur chaque site cette semaine, par code de copropriété. */
export const DEMO_MINUTES_TERRAIN_SEMAINE: Record<string, number> = {
  LM: 312,
  CV: 148,
  TL: 226,
  VM: 64,
}

/** Pointage de la journée : durée en minutes et heure de sortie « HH:MM ». */
export interface PointageJour {
  code: string
  mins: number
  end: string
}

/** Journal initial ; les nouveaux pointages s'ajoutent en tête (liste tronquée à 8). */
export const DEMO_JOURNAL_POINTAGES_JOUR: PointageJour[] = [
  { code: 'LM', mins: 78, end: '09:12' },
  { code: 'TL', mins: 54, end: '11:40' },
  { code: 'CV', mins: 32, end: '14:05' },
]
