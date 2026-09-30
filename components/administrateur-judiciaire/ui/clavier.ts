import type { KeyboardEvent } from 'react'

/** Gestionnaire clavier : Entrée ou Espace déclenchent l'action (éléments cliquables non-boutons). */
export const surActivationClavier =
  (action: () => void) =>
  (evenement: KeyboardEvent): void => {
    if (evenement.key === 'Enter' || evenement.key === ' ') {
      evenement.preventDefault()
      action()
    }
  }
