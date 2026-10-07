import { defineMessages } from '@/lib/syndic/v54/i18n'

/** Raccourcis du tableau de bord (identifiant technique ; le texte dépend de la langue). */
export type ActionRapideId = 'criar-missao' | 'gerar-relat' | 'convidar-prof' | 'agendar-insp'

/** Statut d'une mission (valeur de l'API) ; « refusee » s'affiche comme « annulee ». */
export type StatutMissionAffiche = 'en_cours' | 'acceptee' | 'terminee' | 'en_attente' | 'annulee'

/** Ligne de démonstration des missions récentes. */
export interface MissionRecenteDemo {
  initiales: string
  immeuble: string
  type: string
  prestataire: string
  quand: string
  statut: StatutMissionAffiche
}

interface DashboardTextes {
  bienvenue: string
  superAdmin: string
  chapeau: string
  pastilles: { stable: string; synchro: string; ordres: string }
  bandeau: {
    lots: string
    lotsSous: string
    missions: string
    missionsSous: string
    budget: string
    milliersEuros: string
    budgetSous: string
  }
  actionsRapides: string
  actions: Record<ActionRapideId, { titre: string; desc: string; toast: string }>
  kpi: {
    immeubles: string
    lotsAuTotal: (n: number) => string
    tendanceImmeubles: string
    prestataires: string
    certifies: (n: number) => string
    tendancePrestataires: string
    missions: string
    enAttente: (n: number) => string
    delaiMoyen: string
    alertes: string
    toutSousControle: string
    alertesDemo: string
    toutVaBien: string
  }
  budget: {
    titre: string
    sousTitre: string
    enCours: string
    exporter: string
    enDeveloppement: string
    total: string
    exercice: string
    depense: string
    consomme: string
    restant: string
    disponible: string
    finPrevue: string
    finPrevueValeur: string
    marge: string
    legende: { entretien: string; travaux: string; services: string; autres: string; disponible: string }
  }
  alertes: { titre: string; vide: string; videDesc: string }
  missionsRecentes: string
  statuts: Record<StatutMissionAffiche, string>
  recentes: MissionRecenteDemo[]
}

export const DASHBOARD_MESSAGES = defineMessages<DashboardTextes>({
  'pt-PT': {
    bienvenue: 'Bem-vindo, ',
    superAdmin: 'Super Admin',
    chapeau: 'Visão geral do portefólio VitFix — orçamentos, missões em curso e estado operacional dos seus condomínios.',
    pastilles: { stable: 'Operação estável', synchro: 'Sincronizado há 2 min', ordres: '6 ordens pendentes' },
    bandeau: {
      lots: 'Frações',
      lotsSous: 'em 4 edifícios',
      missions: 'Missões ativas',
      missionsSous: '6 pendentes',
      budget: 'Orçamento 2026',
      milliersEuros: 'k €',
      budgetSous: '55% consumido',
    },
    actionsRapides: 'Ações rápidas',
    actions: {
      'criar-missao': { titre: 'Criar missão', desc: 'Novo pedido de intervenção', toast: 'Abertura do formulário de nova missão' },
      'gerar-relat': { titre: 'Gerar relatório', desc: 'Síntese mensal de exercício', toast: 'A preparar o relatório mensal' },
      'convidar-prof': { titre: 'Convidar profissional', desc: 'Adicionar à equipa VitFix', toast: 'Envio do convite por email' },
      'agendar-insp': { titre: 'Agendar inspeção', desc: 'Visita técnica anual', toast: 'Abertura do planificador' },
    },
    kpi: {
      immeubles: 'Edifícios geridos',
      lotsAuTotal: (n) => `${n} frações no total`,
      tendanceImmeubles: '+0%',
      prestataires: 'Profissionais ativos',
      certifies: (n) => `${n} certificados VitFix`,
      tendancePrestataires: '+2 este mês',
      missions: 'Missões em curso',
      enAttente: (n) => `${n} pendentes`,
      delaiMoyen: 'Prazo médio · 3,2 dias',
      alertes: 'Alertas ativos',
      toutSousControle: 'Tudo sob controlo',
      alertesDemo: '0 urgentes · 0 hoje',
      toutVaBien: 'Tudo OK',
    },
    budget: {
      titre: 'Orçamento global — Exercício 2026',
      sousTitre: 'Repartição orçamental por categoria · atualizado há 2 horas',
      enCours: 'Em curso',
      exporter: 'Exportar',
      enDeveloppement: 'Funcionalidade em desenvolvimento',
      total: 'Orçamento total',
      exercice: 'Exercício 2026',
      depense: 'Gasto',
      consomme: '55% consumido',
      restant: 'Restante',
      disponible: 'Disponível · 45%',
      finPrevue: 'Previsão de fim',
      finPrevueValeur: 'Setembro 2026',
      marge: '▲ 2 semanas de margem',
      legende: {
        entretien: 'Manutenção · 42 000 €',
        travaux: 'Obras · 38 200 €',
        services: 'Serviços · 14 870 €',
        autres: 'Outros · 7 400 €',
        disponible: 'Disponível · 85 530 €',
      },
    },
    alertes: { titre: 'Alertas urgentes', vide: 'Nenhum alerta urgente', videDesc: 'Tudo sob controlo · operação nominal' },
    missionsRecentes: 'Missões recentes',
    statuts: { en_cours: 'Em curso', acceptee: 'Aceite', terminee: 'Concluída', en_attente: 'Pendente', annulee: 'Anulada' },
    recentes: [
      { initiales: 'FD', immeuble: 'Edifício Foz Douro', type: 'Canalização', prestataire: 'Bruno Tavares', quand: 'há 2 h', statut: 'en_attente' },
      { initiales: 'BC', immeuble: 'Condomínio Boavista Center', type: 'Coordenação de obras', prestataire: 'Bruno Tavares', quand: 'há 5 h', statut: 'en_cours' },
      { initiales: 'RC', immeuble: 'Residencial Cedofeita', type: 'Inspeção técnica', prestataire: 'Bruno Tavares', quand: 'ontem', statut: 'en_attente' },
      { initiales: 'BC', immeuble: 'Condomínio Boavista Center', type: 'Verificação fachada', prestataire: 'Ana Ribeiro', quand: 'ontem', statut: 'terminee' },
    ],
  },
  'fr-FR': {
    bienvenue: 'Bienvenue, ',
    superAdmin: 'Super Admin',
    chapeau: "Vue d'ensemble du portefeuille VitFix — budgets, missions en cours et état opérationnel de vos copropriétés.",
    pastilles: { stable: 'Fonctionnement stable', synchro: 'Synchronisé il y a 2 min', ordres: '6 ordres de service en attente' },
    bandeau: {
      lots: 'Lots',
      lotsSous: 'dans 4 immeubles',
      missions: 'Missions actives',
      missionsSous: '6 en attente',
      budget: 'Budget 2026',
      milliersEuros: 'k€',
      budgetSous: '55 % consommé',
    },
    actionsRapides: 'Actions rapides',
    actions: {
      'criar-missao': { titre: 'Créer une mission', desc: "Nouvelle demande d'intervention", toast: 'Ouverture du formulaire de nouvelle mission' },
      'gerar-relat': { titre: 'Générer un rapport', desc: "Synthèse mensuelle de l'exercice", toast: 'Préparation du rapport mensuel' },
      'convidar-prof': { titre: 'Inviter un collaborateur', desc: "Ajouter à l'équipe VitFix", toast: "Envoi de l'invitation par e-mail" },
      'agendar-insp': { titre: 'Planifier une visite', desc: 'Visite technique annuelle', toast: 'Ouverture du planificateur' },
    },
    kpi: {
      immeubles: 'Immeubles gérés',
      lotsAuTotal: (n) => `${n} lot${n > 1 ? 's' : ''} au total`,
      tendanceImmeubles: '+0 %',
      prestataires: 'Prestataires actifs',
      certifies: (n) => `${n} certifié${n > 1 ? 's' : ''} VitFix`,
      tendancePrestataires: '+2 ce mois-ci',
      missions: 'Missions en cours',
      enAttente: (n) => `${n} en attente`,
      delaiMoyen: 'Délai moyen · 3,2 jours',
      alertes: 'Alertes actives',
      toutSousControle: 'Tout est sous contrôle',
      alertesDemo: "0 urgente · 0 aujourd'hui",
      toutVaBien: 'Tout va bien',
    },
    budget: {
      titre: 'Budget prévisionnel global — Exercice 2026',
      sousTitre: 'Répartition budgétaire par catégorie · mise à jour il y a 2 heures',
      enCours: 'En cours',
      exporter: 'Exporter',
      enDeveloppement: 'Fonctionnalité en cours de développement',
      total: 'Budget total',
      exercice: 'Exercice 2026',
      depense: 'Dépensé',
      consomme: '55 % consommé',
      restant: 'Restant',
      disponible: 'Disponible · 45 %',
      finPrevue: 'Fin prévisionnelle',
      finPrevueValeur: 'Septembre 2026',
      marge: '▲ 2 semaines de marge',
      legende: {
        entretien: 'Entretien · 42 000 €',
        travaux: 'Travaux · 38 200 €',
        services: 'Services · 14 870 €',
        autres: 'Autres · 7 400 €',
        disponible: 'Disponible · 85 530 €',
      },
    },
    alertes: { titre: 'Alertes urgentes', vide: 'Aucune alerte urgente', videDesc: 'Tout est sous contrôle · fonctionnement normal' },
    missionsRecentes: 'Missions récentes',
    statuts: { en_cours: 'En cours', acceptee: 'Acceptée', terminee: 'Terminée', en_attente: 'En attente', annulee: 'Annulée' },
    recentes: [
      { initiales: 'BR', immeuble: 'Résidence Les Berges du Rhône', type: 'Plomberie', prestataire: 'Bruno Tessier', quand: 'il y a 2 h', statut: 'en_attente' },
      { initiales: 'BC', immeuble: 'Copropriété Bellecour Center', type: 'Suivi de chantier', prestataire: 'Bruno Tessier', quand: 'il y a 5 h', statut: 'en_cours' },
      { initiales: 'CR', immeuble: 'Résidence Croix-Rousse', type: 'Contrôle technique', prestataire: 'Bruno Tessier', quand: 'hier', statut: 'en_attente' },
      { initiales: 'BC', immeuble: 'Copropriété Bellecour Center', type: 'Vérification de la façade', prestataire: 'Annie Rivière', quand: 'hier', statut: 'terminee' },
    ],
  },
})
