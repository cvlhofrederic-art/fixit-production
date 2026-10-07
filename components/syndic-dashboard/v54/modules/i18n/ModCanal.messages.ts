import { defineMessages } from '@/lib/syndic/v54/i18n'

/** Étiquette d'une mission (code interne ; le libellé dépend de la langue). */
export type TagCanal = 'urgente' | 'em-curso' | 'em-espera' | 'concluida'

/** Filtre de la liste des missions (code interne). */
export type FiltreCanal = 'todas' | 'urgente' | 'em-curso' | 'em-espera'

/** Mission de démonstration du canal (identifiants et montants identiques dans toutes les langues). */
export interface MissionCanal {
  id: string
  building: string
  area: string
  professional: string
  status: string
  priority: string
  date: string
  amount: number | null
  duration: string | null
  requester: string
  tags: TagCanal[]
  unread: number
}

interface CanalTextes {
  titre: string
  chapeau: string
  onglets: { pro: string; int: string; ped: string }
  listeAria: string
  missionsLabel: string
  sousOnglets: { prest: string; equip: string }
  recherchePlaceholder: string
  rechercheAria: string
  filtresAria: string
  filtres: Record<FiltreCanal, string>
  tags: Record<TagCanal, string>
  aucuneMission: string
  conversationAria: string
  chat: {
    mission: string
    vue: string
    ouvert: string
    envoyeA: string
    envoyeFin: string
    demarrer: string
    joindreAria: string
    joindreTitre: string
    photoAria: string
    photoTitre: string
    repondreA: (nom: string) => string
    messageAria: string
    envoyerAria: string
    aideEnvoyer: string
    aideLigne: string
  }
  boutons: {
    documents: string
    details: string
    validerMission: string
    valider: string
    demanderRevision: string
    modeles: string
  }
  details: {
    aria: string
    mission: string
    priorites: { urgente: string; normal: string }
    attenteValidation: string
    informations: string
    immeuble: string
    metier: string
    dateIntervention: string
    dureeEstimee: string
    montantHT: string
    demandeur: string
    avancement: string
    participants: string
    enLigne: string
    actionsRapides: string
    validerCloturer: string
    genererPdf: string
    demanderRevision: string
    annulerMission: string
  }
  etapes: { creee: string; attribue: string; demarree: string; attente: string; cloturee: string }
  dateCreation: string
  roles: { gestionnaireNom: string; gestionnaire: string; prestataire: string; demandeur: string }
  toasts: {
    messageEnvoye: string
    destinataire: (nom: string) => string
    vuePro: string
    vueProDesc: string
    documents: string
    documentsDesc: string
    details: string
    detailsDesc: string
    missionValidee: string
    revisionDemandee: string
    modeles: string
    modelesDesc: string
    missionCloturee: string
    rapportPdf: string
    rapportPdfDesc: string
    missionAnnulee: string
  }
  missions: MissionCanal[]
}

export const CANAL_MESSAGES = defineMessages<CanalTextes>({
  'pt-PT': {
    titre: 'Canal de Comunicações',
    chapeau: 'Mensagens com profissionais externos, equipa interna e pedidos de condóminos',
    onglets: { pro: 'Pro', int: 'Interno', ped: 'Pedidos' },
    listeAria: 'Lista de missões',
    missionsLabel: 'MISSÕES',
    sousOnglets: { prest: 'Prestadores', equip: 'Equipa' },
    recherchePlaceholder: 'Pesquisar profissional, edifício…',
    rechercheAria: 'Pesquisar missões',
    filtresAria: 'Filtros',
    filtres: { todas: 'Todas', urgente: 'Urgente', 'em-curso': 'Em curso', 'em-espera': 'Em espera' },
    tags: { urgente: 'Urgente', 'em-curso': 'Em curso', 'em-espera': 'Em espera', concluida: 'Concluída' },
    aucuneMission: 'Nenhuma missão corresponde ao filtro.',
    conversationAria: 'Conversa',
    chat: {
      mission: 'Missão ',
      vue: 'Vista: Profissional →',
      ouvert: 'Canal profissional aberto',
      envoyeA: 'A ordem de missão foi enviada para ',
      envoyeFin: '.',
      demarrer: 'Envie uma mensagem para iniciar a conversa.',
      joindreAria: 'Anexar ficheiro',
      joindreTitre: 'Anexar',
      photoAria: 'Tirar foto',
      photoTitre: 'Foto',
      repondreA: (nom) => `Responder a ${nom}…`,
      messageAria: 'Mensagem',
      envoyerAria: 'Enviar',
      aideEnvoyer: 'Enter para enviar ',
      aideLigne: ' Shift+Enter para nova linha',
    },
    boutons: {
      documents: 'Documentos',
      details: 'Detalhes',
      validerMission: 'Validar missão',
      valider: 'Validar',
      demanderRevision: 'Pedir revisão',
      modeles: 'Modelos',
    },
    details: {
      aria: 'Detalhes da missão',
      mission: 'MISSÃO',
      priorites: { urgente: 'Urgente', normal: 'Normal' },
      attenteValidation: 'Em espera de validação',
      informations: 'INFORMAÇÕES',
      immeuble: 'Edifício',
      metier: 'Área profissional',
      dateIntervention: 'Data da intervenção',
      dureeEstimee: 'Duração estimada',
      montantHT: 'Montante sem IVA',
      demandeur: 'Solicitante',
      avancement: 'PROGRESSO',
      participants: 'PARTICIPANTES',
      enLigne: 'Online',
      actionsRapides: 'AÇÕES RÁPIDAS',
      validerCloturer: 'Validar & encerrar a missão',
      genererPdf: 'Gerar relatório PDF',
      demanderRevision: 'Pedir revisão',
      annulerMission: 'Cancelar a missão',
    },
    etapes: {
      creee: 'Missão criada',
      attribue: 'Profissional atribuído',
      demarree: 'Intervenção iniciada',
      attente: 'Em espera de validação',
      cloturee: 'Missão encerrada',
    },
    dateCreation: '15 de maio de 2026',
    roles: { gestionnaireNom: 'Gestionnaire', gestionnaire: 'Gestor técnico', prestataire: 'Profissional certificado VitFix', demandeur: 'Solicitante' },
    toasts: {
      messageEnvoye: 'Mensagem enviada',
      destinataire: (nom) => `Para ${nom}`,
      vuePro: 'Vista profissional',
      vueProDesc: 'A abrir a vista do profissional',
      documents: 'Documentos',
      documentsDesc: 'Painel de documentos',
      details: 'Detalhes',
      detailsDesc: 'Detalhes técnicos da missão',
      missionValidee: 'Missão validada',
      revisionDemandee: 'Revisão solicitada',
      modeles: 'Modelos',
      modelesDesc: 'Galeria de modelos de resposta',
      missionCloturee: 'Missão encerrada',
      rapportPdf: 'Relatório PDF',
      rapportPdfDesc: 'A gerar o relatório PDF…',
      missionAnnulee: 'Missão cancelada',
    },
    missions: [
      { id: 'MSN-2026-1314', building: 'Condomínio Boavista Center', area: 'Pequenas reparações', professional: 'Diogo Pereira', status: 'em-espera', priority: 'normal', date: '18 de maio de 2026', amount: null, duration: null, requester: 'Joana Ribeiro', tags: ['em-espera'], unread: 0 },
      { id: 'MSN-2026-1308', building: 'Edifício Atlântico — Bloco A', area: 'Limpeza áreas comuns', professional: 'Diogo Pereira', status: 'concluida', priority: 'normal', date: '12 de maio de 2026', amount: 480, duration: '2h', requester: 'Joana Ribeiro', tags: ['concluida'], unread: 0 },
      { id: 'MSN-2026-1311', building: 'Edifício Atlântico — Bloco A', area: 'Fuga de água — apt 3B', professional: 'Diogo Pereira', status: 'em-curso', priority: 'urgente', date: '21 de maio de 2026', amount: 1200, duration: '4h', requester: 'Maria Costa', tags: ['urgente', 'em-curso'], unread: 2 },
      { id: 'MSN-2026-1305', building: 'Edifício Foz Douro', area: 'Inspeção elevador anual', professional: 'Tiago Mendes', status: 'em-curso', priority: 'normal', date: '22 de maio de 2026', amount: 340, duration: '1h30', requester: 'Joana Ribeiro', tags: ['em-curso'], unread: 0 },
      { id: 'MSN-2026-1299', building: 'Residencial Cedofeita — Bloco A', area: 'Pintura corredor', professional: 'Tiago Mendes', status: 'em-espera', priority: 'normal', date: '25 de maio de 2026', amount: 2800, duration: '2 dias', requester: 'Joana Ribeiro', tags: ['em-espera'], unread: 0 },
    ],
  },
  'fr-FR': {
    titre: 'Canal de communication',
    chapeau: "Messages avec les prestataires externes, l'équipe interne et les demandes des copropriétaires",
    onglets: { pro: 'Professionnels', int: 'Interne', ped: 'Demandes' },
    listeAria: 'Liste des missions',
    missionsLabel: 'MISSIONS',
    sousOnglets: { prest: 'Prestataires', equip: 'Équipe' },
    recherchePlaceholder: 'Rechercher un prestataire, un immeuble…',
    rechercheAria: 'Rechercher une mission',
    filtresAria: 'Filtres',
    filtres: { todas: 'Toutes', urgente: 'Urgentes', 'em-curso': 'En cours', 'em-espera': 'En attente' },
    tags: { urgente: 'Urgente', 'em-curso': 'En cours', 'em-espera': 'En attente', concluida: 'Terminée' },
    aucuneMission: 'Aucune mission ne correspond au filtre.',
    conversationAria: 'Conversation',
    chat: {
      mission: 'Mission ',
      vue: 'Vue : prestataire →',
      ouvert: 'Canal prestataire ouvert',
      envoyeA: "L'ordre de service a été envoyé à ",
      envoyeFin: '.',
      demarrer: 'Envoyez un message pour démarrer la conversation.',
      joindreAria: 'Joindre un fichier',
      joindreTitre: 'Joindre',
      photoAria: 'Prendre une photo',
      photoTitre: 'Photo',
      repondreA: (nom) => `Répondre à ${nom}…`,
      messageAria: 'Message',
      envoyerAria: 'Envoyer',
      aideEnvoyer: 'Entrée pour envoyer ',
      aideLigne: ' Maj+Entrée pour une nouvelle ligne',
    },
    boutons: {
      documents: 'Documents',
      details: 'Détails',
      validerMission: 'Valider la mission',
      valider: 'Valider',
      demanderRevision: 'Demander une reprise',
      modeles: 'Modèles',
    },
    details: {
      aria: 'Détails de la mission',
      mission: 'MISSION',
      priorites: { urgente: 'Urgente', normal: 'Normale' },
      attenteValidation: 'En attente de validation',
      informations: 'INFORMATIONS',
      immeuble: 'Immeuble',
      metier: 'Corps de métier',
      dateIntervention: "Date d'intervention",
      dureeEstimee: 'Durée estimée',
      montantHT: 'Montant HT',
      demandeur: 'Demandeur',
      avancement: 'AVANCEMENT',
      participants: 'PARTICIPANTS',
      enLigne: 'En ligne',
      actionsRapides: 'ACTIONS RAPIDES',
      validerCloturer: 'Valider et clôturer la mission',
      genererPdf: 'Générer le rapport PDF',
      demanderRevision: 'Demander une reprise',
      annulerMission: 'Annuler la mission',
    },
    etapes: {
      creee: 'Mission créée',
      attribue: 'Prestataire désigné',
      demarree: 'Intervention commencée',
      attente: 'En attente de validation',
      cloturee: 'Mission clôturée',
    },
    dateCreation: '15 mai 2026',
    roles: { gestionnaireNom: 'Gestionnaire', gestionnaire: 'Gestionnaire technique', prestataire: 'Prestataire certifié VitFix', demandeur: 'Demandeur' },
    toasts: {
      messageEnvoye: 'Message envoyé',
      destinataire: (nom) => `À ${nom}`,
      vuePro: 'Vue prestataire',
      vueProDesc: 'Ouverture de la vue du prestataire',
      documents: 'Documents',
      documentsDesc: 'Panneau des documents',
      details: 'Détails',
      detailsDesc: 'Détails techniques de la mission',
      missionValidee: 'Mission validée',
      revisionDemandee: 'Reprise demandée',
      modeles: 'Modèles',
      modelesDesc: 'Galerie de modèles de réponse',
      missionCloturee: 'Mission clôturée',
      rapportPdf: 'Rapport PDF',
      rapportPdfDesc: 'Génération du rapport PDF…',
      missionAnnulee: 'Mission annulée',
    },
    missions: [
      { id: 'OS-2026-1314', building: 'Copropriété Bellecour Center', area: 'Petits travaux', professional: 'Damien Perrin', status: 'em-espera', priority: 'normal', date: '18 mai 2026', amount: null, duration: null, requester: 'Jeanne Rivière', tags: ['em-espera'], unread: 0 },
      { id: 'OS-2026-1308', building: 'Résidence Atlantique — Bâtiment A', area: 'Nettoyage des parties communes', professional: 'Damien Perrin', status: 'concluida', priority: 'normal', date: '12 mai 2026', amount: 480, duration: '2 h', requester: 'Jeanne Rivière', tags: ['concluida'], unread: 0 },
      { id: 'OS-2026-1311', building: 'Résidence Atlantique — Bâtiment A', area: "Fuite d'eau — Apt 3B", professional: 'Damien Perrin', status: 'em-curso', priority: 'urgente', date: '21 mai 2026', amount: 1200, duration: '4 h', requester: 'Marie Coste', tags: ['urgente', 'em-curso'], unread: 2 },
      { id: 'OS-2026-1305', building: 'Résidence Les Berges du Rhône', area: "Entretien annuel de l'ascenseur", professional: 'Thomas Ménard', status: 'em-curso', priority: 'normal', date: '22 mai 2026', amount: 340, duration: '1 h 30', requester: 'Jeanne Rivière', tags: ['em-curso'], unread: 0 },
      { id: 'OS-2026-1299', building: 'Résidence Croix-Rousse — Bâtiment A', area: 'Peinture du couloir', professional: 'Thomas Ménard', status: 'em-espera', priority: 'normal', date: '25 mai 2026', amount: 2800, duration: '2 jours', requester: 'Jeanne Rivière', tags: ['em-espera'], unread: 0 },
    ],
  },
})
