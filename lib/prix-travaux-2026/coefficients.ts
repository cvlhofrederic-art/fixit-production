import type { ZoneCoefficient, GammeCoefficient, EtatCoefficient } from './types'

export const COEFFICIENTS_ZONE_2026: ZoneCoefficient[] = [
  {
    code: 'IDF-PARIS',
    label: 'Île-de-France — Paris et petite couronne',
    departements: ['75', '92', '93', '94'],
    multiplier: 1.30,
    source: 'CAPEB Île-de-France 2026 — taux horaires régionaux + INSEE Index BT 2026',
    lastVerified: '2026-04-27',
  },
  {
    code: 'IDF-GRANDE-COURONNE',
    label: 'Île-de-France — Grande couronne',
    departements: ['77', '78', '91', '95'],
    multiplier: 1.18,
    source: 'CAPEB Île-de-France 2026',
    lastVerified: '2026-04-27',
  },
  {
    code: 'AURA-METROPOLES',
    label: 'Auvergne-Rhône-Alpes — Métropoles',
    departements: ['69', '38'],
    multiplier: 1.10,
    source: 'CAPEB Auvergne-Rhône-Alpes 2026',
    lastVerified: '2026-04-27',
  },
  {
    code: 'PACA',
    label: 'Provence-Alpes-Côte d\'Azur',
    departements: ['13', '83', '84', '06', '04', '05'],
    multiplier: 1.05,
    source: 'CAPEB PACA 2026 — taux horaires régionaux',
    lastVerified: '2026-04-27',
  },
  {
    code: 'OCC-METROPOLES',
    label: 'Occitanie — Métropoles (Toulouse, Montpellier)',
    departements: ['31', '34'],
    multiplier: 1.02,
    source: 'CAPEB Occitanie 2026',
    lastVerified: '2026-04-27',
  },
  {
    code: 'GRAND-OUEST',
    label: 'Grand Ouest (Nantes, Rennes, Bordeaux)',
    departements: ['44', '35', '33'],
    multiplier: 1.00,
    source: 'CAPEB Pays de la Loire / Bretagne / Nouvelle-Aquitaine 2026',
    lastVerified: '2026-04-27',
  },
  {
    code: 'STANDARD-FRANCE',
    label: 'France standard (départements urbains non listés)',
    departements: ['*'],
    multiplier: 1.00,
    source: 'INSEE Index BT 2026 — moyenne nationale',
    lastVerified: '2026-04-27',
  },
  {
    code: 'RURAL-FRANCE',
    label: 'France rurale (densité < 100 hab/km²)',
    departements: ['23', '48', '15', '46', '12', '32', '52', '55', '08'],
    multiplier: 0.92,
    source: 'CAPEB régionales rurales 2026',
    lastVerified: '2026-04-27',
  },
  {
    code: 'DOM',
    label: 'Départements et Régions d\'Outre-Mer',
    departements: ['971', '972', '973', '974', '976'],
    multiplier: 1.40,
    source: 'CAPEB Outre-Mer 2026 + observatoire INSEE',
    lastVerified: '2026-04-27',
  },
]

export const COEFFICIENTS_GAMME_2026: GammeCoefficient[] = [
  {
    level: 'economique',
    multiplier: 0.90,
    description: 'Matériaux d\'entrée de gamme, finitions standard',
  },
  {
    level: 'standard',
    multiplier: 1.00,
    description: 'Milieu de gamme, marques reconnues',
  },
  {
    level: 'premium',
    multiplier: 1.15,
    description: 'Haut de gamme, finitions soignées',
  },
]

export const COEFFICIENTS_ETAT_2026: EtatCoefficient[] = [
  {
    level: 'bon',
    multiplier: 1.00,
    description: 'Support sain, aucun travail préparatoire significatif',
  },
  {
    level: 'use',
    multiplier: 1.10,
    description: 'Travaux préparatoires modérés (rebouchage, ponçage)',
  },
  {
    level: 'tres-degrade',
    multiplier: 1.25,
    description: 'Reprises lourdes, dépose préalable, reprise structure',
  },
]
