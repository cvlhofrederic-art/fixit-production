'use client'

import { useState } from 'react'
import { SegmentedControl } from '@/components/syndic-dashboard/v54/primitives/segmented-control'

const sectionHeader: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: 'var(--v54-gold-700)',
  fontWeight: 600,
  margin: '32px 0 16px',
}

const SLOTS = [
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hora' },
  { value: 120, label: '2 horas' },
] as const

export default function SegmentedControlShowcasePage() {
  const [slot, setSlot] = useState<number>(60)

  return (
    <div>
      <p style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--v54-gold-700)', fontWeight: 600, marginBottom: 12 }}>
        Primitive · batch 3
      </p>
      <h1 style={{ fontFamily: 'var(--v54-font-serif)', fontWeight: 500, fontSize: 32, margin: 0 }}>SegmentedControl</h1>
      <p style={{ fontSize: 14, color: 'var(--v54-navy-300)', marginTop: 8, maxWidth: 640 }}>
        Groupe de radios stylisés (port `.plan-slot-radio`). Radio natif visible (accent gold), navigation clavier
        par flèches, actif navy-900 / gold-400.
      </p>

      <h2 style={sectionHeader}>Durée des créneaux</h2>
      <div data-testid="seg" style={{ maxWidth: 420 }}>
        <SegmentedControl
          name="slot-minutes"
          ariaLabel="Duração dos créneaux"
          value={slot}
          onChange={setSlot}
          options={SLOTS}
        />
      </div>
      <p style={{ fontSize: 13, color: 'var(--v54-navy-500)', marginTop: 12 }}>
        Sélection : <strong>{slot} min</strong>
      </p>
    </div>
  )
}
