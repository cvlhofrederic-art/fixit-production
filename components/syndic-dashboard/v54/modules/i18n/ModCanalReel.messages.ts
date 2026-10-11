import { defineMessages } from '@/lib/syndic/v54/i18n'

/**
 * Textes du Canal de communication en données réelles (syndic connecté) : demandes des
 * copropriétaires, échanges avec les prestataires (ordres de mission, devis, rapports, factures)
 * et canal interne du cabinet. La version de démonstration garde ModCanal.messages.ts, inchangé.
 */

type StatutDemande = 'en_attente' | 'acceptee' | 'en_cours' | 'terminee' | 'annulee'
type StatutOrdre = 'en_attente' | 'accepte' | 'refuse' | 'en_cours' | 'termine'

interface CanalReelTextes {
  rafraichir: string
  aJour: string
  aJourDesc: string
  erreurChargement: string
  erreurChargementDesc: string
  chargement: string
  vous: string
  envoyerAria: string
  messageAria: string
  statutsDemande: Record<StatutDemande, string>
  priorites: { urgente: string; normale: string; planifiee: string }
  statutsOrdre: Record<StatutOrdre, string>
  roles: Record<string, string>
  demandes: {
    label: string
    listeAria: string
    recherche: string
    rechercheAria: string
    filtresAria: string
    filtres: { toutes: string; urgentes: string; enAttente: string; confiees: string }
    aucune: string
    aucuneFiltre: string
    choisir: string
    demande: string
    recueLe: string
    valider: string
    confieeA: (nom: string) => string
    repondreA: (nom: string) => string
    partiesCommunes: string
    batiment: string
    etage: string
    lot: string
    envoye: string
    envoyeDesc: string
    erreurEnvoi: string
    details: {
      aria: string
      demande: string
      informations: string
      immeuble: string
      localisation: string
      demandeur: string
      contact: string
      dateDemande: string
      prestataire: string
      avancement: string
      etapes: { recue: string; confiee: string; enCours: string; terminee: string; annulee: string }
    }
  }
  validation: {
    titre: string
    intro: string
    prestataires: string
    compteLie: string
    sansCompte: string
    aucunPrestataire: string
    date: string
    note: string
    notePlaceholder: string
    annuler: string
    confirmer: string
    choisirErreur: string
    toasts: {
      confiee: (nom: string) => string
      confieeDesc: string
      sansNotification: string
      sansNotificationDesc: string
      sansCompte: string
      sansCompteDesc: string
      dejaTraitee: string
      dejaTraiteeDesc: string
      erreur: string
      reessayer: string
    }
  }
  pro: {
    label: string
    listeAria: string
    prestataires: string
    equipe: string
    recherche: string
    rechercheAria: string
    filtresAria: string
    filtres: { toutes: string; urgentes: string; enCours: string; enAttente: string }
    aucune: string
    aucuneFiltre: string
    choisir: string
    ordreDeMission: string
    dateSouhaitee: string
    arrivee: string
    documents: { devis: string; rapport: string; facture: string }
    ttc: string
    repondreA: (nom: string) => string
    envoye: string
    envoyeDesc: (nom: string) => string
    erreurEnvoi: string
    details: {
      aria: string
      mission: string
      informations: string
      adresse: string
      metier: string
      date: string
      arrivee: string
      prestataire: string
      avancement: string
      etapes: { envoye: string; accepte: string; demarre: string; termine: string; refuse: string }
      documents: string
      aucunDocument: string
      participants: string
      gestionnaire: string
      prestataireRole: string
      aucunOrdre: string
    }
  }
  interne: {
    label: string
    listeAria: string
    aucunMembre: string
    titre: string
    meta: (n: number) => string
    aucun: string
    placeholder: string
    envoye: string
    erreurEnvoi: string
    details: { aria: string; canal: string; texte: string }
  }
}

export const CANAL_REEL_MESSAGES = defineMessages<CanalReelTextes>({
  'pt-PT': {
    rafraichir: 'Atualizar',
    aJour: 'Canal atualizado',
    aJourDesc: 'Pedidos e conversas recarregados.',
    erreurChargement: 'Não foi possível atualizar o canal',
    erreurChargementDesc: 'Tente novamente dentro de alguns instantes.',
    chargement: 'A carregar…',
    vous: 'Você',
    envoyerAria: 'Enviar',
    messageAria: 'Mensagem',
    statutsDemande: { en_attente: 'Em espera', acceptee: 'Atribuído', en_cours: 'Em curso', terminee: 'Concluído', annulee: 'Cancelado' },
    priorites: { urgente: 'Urgente', normale: 'Normal', planifiee: 'Planeado' },
    statutsOrdre: { en_attente: 'A aguardar resposta', accepte: 'Aceite', refuse: 'Recusada', en_cours: 'Intervenção em curso', termine: 'Concluída' },
    roles: { coproprio: 'Condómino', locataire: 'Inquilino', technicien: 'Técnico' },
    demandes: {
      label: 'PEDIDOS',
      listeAria: 'Lista de pedidos dos condóminos',
      recherche: 'Pesquisar edifício, condómino…',
      rechercheAria: 'Pesquisar pedidos',
      filtresAria: 'Filtros',
      filtres: { toutes: 'Todos', urgentes: 'Urgentes', enAttente: 'Em espera', confiees: 'Atribuídos' },
      aucune: 'Nenhum pedido de condómino de momento.',
      aucuneFiltre: 'Nenhum pedido corresponde ao filtro.',
      choisir: 'Selecione um pedido.',
      demande: 'Pedido ',
      recueLe: 'recebido a ',
      valider: 'Validar missão',
      confieeA: (nom) => `Atribuída a ${nom}`,
      repondreA: (nom) => `Responder a ${nom}…`,
      partiesCommunes: 'Partes comuns',
      batiment: 'Bloco',
      etage: 'Piso',
      lot: 'Fração',
      envoye: 'Resposta enviada',
      envoyeDesc: 'Visível pelo condómino no acompanhamento do pedido.',
      erreurEnvoi: 'Falha no envio',
      details: {
        aria: 'Detalhes do pedido',
        demande: 'PEDIDO',
        informations: 'INFORMAÇÕES',
        immeuble: 'Edifício',
        localisation: 'Localização',
        demandeur: 'Solicitante',
        contact: 'Contacto',
        dateDemande: 'Data do pedido',
        prestataire: 'Profissional',
        avancement: 'PROGRESSO',
        etapes: { recue: 'Pedido recebido', confiee: 'Profissional atribuído', enCours: 'Intervenção em curso', terminee: 'Intervenção concluída', annulee: 'Pedido cancelado' },
      },
    },
    validation: {
      titre: 'Validar missão',
      intro: 'Escolha o profissional que receberá a ordem de missão.',
      prestataires: 'Profissional',
      compteLie: 'Conta Vitfix ligada',
      sansCompte: 'Sem conta Vitfix — sem notificação',
      aucunPrestataire: 'Nenhum profissional no gabinete. Adicione um no ecrã Profissionais.',
      date: 'Data da intervenção',
      note: 'Nota para o profissional',
      notePlaceholder: 'Acesso, horário, chave…',
      annuler: 'Cancelar',
      confirmer: 'Confirmar e enviar',
      choisirErreur: 'Escolha um profissional com conta Vitfix.',
      toasts: {
        confiee: (nom) => `Missão atribuída a ${nom}`,
        confieeDesc: 'Ordem de missão enviada para a mensagem Vitfix do profissional.',
        sansNotification: 'Missão criada, notificação não entregue',
        sansNotificationDesc: 'O profissional não recebeu a ordem de missão. Contacte-o diretamente.',
        sansCompte: 'Profissional sem conta Vitfix',
        sansCompteDesc: 'Não pode receber a ordem de missão.',
        dejaTraitee: 'Pedido já tratado',
        dejaTraiteeDesc: 'Este pedido já foi atribuído.',
        erreur: 'Erro ao validar a missão',
        reessayer: 'Tente novamente mais tarde',
      },
    },
    pro: {
      label: 'MISSÕES',
      listeAria: 'Conversas com profissionais',
      prestataires: 'Prestadores',
      equipe: 'Equipa',
      recherche: 'Pesquisar profissional, edifício…',
      rechercheAria: 'Pesquisar conversas',
      filtresAria: 'Filtros',
      filtres: { toutes: 'Todas', urgentes: 'Urgentes', enCours: 'Em curso', enAttente: 'Em espera' },
      aucune: 'Ainda sem conversas com profissionais. Valide um pedido para enviar uma primeira ordem de missão.',
      aucuneFiltre: 'Nenhuma conversa corresponde ao filtro.',
      choisir: 'Selecione uma conversa.',
      ordreDeMission: 'Ordem de missão',
      dateSouhaitee: 'Data pretendida: ',
      arrivee: 'Chegada: ',
      documents: { devis: 'Orçamento', rapport: 'Relatório de intervenção', facture: 'Fatura' },
      ttc: 'c/ IVA',
      repondreA: (nom) => `Responder a ${nom}…`,
      envoye: 'Mensagem enviada',
      envoyeDesc: (nom) => `Para ${nom}`,
      erreurEnvoi: 'Falha no envio',
      details: {
        aria: 'Detalhes da missão',
        mission: 'MISSÃO',
        informations: 'INFORMAÇÕES',
        adresse: 'Morada',
        metier: 'Área profissional',
        date: 'Data pretendida',
        arrivee: 'Hora de chegada',
        prestataire: 'Profissional',
        avancement: 'PROGRESSO',
        etapes: { envoye: 'Ordem enviada', accepte: 'Aceite pelo profissional', demarre: 'Intervenção iniciada', termine: 'Intervenção concluída', refuse: 'Recusada pelo profissional' },
        documents: 'DOCUMENTOS',
        aucunDocument: 'Nenhum documento recebido.',
        participants: 'PARTICIPANTES',
        gestionnaire: 'Gestor técnico',
        prestataireRole: 'Profissional',
        aucunOrdre: 'Sem ordem de missão nesta conversa.',
      },
    },
    interne: {
      label: 'EQUIPA',
      listeAria: 'Membros da equipa',
      aucunMembre: 'Nenhum membro de equipa registado.',
      titre: 'Canal interno do gabinete',
      meta: (n) => `${n} mensage${n === 1 ? 'm' : 'ns'}`,
      aucun: 'Ainda sem mensagens internas.',
      placeholder: 'Escrever à equipa…',
      envoye: 'Mensagem enviada à equipa',
      erreurEnvoi: 'Falha no envio',
      details: { aria: 'Informações do canal interno', canal: 'CANAL INTERNO', texte: 'Mensagens visíveis por todos os membros do gabinete.' },
    },
  },
  'fr-FR': {
    rafraichir: 'Rafraîchir',
    aJour: 'Canal à jour',
    aJourDesc: 'Demandes et conversations rechargées.',
    erreurChargement: 'Impossible de mettre le canal à jour',
    erreurChargementDesc: 'Réessayez dans quelques instants.',
    chargement: 'Chargement…',
    vous: 'Vous',
    envoyerAria: 'Envoyer',
    messageAria: 'Message',
    statutsDemande: { en_attente: 'En attente', acceptee: 'Confiée', en_cours: 'En cours', terminee: 'Terminée', annulee: 'Annulée' },
    priorites: { urgente: 'Urgente', normale: 'Normale', planifiee: 'Planifiée' },
    statutsOrdre: { en_attente: 'En attente de réponse', accepte: 'Acceptée', refuse: 'Refusée', en_cours: 'Intervention en cours', termine: 'Terminée' },
    roles: { coproprio: 'Copropriétaire', locataire: 'Locataire', technicien: 'Technicien' },
    demandes: {
      label: 'DEMANDES',
      listeAria: 'Liste des demandes des copropriétaires',
      recherche: 'Rechercher un immeuble, un copropriétaire…',
      rechercheAria: 'Rechercher une demande',
      filtresAria: 'Filtres',
      filtres: { toutes: 'Toutes', urgentes: 'Urgentes', enAttente: 'En attente', confiees: 'Confiées' },
      aucune: 'Aucune demande de copropriétaire pour le moment.',
      aucuneFiltre: 'Aucune demande ne correspond au filtre.',
      choisir: 'Sélectionnez une demande.',
      demande: 'Demande ',
      recueLe: 'reçue le ',
      valider: 'Valider la mission',
      confieeA: (nom) => `Confiée à ${nom}`,
      repondreA: (nom) => `Répondre à ${nom}…`,
      partiesCommunes: 'Parties communes',
      batiment: 'Bâtiment',
      etage: 'Étage',
      lot: 'Lot',
      envoye: 'Réponse envoyée',
      envoyeDesc: 'Visible par le copropriétaire dans le suivi de sa demande.',
      erreurEnvoi: "Échec de l'envoi",
      details: {
        aria: 'Détails de la demande',
        demande: 'DEMANDE',
        informations: 'INFORMATIONS',
        immeuble: 'Immeuble',
        localisation: 'Localisation',
        demandeur: 'Demandeur',
        contact: 'Contact',
        dateDemande: 'Date de la demande',
        prestataire: 'Prestataire',
        avancement: 'AVANCEMENT',
        etapes: { recue: 'Demande reçue', confiee: 'Prestataire désigné', enCours: 'Intervention en cours', terminee: 'Intervention terminée', annulee: 'Demande annulée' },
      },
    },
    validation: {
      titre: 'Valider la mission',
      intro: "Choisissez le prestataire qui recevra l'ordre de mission.",
      prestataires: 'Prestataire',
      compteLie: 'Compte Vitfix lié',
      sansCompte: 'Pas de compte Vitfix — pas de notification',
      aucunPrestataire: "Aucun prestataire dans votre cabinet. Ajoutez-en un depuis l'écran Prestataires.",
      date: "Date d'intervention",
      note: 'Note pour le prestataire',
      notePlaceholder: 'Accès, horaires, clés…',
      annuler: 'Annuler',
      confirmer: 'Confirmer et envoyer',
      choisirErreur: 'Choisissez un prestataire ayant un compte Vitfix.',
      toasts: {
        confiee: (nom) => `Mission confiée à ${nom}`,
        confieeDesc: "Ordre de mission envoyé dans la messagerie Vitfix du prestataire.",
        sansNotification: 'Mission créée, notification non délivrée',
        sansNotificationDesc: "Le prestataire n'a pas reçu l'ordre de mission. Contactez-le directement.",
        sansCompte: 'Prestataire sans compte Vitfix',
        sansCompteDesc: "Il ne peut pas recevoir l'ordre de mission.",
        dejaTraitee: 'Demande déjà traitée',
        dejaTraiteeDesc: 'Cette demande a déjà été confiée.',
        erreur: 'Erreur lors de la validation',
        reessayer: 'Veuillez réessayer plus tard',
      },
    },
    pro: {
      label: 'MISSIONS',
      listeAria: 'Conversations avec les prestataires',
      prestataires: 'Prestataires',
      equipe: 'Équipe',
      recherche: 'Rechercher un prestataire, un immeuble…',
      rechercheAria: 'Rechercher une conversation',
      filtresAria: 'Filtres',
      filtres: { toutes: 'Toutes', urgentes: 'Urgentes', enCours: 'En cours', enAttente: 'En attente' },
      aucune: "Aucun échange avec un prestataire. Validez une demande pour envoyer un premier ordre de mission.",
      aucuneFiltre: 'Aucune conversation ne correspond au filtre.',
      choisir: 'Sélectionnez une conversation.',
      ordreDeMission: 'Ordre de mission',
      dateSouhaitee: 'Date souhaitée : ',
      arrivee: 'Arrivée : ',
      documents: { devis: 'Devis', rapport: "Rapport d'intervention", facture: 'Facture' },
      ttc: 'TTC',
      repondreA: (nom) => `Répondre à ${nom}…`,
      envoye: 'Message envoyé',
      envoyeDesc: (nom) => `À ${nom}`,
      erreurEnvoi: "Échec de l'envoi",
      details: {
        aria: 'Détails de la mission',
        mission: 'MISSION',
        informations: 'INFORMATIONS',
        adresse: 'Adresse',
        metier: "Domaine d'intervention",
        date: 'Date souhaitée',
        arrivee: "Heure d'arrivée",
        prestataire: 'Prestataire',
        avancement: 'AVANCEMENT',
        etapes: { envoye: 'Ordre envoyé', accepte: 'Acceptée par le prestataire', demarre: 'Intervention démarrée', termine: 'Intervention terminée', refuse: 'Refusée par le prestataire' },
        documents: 'DOCUMENTS',
        aucunDocument: 'Aucun document reçu.',
        participants: 'PARTICIPANTS',
        gestionnaire: 'Gestionnaire technique',
        prestataireRole: 'Prestataire',
        aucunOrdre: "Pas d'ordre de mission dans cette conversation.",
      },
    },
    interne: {
      label: 'ÉQUIPE',
      listeAria: "Membres de l'équipe",
      aucunMembre: "Aucun membre d'équipe enregistré.",
      titre: 'Canal interne du cabinet',
      meta: (n) => `${n} message${n > 1 ? 's' : ''}`,
      aucun: 'Aucun message interne pour le moment.',
      placeholder: "Écrire à l'équipe…",
      envoye: "Message envoyé à l'équipe",
      erreurEnvoi: "Échec de l'envoi",
      details: { aria: 'Informations du canal interne', canal: 'CANAL INTERNE', texte: 'Messages visibles par tous les membres du cabinet.' },
    },
  },
})
