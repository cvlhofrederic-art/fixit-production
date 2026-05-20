import { useCallback, useEffect, useState } from 'react'

export interface AlfredoStatus {
  connected: boolean
  email_compte: string | null
  drafts_pending: number
  emails_analysed: number
}

export function useAlfredoStatus() {
  const [status, setStatus] = useState<AlfredoStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/email-agent/status')
      if (!res.ok) {
        setStatus({ connected: false, email_compte: null, drafts_pending: 0, emails_analysed: 0 })
        setError(`status_${res.status}`)
        return
      }
      const json = (await res.json()) as AlfredoStatus
      setStatus(json)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown')
      setStatus({ connected: false, email_compte: null, drafts_pending: 0, emails_analysed: 0 })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { status, loading, error, refetch }
}
