'use client'

import { DEMO_NOMS_COPROPRIETES } from '@/components/administrateur-judiciaire/data/coproprietes'
import { Field, FieldRow } from '@/components/administrateur-judiciaire/ui/Field'

export interface ChampCoproprieteDemoProps {
  /** Nom de la copropriété sélectionnée. */
  value: string
  /** Appelé avec le nom choisi. */
  onChange: (nom: string) => void
}

/**
 * Champ « Copropriété » des panneaux de paramètres (Rapport mensuel, Rédaction de PV) : select sur les noms des
 * copropriétés de démonstration.
 */
export function ChampCoproprieteDemo({ value, onChange }: ChampCoproprieteDemoProps) {
  return (
    <FieldRow>
      <Field label="Copropriété">
        <select aria-label="Copropriété" value={value} onChange={(evenement) => onChange(evenement.target.value)}>
          {DEMO_NOMS_COPROPRIETES.map((nom) => (
            <option key={nom}>{nom}</option>
          ))}
        </select>
      </Field>
    </FieldRow>
  )
}
