/**
 * Copropriété de démonstration, sous la forme affichable d'une « vue copropriété » (voir fusionnerCoproMandat) :
 * dates « JJ/MM/AAAA », sans mandatId. Montants en euros.
 */
export interface CoproprieteDemo {
  id: string
  code: string
  nom: string
  lots: number
  adresse: string
  fondement: string
  motif: string
  tribunal: string
  rg: string
  ordonnance: string
  dureeMois: number
  echeance: string
  statut: string
  pill: 'sage' | 'amber' | 'rust' | 'gold'
  budget: number
  depense: number
  impayes: number
  fondsTravaux: number
  notifOrdonnance: string
}

/**
 * Les quatre copropriétés de démonstration : seed de la base locale, repli des hooks en mode démo et une dizaine d'écrans.
 * Villa Montaigne (« syndicat dépourvu de syndic ») relève de l'art. 46, donc du régime sj.
 */
export const DEMO_COPROPRIETES: CoproprieteDemo[] = [
  {
    id: 'C1',
    code: 'LM',
    nom: 'Résidence Le Méridien',
    lots: 36,
    adresse: '14 rue de Verdun, 92000 Nanterre',
    fondement: 'art. 46 — carence',
    motif: "AG régulièrement convoquée n'a pu désigner de syndic (majorité art. 25 non atteinte)",
    tribunal: 'TJ Nanterre',
    rg: '26/00892',
    ordonnance: '12/03/2026',
    dureeMois: 12,
    echeance: '12/03/2027',
    statut: 'En cours',
    pill: 'sage',
    budget: 142000,
    depense: 58400,
    impayes: 8460,
    fondsTravaux: 14200,
    notifOrdonnance: 'Effectuée',
  },
  {
    id: 'C2',
    code: 'CV',
    nom: 'Le Clos des Vignes',
    lots: 48,
    adresse: '8 av. du Château, 92500 Rueil-Malmaison',
    fondement: 'art. 46 — carence',
    motif: "Démission du syndic, AG n'a pu réélire (égalité des voix)",
    tribunal: 'TJ Nanterre',
    rg: '25/03517',
    ordonnance: '22/07/2025',
    dureeMois: 12,
    echeance: '22/07/2026',
    statut: 'Échéance proche',
    pill: 'amber',
    budget: 198000,
    depense: 151200,
    impayes: 21750,
    fondsTravaux: 31400,
    notifOrdonnance: 'Effectuée',
  },
  {
    id: 'C3',
    code: 'TL',
    nom: 'Copropriété Les Tilleuls',
    lots: 24,
    adresse: '3 rue des Lilas, 92100 Boulogne-Billancourt',
    fondement: 'art. 29-1 — difficulté',
    motif: 'Administration provisoire : déséquilibre financier grave (impayés > 25 %)',
    tribunal: 'TJ Nanterre',
    rg: '24/04521',
    ordonnance: '05/11/2024',
    dureeMois: 18,
    echeance: '05/05/2026',
    statut: 'Prorogation demandée',
    pill: 'rust',
    budget: 96000,
    depense: 88200,
    impayes: 34800,
    fondsTravaux: 2100,
    notifOrdonnance: 'Effectuée',
  },
  {
    id: 'C4',
    code: 'VM',
    nom: 'Villa Montaigne',
    lots: 12,
    adresse: '21 bd Victor Hugo, 92200 Neuilly-sur-Seine',
    fondement: 'art. 46 — carence',
    motif: "Syndicat dépourvu de syndic, requête d'un copropriétaire",
    tribunal: 'TJ Nanterre',
    rg: '26/01044',
    ordonnance: '28/04/2026',
    dureeMois: 9,
    echeance: '28/01/2027',
    statut: 'Notification en cours',
    pill: 'gold',
    budget: 54000,
    depense: 9800,
    impayes: 0,
    fondsTravaux: 6300,
    notifOrdonnance: 'En cours',
  },
]

export const DEMO_TOTAL_LOTS = DEMO_COPROPRIETES.reduce((total, copro) => total + copro.lots, 0)

export const DEMO_TOTAL_BUDGET = DEMO_COPROPRIETES.reduce((total, copro) => total + copro.budget, 0)

export const DEMO_TOTAL_DEPENSES = DEMO_COPROPRIETES.reduce((total, copro) => total + copro.depense, 0)

export const DEMO_TOTAL_IMPAYES = DEMO_COPROPRIETES.reduce((total, copro) => total + copro.impayes, 0)

/** Noms des copropriétés de démonstration (options des sélecteurs de copropriété). */
export const DEMO_NOMS_COPROPRIETES = DEMO_COPROPRIETES.map((copro) => copro.nom)

/** Copropriété de démonstration par code ; la première à défaut (repli de useTrouverCopro en mode démo). */
export const trouverCoproDemo = (code?: string | null): CoproprieteDemo =>
  DEMO_COPROPRIETES.find((copro) => copro.code === code) || DEMO_COPROPRIETES[0]

/**
 * Règles d'échéance déjà accomplies, par code de copropriété de démonstration.
 * Lues quel que soit le mode (comme dans la maquette) : en mode réel, une copropriété créée dont le code généré
 * vaut LM, CV, TL ou VM hérite de ces règles accomplies.
 */
export const DEMO_REGLES_ACCOMPLIES: Record<string, string[]> = {
  LM: ['compte-separe-sj'],
  CV: ['compte-separe-sj', 'ancien-syndic-tresorerie', 'ancien-syndic-archives', 'ancien-syndic-etat-comptes'],
  TL: [
    'publicite-creanciers-ap291',
    'rapport-intermediaire-ap291',
    'ancien-syndic-tresorerie',
    'ancien-syndic-archives',
    'ancien-syndic-etat-comptes',
  ],
  VM: [],
}
