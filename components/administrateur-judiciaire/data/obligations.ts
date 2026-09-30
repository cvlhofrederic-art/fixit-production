/** Obligation légale suivie : `date` « JJ/MM/AAAA » ou « En continu » (non datable : le seed stocke alors null). */
export interface ObligationDemo {
  id: string
  objet: string
  copro: string
  base: string
  date: string
  statut: string
  pill: 'rust' | 'amber' | 'sage'
  note: string
}

export const DEMO_OBLIGATIONS: ObligationDemo[] = [
  {
    id: 'O1',
    objet: 'Convocation AG élective',
    copro: 'Le Clos des Vignes',
    base: 'art. 17 L.1965 / art. 46 décret',
    date: '22/05/2026',
    statut: 'À faire',
    pill: 'rust',
    note: 'Au plus tard 2 mois avant fin de mission (22/07/2026)',
  },
  {
    id: 'O2',
    objet: "Notification de l'ordonnance",
    copro: 'Villa Montaigne',
    base: 'art. 59 décret 1967',
    date: '28/05/2026',
    statut: 'En cours',
    pill: 'amber',
    note: 'Dans le mois suivant le prononcé (28/04/2026)',
  },
  {
    id: 'O3',
    objet: 'Reddition de comptes au tribunal',
    copro: 'Copropriété Les Tilleuls',
    base: 'art. 29-1 et s. L.1965',
    date: '05/06/2026',
    statut: 'À faire',
    pill: 'rust',
    note: "Rapport de gestion de la période d'administration",
  },
  {
    id: 'O4',
    objet: 'État de frais et honoraires (taxation)',
    copro: 'Résidence Le Méridien',
    base: 'art. 704-718 CPC',
    date: '30/06/2026',
    statut: 'À préparer',
    pill: 'amber',
    note: 'Soumis au juge taxateur (président du TJ)',
  },
  {
    id: 'O5',
    objet: 'Immatriculation / MAJ registre des copropriétés',
    copro: 'Villa Montaigne',
    base: 'loi ALUR — art. L.711-2 CCH',
    date: '28/07/2026',
    statut: 'À faire',
    pill: 'amber',
    note: "Registre tenu par l'ANAH",
  },
  {
    id: 'O6',
    objet: 'Renouvellement assurance RC',
    copro: 'Le Clos des Vignes',
    base: 'art. 9-1 L.1965',
    date: '31/08/2026',
    statut: 'Planifié',
    pill: 'sage',
    note: 'Assurance obligatoire de la copropriété',
  },
  {
    id: 'O7',
    objet: 'Compte bancaire séparé — vérification',
    copro: 'Résidence Le Méridien',
    base: 'art. 18 L.1965',
    date: '15/06/2026',
    statut: 'Conforme',
    pill: 'sage',
    note: 'Compte séparé ouvert au nom du syndicat',
  },
  {
    id: 'O8',
    objet: 'DPE collectif',
    copro: 'Copropriété Les Tilleuls',
    base: 'loi Climat 2021',
    date: '31/12/2026',
    statut: 'Planifié',
    pill: 'sage',
    note: 'Obligation échelonnée selon nombre de lots',
  },
  {
    id: 'O9',
    objet: 'Plan pluriannuel de travaux (PPT)',
    copro: 'Le Clos des Vignes',
    base: 'loi Climat — art. 14-2 L.1965',
    date: '01/01/2027',
    statut: 'À engager',
    pill: 'amber',
    note: "Projet à soumettre au vote de l'AG",
  },
  {
    id: 'O10',
    objet: 'Alimentation fonds de travaux',
    copro: 'Copropriété Les Tilleuls',
    base: 'loi ALUR — art. 14-2 L.1965',
    date: 'En continu',
    statut: 'Sous-doté',
    pill: 'rust',
    note: 'Cotisation min. 5 % du budget prévisionnel',
  },
]
