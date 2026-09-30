/** Prestataire référencé : `note` à virgule décimale et `decennale` « Oui » / « N/A » (convertis par le seed). */
export interface PrestataireDemo {
  id: string
  nom: string
  metier: string
  ville: string
  note: string
  interventions: number
  statut: string
  pill: 'sage' | 'gold' | 'amber'
  siret: string
  decennale: 'Oui' | 'N/A'
}

export const DEMO_PRESTATAIRES: PrestataireDemo[] = [
  {
    id: 'F1',
    nom: 'Atlantic Plomberie SARL',
    metier: 'Plomberie / chauffage',
    ville: 'Nanterre',
    note: '4,8',
    interventions: 12,
    statut: 'Référencé',
    pill: 'sage',
    siret: '492 118 332 00027',
    decennale: 'Oui',
  },
  {
    id: 'F2',
    nom: 'ELEC92 Services',
    metier: 'Électricité',
    ville: 'Rueil-Malmaison',
    note: '4,6',
    interventions: 9,
    statut: 'Référencé',
    pill: 'sage',
    siret: '811 204 559 00018',
    decennale: 'Oui',
  },
  {
    id: 'F3',
    nom: 'OTIS Maintenance',
    metier: 'Ascensoriste',
    ville: 'Île-de-France',
    note: '4,5',
    interventions: 4,
    statut: 'Contrat cadre',
    pill: 'gold',
    siret: '542 097 904 00115',
    decennale: 'N/A',
  },
  {
    id: 'F4',
    nom: 'Couverture Île-de-France',
    metier: 'Couverture / étanchéité',
    ville: 'Boulogne',
    note: '4,7',
    interventions: 6,
    statut: 'Référencé',
    pill: 'sage',
    siret: '790 553 118 00022',
    decennale: 'Oui',
  },
  {
    id: 'F5',
    nom: 'Vert Pro Espaces',
    metier: 'Espaces verts',
    ville: 'Neuilly',
    note: '4,4',
    interventions: 5,
    statut: 'Référencé',
    pill: 'sage',
    siret: '833 661 209 00010',
    decennale: 'N/A',
  },
  {
    id: 'F6',
    nom: 'Net Hall Propreté',
    metier: 'Nettoyage parties communes',
    ville: 'Nanterre',
    note: '4,3',
    interventions: 14,
    statut: 'Référencé',
    pill: 'sage',
    siret: '521 480 663 00031',
    decennale: 'N/A',
  },
  {
    id: 'F7',
    nom: 'Serrurerie Express 92',
    metier: 'Serrurerie / urgences',
    ville: 'Courbevoie',
    note: '4,2',
    interventions: 3,
    statut: 'Sur appel',
    pill: 'amber',
    siret: '884 552 100 00014',
    decennale: 'N/A',
  },
  {
    id: 'F8',
    nom: 'Façade & Ravalement IDF',
    metier: 'Façades / ravalement',
    ville: 'Rueil',
    note: '4,6',
    interventions: 2,
    statut: 'Devis en cours',
    pill: 'amber',
    siret: '901 226 778 00019',
    decennale: 'Oui',
  },
  {
    id: 'F9',
    nom: 'Sécurité Incendie 92',
    metier: 'Sécurité incendie',
    ville: 'Nanterre',
    note: '4,9',
    interventions: 7,
    statut: 'Contrat cadre',
    pill: 'gold',
    siret: '448 990 221 00025',
    decennale: 'N/A',
  },
]

/** Métiers proposés à la création d'un prestataire. */
export const METIERS_PRESTATAIRE = [
  'Plomberie / chauffage',
  'Électricité',
  'Ascensoriste',
  'Couverture / étanchéité',
  'Espaces verts',
  'Nettoyage',
  'Serrurerie',
  'Sécurité incendie',
] as const

export type MetierPrestataire = (typeof METIERS_PRESTATAIRE)[number]
