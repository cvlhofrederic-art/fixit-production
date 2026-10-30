import { composerDateIso } from '@/lib/administrateur-judiciaire/domain/dates'
import {
  nouvelleFicheCopropriete,
  type FicheCopropriete,
  type MembreEquipe,
} from '@/lib/administrateur-judiciaire/domain/fiche-copropriete'
import { MODE_ACTIF, type Mode } from '@/lib/administrateur-judiciaire/mode'

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

const d = composerDateIso
const EQUIPE_DEMO: MembreEquipe[] = [
  { role: 'Responsable', collaborateur: 'Gestionnaire A' },
  { role: 'Comptable', collaborateur: 'Comptable B' },
  { role: 'Assistant(e)', collaborateur: 'Assistant C' },
]
const CLE_GENERALE = { code: '001', libelle: 'Charges communes générales', tantiemes: '10 000', principale: true }

/** Fiches de démonstration (données fictives), par code de copropriété. */
export const FICHES_COPROPRIETES_DEMO: Record<string, FicheCopropriete> = {
  LM: nouvelleFicheCopropriete({
    numeroMandat: 'M012',
    typeMandat: 'Syndic judiciaire (art. 46)',
    dateEffet: d(2026, 3, 12),
    immatriculation: 'AC1 234 567',
    ics: 'FR12ZZZ123456',
    lots: { habitation: 32, commerce: 4, stationnements: 18, usage: 'Mixte (habitation et commerce)' },
    equipe: EQUIPE_DEMO,
    cles: [
      CLE_GENERALE,
      { code: '004', libelle: 'Charges parts égales', tantiemes: '36', principale: false },
      { code: '007', libelle: 'Charges escalier', tantiemes: '1 000', principale: false },
      { code: 'C00', libelle: 'Compteur eau froide', tantiemes: 'relevés', principale: false },
    ],
    exercices: [
      { annee: 2026, assemblee: null, budgetEuros: 142000, statut: 'Préparé' },
      { annee: 2025, assemblee: d(2026, 4, 18), budgetEuros: 138000, statut: 'Voté' },
    ],
    conseilSyndical: { eluLe: d(2026, 4, 18), dureeMois: 12 },
    agVisio: true,
    alerteTresorerieEuros: 10000,
    forfait: { visites: 4, heuresAgo: 3, heuresCs: 2 },
    notes: 'Ordonnance notifiée aux copropriétaires.',
    avertissement: 'Fonds de travaux sur compte séparé obligatoire.',
  }),
  CV: nouvelleFicheCopropriete({
    numeroMandat: 'M007',
    typeMandat: 'Syndic judiciaire (art. 46)',
    dateEffet: d(2025, 7, 22),
    immatriculation: 'AC2 345 678',
    ics: 'FR34ZZZ234567',
    lots: { habitation: 48, commerce: 0, stationnements: 30, usage: 'Habitation' },
    equipe: EQUIPE_DEMO,
    cles: [CLE_GENERALE, { code: '010', libelle: 'Ascenseur', tantiemes: '1 000', principale: false }],
    exercices: [
      { annee: 2026, assemblee: null, budgetEuros: 198000, statut: 'Préparé' },
      { annee: 2025, assemblee: d(2025, 10, 9), budgetEuros: 192000, statut: 'Voté' },
      { annee: 2024, assemblee: d(2025, 10, 9), budgetEuros: 185000, statut: 'Approuvé' },
    ],
    conseilSyndical: { eluLe: d(2025, 10, 9), dureeMois: 24 },
    forfait: { visites: 6, heuresAgo: 3, heuresCs: 4 },
  }),
  TL: nouvelleFicheCopropriete({
    numeroMandat: 'M003',
    typeMandat: 'Administration provisoire (art. 29-1)',
    dateEffet: d(2024, 11, 5),
    immatriculation: 'AC3 456 789',
    employeur: true,
    lots: { habitation: 22, commerce: 2, stationnements: 8, usage: 'Mixte (habitation et commerce)' },
    equipe: EQUIPE_DEMO,
    cles: [CLE_GENERALE],
    exercices: [{ annee: 2025, assemblee: null, budgetEuros: 96000, statut: 'Préparé' }],
    soumisArt22: true,
    alerteTresorerieEuros: 5000,
    forfait: { visites: 2, heuresAgo: 3, heuresCs: 0 },
    avertissement: 'Redressement (art. 29-1) : publicité aux créanciers en cours.',
  }),
  VM: nouvelleFicheCopropriete({
    numeroMandat: 'M015',
    typeMandat: 'Syndic judiciaire (art. 46)',
    dateEffet: d(2026, 4, 28),
    lots: { habitation: 12, commerce: 0, stationnements: 6, usage: 'Habitation' },
    equipe: EQUIPE_DEMO.slice(0, 2),
    cles: [CLE_GENERALE],
    forfait: { visites: 2, heuresAgo: 2, heuresCs: 0 },
    notes: 'Syndicat dépourvu de syndic : première assemblée à convoquer.',
  }),
}

/** Copropriété complétée de sa fiche de démonstration, en mode démonstration seulement et si elle n'en a pas. */
export function completerCoproAvecDemo<T extends { code: string; fiche?: FicheCopropriete }>(copro: T, mode: Mode = MODE_ACTIF): T {
  if (copro.fiche || mode !== 'demo') return copro
  const fiche = FICHES_COPROPRIETES_DEMO[copro.code]
  return fiche ? { ...copro, fiche } : copro
}
