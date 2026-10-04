/** Reprise des pièces auprès de l'ancien syndic (écran Reprise judiciaire, veille de Fixy). */

export type ClePieceReprise =
  | 'tresorerie'
  | 'archives'
  | 'comptes'
  | 'registre_pv'
  | 'reglement'
  | 'contrats'
  | 'carnet'
  | 'sinistres'
  | 'personnel'
  | 'immatriculation'
  | 'cles'
  | 'compteurs'

export interface PieceReprise {
  cle: ClePieceReprise
  libelle: string
  base: string
  /** « 15 jours », « 1 mois », « apurement » ou « pratique » (sans délai légal). */
  delai: string
}

export const PIECES_REPRISE: PieceReprise[] = [
  {
    cle: 'tresorerie',
    libelle: 'Situation de trésorerie, références des comptes bancaires, coordonnées de la banque',
    base: 'L. 1965 art. 18-2',
    delai: '15 jours',
  },
  {
    cle: 'archives',
    libelle: 'Documents et archives du syndicat, dématérialisés en format téléchargeable et imprimable',
    base: 'L. 1965 art. 18-2',
    delai: '1 mois',
  },
  {
    cle: 'comptes',
    libelle: 'État des comptes des copropriétaires et du syndicat, après apurement et clôture',
    base: 'L. 1965 art. 18-2',
    delai: 'apurement',
  },
  {
    cle: 'registre_pv',
    libelle: "Registre des procès-verbaux d'assemblée et feuilles de présence",
    base: 'D. 1967 art. 17',
    delai: '1 mois',
  },
  {
    cle: 'reglement',
    libelle: 'Règlement de copropriété, état descriptif de division, modificatifs',
    base: 'archives',
    delai: '1 mois',
  },
  {
    cle: 'contrats',
    libelle: 'Contrats en cours : assurance, entretien, ascenseur, énergie, gardien',
    base: 'archives',
    delai: '1 mois',
  },
  {
    cle: 'carnet',
    libelle: "Carnet d'entretien, diagnostics (DTA amiante, DPE, DTG), fiche synthétique",
    base: 'L. 1965 art. 8-2 et 18',
    delai: '1 mois',
  },
  {
    cle: 'sinistres',
    libelle: 'Dossiers de sinistres et de contentieux en cours',
    base: 'archives',
    delai: '1 mois',
  },
  {
    cle: 'personnel',
    libelle: 'Dossier du gardien : contrat, bulletins, DUE, mutuelle',
    base: 'archives',
    delai: '1 mois',
  },
  {
    cle: 'immatriculation',
    libelle: 'Accès au registre national des copropriétés (immatriculation)',
    base: 'CCH art. L. 711-1',
    delai: 'pratique',
  },
  {
    cle: 'cles',
    libelle: "Clés, badges, codes d'accès, mots de passe (extranet, banque en ligne), chéquiers",
    base: 'pratique',
    delai: 'pratique',
  },
  {
    cle: 'compteurs',
    libelle: 'Références des compteurs (PDL, PCE, eau) pour la reprise des contrats',
    base: 'pratique',
    delai: 'pratique',
  },
]

/** Document du journal des pièces (entiteType « reprise », type = clé de pièce ou « retrait:clé »). */
export interface DocumentPieceReprise {
  entiteType: string
  entiteId: string
  type: string
}

/**
 * Clés des pièces reçues pour une copropriété : chaque dépôt compte +1, chaque « retrait:clé » −1,
 * une pièce est reçue si son solde est positif.
 */
export function piecesRepriseRecues(documents: DocumentPieceReprise[], coproprieteId: string): Set<string> {
  const soldes = new Map<string, number>()
  for (const document of documents) {
    if (document.entiteType !== 'reprise' || document.entiteId !== coproprieteId) continue
    const retrait = document.type.startsWith('retrait:'),
      cle = retrait ? document.type.slice(8) : document.type
    soldes.set(cle, (soldes.get(cle) || 0) + (retrait ? -1 : 1))
  }
  return new Set(
    Array.from(soldes.entries())
      .filter(([, solde]) => solde > 0)
      .map(([cle]) => cle),
  )
}

/** Règle du moteur de délais correspondant au délai d'une pièce (« pratique » : pas de délai légal). */
export const REGLE_MOTEUR_PAR_DELAI_PIECE: Partial<Record<string, string>> = {
  '15 jours': 'ancien-syndic-tresorerie',
  '1 mois': 'ancien-syndic-archives',
  apurement: 'ancien-syndic-etat-comptes',
}
