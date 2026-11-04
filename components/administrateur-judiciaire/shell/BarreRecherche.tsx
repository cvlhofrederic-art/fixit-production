'use client'

import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Icon } from '@/components/administrateur-judiciaire/ui/Icon'

/**
 * Barre de recherche du haut de page (demande de Hugo du 29/10/2026) : lanceur de la palette de commandes, présenté
 * comme un champ. C'est un bouton (comme le lanceur « Rechercher… » du menu) qui ouvre la fenêtre de la palette : il
 * ne garde aucun texte, et un lecteur d'écran l'annonce comme ouvrant une fenêtre, avec son raccourci clavier.
 */

/** Libellé du raccourci de la palette : ⌘K sur Mac et iOS, Ctrl K ailleurs (le Shell accepte les deux touches). */
export function libelleRaccourciPalette(userAgent: string): string {
  return /Mac|iPhone|iPad/i.test(userAgent) ? '⌘K' : 'Ctrl K'
}

/** Libellé du raccourci de la palette pour ce navigateur (Ctrl K hors navigateur). */
export const raccourciPaletteNavigateur = (): string =>
  libelleRaccourciPalette(typeof navigator === 'undefined' ? '' : navigator.userAgent)

/** Vrai pour une touche qui écrit un caractère (hors espace, qui active le bouton), sans modificateur de commande. */
const estToucheImprimable = (evenement: ReactKeyboardEvent): boolean =>
  evenement.key.length === 1 && evenement.key !== ' ' && !evenement.ctrlKey && !evenement.metaKey && !evenement.altKey

export interface BarreRechercheProps {
  /** Ouvre la palette avec ce texte de recherche (vide : nouvelle recherche). */
  onOuvrir: (texte: string) => void
}

export function BarreRecherche({ onOuvrir }: BarreRechercheProps) {
  const raccourci = raccourciPaletteNavigateur()

  // Une lettre tapée sur la barre ouvre la palette avec cette lettre ; ↓ l'ouvre aussi. Entrée et Espace : clic.
  const surTouche = (evenement: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (estToucheImprimable(evenement)) {
      evenement.preventDefault()
      onOuvrir(evenement.key)
    } else if (evenement.key === 'ArrowDown') {
      evenement.preventDefault()
      onOuvrir('')
    }
  }

  return (
    <button
      type="button"
      className="vfx-recherche-globale"
      aria-haspopup="dialog"
      aria-keyshortcuts="Control+K Meta+K"
      aria-label="Rechercher une copropriété, une personne, un lot, un prestataire"
      onClick={() => onOuvrir('')}
      onKeyDown={surTouche}
    >
      <Icon name="search" aria-hidden="true" />
      <span className="vfx-recherche-globale__texte" aria-hidden="true">
        Copro, personne, lot…
      </span>
      <kbd className="cmdk-kbd" aria-hidden="true">
        {raccourci}
      </kbd>
    </button>
  )
}
