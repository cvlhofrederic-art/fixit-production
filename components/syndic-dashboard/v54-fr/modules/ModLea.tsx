'use client'

// Léa — Comptable (lot A) — port du ModLea du mockup v8.

import { AgentChatPage } from '@/components/syndic-dashboard/v54/primitives/agent-chat-page'
import { useToast } from '@/components/syndic-dashboard/v54/primitives/toast'
import { COPRO_NAMES } from '../data/mock'
import { agentReply } from '../lib/agent-replies'
import { FR_LABELS, frAgentHandlers } from './ModFixy'

export default function ModLea() {
  const { push } = useToast()
  return (
    <AgentChatPage
      mascot="/lea-avatar.png"
      name="Léa — Comptable"
      title="Comptabilité du syndicat, compte séparé et reddition de comptes"
      intro="Bonjour, je suis Léa."
      introDetail="Je contrôle les écritures du compte bancaire séparé, prépare la reddition de comptes et détecte les anomalies."
      contextSelector={{ label: 'Copropriété', options: COPRO_NAMES }}
      showDocsBtn
      suggestions={[
        'Quelles anomalies as-tu détectées ce mois-ci ?',
        'Prépare la reddition de comptes des Tilleuls',
        'État du fonds de travaux par copropriété',
        'Rapproche les appels de fonds et les encaissements',
      ]}
      inputPlaceholder="Posez une question…"
      labels={FR_LABELS}
      onAsk={(q) => agentReply('Léa', q)}
      {...frAgentHandlers(push, 'Léa')}
    />
  )
}
