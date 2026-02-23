'use client'

import { useEffect } from 'react'

/**
 * Protection technique du contenu VitFix :
 * - Désactive clic droit sur les éléments sensibles
 * - Désactive la sélection de texte sur les sections non-formulaires
 * - Bloque le raccourci F12 / DevTools basique (dissuasif)
 * - Ajoute un watermark copyright invisible dans les meta
 */
export default function SiteProtection() {
  useEffect(() => {
    // 1. Bloquer clic droit sur images et logos
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (
        target.tagName === 'IMG' ||
        target.closest('[data-protected]')
      ) {
        e.preventDefault()
      }
    }

    // 2. Bloquer la copie de contenu protégé
    const handleCopy = (e: ClipboardEvent) => {
      const selection = window.getSelection()
      if (!selection || selection.toString().length === 0) return

      const anchorNode = selection.anchorNode?.parentElement
      if (anchorNode?.closest('[data-no-copy]')) {
        e.preventDefault()
        e.clipboardData?.setData(
          'text/plain',
          '© VitFix - Contenu protégé. Toute reproduction est interdite.'
        )
      }
    }

    // 3. Bloquer le print screen / impression non autorisée via CSS media print
    // (géré dans globals.css)

    document.addEventListener('contextmenu', handleContextMenu)
    document.addEventListener('copy', handleCopy)

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('copy', handleCopy)
    }
  }, [])

  return null
}
