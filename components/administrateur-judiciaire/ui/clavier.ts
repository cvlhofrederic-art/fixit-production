import type { KeyboardEvent } from 'react'

/** Éléments qui reçoivent le focus au clavier (fenêtres de dialogue, menu latéral). */
export const SELECTEUR_FOCUSABLES =
  'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

/** Gestionnaire clavier : Entrée ou Espace déclenchent l'action (éléments cliquables non-boutons). */
export const surActivationClavier =
  (action: () => void) =>
  (evenement: KeyboardEvent): void => {
    if (evenement.key === 'Enter' || evenement.key === ' ') {
      evenement.preventDefault()
      action()
    }
  }
