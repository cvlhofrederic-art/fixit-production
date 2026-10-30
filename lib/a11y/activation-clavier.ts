/**
 * Activation au clavier d'un élément cliquable qui n'est pas un bouton natif (div avec role="button") :
 * Entrée ou Espace déclenchent la même action que le clic (accessibilité, règle SonarCloud S1082).
 */
import type { KeyboardEvent } from 'react'

export function surActivationClavier(action: () => void) {
  return (e: KeyboardEvent<HTMLElement>): void => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    // Espace ferait défiler la page : l'action remplace le comportement par défaut, comme pour un bouton.
    e.preventDefault()
    action()
  }
}
