import type { Regime } from '@/lib/administrateur-judiciaire/domain/fondements'

/** Mandat du portefeuille : échéance « JJ/MM/AAAA », responsable = nom exact d'un collaborateur. */
export interface MandatPortefeuille {
  code: string
  nom: string
  tj: string
  reg: Regime
  lots: number
  ech: string
  resp: string
}

/**
 * 14 mandats (624 lots). L'ordre d'apparition des tribunaux (Nanterre, Bobigny, Créteil, Versailles)
 * donne l'ordre des filtres et du regroupement.
 */
export const DEMO_PORTEFEUILLE_MANDATS: MandatPortefeuille[] = [
  {
    code: 'LM',
    nom: 'Résidence Le Méridien',
    tj: 'TJ Nanterre',
    reg: 'sj',
    lots: 36,
    ech: '12/03/2027',
    resp: 'Awa Diallo',
  },
  {
    code: 'CV',
    nom: 'Le Clos des Vignes',
    tj: 'TJ Nanterre',
    reg: 'sj',
    lots: 48,
    ech: '22/07/2026',
    resp: 'Marc Léautaud',
  },
  {
    code: 'TL',
    nom: 'Copropriété Les Tilleuls',
    tj: 'TJ Nanterre',
    reg: 'ap291',
    lots: 24,
    ech: '05/05/2026',
    resp: 'Camille Noël',
  },
  { code: 'VM', nom: 'Villa Montaigne', tj: 'TJ Nanterre', reg: 'sj', lots: 12, ech: '28/01/2027', resp: 'Awa Diallo' },
  {
    code: 'RE',
    nom: 'Résidence des Érables',
    tj: 'TJ Bobigny',
    reg: 'ap291',
    lots: 64,
    ech: '15/09/2026',
    resp: 'Camille Noël',
  },
  {
    code: 'PB',
    nom: 'Le Parc de Bondy',
    tj: 'TJ Bobigny',
    reg: 'sj',
    lots: 52,
    ech: '30/11/2026',
    resp: 'Marc Léautaud',
  },
  {
    code: 'JF',
    nom: 'Les Jardins de Fontenay',
    tj: 'TJ Créteil',
    reg: 'ap291',
    lots: 88,
    ech: '04/04/2027',
    resp: 'Camille Noël',
  },
  { code: 'CM', nom: 'Carré Maine', tj: 'TJ Créteil', reg: 'ap47', lots: 30, ech: '18/06/2026', resp: 'Awa Diallo' },
  {
    code: 'BV',
    nom: 'Belvédère Vincennes',
    tj: 'TJ Créteil',
    reg: 'sj',
    lots: 40,
    ech: '09/10/2026',
    resp: 'Marc Léautaud',
  },
  {
    code: 'HS',
    nom: 'Le Hameau Saint-Cloud',
    tj: 'TJ Versailles',
    reg: 'sj',
    lots: 22,
    ech: '12/12/2026',
    resp: 'Camille Noël',
  },
  { code: 'OR', nom: 'Les Ormes', tj: 'TJ Versailles', reg: 'ap291', lots: 56, ech: '25/08/2026', resp: 'Camille Noël' },
  {
    code: 'PL',
    nom: 'Le Patio Levallois',
    tj: 'TJ Nanterre',
    reg: 'sj',
    lots: 34,
    ech: '03/02/2027',
    resp: 'Awa Diallo',
  },
  {
    code: 'GC',
    nom: 'Grand Clichy',
    tj: 'TJ Nanterre',
    reg: 'ap47',
    lots: 46,
    ech: '21/07/2026',
    resp: 'Marc Léautaud',
  },
  {
    code: 'TM',
    nom: 'Tour Montreuil',
    tj: 'TJ Bobigny',
    reg: 'ap291',
    lots: 72,
    ech: '14/05/2027',
    resp: 'Camille Noël',
  },
]

export const PILL_REGIME_PORTEFEUILLE: Record<Regime, 'sage' | 'gold' | 'rust'> = {
  sj: 'sage',
  ap47: 'gold',
  ap291: 'rust',
}
