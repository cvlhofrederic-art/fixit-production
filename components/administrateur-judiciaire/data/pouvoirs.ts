/** Réponse du vérificateur « Puis-je décider seul ? » pour un type de décision. */
export interface DecisionPouvoir {
  q: string
  verdict: string
  pill: 'sage' | 'amber' | 'rust' | 'gold'
  why: string
}

/** Matrice des pouvoirs ; la première entrée est la sélection par défaut. */
export const MATRICE_POUVOIRS: DecisionPouvoir[] = [
  {
    q: "Gestion courante, contrats d'entretien",
    verdict: 'Autorisé',
    pill: 'sage',
    why: 'Relève des pouvoirs du syndic (art. 18 L. 1965).',
  },
  {
    q: 'Travaux urgents de sauvegarde',
    verdict: 'Autorisé',
    pill: 'sage',
    why: 'Mesures conservatoires nécessaires (art. 18 ; jurisprudence constante).',
  },
  {
    q: 'Recouvrement des impayés / mise en demeure',
    verdict: 'Autorisé',
    pill: 'sage',
    why: 'Pouvoir du syndic ; engagement des poursuites (art. 19, 10-1).',
  },
  {
    q: "Travaux d'amélioration (art. 30)",
    verdict: 'AG requise',
    pill: 'amber',
    why: "Décision de l'assemblée, sauf si expressément inclus dans la mission par l'ordonnance.",
  },
  {
    q: 'Emprunt collectif',
    verdict: 'AG requise',
    pill: 'amber',
    why: "Majorité spéciale de l'AG (art. 26) — hors pouvoirs propres de l'administrateur.",
  },
  {
    q: 'Vente / constitution de droits réels (art. 26 a et b)',
    verdict: 'Exclu',
    pill: 'rust',
    why: "Expressément exclu des pouvoirs transférables à l'AP par l'art. 29-1.",
  },
  {
    q: 'Action en justice au nom du syndicat',
    verdict: 'Selon ordonnance',
    pill: 'gold',
    why: "Dépend des pouvoirs conférés par le juge dans l'ordonnance de désignation.",
  },
]
