// components/syndic-dashboard/agents-ia/configs.ts
import type { AgentConfig } from '@/lib/syndic/agent-types'

export const AGENT_CONFIGS: Record<string, AgentConfig> = {
  fixy: {
    id: 'fixy',
    displayName: { fr: 'Fixy', pt: 'Fixy' },
    tagline: {
      fr: "Assistant d'action — secrétaire IA",
      pt: 'Assistente de ação — secretária IA',
    },
    avatarEmoji: '🤖',
    accentColor: 'gold',
    endpoint: '/api/syndic/fixy-syndic',
    streaming: false,
    voice: true,
    suggestedPrompts: {
      fr: [
        'Trouve le dossier de Madame Dupont',
        'Crée une mission pour fuite eau, appartement 3B',
        "Envoie un rappel d'AG aux copropriétaires retardataires",
      ],
      pt: [
        'Encontra o processo da Sra. Dupont',
        'Cria uma missão para fuga de água, apartamento 3B',
        'Envia lembrete de AG aos condóminos atrasados',
      ],
    },
    toolDescriptors: [
      {
        name: 'create_mission',
        label: { fr: 'Créer une mission', pt: 'Criar missão' },
        description: {
          fr: 'Ouvre une nouvelle intervention sans artisan attribué.',
          pt: 'Abre uma intervenção nova sem profissional atribuído.',
        },
        requiresConfirmation: true,
        allowedRoles: ['syndic', 'syndic_admin', 'syndic_tech', 'syndic_gestionnaire', 'syndic_secretaire'],
      },
      {
        name: 'assign_mission',
        label: { fr: 'Attribuer mission', pt: 'Atribuir missão' },
        description: {
          fr: 'Affecte un artisan à une mission existante.',
          pt: 'Atribui um profissional a uma missão existente.',
        },
        requiresConfirmation: true,
        allowedRoles: ['syndic', 'syndic_admin', 'syndic_tech', 'syndic_gestionnaire'],
      },
      {
        name: 'update_mission',
        label: { fr: 'Mettre à jour mission', pt: 'Atualizar missão' },
        description: {
          fr: "Change le statut d'une mission.",
          pt: 'Altera o estado de uma missão.',
        },
        requiresConfirmation: true,
        allowedRoles: ['syndic', 'syndic_admin', 'syndic_tech', 'syndic_gestionnaire', 'syndic_secretaire'],
      },
      {
        name: 'navigate',
        label: { fr: 'Naviguer', pt: 'Navegar' },
        description: { fr: 'Ouvre une page du dashboard.', pt: 'Abre uma página do painel.' },
        requiresConfirmation: false,
        allowedRoles: ['syndic', 'syndic_admin', 'syndic_tech', 'syndic_secretaire', 'syndic_gestionnaire', 'syndic_comptable', 'syndic_juriste'],
      },
      {
        name: 'create_alert',
        label: { fr: 'Créer une alerte', pt: 'Criar alerta' },
        description: { fr: 'Génère une alerte priorisée.', pt: 'Gera um alerta priorizado.' },
        requiresConfirmation: false,
        allowedRoles: ['syndic', 'syndic_admin', 'syndic_tech', 'syndic_secretaire', 'syndic_gestionnaire'],
      },
      {
        name: 'send_message',
        label: { fr: 'Envoyer message', pt: 'Enviar mensagem' },
        description: {
          fr: 'Envoie un message à un artisan via le canal interne.',
          pt: 'Envia uma mensagem a um profissional via canal interno.',
        },
        requiresConfirmation: true,
        allowedRoles: ['syndic', 'syndic_admin', 'syndic_tech', 'syndic_secretaire', 'syndic_gestionnaire'],
      },
      {
        name: 'create_document',
        label: { fr: 'Générer document', pt: 'Gerar documento' },
        description: {
          fr: 'Crée un document officiel (convocation, courrier, rapport).',
          pt: 'Cria um documento oficial (convocação, carta, relatório).',
        },
        requiresConfirmation: true,
        allowedRoles: ['syndic', 'syndic_admin', 'syndic_gestionnaire', 'syndic_secretaire', 'syndic_juriste'],
      },
      {
        name: 'search_dossier',
        label: { fr: 'Rechercher dossier', pt: 'Pesquisar processo' },
        description: {
          fr: 'Recherche full-text dans tous les dossiers (copros, missions, signalements).',
          pt: 'Pesquisa full-text em todos os processos.',
        },
        requiresConfirmation: false,
        allowedRoles: ['syndic', 'syndic_admin', 'syndic_tech', 'syndic_secretaire', 'syndic_gestionnaire', 'syndic_comptable', 'syndic_juriste'],
      },
      // classer_document différé Plan D — table syndic_documents non encore créée
      {
        name: 'find_email_thread',
        label: { fr: 'Trouver fil email', pt: 'Encontrar fio email' },
        description: {
          fr: "Retrouve un échange d'emails par contact ou sujet.",
          pt: 'Encontra uma troca de emails por contacto ou assunto.',
        },
        requiresConfirmation: false,
        allowedRoles: ['syndic', 'syndic_admin', 'syndic_secretaire', 'syndic_gestionnaire'],
      },
    ],
    allowedRoles: ['syndic', 'syndic_admin', 'syndic_tech', 'syndic_secretaire', 'syndic_gestionnaire', 'syndic_comptable', 'syndic_juriste'],
    crossAgentReferrals: ['max', 'lea', 'alfredo'],
  },

  max: {
    id: 'max',
    displayName: { fr: 'Max', pt: 'Max' },
    tagline: {
      fr: 'Expert-conseil juridique copropriété',
      pt: 'Consultor jurídico condomínio',
    },
    avatarEmoji: '🎓',
    accentColor: 'indigo',
    endpoint: '/api/syndic/max-ai',
    streaming: true,
    voice: true,
    suggestedPrompts: {
      fr: [
        'Comment voter une résolution travaux art. 14-2 ?',
        'Quelle majorité pour modifier le règlement de copropriété ?',
        'Rédige une mise en demeure pour charges impayées',
      ],
      pt: [
        'Como votar uma deliberação de obras Art. 14º ?',
        'Que maioria para alterar regulamento condomínio ?',
        'Redige notificação para quotas em atraso',
      ],
    },
    toolDescriptors: [
      {
        name: 'generate_pdf_doc',
        label: { fr: 'Générer document PDF', pt: 'Gerar documento PDF' },
        description: {
          fr: 'Produit un document officiel (convocation, PV, notification).',
          pt: 'Produz um documento oficial (convocação, ata, notificação).',
        },
        requiresConfirmation: true,
        allowedRoles: ['syndic', 'syndic_admin', 'syndic_gestionnaire', 'syndic_juriste', 'syndic_secretaire'],
      },
    ],
    allowedRoles: ['syndic', 'syndic_admin', 'syndic_secretaire', 'syndic_gestionnaire', 'syndic_juriste'],
    crossAgentReferrals: ['fixy', 'lea'],
  },

  lea: {
    id: 'lea',
    displayName: { fr: 'Léa', pt: 'Léa' },
    tagline: { fr: 'Comptabilité copropriété', pt: 'Contabilidade condomínio' },
    avatarEmoji: '👩‍💼',
    accentColor: 'teal',
    endpoint: '/api/syndic/lea-comptable',
    streaming: true,
    voice: true,
    suggestedPrompts: {
      fr: [
        'Calcule la répartition de charges du 2e trimestre',
        'Analyse les impayés > 3 mois',
        "Prépare l'annexe AG des comptes",
      ],
      pt: [
        'Calcula a repartição de quotas do 2º trimestre',
        'Analisa as quotas em atraso > 3 meses',
        'Prepara o anexo AG de contas',
      ],
    },
    toolDescriptors: [
      {
        name: 'generate_accounting_doc',
        label: { fr: 'Générer document comptable', pt: 'Gerar documento contabilístico' },
        description: {
          fr: "Produit modèle d'appel charges, budget, annexe AG.",
          pt: 'Produz modelo de chamada de quotas, orçamento, anexo AG.',
        },
        requiresConfirmation: true,
        allowedRoles: ['syndic', 'syndic_admin', 'syndic_gestionnaire', 'syndic_comptable'],
      },
    ],
    allowedRoles: ['syndic', 'syndic_admin', 'syndic_gestionnaire', 'syndic_comptable'],
    crossAgentReferrals: ['fixy', 'max'],
  },

  alfredo: {
    id: 'alfredo',
    displayName: { fr: 'Alfredo', pt: 'Alfredo' },
    tagline: {
      fr: 'Gestionnaire emails IA (à activer Plan C)',
      pt: 'Gestor emails IA (a ativar Plano C)',
    },
    avatarEmoji: '📧',
    accentColor: 'rose',
    endpoint: '/api/syndic/alfredo-chat',
    streaming: true,
    voice: true,
    fileUpload: { accept: '.eml,.pdf,image/*', maxSizeMB: 10 },
    suggestedPrompts: { fr: [], pt: [] },
    toolDescriptors: [],
    allowedRoles: ['syndic', 'syndic_admin', 'syndic_tech', 'syndic_secretaire', 'syndic_gestionnaire', 'syndic_comptable', 'syndic_juriste'],
    crossAgentReferrals: ['fixy', 'max', 'lea'],
  },
}
