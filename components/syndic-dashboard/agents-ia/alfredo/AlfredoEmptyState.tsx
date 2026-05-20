'use client'

import { AlfredoMascot } from './AlfredoMascot'
import { AlfredoStatusBadge } from './AlfredoStatusBadge'
import { AlfredoSuggestedPrompts } from './AlfredoSuggestedPrompts'

interface Props {
  connected: boolean
  draftsPending: number
  emailsAnalysed: number
  locale: 'fr' | 'pt'
  onPickPrompt: (prompt: string) => void
  onConnectGmail: () => void
}

export function AlfredoEmptyState({
  connected,
  draftsPending,
  emailsAnalysed,
  locale,
  onPickPrompt,
  onConnectGmail,
}: Props) {
  const labels = locale === 'pt'
    ? {
        greeting: 'Olá, sou o Alfredo !',
        intro: 'Sou o seu assistente de emails IA. Ligue a sua caixa Gmail e eu analiso, classifico e proponho rascunhos de resposta para cada email recebido.',
        connect: '🔗 Ligar Gmail',
      }
    : {
        greeting: 'Bonjour, je suis Alfredo !',
        intro: "Je suis votre assistant emails IA. Connectez votre boîte Gmail et j'analyse, classe et propose un brouillon de réponse pour chaque mail reçu.",
        connect: '🔗 Connecter Gmail',
      }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
        padding: '48px 24px',
        maxWidth: 920,
        margin: '0 auto',
      }}
    >
      <AlfredoStatusBadge
        connected={connected}
        draftsPending={draftsPending}
        emailsAnalysed={emailsAnalysed}
        locale={locale}
      />
      <AlfredoMascot size="lg" />
      <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{labels.greeting}</h2>
      <p style={{ fontSize: 15, color: 'rgba(0,0,0,0.65)', textAlign: 'center', maxWidth: 620, lineHeight: 1.5, margin: 0 }}>
        {labels.intro}
      </p>
      {!connected ? (
        <button
          type="button"
          onClick={onConnectGmail}
          style={{
            padding: '12px 24px',
            background: 'var(--sd-navy, #0d1b2e)',
            color: 'var(--sd-gold, #d4af37)',
            border: 0,
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {labels.connect}
        </button>
      ) : null}
      <div style={{ marginTop: 8, width: '100%' }}>
        <AlfredoSuggestedPrompts locale={locale} onPick={onPickPrompt} />
      </div>
    </div>
  )
}
