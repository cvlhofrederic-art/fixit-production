export type StatutMessageDigital = 'lu' | 'distribué' | 'en attente'

export type MessageCommunicationDigitale = [objet: string, destinataire: string, date: string, statut: StatutMessageDigital]

export const DEMO_MESSAGES_COMMUNICATION_DIGITALE: MessageCommunicationDigitale[] = [
  ['Compte rendu de visite', 'Conseil syndical — Le Méridien', '03/06/2026', 'lu'],
  ['Demande de devis', 'Ent. Toitures Nord', '28/05/2026', 'distribué'],
  ['Relance impayé', 'SCI Belvédère', '30/05/2026', 'en attente'],
  ['Convocation AG', 'Copropriétaires — Le Clos des Vignes', '22/05/2026', 'lu'],
]
