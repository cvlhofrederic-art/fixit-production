import { defineMessages } from '@/lib/syndic/v54/i18n'
import type { PillKind } from '../../primitives/pill'

/** Conversation de démonstration du chatbot. */
export interface ConversaChatbot {
  condomino: string
  fracao: string
  ultima: string
  classificacao: string
  kind: PillKind
  estado: string
  estadoKind: PillKind
}

interface ChatbotTextes {
  titre: string
  chapeau: string
  onglets: { conversas: string; config: string; respostas: string; stats: string }
  alerteTitre: string
  alerteTexte: string
  kpi: { conversas: string; resolvidas: string; ocorrencias: string; taxa: string }
  taxaDemo: string
  conversasRecentes: string
  colonnes: { condomino: string; ultima: string; classificacao: string; estado: string }
  conversas: ConversaChatbot[]
  configTitre: string
  /** Réglages : libellé, valeur, teinte. */
  config: Array<[string, string, PillKind]>
}

export const CHATBOT_MESSAGES = defineMessages<ChatbotTextes>({
  'pt-PT': {
    titre: 'Chatbot WhatsApp 24/7',
    chapeau: 'Chatbot IA autónomo · Resposta automática · Classificação de pedidos · Criação de ocorrências',
    onglets: { conversas: 'Conversas', config: 'Configuração', respostas: 'Respostas automáticas', stats: 'Estatísticas' },
    alerteTitre: 'Chatbot ativo 24/7',
    alerteTexte: 'O assistente responde automaticamente, classifica os pedidos e cria ocorrências sem intervenção humana. Os casos complexos são encaminhados para o gestor.',
    kpi: { conversas: 'Conversas hoje', resolvidas: 'Resolvidas automaticamente', ocorrencias: 'Ocorrências criadas', taxa: 'Taxa de resolução auto' },
    taxaDemo: '81%',
    conversasRecentes: 'Conversas recentes',
    colonnes: { condomino: 'Condómino', ultima: 'Última mensagem', classificacao: 'Classificação', estado: 'Estado' },
    conversas: [
      { condomino: 'Ana Silva', fracao: 'Fração 2B', ultima: 'A torneira da cozinha está a pingar…', classificacao: 'Ocorrência', kind: 'rust', estado: 'Ocorrência criada', estadoKind: 'sage' },
      { condomino: 'Carlos Mendes', fracao: 'Fração 4A', ultima: 'Quando é a próxima assembleia?', classificacao: 'Informação', kind: 'sage', estado: 'Respondido auto', estadoKind: 'sage' },
      { condomino: 'Rita Oliveira', fracao: 'Fração 1C', ultima: 'Quero reservar o salão de festas', classificacao: 'Reserva', kind: 'gold', estado: 'Encaminhado', estadoKind: 'amber' },
      { condomino: 'Pedro Costa', fracao: 'Fração 5A', ultima: 'Qual o valor da minha quota?', classificacao: 'Quotas', kind: 'amber', estado: 'Respondido auto', estadoKind: 'sage' },
    ],
    configTitre: 'Configuração do chatbot',
    config: [
      ['Resposta automática 24/7', 'Ativo', 'sage'],
      ['Classificação de pedidos por IA', 'Ativo', 'sage'],
      ['Criação automática de ocorrências', 'Ativo', 'sage'],
      ['Encaminhamento para gestor humano', 'Após 3 tentativas', 'gold'],
    ],
  },
  'fr-FR': {
    titre: 'Chatbot WhatsApp 24/7',
    chapeau: "Chatbot IA autonome · Réponse automatique · Classement des demandes · Création d'incidents",
    onglets: { conversas: 'Conversations', config: 'Configuration', respostas: 'Réponses automatiques', stats: 'Statistiques' },
    alerteTitre: 'Chatbot actif 24/7',
    alerteTexte: "L'assistant répond automatiquement, classe les demandes et crée les incidents sans intervention humaine. Les cas complexes sont transmis au gestionnaire.",
    kpi: { conversas: 'Conversations du jour', resolvidas: 'Résolues automatiquement', ocorrencias: 'Incidents créés', taxa: 'Taux de résolution automatique' },
    taxaDemo: '81 %',
    conversasRecentes: 'Conversations récentes',
    colonnes: { condomino: 'Copropriétaire', ultima: 'Dernier message', classificacao: 'Catégorie', estado: 'Statut' },
    conversas: [
      { condomino: 'Anne Simon', fracao: 'Lot 2B', ultima: 'Le robinet de la cuisine goutte…', classificacao: 'Incident', kind: 'rust', estado: 'Incident créé', estadoKind: 'sage' },
      { condomino: 'Claude Mercier', fracao: 'Lot 4A', ultima: 'Quand a lieu la prochaine assemblée générale ?', classificacao: 'Information', kind: 'sage', estado: 'Réponse automatique', estadoKind: 'sage' },
      { condomino: 'Rose Olivier', fracao: 'Lot 1C', ultima: 'Je souhaite réserver la salle commune', classificacao: 'Réservation', kind: 'gold', estado: 'Transmis', estadoKind: 'amber' },
      { condomino: 'Pierre Coste', fracao: 'Lot 5A', ultima: 'Quel est le montant de mon appel de charges ?', classificacao: 'Charges', kind: 'amber', estado: 'Réponse automatique', estadoKind: 'sage' },
    ],
    configTitre: 'Configuration du chatbot',
    config: [
      ['Réponse automatique 24/7', 'Actif', 'sage'],
      ['Classement des demandes par IA', 'Actif', 'sage'],
      ["Création automatique d'incidents", 'Actif', 'sage'],
      ['Transfert vers un gestionnaire', 'Après 3 tentatives', 'gold'],
    ],
  },
})
