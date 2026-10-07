import { defineMessages } from '@/lib/syndic/v54/i18n'

/** Membre de l'équipe affiché dans le planning (l'identifiant sert aussi d'initiales d'avatar). */
export interface MembrePlanning {
  id: string
  name: string
  role: string
  accent: string
}

/** Jour de la semaine : code interne, abréviation, nom complet, quantième affiché. */
export interface JourPlanning {
  key: string
  short: string
  long: string
  date: string
}

/** Événement de la semaine (démonstration ou données réelles). */
export interface EvenementPlanning {
  id: string | number
  day: string
  start: string
  end: string
  label: string
  kind: string
  owner: string
}

interface PlaneamentoTextes {
  titre: string
  agendaDe: (nom: string) => string
  /** Durée d'un créneau (« 1h », « 30min » en PT). */
  creneau: (minutes: number) => string
  chapeau: (jours: number, creneau: string) => string
  chapeauMembre: (role: string, jours: number, creneaux: number) => string
  equipe: {
    toute: string
    menuAria: string
    /** Suite du nombre de membres (le nombre est rendu à part, comme en PT). */
    resume: (n: number) => string
  }
  boutons: { affichage: string; aujourdhui: string; ajouter: string }
  types: { reunion: string; visite: string; tache: string; mission: string; autre: string }
  alerteVide: { titre: (nom: string) => string; texte: string }
  liste: {
    titreMembre: (nom: string) => string
    titre: string
    vide: string
    fermerAria: string
    fermerTitre: string
  }
  evenement: {
    titre: string
    champTitre: string
    titrePlaceholder: string
    jour: string
    type: string
    types: { gold: string; sage: string; amber: string; green: string; rust: string }
    heureDebut: string
    heureFin: string
    responsable: string
    responsablePlaceholder: string
    immeuble: string
    immeublePlaceholder: string
    annuler: string
    ajouter: string
  }
  reglages: {
    titre: string
    jours: string
    joursAide: string
    horaires: string
    horairesAide: string
    heureDebut: string
    heureFin: string
    duree: string
    dureeAide: string
    durees: { 30: string; 60: string; 120: string }
    apercu: string
    /** Morceaux du texte d'aperçu, entourant les nombres (même découpage qu'en PT). */
    apercuJours: (n: number) => string
    apercuHeureDebut: string
    apercuHeureFin: string
    restaurer: string
    annuler: string
    appliquer: string
  }
  toasts: {
    toutEquipe: string
    toutEquipeDesc: string
    membreDesc: (role: string) => string
    horaireInvalide: string
    horaireInvalideDesc: string
    aucunJour: string
    aucunJourDesc: string
    affichageMisAJour: string
    affichageMisAJourDesc: (jours: number, debut: number, fin: number, creneau: string) => string
    semainePrecedente: string
    cetteSemaine: string
    semaineSuivante: string
    nouvelEvenement: string
    jourA: (jour: string, heure: string) => string
    evenementAjoute: string
  }
  team: MembrePlanning[]
  jours: JourPlanning[]
  demo: EvenementPlanning[]
}

/** Élision française devant une voyelle ou un h muet (« d'Hélène », « de Bruno »). */
const deFr = (nom: string): string => (/^[aeiouyàâéèêëîïôûüh]/i.test(nom) ? `d'${nom}` : `de ${nom}`)
const plurielFr = (n: number, mot: string): string => `${n} ${mot}${n > 1 ? 's' : ''}`

export const PLANEAMENTO_MESSAGES = defineMessages<PlaneamentoTextes>({
  'pt-PT': {
    titre: 'Planeamento',
    agendaDe: (nom) => `Agenda de ${nom}`,
    creneau: (minutes) => (minutes >= 60 ? (minutes / 60) + 'h' : minutes + 'min'),
    chapeau: (jours, creneau) => `Vista semanal · ${jours} dias visíveis · slots de ${creneau}`,
    chapeauMembre: (role, jours, creneaux) => `${role} · ${jours} dias visíveis · ${creneaux} créneaux`,
    equipe: {
      toute: 'Toda a equipa',
      menuAria: 'Selecionar membro da equipa',
      resume: () => ' membros · vista global',
    },
    boutons: { affichage: 'Visualização', aujourdhui: 'Hoje', ajouter: 'Adicionar' },
    types: { reunion: 'Reunião', visite: 'Visita', tache: 'Tarefa', mission: 'Missão Prestador', autre: 'Outro' },
    alerteVide: {
      titre: (nom) => `Sem eventos planeados para ${nom} esta semana`,
      texte: 'A agenda está vazia. Adicione um evento ou volte à vista global da equipa.',
    },
    liste: {
      titreMembre: (nom) => `Eventos de ${nom} esta semana`,
      titre: 'Eventos da semana',
      vide: 'Sem eventos esta semana com os filtros atuais.',
      fermerAria: 'Fechar marcação',
      fermerTitre: 'Fechar',
    },
    evenement: {
      titre: 'Adicionar evento',
      champTitre: 'Título',
      titrePlaceholder: 'Ex.: Reunião AG Atlântico',
      jour: 'Dia',
      type: 'Tipo',
      types: { gold: 'Reunião', sage: 'Visita', amber: 'Tarefa', green: 'Espaço comum', rust: 'Evento' },
      heureDebut: 'Hora início',
      heureFin: 'Hora fim',
      responsable: 'Responsável',
      responsablePlaceholder: 'Nome',
      immeuble: 'Edifício',
      immeublePlaceholder: 'Edifício…',
      annuler: 'Cancelar',
      ajouter: 'Adicionar',
    },
    reglages: {
      titre: 'Parâmetros de visualização',
      jours: 'Dias úteis',
      joursAide: 'Selecione os dias da semana visíveis na agenda.',
      horaires: 'Horário de trabalho',
      horairesAide: 'Intervalo horário visível na grelha semanal.',
      heureDebut: 'Hora de início',
      heureFin: 'Hora de fim',
      duree: 'Duração dos créneaux',
      dureeAide: 'Granularidade vertical da grelha.',
      durees: { 30: '30 min', 60: '1 hora', 120: '2 horas' },
      apercu: 'Pré-visualização',
      apercuJours: () => ' dias visíveis · ',
      apercuHeureDebut: 'h–',
      apercuHeureFin: 'h · slots de ',
      restaurer: 'Restaurar predefinições',
      annuler: 'Cancelar',
      appliquer: 'Aplicar',
    },
    toasts: {
      toutEquipe: 'Toda a equipa',
      toutEquipeDesc: 'A mostrar todos os eventos da equipa',
      membreDesc: (role) => `A mostrar apenas eventos de ${role}`,
      horaireInvalide: 'Horário inválido',
      horaireInvalideDesc: 'A hora de fim deve ser posterior à hora de início.',
      aucunJour: 'Sem dias úteis',
      aucunJourDesc: 'Selecione pelo menos um dia da semana.',
      affichageMisAJour: 'Visualização atualizada',
      affichageMisAJourDesc: (jours, debut, fin, creneau) => `${jours} dias · ${debut}h-${fin}h · slots de ${creneau}`,
      semainePrecedente: 'Semana anterior',
      cetteSemaine: 'Esta semana',
      semaineSuivante: 'Próxima semana',
      nouvelEvenement: 'Novo evento',
      jourA: (jour, heure) => `${jour} às ${heure}`,
      evenementAjoute: 'Evento adicionado',
    },
    team: [
      { id: 'HC', name: 'Helena Carvalho', role: 'Administrador', accent: 'gold' },
      { id: 'BT', name: 'Bruno Tavares', role: 'Gestor Técnico', accent: 'sage' },
      { id: 'DP', name: 'Diogo Pereira', role: 'Técnico', accent: 'sage' },
      { id: 'TM', name: 'Tiago Mendes', role: 'Técnico', accent: 'sage' },
      { id: 'MS', name: 'Margarida Sousa', role: 'Secretária', accent: 'sage' },
      { id: 'RA', name: 'Ricardo Almeida', role: 'Contabilista', accent: 'sage' },
      { id: 'IM', name: 'Inês Monteiro', role: 'Jurista', accent: 'amber' },
    ],
    jours: [
      { key: 'mon', short: 'Seg', long: 'Segunda', date: '19' },
      { key: 'tue', short: 'Ter', long: 'Terça', date: '20' },
      { key: 'wed', short: 'Qua', long: 'Quarta', date: '21' },
      { key: 'thu', short: 'Qui', long: 'Quinta', date: '22' },
      { key: 'fri', short: 'Sex', long: 'Sexta', date: '23' },
      { key: 'sat', short: 'Sáb', long: 'Sábado', date: '24' },
      { key: 'sun', short: 'Dom', long: 'Domingo', date: '25' },
    ],
    demo: [
      { id: 1, day: 'mon', start: '09:00', end: '10:00', label: 'Reunião AG Atlântico', kind: 'gold', owner: 'HC' },
      { id: 2, day: 'mon', start: '14:00', end: '16:00', label: 'Visita Edifício Atlântico', kind: 'sage', owner: 'BT' },
      { id: 3, day: 'tue', start: '10:00', end: '11:00', label: 'Piscina', kind: 'green', owner: 'MS' },
      { id: 4, day: 'tue', start: '15:00', end: '16:00', label: 'Salão', kind: 'gold', owner: 'MS' },
      { id: 5, day: 'wed', start: '09:00', end: '11:00', label: 'Inspeção elevador', kind: 'amber', owner: 'DP' },
      { id: 6, day: 'wed', start: '15:00', end: '16:00', label: 'Reunião condóminos', kind: 'gold', owner: 'IM' },
      { id: 7, day: 'thu', start: '08:00', end: '09:00', label: 'Visita Foz Douro', kind: 'sage', owner: 'TM' },
      { id: 8, day: 'thu', start: '11:00', end: '12:00', label: 'Fatura Q1', kind: 'amber', owner: 'RA' },
      { id: 9, day: 'fri', start: '10:00', end: '11:00', label: 'Ginásio', kind: 'green', owner: 'MS' },
      { id: 10, day: 'fri', start: '16:00', end: '18:00', label: 'Reunião AG Boavista', kind: 'gold', owner: 'HC' },
      { id: 11, day: 'sat', start: '10:00', end: '12:00', label: 'Evento condóminos', kind: 'rust', owner: 'MS' },
    ],
  },
  'fr-FR': {
    titre: 'Planning',
    agendaDe: (nom) => `Agenda ${deFr(nom)}`,
    creneau: (minutes) => (minutes >= 60 ? `${minutes / 60} h` : `${minutes} min`),
    chapeau: (jours, creneau) => `Vue hebdomadaire · ${plurielFr(jours, 'jour')} affiché${jours > 1 ? 's' : ''} · créneaux de ${creneau}`,
    chapeauMembre: (role, jours, creneaux) => `${role} · ${plurielFr(jours, 'jour')} affiché${jours > 1 ? 's' : ''} · ${creneaux} créneau${creneaux > 1 ? 'x' : ''}`,
    equipe: {
      toute: "Toute l'équipe",
      menuAria: "Sélectionner un membre de l'équipe",
      resume: (n) => ` membre${n > 1 ? 's' : ''} · vue globale`,
    },
    boutons: { affichage: 'Affichage', aujourdhui: "Aujourd'hui", ajouter: 'Ajouter' },
    types: { reunion: 'Réunion', visite: 'Visite', tache: 'Tâche', mission: 'Mission prestataire', autre: 'Autre' },
    alerteVide: {
      titre: (nom) => `Aucun événement prévu pour ${nom} cette semaine`,
      texte: "L'agenda est vide. Ajoutez un événement ou revenez à la vue globale de l'équipe.",
    },
    liste: {
      titreMembre: (nom) => `Événements ${deFr(nom)} cette semaine`,
      titre: 'Événements de la semaine',
      vide: 'Aucun événement cette semaine avec les filtres actuels.',
      fermerAria: 'Fermer le rendez-vous',
      fermerTitre: 'Fermer',
    },
    evenement: {
      titre: 'Ajouter un événement',
      champTitre: 'Titre',
      titrePlaceholder: 'Ex. : AG Résidence Atlantique',
      jour: 'Jour',
      type: 'Type',
      types: { gold: 'Réunion', sage: 'Visite', amber: 'Tâche', green: 'Espace commun', rust: 'Événement' },
      heureDebut: 'Heure de début',
      heureFin: 'Heure de fin',
      responsable: 'Responsable',
      responsablePlaceholder: 'Nom',
      immeuble: 'Immeuble',
      immeublePlaceholder: 'Immeuble…',
      annuler: 'Annuler',
      ajouter: 'Ajouter',
    },
    reglages: {
      titre: "Paramètres d'affichage",
      jours: 'Jours ouvrés',
      joursAide: "Sélectionnez les jours de la semaine affichés dans l'agenda.",
      horaires: 'Horaires de travail',
      horairesAide: 'Plage horaire affichée dans la grille hebdomadaire.',
      heureDebut: 'Heure de début',
      heureFin: 'Heure de fin',
      duree: 'Durée des créneaux',
      dureeAide: 'Découpage vertical de la grille.',
      durees: { 30: '30 minutes', 60: '1 heure', 120: '2 heures' },
      apercu: 'Aperçu',
      apercuJours: (n) => ` jour${n > 1 ? 's' : ''} affiché${n > 1 ? 's' : ''} · `,
      apercuHeureDebut: ' h – ',
      apercuHeureFin: ' h · créneaux de ',
      restaurer: 'Rétablir les valeurs par défaut',
      annuler: 'Annuler',
      appliquer: 'Appliquer',
    },
    toasts: {
      toutEquipe: "Toute l'équipe",
      toutEquipeDesc: "Affichage de tous les événements de l'équipe",
      membreDesc: (role) => `Seuls les événements du profil « ${role} » sont affichés`,
      horaireInvalide: 'Horaires invalides',
      horaireInvalideDesc: "L'heure de fin doit être postérieure à l'heure de début.",
      aucunJour: 'Aucun jour ouvré',
      aucunJourDesc: 'Sélectionnez au moins un jour de la semaine.',
      affichageMisAJour: 'Affichage mis à jour',
      affichageMisAJourDesc: (jours, debut, fin, creneau) => `${plurielFr(jours, 'jour')} · ${debut} h – ${fin} h · créneaux de ${creneau}`,
      semainePrecedente: 'Semaine précédente',
      cetteSemaine: 'Cette semaine',
      semaineSuivante: 'Semaine suivante',
      nouvelEvenement: 'Nouvel événement',
      jourA: (jour, heure) => `${jour} à ${heure}`,
      evenementAjoute: 'Événement ajouté',
    },
    team: [
      { id: 'HC', name: 'Hélène Carpentier', role: 'Administrateur', accent: 'gold' },
      { id: 'BT', name: 'Bruno Tessier', role: 'Gestionnaire technique', accent: 'sage' },
      { id: 'DP', name: 'Damien Perrin', role: 'Technicien', accent: 'sage' },
      { id: 'TM', name: 'Thomas Ménard', role: 'Technicien', accent: 'sage' },
      { id: 'MS', name: 'Marguerite Soulier', role: 'Assistante', accent: 'sage' },
      { id: 'RA', name: 'Richard Aubry', role: 'Comptable', accent: 'sage' },
      { id: 'IM', name: 'Inès Monnier', role: 'Juriste', accent: 'amber' },
    ],
    jours: [
      { key: 'mon', short: 'Lun', long: 'Lundi', date: '19' },
      { key: 'tue', short: 'Mar', long: 'Mardi', date: '20' },
      { key: 'wed', short: 'Mer', long: 'Mercredi', date: '21' },
      { key: 'thu', short: 'Jeu', long: 'Jeudi', date: '22' },
      { key: 'fri', short: 'Ven', long: 'Vendredi', date: '23' },
      { key: 'sat', short: 'Sam', long: 'Samedi', date: '24' },
      { key: 'sun', short: 'Dim', long: 'Dimanche', date: '25' },
    ],
    demo: [
      { id: 1, day: 'mon', start: '09:00', end: '10:00', label: 'AG Résidence Atlantique', kind: 'gold', owner: 'HC' },
      { id: 2, day: 'mon', start: '14:00', end: '16:00', label: 'Visite Résidence Atlantique', kind: 'sage', owner: 'BT' },
      { id: 3, day: 'tue', start: '10:00', end: '11:00', label: 'Piscine', kind: 'green', owner: 'MS' },
      { id: 4, day: 'tue', start: '15:00', end: '16:00', label: 'Salle commune', kind: 'gold', owner: 'MS' },
      { id: 5, day: 'wed', start: '09:00', end: '11:00', label: 'Contrôle ascenseur', kind: 'amber', owner: 'DP' },
      { id: 6, day: 'wed', start: '15:00', end: '16:00', label: 'Réunion copropriétaires', kind: 'gold', owner: 'IM' },
      { id: 7, day: 'thu', start: '08:00', end: '09:00', label: 'Visite Berges du Rhône', kind: 'sage', owner: 'TM' },
      { id: 8, day: 'thu', start: '11:00', end: '12:00', label: 'Facturation T1', kind: 'amber', owner: 'RA' },
      { id: 9, day: 'fri', start: '10:00', end: '11:00', label: 'Salle de sport', kind: 'green', owner: 'MS' },
      { id: 10, day: 'fri', start: '16:00', end: '18:00', label: 'AG Bellecour Center', kind: 'gold', owner: 'HC' },
      { id: 11, day: 'sat', start: '10:00', end: '12:00', label: 'Événement copropriétaires', kind: 'rust', owner: 'MS' },
    ],
  },
})
