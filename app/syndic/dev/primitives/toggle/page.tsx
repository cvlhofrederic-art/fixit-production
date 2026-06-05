'use client'

import { useState } from 'react'
import { Toggle } from '@/components/syndic-dashboard/v54/primitives/toggle'

const sectionHeader: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: 'var(--v54-gold-700)',
  fontWeight: 600,
  margin: '32px 0 16px',
}
const row: React.CSSProperties = { display: 'flex', gap: 10, alignItems: 'center', fontSize: 13, color: 'var(--v54-navy-500)' }
const noop = () => {}

export default function ToggleShowcasePage() {
  const [a, setA] = useState(true)
  const [b, setB] = useState(false)

  return (
    <div>
      <p style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--v54-gold-700)', fontWeight: 600, marginBottom: 12 }}>
        Primitive · batch 3
      </p>
      <h1 style={{ fontFamily: 'var(--v54-font-serif)', fontWeight: 500, fontSize: 32, margin: 0 }}>Toggle</h1>
      <p style={{ fontSize: 14, color: 'var(--v54-navy-300)', marginTop: 8, maxWidth: 640 }}>
        Interrupteur on/off (track 38×22, navy-100 → sage-500). Checkbox natif caché pour l'accessibilité clavier.
      </p>

      <h2 style={sectionHeader}>Interactif</h2>
      <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
        <div style={row}>
          <Toggle on={a} onToggle={() => setA((v) => !v)} aria-label="Option A" />
          <span>A · {a ? 'on' : 'off'}</span>
        </div>
        <div style={row}>
          <Toggle on={b} onToggle={() => setB((v) => !v)} aria-label="Option B" />
          <span>B · {b ? 'on' : 'off'}</span>
        </div>
      </div>

      <h2 style={sectionHeader}>États (computed)</h2>
      <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
        <div style={row}>
          <span data-testid="tg-on"><Toggle on onToggle={noop} aria-label="actif" /></span>
          <span>on</span>
        </div>
        <div style={row}>
          <span data-testid="tg-off"><Toggle on={false} onToggle={noop} aria-label="inactif" /></span>
          <span>off</span>
        </div>
        <div style={row}>
          <span data-testid="tg-disabled"><Toggle on disabled onToggle={noop} aria-label="verrouillé" /></span>
          <span>disabled</span>
        </div>
      </div>
    </div>
  )
}
