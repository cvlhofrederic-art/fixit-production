export type TypeNotification = 'legal' | 'debt' | 'payment' | 'mission' | 'insurance' | 'ag' | 'message' | 'equipa'

/** Notification de démonstration : `time` est relatif (« il y a 8 min », « hier »…), converti en date par le seed. */
export interface NotificationDemo {
  id: string
  kind: TypeNotification
  icon: string
  time: string
  title: string
  desc: string
}

export const DEMO_NOTIFICATIONS: NotificationDemo[] = [
  {
    id: 'n01',
    kind: 'legal',
    icon: 'scale',
    time: 'il y a 8 min',
    title: 'AG élective à convoquer',
    desc: 'Le Clos des Vignes · échéance de mission 22/07/2026 · convocation requise avant le 22/05',
  },
  {
    id: 'n02',
    kind: 'debt',
    icon: 'alert',
    time: 'il y a 25 min',
    title: 'Impayé en contentieux',
    desc: 'SCI Belvédère · Les Tilleuls · 9 200 € · mise en demeure à signifier',
  },
  {
    id: 'n03',
    kind: 'payment',
    icon: 'coin',
    time: 'il y a 40 min',
    title: 'Honoraires taxés',
    desc: 'Les Tilleuls · état de frais 2025 taxé par le juge (14 400 €)',
  },
  {
    id: 'n04',
    kind: 'mission',
    icon: 'doc',
    time: 'il y a 1 h',
    title: 'Notification ordonnance',
    desc: 'Villa Montaigne · 9/12 copropriétaires notifiés (art. 59 décret)',
  },
  {
    id: 'n05',
    kind: 'insurance',
    icon: 'shield',
    time: 'il y a 2 h',
    title: 'Sinistre déclaré',
    desc: 'Le Clos des Vignes · dégât des eaux 4e étage · #SIN-2026-014',
  },
  {
    id: 'n06',
    kind: 'ag',
    icon: 'bank',
    time: 'il y a 3 h',
    title: 'PV en attente de signature',
    desc: 'Le Méridien · AG du 18/05 · signature électronique du président',
  },
  {
    id: 'n07',
    kind: 'legal',
    icon: 'scale',
    time: 'hier',
    title: 'Prorogation à demander',
    desc: 'Les Tilleuls · mission art. 29-1 expirée le 05/05 · requête au TJ',
  },
  {
    id: 'n08',
    kind: 'message',
    icon: 'chat',
    time: 'hier',
    title: 'Léa — anomalies comptables',
    desc: 'Le Clos des Vignes · 3 écritures à valider sur le compte séparé',
  },
  {
    id: 'n09',
    kind: 'equipa',
    icon: 'users',
    time: 'il y a 2 j',
    title: 'Collaborateur ajouté',
    desc: 'Camille Noël a rejoint le cabinet — Juriste copropriété',
  },
  {
    id: 'n10',
    kind: 'payment',
    icon: 'bank',
    time: 'il y a 2 j',
    title: 'Mouvement fonds de travaux',
    desc: '+1 800 € · fonds de travaux du Méridien (loi ALUR)',
  },
  {
    id: 'n11',
    kind: 'mission',
    icon: 'fact',
    time: 'il y a 3 j',
    title: 'Immatriculation registre',
    desc: "Villa Montaigne · mise à jour à transmettre à l'ANAH avant le 28/07",
  },
  {
    id: 'n12',
    kind: 'ag',
    icon: 'pencil',
    time: 'il y a 4 j',
    title: 'Ordre du jour à finaliser',
    desc: 'AG élective Clos des Vignes · désignation du syndic à inscrire',
  },
]
