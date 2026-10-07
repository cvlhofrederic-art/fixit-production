import { defineMessages } from '@/lib/syndic/v54/i18n'
import type { Reserva } from '@/lib/syndic/v54/api'

/** Statut d'une réservation (valeur technique envoyée à l'API ; le libellé dépend de la langue). */
export type EstadoReserva = Reserva['estado']

interface ReservaEspTextes {
  titre: string
  chapeau: string
  nouvelleReserva: string
  onglets: { cal: string; esp: string; reg: string; rel: string }
  /** Légende du calendrier : libellé de chaque espace (même ordre et mêmes couleurs dans les deux langues). */
  legende: { salao: string; churrasqueira: string; campo: string; piscina: string; ginasio: string; sala: string }
  /** Mots qui, dans le nom d'un espace, désignent un barbecue (icône flamme). */
  motsBarbecue: readonly string[]
  moisPrecedent: string
  moisSuivant: string
  navigationBientot: string
  /** Mois affiché par le calendrier de démonstration. */
  moisAffiche: string
  aujourdhui: string
  semaineActuelle: string
  vueSemaine: string
  bientot: string
  semaine: string
  vueMois: string
  vueActive: string
  mois: string
  /** Jours de la semaine, du lundi au dimanche. */
  jours: readonly string[]
  /** Espaces des événements du calendrier (précédés de l'heure). */
  evenements: { piscina: string; salao: string; campo: string; ginasio: string; churrasqueira: string; sala: string }
  prochaines: string
  aucuneReservation: string
  aucuneReservationDesc: string
  estados: Record<EstadoReserva, string>
  annulerReservation: string
  annulationBientot: string
  connexionSyndic: string
  annuler: string
  demo: Reserva[]
  formulaire: {
    titre: string
    espace: string
    espaceExemple: string
    reservePar: string
    reserveParPlaceholder: string
    date: string
    horaire: string
    statut: string
    notes: string
    creer: string
  }
  erreurs: { espace: string }
  toasts: {
    creee: string
    erreurCreation: string
    reessayerPlusTard: string
    creeeDemo: string
    connexionRequise: string
  }
}

export const RESERVA_ESP_MESSAGES = defineMessages<ReservaEspTextes>({
  'pt-PT': {
    titre: 'Reserva de Espaços Comuns',
    chapeau: 'Gestão de reservas, espaços e regras de utilização do condomínio',
    nouvelleReserva: '+ Nova Reserva',
    onglets: { cal: 'Calendário', esp: 'Espaços', reg: 'Regras', rel: 'Relatório' },
    legende: { salao: 'Salão de Festas', churrasqueira: 'Churrasqueira', campo: 'Campo/Polidesportivo', piscina: 'Piscina', ginasio: 'Ginásio', sala: 'Sala de Reuniões' },
    motsBarbecue: ['Churrasqueira'],
    moisPrecedent: 'Mês anterior',
    moisSuivant: 'Mês seguinte',
    navigationBientot: 'Navegação dinâmica do calendário em breve',
    moisAffiche: 'Maio 2026',
    aujourdhui: 'Hoje',
    semaineActuelle: 'A mostrar a semana atual',
    vueSemaine: 'Vista semanal',
    bientot: 'Em breve',
    semaine: 'Semana',
    vueMois: 'Vista mensal',
    vueActive: 'Vista ativa',
    mois: 'Mês',
    jours: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],
    evenements: { piscina: 'Piscina', salao: 'Salão', campo: 'Campo', ginasio: 'Ginásio', churrasqueira: 'Churrasqueira', sala: 'Sala' },
    prochaines: 'Próximas reservas',
    aucuneReservation: 'Sem reservas',
    aucuneReservationDesc: 'Crie a primeira reserva de espaço comum do condomínio',
    estados: { confirmada: 'Confirmada', pendente: 'Pendente', cancelada: 'Cancelada' },
    annulerReservation: 'Cancelar reserva',
    annulationBientot: 'Gestão de cancelamento em breve',
    connexionSyndic: 'Conecte-se como síndico',
    annuler: 'Cancelar',
    demo: [
      { id: 'p1', espaco: 'Sala de Reuniões B1', quem: 'Rita Oliveira · Fração 2B', data: '25/05', hora: '10:00 - 13:00', estado: 'confirmada', notes: '' },
      { id: 'p2', espaco: 'Churrasqueira Cobertura', quem: 'Carlos Mendes · Fração 4B', data: '27/05', hora: '10:00 - 13:00', estado: 'pendente', notes: '' },
      { id: 'p3', espaco: 'Churrasqueira Cobertura', quem: 'Ana Silva · Fração 5A', data: '30/05', hora: '15:00 - 17:00', estado: 'confirmada', notes: '' },
      { id: 'p4', espaco: 'Sala de Reuniões B1', quem: 'Carlos Mendes · Fração 3A', data: '30/05', hora: '15:00 - 18:00', estado: 'pendente', notes: '' },
      { id: 'p5', espaco: 'Ginásio Condominial', quem: 'Pedro Costa · Fração 4A', data: '31/05', hora: '12:00 - 14:00', estado: 'confirmada', notes: '' },
      { id: 'p6', espaco: 'Salão de Festas Principal', quem: 'Rita Oliveira · Fração 4A', data: '31/05', hora: '13:00 - 15:00', estado: 'confirmada', notes: '' },
      { id: 'p7', espaco: 'Salão de Festas Principal', quem: 'Carlos Mendes · Fração 1A', data: '03/06', hora: '09:00 - 12:00', estado: 'confirmada', notes: '' },
      { id: 'p8', espaco: 'Sala de Reuniões B1', quem: 'Rita Oliveira · Fração 5A', data: '03/06', hora: '13:00 - 18:00', estado: 'pendente', notes: '' },
    ],
    formulaire: {
      titre: 'Nova reserva',
      espace: 'Espaço',
      espaceExemple: 'Ex.: Salão de Festas Principal',
      reservePar: 'Quem reserva',
      reserveParPlaceholder: 'Nome · Fração',
      date: 'Data',
      horaire: 'Horário',
      statut: 'Estado',
      notes: 'Notas',
      creer: 'Criar reserva',
    },
    erreurs: { espace: 'Indique o espaço a reservar.' },
    toasts: {
      creee: 'Reserva criada',
      erreurCreation: 'Erro ao criar',
      reessayerPlusTard: 'Tente novamente mais tarde',
      creeeDemo: 'Reserva criada (demo)',
      connexionRequise: 'Conecte-se como síndico para gravar a sério',
    },
  },
  'fr-FR': {
    titre: 'Réservation des espaces communs',
    chapeau: "Gestion des réservations, des espaces et des règles d'utilisation de la copropriété",
    nouvelleReserva: '+ Nouvelle réservation',
    onglets: { cal: 'Calendrier', esp: 'Espaces', reg: 'Règles', rel: 'Rapport' },
    legende: { salao: 'Salle commune', churrasqueira: 'Barbecue', campo: 'Terrain multisport', piscina: 'Piscine', ginasio: 'Salle de sport', sala: 'Salle de réunion' },
    // Le nom d'un espace saisi en portugais garde son icône dans la version française.
    motsBarbecue: ['Churrasqueira', 'Barbecue'],
    moisPrecedent: 'Mois précédent',
    moisSuivant: 'Mois suivant',
    navigationBientot: 'Navigation dans le calendrier bientôt disponible',
    moisAffiche: 'Mai 2026',
    aujourdhui: "Aujourd'hui",
    semaineActuelle: 'Affichage de la semaine en cours',
    vueSemaine: 'Vue semaine',
    bientot: 'Bientôt disponible',
    semaine: 'Semaine',
    vueMois: 'Vue mois',
    vueActive: 'Vue active',
    mois: 'Mois',
    jours: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
    evenements: { piscina: 'Piscine', salao: 'Salle commune', campo: 'Terrain', ginasio: 'Salle de sport', churrasqueira: 'Barbecue', sala: 'Salle de réunion' },
    prochaines: 'Prochaines réservations',
    aucuneReservation: 'Aucune réservation',
    aucuneReservationDesc: "Créez la première réservation d'un espace commun de la copropriété",
    estados: { confirmada: 'Confirmée', pendente: 'En attente', cancelada: 'Annulée' },
    annulerReservation: 'Annuler la réservation',
    annulationBientot: 'Gestion des annulations bientôt disponible',
    connexionSyndic: 'Connectez-vous en tant que syndic',
    annuler: 'Annuler',
    demo: [
      { id: 'p1', espaco: 'Salle de réunion B1', quem: 'Rose Olivier · Lot 2B', data: '25/05', hora: '10:00 - 13:00', estado: 'confirmada', notes: '' },
      { id: 'p2', espaco: 'Barbecue de la terrasse', quem: 'Claude Mercier · Lot 4B', data: '27/05', hora: '10:00 - 13:00', estado: 'pendente', notes: '' },
      { id: 'p3', espaco: 'Barbecue de la terrasse', quem: 'Anne Simon · Lot 5A', data: '30/05', hora: '15:00 - 17:00', estado: 'confirmada', notes: '' },
      { id: 'p4', espaco: 'Salle de réunion B1', quem: 'Claude Mercier · Lot 3A', data: '30/05', hora: '15:00 - 18:00', estado: 'pendente', notes: '' },
      { id: 'p5', espaco: 'Salle de sport de la résidence', quem: 'Pierre Coste · Lot 4A', data: '31/05', hora: '12:00 - 14:00', estado: 'confirmada', notes: '' },
      { id: 'p6', espaco: 'Salle commune principale', quem: 'Rose Olivier · Lot 4A', data: '31/05', hora: '13:00 - 15:00', estado: 'confirmada', notes: '' },
      { id: 'p7', espaco: 'Salle commune principale', quem: 'Claude Mercier · Lot 1A', data: '03/06', hora: '09:00 - 12:00', estado: 'confirmada', notes: '' },
      { id: 'p8', espaco: 'Salle de réunion B1', quem: 'Rose Olivier · Lot 5A', data: '03/06', hora: '13:00 - 18:00', estado: 'pendente', notes: '' },
    ],
    formulaire: {
      titre: 'Nouvelle réservation',
      espace: 'Espace',
      espaceExemple: 'Ex. : Salle commune principale',
      reservePar: 'Réservé par',
      reserveParPlaceholder: 'Nom · Lot',
      date: 'Date',
      horaire: 'Horaire',
      statut: 'Statut',
      notes: 'Notes',
      creer: 'Créer la réservation',
    },
    erreurs: { espace: "Indiquez l'espace à réserver." },
    toasts: {
      creee: 'Réservation créée',
      erreurCreation: 'Erreur lors de la création',
      reessayerPlusTard: 'Veuillez réessayer plus tard',
      creeeDemo: 'Réservation créée (démonstration)',
      connexionRequise: 'Connectez-vous en tant que syndic pour enregistrer réellement',
    },
  },
})
