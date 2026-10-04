/** Message d'un fil de courriel : `them` = copropriétaire, `me` = cabinet. */
export interface MessageFilCourriel {
  who: 'them' | 'me'
  when: string
  text: string
}

/** Courriel reçu dans la boîte d'Alfredo, avec son brouillon de réponse (gabarit multiligne). */
export interface CourrielAlfredo {
  id: string
  from: string
  init: string
  email: string
  copro: string
  subject: string
  date: string
  unread: boolean
  tag: string
  tagk: 'amber' | 'rust' | 'navy' | 'sage' | 'gold'
  thread: MessageFilCourriel[]
  draft: string
}

/** Valeur initiale de la boîte (état local de l'écran, non persisté). */
export const DEMO_COURRIELS_ALFREDO: CourrielAlfredo[] = [
  {
    id: 'e1',
    from: 'Hélène Dubois',
    init: 'HD',
    email: 'h.dubois@gmail.com',
    copro: 'Résidence Le Méridien',
    subject: 'Régularisation des charges 2025',
    date: "Aujourd'hui 09:14",
    unread: true,
    tag: 'Charges',
    tagk: 'amber',
    thread: [
      {
        who: 'them',
        when: "Aujourd'hui 09:14",
        text: "Bonjour, je viens de recevoir l'appel de régularisation des charges 2025 de 340 €. Pourriez-vous me détailler ce qui justifie ce complément ? Je n'ai pas eu connaissance de dépenses exceptionnelles. Cordialement, Hélène Dubois — lot 14.",
      },
    ],
    draft: `Madame Dubois,

Je fais suite à votre message. La régularisation de 340 € correspond à l'écart entre les provisions appelées en 2025 et les charges réelles arrêtées lors de la reddition de comptes : pour l'essentiel le surcoût de chauffage collectif (+1 800 € sur l'immeuble) et la remise en état de la VMC. Le décompte individuel par tantièmes est joint au présent courrier.

Je reste à votre disposition pour tout complément.

Le syndic judiciaire — Cabinet Delaunay`,
  },
  {
    id: 'e2',
    from: 'Marc Petit',
    init: 'MP',
    email: 'marc.petit@orange.fr',
    copro: 'Copropriété Les Tilleuls',
    subject: 'Fuite au plafond — appartement 3B',
    date: "Aujourd'hui 08:02",
    unread: true,
    tag: 'Sinistre',
    tagk: 'rust',
    thread: [
      {
        who: 'them',
        when: 'Hier 21:40',
        text: "Bonsoir, une fuite est apparue au plafond de ma chambre (3B), visiblement en provenance du logement du dessus. L'eau coule depuis ce matin. Que dois-je faire ?",
      },
      {
        who: 'me',
        when: 'Hier 22:05',
        text: "Bonsoir, merci pour votre signalement. Coupez si possible l'arrivée d'eau de la colonne et placez un récipient. J'interviens dès demain matin.",
      },
      {
        who: 'them',
        when: "Aujourd'hui 08:02",
        text: "C'est fait. La fuite continue légèrement. Faut-il déclarer le sinistre à l'assurance ?",
      },
    ],
    draft: `Monsieur Petit,

Je vous confirme qu'un plombier (Atlantic Plomberie) intervient ce jour pour localiser et stopper la fuite. En parallèle, je déclare le dégât des eaux à l'assurance multirisque de la copropriété (Generali, police MRI-44120) et vous transmets le numéro de sinistre. Merci de conserver les photos des dommages pour l'expertise.

Bien à vous,
Le syndic judiciaire — Cabinet Delaunay`,
  },
  {
    id: 'e3',
    from: 'Sylvie Moreau',
    init: 'SM',
    email: 's.moreau@free.fr',
    copro: 'Le Clos des Vignes',
    subject: "Date de l'assemblée générale",
    date: 'Hier 16:30',
    unread: false,
    tag: 'AG',
    tagk: 'navy',
    thread: [
      {
        who: 'them',
        when: 'Hier 16:30',
        text: "Bonjour, savez-vous quand se tiendra la prochaine assemblée générale ? Je dois m'organiser pour être présente ou donner pouvoir. Merci.",
      },
    ],
    draft: `Madame Moreau,

L'assemblée générale ordinaire est prévue le 8 juillet 2026 à 18h30. La convocation officielle, accompagnée de l'ordre du jour et des annexes comptables, vous parviendra par lettre recommandée au moins 21 jours avant la séance (art. 9 du décret du 17 mars 1967). Un formulaire de vote par correspondance et de pouvoir y sera joint.

Cordialement,
Le syndic judiciaire — Cabinet Delaunay`,
  },
  {
    id: 'e4',
    from: 'Jean Lefèvre',
    init: 'JL',
    email: 'jlefevre@sfr.fr',
    copro: 'Résidence Le Méridien',
    subject: 'Demande de travaux — porte du local vélos',
    date: 'Hier 11:12',
    unread: false,
    tag: 'Travaux',
    tagk: 'sage',
    thread: [
      {
        who: 'them',
        when: 'Hier 11:12',
        text: "Bonjour, la porte du local à vélos ne ferme plus correctement, ce qui pose un problème de sécurité. Serait-il possible de la faire réparer ? Merci d'avance.",
      },
    ],
    draft: `Monsieur Lefèvre,

Merci de votre signalement. Je sollicite un devis auprès de notre serrurier pour la réparation (ou le remplacement) du ferme-porte du local à vélos. S'agissant d'une dépense de maintenance courante, l'intervention sera engagée sur le budget prévisionnel sans attendre l'assemblée. Je vous tiens informé de la date d'intervention.

Bien cordialement,
Le syndic judiciaire — Cabinet Delaunay`,
  },
  {
    id: 'e5',
    from: 'Conseil syndical',
    init: 'CS',
    email: 'cs.tilleuls@gmail.com',
    copro: 'Copropriété Les Tilleuls',
    subject: 'Point sur le redressement financier',
    date: '12 juin',
    unread: false,
    tag: 'Conseil',
    tagk: 'gold',
    thread: [
      {
        who: 'them',
        when: '12 juin',
        text: "Bonjour, le conseil syndical souhaiterait un point d'étape sur le redressement de la copropriété : où en est la dette et le recouvrement des impayés ?",
      },
    ],
    draft: `Mesdames, Messieurs les membres du conseil syndical,

À ce jour, la dette fournisseurs a été ramenée de 51 000 € à 34 800 €. Trois mises en demeure ont été adressées aux copropriétaires les plus débiteurs et un plan d'apurement sur 18 mois est proposé. Je présenterai un état détaillé lors de l'assemblée du 8 juillet, accompagné du rapport déposé au tribunal.

Bien à vous,
Le syndic judiciaire — Cabinet Delaunay`,
  },
]
