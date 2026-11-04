export type StatutMessageDigital = 'lu' | 'distribué' | 'en attente'

/** Message de l'écran ; `copro` = code de la copropriété concernée. */
export type MessageCommunicationDigitale = [
  objet: string,
  destinataire: string,
  date: string,
  statut: StatutMessageDigital,
  copro: string,
]

export const DEMO_MESSAGES_COMMUNICATION_DIGITALE: MessageCommunicationDigitale[] = [
  ['Compte rendu de visite', 'Conseil syndical — Le Méridien', '03/06/2026', 'lu', 'LM'],
  ['Demande de devis', 'Ent. Toitures Nord', '28/05/2026', 'distribué', 'TL'],
  ['Relance impayé', 'SCI Belvédère', '30/05/2026', 'en attente', 'TL'],
  ['Convocation AG', 'Copropriétaires — Le Clos des Vignes', '22/05/2026', 'lu', 'CV'],
]
