'use client'

// Diagramme donut SVG — port du Donut du mockup v8 (absent des primitives PT).
// Variables CSS préfixées --v54-* (tokens scopés #syndic-dashboard-v54).

import type { ReactNode } from 'react'

export interface DonutProps {
  pct?: number
  kind?: 'gold' | 'sage' | 'rust' | 'amber' | 'navy'
  label?: ReactNode
  size?: number
  stroke?: number
}

const COLOR: Record<NonNullable<DonutProps['kind']>, string> = {
  gold: 'var(--v54-gold-500)',
  sage: 'var(--v54-sage-500)',
  rust: 'var(--v54-rust-500)',
  amber: 'var(--v54-amber-500)',
  navy: 'var(--v54-navy-600)',
}

export default function Donut({ pct = 0, kind = 'gold', label, size = 140, stroke = 14 }: Readonly<DonutProps>) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const off = c - (pct / 100) * c
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--v54-cream)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={COLOR[kind]}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={off}
          strokeLinecap="round"
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: 'var(--v54-font-serif)', fontSize: 30, lineHeight: 1 }}>
          {Math.round(pct)}
          <span style={{ fontSize: 16, color: 'var(--v54-navy-300)' }}>%</span>
        </div>
        {label && <div style={{ fontSize: 10.5, color: 'var(--v54-navy-300)', marginTop: 2, textAlign: 'center' }}>{label}</div>}
      </div>
    </div>
  )
}
