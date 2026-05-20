import { useCallback, useEffect, useState } from 'react'

export interface AlfredoStatus {
  connected: boolean
  email_compte: string | null
  drafts_pending: number
  emails_analysed: number
}

const DISCONNECTED_FALLBACK: AlfredoStatus = {
  connected: false,
  email_compte: null,
  drafts_pending: 0,
  emails_analysed: 0,
}

export function useAlfredoStatus() {
  const [status, setStatus] = useState<AlfredoStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    try {
      const res = await fetch('/api/email-agent/status', { signal })
      if (!res.ok) {
        setStatus(DISCONNECTED_FALLBACK)
        setError(`status_${res.status}`)
        return
      }
      const json = (await res.json()) as AlfredoStatus
      setStatus(json)
      setError(null)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return
      }
      setError(err instanceof Error ? err.message : 'unknown')
      setStatus(DISCONNECTED_FALLBACK)
    } finally {
      if (!signal?.aborted) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    const ctrl = new AbortController()
    refetch(ctrl.signal)
    return () => ctrl.abort()
  }, [refetch])

  return { status, loading, error, refetch }
}
