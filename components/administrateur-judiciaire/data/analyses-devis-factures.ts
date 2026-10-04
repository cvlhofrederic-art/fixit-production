/** Teinte d'une analyse : `kind` de la pastille et suffixe des variables CSS (`var(--sage-50)`, `var(--sage-500)`…). */
export type TeinteAnalyse = 'sage' | 'amber' | 'rust'

/** Analyse automatique d'un devis ou d'une facture. */
export type AnalyseDevisFacture = [
  document: string,
  montant: string,
  verdict: string,
  commentaire: string,
  teinte: TeinteAnalyse,
]

export const DEMO_ANALYSES_DEVIS_FACTURES: AnalyseDevisFacture[] = [
  [
    'Devis toiture — Ent. Toitures Nord',
    '18 400 € HT',
    'Conforme',
    'Prix de marché cohérent, mentions légales complètes.',
    'sage',
  ],
  [
    'Devis ascenseur — Kone',
    '12 900 € HT',
    'À vérifier',
    'TVA à confirmer (10 % ou 20 % selon nature des travaux).',
    'amber',
  ],
  [
    'Facture plomberie — Plomberie Centrale',
    '744 € TTC',
    'Anomalie',
    'Écart avec le devis initial (+120 €) non justifié.',
    'rust',
  ],
  [
    'Devis ravalement — Façade Pro',
    '24 200 € HT',
    'Conforme',
    'Décomposition détaillée, garantie décennale jointe.',
    'sage',
  ],
]
