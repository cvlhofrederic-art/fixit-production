'use client'

import { useToast } from '../primitives/toast'
import { useMessages } from '@/lib/syndic/v54/i18n'
import { HOOKS_MESSAGES } from './i18n/hooks.messages'

/**
 * Handler partagé « anti-clic-mort » pour les boutons des modules vitrine pas encore
 * construits : au lieu d'un clic silencieux, affiche un toast info honnête.
 * Usage : const soon = useComingSoon(); <Button onClick={soon('Export')} />
 */
export function useComingSoon() {
  const { push } = useToast()
  const t = useMessages(HOOKS_MESSAGES)
  return (title: string, desc = t.enDeveloppement) => () =>
    push({ kind: 'info', title, desc })
}
