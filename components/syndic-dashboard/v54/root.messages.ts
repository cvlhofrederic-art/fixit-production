import { defineMessages } from '@/lib/syndic/v54/i18n'
import type { AgentConversation } from './primitives/agent-chat-page/AgentChatPage'

interface AgentTextes {
  name: string
  title: string
  intro: string
}

interface RacineTextes {
  agents: Record<'fixy' | 'max' | 'lea' | 'alfredo' | 'tempo', AgentTextes>
  introDemo: string
  suggestions: string[]
  conversations: AgentConversation[]
  module: string
  moduleEnCours: string
  shellFonctionnel: string
}

/** Textes de la racine du dashboard (pages agents, écran de repli). PT repris tels quels. */
export const RACINE_MESSAGES = defineMessages<RacineTextes>({
  'pt-PT': {
    agents: {
      fixy: { name: 'Fixy', title: 'Assistente IA de manutenção', intro: 'Olá! Em que posso ajudar na manutenção hoje?' },
      max: { name: 'Max Expert', title: 'Especialista técnico IA', intro: 'Pergunte-me sobre normas, técnica e diagnósticos.' },
      lea: { name: 'Léa', title: 'Assistente contabilística IA', intro: 'Vamos tratar das contas do condomínio?' },
      alfredo: { name: 'Alfredo', title: 'Agente de e-mails IA', intro: 'Eu trato da sua correspondência com os condóminos.' },
      tempo: { name: 'Tempo', title: 'Planeamento IA', intro: 'Organizo a sua agenda, prazos e calendário.' },
    },
    introDemo: 'Demo do design system v54 — as respostas IA serão ligadas na Phase 2.',
    suggestions: ['Resumir a última ata', 'Quotas em atraso este mês', 'Estado das obras em curso'],
    conversations: [
      { id: '1', title: 'Orçamento elevador', bucket: 'ontem' },
      { id: '2', title: 'Infiltração garagem -2', bucket: 'esta-semana' },
    ],
    module: 'Módulo',
    moduleEnCours: 'Conteúdo deste módulo em desenvolvimento (Phase 2).',
    shellFonctionnel: 'A coquilha (shell) e a navegação estão funcionais.',
  },
  'fr-FR': {
    agents: {
      fixy: { name: 'Fixy', title: 'Assistant IA de maintenance', intro: "Bonjour ! Comment puis-je vous aider pour la maintenance aujourd'hui ?" },
      max: { name: 'Max Expert', title: 'Expert technique et juridique IA', intro: 'Interrogez-moi sur les normes, la technique, les diagnostics et le droit de la copropriété.' },
      lea: { name: 'Léa', title: 'Assistante comptable IA', intro: 'On fait le point sur les comptes de la copropriété ?' },
      alfredo: { name: 'Alfredo', title: 'Agent e-mails IA', intro: 'Je gère votre correspondance avec les copropriétaires.' },
      tempo: { name: 'Tempo', title: 'Planification IA', intro: "J'organise votre agenda, vos échéances et votre calendrier." },
    },
    introDemo: "Démonstration du design system v54 : les réponses de l'IA seront branchées dans une prochaine phase.",
    suggestions: ['Résumer le dernier procès-verbal', 'Charges impayées ce mois-ci', 'État des travaux en cours'],
    conversations: [
      { id: '1', title: 'Devis ascenseur', bucket: 'ontem' },
      { id: '2', title: 'Infiltration parking -2', bucket: 'esta-semana' },
    ],
    module: 'Module',
    moduleEnCours: 'Contenu de ce module en cours de développement.',
    shellFonctionnel: "L'interface et la navigation sont fonctionnelles.",
  },
})
