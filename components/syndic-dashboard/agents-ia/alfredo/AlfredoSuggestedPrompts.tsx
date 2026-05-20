'use client'

const PROMPTS_FR = [
  'Résume mes emails du jour',
  'Quels emails sont urgents ?',
  'Cherche les emails de Mme Dupont',
  'Brouillon pour le sinistre du lot 12',
  'Archive tous les spams',
  'Quels emails attendent réponse ?',
  'Rédige une relance amiable',
  'Combien d’emails à traiter ?',
]

const PROMPTS_PT = [
  'Resume os meus emails de hoje',
  'Quais emails são urgentes ?',
  'Procura os emails da Sra. Costa',
  'Rascunho para o sinistro do lote 12',
  'Arquiva todo o spam',
  'Que emails aguardam resposta ?',
  'Redige um lembrete amigável',
  'Quantos emails para tratar ?',
]

interface Props {
  locale: 'fr' | 'pt'
  onPick: (prompt: string) => void
}

export function AlfredoSuggestedPrompts({ locale, onPick }: Props) {
  const prompts = locale === 'pt' ? PROMPTS_PT : PROMPTS_FR

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: 10,
        maxWidth: 720,
        margin: '0 auto',
      }}
    >
      {prompts.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onPick(p)}
          style={{
            textAlign: 'left',
            padding: '12px 16px',
            background: 'var(--sd-bg-2, #f7f4ec)',
            border: '1px solid var(--sd-border, rgba(0,0,0,0.08))',
            borderRadius: 14,
            cursor: 'pointer',
            fontSize: 14,
            color: 'var(--sd-navy, #0d1b2e)',
            lineHeight: 1.4,
          }}
        >
          {p}
        </button>
      ))}
    </div>
  )
}
