/** Ordre de service sur parties communes (urgence, statut, fraction concernée, prestataire). */
export interface OrdreDeServiceDemo {
  urg: string
  statut: string
  id: string
  copro: string
  objet: string
  frac: string
  presta: string
  date: string
}

/** Utilisé par l'écran « Ordres de service » et par Fixy. */
export const DEMO_ORDRES_DE_SERVICE: OrdreDeServiceDemo[] = [
  {
    urg: 'Urgence',
    statut: 'En cours',
    id: 'OS-2026-051',
    copro: 'Le Clos des Vignes',
    objet: 'Fuite sur colonne EU — appartement du 4e étage',
    frac: 'Lot 27',
    presta: 'Atlantic Plomberie SARL',
    date: '22/05/2026',
  },
  {
    urg: 'Normale',
    statut: 'À valider',
    id: 'OS-2026-050',
    copro: 'Résidence Le Méridien',
    objet: 'Remplacement de la minuterie du hall',
    frac: 'Parties communes',
    presta: 'ELEC92 Services',
    date: '21/05/2026',
  },
  {
    urg: 'Normale',
    statut: 'Planifié',
    id: 'OS-2026-049',
    copro: 'Villa Montaigne',
    objet: 'Élagage des arbres de la cour',
    frac: 'Extérieur',
    presta: 'Vert Pro Espaces',
    date: '20/05/2026',
  },
  {
    urg: 'Prioritaire',
    statut: 'En cours',
    id: 'OS-2026-048',
    copro: 'Copropriété Les Tilleuls',
    objet: "Réparation de l'interphone collectif",
    frac: 'Hall',
    presta: 'ELEC92 Services',
    date: '19/05/2026',
  },
  {
    urg: 'Normale',
    statut: 'À valider',
    id: 'OS-2026-047',
    copro: 'Le Clos des Vignes',
    objet: 'Réfection de la peinture (cage B)',
    frac: 'Cage B',
    presta: '—',
    date: '18/05/2026',
  },
  {
    urg: 'Normale',
    statut: 'Clôturé',
    id: 'OS-2026-046',
    copro: 'Résidence Le Méridien',
    objet: 'Contrôle annuel de la VMC',
    frac: 'Parties communes',
    presta: 'Atlantic Plomberie SARL',
    date: '12/05/2026',
  },
]
