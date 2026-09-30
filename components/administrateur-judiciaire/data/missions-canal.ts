import type { EtapeMission } from '@/lib/administrateur-judiciaire/domain/ordre-mission'

export type PointMission = 'gold' | 'amber' | 'sage' | 'rust'

/** Couleur de la pastille d'un ordre de mission (fond de `span.canal-mission-dot`). */
export const COULEUR_POINT_MISSION: Record<PointMission, string> = {
  gold: 'var(--gold-500)',
  amber: 'var(--amber-500)',
  sage: 'var(--sage-500)',
  rust: 'var(--rust-500)',
}

/** Photo réelle jointe au signalement de la fuite sur colonne (image extraite de la maquette). */
export const PHOTO_FUITE_COLONNE_URL = '/images/administrateur-judiciaire/canal/fuite-colonne.jpg'

/** Participant à un ordre de mission : [initiales, nom, rôle, 'on' si en ligne]. */
export type ParticipantMission = [initiales: string, nom: string, role: string, enLigne: 'on' | '']

/** Message du fil : [auteur, horodatage, texte, sens] (`them` = reçu, `me` = envoyé par le cabinet). */
export type MessageMission = [auteur: string, horodatage: string, texte: string, sens: 'them' | 'me']

export interface MissionCanal {
  id: string
  dot: PointMission
  title: string
  sub: string
  tags: string[]
  unread: number
  area: string
  pro: string
  proInit: string
  building: string
  batiment: string
  etage: string
  gardien: string
  gardienTel: string
  code: string
  origine: string
  date: string
  duration: string
  desc: string
  realPhoto?: string
  photos: string[]
  parts: ParticipantMission[]
  steps: EtapeMission[]
  msgs: MessageMission[]
}

/**
 * Ordres de mission du canal de communication (valeur initiale de l'écran, source des fils de messages).
 * Pour « mfuite », les 4 étapes statiques sont remplacées à l'affichage par etapesWorkflowMissionFuite.
 * Typographie d'origine : deux apostrophes courbes (« Stagnation d’eau », « via l’application résident »).
 */
export const DEMO_MISSIONS_CANAL: MissionCanal[] = [
  {
    id: 'mfuite',
    dot: 'rust',
    title: 'Fuite colonne — Le Méridien',
    sub: 'Signalement gardien · partie commune',
    tags: ['Sinistre', 'Urgent', 'À traiter'],
    unread: 1,
    area: 'Plomberie / chauffage',
    pro: 'Atlantic Plomberie SARL',
    proInit: 'AP',
    building: 'Résidence Le Méridien',
    batiment: 'Bâtiment B',
    etage: 'Sous-sol — local technique (colonne EU)',
    gardien: 'M. Moreira',
    gardienTel: '06 21 45 78 90',
    code: 'Portail B-2045 · clé local technique à la loge',
    origine: 'Gardien (M. Moreira) — via app',
    date: '19/06/2026',
    duration: 'à planifier',
    desc: "Fuite d'eau sur colonne d'évacuation en partie commune",
    realPhoto: PHOTO_FUITE_COLONNE_URL,
    photos: [],
    parts: [['ML', 'Marc Léautaud', 'Gestionnaire technique', 'on'], ['AP', 'Atlantic Plomberie', 'Artisan', '']],
    steps: [
      ['Signalement (app)', '19/06', 'done'],
      ['Dispatch gestionnaire', 'En cours', 'now'],
      ['Intervention artisan', '—', 'todo'],
      ['Validation artisan', '—', 'todo'],
    ],
    msgs: [],
  },
  {
    id: 'm1',
    dot: 'rust',
    title: 'Toiture — Les Tilleuls',
    sub: 'Couverture Île-de-France',
    tags: ['Travaux', 'En cours'],
    unread: 2,
    area: 'Couverture / étanchéité',
    pro: 'Couverture Île-de-France',
    proInit: 'CI',
    building: 'Copropriété Les Tilleuls',
    batiment: 'Bâtiment A',
    etage: 'Toiture-terrasse (R+4)',
    gardien: 'M. Da Silva',
    gardienTel: '06 12 34 56 78',
    code: 'Portail A-1234 · interphone « Loge »',
    origine: 'Gardien (M. Da Silva) — via app',
    date: '16/06/2026',
    duration: '4 jours',
    desc: "Réfection de l'étanchéité de la toiture-terrasse",
    photos: ['Infiltration plafond 4e', 'Étanchéité fissurée', 'Stagnation d’eau'],
    parts: [['ML', 'Marc Léautaud', 'Gestionnaire technique', 'on'], ['CI', 'Couverture ÎdF', 'Artisan', '']],
    steps: [
      ['Signalement (app)', '10/05', 'done'],
      ['Dispatch gestionnaire', '12/05', 'done'],
      ['Intervention artisan', '16/06', 'now'],
      ['Validation artisan', '—', 'todo'],
    ],
    msgs: [
      [
        'Couverture ÎdF',
        'Hier 14:00',
        "Bien reçu l'ordre de mission. Intervention confirmée le 16/06, équipe de 3.",
        'them',
      ],
      ['Vous', 'Hier 15:10', 'Parfait. Le gardien M. Da Silva vous ouvrira la toiture, code portail A-1234.', 'me'],
    ],
  },
  {
    id: 'm2',
    dot: 'amber',
    title: 'Ascenseur — Le Méridien',
    sub: 'OTIS Maintenance · contrat cadre',
    tags: ['Technique', 'Urgent'],
    unread: 1,
    area: 'Ascensoriste',
    pro: 'OTIS Maintenance',
    proInit: 'OT',
    building: 'Résidence Le Méridien',
    batiment: 'Bâtiment principal',
    etage: 'Cage ascenseur A (RDC → R+6)',
    gardien: 'Mme Fernandes',
    gardienTel: '06 98 76 54 32',
    code: 'Digicode 4590B',
    origine: 'Gardien (Mme Fernandes) — via app',
    date: '10/06/2026',
    duration: '½ journée',
    desc: 'Dépannage ascenseur A — porte palière bloquée',
    photos: ['Porte palière bloquée', 'Voyant défaut'],
    parts: [['AD', 'Awa Diallo', 'Gestionnaire de mandats', 'on'], ['OT', 'OTIS', 'Artisan', 'on']],
    steps: [
      ['Signalement (app)', '08/06', 'done'],
      ['Dispatch gestionnaire', '08/06', 'done'],
      ['Intervention artisan', '10/06', 'now'],
      ['Validation artisan', '—', 'todo'],
    ],
    msgs: [['OTIS', "Aujourd'hui 08:30", 'Technicien sur site à 10h, pièce détachée en stock.', 'them']],
  },
  {
    id: 'm3',
    dot: 'sage',
    title: 'Plomberie — Le Méridien',
    sub: 'Atlantic Plomberie SARL',
    tags: ['Intervention', 'Validé'],
    unread: 0,
    area: 'Plomberie / chauffage',
    pro: 'Atlantic Plomberie SARL',
    proInit: 'AP',
    building: 'Résidence Le Méridien',
    batiment: 'Bâtiment principal',
    etage: 'Parking sous-sol (-1)',
    gardien: 'Mme Fernandes',
    gardienTel: '06 98 76 54 32',
    code: 'Badge parking · porte P-1',
    origine: 'Copropriétaire M. Bernard (lot 12) — via app',
    date: '03/06/2026',
    duration: '2 h',
    desc: "Réparation d'une fuite au parking sous-sol",
    photos: ['Fuite canalisation', 'Flaque au sol'],
    parts: [['ML', 'Marc Léautaud', 'Gestionnaire technique', 'on'], ['AP', 'Atlantic Plomberie', 'Artisan', '']],
    steps: [
      ['Signalement (app)', '02/06', 'done'],
      ['Dispatch gestionnaire', '02/06', 'done'],
      ['Intervention artisan', '03/06', 'done'],
      ['Validation artisan', '03/06', 'done'],
    ],
    msgs: [
      [
        'Atlantic Plomberie',
        '03/06 17:20',
        'Fuite réparée, joint remplacé. Mission validée, facture transmise.',
        'them',
      ],
      ['Vous', '04/06 09:00', 'Merci, validation confirmée et facture transmise à la comptabilité.', 'me'],
    ],
  },
  {
    id: 'm4',
    dot: 'gold',
    title: 'Électricité — Villa Montaigne',
    sub: 'ELEC92 Services',
    tags: ['Signalement', 'À dispatcher'],
    unread: 0,
    area: 'Électricité',
    pro: 'ELEC92 Services',
    proInit: 'EL',
    building: 'Villa Montaigne',
    batiment: 'Villa Montaigne',
    etage: "Hall d'entrée (RDC)",
    gardien: '—',
    gardienTel: '—',
    code: 'Interphone « Roux »',
    origine: 'Copropriétaire Mme Roux (lot 3) — via app',
    date: 'à planifier',
    duration: '—',
    desc: 'Remplacement du détecteur et de la minuterie du hall',
    photos: ['Minuterie hors service', 'Détecteur du hall'],
    parts: [['SV', 'Sophie Vidal', 'Assistante', 'on'], ['EL', 'ELEC92', 'Artisan', '']],
    steps: [
      ['Signalement (app)', '05/06', 'done'],
      ['Dispatch gestionnaire', 'En cours', 'now'],
      ['Intervention artisan', '—', 'todo'],
      ['Validation artisan', '—', 'todo'],
    ],
    msgs: [['Système', '05/06 18:40', 'Signalement reçu via l’application résident, 2 photos jointes.', 'them']],
  },
]
