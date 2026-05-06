import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MrrCard } from '@/components/admin/MrrCard'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  ;(globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch
})

describe('MrrCard', () => {
  it('shows the formatted MRR when the API returns a snapshot', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          available: true,
          latest: {
            date: '2026-05-06',
            mrr_cents: 49000,
            active_count: 10,
            churn_count: 1,
            trial_count: 1,
            past_due_count: 0,
          },
          series: [],
          window_days: 30,
        }),
        { status: 200 }
      )
    )
    render(<MrrCard getToken={async () => 'jwt'} />)
    expect(await screen.findByText(/MRR \(snapshot quotidien\)/)).toBeInTheDocument()
    // 49000 cents = 490 € — Intl can use NBSP for thousands separator
    expect(screen.getByText(/490\s?€/)).toBeInTheDocument()
    expect(screen.getByText('10 actifs')).toBeInTheDocument()
  })

  it('renders the not-yet-provisioned hint when migration is missing', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          available: false,
          reason: 'subscription_metrics table not yet provisioned',
          latest: null,
          series: [],
        }),
        { status: 200 }
      )
    )
    render(<MrrCard getToken={async () => 'jwt'} />)
    expect(await screen.findByText(/migration 100 à appliquer/)).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('surfaces an error message when the fetch fails', async () => {
    fetchMock.mockResolvedValueOnce(new Response('boom', { status: 500 }))
    render(<MrrCard getToken={async () => 'jwt'} />)
    await waitFor(() => {
      expect(screen.getByText(/erreur:/)).toBeInTheDocument()
    })
  })
})
