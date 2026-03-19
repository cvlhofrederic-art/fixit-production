'use client'

import useSWR, { type SWRConfiguration } from 'swr'

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error(`${r.status}`)
  return r.json()
})

/**
 * Wrapper around SWR for API fetching with built-in deduplication and caching.
 * Replaces raw useEffect + fetch patterns.
 *
 * @example
 * const { data, isLoading } = useFetch<{ clients: Client[] }>(`/api/artisan-clients?artisan_id=${id}`)
 * const clients = data?.clients ?? []
 */
export function useFetch<T = unknown>(
  url: string | null,
  options?: SWRConfiguration,
) {
  return useSWR<T>(url, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5000,
    ...options,
  })
}
