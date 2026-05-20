'use client'

interface Props {
  connected: boolean
  draftsPending: number
  emailsAnalysed: number
  locale: 'fr' | 'pt'
}

export function AlfredoStatusBadge({ connected, draftsPending, emailsAnalysed, locale }: Props) {
  if (!connected) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          borderRadius: 999,
          background: 'rgba(220, 38, 38, 0.08)',
          color: '#991b1b',
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        <span aria-hidden>🔴</span>
        {locale === 'pt' ? 'Caixa não ligada' : 'Boîte non connectée'}
      </span>
    )
  }

  if (draftsPending === 0) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          borderRadius: 999,
          background: 'rgba(34, 197, 94, 0.10)',
          color: '#166534',
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        <span aria-hidden>🟢</span>
        {locale === 'pt'
          ? `Caixa ligada · 0 email em espera`
          : `Boîte connectée · 0 email en attente`}
      </span>
    )
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        borderRadius: 999,
        background: 'rgba(212, 175, 55, 0.16)',
        color: '#7c5d10',
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      <span aria-hidden>🟡</span>
      {locale === 'pt'
        ? `${draftsPending} rascunhos a validar · ${emailsAnalysed} emails analisados`
        : `${draftsPending} brouillons à valider · ${emailsAnalysed} emails analysés`}
    </span>
  )
}
