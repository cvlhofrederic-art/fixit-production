export type ImportanceAvis = 'Importante' | 'Urgente' | ''

export type TeinteAvis = 'gold' | 'rust' | 'amber' | 'sage'

/** Avis d'affichage : échéance « JJ/MM/AAAA » ou « — ». « 2ᵉ » s'écrit avec U+1D49. */
export type AvisAffichage = [
  categorie: string,
  rubrique: string,
  importance: ImportanceAvis,
  copropriete: string,
  titre: string,
  contenu: string,
  echeance: string,
  teinte: TeinteAvis,
]

export const DEMO_AVIS_AFFICHAGE: AvisAffichage[] = [
  [
    'Convocation',
    'Assemblée',
    'Importante',
    'Le Méridien',
    "Convocation à l'assemblée générale élective",
    "L'AG se tiendra le 8 juin 2026 à 18h30. Ordre du jour et pouvoirs joints à la convocation LRAR.",
    '08/06/2026',
    'gold',
  ],
  [
    'Travaux',
    'Technique',
    'Urgente',
    'Les Tilleuls',
    'Travaux de toiture — accès limité',
    "Intervention de l'entreprise du 16 au 20 juin. Stationnement interdit côté rue durant les travaux.",
    '—',
    'rust',
  ],
  [
    'Juridique',
    'Mandat',
    'Importante',
    'Villa Montaigne',
    "Notification de l'ordonnance de désignation",
    "L'ordonnance du tribunal judiciaire désignant le syndic judiciaire est notifiée à l'ensemble des copropriétaires.",
    '—',
    'amber',
  ],
  [
    'Finances',
    'Appel de fonds',
    '',
    'Le Clos des Vignes',
    'Appel de fonds — 2ᵉ trimestre',
    "Les appels de fonds du T2 sont disponibles sur l'extranet. Échéance de règlement au 30 juin.",
    '30/06/2026',
    'sage',
  ],
]
