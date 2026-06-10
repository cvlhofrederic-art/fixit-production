'use client'

// Max — Expert juridique (lot A) — port du ModMax du mockup v8.
// NB : le mockup passe alert kind 'info', dont le CSS (« safety overrides »,
// l.3514) = fond sage-50 / bordure sage-100, identique à .alert.sage ;
// la primitive PT n'a pas de kind 'info' → mappé sur 'sage' (même rendu).

import { AgentChatPage } from '@/components/syndic-dashboard/v54/primitives/agent-chat-page'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import { COPRO_NAMES } from '../data/mock'
import { agentReply } from '../lib/agent-replies'
import { FR_LABELS, frAgentHandlers } from './ModFixy'

export default function ModMax() {
  const { push } = useToast()
  return (
    <AgentChatPage
      mascot="/max-avatar.png"
      name="Max — Expert juridique"
      title="Droit de la copropriété (loi 1965 · décret 1967) et procédures judiciaires"
      intro="Bonjour, je suis Max."
      introDetail="Posez-moi vos questions sur le mandat judiciaire, les majorités d'AG, les délais et obligations du syndic."
      alert={{ kind: 'sage', icon: 'scale', title: "Réponses fondées sur la loi du 10 juillet 1965 et le décret du 17 mars 1967 — à vérifier au regard de l'ordonnance." }}
      contextSelector={{ label: 'Copropriété', options: COPRO_NAMES }}
      suggestions={[
        'Quelle majorité pour désigner le syndic en AG ?',
        "Délai de notification de l'ordonnance aux copropriétaires ?",
        "Comment fixer mes honoraires d'auxiliaire de justice ?",
        'Durée maximale de ma mission ?',
      ]}
      inputPlaceholder="Posez une question…"
      labels={FR_LABELS}
      onAsk={(q) => agentReply('Max', q)}
      {...frAgentHandlers(push, 'Max')}
    />
  )
}
