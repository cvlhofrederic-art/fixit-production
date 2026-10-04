/**
 * Modèles de message par intitulé. L'ordre des clés donne l'ordre des options (la clé vide est filtrée) ;
 * « [date] » et « [heure] » sont des emplacements à compléter à la main.
 */
export const MODELES_MESSAGES_COPROPRIETAIRES: Record<string, string> = {
  '': '',
  'Convocation AG': "Bonjour, vous êtes convoqué(e) à l'assemblée générale du [date] à [heure]. Convocation et pouvoirs envoyés par courrier.",
  'Rappel impayé': 'Bonjour, nous vous rappelons que des charges de copropriété restent dues. Merci de régulariser votre situation.',
  Travaux: 'Bonjour, des travaux auront lieu du [date] au [date]. Merci de votre compréhension pour la gêne occasionnée.',
}

export type EnvoiMessageCoproprietaires = [
  objet: string,
  copropriete: string,
  destinataires: string,
  canal: 'SMS' | 'Email',
  statut: 'distribué' | 'lu',
]

export const DEMO_ENVOIS_MESSAGES_COPROPRIETAIRES: EnvoiMessageCoproprietaires[] = [
  ['Convocation AG', 'Le Clos des Vignes', '48 destinataires', 'SMS', 'distribué'],
  ['Rappel impayé', 'Les Tilleuls', '3 destinataires', 'Email', 'lu'],
  ['Travaux toiture', 'Les Tilleuls', '24 destinataires', 'SMS', 'distribué'],
]
