'use client'

// Carte d'information à bordure colorée — port de l'InfoCard du mockup v8
// (grilles de cartes RGPD / accessibilité / sécurité incendie / assurances…).

import type { ReactNode } from 'react'

export interface InfoCardProps {
  t: ReactNode
  s: ReactNode
  /** Teinte d'accent (familles de tokens --v54-{c}-50 / --v54-{c}-500 ; navy n'a pas de -50). */
  c: 'gold' | 'sage' | 'rust' | 'amber'
}

export default function InfoCard({ t, s, c }: Readonly<InfoCardProps>) {
  return (
    <div
      style={{
        padding: 14,
        border: '1px solid var(--v54-line)',
        borderRadius: 10,
        background: `var(--v54-${c}-50)`,
        borderLeft: `3px solid var(--v54-${c}-500)`,
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{t}</div>
      <div style={{ fontSize: 11.5, color: 'var(--v54-navy-400)' }}>{s}</div>
    </div>
  )
}
