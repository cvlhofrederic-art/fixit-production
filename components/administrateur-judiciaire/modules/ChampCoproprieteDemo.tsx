'use client'

import { DEMO_NOMS_COPROPRIETES } from '@/components/administrateur-judiciaire/data/coproprietes'
import { optionsAvecNom } from '@/components/administrateur-judiciaire/ui/copro-choisie'
import { Field, FieldRow } from '@/components/administrateur-judiciaire/ui/Field'

export interface ChampCoproprieteDemoProps {
  /** Nom de la copropriété sélectionnée. */
  value: string
  /** Appelé avec le nom choisi. */
  onChange: (nom: string) => void
}

/**
 * Champ « Copropriété » des panneaux de paramètres (Rapport mensuel, Rédaction de PV) : select sur les noms des
 * copropriétés de démonstration, complétés par la copropriété affichée si elle n'en fait pas partie (copropriété de la
 * base choisie en haut de page) : le select montre alors bien son nom, pas la première copropriété de démonstration.
 */
export function ChampCoproprieteDemo({ value, onChange }: Readonly<ChampCoproprieteDemoProps>) {
  return (
    <FieldRow>
      <Field label="Copropriété">
        <select aria-label="Copropriété" value={value} onChange={(evenement) => onChange(evenement.target.value)}>
          {optionsAvecNom(DEMO_NOMS_COPROPRIETES, value).map((nom) => (
            <option key={nom}>{nom}</option>
          ))}
        </select>
      </Field>
    </FieldRow>
  )
}
