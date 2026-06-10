'use client'

// Sélecteur de copropriété — port du CoproSelect du mockup v8.

import { COPROS, type Copro } from '../data/mock'

export interface CoproSelectProps {
  value: string
  onChange: (code: string) => void
  /** Filtre optionnel des copropriétés proposées. */
  only?: (c: Copro) => boolean
}

export default function CoproSelect({ value, onChange, only }: Readonly<CoproSelectProps>) {
  return (
    <select aria-label="Copropriété" value={value} onChange={(e) => onChange(e.target.value)} style={{ maxWidth: 320 }}>
      {COPROS.filter((c) => !only || only(c)).map((c) => (
        <option key={c.code} value={c.code}>{c.nom}</option>
      ))}
    </select>
  )
}
