export type OptionSondage = [libelle: string, voix: number]

/**
 * Sondage : échéance « Échéance JJ/MM » ou « Terminée ». Le taux de participation est saisi en dur (non recalculé).
 * « 8h–17h » et « 9h–18h » utilisent un tiret demi-cadratin (U+2013).
 */
export type SondageDemo = [
  question: string,
  description: string,
  statut: 'Active' | 'Clôturée',
  copropriete: string,
  echeance: string,
  anonyme: boolean,
  repondants: number,
  totalLots: number,
  participationPct: number,
  options: OptionSondage[],
]

export const DEMO_SONDAGES: SondageDemo[] = [
  [
    "Choix de l'entreprise de ravalement",
    'Consultation des copropriétaires sur les trois devis reçus',
    'Active',
    'Le Méridien',
    'Échéance 15/06',
    false,
    28,
    36,
    78,
    [['Entreprise Façade Pro', 16], ['Ravalement Atlantique', 9], ['Sans avis', 3]],
  ],
  [
    "Horaires d'accès au chantier",
    'Préférence pour les plages horaires des travaux de toiture',
    'Active',
    'Les Tilleuls',
    'Échéance 10/06',
    true,
    18,
    24,
    75,
    [['8h–17h', 11], ['9h–18h', 5], ['Indifférent', 2]],
  ],
  [
    'Validation du budget travaux 2026',
    "Avis consultatif avant inscription à l'ordre du jour de l'AG",
    'Clôturée',
    'Le Clos des Vignes',
    'Terminée',
    false,
    41,
    48,
    85,
    [['Favorable', 33], ['Défavorable', 6], ['Abstention', 2]],
  ],
]
