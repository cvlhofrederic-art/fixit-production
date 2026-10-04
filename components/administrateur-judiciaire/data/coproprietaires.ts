/**
 * Copropriétaire de démonstration, rattaché à sa copropriété par son nom (`copro`) : le seed résout l'id par le nom.
 * Un solde négatif est une dette.
 */
export interface CoproprietaireDemo {
  id: string
  nom: string
  copro: string
  lot: string
  tantiemes: string
  solde: number
  statut: string
  pill: 'sage' | 'amber' | 'rust'
  tel: string
  mail: string
}

export const DEMO_COPROPRIETAIRES: CoproprietaireDemo[] = [
  {
    id: 'P1',
    nom: 'Laurent Mercier',
    copro: 'Résidence Le Méridien',
    lot: 'Lot 12 — Apt B3',
    tantiemes: '412/10000',
    solde: 0,
    statut: 'À jour',
    pill: 'sage',
    tel: '06 12 34 56 78',
    mail: 'l.mercier@email.fr',
  },
  {
    id: 'P2',
    nom: 'Sophie Garnier',
    copro: 'Le Clos des Vignes',
    lot: 'Lot 27 — Apt 4G',
    tantiemes: '308/10000',
    solde: -1840,
    statut: 'Impayé',
    pill: 'rust',
    tel: '06 22 11 90 04',
    mail: 'sophie.garnier@email.fr',
  },
  {
    id: 'P3',
    nom: 'Karim Benali',
    copro: 'Le Clos des Vignes',
    lot: 'Lot 5 — Apt 1B',
    tantiemes: '276/10000',
    solde: -620,
    statut: 'Retard',
    pill: 'amber',
    tel: '07 60 18 22 41',
    mail: 'k.benali@email.fr',
  },
  {
    id: 'P4',
    nom: 'Inès Lefèvre',
    copro: 'Résidence Le Méridien',
    lot: 'Lot 31 — Apt C2',
    tantiemes: '350/10000',
    solde: 0,
    statut: 'À jour',
    pill: 'sage',
    tel: '06 84 55 12 33',
    mail: 'ines.lefevre@email.fr',
  },
  {
    id: 'P5',
    nom: 'SCI Belvédère',
    copro: 'Copropriété Les Tilleuls',
    lot: 'Lots 8-9 — Local',
    tantiemes: '640/10000',
    solde: -9200,
    statut: 'Contentieux',
    pill: 'rust',
    tel: '01 47 02 88 10',
    mail: 'gestion@sci-belvedere.fr',
  },
  {
    id: 'P6',
    nom: 'Hélène Dubois',
    copro: 'Villa Montaigne',
    lot: 'Lot 4 — Apt 2A',
    tantiemes: '820/10000',
    solde: 0,
    statut: 'À jour',
    pill: 'sage',
    tel: '06 33 77 41 09',
    mail: 'h.dubois@email.fr',
  },
  {
    id: 'P7',
    nom: 'Antoine Rousseau',
    copro: 'Copropriété Les Tilleuls',
    lot: 'Lot 14 — Apt 3C',
    tantiemes: '395/10000',
    solde: -2480,
    statut: 'Impayé',
    pill: 'rust',
    tel: '07 81 24 60 55',
    mail: 'a.rousseau@email.fr',
  },
  {
    id: 'P8',
    nom: 'Mathilde Faure',
    copro: 'Résidence Le Méridien',
    lot: 'Lot 7 — Apt A1',
    tantiemes: '288/10000',
    solde: 0,
    statut: 'À jour',
    pill: 'sage',
    tel: '06 19 44 72 88',
    mail: 'm.faure@email.fr',
  },
]
