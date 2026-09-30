/** Document en signature : la teinte de la pastille est portée par la ligne. */
export type DocumentSignatureDemo = [
  document: string,
  signataire: string,
  statut: 'signé' | 'en attente',
  teinte: 'sage' | 'amber',
]

export const DEMO_DOCUMENTS_SIGNATURE_ELECTRONIQUE: DocumentSignatureDemo[] = [
  ["Contrat d'entretien ascenseur", 'Otis', 'signé', 'sage'],
  ['Procès-verbal AG 2025', 'Conseil syndical — Le Méridien', 'en attente', 'amber'],
  ['Devis travaux toiture', 'Ent. Toitures Nord', 'en attente', 'amber'],
  ['Mandat de prélèvement', 'SCI Belvédère', 'signé', 'sage'],
]
