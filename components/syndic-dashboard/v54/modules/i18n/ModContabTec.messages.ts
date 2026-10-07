import { defineMessages } from '@/lib/syndic/v54/i18n'

/** Priorité d'une mission (codes de l'API missions). */
export type PrioriteIntervention = 'urgente' | 'normale' | 'planifiee'

/** Statut d'une mission (codes de l'API missions). */
export type StatutIntervention = 'en_attente' | 'acceptee' | 'en_cours' | 'terminee' | 'annulee'

/** Ligne de démonstration du détail des interventions (priorité et statut en codes). */
export interface InterventionDemo {
  date: string
  immeuble: string
  type: string
  prestataire: string
  priorite: PrioriteIntervention
  statut: StatutIntervention
  montant: string
}

/** Ligne de démonstration du tableau « par prestataire » : nom, missions, montant, moyenne. */
export type PrestataireDemo = readonly [string, number, string, string]

interface ContabTecTextes {
  titre: string
  chapeau: string
  filtres: {
    prestataireAria: string
    prestataireTous: string
    immeubleAria: string
    immeubleTous: string
    statutAria: string
    statutTous: string
    periodeAria: string
    periodeTout: string
  }
  kpi: { interventions: string; terminees: string; enCours: string; montantTotal: string }
  parPrestataire: string
  colonnesPrestataire: { prestataire: string; missions: string; montant: string; moyenne: string }
  total: string
  aAttribuer: string
  detail: (n: number) => string
  colonnesDetail: { date: string; immeuble: string; type: string; prestataire: string; priorite: string; statut: string; montant: string }
  aucuneIntervention: string
  /** Libellés des priorités (repli sur le code brut si inconnu). */
  priorites: Record<string, string>
  /** Libellés des statuts (repli sur le code brut si inconnu). */
  statuts: Record<string, string>
  demoInterventions: InterventionDemo[]
  demoPrestataires: PrestataireDemo[]
}

export const CONTAB_TEC_MESSAGES = defineMessages<ContabTecTextes>({
  'pt-PT': {
    titre: 'Contabilidade Técnica',
    chapeau: 'Acompanhamento das intervenções por profissional, condomínio e período',
    filtres: {
      prestataireAria: 'Filtrar por profissional',
      prestataireTous: 'Todos os profissionais',
      immeubleAria: 'Filtrar por edifício',
      immeubleTous: 'Todos os edifícios',
      statutAria: 'Filtrar por estado',
      statutTous: 'Todos os estados',
      periodeAria: 'Filtrar por período',
      periodeTout: 'Todo o período',
    },
    kpi: { interventions: 'Intervenções', terminees: 'Concluídas', enCours: 'Em curso', montantTotal: 'Montante total' },
    parPrestataire: 'Por profissional',
    colonnesPrestataire: { prestataire: 'Profissional', missions: 'Missões', montant: 'Montante', moyenne: 'Méd./missão' },
    total: 'TOTAL',
    aAttribuer: 'Por atribuir',
    detail: (n) => `Detalhe das intervenções (${n})`,
    colonnesDetail: { date: 'Data', immeuble: 'Edifício', type: 'Tipo', prestataire: 'Profissional', priorite: 'Prioridade', statut: 'Estado', montant: 'Montante' },
    aucuneIntervention: 'Nenhuma intervenção registada.',
    priorites: { urgente: 'urgente', normale: 'normal', planifiee: 'planeada' },
    statuts: { en_attente: 'em espera', acceptee: 'aceite', en_cours: 'em curso', terminee: 'concluída', annulee: 'anulada' },
    demoInterventions: [
      { date: '22/05/2026', immeuble: 'Edifício Foz Douro', type: 'Canalização', prestataire: 'Bruno Tavares', priorite: 'normale', statut: 'en_attente', montant: '—' },
      { date: '20/05/2026', immeuble: 'Condomínio Boavista Center', type: 'Coordenação de obras', prestataire: 'Bruno Tavares', priorite: 'normale', statut: 'en_cours', montant: '—' },
      { date: '12/04/2026', immeuble: 'Residencial Cedofeita', type: 'Inspeção técnica', prestataire: 'Bruno Tavares', priorite: 'normale', statut: 'terminee', montant: '—' },
      { date: '18/05/2026', immeuble: 'Condomínio Boavista Center', type: 'Pequenas reparações', prestataire: 'Diogo Pereira', priorite: 'normale', statut: 'en_attente', montant: '—' },
      { date: '29/04/2026', immeuble: 'Edifício Atlântico', type: 'Manutenção corrente', prestataire: 'Diogo Pereira', priorite: 'normale', statut: 'terminee', montant: '—' },
      { date: '17/05/2026', immeuble: 'Edifício Atlântico', type: 'Pequenas reparações', prestataire: 'Diogo Pereira', priorite: 'urgente', statut: 'en_cours', montant: '—' },
      { date: '19/05/2026', immeuble: 'Edifício Atlântico', type: 'Vistoria técnica', prestataire: 'Bruno Tavares', priorite: 'normale', statut: 'en_cours', montant: '—' },
      { date: '16/05/2026', immeuble: 'Edifício Foz Douro', type: 'Pequenas reparações', prestataire: 'Tiago Mendes', priorite: 'normale', statut: 'en_cours', montant: '—' },
      { date: '—', immeuble: 'Edifício Foz Douro', type: 'Manutenção corrente', prestataire: '—', priorite: 'normale', statut: 'en_attente', montant: '—' },
      { date: '—', immeuble: 'Edifício Foz Douro', type: 'Eletricidade', prestataire: '—', priorite: 'normale', statut: 'en_attente', montant: '—' },
      { date: '—', immeuble: 'Residencial Cedofeita', type: 'Construção', prestataire: '—', priorite: 'normale', statut: 'en_attente', montant: '—' },
      { date: '21/05/2026', immeuble: 'Residencial Cedofeita', type: 'Manutenção corrente', prestataire: 'Tiago Mendes', priorite: 'normale', statut: 'en_attente', montant: '—' },
    ],
    demoPrestataires: [
      ['Bruno Tavares', 4, '0 €', '0 €'],
      ['Diogo Pereira', 3, '0 €', '0 €'],
      ['Tiago Mendes', 2, '0 €', '0 €'],
      ['Por atribuir', 3, '0 €', '0 €'],
    ],
  },
  'fr-FR': {
    titre: 'Comptabilité technique',
    chapeau: 'Suivi des interventions par prestataire, copropriété et période',
    filtres: {
      prestataireAria: 'Filtrer par prestataire',
      prestataireTous: 'Tous les prestataires',
      immeubleAria: 'Filtrer par immeuble',
      immeubleTous: 'Tous les immeubles',
      statutAria: 'Filtrer par statut',
      statutTous: 'Tous les statuts',
      periodeAria: 'Filtrer par période',
      periodeTout: 'Toute la période',
    },
    kpi: { interventions: 'Interventions', terminees: 'Terminées', enCours: 'En cours', montantTotal: 'Montant total' },
    parPrestataire: 'Par prestataire',
    colonnesPrestataire: { prestataire: 'Prestataire', missions: 'Missions', montant: 'Montant', moyenne: 'Moy./mission' },
    total: 'TOTAL',
    aAttribuer: 'À attribuer',
    detail: (n) => `Détail des interventions (${n})`,
    colonnesDetail: { date: 'Date', immeuble: 'Immeuble', type: 'Type', prestataire: 'Prestataire', priorite: 'Priorité', statut: 'Statut', montant: 'Montant' },
    aucuneIntervention: 'Aucune intervention enregistrée.',
    priorites: { urgente: 'urgente', normale: 'normale', planifiee: 'planifiée' },
    statuts: { en_attente: 'en attente', acceptee: 'acceptée', en_cours: 'en cours', terminee: 'terminée', annulee: 'annulée' },
    demoInterventions: [
      { date: '22/05/2026', immeuble: 'Résidence Les Berges du Rhône', type: 'Plomberie', prestataire: 'Bruno Tessier', priorite: 'normale', statut: 'en_attente', montant: '—' },
      { date: '20/05/2026', immeuble: 'Copropriété Bellecour Center', type: 'Suivi de chantier', prestataire: 'Bruno Tessier', priorite: 'normale', statut: 'en_cours', montant: '—' },
      { date: '12/04/2026', immeuble: 'Résidence Croix-Rousse', type: 'Contrôle technique', prestataire: 'Bruno Tessier', priorite: 'normale', statut: 'terminee', montant: '—' },
      { date: '18/05/2026', immeuble: 'Copropriété Bellecour Center', type: 'Petits travaux', prestataire: 'Damien Perrin', priorite: 'normale', statut: 'en_attente', montant: '—' },
      { date: '29/04/2026', immeuble: 'Résidence Atlantique', type: 'Entretien courant', prestataire: 'Damien Perrin', priorite: 'normale', statut: 'terminee', montant: '—' },
      { date: '17/05/2026', immeuble: 'Résidence Atlantique', type: 'Petits travaux', prestataire: 'Damien Perrin', priorite: 'urgente', statut: 'en_cours', montant: '—' },
      { date: '19/05/2026', immeuble: 'Résidence Atlantique', type: 'Visite technique', prestataire: 'Bruno Tessier', priorite: 'normale', statut: 'en_cours', montant: '—' },
      { date: '16/05/2026', immeuble: 'Résidence Les Berges du Rhône', type: 'Petits travaux', prestataire: 'Thomas Ménard', priorite: 'normale', statut: 'en_cours', montant: '—' },
      { date: '—', immeuble: 'Résidence Les Berges du Rhône', type: 'Entretien courant', prestataire: '—', priorite: 'normale', statut: 'en_attente', montant: '—' },
      { date: '—', immeuble: 'Résidence Les Berges du Rhône', type: 'Électricité', prestataire: '—', priorite: 'normale', statut: 'en_attente', montant: '—' },
      { date: '—', immeuble: 'Résidence Croix-Rousse', type: 'Gros œuvre', prestataire: '—', priorite: 'normale', statut: 'en_attente', montant: '—' },
      { date: '21/05/2026', immeuble: 'Résidence Croix-Rousse', type: 'Entretien courant', prestataire: 'Thomas Ménard', priorite: 'normale', statut: 'en_attente', montant: '—' },
    ],
    demoPrestataires: [
      ['Bruno Tessier', 4, '0 €', '0 €'],
      ['Damien Perrin', 3, '0 €', '0 €'],
      ['Thomas Ménard', 2, '0 €', '0 €'],
      ['À attribuer', 3, '0 €', '0 €'],
    ],
  },
})
