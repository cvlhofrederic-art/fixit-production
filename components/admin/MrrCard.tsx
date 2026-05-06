'use client'

import { useEffect, useState } from 'react'

/**
 * MRR card for the super-admin overview tab.
 *
 * Reads /api/admin/revenue. The endpoint returns { available: false, … }
 * when migration 100 hasn't been applied yet — we render a "data not yet
 * provisioned" state instead of crashing or showing a fake zero.
 */

interface MrrPayload {
  available: boolean
  reason?: string
  latest: {
    date: string
    mrr_cents: number
    active_count: number
    churn_count: number
    trial_count: number
    past_due_count: number
  } | null
  series: Array<{ date: string; mrr_cents: number }>
}

function formatEuros(cents: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

export function MrrCard({ getToken }: { getToken: () => Promise<string> }) {
  const [data, setData] = useState<MrrPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const token = await getToken()
        const res = await fetch('/api/admin/revenue?days=30', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }
        const payload = (await res.json()) as MrrPayload
        if (!cancelled) setData(payload)
      } catch (err) {
        if (!cancelled) setError((err as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [getToken])

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">💶</span>
        {data?.latest && (
          <span className="text-xs font-mono text-gray-400">
            {data.latest.active_count} actifs
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-white">
        {loading ? '…' : !data?.available ? '—' : data.latest ? formatEuros(data.latest.mrr_cents) : '0 €'}
      </div>
      <div className="text-xs text-gray-500 mt-1">
        {error
          ? `MRR (erreur: ${error})`
          : !data?.available
          ? 'MRR (migration 100 à appliquer)'
          : 'MRR (snapshot quotidien)'}
      </div>
    </div>
  )
}

export default MrrCard
