'use client'

import { useToast } from '../primitives/toast'

/**
 * Handler partagé « anti-clic-mort » pour les boutons des modules vitrine pas encore
 * construits : au lieu d'un clic silencieux, affiche un toast info honnête.
 * Usage : const soon = useComingSoon(); <Button onClick={soon('Export')} />
 */
export function useComingSoon() {
  const { push } = useToast()
  return (title: string, desc = 'Funcionalidade em desenvolvimento') => () =>
    push({ kind: 'info', title, desc })
}
