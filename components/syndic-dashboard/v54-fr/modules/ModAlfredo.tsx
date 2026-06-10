'use client'

// Alfredo — Courriers (lot A) — port du ModAlfredo du mockup v8.

import { AgentChatPage } from '@/components/syndic-dashboard/v54/primitives/agent-chat-page'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import { COPRO_NAMES } from '../data/mock'
import { agentReply } from '../lib/agent-replies'
import { FR_LABELS, frAgentHandlers } from './ModFixy'

export default function ModAlfredo() {
  const { push } = useToast()
  return (
    <AgentChatPage
      mascot="/alfredo-avatar.png"
      name="Alfredo — Courriers"
      title="Rédaction des courriers, convocations et notifications"
      intro="Bonjour, je suis Alfredo."
      introDetail="Je rédige convocations d'AG, notifications d'ordonnance, mises en demeure et courriers aux copropriétaires."
      contextSelector={{ label: 'Copropriété', options: COPRO_NAMES }}
      suggestions={[
        "Rédige la notification de l'ordonnance (art. 64 décret)",
        'Prépare une mise en demeure pour impayé',
        "Rédige la convocation de l'AG élective",
        "Lettre d'information aux copropriétaires",
      ]}
      inputPlaceholder="Posez une question…"
      labels={FR_LABELS}
      onAsk={(q) => agentReply('Alfredo', q)}
      {...frAgentHandlers(push, 'Alfredo')}
    />
  )
}
