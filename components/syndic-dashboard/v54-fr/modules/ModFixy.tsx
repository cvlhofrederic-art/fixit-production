'use client'

// Fixy — Assistant du mandat (lot A) — port du ModFixy du mockup v8.
// Définit aussi FR_LABELS (textes UI FR d'AgentChatPage) et frAgentHandlers
// (toasts FR du mockup), importés par les autres agents du lot (Max, Léa,
// Alfredo, Tempo) pour court-circuiter les textes/toasts PT par défaut.

import {
  AgentChatPage,
  type AgentConversation,
} from '@/components/syndic-dashboard/v54/primitives/agent-chat-page'
import { useToast, type ToastApi } from '@/components/syndic-dashboard/v54/primitives/toast'
import { COPRO_NAMES } from '../data/mock'
import { agentReply } from '../lib/agent-replies'

/** Textes UI FR d'AgentChatPage — partagés par les 5 agents IA du lot A. */
export const FR_LABELS = {
  asideAria: 'Historique des conversations', heading: 'CONVERSATIONS', hidePanel: 'Masquer le panneau',
  newConversation: '+ Nouvelle conversation', searchPlaceholder: 'Rechercher une conversation…',
  searchAria: 'Rechercher une conversation', empty: 'Aucune conversation. Lancez-en une pour commencer.',
  bucketLabels: { ontem: 'HIER', 'esta-semana': 'CETTE SEMAINE', 'mais-antigas': 'PLUS ANCIENNES' },
  docsButton: 'Documents', send: 'Envoyer', typing: 'Rédaction…',
  inputAria: (n: string) => `Question à ${n}`, errorReply: 'Désolé, une erreur est survenue. Réessayez.',
} as const

/**
 * Handlers FR explicites (toasts identiques au mockup AgentChatPage v8) —
 * remplacent les toasts PT par défaut de la primitive.
 */
export const frAgentHandlers = (push: ToastApi['push'], short: string) => ({
  onNewConversation: () =>
    push({ kind: 'success', title: 'Nouvelle conversation', desc: `Conversation démarrée avec ${short}` }),
  onOpenDocs: () =>
    push({ kind: 'info', title: 'Documents de la copropriété', desc: 'Ouverture du coffre-fort documentaire' }),
  onSelectConversation: (c: AgentConversation) =>
    push({ kind: 'info', title: 'Conversation chargée', desc: c.title }),
})

export default function ModFixy() {
  const { push } = useToast()
  return (
    <AgentChatPage
      mascot="/fixy-avatar.png"
      name="Fixy — Assistant du mandat"
      title="Coordination des interventions et de la gestion courante du syndicat"
      intro="Bonjour, je suis Fixy."
      introDetail="Je vous aide à piloter les interventions, les prestataires et le suivi opérationnel de vos copropriétés sous mandat."
      contextSelector={{ label: 'Copropriété', options: COPRO_NAMES }}
      showDocsBtn
      suggestions={[
        'Quelles interventions sont en attente de validation ?',
        'Génère un ordre de service pour la fuite du 4e',
        'Quels prestataires sont référencés pour la plomberie ?',
        'Fais le point opérationnel du Clos des Vignes',
      ]}
      inputPlaceholder="Posez une question…"
      labels={FR_LABELS}
      onAsk={(q) => agentReply('Fixy', q)}
      {...frAgentHandlers(push, 'Fixy')}
    />
  )
}
