import type { RealtimeChannel } from '@supabase/supabase-js'

const MAX_DELAY = 30_000
const BASE_DELAY = 1_000

export function getBackoffDelay(attempt: number): number {
  return Math.min(BASE_DELAY * Math.pow(2, attempt), MAX_DELAY)
}

/**
 * Subscribe to a Realtime channel with automatic reconnection on error.
 * Uses exponential backoff capped at 30s.
 */
export function subscribeWithReconnect(
  channel: RealtimeChannel,
  onError?: (status: string, err: unknown) => void
): RealtimeChannel {
  let retryCount = 0
  let retryTimeout: ReturnType<typeof setTimeout>

  const doSubscribe = () => {
    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        retryCount = 0
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        onError?.(status, err)
        const delay = getBackoffDelay(retryCount)
        retryCount++
        clearTimeout(retryTimeout)
        retryTimeout = setTimeout(() => {
          channel.unsubscribe().then(() => doSubscribe())
        }, delay)
      }
    })
  }

  doSubscribe()
  return channel
}
