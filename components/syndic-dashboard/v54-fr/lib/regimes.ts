// Moteur de régime du mandat judiciaire — port byte-exact du mockup v8.
// Trois régimes : syndic judiciaire (art. 17 al. 4 L. 1965 / art. 46 décret 1967),
// administrateur provisoire carence (art. 47 décret), administrateur provisoire
// difficulté (art. 29-1 L. 1965).

import type { PillKind } from '@/components/syndic-dashboard/v54/primitives/pill'
import type { Copro } from '../data/mock'

export interface Regime {
  code: 'sj' | 'ap47' | 'ap291'
  label: string
  short: string
  basis: string
  duree: string
  mission: string
  pouvoirs: string[]
}

export const REGIMES: Record<Regime['code'], Regime> = {
  sj: {
    code: 'sj',
    label: 'Syndic judiciaire',
    short: 'Syndic judiciaire',
    basis: 'art. 17 al. 4 L. 1965 · art. 46 décret 1967',
    duree: '≤ 3 ans',
    mission: "Assurer la gestion et convoquer l'AG en vue d'élire un syndic.",
    pouvoirs: [
      'Tous les pouvoirs du syndic (art. 18 à 18-2)',
      "L'AG et le conseil syndical conservent leurs pouvoirs",
      'Rémunération fixée / soumise à taxation',
    ],
  },
  ap47: {
    code: 'ap47',
    label: 'Administrateur provisoire — carence',
    short: 'AP carence',
    basis: 'art. 47 du décret du 17 mars 1967',
    duree: 'fixée par le juge',
    mission: "Pallier l'absence de syndic et convoquer l'AG élective.",
    pouvoirs: [
      'Pouvoirs du syndic',
      'Aucune preuve de difficulté requise',
      'Se faire remettre archives et fonds',
    ],
  },
  ap291: {
    code: 'ap291',
    label: 'Administrateur provisoire — difficulté',
    short: 'AP art. 29-1',
    basis: 'art. 29-1 de la loi du 10 juillet 1965',
    duree: '≥ 12 mois',
    mission: 'Rétablir le fonctionnement normal et redresser la situation financière.',
    pouvoirs: [
      'Pouvoirs du syndic',
      "Tout ou partie des pouvoirs de l'AG (sauf art. 26 a et b)",
      'Tout ou partie des pouvoirs du conseil syndical',
      'Rapport intermédiaire au plus tard à 6 mois (art. 29-1 B)',
    ],
  },
}

/** Régime applicable d'une copropriété selon le fondement de l'ordonnance. */
export const regimeOf = (c: Pick<Copro, 'fondement'> | null | undefined): Regime =>
  ((c && c.fondement) || '').includes('29-1') ? REGIMES.ap291 : REGIMES.sj

/** Couleur de pill par régime. */
export const REG_PILL: Record<Regime['code'], PillKind> = { sj: 'sage', ap47: 'gold', ap291: 'rust' }
