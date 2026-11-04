/** Document en signature : la teinte de la pastille est portée par la ligne ; `copro` = code de la copropriété. */
export type DocumentSignatureDemo = [
  document: string,
  signataire: string,
  statut: 'signé' | 'en attente',
  teinte: 'sage' | 'amber',
  copro: string,
]

export const DEMO_DOCUMENTS_SIGNATURE_ELECTRONIQUE: DocumentSignatureDemo[] = [
  ["Contrat d'entretien ascenseur", 'Otis', 'signé', 'sage', 'LM'],
  ['Procès-verbal AG 2025', 'Conseil syndical — Le Méridien', 'en attente', 'amber', 'LM'],
  ['Devis travaux toiture', 'Ent. Toitures Nord', 'en attente', 'amber', 'TL'],
  ['Mandat de prélèvement', 'SCI Belvédère', 'signé', 'sage', 'TL'],
]
