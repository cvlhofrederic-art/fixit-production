import type { ReactNode } from 'react'

export interface CarteCritereProps {
  titre: ReactNode
  detail: ReactNode
  /** Teinte de la palette : « sage », « amber », « rust » ou « gold » (fond var(--x-50), liseré var(--x-500)). */
  teinte: string
}

/** Carte de critère à liseré coloré (titre + détail), partagée par plusieurs écrans de conformité. */
export function CarteCritere({ titre, detail, teinte }: CarteCritereProps) {
  return (
    <div
      style={{
        padding: 14,
        border: '1px solid var(--line)',
        borderRadius: 10,
        background: `var(--${teinte}-50)`,
        borderLeft: `3px solid var(--${teinte}-500)`,
      }}
    >
      <div
        style={{
          fontWeight: 600,
          fontSize: 13,
          marginBottom: 2,
        }}
      >
        {titre}
      </div>
      <div
        style={{
          fontSize: 11.5,
          color: 'var(--navy-400)',
        }}
      >
        {detail}
      </div>
    </div>
  )
}
