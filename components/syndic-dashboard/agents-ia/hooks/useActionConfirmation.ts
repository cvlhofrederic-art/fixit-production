// components/syndic-dashboard/agents-ia/hooks/useActionConfirmation.ts
import { useCallback, useState } from 'react'
import type { ToolCall } from '@/lib/syndic/agent-types'

interface PendingAction {
  toolCall: ToolCall
  resolve: (confirmed: boolean) => void
}

export function useActionConfirmation() {
  const [pending, setPending] = useState<PendingAction | null>(null)

  const request = useCallback((toolCall: ToolCall): Promise<boolean> => {
    return new Promise(resolve => setPending({ toolCall, resolve }))
  }, [])

  const confirm = useCallback(() => {
    setPending(prev => {
      prev?.resolve(true)
      return null
    })
  }, [])

  const cancel = useCallback(() => {
    setPending(prev => {
      prev?.resolve(false)
      return null
    })
  }, [])

  return { pendingAction: pending?.toolCall ?? null, request, confirm, cancel }
}
