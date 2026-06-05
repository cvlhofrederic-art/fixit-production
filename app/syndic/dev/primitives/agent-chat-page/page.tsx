'use client'

import { useEffect, useState } from 'react'
import { ToastProvider } from '@/components/syndic-dashboard/v54/primitives/toast'
import { AgentChatPage } from '@/components/syndic-dashboard/v54/primitives/agent-chat-page'

// Mascotte placeholder (SVG inline) — le primitive prend `mascot` en src ; les
// vraies mascottes du bundle (MASCOTS base64) arriveront avec le dashboard réel.
const MASCOT =
  "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2064%2064'%3E%3Ccircle%20cx='32'%20cy='32'%20r='30'%20fill='%23C9A574'/%3E%3Ccircle%20cx='24'%20cy='28'%20r='4'%20fill='%230B1828'/%3E%3Ccircle%20cx='40'%20cy='28'%20r='4'%20fill='%230B1828'/%3E%3Cpath%20d='M22%2040%20q10%2010%2020%200'%20stroke='%230B1828'%20stroke-width='3'%20fill='none'%20stroke-linecap='round'/%3E%3C/svg%3E"

export default function AgentChatPageShowcase() {
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    setHydrated(true)
  }, [])

  return (
    <div data-hydrated={hydrated ? 'true' : undefined}>
      <p style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--v54-gold-700)', fontWeight: 600, marginBottom: 12 }}>
        Primitive · batch 8
      </p>
      <h1 style={{ fontFamily: 'var(--v54-font-serif)', fontWeight: 500, fontSize: 32, margin: 0 }}>AgentChatPage</h1>
      <p style={{ fontSize: 14, color: 'var(--v54-navy-300)', marginTop: 8, marginBottom: 24, maxWidth: 640 }}>
        Page composite agent IA : sidebar « Conversas » (recherche + buckets) + zone chat (en-tête mascotte + badge IA,
        sélecteur de contexte, accueil, suggestions, saisie). Responsive : stack ≤1100px. Réutilise Icon / Alert / Toast.
      </p>

      <div data-testid="agent-demo">
        <ToastProvider>
          <AgentChatPage
            mascot={MASCOT}
            name="Max Lavandeira"
            title="Assistente IA do condomínio · gestão corrente"
            intro="Olá! Como posso ajudar hoje?"
            introDetail="Pergunte sobre quotas, atas, fornecedores ou obras em curso — eu trato do resto."
            suggestions={[
              'Resumir a última ata da assembleia',
              'Quais quotas estão em atraso este mês?',
              'Estado das obras da fachada',
            ]}
            conversations={[
              { id: '1', title: 'Orçamento substituição elevador', bucket: 'ontem' },
              { id: '2', title: 'Reclamação infiltração garagem -2', bucket: 'esta-semana' },
              { id: '3', title: 'Ata da AG de março', bucket: 'mais-antigas' },
            ]}
            alert={{ kind: 'gold', icon: 'info', title: 'Respostas IA em desenvolvimento (Phase 2).' }}
            contextSelector={{ label: 'Condomínio', options: ['Edifício Atlântico', 'Residências do Parque', 'Quinta das Flores'] }}
            showDocsBtn
          />
        </ToastProvider>
      </div>
    </div>
  )
}
