'use client'

import { useCoproprietesAffichees, type CoproprieteAffichee } from '@/lib/administrateur-judiciaire/db/hooks'
import { useSelectionDossier } from '@/lib/administrateur-judiciaire/selection'

export interface SelecteurCoproprieteProps {
  /** Code de la copropriété sélectionnée. */
  value: string
  /** Appelé avec le code choisi, après la mémorisation du choix dans le store de sélection. */
  onChange: (code: string) => void
  /** Filtre facultatif des copropriétés proposées. */
  only?: (copro: CoproprieteAffichee) => boolean
}

/**
 * Select « Copropriété » partagé par les écrans de pilotage : liste les copropriétés affichées (filtre `only`
 * facultatif) et mémorise le choix dans le store de sélection du dossier. Base vide : message d'état en rouille.
 */
export function SelecteurCopropriete({ value, onChange, only }: SelecteurCoproprieteProps) {
  const coproprietes = useCoproprietesAffichees(),
    choisirCopro = useSelectionDossier((etat) => etat.choisirCopro)
  return coproprietes.length === 0 ? (
    <span
      role="status"
      style={{
        fontSize: 12,
        color: 'var(--rust-500)',
        fontWeight: 600,
      }}
    >
      {"Aucune copropriété dans la base : créer un mandat depuis Fixy (ordonnance déposée) ou l'écran Copropriétés."}
    </span>
  ) : (
    <select
      aria-label="Copropriété"
      value={value}
      onChange={(evenement) => {
        choisirCopro(evenement.target.value)
        onChange(evenement.target.value)
      }}
      style={{
        maxWidth: 320,
      }}
    >
      {coproprietes
        .filter((copro) => !only || only(copro))
        .map((copro) => (
          <option value={copro.code} key={copro.code}>
            {copro.nom}
          </option>
        ))}
    </select>
  )
}
