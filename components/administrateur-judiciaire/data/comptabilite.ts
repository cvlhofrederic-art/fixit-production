export type AppelComptabilite = [libelle: string, copropriete: string, montant: string]

/** Derniers appels de fonds (5 lignes, la dernière sans bordure basse). */
export const DEMO_DERNIERS_APPELS_COMPTABILITE: AppelComptabilite[] = [
  ['Appel T2 2026 — charges courantes', 'Le Méridien', '35 500 €'],
  ['Appel T2 2026 — charges courantes', 'Le Clos des Vignes', '49 500 €'],
  ['Cotisation fonds travaux', 'Le Méridien', '7 100 €'],
  ['Appel travaux toiture', 'Les Tilleuls', '18 400 €'],
  ['Appel T2 2026 — charges courantes', 'Villa Montaigne', '13 500 €'],
]

/** Écriture comptable : montant signé en chaîne, avec un tiret ASCII « - » pour les débits. */
export type EcritureComptable = [
  date: string,
  compte: string,
  description: string,
  type: 'recette' | 'dépense',
  montant: string,
]

/** 6 écritures ; « Dernières écritures » n'affiche que les 5 premières. */
export const DEMO_ECRITURES_COMPTABILITE: EcritureComptable[] = [
  ['04/06/2026', '512 — Banque', 'Encaissement charges M. Bernard', 'recette', '+340 €'],
  ['03/06/2026', '615 — Entretien', 'Facture Plomberie Centrale', 'dépense', '-620 €'],
  ['02/06/2026', '512 — Banque', 'Cotisation fonds travaux', 'recette', '+1 200 €'],
  ['31/05/2026', '606 — Énergie', 'Facture électricité parties communes', 'dépense', '-410 €'],
  ['30/05/2026', '622 — Honoraires', 'Honoraires de gestion (mandat)', 'dépense', '-1 100 €'],
  ['28/05/2026', '512 — Banque', 'Remboursement trop-perçu Mme Olivier', 'dépense', '-142 €'],
]

export type ExerciceComptable = [annee: string, copropriete: string, totalPrevu: string, etat: 'clôturé' | 'en cours']

/** Montants saisis en dur, sans lien calculé avec DEMO_COPROPRIETES. */
export const DEMO_EXERCICES_COMPTABLES: ExerciceComptable[] = [
  ['2025', 'Résidence Le Méridien', '142 000 €', 'clôturé'],
  ['2025', 'Le Clos des Vignes', '198 000 €', 'en cours'],
  ['2025', 'Copropriété Les Tilleuls', '96 000 €', 'en cours'],
  ['2024', 'Villa Montaigne', '54 000 €', 'clôturé'],
]

/** Document comptable joint à la convocation d'AG (annexes du décret n° 2005-240). */
export type DocumentComptableAg = [titre: string, reference: string, icone: string]

export const DOCUMENTS_COMPTABLES_AG: DocumentComptableAg[] = [
  ['Compte de gestion général', 'Annexe 2 — décret 2005-240', 'chart'],
  ['Situation financière', 'Annexe 1 — trésorerie & comptes', 'bank'],
  ['Budget prévisionnel', 'Annexe 3 — exercice à venir', 'coin'],
  ['État des dettes et créances', 'Annexe 4 & 5', 'fact'],
]
