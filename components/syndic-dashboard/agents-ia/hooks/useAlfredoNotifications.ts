'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

interface NotificationEvent {
  email_id: string
  from_email: string
  subject: string
  draft_status: string
  received_at: string
}

export function useAlfredoNotifications(
  syndicId: string | null,
  onNewDraft?: (event: NotificationEvent) => void,
) {
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    if (!syndicId) return

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    )

    void (async () => {
      const { count } = await supabase
        .from('syndic_emails_analysed')
        .select('*', { count: 'exact', head: true })
        .eq('syndic_id', syndicId)
        .eq('draft_status', 'pending_review')
      if (typeof count === 'number') setPendingCount(count)
    })()

    const channel = supabase
      .channel(`alfredo-drafts-${syndicId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'syndic_emails_analysed',
          filter: `syndic_id=eq.${syndicId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string
            from_email: string
            subject: string
            draft_status: string
            received_at: string
          }
          if (row.draft_status === 'pending_review') {
            setPendingCount(c => c + 1)
            onNewDraft?.({
              email_id: row.id,
              from_email: row.from_email,
              subject: row.subject,
              draft_status: row.draft_status,
              received_at: row.received_at,
            })
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'syndic_emails_analysed',
          filter: `syndic_id=eq.${syndicId}`,
        },
        (payload) => {
          const oldStatus = (payload.old as { draft_status?: string }).draft_status
          const newStatus = (payload.new as { draft_status?: string }).draft_status
          if (oldStatus === 'pending_review' && newStatus !== 'pending_review') {
            setPendingCount(c => Math.max(0, c - 1))
          }
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [syndicId, onNewDraft])

  return { pendingCount }
}
