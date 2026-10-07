import { defineMessages } from '@/lib/syndic/v54/i18n'
import type { AgentChatPageLabels } from './AgentChatPage'

interface AgentChatPageDefauts {
  labels: AgentChatPageLabels
  placeholder: string
  envoyee: (agent: string) => string
  envoyeeDetail: string
  nouvelleConversation: string
  conversationDemarree: (agent: string) => string
  documents: string
  documentsDetail: string
  conversationChargee: string
}

/**
 * Textes par défaut d'AgentChatPage. Le PT est celui du bundle, repris tel quel.
 * Sans fournisseur de langue (syndic judiciaire v54-fr, tests), c'est le PT qui
 * s'applique ; les libellés passés en props l'emportent toujours.
 */
export const AGENT_CHAT_PAGE_MESSAGES = defineMessages<AgentChatPageDefauts>({
  'pt-PT': {
    labels: {
      asideAria: 'Histórico de conversas',
      heading: 'CONVERSAS',
      hidePanel: 'Esconder painel',
      newConversation: '+ Nova conversa',
      searchPlaceholder: 'Procurar conversas…',
      searchAria: 'Procurar conversas',
      empty: 'Nenhuma conversa ainda. Inicie a primeira para começar.',
      bucketLabels: { ontem: 'ONTEM', 'esta-semana': 'ESTA SEMANA', 'mais-antigas': 'MAIS ANTIGAS' },
      docsButton: 'Documentos',
      send: 'Enviar',
      typing: 'A escrever…',
      inputAria: (name) => `Pergunta a ${name}`,
      errorReply: 'Desculpe, ocorreu um erro ao contactar o assistente. Tente novamente.',
    },
    placeholder: 'Faça uma pergunta…',
    envoyee: (agent) => `Pergunta enviada a ${agent}`,
    envoyeeDetail: 'Em breve a resposta IA (em desenvolvimento)',
    nouvelleConversation: 'Nova conversa',
    conversationDemarree: (agent) => `Conversa iniciada com ${agent}`,
    documents: 'Documentos do condomínio',
    documentsDetail: 'Painel de documentos em preparação',
    conversationChargee: 'Conversa carregada',
  },
  'fr-FR': {
    labels: {
      asideAria: 'Historique des conversations',
      heading: 'CONVERSATIONS',
      hidePanel: 'Masquer le panneau',
      newConversation: '+ Nouvelle conversation',
      searchPlaceholder: 'Rechercher une conversation…',
      searchAria: 'Rechercher une conversation',
      empty: 'Aucune conversation pour le moment. Lancez la première pour commencer.',
      bucketLabels: { ontem: 'HIER', 'esta-semana': 'CETTE SEMAINE', 'mais-antigas': 'PLUS ANCIENNES' },
      docsButton: 'Documents',
      send: 'Envoyer',
      typing: 'Rédaction en cours…',
      inputAria: (name) => `Question pour ${name}`,
      errorReply: "Désolé, une erreur s'est produite en contactant l'assistant. Veuillez réessayer.",
    },
    placeholder: 'Posez une question…',
    envoyee: (agent) => `Question envoyée à ${agent}`,
    envoyeeDetail: "La réponse de l'IA arrive bientôt (en cours de développement)",
    nouvelleConversation: 'Nouvelle conversation',
    conversationDemarree: (agent) => `Conversation démarrée avec ${agent}`,
    documents: 'Documents de la copropriété',
    documentsDetail: 'Panneau des documents en préparation',
    conversationChargee: 'Conversation chargée',
  },
})
